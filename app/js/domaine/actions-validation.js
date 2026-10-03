// Actions de l'assistant de validation. Chacune prend l'horodatage ISO `h` en dernier argument.
//  - validerStandard : la propriétaire valide une estimation en CHOISISSANT la valeur ; elle devient le standard maison.
//  - corrigerStandard : une autre valeur, geste explicite (seul moyen de remplacer un standard déjà validé ici).
//  - correctionDuJour : « seulement cette fois » ; le grammage du plat change, jamais le standard.
//  - reporterValidation : « plus tard » ; ne bloque ni ne change aucune quantité.
// Le milieu d'une fourchette n'est jamais pris à la place du chef : une valeur absente est refusée.

import { modifierComposant, terminer } from './actions.js';
import { grammageEffectif, groupeDeCleStandard, familleParCle, ROLES_STANDARD, lignesStandards, lignesStandardsGroupes } from './savoir.js';
import { ETAT_POIDS, UNITE } from './statuts.js';

const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

/** Valeur choisie : un nombre strictement positif tapé par la propriétaire. */
function exigerValeur(saisie) {
  const valeur = saisie?.valeur;
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) {
    throw new Error("Saisissez la valeur de la portion (nombre positif) : l'application ne choisit pas à votre place.");
  }
  return valeur;
}

const enClair = (min, max, unite, etat) => `${min === max ? min : `${min}–${max}`} ${unite} (${etat})`;

/** Ligne de Réglages (repère et standard) d'une famille ou catégorie et d'un rôle ; Error si inconnue. */
function ligneDe(etat, cleFamille, role) {
  if (typeof cleFamille !== 'string' || CLES_INTERDITES.has(cleFamille)
    || (!familleParCle(cleFamille) && !groupeDeCleStandard(cleFamille))) {
    throw new Error(`Famille de produits inconnue : « ${cleFamille} ».`);
  }
  if (!ROLES_STANDARD.includes(role)) throw new Error(`Rôle sans standard maison : « ${role} ».`);
  return [...lignesStandards(etat), ...lignesStandardsGroupes(etat)].find((l) => l.cleFamille === cleFamille && l.role === role);
}

/** Valeur choisie, unité et état du poids ; refus hors fourchette sans confirmation. */
function lireChoix(saisie, repere, etendu) {
  const valeur = exigerValeur(saisie);
  const unite = etendu ? (saisie.unite ?? repere.unite) : repere.unite;
  const etatPoids = etendu ? (saisie.etat ?? repere.etat) : repere.etat;
  if (!Object.hasOwn(UNITE, unite)) throw new Error(`Unité inconnue : « ${unite} ».`);
  if (!Object.hasOwn(ETAT_POIDS, etatPoids)) throw new Error(`État du poids inconnu : « ${etatPoids} ».`);
  const horsFourchette = unite === repere.unite && etatPoids === repere.etat && (valeur < repere.min || valeur > repere.max);
  if (horsFourchette && saisie.confirmeHorsFourchette !== true) {
    throw new Error(`${valeur} ${unite} est hors de la fourchette proposée (${enClair(repere.min, repere.max, repere.unite, repere.etat)}) : `
      + 'confirmez explicitement cette valeur, ou choisissez-en une dans la fourchette.');
  }
  return { valeur, unite, etat: etatPoids };
}

function ecrire(etat, cleFamille, role, choix, h) {
  if (etat.standards === null || typeof etat.standards !== 'object') etat.standards = {};
  if (!Object.hasOwn(etat.standards, cleFamille)) etat.standards[cleFamille] = {};
  const standard = { valeur: choix.valeur, unite: choix.unite, etat: choix.etat, h };
  etat.standards[cleFamille][role] = standard;
  if (etat.validations && Object.hasOwn(etat.validations, `${cleFamille}|${role}`)) delete etat.validations[`${cleFamille}|${role}`];
  return standard;
}

const nomDe = (ligne) => `${ligne.libelle} ${ligne.role.replace('_', ' ')}`;

/**
 * Valide une estimation comme standard maison, avec la valeur CHOISIE. `saisie = { valeur, confirmeHorsFourchette? }` ;
 * l'unité et l'état du poids sont ceux de la proposition. Refus : valeur absente, valeur hors fourchette sans
 * confirmation, pas de repère à valider, standard déjà validé (le remplacer demande `corrigerStandard`).
 * Le journal garde la proposition vue.
 */
export function validerStandard(etat, cleFamille, role, saisie, h) {
  verifierH(h);
  const ligne = ligneDe(etat, cleFamille, role);
  const r = ligne?.repereBase;
  if (!r) throw new Error('Aucun repère à valider pour cette portion : réglez le standard maison directement dans Réglages.');
  if (ligne.standard) throw new Error('Un standard maison est déjà validé pour cette portion : utilisez « Corriger » pour le remplacer.');
  const choix = lireChoix(saisie, r, false);
  const standard = ecrire(etat, cleFamille, role, choix, h);
  return terminer(etat, h, 'validerStandard',
    `${nomDe(ligne)} : ${choix.valeur} ${choix.unite} (${choix.etat}) ; proposition vue ${enClair(r.min, r.max, r.unite, r.etat)}`, standard);
}

/**
 * Corrige : une autre valeur remplace (ou crée) le standard maison, geste explicite. `saisie = { valeur, unite?, etat?,
 * confirmeHorsFourchette? }`. Le journal garde l'avant (standard précédent ou proposition vue) et l'après.
 */
export function corrigerStandard(etat, cleFamille, role, saisie, h) {
  verifierH(h);
  const ligne = ligneDe(etat, cleFamille, role);
  const r = ligne?.repereBase;
  const avant = ligne.standard;
  if (!r && !avant) throw new Error('Aucun repère ni standard à corriger pour cette portion.');
  const choix = lireChoix(saisie, r ?? avant, true);
  if (avant && avant.valeur === choix.valeur && avant.unite === choix.unite && avant.etat === choix.etat) {
    throw new Error('Le standard maison a déjà cette valeur : rien à corriger.');
  }
  const standard = ecrire(etat, cleFamille, role, choix, h);
  const depuis = avant ? `avant ${avant.valeur} ${avant.unite} (${avant.etat})` : `proposition vue ${enClair(r.min, r.max, r.unite, r.etat)}`;
  return terminer(etat, h, 'corrigerStandard',
    `${nomDe(ligne)} : ${depuis}, après ${choix.valeur} ${choix.unite} (${choix.etat})`, standard);
}

/**
 * « Seulement cette fois » : le grammage de CE plat (provenance « saisi au service »). `saisie = { valeur, unite?, etat? }` ;
 * unité et état du poids par défaut : ceux de la portion utilisée jusqu'ici. N'écrit jamais le standard.
 */
export function correctionDuJour(etat, composantId, saisie, h) {
  verifierH(h);
  if (!Object.hasOwn(etat.composants ?? {}, composantId)) throw new Error(`Composant introuvable : ${composantId}`);
  const c = etat.composants[composantId];
  const valeur = exigerValeur(saisie);
  const actuel = grammageEffectif(etat, c);
  const unite = saisie.unite ?? actuel?.unite ?? c.grammage.unite;
  const etatPoids = saisie.etat ?? actuel?.etat ?? c.grammage.etat;
  modifierComposant(etat, composantId, {
    grammage: { valeur, unite, etat: etatPoids, statut: 'SAISI_SERVICE', source: 'corrigé pour ce plat seulement (validation de la portion)' },
  }, h);
  return c;
}

/** « Plus tard » : la valeur est masquée jusqu'au lendemain. Ne change aucune quantité, ne bloque rien. */
export function reporterValidation(etat, cle, h) {
  verifierH(h);
  if (typeof cle !== 'string' || cle === '' || CLES_INTERDITES.has(cle)) throw new Error(`Clé de validation invalide : « ${cle} ».`);
  if (etat.validations === null || typeof etat.validations !== 'object') etat.validations = {};
  etat.validations[cle] = { statut: 'plus_tard', h };
  return terminer(etat, h, 'reporterValidation', cle.replace('|', ' '), etat.validations[cle]);
}
