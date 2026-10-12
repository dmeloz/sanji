// Actions sur une proposition d'apprentissage (apprentissage.js). Chacune prend l'horodatage ISO `h` en dernier argument.
//  - accepterApprentissage : la valeur proposée (ou celle que la propriétaire a retapée) devient le standard maison,
//    par validerStandard, corrigerStandard ou, pour une première valeur (famille sans repère), definirStandard : elle passe devant pour toujours.
//  - ecarterApprentissage : « Non, garder » ; mémorisé dans `etat.validations`, la proposition se tait 30 jours
//    ou jusqu'à 3 nouvelles corrections. Le standard n'est pas touché.

import { definirStandard, terminer } from './actions.js';
import { corrigerStandard, validerStandard } from './actions-validation.js';
import { cleApprentissage, propositionsApprentissage } from './apprentissage.js';
import { ROLES_STANDARD, lignesStandards, lignesStandardsGroupes } from './savoir.js';
import { libelle } from './statuts.js';

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

const nom = (ligne) => `${ligne.libelle} ${ligne.role.replace('_', ' ')}`;

function ligneDe(etat, cleFamille, role) {
  if (!ROLES_STANDARD.includes(role)) throw new Error(`Rôle sans standard maison : « ${role} ».`);
  const ligne = [...lignesStandards(etat), ...lignesStandardsGroupes(etat)].find((l) => l.cleFamille === cleFamille && l.role === role);
  if (!ligne) throw new Error(`Famille de produits inconnue : « ${cleFamille} ».`);
  return ligne;
}

/**
 * Accepte : `saisie = { valeur, unite?, etat? }` (la proposition). Sans standard maison et avec un repère de même unité
 * et de même état du poids : validerStandard ; sinon corrigerStandard. La valeur vient des corrections de la propriétaire :
 * elle est confirmée d'avance même hors de la fourchette du repère.
 */
export function accepterApprentissage(etat, cleFamille, role, saisie, h) {
  verifierH(h);
  const ligne = ligneDe(etat, cleFamille, role);
  const r = ligne.repereBase;
  const unite = saisie?.unite ?? r?.unite ?? ligne.standard?.unite ?? 'g';
  const etatPoids = saisie?.etat ?? r?.etat ?? ligne.standard?.etat ?? 'cuit';
  const choix = { valeur: saisie?.valeur, unite, etat: etatPoids, confirmeHorsFourchette: true };
  const proposition = propositionsApprentissage(etat, h.slice(0, 10))
    .find((p) => p.cleFamille === cleFamille && p.role === role && p.etatPoids === etatPoids);
  if (!ligne.standard && r && r.unite === unite && r.etat === etatPoids) validerStandard(etat, cleFamille, role, choix, h);
  else if (!ligne.standard && !r) definirStandard(etat, cleFamille, role, choix, h); // première valeur : ni repère ni standard à corriger
  else corrigerStandard(etat, cleFamille, role, choix, h);
  if (etat.validations) delete etat.validations[cleApprentissage(cleFamille, role)];
  const standard = etat.standards[cleFamille][role];
  const corrections = proposition ? ` (d'après ${proposition.nombre} corrections de portion)` : '';
  return terminer(etat, h, 'accepterApprentissage',
    `${nom(ligne)} : standard maison ${standard.valeur} ${libelle('UNITE', standard.unite)} (${libelle('ETAT_POIDS', standard.etat)})${corrections}`, standard);
}

/** « Non, garder » : le standard reste ; la proposition se tait 30 jours ou jusqu'à 3 nouvelles corrections. */
export function ecarterApprentissage(etat, cleFamille, role, h) {
  verifierH(h);
  const ligne = ligneDe(etat, cleFamille, role);
  const vues = propositionsApprentissage(etat, h.slice(0, 10)).filter((p) => p.cleFamille === cleFamille && p.role === role);
  if (etat.validations === null || typeof etat.validations !== 'object') etat.validations = {};
  const entree = { statut: 'ecarte', h, vus: [...new Set(vues.flatMap((p) => p.composantIds))] };
  etat.validations[cleApprentissage(cleFamille, role)] = entree;
  const actuel = vues[0]?.actuelle;
  const valeur = actuel ? ` à ${actuel.valeur} ${libelle('UNITE', actuel.unite)}` : '';
  return terminer(etat, h, 'ecarterApprentissage', `${nom(ligne)} : on garde le standard${valeur}`, entree);
}
