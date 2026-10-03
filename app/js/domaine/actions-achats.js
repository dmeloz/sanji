// Liste « à commander » à trois états : suggéré (calculé), noté par la propriétaire, retiré.
// Garde-fou : une ligne qui repose sur une estimation ne se note qu'avec une quantité tapée par le chef.
// `quantiteAcheter` n'est jamais remplie automatiquement ; une ligne retirée reste dans l'historique et se remet.

import { terminer } from './actions.js';
import { estDateValide, jourSemaine } from './dates.js';
import { suiviProduitVide } from './etat.js';
import { besoinsProduits, cleSuivi } from './produits.js';

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

/** Ligne de besoin de la semaine, ou Error ; le suivi de la ligne est créé s'il n'existe pas. */
function ligneEtSuivi(etat, lundi, cle, unite) {
  if (!estDateValide(lundi) || jourSemaine(lundi) !== 1) throw new Error(`« ${lundi} » n'est pas un lundi.`);
  const ligne = besoinsProduits(etat, lundi).lignes.find((l) => l.cle === cle && l.unite === unite);
  if (!ligne) throw new Error(`Ce produit n'a pas de besoin cette semaine : ${cle} (${unite}).`);
  const k = cleSuivi(lundi, cle, unite);
  if (!Object.hasOwn(etat.produits, k)) etat.produits[k] = suiviProduitVide();
  const suivi = etat.produits[k];
  if (!Array.isArray(suivi.historique)) suivi.historique = [];
  if (!suivi.etatLigne) suivi.etatLigne = 'suggere';
  return { ligne, suivi };
}

/**
 * Note la ligne « à commander ». `saisie.quantite` : la quantité tapée par le chef (nombre positif). Elle est
 * OBLIGATOIRE quand le besoin repose sur une estimation non validée ; sinon elle est facultative. Une quantité tapée
 * devient la quantité à acheter ; sans quantité, rien n'est rempli. Le besoin du moment est mémorisé (`besoinAuNote`).
 */
export function noterAchat(etat, lundi, cle, unite, saisie, h) {
  verifierH(h);
  const { ligne, suivi } = ligneEtSuivi(etat, lundi, cle, unite);
  const quantite = saisie?.quantite;
  const tapee = quantite !== undefined && quantite !== null;
  const valide = typeof quantite === 'number' && Number.isFinite(quantite) && quantite > 0;
  if (ligne.aValider && !valide) {
    throw new Error("Ce besoin repose sur une estimation : saisissez vous-même la quantité à commander (nombre positif), l'application ne la remplit pas.");
  }
  if (tapee && !valide) throw new Error('La quantité à commander doit être un nombre strictement positif.');
  if (tapee) suivi.quantiteAcheter = quantite;
  suivi.etatLigne = 'note';
  suivi.besoinAuNote = ligne.besoinBrut;
  suivi.historique.push({ h, action: 'note', besoin: ligne.besoinBrut, quantite: tapee ? quantite : null });
  return terminer(etat, h, 'noterAchat', `${cle}${tapee ? ` : ${quantite} ${unite}` : ''}`, suivi);
}

/** Retire la ligne de la liste : rien n'est effacé, la ligne reste dans l'historique et peut être remise. */
export function retirerAchat(etat, lundi, cle, unite, h) {
  verifierH(h);
  const { ligne, suivi } = ligneEtSuivi(etat, lundi, cle, unite);
  if (suivi.etatLigne === 'retire') throw new Error('Cette ligne est déjà retirée.');
  suivi.historique.push({ h, action: 'retire', depuis: suivi.etatLigne, besoin: ligne.besoinBrut });
  suivi.etatLigne = 'retire';
  return terminer(etat, h, 'retirerAchat', cle, suivi);
}

/** Remet une ligne retirée dans l'état où elle était avant (suggérée ou notée). */
export function restaurerAchat(etat, lundi, cle, unite, h) {
  verifierH(h);
  const { ligne, suivi } = ligneEtSuivi(etat, lundi, cle, unite);
  if (suivi.etatLigne !== 'retire') throw new Error("Cette ligne n'est pas retirée : rien à remettre.");
  const dernier = [...suivi.historique].reverse().find((x) => x.action === 'retire');
  const avant = dernier?.depuis === 'note' ? 'note' : 'suggere';
  suivi.etatLigne = avant;
  suivi.historique.push({ h, action: 'restaure', vers: avant, besoin: ligne.besoinBrut });
  return terminer(etat, h, 'restaurerAchat', cle, suivi);
}
