// Listes de référence de l'interface : les 14 allergènes réglementaires et quelques libellés.
// Identifiants sans accent ; aucune donnée de restaurant.

export const ALLERGENES = Object.freeze([
  ['gluten', 'céréales contenant du gluten'],
  ['crustaces', 'crustacés'],
  ['oeufs', 'œufs'],
  ['poissons', 'poissons'],
  ['arachides', 'arachides'],
  ['soja', 'soja'],
  ['lait', 'lait'],
  ['fruits_a_coque', 'fruits à coque'],
  ['celeri', 'céleri'],
  ['moutarde', 'moutarde'],
  ['sesame', 'sésame'],
  ['sulfites', 'sulfites'],
  ['lupin', 'lupin'],
  ['mollusques', 'mollusques'],
]);

export function libelleAllergene(id) {
  return ALLERGENES.find(([cle]) => cle === id)?.[1] ?? String(id);
}

export const LIBELLE_SERVICE = Object.freeze({ midi: 'midi', soir: 'soir' });
export const LIBELLE_MODE = Object.freeze({
  menu_fixe: 'menu fixé',
  choix_libre: 'choix libre avec répartition',
  hors_menu: 'hors menu du jour',
});

/** Libellé court des sources de provenance proposées à la saisie (CALCULE exclu : jamais saisi). */
export const PROVENANCES_SAISIE = Object.freeze(['RESTAURANT_VALIDE', 'STANDARD_BASE', 'SAISI_SERVICE', 'INCONNU']);
