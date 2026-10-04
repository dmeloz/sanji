// Référentiel de savoir culinaire (savoir-culinaire/) : conforme à FORMAT.md, jamais branché sur l'application.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estAdministration, lireThemes, validerTheme } from '../outils/generer-savoir-culinaire.mjs';

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
  for (const f of readdirSync(resolve(RACINE, 'savoir-culinaire/donnees')).filter((n) => n.endsWith('.json'))) {
    assert.ok(existsSync(resolve(RACINE, 'savoir-culinaire/fiches', f.replace('.json', '.md'))), `fiche manquante pour ${f}`);
  }
});

test('le référentiel n\'est branché sur rien : aucun fichier de app/ ne le lit', () => {
  const lire = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? lire(resolve(d, x.name)) : [resolve(d, x.name)]));
  for (const f of lire(resolve(RACINE, 'app')).filter((n) => /\.(js|html|json)$/.test(n))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /savoir-culinaire/i, `${f} référence le référentiel`);
  }
});

test('aucun secret ni jeton dans le référentiel', () => {
  const lire = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? lire(resolve(d, x.name)) : [resolve(d, x.name)]));
  for (const f of lire(resolve(RACINE, 'savoir-culinaire'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /(sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9._-]{20,}|password\s*[:=])/i, f);
  }
});
