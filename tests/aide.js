// Outils de construction d'états pour les tests (ce n'est pas un test : pas de suffixe .test.js).
// Les données viennent de tests/jeux/TEST_ONLY-*.js ; rien de tout cela n'existe dans app/.

import {
  ajouterComposant, assurerProductions, creerRecette, definirMenu, definirPrevision, modifierComposant, validerComposant,
  validerRecette, validerTranscription,
} from '../app/js/domaine/actions.js';
import { etatInitial } from '../app/js/domaine/etat.js';

/** Horodatage de test déterministe, n minutes après un point fixe. */
export const h = (n = 0) => new Date(Date.UTC(2026, 9, 1, 8, n)).toISOString();

export const etatVide = () => etatInitial();

/**
 * Saisit un intitulé neutre pour un menu, sans composant : ces tests posent leurs propres composants.
 * definirMenu crée désormais seul les composants de l'intitulé (section 16 de la conception) ; on retire donc
 * ceux de l'intitulé neutre. Pour tester la génération elle-même, appeler definirMenu directement.
 */
export function menuValide(etat, date, menu, intitule = 'INTITULE_TEST') {
  definirMenu(etat, date, menu, intitule, h());
  validerTranscription(etat, date, menu, h());
  for (const c of Object.values(etat.composants)) if (c.date === date && c.menu === menu) delete etat.composants[c.id];
  assurerProductions(etat);
}

/** Crée un composant validé depuis une définition de jeu ; retourne son identifiant. */
export function composantValide(etat, date, menu, def, surcharge = {}) {
  const d = { ...def, ...surcharge };
  const id = ajouterComposant(etat, date, menu, { nom: d.nom, categorie: d.categorie, type: d.type, attribue: true }, h());
  const champs = { role: d.role, charge: d.charge, grammage: d.grammage, etapes: d.etapes };
  // L'ajout applique le savoir de l'application (un type « à préciser » y devient générique) : le jeu de test impose le sien.
  if (d.type) champs.type = d.type;
  if (d.recetteId) champs.recetteId = d.recetteId;
  modifierComposant(etat, id, champs, h());
  validerComposant(etat, id, h());
  return id;
}

/** Recette de jeu validée. */
export function recetteValidee(etat, def) {
  const id = creerRecette(etat, def, h());
  validerRecette(etat, id, h());
  return id;
}

export function prevision(etat, date, menu, portions) {
  definirPrevision(etat, date, menu, portions, h());
}

/** Identifiant de la production principale d'un composant. */
export function principaleDe(etat, composantId) {
  return Object.values(etat.productions).find((p) => p.composantId === composantId && p.genre === 'principale')?.id;
}

export const copie = (x) => structuredClone(x);
