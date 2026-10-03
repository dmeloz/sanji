#!/usr/bin/env node
// Extrait les tables 11.1 (parage), 11.2 (cuisson) et 11.3 (portionnement) de
// base-officielle-production-stock-hygiene.md et génère app/js/donnees/base-metier.js.
// Extrait aussi, SI ELLE EXISTE, la table de la sous-section « ### 11.4 Repères de portion » vers PORTIONS_BASE
// (colonnes repérées par leur titre : Catégorie, Produit, Rôle, État, Portion, Sources, Notes). Sans cette section,
// PORTIONS_BASE est vide. Une ligne sans produit, sans rôle, sans état ou sans portion reconnus est ignorée.
//
// Le coefficient est sortie / entrée :
//   « 15–20 % » (perte)  -> coefMin 0,80 ; coefMax 0,85
//   « ~33 % »            -> 0,67 pour les deux
//   « gain ×2,5–3 »      -> 2,5 et 3
// Une ligne illisible est ignorée et comptée dans un avertissement : rien n'est deviné.
//
// Usage : node outils/extraire-base-metier.mjs [source.md] [sortie.js]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PAR_DEFAUT = resolve(RACINE, 'base-officielle-production-stock-hygiene.md');
const SORTIE_PAR_DEFAUT = resolve(RACINE, 'app/js/donnees/base-metier.js');

const TABLES = [
  { section: '11.1', etape: 'parage' },
  { section: '11.2', etape: 'cuisson' },
  { section: '11.3', etape: 'portionnement' },
];

const NOMBRE = '(\\d+(?:[.,]\\d+)?)';
const RE_PERTE = new RegExp(`^~?\\s*${NOMBRE}(?:\\s*[–-]\\s*${NOMBRE})?\\s*%(?:\\s+de perte)?$`);
const RE_GAIN = new RegExp(`^gain\\s*×\\s*${NOMBRE}(?:\\s*[–-]\\s*${NOMBRE})?$`, 'i');

// Table facultative : repères de portion (la section peut ne pas exister dans la source).
const TITRE_PORTIONS = /^###\s+11\.4\s+rep[eè]res\s+de\s+portion/i;
const COLONNES_PORTIONS = {
  produit: ['produit'], role: ['role'], etat: ['etat'], portion: ['portion'],
  sources: ['sources', 'source'], note: ['notes', 'note'],
};
const COLONNES_OBLIGATOIRES = ['produit', 'role', 'etat', 'portion'];
const ROLES = { 'plat principal': 'plat_principal', garniture: 'garniture', sauce: 'sauce', autre: 'autre' };
const ETATS = { sec: 'sec', 'cru net': 'cru_net', cuit: 'cuit' };
const UNITES_PORTION = { g: 'g', ml: 'ml', piece: 'piece', pieces: 'piece' };
const RE_PORTION = new RegExp(`^~?\\s*${NOMBRE}(?:\\s*[–-]\\s*${NOMBRE})?\\s*(g|ml|pi[eè]ces?)$`, 'i');

const versNombre = (s) => Number(String(s).replace(',', '.'));
const arrondi = (x) => Math.round(x * 10000) / 10000;

/** Nettoie une cellule Markdown (gras, espaces insécables). */
function nettoyer(cellule) {
  return String(cellule).replace(/\*\*/g, '').replace(/[  ]/g, ' ').trim();
}

/**
 * Lit la cellule « Perte » et renvoie { coefMin, coefMax } ou null si illisible.
 * @param {string} texte
 */
export function lireCoefficients(texte) {
  const t = nettoyer(texte);
  let m = RE_PERTE.exec(t);
  if (m) {
    const a = versNombre(m[1]);
    const b = m[2] !== undefined ? versNombre(m[2]) : a;
    if (a > b || b >= 100) return null;
    return { coefMin: arrondi(1 - b / 100), coefMax: arrondi(1 - a / 100) };
  }
  m = RE_GAIN.exec(t);
  if (m) {
    const a = versNombre(m[1]);
    const b = m[2] !== undefined ? versNombre(m[2]) : a;
    if (a > b || a <= 0) return null;
    return { coefMin: a, coefMax: b };
  }
  return null;
}

/** Renvoie les lignes (cellules) du premier tableau après le titre de section. */
function lignesDeTable(lignes, section) {
  const debut = lignes.findIndex((l) => new RegExp(`^###\\s+${section.replace('.', '\\.')}\\b`).test(l));
  if (debut < 0) return null;
  let i = debut + 1;
  while (i < lignes.length && !lignes[i].trim().startsWith('|')) i += 1;
  const lignesTable = [];
  while (i < lignes.length && lignes[i].trim().startsWith('|')) {
    lignesTable.push(lignes[i].trim());
    i += 1;
  }
  // On saute l'en-tête et la ligne de séparation.
  return lignesTable.slice(2).map((l) => l.replace(/^\||\|$/g, '').split('|').map(nettoyer));
}

const sansAccent = (texte) => nettoyer(texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[_\s]+/g, ' ').trim();
const dans = (table, cle) => (Object.hasOwn(table, cle) ? table[cle] : undefined);

/**
 * Lit la cellule « Portion » (« 100–120 g », « 60 g », « 2 pièces ») et renvoie { min, max, unite, texte }
 * ou null si elle est illisible. Rien n'est deviné : une autre unité, une fourchette inversée ou une portion
 * nulle sont refusées.
 * @param {string} texte
 */
export function lirePortion(texte) {
  const t = nettoyer(texte).replace(/\s+/g, ' ');
  const m = RE_PORTION.exec(t);
  if (!m) return null;
  const min = versNombre(m[1]);
  const max = m[2] !== undefined ? versNombre(m[2]) : min;
  const unite = dans(UNITES_PORTION, sansAccent(m[3]));
  if (!(min > 0) || min > max || !unite) return null;
  return { min, max, unite, texte: t };
}

/**
 * Lit, si elle existe, la table de « ### 11.4 Repères de portion ». Les colonnes sont repérées par leur titre,
 * dans n'importe quel ordre. Une ligne sans produit, sans rôle, sans état (sec, cru net, cuit) ou sans portion
 * reconnus est ignorée et signalée : rien n'est deviné.
 * @returns {{ presente: boolean, portions: object[], ignorees: object[], nbLignes: number }}
 */
function extrairePortions(lignes) {
  const debut = lignes.findIndex((l) => TITRE_PORTIONS.test(l));
  if (debut < 0) return { presente: false, portions: [], ignorees: [], nbLignes: 0 };
  let i = debut + 1;
  // La table doit se trouver dans la section : on s'arrête au titre suivant.
  while (i < lignes.length && !lignes[i].trim().startsWith('|') && !/^#{1,6}\s/.test(lignes[i])) i += 1;
  const table = [];
  while (i < lignes.length && lignes[i].trim().startsWith('|')) {
    table.push(lignes[i].trim());
    i += 1;
  }
  const cellules = (l) => l.replace(/^\||\|$/g, '').split('|').map(nettoyer);
  if (table.length === 0) {
    return { presente: true, portions: [], ignorees: [{ section: '11.4', ligne: '(table introuvable)' }], nbLignes: 0 };
  }
  const entete = cellules(table[0]).map(sansAccent);
  const colonne = Object.fromEntries(Object.entries(COLONNES_PORTIONS)
    .map(([nom, titres]) => [nom, entete.findIndex((t) => titres.includes(t))]));
  const donnees = table.slice(2).map(cellules);
  const manquantes = COLONNES_OBLIGATOIRES.filter((nom) => colonne[nom] < 0);
  const ignorees = [];
  const portions = [];
  if (manquantes.length > 0) {
    ignorees.push({ section: '11.4', ligne: `(colonne(s) obligatoire(s) introuvable(s) : ${manquantes.join(', ')})` });
    for (const cel of donnees) ignorees.push({ section: '11.4', ligne: cel.join(' | ') });
    return { presente: true, portions, ignorees, nbLignes: donnees.length };
  }
  for (const cel of donnees) {
    const valeur = (nom) => (colonne[nom] >= 0 ? cel[colonne[nom]] ?? '' : '');
    const produit = valeur('produit');
    const role = dans(ROLES, sansAccent(valeur('role')));
    const etat = dans(ETATS, sansAccent(valeur('etat')));
    const portion = lirePortion(valeur('portion'));
    if (!produit || produit === '—' || !role || !etat || !portion) {
      ignorees.push({ section: '11.4', ligne: cel.join(' | ') });
      continue;
    }
    const sources = valeur('sources');
    const note = valeur('note');
    portions.push({
      produit, role, etat, min: portion.min, max: portion.max, unite: portion.unite, texte: portion.texte,
      sources: sources === '—' ? '' : sources, note: note === '—' ? '' : note,
    });
  }
  return { presente: true, portions, ignorees, nbLignes: donnees.length };
}

/**
 * Extrait la base à partir du texte Markdown.
 * @param {string} markdown
 * @returns {{ lignes: object[], version: string|null, comptes: object, illisibles: object[], portions: object[],
 *   comptesPortions: { presente: boolean, lues: number, ignorees: number } }}
 * `portions` : repères de la section facultative 11.4 (liste vide si elle n'existe pas) ; leurs lignes ignorées
 * sont ajoutées à `illisibles`.
 */
export function extraireBase(markdown) {
  const lignes = markdown.split(/\r?\n/);
  const resultat = [];
  const illisibles = [];
  const comptes = {};
  for (const { section, etape } of TABLES) {
    comptes[etape] = { lues: 0, ignorees: 0 };
    const table = lignesDeTable(lignes, section);
    if (!table) {
      illisibles.push({ section, ligne: '(table introuvable)' });
      continue;
    }
    for (const cellules of table) {
      const [categorie, second, perte, note = ''] = cellules;
      const coef = cellules.length === 4 && categorie && second ? lireCoefficients(perte) : null;
      if (!coef) {
        comptes[etape].ignorees += 1;
        illisibles.push({ section, ligne: cellules.join(' | ') });
        continue;
      }
      // Pour le portionnement la 2e colonne est un geste : on la rattache à la catégorie
      // pour que la recherche par produit reste utile.
      const produit = etape === 'portionnement' ? `${categorie} — ${second}` : second;
      resultat.push({
        etape, categorie, produit, texte: perte.replace(/\s+/g, ' '),
        coefMin: coef.coefMin, coefMax: coef.coefMax, note: note === '—' ? '' : note,
      });
      comptes[etape].lues += 1;
    }
  }
  const repere = extrairePortions(lignes);
  illisibles.push(...repere.ignorees);
  const mv = /^\*\*Version\s+([0-9][0-9.]*)/m.exec(markdown);
  return {
    lignes: resultat, version: mv ? mv[1] : null, comptes, illisibles, portions: repere.portions,
    comptesPortions: { presente: repere.presente, lues: repere.portions.length, ignorees: repere.nbLignes - repere.portions.length },
  };
}

/** Produit le contenu du fichier JavaScript généré. */
export function genererFichier({ lignes, version, portions = [] }, nomSource) {
  const corps = lignes.map((l) => '  ' + JSON.stringify(l)).join(',\n');
  const corpsPortions = portions.map((l) => '  ' + JSON.stringify(l)).join(',\n');
  return `// FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
// Produit par outils/extraire-base-metier.mjs (commande : npm run base) à partir de
// ${nomSource}, tables 11.1 (parage), 11.2 (cuisson), 11.3 (portionnement)
// et, si elle existe, 11.4 (repères de portion).
//
// Ce sont des ESTIMATIONS GÉNÉRIQUES, pas des valeurs du restaurant : toute valeur issue
// d'ici porte la provenance BASE_METIER_ESTIMATION et reste à valider ou à remplacer par
// une pesée maison. Elles ne sont jamais appliquées sans choix explicite de l'utilisateur.
//
// Coefficient = sortie / entrée (perte de 15–20 % -> coefMin 0,80, coefMax 0,85 ;
// gain ×2,5–3 -> 2,5 et 3). Pour le portionnement, « produit » = « catégorie — geste ».

export const PROVENANCE_BASE = 'BASE_METIER_ESTIMATION';

export const VERSION_BASE = ${JSON.stringify(version)};

export const BASE_METIER = [
${corps},
];

// Repères de portion (section 11.4 de la source, facultative) :
// { produit, role, etat, min, max, unite, texte, sources, note }. \`produit\` est le libellé d'une famille ou
// d'un groupe de produits de l'application ; \`etat\` vaut sec, cru_net ou cuit. Liste vide tant que la source
// n'a pas cette section. Même statut que ci-dessus : estimations génériques, jamais appliquées sans validation.
export const PORTIONS_BASE = [${portions.length > 0 ? `\n${corpsPortions},\n` : ''}];
`;
}

function principal() {
  const source = process.argv[2] ? resolve(process.argv[2]) : SOURCE_PAR_DEFAUT;
  const sortie = process.argv[3] ? resolve(process.argv[3]) : SORTIE_PAR_DEFAUT;
  const resultat = extraireBase(readFileSync(source, 'utf8'));
  const { lignes, version, comptes, illisibles, comptesPortions } = resultat;
  if (!version) console.warn('Avertissement : version de la base introuvable (VERSION_BASE = null).');
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, genererFichier(resultat, source.split('/').pop()), 'utf8');
  for (const { etape } of TABLES) {
    console.log(`${etape} : ${comptes[etape].lues} ligne(s) lue(s), ${comptes[etape].ignorees} ignorée(s)`);
  }
  console.log(comptesPortions.presente
    ? `repères de portion (11.4) : ${comptesPortions.lues} ligne(s) lue(s), ${comptesPortions.ignorees} ignorée(s)`
    : 'repères de portion : section 11.4 absente (facultative), PORTIONS_BASE vide');
  console.log(`Total : ${lignes.length} ligne(s) écrites dans ${sortie} (base version ${version ?? '?'})`);
  if (illisibles.length > 0) {
    console.warn(`Avertissement : ${illisibles.length} ligne(s) illisible(s) ignorée(s), rien n'a été deviné :`);
    for (const { section, ligne } of illisibles) console.warn(`  [${section}] ${ligne}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) principal();
