// Référentiel de savoir culinaire (savoir/culinaire/) : conforme à FORMAT.md ; branché sur l'application seulement par le
// module généré app/js/donnees/savoir-culinaire.js et les rattachements choisis à la main (savoir/culinaire/rattachements.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chargerLexique, estAdministration, genererModule, lireRattachements, lireThemes, uniteNormalisee, validerRattachements,
  validerTheme,
} from '../outils/generer-savoir-culinaire.mjs';
import { REGLES_GENERALES, SAVOIR_CULINAIRE, VERSION_REFERENTIEL } from '../app/js/donnees/savoir-culinaire.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entree = (o = {}) => ({
  id: 'essai.sujet.aspect', sujet: 'Sujet', type: 'repere', enonce: 'Un énoncé.', valeur: { min: 1, max: 2, unite: 'min' }, etat_poids: null,
  conditions: '', sources: [{ titre: 'T', organisme: 'O', url: 'https://exemple.test', consulte: '2026-10-04', extrait: '', type_source: 'web' }],
  confiance: 'moyenne', statut: 'a_valider', portee: 'general', usage_calcul: false, ...o });
const doc = (...entrees) => ({ etiquette: 'SAVOIR_CULINAIRE', theme: 'essai', entrees, lacunes: [] });

test('le validateur accepte une entrée conforme', () => assert.deepEqual(validerTheme(doc(entree()), 'x.json'), []));

test('le validateur refuse : statut validé, usage dans le calcul, chiffre sans source, poids sans état, extrait trop long, droit « général »', () => {
  const cas = {
    'statut': entree({ statut: 'valide' }),
    'usage_calcul': entree({ usage_calcul: true }),
    'source': entree({ sources: [] }),
    'état': entree({ valeur: { min: 80, max: 100, unite: 'g' }, etat_poids: null }),
    'extrait': entree({ sources: [{ titre: 'T', organisme: 'O', url: 'u', consulte: '2026-10-04', extrait: 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize', type_source: 'web' }] }),
    'droit': entree({ enonce: 'Selon la LDAl, c\'est obligatoire.' }),
    'fourchette': entree({ valeur: { min: 5, max: 2, unite: 'min' } }),
  };
  for (const [nom, x] of Object.entries(cas)) assert.ok(validerTheme(doc(x), 'x.json').length > 0, `devrait refuser : ${nom}`);
  assert.deepEqual(validerTheme(doc(entree({ valeur: { min: 80, max: 100, unite: 'g' }, etat_poids: 'sec' })), 'x.json'), []);
  // Un seuil (un seul côté) est permis ; une valeur sans aucun côté ne l'est pas.
  assert.deepEqual(validerTheme(doc(entree({ valeur: { max: 5, unite: '°C' } })), 'x.json'), []);
  assert.ok(validerTheme(doc(entree({ valeur: { unite: '°C' } })), 'x.json').length > 0);
});

test('statut validé : seulement avec une validation écrite au niveau du document', () => {
  assert.ok(validerTheme(doc(entree({ statut: 'valide_chef' })), 'x.json').length > 0);
  const valide = { ...doc(entree({ statut: 'valide_chef' })), validation: { le: '2026-10-04', par: 'propriétaire', decision: '02-Decisions-validees/x.md' } };
  assert.deepEqual(validerTheme(valide, 'x.json'), []);
  assert.ok(validerTheme({ ...valide, entrees: [entree({ statut: 'valide_chef', usage_calcul: true })] }, 'x.json').length > 0, 'usage_calcul reste interdit');
});

test('le validateur refuse : url en http, officielle sur un site privé, confiance haute sans source solide', () => {
  const src = (o) => [{ titre: 'T', organisme: 'O', url: 'https://exemple.test', consulte: '2026-10-04', extrait: '', type_source: 'web', ...o }];
  assert.ok(validerTheme(doc(entree({ sources: src({ url: 'http://exemple.test' }) })), 'x.json').some((m) => /http/.test(m)));
  assert.ok(validerTheme(doc(entree({ sources: src({ type_source: 'officielle' }) })), 'x.json').some((m) => /officielle/.test(m)));
  assert.deepEqual(validerTheme(doc(entree({ sources: src({ type_source: 'officielle', url: 'https://www.fedlex.admin.ch/x' }), confiance: 'haute' })), 'x.json'), []);
  assert.ok(validerTheme(doc(entree({ confiance: 'haute' })), 'x.json').some((m) => /confiance haute/.test(m)));
  assert.ok(validerTheme(doc(entree({ confiance: 'haute', sources: src({ type_source: 'base_sanji' }) })), 'x.json').some((m) => /confiance haute/.test(m)));
});

test('administrations reconnues : fédérales, cantonales, étrangères ; pas les sites privés', () => {
  for (const u of ['https://www.fedlex.admin.ch/x', 'https://www.blv.admin.ch/y', 'https://www.ag.ch/z', 'https://lebensmittelkontrolle.lu.ch/a', 'https://media.bs.ch/b', 'https://www.fsis.usda.gov/c']) assert.equal(estAdministration(u), true, u);
  for (const u of ['https://www.gastrosuisse.ch/a', 'https://evil-ag.ch.example.com/', 'https://exemple.test', 'pas une url', 'https://notag.ch/x']) assert.equal(estAdministration(u), false, u);
});

test('vérification : résultat et confiance cohérents', () => {
  const v = (resultat) => ({ le: '2026-10-04', resultat, note: '' });
  assert.deepEqual(validerTheme(doc(entree({ verification: v('confirmee') })), 'x.json'), []);
  assert.ok(validerTheme(doc(entree({ verification: v('non_confirmee') })), 'x.json').length > 0, 'non confirmée exige confiance faible');
  assert.deepEqual(validerTheme(doc(entree({ verification: v('non_confirmee'), confiance: 'faible' })), 'x.json'), []);
  const solide = [{ titre: 'T', organisme: 'O', url: 'https://www.blv.admin.ch/x', consulte: '2026-10-04', extrait: '', type_source: 'officielle' }];
  assert.ok(validerTheme(doc(entree({ verification: v('partielle'), confiance: 'haute', sources: solide })), 'x.json').length > 0);
  assert.ok(validerTheme(doc(entree({ verification: v('inventee') })), 'x.json').length > 0);
});

test('le référentiel publié est conforme et ses identifiants sont uniques', () => {
  const { themes, erreurs } = lireThemes();
  assert.deepEqual(erreurs, []);
  assert.ok(themes.length >= 1);
});

test('chaque thème de données a sa fiche lisible', () => {
  for (const f of readdirSync(resolve(RACINE, 'savoir/culinaire/donnees')).filter((n) => n.endsWith('.json'))) {
    assert.ok(existsSync(resolve(RACINE, 'savoir/culinaire/fiches', f.replace('.json', '.md'))), `fiche manquante pour ${f}`);
  }
});

// Adapté le 2026-10-04 (décision « Standards de base ») : le référentiel est branché, mais par une seule porte. Seuls le
// module généré, la liste de cache du service worker et les modules qui l'importent volontairement peuvent le citer.
const CITENT_LE_REFERENTIEL = new Set(['js/donnees/savoir-culinaire.js', 'sw.js', 'js/domaine/standards-base.js']);

test('le référentiel n\'est lu dans app/ que par le module généré et les modules qui l\'importent volontairement', () => {
  const APP = resolve(RACINE, 'app');
  const lire = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? lire(resolve(d, x.name)) : [resolve(d, x.name)]));
  for (const f of lire(APP).filter((n) => /\.(js|html|json)$/.test(n))) {
    const rel = f.slice(APP.length + 1).split('\\').join('/');
    const texte = readFileSync(f, 'utf8');
    if (!CITENT_LE_REFERENTIEL.has(rel)) assert.doesNotMatch(texte, /savoir-culinaire/i, `${rel} référence le référentiel`);
    // Aucun fichier de app/ ne lit les données brutes de savoir/ : seul le module généré (qui les cite comme source) porte le référentiel.
    if (rel !== 'js/donnees/savoir-culinaire.js') assert.doesNotMatch(texte, /savoir\/culinaire\/donnees|savoir-culinaire\.json/, `${rel} lit les données brutes`);
  }
  assert.match(readFileSync(resolve(APP, 'js/domaine/standards-base.js'), 'utf8'), /from '\.\.\/donnees\/savoir-culinaire\.js'/);
});

// ---------------------------------------------------------------- rattachements et module généré

const parId = () => {
  const { themes } = lireThemes();
  return new Map(themes.flatMap((t) => t.entrees.map((x) => [x.id, { ...x, theme: t.theme }])));
};

test('rattachements publiés : conformes au référentiel et au lexique de savoir.js', async () => {
  const lexique = await chargerLexique();
  assert.ok(lexique, 'le lexique de savoir.js se charge');
  assert.deepEqual(validerRattachements(lireRattachements(), parId(), lexique), []);
});

test('rattachements : refus d\'un id inexistant, d\'une famille hors lexique, d\'une unité non normalisée ou qui ne colle pas', async () => {
  const lexique = await chargerLexique();
  const ids = parId();
  const base = lireRattachements();
  const avec = (r) => ({ ...base, rattachements: [r] });
  const cas = {
    'id inexistant': { id: 'feculents.inexistant.aspect', usage: 'conservation', cible: { famille: 'riz' }, unite: 'jours', sens: 'prudent_min' },
    'famille hors lexique': { id: 'feculents.riz.conservation.cuit', usage: 'conservation', cible: { famille: 'risotto_maison' }, unite: 'jours', sens: 'prudent_min' },
    'groupe hors lexique': { id: 'feculents.riz.conservation.cuit', usage: 'conservation', cible: { groupe: 'feculents' }, unite: 'jours', sens: 'prudent_min' },
    'unité non normalisée': { id: 'feculents.riz.conservation.cuit', usage: 'conservation', cible: { famille: 'riz' }, unite: 'j', sens: 'prudent_min' },
    'unité qui ne colle pas': { id: 'feculents.pates.sec.stockage', usage: 'conservation', cible: { famille: 'pates_seches' }, unite: 'jours', sens: 'prudent_min' },
    'unité admise mais pas pour l\'usage': { id: 'feculents.polenta.cuisson', usage: 'conservation', cible: { famille: 'polenta' }, unite: 'min', sens: 'prudent_min' },
    'rendement en % qui n\'est pas une perte': { id: 'organisation.service-assiette.perte-dressage', usage: 'rendement_parage', cible: { famille: 'carottes' }, unite: '%' },
    'rendement sur une famille sans cette étape': { id: 'legumes.parage.carotte', usage: 'rendement_parage', cible: { famille: 'riz' }, unite: '%' },
    'conservation sans sens prudent': { id: 'feculents.riz.conservation.cuit', usage: 'conservation', cible: { famille: 'riz' }, unite: 'jours' },
    'température d\'hygiène sans sens': { id: 'hygiene.temperature.cuisson-coeur', usage: 'temperature', cible: { regle_generale: 'cuisson_coeur' }, unite: '°C' },
    'règle générale inconnue': { id: 'hygiene.temperature.cuisson-coeur', usage: 'temperature', cible: { regle_generale: 'invente' }, unite: '°C', sens: 'prudent_max' },
    'deux cibles': { id: 'feculents.riz.conservation.cuit', usage: 'conservation', cible: { famille: 'riz', groupe: 'cereales' }, unite: 'jours', sens: 'prudent_min' },
    'usage inconnu': { id: 'feculents.riz.conservation.cuit', usage: 'portion', cible: { famille: 'riz' }, unite: 'jours' },
  };
  for (const [nom, r] of Object.entries(cas)) assert.ok(validerRattachements(avec(r), ids, lexique).length > 0, `devrait refuser : ${nom}`);
  const doublon = { ...base, rattachements: [base.rattachements[0], { ...base.rattachements[0] }] };
  assert.ok(validerRattachements(doublon, ids, lexique).some((m) => /deux fois/.test(m)));
  const memeCible = { ...base, rattachements: [
    { id: 'legumes.parage.pomme-de-terre', usage: 'rendement_parage', cible: { famille: 'pommes_de_terre' }, unite: '%' },
    { id: 'feculents.pdt.perte.friture', usage: 'rendement_parage', cible: { famille: 'pommes_de_terre' }, unite: '%' }] };
  assert.ok(validerRattachements(memeCible, ids, lexique).some((m) => /déjà/.test(m)), 'une seule valeur par usage et par cible');
  const aideFausse = { ...base, reperes_aide: [{ id: 'feculents.riz.pilaf.proportions', famille: 'pilaf' }] };
  assert.ok(validerRattachements(aideFausse, ids, lexique).some((m) => /lexique/.test(m)));
});

test('unités normalisées : seules les unités de la liste, sans conversion', () => {
  const attendu = [['% de perte du poids brut', '%'], ['jours après le jour de production', 'jours'], ['jour', 'jours'], ['j', 'jours'],
    ['°C à cœur', '°C'], ['°C (minimum à cœur)', '°C'], ['min de mijotage', 'min'], ['× poids sec', 'x'], ['x poids sec', 'x'],
    ['g de féculent sec (riz, pâtes) par couvert', 'g/couvert'], ['mois', 'mois'], ['semaines', 'semaines'], ['h', 'h'], ['h (de 50 à 10 °C)', 'h'], ['h sans symptômes', 'h'], ['heures', null], ['mm de côté', null], ['min par face', 'min'], 
    ['g/L', null], ['g', null]];
  for (const [texte, unite] of attendu) assert.equal(uniteNormalisee(texte), unite, texte);
});

test('module généré : identique à la sortie du générateur (relancer « npm run culinaire »), gelé, sans données brutes', () => {
  const { themes } = lireThemes();
  const texte = readFileSync(resolve(RACINE, 'app/js/donnees/savoir-culinaire.js'), 'utf8');
  assert.equal(texte, genererModule(themes, lireRattachements()), 'relancer « npm run culinaire »');
  assert.match(texte, /^\/\/ FICHIER GÉNÉRÉ : NE PAS ÉDITER/);
  assert.equal(VERSION_REFERENTIEL, '2026-10-04');
  assert.equal(SAVOIR_CULINAIRE.length, themes.reduce((n, t) => n + t.entrees.length, 0), 'toutes les entrées');
  assert.ok(Object.isFrozen(SAVOIR_CULINAIRE) && Object.isFrozen(SAVOIR_CULINAIRE[0]) && Object.isFrozen(SAVOIR_CULINAIRE[0].sources[0]));
  assert.ok(Object.isFrozen(REGLES_GENERALES));
  for (const x of SAVOIR_CULINAIRE) {
    assert.deepEqual(Object.keys(x), ['id', 'theme', 'sujet', 'type', 'enonce', 'valeur', 'etat_poids', 'conditions', 'confiance',
      'portee', 'verification', 'sources', 'rattachement', 'aide'], x.id);
    assert.ok(x.conditions.length <= 300, `${x.id} : conditions tronquées à 300 caractères`);
    for (const s of x.sources) assert.deepEqual(Object.keys(s), ['titre', 'organisme', 'url'], x.id);
    assert.ok((x.rattachement === null) !== (x.aide === null), `${x.id} : rattachée ou aide, jamais les deux`);
  }
  // Poids mesuré le 2026-10-04 : environ 405 Ko (73 Ko compressé), dont 140 Ko de sources. Garde-fou contre une dérive.
  assert.ok(Buffer.byteLength(texte) < 450 * 1024, `module trop lourd : ${Buffer.byteLength(texte)} octets`);
});

test('aucun secret ni jeton dans le référentiel', () => {
  const lire = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? lire(resolve(d, x.name)) : [resolve(d, x.name)]));
  for (const f of lire(resolve(RACINE, 'savoir/culinaire'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /(sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9._-]{20,}|password\s*[:=])/i, f);
  }
});
