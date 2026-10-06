// Moteur de politiques : décide, avant toute action, si elle est automatique, simple proposition, soumise à
// confirmation du chef ou interdite. Les règles critiques vivent ici, en code testé, jamais dans un prompt.

import { DECISIONS, NIVEAUX, ORIGINES } from './contrats.js';

/** Origine d'une demande de commande validée par le chef (distincte du calcul et du modèle). */
export const ORIGINE_CHEF = 'chef';

/**
 * Actions du domaine qui engagent une décision métier, sanitaire ou le comportement validé : le harness ne les expose
 * pas. Un modèle qui les réclame reçoit un refus explicite (elles restent des gestes du chef dans l'interface).
 */
export const ACTIONS_RESERVEES_AU_CHEF = Object.freeze([
  'definirRegle', 'supprimerRegle', 'definirStandard', 'supprimerStandard', 'ajusterStandard', 'validerStandard',
  'corrigerStandard', 'accepterApprentissage', 'ecarterApprentissage', 'validerRecette', 'modifierRecette', 'validerComposant',
  'modifierComposant', 'confirmerRepartition', 'deciderEcart', 'marquerFait', 'corrigerReel', 'supprimerProduction',
  'annulerFiche', 'modifierFiche', 'importer', 'remplacer', 'ajouterAdaptation',
]);

/**
 * @param {{outil:{nom:string, niveau:string}, origine:string, confirmeParChef?:boolean}} demande
 * @returns {{decision:string, raisons:string[]}}
 */
export function evaluerPolitique({ outil, origine, confirmeParChef = false }) {
  if (outil.niveau === NIVEAUX.LECTURE || outil.niveau === NIVEAUX.CALCUL) {
    return { decision: DECISIONS.AUTO, raisons: ['lecture ou calcul sans effet sur l\'état'] };
  }
  if (outil.niveau === NIVEAUX.PROPOSITION) {
    return { decision: DECISIONS.PROPOSITION, raisons: ['le résultat reste un brouillon : rien n\'est enregistré'] };
  }
  if (outil.niveau !== NIVEAUX.COMMANDE) {
    return { decision: DECISIONS.INTERDIT, raisons: [`niveau inconnu : ${outil.niveau}`] };
  }
  if (origine === ORIGINES.MODELE || origine === ORIGINES.DETERMINISTE) {
    return { decision: DECISIONS.INTERDIT, raisons: ['une commande ne peut venir ni du modèle ni d\'un calcul : seulement d\'une proposition validée par le chef'] };
  }
  if (origine !== ORIGINE_CHEF) return { decision: DECISIONS.INTERDIT, raisons: [`origine inconnue : ${origine}`] };
  if (!confirmeParChef) return { decision: DECISIONS.CONFIRMATION, raisons: ['la commande engage une décision : validation explicite du chef requise'] };
  return { decision: DECISIONS.AUTO, raisons: ['validée par le chef'] };
}

/** Raison d'un refus pour un nom d'outil absent du registre. */
export function raisonOutilAbsent(nom) {
  return ACTIONS_RESERVEES_AU_CHEF.includes(nom)
    ? `« ${nom} » est réservée au chef : le harness ne l'expose pas.`
    : `Outil inconnu : « ${nom} ».`;
}
