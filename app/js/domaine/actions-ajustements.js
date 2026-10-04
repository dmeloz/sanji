// Actions sur les ajustements de la propriétaire (voir ajustements.js). Chaque action journalise en clair.

import { terminer } from './actions.js';
import { USAGES_AJUSTABLES, ajustementDe, cleAjustement, controleAjustement, limiteHygiene } from './ajustements.js';

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

function verifierSujet(sujet, usage) {
  if (!USAGES_AJUSTABLES.includes(usage)) throw new Error(`Cet usage ne se règle pas ici : « ${usage} ».`);
  if (typeof sujet !== 'string' || sujet === '') throw new Error('Sujet manquant.');
}

const texteValeur = (v, unite) => `${String(v).replace('.', ',')} ${unite}`;

/**
 * La propriétaire change la valeur d'un standard de base : elle passe devant pour toujours. Refus si la valeur n'est pas
 * un nombre, si le sujet n'a pas de standard de base, ou si un rendement est hors de ce qui se calcule (perte de 0 à
 * moins de 100 %, gain strictement positif). Hygiène (conservation, température) : au-delà de la borne prudente du
 * standard de base, l'action réussit et renvoie un avertissement.
 * @returns {{ajustement:object, avertissement:string|null}}
 */
export function ajusterStandard(etat, sujet, usage, valeur, h) {
  verifierH(h);
  const { base, erreur } = controleAjustement(usage, sujet, valeur);
  if (erreur) throw new Error(erreur);
  if (!etat.ajustements || typeof etat.ajustements !== 'object') etat.ajustements = {};
  const cle = cleAjustement(usage, sujet);
  const existant = ajustementDe(etat, sujet, usage);
  const ajustement = {
    valeur, unite: base.unite, le: h,
    avant: existant?.avant ?? { valeur: base.valeur, origine: base.origine },
  };
  etat.ajustements[cle] = ajustement;
  const avertissement = limiteHygiene(base, valeur, sujet);
  const detail = `${cle} : ${texteValeur(base.valeur, base.unite)} (standard de base) → ${texteValeur(valeur, base.unite)} (votre valeur)`
    + (avertissement ? ' ; au-delà de la limite de référence' : '');
  return terminer(etat, h, 'ajusterStandard', detail, { ajustement, avertissement });
}

/** Supprime l'ajustement : la valeur de base revient. Renvoie false (sans journal) s'il n'y en avait pas. */
export function revenirAuStandard(etat, sujet, usage, h) {
  verifierH(h);
  verifierSujet(sujet, usage);
  if (!ajustementDe(etat, sujet, usage)) return false;
  const cle = cleAjustement(usage, sujet);
  delete etat.ajustements[cle];
  return terminer(etat, h, 'revenirAuStandard', `${cle} : retour au standard de base`, true);
}
