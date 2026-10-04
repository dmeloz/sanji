// Assistant de validation des portions : quelles valeurs la propriétaire peut ajuster, une à la fois.
// Une portion qui vient d'un repère (de la base ou validé) est un STANDARD DE BASE (décision du 2026-10-04) : le calcul
// prend le milieu de la fourchette et l'utilise directement. Elle n'est jamais présentée comme une valeur du restaurant ;
// un standard maison, valeur choisie par la propriétaire, passe devant. Aucun chiffre ici : les fourchettes viennent des repères.

import { calculerComposant } from './calcul.js';
import { ajouterJours } from './dates.js';
import {
  ROLES_STANDARD, cleStandardGroupe, grammageEffectif, lignesStandards, lignesStandardsGroupes, reperesParDefaut,
} from './savoir.js';

const ORIGINES_REPERE = ['standard_base'];

/** Clé d'une valeur à valider : « famille|rôle » (ou « groupe:…|rôle » pour une catégorie). */
export const cleValidation = (cleFamille, role) => `${cleFamille}|${role}`;

/** Clé de standard (famille, ou catégorie « légumes » pour un légume sans famille) d'un composant, ou null. */
export function cleStandardDe(composant) {
  if (!composant || !ROLES_STANDARD.includes(composant.role)) return null;
  if (composant.famille) return composant.famille;
  return composant.categorie === 'legume' ? cleStandardGroupe('legumes') : null;
}

const aUnRepere = (etat, c, reperes) => ORIGINES_REPERE.includes(grammageEffectif(etat, c, reperes)?.origine);

function construire(etat, cleFamille, role, composants, reperes) {
  const ligne = [...lignesStandards(etat, reperes), ...lignesStandardsGroupes(etat, reperes)]
    .find((l) => l.cleFamille === cleFamille && l.role === role);
  const r = ligne?.repereBase;
  if (!r) return null;
  const portions = composants.reduce((somme, c) => somme + (calculerComposant(etat, c.id).portions?.total ?? 0), 0);
  return {
    cle: cleValidation(cleFamille, role), famille: cleFamille, libelle: ligne.libelle, role,
    proposition: { min: r.min, max: r.max, unite: r.unite, etat: r.etat },
    sources: r.sources, note: r.note, validePourLeChef: r.valide, standard: ligne.standard,
    // Effet de l'estimation actuelle (milieu de la fourchette), et des deux bornes : la fourchette n'est jamais cachée.
    effet: {
      portions, quantite: portions * r.valeur, unite: r.unite,
      quantiteMin: portions * r.min, quantiteMax: portions * r.max,
    },
    composantIds: composants.map((c) => c.id),
  };
}

/**
 * Valeurs à valider pour les plats au poste entre `date` et `date` + horizon jours (exclu), dont la portion vient d'un
 * repère et qui n'ont aucun standard maison (ni correction sur le plat). Regroupées par famille et rôle.
 * Une valeur marquée « plus tard » aujourd'hui (`etat.validations[cle]`) est masquée jusqu'au lendemain.
 * @returns {{cle:string, famille:string, role:string, proposition:{min:number, max:number, unite:string, etat:string},
 *   sources:string, effet:{portions:number, quantite:number, unite:string}, composantIds:string[]}[]}
 */
export function valeursAValider(etat, date, horizon = 4, reperes = reperesParDefaut()) {
  const dates = new Set(Array.from({ length: horizon }, (_, i) => ajouterJours(date, i)));
  const parCle = new Map();
  for (const c of Object.values(etat.composants ?? {})) {
    if (!dates.has(c.date) || !c.attribue || !c.valide) continue;
    const cleFamille = cleStandardDe(c);
    if (!cleFamille || !aUnRepere(etat, c, reperes)) continue;
    const cle = cleValidation(cleFamille, c.role);
    if (!parCle.has(cle)) parCle.set(cle, { cleFamille, role: c.role, composants: [] });
    parCle.get(cle).composants.push(c);
  }
  const reporte = (cle) => {
    const v = etat.validations?.[cle];
    return v?.statut === 'plus_tard' && String(v.h ?? '').slice(0, 10) >= date;
  };
  return [...parCle.entries()]
    .filter(([cle]) => !reporte(cle))
    .map(([, g]) => construire(etat, g.cleFamille, g.role, g.composants, reperes))
    .filter(Boolean)
    .sort((a, b) => a.libelle.localeCompare(b.libelle) || a.role.localeCompare(b.role));
}

/**
 * Fiche d'une valeur précise (ouverte par la propriétaire depuis un plat ou depuis Réglages), même si elle est masquée
 * « plus tard » ou déjà validée (`standard` la montre alors). `composantId` : le plat d'où l'on vient (il seul est
 * concerné) ; sinon, les plats au poste dans l'horizon qui reposent sur ce repère. Null s'il n'y a pas de repère.
 */
export function valeurPour(etat, cleFamille, role, date, { horizon = 4, composantId = null, reperes = reperesParDefaut() } = {}) {
  let composants;
  if (composantId) {
    const c = etat.composants?.[composantId];
    composants = c && aUnRepere(etat, c, reperes) ? [c] : [];
  } else {
    const dates = new Set(Array.from({ length: horizon }, (_, i) => ajouterJours(date, i)));
    composants = Object.values(etat.composants ?? {}).filter((c) => dates.has(c.date) && c.attribue && c.valide
      && cleStandardDe(c) === cleFamille && c.role === role && aUnRepere(etat, c, reperes));
  }
  return construire(etat, cleFamille, role, composants, reperes);
}
