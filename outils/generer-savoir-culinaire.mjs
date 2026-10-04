#!/usr/bin/env node
// Valide savoir/culinaire/donnees/*.json (règles de savoir/culinaire/FORMAT.md) et savoir/culinaire/rattachements.json,
// génère l'index savoir/culinaire/savoir-culinaire.json et savoir/culinaire/INDEX.md, et le module embarqué
// app/js/donnees/savoir-culinaire.js (référentiel allégé + rattachements, gelé), lu par app/js/domaine/standards-base.js.
// Usage : node outils/generer-savoir-culinaire.mjs   (ou : npm run culinaire)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOSSIER = resolve(RACINE, 'savoir/culinaire');
export const SORTIE_MODULE = resolve(RACINE, 'app/js/donnees/savoir-culinaire.js');

const TYPES = new Set(['repere', 'technique', 'regle', 'definition']);
const ETATS_POIDS = new Set(['sec', 'cru_net', 'cuit']);
const CONFIANCES = new Set(['haute', 'moyenne', 'faible']);
const PORTEES = new Set(['general', 'a_valider_localement']);
const TYPES_SOURCE = new Set(['officielle', 'professionnelle', 'manuel', 'base_sanji', 'web']);
const UNITES_POIDS = new Set(['g', 'kg', 'g/portion', 'g/kg', '%', 'ratio']);
const ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const CANTONS = 'ag ai ar be bl bs fr ge gl gr ju lu ne nw ow sg sh so sz tg ti ur vd vs zg zh'.split(' ');
/** Administration fédérale (…admin.ch), cantonale (…<canton>.ch), ou administration étrangère reconnue (.gov, europa.eu). */
export function estAdministration(url) {
  let h;
  try { h = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return h.endsWith('.admin.ch') || h === 'admin.ch' || h.endsWith('.gov') || h.endsWith('.europa.eu') || h === 'europa.eu'
    || CANTONS.some((c) => h === `${c}.ch` || h.endsWith(`.${c}.ch`));
}
const estTexte = (x) => typeof x === 'string' && x.trim() !== '';
const estNombre = (x) => typeof x === 'number' && Number.isFinite(x);

/** Erreurs d'un document de thème (liste de textes en français ; vide si conforme). */
export function validerTheme(doc, nomFichier = '?') {
  const e = [];
  const o = (id) => `${nomFichier} (${id})`;
  if (doc?.etiquette !== 'SAVOIR_CULINAIRE') e.push(`${nomFichier} : étiquette « SAVOIR_CULINAIRE » absente.`);
  if (!estTexte(doc?.theme)) e.push(`${nomFichier} : thème absent.`);
  if (!Array.isArray(doc?.entrees)) return [...e, `${nomFichier} : « entrees » n'est pas une liste.`];
  if (!Array.isArray(doc.lacunes)) e.push(`${nomFichier} : « lacunes » doit être une liste (même vide).`);
  for (const x of doc.entrees) {
    const id = x?.id ?? '?';
    if (!ID_RE.test(String(id))) e.push(`${o(id)} : identifiant invalide.`);
    else if (!String(id).startsWith(`${doc.theme}.`)) e.push(`${o(id)} : l'identifiant doit commencer par « ${doc.theme}. ».`);
    if (!estTexte(x.sujet)) e.push(`${o(id)} : sujet absent.`);
    if (!TYPES.has(x.type)) e.push(`${o(id)} : type invalide.`);
    if (!estTexte(x.enonce)) e.push(`${o(id)} : énoncé absent.`);
    const docValide = estTexte(doc.validation?.le) && estTexte(doc.validation?.par) && estTexte(doc.validation?.decision);
    if (x.statut === 'valide_chef' ? !docValide : x.statut !== 'a_valider') e.push(`${o(id)} : statut « a_valider », ou « valide_chef » avec une validation écrite au niveau du document.`);
    if (x.usage_calcul !== false) e.push(`${o(id)} : usage_calcul doit être false.`);
    if (!CONFIANCES.has(x.confiance)) e.push(`${o(id)} : confiance invalide.`);
    if (!PORTEES.has(x.portee)) e.push(`${o(id)} : portée invalide.`);
    if (!Array.isArray(x.sources) || x.sources.length === 0) e.push(`${o(id)} : aucune source.`);
    else for (const s of x.sources) {
      if (!estTexte(s?.titre) || !estTexte(s?.organisme) || !estTexte(s?.url)) e.push(`${o(id)} : source incomplète (titre, organisme, url).`);
      if (!TYPES_SOURCE.has(s?.type_source)) e.push(`${o(id)} : type de source invalide.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s?.consulte))) e.push(`${o(id)} : date de consultation invalide.`);
      if (typeof s?.extrait !== 'string') e.push(`${o(id)} : extrait absent (chaîne vide permise).`);
      else if (s.extrait.split(/\s+/).filter(Boolean).length > 15) e.push(`${o(id)} : extrait de plus de 15 mots.`);
    }
    if (x.valeur !== null && x.valeur !== undefined) {
      const v = x.valeur;
      const aMin = v.min !== undefined && v.min !== null, aMax = v.max !== undefined && v.max !== null;
      // Une valeur est une fourchette (min et max) ou un seuil (un seul des deux : « au plus 5 °C », « au moins 70 °C »).
      if ((!aMin && !aMax) || (aMin && !estNombre(v.min)) || (aMax && !estNombre(v.max)) || (aMin && aMax && v.min > v.max) || !estTexte(v.unite)) e.push(`${o(id)} : valeur invalide (min et/ou max, unité).`);
      else if (UNITES_POIDS.has(String(v.unite)) && !ETATS_POIDS.has(x.etat_poids)) e.push(`${o(id)} : une valeur en poids ou en rendement exige son état (sec, cru_net, cuit).`);
    }
    if (x.etat_poids != null && !ETATS_POIDS.has(x.etat_poids)) e.push(`${o(id)} : état de poids invalide.`);
    // Sources : une url est en https (ou une référence à la base de Sanji) ; « officielle » est réservé aux administrations
    // et aux textes de loi ; une confiance haute exige au moins une source qui n'est ni web ni la base de Sanji seule.
    for (const s of Array.isArray(x.sources) ? x.sources : []) {
      if (/^http:\/\//i.test(String(s?.url))) e.push(`${o(id)} : url en http (https exigé).`);
      if (s?.type_source === 'officielle' && /^https?:/i.test(String(s?.url)) && !estAdministration(s.url)) {
        e.push(`${o(id)} : source « officielle » sur un domaine qui n'est pas une administration.`);
      }
    }
    if (x.confiance === 'haute' && Array.isArray(x.sources) && x.sources.length > 0
        && !x.sources.some((s) => ['officielle', 'professionnelle', 'manuel'].includes(s?.type_source))) {
      e.push(`${o(id)} : confiance haute sans source officielle, professionnelle ou de manuel.`);
    }
    if (x.verification !== undefined) {
      const v = x.verification;
      if (!['confirmee', 'partielle', 'non_confirmee', 'base_sanji_seule'].includes(v?.resultat) || !/^\d{4}-\d{2}-\d{2}$/.test(String(v?.le))) e.push(`${o(id)} : vérification invalide (le, resultat).`);
      else if (v.resultat === 'non_confirmee' && x.confiance !== 'faible') e.push(`${o(id)} : une valeur non confirmée a une confiance faible.`);
      else if (v.resultat === 'base_sanji_seule' && x.confiance === 'haute') e.push(`${o(id)} : la base de Sanji seule ne donne pas une confiance haute.`);
      else if (x.confiance === 'haute' && v.resultat !== 'confirmee') e.push(`${o(id)} : une confiance haute exige une vérification confirmée.`);
    }
    if (x.portee === 'general' && /\b(RS \d|LDAl|OHyg|fedlex)\b/i.test(`${x.enonce} ${x.conditions ?? ''}`)) {
      e.push(`${o(id)} : une règle de droit doit avoir la portée « a_valider_localement ».`);
    }
  }
  for (const l of doc.lacunes ?? []) if (!estTexte(l?.sujet) || !estTexte(l?.raison)) e.push(`${nomFichier} : lacune incomplète.`);
  return e;
}

/** Lit tous les thèmes ; retourne { themes, erreurs }. Les identifiants sont uniques sur l'ensemble. */
export function lireThemes(dossier = DOSSIER) {
  const themes = [];
  const erreurs = [];
  const vus = new Set();
  const fichiers = readdirSync(resolve(dossier, 'donnees')).filter((f) => f.endsWith('.json')).sort();
  for (const f of fichiers) {
    let doc;
    try { doc = JSON.parse(readFileSync(resolve(dossier, 'donnees', f), 'utf8')); } catch { erreurs.push(`${f} : JSON illisible.`); continue; }
    erreurs.push(...validerTheme(doc, f));
    for (const x of doc.entrees ?? []) {
      if (vus.has(x.id)) erreurs.push(`${f} : identifiant en double « ${x.id} ».`);
      vus.add(x.id);
    }
    themes.push(doc);
  }
  return { themes, erreurs };
}

// ---------------------------------------------------------------- rattachements (standards de base)

/** Usages d'une entrée dans les calculs, et unités normalisées admises pour chacun (null : entrée sans valeur). */
export const USAGES = Object.freeze({
  rendement_parage: ['%'],
  rendement_cuisson: ['x', '%'],
  conservation: ['jours'],
  cuisson_temps: ['min'],
  temperature: ['°C'],
  buffet_couvert: ['g/couvert'],
  refroidissement: ['h'],
  limite_duree: ['h'],
  duree_stockage: ['h', 'semaines', 'mois'],
  allergene: [null],
});
export const SENS = Object.freeze(['prudent_min', 'prudent_max']);
const SENS_PERMIS = new Set(['conservation', 'temperature', 'refroidissement', 'limite_duree', 'duree_stockage']);
const USAGES_RENDEMENT = new Set(['rendement_parage', 'rendement_cuisson']);

/**
 * Unité normalisée d'une unité écrite dans le référentiel (« % de perte du poids brut » -> « % », « jours après le jour
 * de production » -> « jours », « °C à cœur » -> « °C », « × poids sec » -> « x »), ou null si elle n'en a pas.
 * Aucune conversion : « h », « semaines » et « mois » sont des unités à part entière, jamais ramenées en jours.
 */
export function uniteNormalisee(texte) {
  const t = String(texte ?? '').trim();
  if (/^°C(?=\s|\(|,|$)/.test(t)) return '°C';
  if (/^%/.test(t)) return '%';
  if (/^(?:jours?|j)(?=\s|$)/.test(t)) return 'jours';
  if (/^min(?=\s|\(|$)/.test(t)) return 'min';
  if (/^h(?=\s|\(|$)/.test(t)) return 'h';
  if (/^semaines?(?=\s|\(|$)/.test(t)) return 'semaines';
  if (/^mois(?=\s|\(|$)/.test(t)) return 'mois';
  if (/^[x×](?=\s|$)/.test(t)) return 'x';
  if (/^g(?:\/couvert$|\s.*\bpar couvert\b)/.test(t)) return 'g/couvert';
  return null;
}

/** Cible lisible d'un rattachement (pour les messages et l'unicité). */
const texteCible = (c) => (c?.famille ? `famille ${c.famille}` : c?.groupe ? `groupe ${c.groupe}` : `règle ${c?.regle_generale}`);

/**
 * Erreurs d'un document de rattachements (liste de textes ; vide si conforme).
 * @param {object} doc contenu de savoir/culinaire/rattachements.json
 * @param {Map<string, object>} entrees entrées du référentiel par identifiant
 * @param {{familles: Map<string, {etapes:string[]}>, groupes: Set<string>, categories: Set<string>}|null} lexique
 *   lexique de app/js/domaine/savoir.js (null : familles et groupes non vérifiés)
 */
export function validerRattachements(doc, entrees, lexique = null) {
  const e = [];
  if (doc?.etiquette !== 'SAVOIR_CULINAIRE_RATTACHEMENTS') e.push('rattachements : étiquette « SAVOIR_CULINAIRE_RATTACHEMENTS » absente.');
  const regles = new Map();
  for (const r of Array.isArray(doc?.regles_generales) ? doc.regles_generales : []) {
    if (!/^[a-z_]+$/.test(String(r?.cle)) || !estTexte(r?.libelle)) { e.push(`règle générale invalide : ${JSON.stringify(r)}.`); continue; }
    if (regles.has(r.cle)) e.push(`règle générale en double : ${r.cle}.`);
    for (const g of r.groupes ?? []) if (lexique && !lexique.groupes.has(g)) e.push(`règle ${r.cle} : groupe absent du lexique « ${g} ».`);
    for (const c of r.categories ?? []) if (lexique && !lexique.categories.has(c)) e.push(`règle ${r.cle} : catégorie inconnue « ${c} ».`);
    regles.set(r.cle, r);
  }
  if (!Array.isArray(doc?.rattachements)) return [...e, 'rattachements : « rattachements » n\'est pas une liste.'];
  const vus = new Set();
  const uniques = new Set();
  for (const r of doc.rattachements) {
    const id = r?.id ?? '?';
    const x = entrees.get(id);
    if (!x) { e.push(`${id} : identifiant inexistant dans le référentiel.`); continue; }
    if (vus.has(id)) e.push(`${id} : rattaché deux fois.`);
    vus.add(id);
    if (!Object.hasOwn(USAGES, r.usage)) { e.push(`${id} : usage inconnu « ${r.usage} ».`); continue; }
    const c = r.cible ?? {};
    const cles = ['famille', 'groupe', 'regle_generale'].filter((k) => c[k] !== undefined);
    if (cles.length !== 1) e.push(`${id} : la cible désigne exactement une famille, un groupe ou une règle générale.`);
    if (c.famille !== undefined && lexique && !lexique.familles.has(c.famille)) e.push(`${id} : famille absente du lexique « ${c.famille} ».`);
    if (c.groupe !== undefined && lexique && !lexique.groupes.has(c.groupe)) e.push(`${id} : groupe absent du lexique « ${c.groupe} ».`);
    if (c.regle_generale !== undefined && !regles.has(c.regle_generale)) e.push(`${id} : règle générale inconnue « ${c.regle_generale} ».`);
    if (c.etat !== undefined && !ETATS_POIDS.has(c.etat)) e.push(`${id} : état de la cible invalide.`);
    if (c.etat !== undefined && x.etat_poids && x.etat_poids !== c.etat) e.push(`${id} : l'état de la cible contredit celui de l'entrée.`);
    // Unité : normalisée, admise pour l'usage, et conforme à l'unité réellement écrite dans l'entrée.
    if (!USAGES[r.usage].includes(r.unite)) e.push(`${id} : unité non normalisée ou non admise pour ${r.usage} (« ${r.unite} »).`);
    else if (r.unite === null) {
      if (x.valeur) e.push(`${id} : une entrée chiffrée a une unité normalisée.`);
    } else if (!x.valeur) e.push(`${id} : l'usage ${r.usage} demande une valeur chiffrée.`);
    else if (uniteNormalisee(x.valeur.unite) !== r.unite) e.push(`${id} : l'unité réelle « ${x.valeur.unite} » ne correspond pas à « ${r.unite} ».`);
    if (USAGES_RENDEMENT.has(r.usage)) {
      if (r.unite === '%' && !/perte/.test(String(x.valeur?.unite))) e.push(`${id} : un rendement en % doit être une perte (« % de perte … »).`);
      if (!ETATS_POIDS.has(x.etat_poids)) e.push(`${id} : un rendement exige l'état du poids de l'entrée.`);
      const etape = r.usage === 'rendement_parage' ? 'parage' : 'cuisson';
      if (c.famille !== undefined && lexique?.familles.get(c.famille) && !lexique.familles.get(c.famille).etapes.includes(etape)) {
        e.push(`${id} : la famille ${c.famille} n'a pas d'étape ${etape} dans le lexique.`);
      }
    }
    // Sens : obligatoire pour une durée de conservation (le minimum) et pour une température d'hygiène.
    const hygiene = x.theme === 'hygiene' || String(id).startsWith('hygiene.') || x.portee === 'a_valider_localement';
    if (r.sens !== undefined && !SENS.includes(r.sens)) e.push(`${id} : sens invalide « ${r.sens} ».`);
    if (r.usage === 'conservation' && r.sens !== 'prudent_min') e.push(`${id} : une durée de conservation se lit au minimum (sens « prudent_min »).`);
    if (r.usage === 'temperature' && hygiene && r.sens === undefined) e.push(`${id} : une température d'hygiène exige un sens.`);
    if (['refroidissement', 'limite_duree'].includes(r.usage) && r.sens === undefined) e.push(`${id} : une durée d'hygiène exige un sens.`);
    if (r.usage === 'duree_stockage' && r.sens !== 'prudent_min') e.push(`${id} : une durée de stockage se lit au minimum (sens « prudent_min »).`);
    if (r.sens !== undefined && !SENS_PERMIS.has(r.usage)) e.push(`${id} : sens réservé à la conservation et aux températures.`);
    if (r.unite !== null) {
      const cle = `${r.usage}|${texteCible(c)}|${c.etat ?? x.etat_poids ?? ''}`;
      if (uniques.has(cle)) e.push(`${id} : un autre rattachement porte déjà ${r.usage} pour ${texteCible(c)}.`);
      uniques.add(cle);
    }
  }
  for (const a of Array.isArray(doc.reperes_aide) ? doc.reperes_aide : []) {
    if (!entrees.has(a?.id)) e.push(`${a?.id} : aide sur un identifiant inexistant.`);
    if (vus.has(a?.id)) e.push(`${a?.id} : une entrée rattachée n'est pas aussi une aide.`);
    if (lexique && !lexique.familles.has(a?.famille)) e.push(`${a?.id} : famille absente du lexique « ${a?.famille} ».`);
  }
  return e;
}

/** Lit savoir/culinaire/rattachements.json. */
export function lireRattachements(dossier = DOSSIER) {
  return JSON.parse(readFileSync(resolve(dossier, 'rattachements.json'), 'utf8'));
}

const LONGUEUR_CONDITIONS = 300;
const tronquer = (t) => { const s = String(t ?? ''); return s.length > LONGUEUR_CONDITIONS ? `${s.slice(0, LONGUEUR_CONDITIONS - 1)}…` : s; };

/** Entrées allégées pour l'application, avec leur rattachement (ou leur rubrique d'aide). */
export function entreesEmbarquees(themes, doc) {
  const rattachements = new Map(doc.rattachements.map((r) => [r.id, r]));
  const aides = new Map((doc.reperes_aide ?? []).map((a) => [a.id, a]));
  return themes.flatMap((t) => t.entrees.map((x) => {
    const r = rattachements.get(x.id);
    return {
      id: x.id, theme: t.theme, sujet: x.sujet, type: x.type, enonce: x.enonce, valeur: x.valeur ?? null,
      etat_poids: x.etat_poids ?? null, conditions: tronquer(x.conditions), confiance: x.confiance, portee: x.portee,
      verification: x.verification ? { resultat: x.verification.resultat } : null,
      sources: (x.sources ?? []).map((s) => ({ titre: s.titre, organisme: s.organisme, url: s.url })),
      rattachement: r ? { usage: r.usage, cible: r.cible, unite: r.unite, ...(r.sens ? { sens: r.sens } : {}) } : null,
      aide: r ? null : aides.has(x.id) ? { famille: aides.get(x.id).famille } : { theme: t.theme },
    };
  }));
}

/** Texte du module app/js/donnees/savoir-culinaire.js (sortie déterministe : même source, même texte). */
export function genererModule(themes, doc) {
  const version = themes.map((t) => t.genere_le ?? '').sort().at(-1) || doc.etabli_le;
  const regles = (doc.regles_generales ?? []).map((r) => '  ' + JSON.stringify(r)).join(',\n');
  const corps = entreesEmbarquees(themes, doc).map((x) => '  ' + JSON.stringify(x)).join(',\n');
  return `// FICHIER GÉNÉRÉ : NE PAS ÉDITER À LA MAIN.
// Produit par outils/generer-savoir-culinaire.mjs (commande : npm run culinaire) à partir de
// savoir/culinaire/donnees/*.json et savoir/culinaire/rattachements.json.
//
// Référentiel de savoir culinaire validé par la propriétaire (2026-10-04), allégé pour l'application. Les entrées
// rattachées (\`rattachement\`) sont des STANDARDS DE BASE lus par js/domaine/standards-base.js (décision du 2026-10-04,
// « Standards de base et ajustement terrain ») ; les autres sont des aides (\`aide\` : famille ou thème).
// Les fourchettes sont gardées telles quelles (min, max) : aucune valeur par défaut n'est calculée ici.

export const VERSION_REFERENTIEL = ${JSON.stringify(version)};

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    Object.values(valeur).forEach(geler);
    Object.freeze(valeur);
  }
  return valeur;
}

export const REGLES_GENERALES = geler([
${regles},
]);

export const SAVOIR_CULINAIRE = geler([
${corps},
]);
`;
}

/** Lexique de app/js/domaine/savoir.js pour la validation des rattachements, ou null s'il ne se charge pas. */
export async function chargerLexique() {
  try {
    const savoir = await import(pathToFileURL(resolve(RACINE, 'app/js/domaine/savoir.js')).href);
    const statuts = await import(pathToFileURL(resolve(RACINE, 'app/js/domaine/statuts.js')).href);
    return {
      familles: new Map(savoir.FAMILLES.map((f) => [f.cle, { etapes: f.etapes.map((x) => x.etape) }])),
      groupes: new Set(savoir.GROUPES.map((g) => g.cle)),
      categories: new Set(Object.keys(statuts.CATEGORIE)),
    };
  } catch {
    return null;
  }
}

async function principal() {
  const { themes, erreurs } = lireThemes();
  const doc = lireRattachements();
  const parId = new Map(themes.flatMap((t) => t.entrees.map((x) => [x.id, { ...x, theme: t.theme }])));
  const lexique = await chargerLexique();
  if (!lexique) console.warn('Lexique de savoir.js non chargé : familles et groupes des rattachements non vérifiés (npm test le fait).');
  erreurs.push(...validerRattachements(doc, parId, lexique));
  if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }
  const module = genererModule(themes, doc);
  writeFileSync(SORTIE_MODULE, module);
  console.log(`${SORTIE_MODULE} : ${doc.rattachements.length} rattachements, ${Buffer.byteLength(module)} octets.`);
  const entrees = themes.flatMap((t) => t.entrees);
  const index = { etiquette: 'SAVOIR_CULINAIRE', genere_le: new Date().toISOString().slice(0, 10), themes: themes.map((t) => t.theme), entrees };
  writeFileSync(resolve(DOSSIER, 'savoir-culinaire.json'), JSON.stringify(index, null, 1) + '\n');
  const lignes = ['# Savoir culinaire — index', '', 'Fichier généré par `npm run culinaire` : ne pas éditer. Contenu validé par la propriétaire le 2026-10-04 (sauf entrées marquées « a_valider »). Les entrées listées dans `rattachements.json` sont des standards de base utilisés par les calculs (décision du 2026-10-04) ; les autres servent d\'aide.', '',
    '| Thème | Entrées | Validées | Avec valeur chiffrée | Vérifiées à la source | Confiance faible | À valider localement | Lacunes |', '|---|---|---|---|---|---|---|---|'];
  for (const t of themes) {
    const n = t.entrees;
    lignes.push(`| ${t.titre ?? t.theme} | ${n.length} | ${n.filter((x) => x.statut === 'valide_chef').length} | ${n.filter((x) => x.valeur).length} | ${n.filter((x) => x.verification?.resultat === 'confirmee').length} | ${n.filter((x) => x.confiance === 'faible').length} | ${n.filter((x) => x.portee !== 'general').length} | ${t.lacunes.length} |`);
  }
  lignes.push('', `Total : ${entrees.length} entrées.`, '');
  writeFileSync(resolve(DOSSIER, 'INDEX.md'), lignes.join('\n'));
  console.log(`${entrees.length} entrées, ${themes.length} thèmes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal();
