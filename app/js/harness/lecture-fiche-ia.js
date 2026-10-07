// Lecture d'une fiche de fonction par l'IA, mode essai (décision du 2026-10-07) : comment lire sa réponse. L'IA ne rend que
// des propositions de texte ; jamais le choix du menu, la répartition ni le mode. Module pur : ni DOM ni réseau.

import { estDateValide } from '../domaine/dates.js';

export const TEXTE_MAX = 500;
export const COUVERTS_MAX = 500;
export const ILLISIBLES_MAX = 50;
const CHAMPS_TEXTE = ['numero', 'horaire', 'allergies', 'remarques'];

const nettoyer = (brut) => brut.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/ +/g, ' ').trim().slice(0, TEXTE_MAX);
const entierDans = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

/** @returns {{champs:object, illisibles:number, ecartes:string[]}|null} aucun champ valide : null */
export function lireChampsFiche(reponse) {
  if (!reponse || typeof reponse !== 'object' || Array.isArray(reponse)) return null;
  const champs = {};
  const ecartes = [];
  for (const cle of CHAMPS_TEXTE) {
    if (reponse[cle] === undefined) continue;
    const texte = typeof reponse[cle] === 'string' ? nettoyer(reponse[cle]) : '';
    if (texte === '') ecartes.push(cle); else champs[cle] = texte;
  }
  const verifies = {
    date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && estDateValide(v),
    service: (v) => v === 'midi' || v === 'soir',
    couverts: (v) => entierDans(v, COUVERTS_MAX),
  };
  for (const [cle, valide] of Object.entries(verifies)) {
    if (reponse[cle] === undefined) continue;
    if (valide(reponse[cle])) champs[cle] = reponse[cle]; else ecartes.push(cle);
  }
  if (reponse.illisibles !== undefined && !entierDans(reponse.illisibles, ILLISIBLES_MAX)) ecartes.push('illisibles');
  if (Object.keys(champs).length === 0) return null;
  // Un champ refusé est un doute de plus pour la relecture, au même titre qu'un passage illisible.
  const illisibles = Math.min(ILLISIBLES_MAX, (entierDans(reponse.illisibles, ILLISIBLES_MAX) ? reponse.illisibles : 0)
    + ecartes.filter((c) => c !== 'illisibles').length);
  return { champs, illisibles, ecartes };
}
