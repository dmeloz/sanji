// Fiches retenues et orthographes retenues (v114). Aucun chiffre venu de l'application : tout vient de la propriétaire.
//  - `etat.noms` : { [nom normalisé de la variante]: { nom: 'nom correct', h } } ; lirePlat remplace la variante par le nom correct.
//  - `etat.fiches_retenues` : { [nom correct normalisé]: { categorie?, role?, attribue?, grammage?: {valeur, unite, etat}, h } },
//    indépendante du menu ; reprise à la création d'un élément du même nom. `attribue` ne s'écrit et ne se lit qu'en menu 2
//    (le menu 1 est entièrement au poste, sauf exception retenue par nom et par menu dans `etat.memoire`).

import { normaliser } from './etat.js';
import { CATEGORIE, ETAT_POIDS, ROLE, UNITE } from './statuts.js';

export const NOM_MAX = 60;
/** Plafond d'entrées de chaque collection (le surplus est écarté à l'import, l'écriture d'une 501e est ignorée). */
export const FICHES_MAX = 500;
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const horodatage = (h) => (typeof h === 'string' && !Number.isNaN(Date.parse(h)) ? h : null);
const dans = (enumeration, v) => typeof v === 'string' && Object.hasOwn(enumeration, v);

/** Clé d'un nom (normalisé) ; chaîne vide si le nom ne peut pas servir de clé (vide, trop long, clé dangereuse). */
export function cleDeNom(nom) {
  const cle = normaliser(nom);
  return cle === '' || cle.length > NOM_MAX || CLES_INTERDITES.has(cle) ? '' : cle;
}

/** Grammage retenu valide { valeur > 0, unite, etat }, ou null. */
export function grammageValide(g) {
  if (!estObjet(g) || !Number.isFinite(g.valeur) || g.valeur <= 0 || !dans(UNITE, g.unite)) return null;
  return { valeur: g.valeur, unite: g.unite, etat: dans(ETAT_POIDS, g.etat) ? g.etat : ETAT_POIDS.cuit };
}

/** Fait de la place pour une entrée de plus : retire la plus ancienne (au `h` le plus ancien, un `h` absent est le plus ancien). */
export function evincerLePlusAncien(objet, max) {
  const cles = Object.keys(objet);
  if (cles.length < max) return;
  const age = (c) => objet[c]?.h ?? '';
  const [ancienne] = cles.sort((a, b) => (age(a) < age(b) ? -1 : age(a) > age(b) ? 1 : 0));
  delete objet[ancienne];
}

/** Fiche retenue nettoyée (champs connus et valides seulement), ou null si elle ne retient rien. */
function ficheValide(f) {
  if (!estObjet(f)) return null;
  const s = {};
  if (dans(CATEGORIE, f.categorie) && f.categorie !== 'a_preciser') s.categorie = f.categorie;
  if (dans(ROLE, f.role)) s.role = f.role;
  if (typeof f.attribue === 'boolean') s.attribue = f.attribue;
  const g = grammageValide(f.grammage);
  if (g && s.role) s.grammage = g; // une portion n'a de sens que pour un rôle
  if (Object.keys(s).length === 0) return null;
  return { ...s, h: horodatage(f.h) };
}

/** Fiches importées : clé canonique (nom normalisé), champs valides, 500 au plus. Le reste est écarté. */
export function fichesValides(brut) {
  const sortie = {};
  if (!estObjet(brut)) return sortie;
  for (const [cle, f] of Object.entries(brut)) {
    if (Object.keys(sortie).length >= FICHES_MAX) break;
    const fiche = cleDeNom(cle) === cle ? ficheValide(f) : null;
    if (fiche) sortie[cle] = fiche;
  }
  return sortie;
}

/** Orthographes importées : variante canonique → nom correct (1 à 60 caractères), jamais une variante qui vaut son propre nom. */
export function nomsValides(brut) {
  const sortie = {};
  if (!estObjet(brut)) return sortie;
  for (const [cle, e] of Object.entries(brut)) {
    if (Object.keys(sortie).length >= FICHES_MAX) break;
    const nom = typeof e?.nom === 'string' ? e.nom.trim() : '';
    if (cleDeNom(cle) !== cle || nom === '' || nom.length > NOM_MAX || cleDeNom(nom) === '' || cleDeNom(nom) === cle) continue;
    sortie[cle] = { nom, h: horodatage(e.h) };
  }
  return sortie;
}

/** Nom correct d'une variante retenue, ou null. */
export function nomCorrect(noms, variante) {
  const cle = cleDeNom(variante);
  return cle !== '' && estObjet(noms) && Object.hasOwn(noms, cle) ? noms[cle].nom : null;
}

/** Fiche retenue d'un nom (le nom est d'abord ramené à son orthographe correcte), ou null. */
export function ficheDe(etat, nom) {
  const cle = cleDeNom(nomCorrect(etat?.noms, nom) ?? nom);
  return cle !== '' && estObjet(etat?.fiches_retenues) && Object.hasOwn(etat.fiches_retenues, cle) ? etat.fiches_retenues[cle] : null;
}

/**
 * Ce que la fiche retenue apporte à la lecture d'un nom, au format de la mémoire maison ({categorie?, attribue?}), ou null.
 * `attribue` seulement en menu 2 (voir l'en-tête).
 */
export function ficheEnMemoire(fiches, nom, menu) {
  const cle = cleDeNom(nom);
  const f = cle !== '' && estObjet(fiches) && Object.hasOwn(fiches, cle) ? fiches[cle] : null;
  if (!f || !f.categorie) return null;
  return typeof f.attribue === 'boolean' && menu === 2 ? { categorie: f.categorie, attribue: f.attribue } : { categorie: f.categorie };
}

/**
 * Écrit (fusionne) ce que la propriétaire vient de régler pour un nom. Les champs absents ou invalides ne changent rien.
 * Une collection pleine n'accepte plus de nouveau nom (rien ne casse : le geste lui-même réussit).
 */
export function retenirFiche(etat, nom, champs, h) {
  const cle = cleDeNom(nom);
  if (cle === '') return;
  if (!estObjet(etat.fiches_retenues)) etat.fiches_retenues = {};
  const ajout = ficheValide({ ...champs, h });
  if (!ajout) return; // rien de valide : rien n'est écrit ni évincé
  const existe = Object.hasOwn(etat.fiches_retenues, cle);
  if (!existe) evincerLePlusAncien(etat.fiches_retenues, FICHES_MAX);
  etat.fiches_retenues[cle] = { ...(existe ? etat.fiches_retenues[cle] : {}), ...ajout, h };
}

/**
 * Reprend la fiche retenue sur un élément qui vient d'être créé (jamais sur un existant : une correction du plat ou une
 * valeur déjà posée passe devant). Pose rôle et portion ; catégorie et attribution passent par la lecture (`ficheEnMemoire`).
 * @returns {boolean} vrai si quelque chose a été posé
 */
export function reprendreFiche(etat, c, roleParDefaut = false) {
  const f = ficheDe(etat, c.nom);
  if (!f) return false;
  let pose = false;
  // Le rôle réglé remplace seulement un rôle posé par DÉFAUT par le savoir (`roleParDefaut`), jamais un rôle explicite.
  if (f.role && (roleParDefaut || !c.role) && c.role !== f.role) { c.role = f.role; pose = true; }
  // La portion retenue vaut pour le rôle où elle a été réglée : un rôle explicite différent ne la partage pas.
  const memeRole = !c.role || !f.role || c.role === f.role;
  if (f.grammage && !(c.grammage?.valeur > 0) && memeRole) {
    c.grammage = { ...f.grammage, statut: 'SAISI_SERVICE', source: 'fiche retenue du nom (portion réglée par la propriétaire)', repris: true };
    pose = true;
  }
  return pose;
}

/** Reprend la fiche retenue d'un nom sur les éléments de même nom du jour `jour` (AAAA-MM-JJ) et après : jamais les jours passés. */
export function reprendreSurAVenir(etat, nom, jour) {
  const cle = cleDeNom(nom);
  return Object.values(etat.composants).filter((c) => c.date >= jour && cleDeNom(c.nom) === cle).filter((c) => reprendreFiche(etat, c)).length;
}

// ---------------------------------------------------------------- plats retenus (import ; le reste est dans plats-retenus.js)

export const PLATS_MAX = 300;
const CLE_PLAT_MAX = 200;
const ELEMENTS_MAX = 20;

function elementPlatValide(e) {
  if (!estObjet(e) || typeof e.nom !== 'string' || e.nom.trim() === '' || e.nom.length > NOM_MAX) return null;
  if (!Object.hasOwn(CATEGORIE, e.categorie) || e.categorie === 'a_preciser' || typeof e.attribue !== 'boolean') return null;
  const sortie = { nom: e.nom.trim(), categorie: e.categorie, attribue: e.attribue };
  if (typeof e.role === 'string' && Object.hasOwn(ROLE, e.role)) sortie.role = e.role;
  return sortie; // la portion n'est jamais figée dans un plat : elle vient de la fiche retenue du nom (un ancien `grammage` est ignoré)
}

export const INTITULE_MAX = 200;
/** Intitulé d'origine d'un plat : texte sans caractère de contrôle, espaces réduits, 200 caractères au plus ; '' si inutilisable. */
export function intituleNettoye(brut) {
  return typeof brut === 'string' ? brut.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, INTITULE_MAX) : '';
}

/** Plats importés : clé non vide et sans clé dangereuse, 1 à 20 éléments valides (sinon le plat est écarté), 300 au plus. */
export function platsValides(brut) {
  const sortie = {};
  if (!estObjet(brut)) return sortie;
  for (const [cle, p] of Object.entries(brut)) {
    if (Object.keys(sortie).length >= PLATS_MAX) break;
    if (cle === '' || cle.length > CLE_PLAT_MAX || CLES_INTERDITES.has(cle) || !estObjet(p) || !Array.isArray(p.elements)) continue;
    if (p.elements.length === 0 || p.elements.length > ELEMENTS_MAX) continue;
    const elements = p.elements.map(elementPlatValide);
    if (elements.some((e) => e === null)) continue;
    const intitule = intituleNettoye(p.intitule);
    sortie[cle] = { elements, ...(intitule ? { intitule } : {}), menu: p.menu === 1 || p.menu === 2 ? p.menu : null, h: typeof p.h === 'string' && !Number.isNaN(Date.parse(p.h)) ? p.h : null };
  }
  return sortie;
}

