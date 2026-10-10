// Plats retenus (v114) : la fiche d'un PLAT COMPLET (pâtes, garnitures, sauce), reprise quand le même intitulé revient.
// `etat.plats_retenus[intitulé normalisé] = { elements: [{ nom, categorie, role?, attribue, grammage? }], h }`.
// Rien n'est retenu à l'import : un plat entre ici quand il est VALIDÉ (plus aucun élément « à préciser » ni « à confirmer »)
// à la suite d'un geste de la propriétaire, ou par « Retenir tel quel » à la clôture de la semaine. Une sauce reprise d'un
// plat retenu porte `reprise: true` jusqu'à ce que la propriétaire la reconfirme (elle change souvent d'une semaine à l'autre).

import { lirePlat } from './analyse-menu.js';
import { ajouterJours, jourSemaine, lundiDe } from './dates.js';
import { estSauceAConfirmer, normaliser } from './etat.js';
import { PLATS_MAX, evincerLePlusAncien, intituleNettoye } from './fiches-retenues.js';
export { platsValides } from './fiches-retenues.js';
import { categorieMotValide } from './mots-retenus.js';
import { ROLE } from './statuts.js';

const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);
const CLE_PLAT_MAX = 200;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Clé d'un plat : intitulé complet normalisé, après les orthographes retenues ; vide si inutilisable. */
export function clePlat(etat, intitule) {
  if (typeof intitule !== 'string' || intitule.trim() === '') return '';
  const cle = lirePlat(intitule, 1, { noms: etat?.noms }).normalise;
  return cle === '' || cle.length > CLE_PLAT_MAX || CLES_INTERDITES.has(cle) ? '' : cle;
}

const composantsDuMenu = (etat, date, menu) => Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
const intituleDe = (etat, date, menu) => etat.jours?.[date]?.menus?.[menu]?.intitule ?? '';

/** Ce qui empêche un élément d'être confirmé, ou null s'il l'est. `bloquant` : rien ne peut le confirmer sans la propriétaire. */
export function resteAConfirmer(c) {
  if (estSauceAConfirmer(c)) return { texte: 'sauce à nommer', bloquant: true };
  if (c.reprise) return { texte: `${c.nom} : sauce reprise, à reconfirmer`, bloquant: false };
  if (c.categorie === 'a_preciser') {
    return categorieMotValide(c.suggestion) ? { texte: `${c.nom} : proposé, à confirmer`, bloquant: false } : { texte: `${c.nom} : à préciser`, bloquant: true };
  }
  return null;
}

/** Le plat d'un menu est validé : au moins un élément et aucun à confirmer. */
export function platValide(etat, date, menu) {
  const comps = composantsDuMenu(etat, date, menu);
  return comps.length > 0 && comps.every((c) => resteAConfirmer(c) === null);
}

/** Écrit (ou met à jour) le plat retenu d'un menu s'il est validé. @returns {boolean} vrai si une écriture a eu lieu */
export function retenirPlatSiValide(etat, date, menu, h) {
  if (!platValide(etat, date, menu)) return false;
  const cle = clePlat(etat, intituleDe(etat, date, menu));
  if (cle === '') return false;
  if (!estObjet(etat.plats_retenus)) etat.plats_retenus = {};
  if (!Object.hasOwn(etat.plats_retenus, cle)) evincerLePlusAncien(etat.plats_retenus, PLATS_MAX);
  const elements = composantsDuMenu(etat, date, menu).map((c) => {
    const e = { nom: c.nom, categorie: c.categorie, attribue: c.attribue };
    if (c.role && Object.hasOwn(ROLE, c.role)) e.role = c.role;
    return e;
  });
  const intitule = intituleNettoye(intituleDe(etat, date, menu)); // l'énoncé tel que saisi, pour le montrer
  const avant = etat.plats_retenus[cle];
  if (avant && avant.intitule === intitule && JSON.stringify(avant.elements) === JSON.stringify(elements)) return false;
  etat.plats_retenus[cle] = { elements, intitule, menu, h };
  return true;
}

/** Plat retenu pour l'intitulé d'un menu, ou null. */
export function platRetenuPour(etat, date, menu) {
  const cle = clePlat(etat, intituleDe(etat, date, menu));
  return cle !== '' && estObjet(etat.plats_retenus) && Object.hasOwn(etat.plats_retenus, cle) ? etat.plats_retenus[cle] : null;
}

/**
 * Compositions à créer pour un plat retenu : tous ses éléments. Une sauce que l'intitulé n'écrit pas (la sauce du plat de
 * pâtes, confirmée la fois d'avant) est marquée `reprise` : à reconfirmer.
 */
export function compositionDepuisPlat(propositions, plat, menu) {
  const lus = new Map(propositions.map((p) => [normaliser(p.nom), p]));
  // L'attribution retenue vaut pour le menu où elle a été réglée ; dans l'autre menu, la lecture (ou le menu 1 au poste) décide.
  const attribue = (e) => (plat.menu === menu ? e.attribue : (lus.get(normaliser(e.nom))?.attribue ?? menu === 1));
  return plat.elements.map((e) => ({ nom: e.nom, categorie: e.categorie, attribue: attribue(e), type: 'a_preciser', role: plat.menu === menu ? e.role : undefined,
    reprise: e.categorie === 'sauce' && !lus.has(normaliser(e.nom)) }));
}

/** Pose sur un composant neuf ce que sa proposition venue d'un plat retenu porte (rôle, marque « reprise »). La portion vient de la fiche. */
export function poserDepuisPlat(c, p) {
  if (p.role) c.role = p.role;
  if (p.reprise) c.reprise = true;
}

/**
 * Les plats des `dates` données qui ont des éléments : intitulé, retenu ou non, ce qui reste à confirmer.
 * @returns {{date:string, menu:1|2, intitule:string, retenu:boolean, reste:string[], bloque:boolean}[]}
 */
export function platsDeLaSemaine(etat, dates) {
  const lignes = [];
  for (const date of dates) {
    for (const menu of [1, 2]) {
      const comps = composantsDuMenu(etat, date, menu);
      if (comps.length === 0) continue;
      const intitule = intituleDe(etat, date, menu);
      const cle = clePlat(etat, intitule);
      const restes = comps.map(resteAConfirmer).filter(Boolean);
      lignes.push({ date, menu, intitule, retenu: cle !== '' && Object.hasOwn(etat.plats_retenus ?? {}, cle) && restes.length === 0,
        reste: restes.map((r) => r.texte), bloque: restes.some((r) => r.bloquant) });
    }
  }
  return lignes;
}

/** Le samedi soir (dès cette heure, « HH:MM ») et le dimanche, la semaine se clôt : on propose de retenir ses plats. */
export const HEURE_CLOTURE = '18:00';

/**
 * Rappel « Retenir les plats de la semaine » : présent le samedi dès HEURE_CLOTURE et le dimanche, seulement s'il reste un plat
 * de la semaine non retenu. @returns {{lundi:string, aRetenir:number, retenus:number}|null}
 */
export function rappelCloture(etat, aujourd, heure = null) {
  const jour = jourSemaine(aujourd);
  if (jour !== 7 && !(jour === 6 && typeof heure === 'string' && heure >= HEURE_CLOTURE)) return null;
  const lundi = lundiDe(aujourd);
  const plats = platsDeLaSemaine(etat, [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)));
  // Un plat que rien ne peut retenir sans la propriétaire (sauce sans nom, mot à préciser) ne fait pas durer le rappel.
  const aRetenir = plats.filter((p) => !p.retenu && !p.bloque).length;
  return aRetenir > 0 ? { lundi, aRetenir, retenus: plats.filter((p) => p.retenu).length } : null;
}
