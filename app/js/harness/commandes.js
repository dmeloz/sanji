// Commandes contrôlées : la seule porte par laquelle une proposition validée devient un changement d'état.
// Tout passe par l'exécuteur injecté (en production : `agir` de magasin.js), donc par une copie d'état, une écriture
// atomique et un redessin. L'application est tout ou rien : refusée si l'état a changé depuis le brouillon, et les
// contrôles du brouillon sont rejoués sur l'état courant avant toute écriture.

import { planifier } from '../domaine/actions.js';
import { CODES, ErreurHarness, PROVENANCES, STATUTS_PROPOSITION } from './contrats.js';
import { outil } from './outils.js';
import { evaluerPolitique, ORIGINE_CHEF } from './politiques.js';
import { exclusionDuPasse, verifierBornes } from './horloge.js';
import { empreinteEtat, itemsAppliquables } from './propositions.js';
import { tracer } from './trace.js';
import { controlerBrouillon } from './validateur.js';

const OPTIONS_SILENCIEUSES = { afficher: false };

/** Écrit la décision du chef dans le registre et dans le journal (le texte libre d'un refus n'y entre pas). */
function enregistrerDecision(registre, id, decision, etat, h) {
  // La trace est écrite AVANT de toucher au registre : si l'écriture du journal échoue, le registre reste inchangé ;
  // si le registre refuse, l'action `agir` est annulée et la trace avec elle.
  const avant = registre.lire(id);
  if (decision.choix === 'valider') {
    tracer(etat, h, 'validee', {
      provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: id,
      resume: `${avant.items.length} item(s), ${(decision.itemsConfirmes ?? []).length} confirmé(s), ${(decision.itemsRetires ?? []).length} retiré(s)`,
    });
    return registre.valider(id, h, decision);
  }
  tracer(etat, h, 'refusee', { provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: id, resume: 'refus du chef' });
  return registre.refuser(id, h, decision.raison ?? '');
}

/**
 * Le chef valide ou refuse une proposition. La décision et sa trace sont écrites dans la même action atomique.
 * @param {object} registre
 * @param {string} id
 * @param {{choix:'valider'|'refuser', itemsConfirmes?:string[], itemsRetires?:string[], raison?:string}} decision
 * @param {{executeur:Function}} options `executeur(fn, options)` a la forme de `agir`
 * @returns {object} la proposition mise à jour
 */
export function decider(registre, id, decision, { executeur }) {
  if (!['valider', 'refuser'].includes(decision?.choix)) {
    throw new ErreurHarness(CODES.ENTREE_INVALIDE, `Choix inconnu : ${decision?.choix}`);
  }
  let proposition = null;
  let echec = null;
  const r = executeur((etat, h) => {
    try {
      proposition = enregistrerDecision(registre, id, decision, etat, h);
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
 * jour, créneau, capacité, règles d'avance) sur l'état courant. Ne lève pas : renvoie `{ok:false, code, message}`.
 * @param {object} registre
 * @param {string} id
 * @param {{executeur:Function, aujourdhui?:string|null, horloge?:object|null, bornes?:object|null}} options `aujourdhui` écarte une
 *   date devenue passée ; `horloge` et `bornes` (fin de créneau) écartent un créneau devenu terminé
 * @returns {{ok:true, appliques:string[]}|{ok:false, code:string, message:string}}
 */
export function appliquerProposition(registre, id, { executeur, aujourdhui = null, horloge = null, bornes = null }) {
  const jour = aujourdhui ?? horloge?.aujourdhui() ?? null;
  const exclure = exclusionDuPasse(horloge, verifierBornes(bornes));
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
      items: items.map(({ commande: { entrees } }) => ({ productionId: entrees.productionId, date: entrees.date, creneau: entrees.creneau })),
    }, etat, { h, aujourdhui: jour, exclure });
    if (rejeu.erreurs.length) refuser(`Le brouillon n'est plus valide : ${rejeu.erreurs[0]}`);
    for (const { commande: { entrees } } of items) planifier(etat, entrees.productionId, entrees.date, entrees.creneau, h);
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
