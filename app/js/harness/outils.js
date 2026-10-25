// Registre d'outils : la liste fermée de ce que le harness met à disposition. Le modèle ne choisit jamais une fonction
// du domaine par son nom : il demande un outil du registre, dont l'entrée est validée, la politique évaluée et la
// sortie copiée. Chaque outil réutilise les fonctions pures du domaine et ne modifie jamais l'état.

import { portionsMenu, calculerComposant } from '../domaine/calcul.js';
import { decisionsDe } from '../domaine/decisions.js';
import { etatTache, evaluerAvance, regleDe, repereConservation, suggererJour } from '../domaine/planification.js';
import { CODES, ErreurHarness, NIVEAUX, PROVENANCES, ORIGINES, verifierSchema } from './contrats.js';
import { proposerPlanning } from './parcours-planning.js';
import { evaluerPolitique, raisonOutilAbsent } from './politiques.js';
import { quantiteDe } from './validateur.js';

const DATE = { type: 'date' };
const ID = { type: 'texte' };
const objet = (champs) => ({ type: 'objet', champs });

function exigerProduction(etat, id) {
  const p = Object.hasOwn(etat.productions ?? {}, id) ? etat.productions[id] : null;
  if (!p) throw new ErreurHarness(CODES.REFERENCE_INCONNUE, `Production inconnue : ${id}`);
  const composant = Object.hasOwn(etat.composants ?? {}, p.composantId) ? etat.composants[p.composantId] : null;
  if (!composant) throw new ErreurHarness(CODES.REFERENCE_INCONNUE, `Composant introuvable pour la production ${id}`);
  return { p, composant };
}

function exigerComposant(etat, id) {
  const composant = Object.hasOwn(etat.composants ?? {}, id) ? etat.composants[id] : null;
  if (!composant) throw new ErreurHarness(CODES.REFERENCE_INCONNUE, `Composant inconnu : ${id}`);
  return composant;
}

const resumerEvaluation = (e) => ({
  jours: e.jours, conservation: e.conservation, couvre: e.couvre && e.conservation !== 'a_confirmer', autorisee: e.autorisee, alertes: e.alertes,
});

/** Définitions du registre. `executer(entrees, { etat, aujourdhui, h })` renvoie des données simples. */
const DEFINITIONS = [
  {
    nom: 'lire_menus', objectif: 'Intitulés des deux menus d\'un jour et composants qui en découlent.',
    niveau: NIVEAUX.LECTURE, provenance: PROVENANCES.DONNEE_IMPORTEE, entrees: objet({ date: DATE }),
    sorties: '{date, menus:{1:{intitule},2:{intitule}}, composants:[{id,menu,nom,categorie,attribue,valide}]}',
    preconditions: [], erreurs: [CODES.ENTREE_INVALIDE], effets: 'aucun',
    executer: ({ date }, { etat }) => ({
      date,
      menus: { 1: { intitule: etat.jours?.[date]?.menus?.[1]?.intitule ?? '' }, 2: { intitule: etat.jours?.[date]?.menus?.[2]?.intitule ?? '' } },
      composants: Object.values(etat.composants ?? {}).filter((c) => c.date === date)
        .map((c) => ({ id: c.id, menu: c.menu, nom: c.nom, categorie: c.categorie, attribue: c.attribue, valide: c.valide })),
    }),
  },
  {
    nom: 'lire_previsions', objectif: 'Portions prévues par menu pour un jour, séparées en estimées, provisoires et confirmées.',
    niveau: NIVEAUX.LECTURE, provenance: PROVENANCES.DONNEE_IMPORTEE, entrees: objet({ date: DATE }),
    sorties: '[{menu, total, prevision, previsionManquante, groupesConfirmes, groupesProvisoires}]',
    preconditions: [], erreurs: [CODES.ENTREE_INVALIDE], effets: 'aucun',
    executer: ({ date }, { etat }) => [1, 2].map((menu) => {
      const r = portionsMenu(etat, date, menu);
      return { menu, total: r.total, prevision: r.prevision, previsionManquante: Boolean(r.previsionManquante), groupesConfirmes: r.groupesConfirmes, groupesProvisoires: r.groupesProvisoires };
    }),
  },
  {
    nom: 'lire_planning', objectif: 'Productions servies ou décidées un jour donné, avec leur état.',
    niveau: NIVEAUX.LECTURE, provenance: PROVENANCES.DONNEE_IMPORTEE, entrees: objet({ date: DATE }),
    sorties: '[{productionId, composantId, nom, genre, dateService, jourDecide, etat}]',
    preconditions: [], erreurs: [CODES.ENTREE_INVALIDE], effets: 'aucun',
    executer: ({ date }, { etat }) => Object.values(etat.productions ?? {})
      .filter((p) => (p.dateService === date || p.jourDecide === date) && etat.composants?.[p.composantId])
      .map((p) => ({
        productionId: p.id, composantId: p.composantId, nom: etat.composants[p.composantId].nom, genre: p.genre,
        dateService: p.dateService, jourDecide: p.jourDecide, etat: etatTache(etat, p.id),
      })),
  },
  {
    nom: 'lire_regle', objectif: 'Règle de préparation validée et repère de conservation d\'un composant.',
    niveau: NIVEAUX.LECTURE, provenance: PROVENANCES.REFERENTIEL, entrees: objet({ composantId: ID }),
    sorties: '{regle:{avanceMaxJours,limiteUtilisationJours,valideLe}|null, repere:{jours,texte,provenance}|null}',
    preconditions: ['le composant existe'], erreurs: [CODES.REFERENCE_INCONNUE], effets: 'aucun',
    executer: ({ composantId }, { etat }) => {
      const composant = exigerComposant(etat, composantId);
      const regle = regleDe(etat, composant);
      return {
        regle: regle ? { avanceMaxJours: regle.avanceMaxJours, limiteUtilisationJours: regle.limiteUtilisationJours, valideLe: regle.valideLe } : null,
        repere: repereConservation(composant, etat),
      };
    },
  },
  {
    nom: 'lire_decisions_en_attente', objectif: 'Points « À décider » de la fenêtre courante (identifiant et genre seulement).',
    niveau: NIVEAUX.LECTURE, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ date: DATE }),
    sorties: '{total, cartes:[{id, genre, date?}]}',
    preconditions: [], erreurs: [CODES.ENTREE_INVALIDE], effets: 'aucun',
    executer: ({ date }, { etat }) => {
      const r = decisionsDe(etat, date);
      return { total: r.total, cartes: r.cartes.map((c) => ({ id: c.id, genre: c.genre, ...(c.date ? { date: c.date } : {}) })) };
    },
  },
  {
    nom: 'composants_du_poste', objectif: 'Composants attribués au poste d\'entremétier pour un jour.',
    niveau: NIVEAUX.CALCUL, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ date: DATE }),
    sorties: '[{id, menu, nom, categorie, valide}]',
    preconditions: [], erreurs: [CODES.ENTREE_INVALIDE], effets: 'aucun',
    executer: ({ date }, { etat }) => Object.values(etat.composants ?? {}).filter((c) => c.date === date && c.attribue)
      .map((c) => ({ id: c.id, menu: c.menu, nom: c.nom, categorie: c.categorie, valide: c.valide })),
  },
  {
    nom: 'calculer_quantites', objectif: 'Quantité à produire d\'un composant, de la quantité servie au brut, avec formule et statut.',
    niveau: NIVEAUX.CALCUL, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ composantId: ID }),
    sorties: '{libelle, statut, aValider, standardBase, formule, manquants}',
    preconditions: ['le composant existe'], erreurs: [CODES.REFERENCE_INCONNUE], effets: 'aucun',
    executer: ({ composantId }, { etat }) => {
      exigerComposant(etat, composantId);
      const calc = calculerComposant(etat, composantId);
      return { ...quantiteDe(etat, composantId), formule: calc.formule, manquants: calc.manquants };
    },
  },
  {
    nom: 'suggerer_jour', objectif: 'Premier jour compatible avec les règles pour une production non planifiée.',
    niveau: NIVEAUX.CALCUL, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ productionId: ID }),
    sorties: '{date, evaluation}|null',
    preconditions: ['la production existe'], erreurs: [CODES.REFERENCE_INCONNUE], effets: 'aucun',
    executer: ({ productionId }, { etat, aujourdhui }) => {
      exigerProduction(etat, productionId);
      const s = suggererJour(etat, productionId, aujourdhui);
      return s ? { date: s.date, evaluation: resumerEvaluation(s.evaluation) } : null;
    },
  },
  {
    nom: 'evaluer_avance', objectif: 'Évalue une avance de production à une date donnée (règle, conservation, alertes).',
    niveau: NIVEAUX.CALCUL, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ productionId: ID, date: DATE }),
    sorties: '{jours, conservation, couvre, autorisee, alertes}',
    preconditions: ['la production existe'], erreurs: [CODES.REFERENCE_INCONNUE], effets: 'aucun',
    executer: ({ productionId, date }, { etat }) => {
      const { p, composant } = exigerProduction(etat, productionId);
      return resumerEvaluation(evaluerAvance(date, p.dateService, regleDe(etat, composant, p.etapeCle ?? null), repereConservation(composant, etat)));
    },
  },
  {
    nom: 'proposer_planning', objectif: 'Brouillon de planning des productions à planifier sur une période, sans rien enregistrer.',
    niveau: NIVEAUX.PROPOSITION, provenance: PROVENANCES.CALCUL_DETERMINISTE, entrees: objet({ dateDebut: DATE, dateFin: DATE }),
    sorties: '{brouillon:{type:"planning", items:[{productionId,date}]}, nonPlacees:[{productionId,composantId,texte}]}',
    preconditions: ['dateDebut <= dateFin'], erreurs: [CODES.PRECONDITION], effets: 'aucun (brouillon)',
    verifier: ({ dateDebut, dateFin }) => {
      if (dateDebut > dateFin) throw new ErreurHarness(CODES.PRECONDITION, 'dateDebut doit précéder dateFin.');
    },
    executer: ({ dateDebut, dateFin }, { etat, aujourdhui, h }) => proposerPlanning(etat, { h, aujourdhui, dateDebut, dateFin }),
  },
  {
    nom: 'planifier_production', objectif: 'Décide le jour d\'une production (commande).',
    niveau: NIVEAUX.COMMANDE, provenance: PROVENANCES.CORRECTION_HUMAINE,
    entrees: objet({ productionId: ID, date: DATE }),
    sorties: '{production, evaluation, alertes}',
    preconditions: ['proposition validée par le chef', 'état inchangé depuis le brouillon'], erreurs: [CODES.INTERDIT, CODES.CONFLIT],
    effets: 'modifie jourDecide de la production',
    engageMetier: true,
  },
];

export const REGISTRE = Object.freeze(Object.fromEntries(DEFINITIONS.map((d) => [d.nom, Object.freeze(d)])));

/** Définition d'un outil, ou null s'il n'est pas au registre. */
export function outil(nom) {
  return Object.hasOwn(REGISTRE, nom) ? REGISTRE[nom] : null;
}

/** Ce que le modèle voit : nom, objectif, schéma d'entrée. Jamais les commandes, jamais les fonctions. */
export function descriptionsPourModele() {
  return DEFINITIONS.filter((d) => d.niveau !== NIVEAUX.COMMANDE).map((d) => ({ nom: d.nom, objectif: d.objectif, niveau: d.niveau, entrees: structuredClone(d.entrees) }));
}

/**
 * Exécute un outil de lecture, de calcul ou de proposition. Les commandes ne passent jamais ici : voir `commandes.js`.
 * @param {string} nom
 * @param {unknown} entrees
 * @param {{etat:object, aujourdhui:string, h:string}} contexte
 * @param {{origine?:string}} [options]
 * @returns {{outil:string, provenance:string, resultat:any}} résultat copié : le modèle ne reçoit aucune référence à l'état
 */
export function executerOutil(nom, entrees, contexte, { origine = ORIGINES.MODELE } = {}) {
  const definition = outil(nom);
  if (!definition) throw new ErreurHarness(CODES.OUTIL_INCONNU, raisonOutilAbsent(nom));
  const politique = evaluerPolitique({ outil: definition, origine });
  if (politique.decision === 'interdit' || politique.decision === 'confirmation') {
    throw new ErreurHarness(CODES.INTERDIT, `${nom} : ${politique.raisons.join(' ; ')}`);
  }
  if (definition.niveau === NIVEAUX.COMMANDE) throw new ErreurHarness(CODES.INTERDIT, `${nom} : une commande passe par une proposition validée.`);
  const problemes = verifierSchema(entrees, definition.entrees, 'entrees');
  if (problemes.length) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `${nom} : ${problemes.join(' ; ')}`);
  definition.verifier?.(entrees, contexte);
  const resultat = structuredClone(definition.executer(entrees, contexte));
  return { outil: nom, provenance: definition.provenance, resultat };
}
