// Remise à neuf : l'application repart comme à la première utilisation. Aucun DOM ; tout est injectable pour les tests.
// Ordre : copie de sécurité (échec = rien n'est effacé) → copies automatiques (`avant-restauration` reste), photos, notes locales → état remplacé en dernier.
// Jamais touchés ici : la clé de l'assistant IA et les réglages de l'appareil.

import { etatInitial, exporter, importer } from './domaine/etat.js';
import { CLE_AVANT_REMISE_A_NEUF, CLE_AVANT_REMISE_PRECEDENTE, MAGASIN_REEL, PREFIXE_COPIE, listerCopies } from './sauvegarde-auto.js';
import { viderPhotos as viderPhotosReelles } from './stockage.js';

export const MESSAGE_SANS_COPIE = "Impossible de garder une copie de sécurité : rien n'a été effacé.";

/** Les données métier saisies ; les réglages de l'appareil, le journal et le dernier export ne comptent pas. */
const CHAMPS_METIER = ['jours', 'fiches', 'composants', 'productions', 'regles', 'recettes', 'fournisseurs', 'memoire', 'mots',
  'lignes_ignorees', 'noms', 'fiches_retenues', 'standards', 'ajustements', 'produits', 'articlesCoches', 'lectures', 'validations'];

/** Un état sans aucune donnée métier saisie. */
export function estVide(etat) {
  return CHAMPS_METIER.every((c) => Object.keys(etat?.[c] ?? {}).length === 0);
}

const ILLISIBLE = Symbol('illisible');
async function lireSansEchec(magasin, cle) {
  try { return await magasin.lire(cle); } catch { return ILLISIBLE; }
}

/** Une copie qui ne s'importe pas compte comme non vide : on la garde par prudence. */
function copieVide(texte, aujourd) {
  try { return estVide(importer(texte, aujourd)); } catch { return false; }
}

async function ecrireEtRelire(magasin, cle, texte) {
  await magasin.ecrire(cle, texte);
  if (await magasin.lire(cle) !== texte) throw new Error('copie non relue');
}

/**
 * Garde le texte exporté sous « avant-remise-a-neuf » et le relit (et `importer` doit l'accepter).
 * Deux générations : la copie non vide déjà là passe sous « …-precedente » avant d'être remplacée.
 * Un état vide n'écrit rien (copie existante, ou illisible : jamais remplacée).
 */
async function garderCopie(etat, maintenant, magasin) {
  const existante = await lireSansEchec(magasin, CLE_AVANT_REMISE_A_NEUF);
  if (estVide(etat) && (existante === ILLISIBLE || typeof existante === 'string')) return false;
  const horodatage = maintenant();
  const texte = exporter(etat, horodatage);
  try {
    importer(texte, horodatage.slice(0, 10)); // le texte relu à l'identique doit aussi être réimportable
    if (typeof existante === 'string' && !copieVide(existante, horodatage.slice(0, 10))) {
      await ecrireEtRelire(magasin, CLE_AVANT_REMISE_PRECEDENTE, existante);
    }
    await ecrireEtRelire(magasin, CLE_AVANT_REMISE_A_NEUF, texte);
  } catch {
    throw new Error(MESSAGE_SANS_COPIE);
  }
  return true;
}

/**
 * @param {object} o
 * @param {()=>object} o.etat état courant
 * @param {()=>string} o.maintenant
 * @param {(etat:object, detail:string, action?:string)=>void} o.remplacer
 * @param {{nom:string, effacer:()=>any}[]} [o.effacements] notes, retours, journal… (chacun peut échouer sans tout bloquer)
 * @returns {Promise<{copieGardee:boolean, avertissements:string[]}>}
 */
export async function repartirANeuf({ etat, maintenant, remplacer, effacements = [], magasin = MAGASIN_REEL, viderPhotos = viderPhotosReelles }) {
  const copieGardee = await garderCopie(etat(), maintenant, magasin);
  const avertissements = [];
  const essayer = async (nom, fonction) => {
    try { await fonction(); } catch { avertissements.push(`${nom} n'ont pas pu être effacé(e)s`); }
  };
  await essayer('les copies automatiques', async () => {
    for (const date of await listerCopies(magasin)) await magasin.supprimer(`${PREFIXE_COPIE}${date}`);
  });
  await essayer('les photos de menus', viderPhotos);
  for (const { nom, effacer } of effacements) await essayer(nom, effacer);
  remplacer(etatInitial(), 'remise à neuf', 'remiseANeuf');
  return { copieGardee, avertissements };
}
