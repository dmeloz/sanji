// Lignes parasites apprises : des lignes d'une feuille de menus que la propriétaire a écartées (« Pas un plat »), pour toutes les semaines.
// `etat.lignes_ignorees` = { [ligne normalisée]: { ligne: libellé tel que lu, h } }. Aucun chiffre. Rien n'est écarté sans son geste,
// et une ligne écartée reste visible à l'import avec « Remettre ».

import { normaliser } from './etat.js';

export const LIGNE_MAX = 120;
/** Nombre maximal de lignes gardées (la plus ancienne est évincée ; à l'import, les plus récentes sont gardées). */
export const LIGNES_MAX = 200;
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

/** Clé d'une ligne (normalisée) ; chaîne vide si elle est vide, trop longue ou dangereuse. */
export function cleLigne(texte) {
  const cle = normaliser(texte);
  return cle === '' || cle.length > LIGNE_MAX || CLES_INTERDITES.has(cle) ? '' : cle;
}

const horodatage = (h) => (typeof h === 'string' && !Number.isNaN(Date.parse(h)) ? h : null);

/** Garde les `LIGNES_MAX` entrées les plus récentes (sans date = les plus anciennes). */
export function plafonnerLignes(lignes) {
  const triees = Object.entries(lignes).sort(([, a], [, b]) => (Date.parse(b.h) || 0) - (Date.parse(a.h) || 0));
  return Object.fromEntries(triees.slice(0, LIGNES_MAX));
}

/** Entrées valides d'un objet importé (clé canonique, libellé texte court), copiées sans autre champ, au plus LIGNES_MAX. */
export function lignesIgnoreesValides(brut) {
  const sortie = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return sortie;
  for (const [cle, e] of Object.entries(brut)) {
    if (cle === '' || cleLigne(cle) !== cle || !e || typeof e !== 'object') continue;
    const libelle = typeof e.ligne === 'string' && e.ligne.trim() !== '' && e.ligne.length <= LIGNE_MAX ? e.ligne.trim() : cle;
    sortie[cle] = { ligne: libelle, h: horodatage(e.h) };
  }
  return plafonnerLignes(sortie);
}
