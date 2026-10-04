#!/usr/bin/env node
// Valide savoir-culinaire/donnees/*.json (règles de savoir-culinaire/FORMAT.md) et génère l'index
// savoir-culinaire/savoir-culinaire.json et savoir-culinaire/INDEX.md. N'écrit rien dans app/ : le référentiel
// n'est pas branché sur l'application. Usage : node outils/generer-savoir-culinaire.mjs   (ou : npm run culinaire)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOSSIER = resolve(RACINE, 'savoir-culinaire');

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
    if (x.statut !== 'a_valider') e.push(`${o(id)} : le statut doit être « a_valider ».`);
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

function principal() {
  const { themes, erreurs } = lireThemes();
  if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }
  const entrees = themes.flatMap((t) => t.entrees);
  const index = { etiquette: 'SAVOIR_CULINAIRE', genere_le: new Date().toISOString().slice(0, 10), themes: themes.map((t) => t.theme), entrees };
  writeFileSync(resolve(DOSSIER, 'savoir-culinaire.json'), JSON.stringify(index, null, 1) + '\n');
  const lignes = ['# Savoir culinaire — index', '', 'Fichier généré par `npm run culinaire` : ne pas éditer. Tout est à valider par la propriétaire ; rien n\'est branché sur l\'application.', '',
    '| Thème | Entrées | Avec valeur chiffrée | Confiance faible | À valider localement | Lacunes |', '|---|---|---|---|---|---|'];
  for (const t of themes) {
    const n = t.entrees;
    lignes.push(`| ${t.titre ?? t.theme} | ${n.length} | ${n.filter((x) => x.valeur).length} | ${n.filter((x) => x.confiance === 'faible').length} | ${n.filter((x) => x.portee !== 'general').length} | ${t.lacunes.length} |`);
  }
  lignes.push('', `Total : ${entrees.length} entrées.`, '');
  writeFileSync(resolve(DOSSIER, 'INDEX.md'), lignes.join('\n'));
  console.log(`${entrees.length} entrées, ${themes.length} thèmes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal();
