// Copie de sécurité automatique : au plus une copie par jour de l'état exporté (texte de `exporter`, sans photos),
// les 7 plus récentes gardées dans le magasin « etat » sous des clés « copie|AAAA-MM-JJ ». Aucun DOM ; le magasin
// est injectable pour les tests. Une copie ne doit jamais bloquer ni faire échouer l'enregistrement de l'état courant.

import { ecrireCle, listerCles, lireCle, supprimerCle } from './stockage.js';

export const CLE_ETAT_COURANT = 'principal';
export const PREFIXE_COPIE = 'copie|';
export const COPIES_CONSERVEES = 7;
export const CLE_AVANT_RESTAURATION = 'avant-restauration';

const MAGASIN_REEL = { lister: listerCles, lire: lireCle, ecrire: ecrireCle, supprimer: supprimerCle };
const MOTIF_CLE = /^copie\|\d{4}-\d{2}-\d{2}$/;

/** Dates des copies présentes, les plus récentes d'abord. Seules les clés « copie|date » comptent. */
export async function listerCopies(magasin = MAGASIN_REEL) {
  return (await magasin.lister()).filter((c) => MOTIF_CLE.test(c)).map((c) => c.slice(PREFIXE_COPIE.length)).sort().reverse();
}

/** Texte de la copie d'un jour (à passer à `importer`). Lève une Error claire si elle n'existe pas. */
export async function lireCopie(date, magasin = MAGASIN_REEL) {
  const texte = await magasin.lire(`${PREFIXE_COPIE}${date}`);
  if (typeof texte !== 'string') throw new Error(`Copie du ${date} introuvable.`);
  return texte;
}

/**
 * Écrit la copie du jour si elle n'existe pas, puis retire les plus anciennes au-delà de 7.
 * Renvoie true si une copie a été écrite ; jamais d'exception (échec d'écriture, quota : ignoré).
 */
export async function copieDuJour(texteExport, date, magasin = MAGASIN_REEL) {
  try {
    if ((await listerCopies(magasin)).includes(date)) return false;
    await magasin.ecrire(`${PREFIXE_COPIE}${date}`, texteExport);
    for (const ancienne of (await listerCopies(magasin)).slice(COPIES_CONSERVEES)) await magasin.supprimer(`${PREFIXE_COPIE}${ancienne}`);
    return true;
  } catch {
    return false;
  }
}

/** Garde le texte exporté de l'état courant sous l'unique clé « avant-restauration » (remplacée à chaque restauration). Lève si l'écriture échoue. */
export async function garderAvantRestauration(texteExport, magasin = MAGASIN_REEL) {
  try {
    await magasin.ecrire(CLE_AVANT_RESTAURATION, texteExport);
  } catch {
    throw new Error("Impossible de garder l'état actuel, restauration annulée.");
  }
}

/** Texte de l'état gardé avant la dernière restauration, ou null s'il n'y en a pas (ou si la lecture échoue). */
export async function lireAvantRestauration(magasin = MAGASIN_REEL) {
  try {
    const texte = await magasin.lire(CLE_AVANT_RESTAURATION);
    return typeof texte === 'string' ? texte : null;
  } catch {
    return null;
  }
}
