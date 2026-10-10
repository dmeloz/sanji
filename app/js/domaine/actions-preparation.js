// Action de « Préparer la semaine » : « Tout valider avec les standards » (décision du 2026-10-09). Un seul geste valide,
// pour chaque ligne qui a un standard de base, la valeur de ce standard ; ce geste remplace, pour lui seul, la règle
// « une estimation ne devient un standard maison que par la valeur choisie ». Une valeur INCONNU n'est jamais touchée.

import { definirStandard, memoriser } from './actions.js';
import { correctionDuJour, validerStandard } from './actions-validation.js';
import { ROLES_STANDARD } from './savoir.js';
import { preparationSemaine } from './preparation.js';
import { cleStandardDe } from './validation.js';

/**
 * Valide toutes les lignes à standard de base de la semaine (valeur du standard, état de poids du standard). Appelée dans
 * UNE action du magasin : une erreur annule tout. Idempotente (une ligne validée n'est plus proposée) ; une valeur de la
 * propriétaire passe toujours devant (une portion déjà posée n'est jamais une ligne à valider). Les portions ne portent
 * aucun seuil d'hygiène : rien à avertir ici (les réglages d'hygiène se règlent dans Réglages > Standards de base).
 * @returns {{validees:number, restantInconnu:number}}
 */
export function validerToutAvecStandards(etat, lundi, h) {
  const lignes = preparationSemaine(etat, lundi, lundi).aConfirmer.filter((l) => !l.estInconnu);
  for (const l of lignes) validerStandard(etat, l.cible.famille, l.cible.role, { valeur: l.valeurStandard }, h);
  return { validees: lignes.length, restantInconnu: preparationSemaine(etat, lundi, lundi).restantInconnu };
}

/**
 * Portion TAPÉE par la propriétaire pour une ligne sans standard (INCONNU) : c'est sa valeur choisie, jamais une valeur proposée.
 * Famille et rôle connus : elle devient son standard maison (reprise toutes les semaines). Sinon : portion retenue pour ce nom, toutes les semaines (fiche retenue, voir fiches-retenues.js),
 * gardée aussi dans la mémoire maison par nom (`memoriser`, à reprendre depuis la fiche du plat ; rien n'est repris seul).
 * @returns {{portee:'standard'|'plat'}}
 */
export function saisirPortionInconnue(etat, composantId, valeur, h) {
  const c = etat.composants?.[composantId];
  if (!c) throw new Error(`Composant introuvable : ${composantId}`);
  const famille = ROLES_STANDARD.includes(c.role) ? cleStandardDe(c) : null;
  if (famille) {
    definirStandard(etat, famille, c.role, { valeur, unite: c.grammage.unite, etat: c.grammage.etat }, h);
    return { portee: 'standard' };
  }
  correctionDuJour(etat, composantId, { valeur }, h);
  if (c.role) memoriser(etat, composantId, h);
  return { portee: 'plat' };
}
