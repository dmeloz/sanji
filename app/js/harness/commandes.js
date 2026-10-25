// Commandes contrôlées : la seule porte par laquelle une proposition validée devient un changement d'état.
// Tout passe par l'exécuteur injecté (en production : `agir` de magasin.js), donc par une copie d'état, une écriture
// atomique et un redessin. L'application est tout ou rien : refusée si l'état a changé depuis le brouillon, et les
// contrôles du brouillon sont rejoués sur l'état courant avant toute écriture.

import { planifier } from '../domaine/actions.js';
import { estDateValide } from '../domaine/dates.js';
import { CODES, ErreurHarness, PROVENANCES, STATUTS_PROPOSITION } from './contrats.js';
import { outil } from './outils.js';
import { evaluerPolitique, ORIGINE_CHEF } from './politiques.js';
import { empreinteEtat, itemsAppliquables } from './propositions.js';
import { tracer } from './trace.js';
import { controlerBrouillon } from './validateur.js';

const OPTIONS_SILENCIEUSES = { afficher: false };

/**
 * Jours corrigés par le chef avant validation : chaque item nommé dans `jours` reçoit sa nouvelle date après un rejeu
 * complet du validateur (avec les autres items gardés, sur une copie de l'état courant) : date AAAA-MM-JJ, jour ouvert,
 * pas après le service, ordre des étapes, règles d'avance. Un refus lève et ne modifie rien.
 * @returns {object[]} les items de la proposition, ceux de `jours` recalculés (date, évaluation, motifs, quantité, commande)
 */
function corrigerJours(proposition, { jours, itemsRetires = [] }, etat, h, aujourdhui) {
  const parId = new Map(proposition.items.map((i) => [i.id, i]));
  for (const [itemId, date] of Object.entries(jours)) {
    const item = parId.get(itemId);
    if (!item) throw new ErreurHarness(CODES.REFERENCE_INCONNUE, `Item inconnu : ${itemId}`);
    if (itemsRetires.includes(itemId)) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `${item.nom} : ligne écartée, son jour ne peut pas être corrigé`);
    if (!estDateValide(date)) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `${item.nom} : date invalide « ${date} » (format attendu AAAA-MM-JJ)`);
  }
  const gardes = proposition.items.filter((i) => !itemsRetires.includes(i.id));
  const rejeu = controlerBrouillon({
    type: 'planning',
    items: gardes.map((i) => ({ productionId: i.productionId, date: Object.hasOwn(jours, i.id) ? jours[i.id] : i.date })),
  }, etat, { h, aujourdhui });
  if (rejeu.erreurs.length) throw new ErreurHarness(CODES.PRECONDITION, rejeu.erreurs[0]);
  if (rejeu.aDecider.length) throw new ErreurHarness(CODES.PRECONDITION, rejeu.aDecider[0].texte);
  const recalcules = new Map(rejeu.items.map((i) => [i.productionId, i]));
  return proposition.items.map((i) => {
    if (!Object.hasOwn(jours, i.id)) return i;
    const { date, evaluation, motifs, quantite, commande } = recalcules.get(i.productionId);
    return { ...i, date, evaluation, motifs, quantite, commande };
  });
}

/** Écrit la décision du chef dans le registre et dans le journal (le texte libre d'un refus n'y entre pas). */
function enregistrerDecision(registre, id, decision, etat, h, aujourdhui) {
  // La trace est écrite AVANT de toucher au registre : si l'écriture du journal échoue, le registre reste inchangé ;
  // si le registre refuse, l'action `agir` est annulée et la trace avec elle.
  const avant = registre.lire(id);
  if (decision.choix === 'valider') {
    const jours = decision.jours ?? {};
    const items = Object.keys(jours).length ? corrigerJours(avant, decision, etat, h, aujourdhui) : null;
    tracer(etat, h, 'validee', {
      provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: id,
      resume: `${avant.items.length} item(s), ${(decision.itemsConfirmes ?? []).length} confirmé(s), ${(decision.itemsRetires ?? []).length} retiré(s), ${Object.keys(jours).length} jour(s) corrigé(s)`,
    });
    return registre.valider(id, h, { ...decision, items });
  }
  tracer(etat, h, 'refusee', { provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: id, resume: 'refus du chef' });
  return registre.refuser(id, h, decision.raison ?? '');
}

/**
 * Le chef valide ou refuse une proposition. La décision et sa trace sont écrites dans la même action atomique.
 * CONTRAT pour l'interface : `jours` corrige le jour d'une ligne du brouillon avant de valider (clé : `item.id`,
 * valeur : date AAAA-MM-JJ). Chaque jour corrigé est rejoué par le validateur sur l'état courant (jour ouvert, pas après
 * le service, ordre des étapes, règles d'avance) ; un refus lève une `ErreurHarness` dont le message nomme la
 * préparation et la raison, et rien n'est modifié (ni registre, ni journal). Accepté : la date de l'item ET de sa
 * commande changent ; `appliquerProposition` écrit ensuite `jourDecide` à cette date.
 * @param {object} registre
 * @param {string} id
 * @param {{choix:'valider'|'refuser', itemsConfirmes?:string[], itemsRetires?:string[], jours?:{[itemId:string]:string}, raison?:string}} decision
 * @param {{executeur:Function, aujourdhui?:string|null}} options `executeur(fn, options)` a la forme de `agir` ; `aujourdhui` écarte un jour corrigé déjà passé
 * @returns {object} la proposition mise à jour
 */
export function decider(registre, id, decision, { executeur, aujourdhui = null }) {
  if (!['valider', 'refuser'].includes(decision?.choix)) {
    throw new ErreurHarness(CODES.ENTREE_INVALIDE, `Choix inconnu : ${decision?.choix}`);
  }
  if (decision.jours !== undefined && (typeof decision.jours !== 'object' || decision.jours === null || Array.isArray(decision.jours))) {
    throw new ErreurHarness(CODES.ENTREE_INVALIDE, 'jours : objet { itemId: date } attendu');
  }
  let proposition = null;
  let echec = null;
  const r = executeur((etat, h) => {
    try {
      proposition = enregistrerDecision(registre, id, decision, etat, h, aujourdhui);
    } catch (erreur) {
      echec = erreur;
      throw erreur;
    }
  }, OPTIONS_SILENCIEUSES);
  if (!r.ok) throw echec instanceof ErreurHarness ? echec : new ErreurHarness(CODES.STATUT_INCOMPATIBLE, r.erreur);
  return proposition;
}

/**
 * Applique une proposition validée : une commande `planifier_production` par item appliquable, dans une seule action.
 * Dans cette action, l'empreinte de l'état est revérifiée puis les contrôles du brouillon sont rejoués (références,
 * jour, ordre des étapes, règles d'avance) sur l'état courant. Ne lève pas : renvoie `{ok:false, code, message}`.
 * @param {object} registre
 * @param {string} id
 * @param {{executeur:Function, aujourdhui?:string|null}} options `aujourdhui` écarte une date devenue passée
 * @returns {{ok:true, appliques:string[]}|{ok:false, code:string, message:string}}
 */
export function appliquerProposition(registre, id, { executeur, aujourdhui = null }) {
  const p = registre.lire(id);
  if (p.statut === STATUTS_PROPOSITION.APPLIQUEE) return { ok: false, code: CODES.STATUT_INCOMPATIBLE, message: 'Cette proposition a déjà été appliquée.' };
  if (p.statut !== STATUTS_PROPOSITION.VALIDEE || p.decision?.choix !== 'valider') {
    return { ok: false, code: CODES.STATUT_INCOMPATIBLE, message: `Proposition ${p.statut} : seule une proposition validée par le chef peut être appliquée.` };
  }
  const politique = evaluerPolitique({ outil: outil('planifier_production'), origine: ORIGINE_CHEF, confirmeParChef: p.decision.par === 'chef' });
  if (politique.decision !== 'auto') return { ok: false, code: CODES.INTERDIT, message: politique.raisons.join(' ; ') };
  const items = itemsAppliquables(p);
  if (items.length === 0) return { ok: false, code: CODES.PRECONDITION, message: 'Rien à appliquer : aucun item validé.' };
  if (items.some((i) => i.commande?.outil !== 'planifier_production')) return { ok: false, code: CODES.INTERDIT, message: 'Commande inconnue dans la proposition.' };

  let conflit = null;
  const r = executeur((etat, h) => {
    const refuser = (message) => { conflit = message; throw new ErreurHarness(CODES.CONFLIT, message); };
    if (empreinteEtat(etat, p.perimetre) !== p.empreinte) refuser("L'état a changé depuis le brouillon : relancez le calcul.");
    const rejeu = controlerBrouillon({
      type: 'planning',
      items: items.map(({ commande: { entrees } }) => ({ productionId: entrees.productionId, date: entrees.date })),
    }, etat, { h, aujourdhui });
    if (rejeu.erreurs.length) refuser(`Le brouillon n'est plus valide : ${rejeu.erreurs[0]}`);
    for (const { commande: { entrees } } of items) planifier(etat, entrees.productionId, entrees.date, h);
    tracer(etat, h, 'appliquee', { provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: id, resume: `${items.length} production(s) planifiée(s)` });
    return items.map((i) => i.productionId);
  }, OPTIONS_SILENCIEUSES);

  if (r.ok) {
    registre.marquer(id, STATUTS_PROPOSITION.APPLIQUEE);
    return { ok: true, appliques: r.valeur };
  }
  if (conflit) {
    registre.marquer(id, STATUTS_PROPOSITION.CONFLIT);
    return { ok: false, code: CODES.CONFLIT, message: conflit };
  }
  return { ok: false, code: CODES.PRECONDITION, message: r.erreur };
}
