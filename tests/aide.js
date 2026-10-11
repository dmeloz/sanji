// Outils de construction d'états pour les tests (ce n'est pas un test : pas de suffixe .test.js).
// Les données viennent de tests/jeux/TEST_ONLY-*.js ; rien de tout cela n'existe dans app/.

import {
  ajouterComposant, assurerProductions, creerRecette, definirMenu, definirPrevision, modifierComposant,
  validerRecette,
} from '../app/js/domaine/actions.js';
import { enseignerMot } from '../app/js/domaine/actions-mots.js';
import { etatInitial, suiviProduitVide } from '../app/js/domaine/etat.js';
import { besoinsProduits, cleSuivi } from '../app/js/domaine/produits.js';

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

/** Comme `enseignerMot`, puis l'élément est gardé au poste (en menu 2, une garniture ou une sauce enseignée passe hors poste, et un élément hors poste n'a pas de fiche). */
export function enseignerAuPoste(etat, composantId, categorie, hh) {
  enseignerMot(etat, composantId, categorie, hh);
  modifierComposant(etat, composantId, { attribue: true }, hh);
}

/**
 * Pose un contrôle de produit directement dans l'état, comme le ferait un ancien fichier enregistré (l'action
 * `controlerProduit` n'existe plus, v120) : statut, quantité vérifiée et besoin du moment.
 */
export function poserControleProduit(etat, lundi, cle, unite, statut, quantiteVerifiee) {
  const ligne = besoinsProduits(etat, lundi).lignes.find((l) => l.cle === cle && l.unite === unite);
  if (!ligne) throw new Error(`poserControleProduit : aucune ligne ${cle} (${unite}) pour la semaine ${lundi}`);
  const k = cleSuivi(lundi, cle, unite);
  etat.produits[k] = { ...suiviProduitVide(), ...etat.produits[k], statut, quantiteVerifiee, besoinAuControle: ligne.besoinBrut };
}
