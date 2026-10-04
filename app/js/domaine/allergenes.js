// Allergènes : affichage et suivi seulement. Aucune fonction n'affirme une compatibilité.

import { aMenuDuJour } from './dates.js';

/**
 * Statut effectif des allergènes d'un composant. `valide` seulement si le chef l'a validé ET que la base du
 * calcul est restaurant (recette liée validée pour une préparation maison) ; un composant générique ou à préciser
 * reste « à confirmer ». Une fiche type ou un exemple ne suffit jamais.
 * @returns {{statut:'a_confirmer'|'valide', liste:string[], raison:string}}
 */
export function statutAllergenes(etat, composant) {
  const a = composant.allergenes ?? {};
  const liste = Array.isArray(a.liste) ? a.liste : [];
  if (a.statut !== 'valide') return { statut: 'a_confirmer', liste, raison: 'allergènes non validés' };
  if (composant.type === 'generique' || composant.type === 'a_preciser') {
    return { statut: 'a_confirmer', liste, raison: 'composition à définir' };
  }
  if (composant.type === 'preparation_maison') {
    const recette = composant.recetteId ? etat.recettes?.[composant.recetteId] : null;
    if (!recette || !recette.valide) return { statut: 'a_confirmer', liste, raison: 'recette restaurant non validée' };
  }
  return { statut: 'valide', liste, raison: '' };
}

/**
 * Ce qui empêche la liste d'un composant de compter comme validée, même si le chef la valide : « composition à définir »
 * (composant générique ou à préciser) ou « recette restaurant non validée ». `null` : la validation de la liste suffit.
 * Même règle que `statutAllergenes`, qui reste seule juge.
 * @returns {null|'composition à définir'|'recette restaurant non validée'}
 */
export function obstacleValidationAllergenes(etat, composant) {
  const s = statutAllergenes(etat, { ...composant, allergenes: { ...composant.allergenes, statut: 'valide' } });
  return s.statut === 'valide' ? null : s.raison;
}

/** Composants attribués auxquels s'applique une fiche (midi : selon son mode ; soir : aucun menu du jour). */
function composantsConcernes(etat, fiche) {
  if (fiche.service !== 'midi' || fiche.mode === 'hors_menu' || !aMenuDuJour(fiche.date)) return [];
  return Object.values(etat.composants ?? {}).filter((c) => c.date === fiche.date && c.attribue
    && (fiche.mode === 'choix_libre' || (fiche.mode === 'menu_fixe' && c.menu === Number(fiche.menuFixe))));
}

/**
 * Alertes allergènes du jour : une entrée par fiche active portant un texte d'allergie, avec les composants
 * concernés et leur statut. L'allergie d'une fiche (groupe compris) reste visible tant que la fiche est active.
 * @returns {{ficheId:string, numero:string, service:string, allergies:string, composants:object[], adaptations:object[]}[]}
 */
export function alertesAllergenes(etat, date) {
  return Object.values(etat.fiches ?? {})
    .filter((f) => f.statut === 'active' && f.date === date && String(f.allergies ?? '').trim() !== '')
    .map((f) => ({
      ficheId: f.id, numero: f.numero, service: f.service, allergies: f.allergies,
      composants: composantsConcernes(etat, f).map((c) => {
        const s = statutAllergenes(etat, c);
        return { composantId: c.id, nom: c.nom, statut: s.statut, liste: s.liste };
      }),
      adaptations: f.adaptations ?? [],
    }));
}
