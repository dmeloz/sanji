// Page « Fiches des éléments » (v118) : tri des fiches retenues (`etat.fiches_retenues`, une par élément) en rubriques fixes.
// Fonctions pures : aucune écriture, aucun DOM. Les gestes sont dans actions-fiches.js.

import { normaliser } from './etat.js';
import { CATEGORIES_MOT, choixMotDe } from './mots-retenus.js';
import { ROLES_STANDARD, familleDe, familleParCle, lireNom } from './savoir.js';
import { libelle } from './statuts.js';

/** Rubriques de la page, dans l'ordre d'affichage. Toujours toutes affichées, même vides. */
export const RUBRIQUES = Object.freeze([
  { cle: 'feculents', titre: 'Pâtes et féculents' },
  { cle: 'sauces', titre: 'Sauces' },
  { cle: 'garnitures', titre: 'Légumes et garnitures' },
  { cle: 'produits', titre: 'Produits' },
  { cle: 'autres', titre: 'Autres' },
]);

const RUBRIQUE_DE_CATEGORIE = { feculent: 'feculents', legume: 'garnitures', proteine: 'produits' };

/**
 * Rubrique d'une fiche. Ce que la propriétaire a réglé (catégorie, rôle) décide d'abord : sauce ; féculent (forme de pâtes,
 * risotto, riz, boulgour…) ; légume ou rôle « garniture » ; autre produit, protéine, herbe, composant de recette.
 * Une fiche sans catégorie se lit par la famille retenue ou, à défaut, par le lexique appliqué à son nom ; sinon « Autres ».
 */
export function rubriqueDeFiche(fiche, cle = '') {
  const { categorie, role } = fiche ?? {};
  if (categorie === 'sauce' || role === 'sauce') return 'sauces';
  if (categorie === 'feculent') return 'feculents';
  if (categorie === 'legume' || role === 'garniture') return 'garnitures';
  if (categorie === 'autre' || categorie === 'proteine' || role === 'herbe' || role === 'composant_recette') return 'produits';
  const lu = familleParCle(fiche?.famille)?.categorie ?? lireNom(fiche?.nom ?? cle).categorie;
  return RUBRIQUE_DE_CATEGORIE[lu] ?? (lu === 'sauce' ? 'sauces' : 'autres');
}

/** Nom d'affichage d'une fiche : le nom retenu, sinon sa clé (anciennes fiches). */
export const nomDeFiche = (cle, fiche) => (typeof fiche?.nom === 'string' && fiche.nom !== '' ? fiche.nom : cle);

/** Portion d'une fiche : la sienne, sinon le standard maison de sa famille et de son rôle (réglé depuis la page), sinon null. */
export function portionDeFiche(etat, cle, fiche) {
  if (fiche?.grammage) return fiche.grammage;
  const famille = fiche?.famille ?? familleDe(nomDeFiche(cle, fiche))?.cle;
  const std = famille && fiche?.role ? etat?.standards?.[famille]?.[fiche.role] : null;
  return std?.valeur > 0 ? std : null;
}

/** « 80 g cuit » ; sinon « portion à saisir » quand une portion a un sens (plat principal ou garniture), sinon le genre de la fiche. */
export function resumeDeFiche(fiche, portion = fiche?.grammage) {
  const g = portion;
  if (g) return `${g.valeur} ${g.unite === 'g' ? 'g' : libelle('UNITE', g.unite)} ${libelle('ETAT_POIDS', g.etat)}`;
  if (ROLES_STANDARD.includes(fiche?.role)) return 'portion à saisir';
  const choix = choixMotDe(fiche);
  return choix ? CATEGORIES_MOT[choix].toLowerCase() : '';
}

const auPoste = (fiche) => fiche?.attribue !== false; // garde-fou : une fiche n'existe que pour un élément au poste
const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }) || (a.cle < b.cle ? -1 : 1);

/**
 * Les fiches des éléments au poste (les seuls qui ont une fiche), filtrées par `recherche` (nom, sans casse ni accents), rangées
 * dans les rubriques fixes et triées par nom. `total` ne tient pas compte de la recherche.
 * @returns {{total:number, rubriques:{cle:string, titre:string, fiches:{cle:string, nom:string, resume:string, aSaisir:boolean, fiche:object}[]}[]}}
 */
export function fichesParRubrique(etat, { recherche = '' } = {}) {
  const entrees = Object.entries(etat?.fiches_retenues ?? {}).filter(([, f]) => f && typeof f === 'object' && auPoste(f));
  const motif = normaliser(recherche);
  const lignes = entrees
    .map(([cle, fiche]) => ({ cle, nom: nomDeFiche(cle, fiche), fiche }))
    .filter((l) => motif === '' || normaliser(l.nom).includes(motif))
    .map((l) => ({ ...l, portion: portionDeFiche(etat, l.cle, l.fiche) }))
    .map((l) => ({ ...l, resume: resumeDeFiche(l.fiche, l.portion), aSaisir: !l.portion && ROLES_STANDARD.includes(l.fiche.role) }));
  return {
    total: entrees.length,
    rubriques: RUBRIQUES.map((r) => ({ ...r, fiches: lignes.filter((l) => rubriqueDeFiche(l.fiche, l.cle) === r.cle).sort(parNom) })),
  };
}
