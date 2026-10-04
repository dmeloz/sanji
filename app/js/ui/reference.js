// Listes de référence de l'interface : les 14 allergènes réglementaires et quelques libellés.
// Identifiants sans accent ; aucune donnée de restaurant.

import { rattachementsDe } from '../domaine/standards-base.js';

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

/** Source légale de la liste des 14 allergènes du référentiel, en une ligne (affichage seul, aucune compatibilité affirmée). */
export function texteSourceAllergenes() {
  const x = rattachementsDe('allergene').find((e) => e.id === 'hygiene.allergenes.liste-14');
  const s = x?.sources?.[0];
  if (!s) return 'Source légale : non précisée.';
  const loi = s.titre.match(/\(([^;)]*)/)?.[1]?.trim() ?? s.titre;
  const ref = s.titre.match(/RS [\d.]+/)?.[0];
  const etat = s.titre.match(/état au [\d.]+/)?.[0];
  return `Source légale de la liste des 14 allergènes : ${[s.organisme, loi, ref, etat].filter(Boolean).join(', ')}${x.portee === 'a_valider_localement' ? ' ; à valider localement' : ''}.`;
}
