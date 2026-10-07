// Lecture de la photo de la feuille de menus par l'IA (décision du 2026-10-07) : comment lire sa réponse. L'IA ne rend
// que des lignes de texte ; le découpage, les dates et la lecture restent aux règles de Sanji. Module pur : ni DOM ni réseau.

export const LIGNES_MAX = 80;
export const LIGNE_LONGUEUR_MAX = 160;
export const ILLISIBLES_MAX = 50;
const SEUL_ILLISIBLE = /^(\[?\s*illisible\s*\]?|\?+)$/i;
const ILLISIBLE_EN_LIGNE = /\[\s*illisible\s*\]/gi;

const nettoyerLigne = (brut) => brut.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIGNE_LONGUEUR_MAX);

/** @returns {{lignes:string[], illisibles:number}|null} réponse invalide ou trop longue : null */
export function lireLignesFeuille(reponse) {
  if (!reponse || typeof reponse !== 'object' || !Array.isArray(reponse.lignes)) return null;
  if (reponse.lignes.length > LIGNES_MAX || reponse.lignes.some((l) => typeof l !== 'string')) return null;
  const fourni = reponse.illisibles ?? 0;
  if (!Number.isInteger(fourni) || fourni < 0) return null;
  const nettoyees = reponse.lignes.map(nettoyerLigne).filter((l) => l !== '');
  const entieres = nettoyees.filter((l) => !SEUL_ILLISIBLE.test(l));
  if (entieres.length === 0 && nettoyees.length === 0) return null;
  // Un « [illisible] » au milieu d'une ligne est retiré du texte (la lettre ou le mot manque) et compté : la propriétaire complète à la main.
  let enLigne = 0;
  const lignes = entieres.map((l) => l.replace(ILLISIBLE_EN_LIGNE, () => { enLigne += 1; return ''; }).replace(/\s+/g, ' ').trim()).filter((l) => l !== '');
  return { lignes, illisibles: Math.min(ILLISIBLES_MAX, fourni + nettoyees.length - entieres.length + enLigne) };
}
