// Liste de mise en place (écran Production) : quantité lisible en g / kg, verbe de la ligne, portion à saisir.
// Pur : ni DOM ni horloge. Aucune règle de calcul ici (elles restent dans calcul.js) ; seulement la lecture.

import { formaterQuantite, portionsMenu } from './calcul.js';
import { grammageEffectif } from './savoir.js';

const GRAMMES_PAR_KILO = 1000;
const DIXIEMES_DE_KILO = 100;

/**
 * Quantité à lire sur la ligne : « 850 g », « 1,2 kg » (une décimale, virgule française). Une autre unité (ml, pièces,
 * portions) garde son formatage habituel ; une valeur inconnue donne null (jamais un « 0 » inventé).
 * @param {number|null} valeur
 * @param {string|null} unite
 * @returns {string|null}
 */
export function quantiteEnPoids(valeur, unite) {
  if (!Number.isFinite(valeur)) return null;
  if (unite !== 'g') return formaterQuantite(valeur, unite);
  const grammes = Math.round(valeur);
  if (grammes < GRAMMES_PAR_KILO) return `${grammes} g`;
  const kilos = Math.round(grammes / DIXIEMES_DE_KILO) / 10;
  return `${String(kilos).replace('.', ',')} kg`;
}

const sansAccent = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Familles de féculents qui se cuisent à l'eau ou à la vapeur (pâtes, riz, quinoa, légumineuses, pommes de terre…). */
const CATEGORIE_CUIRE = 'feculent';
/** Mots du nom qui disent déjà l'action (« courgette sautée ») : aucun verbe n'est ajouté devant. */
const NOM_DIT_L_ACTION = /\b(saut|brais|roti|gratin|poel|grill|frit|vapeur|bouilli|poche|mijot)/;

/**
 * Verbe de la ligne (« Cuire ») d'après le composant, ou null : alors la ligne n'affiche que le nom du produit.
 * Table minimale : un féculent de base (pâtes, riz, quinoa, légumineuses, pommes de terre) se cuit ; tout le reste reste
 * sans verbe plutôt qu'un verbe inventé.
 */
export function verbeDe(composant) {
  if (!composant || composant.type === 'preparation_maison' || composant.type === 'a_preciser') return null;
  if (NOM_DIT_L_ACTION.test(sansAccent(composant.nom))) return null;
  if (composant.categorie === CATEGORIE_CUIRE && composant.famille) return 'Cuire';
  return null;
}

/**
 * Vrai quand seule la portion manque pour chiffrer la ligne : le plat est de type connu, a des prévisions, mais aucune
 * portion (plat, référence, standard maison, standard de base). L'herbe et la sauce à confirmer n'ont pas de portion.
 */
export function aSaisirPortion(etat, composantId) {
  const c = etat.composants?.[composantId];
  if (!c || c.type === 'a_preciser' || c.role === 'herbe') return false;
  if (c.role === 'sauce' && /à confirmer\s*$/i.test(String(c.nom ?? ''))) return false;
  const portions = portionsMenu(etat, c.date, c.menu);
  if (portions.previsionManquante && portions.total === 0) return false;
  return grammageEffectif(etat, c) === null;
}
