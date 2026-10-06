// Contrats du harness IA : vocabulaire fermé, erreurs typées et validation de structure sans dépendance.
// Le harness est une couche pure (sans DOM, sans réseau) entre l'état, le domaine, un éventuel modèle et le chef.

import { estDateValide } from '../domaine/dates.js';

export const VERSION_CONTEXTE = 1;

/** Niveau d'un outil : ce qu'il peut faire à l'état. Seul `commande` écrit, et jamais à la demande du modèle. */
export const NIVEAUX = Object.freeze({
  LECTURE: 'lecture',
  CALCUL: 'calcul',
  PROPOSITION: 'proposition',
  COMMANDE: 'commande',
});

/** Verdict d'une politique pour une action. */
export const DECISIONS = Object.freeze({
  AUTO: 'auto',
  PROPOSITION: 'proposition',
  CONFIRMATION: 'confirmation',
  INTERDIT: 'interdit',
});

export const STATUTS_PROPOSITION = Object.freeze({
  BROUILLON: 'brouillon',
  VALIDEE: 'validee',
  REFUSEE: 'refusee',
  APPLIQUEE: 'appliquee',
  PERIMEE: 'perimee',
  CONFLIT: 'conflit',
});

export const ORIGINES = Object.freeze({ DETERMINISTE: 'deterministe', MODELE: 'modele' });

/** D'où vient une information tracée : jamais confondre une suggestion, un calcul et une décision. */
export const PROVENANCES = Object.freeze({
  PROPOSITION_IA: 'proposition_ia',
  CALCUL_DETERMINISTE: 'calcul_deterministe',
  DONNEE_IMPORTEE: 'donnee_importee',
  REFERENTIEL: 'referentiel',
  CORRECTION_HUMAINE: 'correction_humaine',
});

export const CODES = Object.freeze({
  OUTIL_INCONNU: 'outil_inconnu',
  ENTREE_INVALIDE: 'entree_invalide',
  INTERDIT: 'interdit',
  REFERENCE_INCONNUE: 'reference_inconnue',
  PRECONDITION: 'precondition',
  PROPOSITION_INVALIDE: 'proposition_invalide',
  PROPOSITION_INCONNUE: 'proposition_inconnue',
  STATUT_INCOMPATIBLE: 'statut_incompatible',
  CONFLIT: 'conflit',
  MODELE_INDISPONIBLE: 'modele_indisponible',
  DELAI_DEPASSE: 'delai_depasse',
  ANNULE: 'annule',
});

export class ErreurHarness extends Error {
  /** @param {string} code un des `CODES` @param {string} message en français, affichable */
  constructor(code, message) {
    super(message);
    this.name = 'ErreurHarness';
    this.code = code;
  }
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Vérifie une valeur contre un schéma minimal et renvoie la liste des problèmes (vide = conforme).
 * Types : `texte`, `date` (AAAA-MM-JJ réelle), `entier`, `nombre`, `booleen`, `tableau` (`elements`),
 * `objet` (`champs`, un champ absent du schéma est refusé ; `optionnel: true` autorise l'absence).
 * Option `valeurs` : liste fermée de valeurs admises.
 * @param {unknown} valeur
 * @param {object} schema
 * @param {string} [chemin]
 * @returns {string[]}
 */
export function verifierSchema(valeur, schema, chemin = 'valeur') {
  const { type, valeurs } = schema;
  if (type === 'objet') {
    if (!estObjet(valeur)) return [`${chemin} : objet attendu`];
    const problemes = [];
    for (const cle of Object.keys(valeur)) {
      if (!Object.hasOwn(schema.champs, cle)) problemes.push(`${chemin}.${cle} : champ inconnu`);
    }
    for (const [cle, sousSchema] of Object.entries(schema.champs)) {
      if (!Object.hasOwn(valeur, cle) || valeur[cle] === undefined) {
        if (!sousSchema.optionnel) problemes.push(`${chemin}.${cle} : champ obligatoire absent`);
        continue;
      }
      problemes.push(...verifierSchema(valeur[cle], sousSchema, `${chemin}.${cle}`));
    }
    return problemes;
  }
  if (type === 'tableau') {
    if (!Array.isArray(valeur)) return [`${chemin} : tableau attendu`];
    return valeur.flatMap((x, i) => verifierSchema(x, schema.elements, `${chemin}[${i}]`));
  }
  const controles = {
    texte: (v) => typeof v === 'string' && v.trim() !== '',
    date: (v) => typeof v === 'string' && estDateValide(v),
    entier: (v) => Number.isInteger(v),
    nombre: (v) => typeof v === 'number' && Number.isFinite(v),
    booleen: (v) => typeof v === 'boolean',
  };
  if (!controles[type]) throw new Error(`Schéma invalide : type « ${type} » inconnu`);
  if (!controles[type](valeur)) return [`${chemin} : ${type} attendu`];
  if (valeurs && !valeurs.includes(valeur)) return [`${chemin} : valeur « ${valeur} » non admise`];
  return [];
}
