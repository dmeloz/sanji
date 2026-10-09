// Mots retenus : ce que la propriétaire a appris à Sanji sur un MOT (forme de pâtes, sauce, produit, garniture), pour tous les
// plats et toutes les semaines. Aucun chiffre. `etat.mots` = { [mot normalisé]: { categorie, h } } ; un mot ne vaut que pour lui-même.

import { normaliser } from './etat.js';

/** Les quatre classements possibles d'un mot, avec leur libellé. */
export const CATEGORIES_MOT = Object.freeze({
  forme_pates: 'Forme de pâtes', sauce: 'Sauce', produit: 'Produit', garniture: 'Garniture',
});

export const MOT_MAX = 40;
/** Nombre maximal de mots gardés à l'import (le surplus est écarté). */
export const MOTS_MAX = 500;

// Mots de liaison retirés au début d'un nom pour retrouver le mot lui-même (« à la nduja » → « nduja »).
const LIAISONS = new Set(['a', 'la', 'le', 'les', 'l', 'un', 'une', 'du', 'des', 'de', 'd', 'au', 'aux', 'al', 'alla', 'alle', 'allo', 'all',
  'ai', 'agli', 'con', 'avec', 'et', 'di']);

/**
 * Mot normalisé d'un nom : sans accent, en minuscules, sans article ni préposition au début, apostrophes de liaison
 * retirées (« N'Duja » → « nduja »). Chaîne vide si rien ne reste ou si le résultat dépasse MOT_MAX.
 */
export function motDe(texte) {
  const brut = normaliser(texte).replace(/\b(d|l|all|dell|nell|dall|sull)'/g, '$1 ').replace(/'/g, '').replace(/[^a-z0-9& -]/g, ' ');
  const mots = brut.split(/\s+/).filter(Boolean);
  while (mots.length > 1 && LIAISONS.has(mots[0])) mots.shift();
  const mot = mots.length === 1 && LIAISONS.has(mots[0]) ? '' : mots.join(' ');
  return mot.length > MOT_MAX ? '' : mot;
}

/** Vrai pour un classement autorisé (un nom hérité d'Object.prototype ne l'est jamais). */
export const categorieMotValide = (c) => typeof c === 'string' && Object.hasOwn(CATEGORIES_MOT, c);

/** Expressions que `lirePlat` consulte avant son vocabulaire : { mots, categorie, kind, appris:true }. */
export function expressionsApprises(mots) {
  if (!mots || typeof mots !== 'object') return [];
  return Object.entries(mots)
    .filter(([mot, e]) => mot !== '' && categorieMotValide(e?.categorie))
    .map(([mot, e]) => ({
      mots: mot.split(' '), appris: true, lexique: false,
      categorie: { forme_pates: 'feculent', sauce: 'sauce', produit: 'autre', garniture: 'autre' }[e.categorie],
      kind: { forme_pates: 'pate', sauce: 'sauce', produit: null, garniture: 'garniture' }[e.categorie],
    }))
    .sort((a, b) => b.mots.length - a.mots.length);
}

/** Champs d'un composant classé par la propriétaire, selon le menu (menu 1 = au poste ; menu 2 : le féculent seul). */
export function champsPourMot(categorie, menu) {
  const poste = menu === 1;
  switch (categorie) {
    case 'forme_pates': return { categorie: 'feculent', attribue: true };
    case 'sauce': return { categorie: 'sauce', role: 'sauce', attribue: poste };
    case 'garniture': return { categorie: 'autre', role: 'garniture', attribue: poste };
    case 'produit': return { categorie: 'autre', attribue: poste };
    default: throw new Error(`Classement de mot inconnu : « ${categorie} ».`);
  }
}

/** Entrées valides d'un objet de mots importé (clé canonique, classement autorisé), copiées sans autre champ. */
export function motsValides(brut) {
  const sortie = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return sortie;
  for (const [mot, e] of Object.entries(brut)) {
    if (Object.keys(sortie).length >= MOTS_MAX) break;
    if (mot === '' || motDe(mot) !== mot || !categorieMotValide(e?.categorie)) continue;
    sortie[mot] = { categorie: e.categorie, h: typeof e.h === 'string' && !Number.isNaN(Date.parse(e.h)) ? e.h : null };
  }
  return sortie;
}
