// Document d'état unique : création, normalisation, export et import.
// Aucune lecture de l'heure : l'horodatage `h` (ISO) est toujours un argument.

import { ETAT_POIDS } from './statuts.js';

export const APPLICATION = 'sanji-entremetier';
export const SCHEMA = 1;
export const TAILLE_JOURNAL = 2000;

/** Minuscules, sans accents, espaces réduits. Sert de clé de mémoire et de règle. */
export function normaliser(nom) {
  return String(nom ?? '')
    .replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').replace(/[’‘]/g, "'")
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

let compteur = 0;

/** Identifiant « prefixe_compteur+aléa », indépendant de l'heure. */
export function nouvelId(prefixe = 'id') {
  compteur += 1;
  const alea = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
  return `${prefixe}_${compteur.toString(36)}${alea}`;
}

const cloner = (v) => (v === undefined ? v : structuredClone(v));

/** Réglages par défaut d'un jour de semaine (1 à 6) : tous les créneaux libres. */
function semaineTypeVide() {
  const s = {};
  for (let j = 1; j <= 6; j += 1) {
    s[j] = j <= 2 ? { avant_midi: 'libre', apres_midi: 'libre' }
      : { avant_midi: 'libre', apres_midi: 'libre', avant_soir: 'libre' };
  }
  return s;
}

/** Base vide : aucun couvert, aucune recette, aucune production, aucun fournisseur. */
export function etatInitial() {
  return {
    application: APPLICATION,
    schema: SCHEMA,
    reglages: { semaineTypeConfirmee: false, semaineType: semaineTypeVide(), capaciteCreneau: null, margeSecurite: null, dernierExport: null },
    jours: {},
    fiches: {},
    composants: {},
    productions: {},
    regles: {},
    recettes: {},
    fournisseurs: {},
    memoire: {},
    standards: {},
    produits: {},
    // Lectures corrigées par le chef (clé « intitulé normalisé|menu ») et validations reportées.
    lectures: {},
    validations: {},
    journal: [],
  };
}

export function jourVide(date) {
  return {
    date,
    menus: {
      1: { intitule: '', transcriptionValidee: false, composantsValides: false },
      2: { intitule: '', transcriptionValidee: false, composantsValides: false },
    },
    previsions: { 1: { portions: null, h: null }, 2: { portions: null, h: null } },
    creneaux: { avant_midi: null, apres_midi: null, avant_soir: null },
    ventes: { 1: null, 2: null, h: null },
  };
}

export function ficheVide(id) {
  return {
    id, numero: '', date: null, service: 'midi', horaire: '', couverts: 0,
    mode: 'menu_fixe', menuFixe: null, repartition: { 1: 0, 2: 0 }, statutRepartition: 'provisoire',
    allergies: '', remarques: '', statut: 'active', version: 1, historique: [], adaptations: [],
  };
}

export function composantVide(id) {
  return {
    id, date: null, menu: 1, nom: '', categorie: 'a_preciser', attribue: true, valide: false,
    type: 'a_preciser', role: null, produitNom: '', famille: null,
    // `etat` : état du poids de la portion (sec, cru net, cuit). Une donnée enregistrée sans état se lit « cuit ».
    grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '', etat: ETAT_POIDS.cuit },
    etapes: [], recetteId: null, recetteVersion: null, charge: null,
    allergenes: { statut: 'a_confirmer', liste: [], h: null },
    apresService: { surplus: null, rebut: null, note: '' },
  };
}

export function productionVide(id) {
  return {
    id, composantId: null, dateService: null, genre: 'principale', libelle: '',
    jourDecide: null, creneauDecide: null, etat: 'a_faire', cibleAuDemarrage: null,
    quantiteReelle: null, unite: null, hFait: null, instantane: null, decisionEcart: null,
    avantFait: null, // { etat, cibleAuDemarrage } avant le marquage « fait », pour pouvoir l'annuler juste après
  };
}

export function regleVide(id) {
  return { id, nom: '', cle: '', avanceMaxJours: null, limiteUtilisationJours: null, valideLe: null, note: '' };
}

export function recetteVide(id) {
  return {
    id, nom: '', version: 1, valide: false, rendement: { valeur: null, unite: 'g' },
    ingredients: [], allergenes: [], historique: [],
  };
}

export function fournisseurVide(id) {
  return { id, nom: '', delaiJours: null, heureLimite: '', note: '' };
}

export function memoireVide() {
  return { nom: '', attribue: true, type: 'a_preciser', categorie: 'a_preciser', charge: null, parRole: {}, etapes: {} };
}

/** Standard maison d'une famille et d'un rôle : portion par service, avec l'état de son poids. */
export function standardVide() {
  return { valeur: null, unite: 'g', etat: ETAT_POIDS.cuit, h: null };
}

export function suiviProduitVide() {
  return {
    statut: 'a_verifier', quantiteVerifiee: null, besoinAuControle: null, quantiteAcheter: null,
    conditionnement: '', fournisseurId: null, commandeLe: null,
  };
}

/** Lecture d'un jour : le jour enregistré ou un jour vide non enregistré. */
export function jourOuVide(etat, date) {
  return etat.jours[date] ?? jourVide(date);
}

/** Jour enregistré, créé s'il n'existe pas encore. */
export function assurerJour(etat, date) {
  if (!etat.jours[date]) etat.jours[date] = jourVide(date);
  return etat.jours[date];
}

/** Ajoute une ligne au journal (2000 dernières entrées conservées). */
export function ajouterJournal(etat, h, action, detail = '') {
  etat.journal.push({ h, action, detail });
  if (etat.journal.length > TAILLE_JOURNAL) etat.journal.splice(0, etat.journal.length - TAILLE_JOURNAL);
}

/** Chaîne JSON `{application, schema, exporteLe, etat}`. */
export function exporter(etat, h) {
  return JSON.stringify({ application: etat.application ?? APPLICATION, schema: etat.schema ?? SCHEMA, exporteLe: h, etat }, null, 2);
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const aCle = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

/** Complète `valeur` avec les champs absents de `defaut` (récursif sur les objets). */
function fusionner(defaut, valeur) {
  if (estObjet(defaut)) {
    if (!estObjet(valeur)) return cloner(defaut);
    const res = {};
    for (const k of Object.keys(defaut)) res[k] = aCle(valeur, k) ? fusionner(defaut[k], valeur[k]) : cloner(defaut[k]);
    for (const k of Object.keys(valeur)) if (!CLES_INTERDITES.has(k) && !aCle(res, k)) res[k] = valeur[k];
    return res;
  }
  return valeur === undefined ? cloner(defaut) : valeur;
}

function contientTestOnly(valeur) {
  if (Array.isArray(valeur)) return valeur.some(contientTestOnly);
  if (!estObjet(valeur)) return false;
  for (const [k, v] of Object.entries(valeur)) {
    if (k === 'etiquette' && String(v).trim().toUpperCase() === 'TEST_ONLY') return true;
    if (contientTestOnly(v)) return true;
  }
  return false;
}

const COLLECTIONS = {
  jours: jourVide, fiches: ficheVide, composants: composantVide, productions: productionVide,
  regles: regleVide, recettes: recetteVide, fournisseurs: fournisseurVide,
  memoire: () => memoireVide(), produits: () => suiviProduitVide(),
  lectures: () => ({}), validations: () => ({}),
};

/**
 * Lit un fichier d'export. Refuse un autre document, un schéma inconnu et tout fichier portant
 * l'étiquette TEST_ONLY (propriété `etiquette`, à n'importe quel niveau). Complète les champs absents.
 * @param {string} texte
 * @returns {object} l'état complet ; lève une Error en français sinon
 */
export function importer(texte) {
  let doc;
  try { doc = JSON.parse(texte); } catch { throw new Error("Fichier illisible : ce n'est pas un export valide."); }
  if (contientTestOnly(doc)) {
    throw new Error("Import refusé : ce fichier est un jeu de test (étiquette TEST_ONLY), il ne doit jamais entrer dans les données réelles.");
  }
  if (!estObjet(doc) || doc.application !== APPLICATION) {
    throw new Error("Ce fichier n'est pas un export de cette application.");
  }
  if (doc.schema !== SCHEMA) {
    throw new Error(`Version de sauvegarde non prise en charge (schéma ${doc.schema}, attendu ${SCHEMA}).`);
  }
  if (!estObjet(doc.etat)) throw new Error("Export incomplet : l'état est absent.");
  const source = doc.etat;
  const etat = etatInitial();
  etat.reglages = fusionner(etat.reglages, source.reglages);
  for (const [nom, fabrique] of Object.entries(COLLECTIONS)) {
    if (source[nom] === undefined) continue;
    if (!estObjet(source[nom])) throw new Error(`Export corrompu : « ${nom} » est invalide.`);
    for (const id of Object.keys(source[nom])) {
      if (CLES_INTERDITES.has(id)) continue;
      etat[nom][id] = fusionner(fabrique(id), source[nom][id]);
    }
  }
  if (source.standards !== undefined) {
    // { [clé de famille]: { [rôle]: {valeur, unite, etat, h} } } : un état du poids absent se lit « cuit ».
    if (!estObjet(source.standards)) throw new Error('Export corrompu : « standards » est invalide.');
    for (const [cle, roles] of Object.entries(source.standards)) {
      if (CLES_INTERDITES.has(cle) || !estObjet(roles)) continue;
      const retenus = {};
      for (const [role, standard] of Object.entries(roles)) {
        if (CLES_INTERDITES.has(role) || !estObjet(standard)) continue;
        retenus[role] = fusionner(standardVide(), standard);
      }
      etat.standards[cle] = retenus;
    }
  }
  if (source.journal !== undefined) {
    if (!Array.isArray(source.journal)) throw new Error('Export corrompu : « journal » est invalide.');
    etat.journal = source.journal.slice(-TAILLE_JOURNAL);
  }
  return etat;
}
