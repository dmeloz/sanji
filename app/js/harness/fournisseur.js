// Adaptateur de modèle : une interface minimale, indépendante de tout fournisseur. Ce module ne contient aucun appel
// réseau (règle du projet : aucun envoi hors de l'appareil). Un futur fournisseur est injecté par l'appelant ;
// choisir un fournisseur externe est une décision de la propriétaire, jamais du code.
//
// Interface `Fournisseur` :
//   nom: string
//   disponible(): boolean                      — faux = le harness travaille seul, sans erreur
//   demander(requete, { signal }): Promise<reponse>
// `requete` : { contexte, outils: [{nom, objectif, entrees}], historique: [{outil, entrees, resultat|erreur}] }
// `reponse` : { type:'appel_outil', outil, entrees } ou { type:'brouillon', brouillon }
// Toute réponse est non fiable : elle est validée avant usage.

import { CODES, ErreurHarness } from './contrats.js';

export const DELAI_PAR_DEFAUT_MS = 8000;

/** Fournisseur par défaut : jamais disponible. Le cœur métier fonctionne sans modèle. */
export const fournisseurDesactive = Object.freeze({
  nom: 'desactive',
  disponible: () => false,
  async demander() { throw new ErreurHarness(CODES.MODELE_INDISPONIBLE, "Aucun modèle IA n'est activé."); },
});

/** Champs admis par type de réponse. */
const CHAMPS_REPONSE = { appel_outil: ['type', 'outil', 'entrees'], brouillon: ['type', 'brouillon'] };

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Vrai si `fournisseur` respecte l'interface (sinon il est traité comme indisponible). */
export function estFournisseurValide(fournisseur) {
  return Boolean(fournisseur) && typeof fournisseur.nom === 'string'
    && typeof fournisseur.disponible === 'function' && typeof fournisseur.demander === 'function';
}

/** Vrai seulement si le fournisseur est valide ET se déclare disponible ; une exception de `disponible()` vaut « non ». */
export function estUtilisable(fournisseur) {
  if (!estFournisseurValide(fournisseur)) return false;
  try {
    return fournisseur.disponible() === true;
  } catch {
    return false;
  }
}

/**
 * Valide la forme d'une réponse brute : renvoie la réponse ou lève `PROPOSITION_INVALIDE`.
 * Le contenu de `entrees` et de `brouillon` est contrôlé plus loin (schéma de l'outil, validateur).
 */
export function verifierReponse(reponse) {
  const invalide = (texte) => new ErreurHarness(CODES.PROPOSITION_INVALIDE, `Réponse du modèle invalide : ${texte}`);
  if (!estObjet(reponse) || typeof reponse.type !== 'string' || !Object.hasOwn(CHAMPS_REPONSE, reponse.type)) throw invalide('type inconnu.');
  const admis = CHAMPS_REPONSE[reponse.type];
  const inconnus = Object.keys(reponse).filter((cle) => !admis.includes(cle));
  if (inconnus.length) throw invalide(`champ inconnu « ${inconnus[0]} ».`);
  if (reponse.type === 'appel_outil' && (typeof reponse.outil !== 'string' || !estObjet(reponse.entrees))) {
    throw invalide('outil (texte) et entrees (objet) attendus.');
  }
  if (reponse.type === 'brouillon' && !estObjet(reponse.brouillon)) throw invalide('brouillon (objet) attendu.');
  return reponse;
}

/**
 * Interroge le fournisseur avec délai et annulation. Ne lève que des `ErreurHarness` :
 * modèle indisponible, délai dépassé, annulation ou réponse invalide.
 */
export async function interroger(fournisseur, requete, { delaiMs, signal = null } = {}) {
  if (!estUtilisable(fournisseur)) {
    throw new ErreurHarness(CODES.MODELE_INDISPONIBLE, 'Modèle indisponible : calcul sans IA.');
  }
  const delai = Number.isFinite(delaiMs) && delaiMs > 0 ? delaiMs : DELAI_PAR_DEFAUT_MS;
  if (signal?.aborted) throw new ErreurHarness(CODES.ANNULE, 'Demande annulée.');
  const controleur = new AbortController();
  let minuteur = null;
  let auAbandon = null;
  const interruption = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => {
      controleur.abort();
      rejeter(new ErreurHarness(CODES.DELAI_DEPASSE, 'Le modèle a mis trop de temps à répondre.'));
    }, delai);
    auAbandon = () => { controleur.abort(); rejeter(new ErreurHarness(CODES.ANNULE, 'Demande annulée.')); };
    signal?.addEventListener('abort', auAbandon, { once: true });
  });
  try {
    const reponse = await Promise.race([
      Promise.resolve().then(() => fournisseur.demander(structuredClone(requete), { signal: controleur.signal })),
      interruption,
    ]);
    // Copie profonde avant tout usage : une référence gardée par le fournisseur ne peut plus muter un brouillon contrôlé.
    return verifierReponse(structuredClone(reponse));
  } catch (erreur) {
    if (erreur instanceof ErreurHarness) throw erreur;
    throw new ErreurHarness(CODES.MODELE_INDISPONIBLE, `Le modèle a échoué : ${erreur?.message ?? 'erreur inconnue'}`);
  } finally {
    clearTimeout(minuteur);
    signal?.removeEventListener('abort', auAbandon);
  }
}
