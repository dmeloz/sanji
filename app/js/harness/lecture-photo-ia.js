// Lecture de la photo de la feuille de menus par l'IA (décision du 2026-10-07) : comment lire sa réponse. L'IA ne rend
// que des lignes de texte ; le découpage, les dates et la lecture restent aux règles de Sanji. Module pur : ni DOM ni réseau.

export const LIGNES_MAX = 80;
export const LIGNE_LONGUEUR_MAX = 160;
export const ILLISIBLES_MAX = 50;
const SEUL_ILLISIBLE = /^(\[?\s*illisible\s*\]?|\?+)$/i;
const ILLISIBLE_EN_LIGNE = /\[\s*illisible\s*\]/gi;

const nettoyerLigne = (brut) => brut.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIGNE_LONGUEUR_MAX);

/**
 * Nouveau format { entete, jours:[{jour, plats, illisibles?}], illisibles } : aplati en lignes « jour » puis ses plats
 * (l'en-tête est ignoré). Ancien format { lignes } : tel quel. Autre chose : null.
 */
function aplatir(reponse) {
  if (!Array.isArray(reponse.jours)) return reponse;
  const jours = reponse.jours;
  const valide = jours.every((j) => j && typeof j.jour === 'string' && Array.isArray(j.plats) && j.plats.every((p) => typeof p === 'string')
    && (j.illisibles === undefined || (Number.isInteger(j.illisibles) && j.illisibles >= 0)));
  if (!valide || (reponse.entete !== undefined && !Array.isArray(reponse.entete))) return null;
  const parJour = jours.reduce((somme, j) => somme + (j.illisibles ?? 0), 0);
  return { lignes: jours.flatMap((j) => [j.jour, ...j.plats]), illisibles: (reponse.illisibles ?? 0) + parJour };
}

/** @returns {{lignes:string[], illisibles:number}|null} réponse invalide ou trop longue : null */
export function lireLignesFeuille(brute) {
  const reponse = brute && typeof brute === 'object' ? aplatir(brute) : null;
  if (!reponse || !Array.isArray(reponse.lignes)) return null;
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
