// Liste de mise en place (écran Production) : quantité lisible en g / kg, verbe de la ligne, portion à saisir.
// Pur : ni DOM ni horloge. Aucune règle de calcul ici (elles restent dans calcul.js) ; seulement la lecture.

import { calculerComposant, formaterQuantite, portionsMenu } from './calcul.js';
import { libelleJour } from './dates.js';
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

/**
 * Pourquoi une ligne de la liste n'est pas chiffrée, ou null quand elle l'est (cible en poids, ou ligne faite / préparatoire).
 * - 'couverts' : aucune prévision pour ce jour et ce menu (`date` dit lequel) ;
 * - 'portion' : seule la portion manque (`aSaisirPortion`) ;
 * - 'autre' : sauce à confirmer, herbe, plat à préciser, composition à définir, famille inconnue : se règle depuis la fiche.
 * La phrase `texte` est dite telle quelle dans la feuille de la ligne.
 * @param {object} etat
 * @param {{composantId:string, genre?:string, cible?:number|null, unite?:string|null, nom?:string, libelle?:string}} ligne
 * @returns {{type:'couverts'|'portion'|'autre', texte:string, date?:string}|null}
 */
export function raisonNonChiffree(etat, ligne) {
  const c = etat.composants?.[ligne.composantId];
  if (!c || ligne.genre === 'preparatoire') return null;
  if (Number.isFinite(ligne.cible) && ligne.unite !== 'portion') return null;
  const nom = c.nom;
  if (c.role === 'herbe') return { type: 'autre', texte: `${nom} se compte à la botte ou à la pièce : la quantité se règle dans la fiche.` };
  if (c.role === 'sauce' && /à confirmer\s*$/i.test(String(nom ?? ''))) return { type: 'autre', texte: 'la sauce est à confirmer : le choix se fait dans la fiche.' };
  if (c.type === 'a_preciser') return { type: 'autre', texte: `${nom} est encore à préciser : la fiche dit ce qu'il faut.` };
  const portions = portionsMenu(etat, c.date, c.menu);
  if (portions.previsionManquante && portions.total === 0) {
    return { type: 'couverts', date: c.date, texte: `il manque les couverts du ${libelleJour(c.date)} (menu ${c.menu}).` };
  }
  if (aSaisirPortion(etat, ligne.composantId)) return { type: 'portion', texte: `il manque la portion de ${nom}.` };
  const manquants = calculerComposant(etat, ligne.composantId).manquants;
  return { type: 'autre', texte: manquants.length > 0 ? `il manque : ${manquants.join(', ')} (voir la fiche).` : `${nom} : composition à définir dans la fiche.` };
}
