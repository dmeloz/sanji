// Fiches retenues et orthographes retenues (v114). Aucun chiffre venu de l'application : tout vient de la propriétaire.
//  - `etat.noms` : { [nom normalisé de la variante]: { nom: 'nom correct', h } } ; lirePlat remplace la variante par le nom correct.
//  - `etat.fiches_retenues` : { [nom correct normalisé]: { nom?, famille?, categorie?, role?, attribue?, grammage?: {valeur, unite, etat}, h } },
//    la fiche d'un ÉLÉMENT AU POSTE (v118 : jamais d'un plat entier ni d'un élément hors poste, dont la décision reste dans
//    `etat.memoire`), indépendante du menu ; reprise à la création d'un élément du même nom. `nom` = nom d'affichage ;
//    `famille` = clé de famille du lexique. `verbe` (v129) = verbe de mise en place choisi par la propriétaire (liste `VERBES`, ou
//    `aucun`) ; une fiche peut ne retenir que lui. `attribue` (vrai) ne s'écrit et ne se lit qu'en menu 2.

import { normaliser } from './etat.js';
import { CATEGORIE, ETAT_POIDS, ROLE, UNITE } from './statuts.js';

export const NOM_MAX = 60;
/** Plafond d'entrées de chaque collection (le surplus est écarté à l'import, l'écriture d'une 501e est ignorée). */
export const FICHES_MAX = 500;
/** Verbes de mise en place proposés (vocabulaire général, sans chiffre). `aucun` = la ligne n'affiche aucun verbe. */
export const VERBES = Object.freeze(['Cuire', 'Sauter', 'Rôtir', 'Blanchir', 'Éplucher', 'Tailler', 'Mixer', 'Réduire', 'Pocher', 'Gratiner', 'Braiser', 'Griller']);
export const AUCUN_VERBE = 'aucun';
export const verbeValide = (v) => v === AUCUN_VERBE || VERBES.includes(v);
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

/** Nom d'affichage nettoyé : sans caractère de contrôle, espaces réduits, 60 caractères au plus ; '' si inutilisable. */
export function nomNettoye(brut) {
  const nom = typeof brut === 'string' ? brut.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() : '';
  return nom.length > NOM_MAX ? '' : nom;
}

/** Fiche retenue nettoyée (champs connus et valides seulement), ou null si elle ne retient rien. */
function ficheValide(f) {
  if (!estObjet(f)) return null;
  const s = {};
  if (dans(CATEGORIE, f.categorie) && f.categorie !== 'a_preciser') s.categorie = f.categorie;
  if (dans(ROLE, f.role)) s.role = f.role;
  if (typeof f.attribue === 'boolean') s.attribue = f.attribue;
  if (verbeValide(f.verbe)) s.verbe = f.verbe;
  const g = grammageValide(f.grammage);
  if (g && s.role) s.grammage = g; // une portion n'a de sens que pour un rôle
  if (Object.keys(s).length === 0) return null;
  const nom = nomNettoye(f.nom);
  if (nom !== '') s.nom = nom;
  if (typeof f.famille === 'string' && f.famille.length <= 40 && /^[a-z]+(_[a-z]+)*$/.test(f.famille)) s.famille = f.famille;
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
  // Un élément hors poste n'a pas de fiche (v118) : sa décision vit dans `etat.memoire` (écrite avant, par memoriserAttribution).
  // La fiche, partagée entre menus, garde sa portion et son rôle : seule l'attribution en part ; sans fiche, rien n'est écrit.
  if (champs?.attribue === false) {
    if (Object.hasOwn(etat.fiches_retenues, cle)) {
      delete etat.fiches_retenues[cle].attribue;
      etat.fiches_retenues[cle].h = h;
    }
    return;
  }
  const ajout = ficheValide({ nom, ...champs, h });
  if (!ajout) return; // rien de valide : rien n'est écrit ni évincé
  const existe = Object.hasOwn(etat.fiches_retenues, cle);
  if (!existe) evincerLePlusAncien(etat.fiches_retenues, FICHES_MAX);
  // Régler seulement le verbe ne rajeunit pas la fiche : `h` date sa portion (apprentissage des premières valeurs).
  const seulVerbe = existe && Object.keys(champs).every((k) => k === 'verbe') && etat.fiches_retenues[cle].h;
  etat.fiches_retenues[cle] = { ...(existe ? etat.fiches_retenues[cle] : {}), ...ajout, h: seulVerbe || h };
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

/**
 * Ce qu'un élément réglé apporte à sa fiche (nom d'affichage compris) : catégorie, rôle, famille, et l'attribution en menu 2 seulement.
 * @returns {{nom:string, categorie:string, role?:string, attribue?:boolean, famille?:string}}
 */
export function champsDeComposant(c) {
  return { nom: c.nom, categorie: c.categorie, role: c.role ?? undefined, attribue: c.menu === 2 ? c.attribue : undefined, famille: c.famille ?? undefined };
}

/**
 * Migration (v118) : les éléments d'un ancien `plats_retenus` qui ont une catégorie valide deviennent des fiches d'éléments.
 * Une fiche déjà là n'est jamais écrasée ; l'attribution ne vient que d'un plat du menu 2. Renvoie les seules fiches NOUVELLES.
 */
export function fichesDepuisPlats(brut, existantes) {
  const sortie = {};
  if (!estObjet(brut)) return sortie;
  const place = () => FICHES_MAX - Object.keys(existantes).length - Object.keys(sortie).length;
  for (const plat of Object.values(brut)) {
    if (!estObjet(plat) || !Array.isArray(plat.elements)) continue;
    for (const e of plat.elements.slice(0, 20)) {
      if (place() <= 0) return sortie;
      if (!estObjet(e) || typeof e.nom !== 'string' || !dans(CATEGORIE, e.categorie) || e.categorie === 'a_preciser') continue;
      const cle = cleDeNom(e.nom);
      if (cle === '' || Object.hasOwn(existantes, cle) || Object.hasOwn(sortie, cle)) continue;
      const fiche = ficheValide({ nom: e.nom, categorie: e.categorie, role: e.role, attribue: plat.menu === 2 ? e.attribue : undefined, h: plat.h });
      if (fiche) sortie[cle] = fiche;
    }
  }
  return sortie;
}
