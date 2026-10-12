// Document d'état unique : création, normalisation, export et import.
// Aucune lecture de l'heure : l'horodatage `h` (ISO) est toujours un argument .

import { controleAjustement } from './ajustements.js';
import { fichesDepuisPlats, fichesValides, nomsValides } from './fiches-retenues.js';
import { categorieMotValide, motsValides } from './mots-retenus.js';
import { lignesIgnoreesValides } from './lignes-ignorees.js';
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

/** Clé de la mémoire : nom normalisé et numéro de menu (« nom|1 »). */
export const cleMemoire = (nom, menu) => `${normaliser(nom)}|${menu}`;

/**
 * Entrée de mémoire d'un nom pour un menu : la clé « nom|menu » d'abord ; à défaut l'ancienne clé « nom » (données
 * enregistrées avant la clé par menu), mais seulement si elle ne contredit pas le menu : en menu 2, une protéine
 * attribuée au poste par l'ancienne clé n'est jamais reprise par repli.
 */
export function lireMemoire(memoire, nom, menu) {
  if (!memoire || typeof memoire !== 'object') return null;
  const propre = normaliser(nom);
  if (propre === '') return null;
  const cle = cleMemoire(nom, menu);
  if (Object.hasOwn(memoire, cle)) return memoire[cle];
  if (Object.hasOwn(memoire, propre)) {
    const ancienne = memoire[propre];
    if (menu === 2 && ancienne?.categorie === 'proteine' && ancienne?.attribue === true) return null;
    // L'ancienne clé a pu être écrite depuis le menu 2 : en menu 1, une protéine « non attribuée » n'est pas reprise (le menu 1 est entièrement au poste).
    if (menu === 1 && ancienne?.categorie === 'proteine' && ancienne?.attribue === false) return null;
    return ancienne;
  }
  return null;
}

const NOMS_IMPLICITES = new Set(['sauce a confirmer', 'base de risotto a confirmer']);

/** Vrai pour la sauce implicite d'un menu 1 encore non confirmée (nom d'origine « sauce à confirmer » ou « base de risotto à confirmer »). */
export const estSauceAConfirmer = (c) => c?.categorie === 'sauce' && NOMS_IMPLICITES.has(normaliser(c.nom));

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
    // Mots retenus (clé = mot normalisé) : { categorie: 'forme_pates'|'sauce'|'produit'|'garniture', h }, valables pour tous les plats.
    mots: {},
    // Lignes de feuille écartées par la propriétaire (clé = ligne normalisée) : { ligne, h }. Voir lignes-ignorees.js.
    lignes_ignorees: {},
    // Orthographes retenues (clé = variante normalisée) : { nom: 'nom correct', h }. Voir fiches-retenues.js.
    noms: {},
    // Fiches d'ÉLÉMENTS retenues par nom correct normalisé, indépendantes du menu : { nom?, famille?, categorie?, role?, attribue?, grammage?, h }.
    fiches_retenues: {},
    standards: {},
    // Valeurs changées par la propriétaire sur les standards de base (clé « usage|sujet »).
    ajustements: {},
    produits: {},
    // Onglet Articles : lignes cochées (clé « composant|article » → horodatage).
    articlesCoches: {},
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
      1: { intitule: '', transcriptionValidee: false },
      2: { intitule: '', transcriptionValidee: false },
    },
    previsions: { 1: { portions: null, h: null }, 2: { portions: null, h: null } },
    creneaux: { avant_midi: null, apres_midi: null, avant_soir: null },
    ventes: { 1: null, 2: null, h: null },
    // Total de couverts du midi saisi par le chef : { total, repartition: null | {1,2} (décidée par lui), h } ; null = non saisi.
    couverts: null,
  };
}

/** Un `couverts` importé est-il exploitable ? (entier ≥ 0, répartition de même somme, horodatage texte). */
function couvertsValide(c) {
  if (!estObjet(c) || !Number.isInteger(c.total) || c.total < 0 || typeof c.h !== 'string') return false;
  if (c.repartition === null) return true;
  if (!estObjet(c.repartition)) return false;
  const [a, b] = [c.repartition[1], c.repartition[2]];
  return Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0 && a + b === c.total;
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
    // Étape d'une préparation (clé de l'étape de la règle et rang, 0 = première) ; null hors règle d'étapes.
    etapeCle: null, ordre: null,
  };
}

export function regleVide(id) {
  // `etapes` : [{ cle, libelle, avanceMaxJours }] ordonnées ; la dernière est la finition. Vide = aucune étape.
  return { id, nom: '', cle: '', avanceMaxJours: null, limiteUtilisationJours: null, valideLe: null, note: '', etapes: [] };
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

/**
 * Suivi d'une ligne de besoin. `etatLigne` : 'suggere' (la ligne vient du calcul), 'note' (la propriétaire l'a notée
 * à commander, `besoinAuNote` garde le besoin vu à ce moment, `quantiteNotee` la quantité calculée à ce moment quand aucune
 * quantité n'a été tapée) ou 'retire' ; `historique` garde chaque changement d'état.
 */
export function suiviProduitVide() {
  return {
    statut: 'a_verifier', quantiteVerifiee: null, besoinAuControle: null, quantiteAcheter: null,
    conditionnement: '', fournisseurId: null, commandeLe: null,
    etatLigne: 'suggere', besoinAuNote: null, quantiteNotee: null, historique: [],
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
  validations: () => ({}),
};

/** Copie profonde sans clé dangereuse (`__proto__`, `constructor`, `prototype`). */
function sansClesDangereuses(valeur) {
  if (Array.isArray(valeur)) return valeur.map(sansClesDangereuses);
  if (!estObjet(valeur)) return valeur;
  const res = {};
  for (const [k, v] of Object.entries(valeur)) if (!CLES_INTERDITES.has(k)) res[k] = sansClesDangereuses(v);
  return res;
}

/**
 * Une lecture corrigée (collection `lectures`) : une liste d'éléments ou un objet { elements, ambiguites }, que `lirePlat`
 * accepte telle quelle. Retourne la valeur nettoyée, ou `undefined` si elle n'a aucun de ces deux formats.
 */
function lectureValide(valeur) {
  const estElement = (x) => estObjet(x) && typeof x.nom === 'string' && x.nom.trim() !== '';
  if (Array.isArray(valeur)) return valeur.every(estElement) ? sansClesDangereuses(valeur) : undefined;
  if (!estObjet(valeur) || !Array.isArray(valeur.elements) || !valeur.elements.every(estElement)) return undefined;
  if (valeur.ambiguites !== undefined && !Array.isArray(valeur.ambiguites)) return undefined;
  return sansClesDangereuses(valeur);
}

/** Vrai si l'entrée d'une proposition d'apprentissage écartée est exploitable (voir importer). */
function ecartApprentissageValide(e, aujourdhui) {
  if (!estObjet(e) || e.statut !== 'ecarte' || typeof e.h !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(e.h);
  if (!m || Number.isNaN(Date.parse(e.h))) return false;
  const jour = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (jour.getUTCFullYear() !== +m[1] || jour.getUTCMonth() !== +m[2] - 1 || jour.getUTCDate() !== +m[3]) return false;
  if (aujourdhui !== null && /^\d{4}-\d{2}-\d{2}$/.test(aujourdhui)) {
    const limite = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    if (e.h.slice(0, 10) > limite) return false;
  }
  return e.vus === undefined || (Array.isArray(e.vus) && e.vus.every((v) => typeof v === 'string'));
}

/**
 * Lit un fichier d'export. Refuse un autre document, un schéma inconnu et tout fichier portant
 * l'étiquette TEST_ONLY (propriété `etiquette`, à n'importe quel niveau). Complète les champs absents.
 * @param {string} texte
 * @param {string} [aujourdhui] AAAA-MM-JJ ; sert à écarter les dates futures des propositions écartées (donnée par l'appelant, jamais lue ici ; absente : pas de contrôle de futur)
 * @returns {object} l'état complet ; lève une Error en français sinon
 */
export function importer(texte, aujourdhui = null) {
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
  if (source.lectures !== undefined) {
    if (!estObjet(source.lectures)) throw new Error('Export corrompu : « lectures » est invalide.');
    for (const [cle, lecture] of Object.entries(source.lectures)) {
      if (CLES_INTERDITES.has(cle)) continue;
      const retenue = lectureValide(lecture);
      if (retenue !== undefined) etat.lectures[cle] = retenue;
    }
  }
  for (const [nom, fabrique] of Object.entries(COLLECTIONS)) {
    if (source[nom] === undefined) continue;
    if (!estObjet(source[nom])) throw new Error(`Export corrompu : « ${nom} » est invalide.`);
    for (const id of Object.keys(source[nom])) {
      if (CLES_INTERDITES.has(id)) continue;
      etat[nom][id] = fusionner(fabrique(id), source[nom][id]);
    }
  }
  // Suggestion d'un composant (lecture) : seulement un classement autorisé, sinon retirée.
  for (const c of Object.values(etat.composants)) {
    if (estObjet(c) && aCle(c, 'suggestion') && !categorieMotValide(c.suggestion)) delete c.suggestion;
  }
  // Couverts du midi : jamais une valeur non validée (absent ou invalide = non saisi), copiée sans clé superflue.
  for (const j of Object.values(etat.jours)) {
    const c = j.couverts;
    j.couverts = couvertsValide(c)
      ? { total: c.total, repartition: c.repartition === null ? null : { 1: c.repartition[1], 2: c.repartition[2] }, h: c.h }
      : null;
  }
  // Propositions d'apprentissage écartées (`apprentissage:famille|rôle`) : { statut:'ecarte', h, vus:[ids] }. Une date illisible
  // ou au-delà de demain (la date d'aujourd'hui vient de l'appelant, un jour de tolérance pour le fuseau), un statut autre
  // ou une liste `vus` qui n'en est pas une feraient taire la proposition pour toujours : l'entrée est écartée.
  for (const [cle, entree] of Object.entries(etat.validations)) {
    if (!cle.startsWith('apprentissage:')) continue;
    if (!ecartApprentissageValide(entree, aujourdhui)) delete etat.validations[cle];
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
  if (source.articlesCoches !== undefined && estObjet(source.articlesCoches)) {
    // « composant|article » → horodatage : une clé trop longue, dangereuse ou sans « | », ou une valeur qui n'est pas un horodatage lisible, est écartée.
    for (const [cle, h] of Object.entries(source.articlesCoches)) {
      if (CLES_INTERDITES.has(cle) || cle.length > 300 || !cle.includes('|')) continue;
      if (typeof h === 'string' && !Number.isNaN(Date.parse(h))) etat.articlesCoches[cle] = h;
    }
  }
  // Mots retenus : une entrée dont le classement n'est pas autorisé ou dont le mot est vide, trop long ou non normalisé est écartée.
  if (source.mots !== undefined) {
    if (!estObjet(source.mots)) throw new Error('Export corrompu : « mots » est invalide.');
    etat.mots = motsValides(source.mots);
  }
  // Lignes de feuille écartées : entrées invalides écartées, plafond de 200 (voir lignes-ignorees.js).
  if (source.lignes_ignorees !== undefined) {
    if (!estObjet(source.lignes_ignorees)) throw new Error('Export corrompu : « lignes_ignorees » est invalide.');
    etat.lignes_ignorees = lignesIgnoreesValides(source.lignes_ignorees);
  }
  // Orthographes et fiches retenues : entrées invalides écartées, plafond de 500 (voir fiches-retenues.js).
  if (source.noms !== undefined) {
    if (!estObjet(source.noms)) throw new Error('Export corrompu : « noms » est invalide.');
    etat.noms = nomsValides(source.noms);
  }
  if (source.fiches_retenues !== undefined) {
    if (!estObjet(source.fiches_retenues)) throw new Error('Export corrompu : « fiches_retenues » est invalide.');
    etat.fiches_retenues = fichesValides(source.fiches_retenues);
  }
  // Migration v118 : un ancien `plats_retenus` n'est plus gardé ; ses éléments classés deviennent des fiches d'éléments (sans écraser).
  Object.assign(etat.fiches_retenues, fichesDepuisPlats(source.plats_retenus, etat.fiches_retenues));
  // Migration v118 : un élément hors poste n'a pas de fiche ; sa décision reste dans la mémoire d'attribution (`nom|menu`).
  for (const [cle, f] of Object.entries(etat.fiches_retenues)) {
    if (f.attribue !== false) continue;
    const nom = f.nom ?? cle;
    const cleM = cleMemoire(nom, 2);
    if (!aCle(etat.memoire, cleM)) etat.memoire[cleM] = { ...memoireVide(), nom, attribue: false, categorie: f.categorie ?? 'a_preciser' };
    delete f.attribue; // la fiche garde sa portion et son rôle ; elle ne disparaît que si plus rien n'y est retenu
    if (!f.categorie && !f.role && !f.grammage) delete etat.fiches_retenues[cle];
  }
  if (source.ajustements !== undefined) {
    // { « usage|sujet »: {valeur, unite, le, avant:{valeur, origine}} } : écartée si sans valeur finie ou sans unité, si
    // l'usage n'est pas ajustable, si le sujet n'a pas de standard de base, si l'unité n'est pas celle de ce standard ou si la
    // valeur sort des bornes de ajusterStandard.
    if (!estObjet(source.ajustements)) throw new Error('Export corrompu : « ajustements » est invalide.');
    for (const [cle, a] of Object.entries(source.ajustements)) {
      if (CLES_INTERDITES.has(cle) || !cle.includes('|') || !estObjet(a)) continue;
      if (typeof a.valeur !== 'number' || !Number.isFinite(a.valeur) || typeof a.unite !== 'string' || a.unite === '') continue;
      const barre = cle.indexOf('|');
      const { base, erreur } = controleAjustement(cle.slice(0, barre), cle.slice(barre + 1), a.valeur);
      if (erreur || a.unite !== base.unite) continue;
      const av = estObjet(a.avant) ? a.avant : {};
      etat.ajustements[cle] = {
        valeur: a.valeur, unite: a.unite, le: typeof a.le === 'string' ? a.le : null,
        avant: { valeur: Number.isFinite(av.valeur) ? av.valeur : null, origine: typeof av.origine === 'string' ? av.origine : null },
      };
    }
  }
  if (source.journal !== undefined) {
    if (!Array.isArray(source.journal)) throw new Error('Export corrompu : « journal » est invalide.');
    etat.journal = source.journal.slice(-TAILLE_JOURNAL);
  }
  return etat;
}
