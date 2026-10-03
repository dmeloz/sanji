// Recherche dans la base métier embarquée (estimations génériques, jamais appliquées d'office).

import { BASE_METIER } from '../donnees/base-metier.js';
import { normaliser } from './etat.js';

/**
 * Lignes de la base dont le produit contient le texte normalisé (minuscules, sans accents).
 * Sert à PROPOSER une valeur à l'utilisateur : la fonction ne remplit rien.
 * @param {string} texte
 * @param {'parage'|'cuisson'|'portionnement'} [etape] filtre facultatif
 * @returns {object[]} lignes { etape, categorie, produit, texte, coefMin, coefMax, note }
 */
export function chercherBase(texte, etape) {
  const recherche = normaliser(texte);
  if (recherche === '') return [];
  return BASE_METIER.filter((l) => (!etape || l.etape === etape) && normaliser(l.produit).includes(recherche));
}
