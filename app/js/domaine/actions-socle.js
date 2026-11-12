// Socle des actions : vérifications communes, fin d'action (journal) et invariants des productions.
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { aMenuDuJour, estDateValide, jourSemaine, semainePassee } from './dates.js';
import { ajouterJournal, nouvelId, productionVide } from './etat.js';
import { regleDe } from './planification.js';
import { MESSAGE_PORTION_TROP_GRANDE, PORTION_MAX_G } from './savoir.js';
import { ETAPE, ETAT_POIDS, PROVENANCE, UNITE } from './statuts.js';

const valeursDe = (enumeration) => Object.values(enumeration);
const STATUTS_SAISIE = valeursDe(PROVENANCE).filter((s) => s !== 'CALCULE');
export const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

// ---------------------------------------------------------------- vérifications

export function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}
export function verifierDate(date) {
  if (!estDateValide(date)) throw new Error(`Date invalide : « ${date} » (format attendu AAAA-MM-JJ).`);
}
function verifierMenu(menu) {
  if (menu !== 1 && menu !== 2) throw new Error('Le menu doit être 1 ou 2.');
}
export function verifierMenuDuJour(date, menu) {
  verifierDate(date);
  verifierMenu(menu);
  if (!aMenuDuJour(date)) throw new Error("Pas de menu du jour ce jour-là : les menus existent du lundi au vendredi.");
}
export function verifierEntierOuNul(valeur, nom, minimum = 0) {
  if (valeur === null) return null;
  if (!Number.isInteger(valeur) || valeur < minimum) throw new Error(`${nom} : entier supérieur ou égal à ${minimum} attendu (ou vide).`);
  return valeur;
}
export function verifierQuantiteOuNul(valeur, nom) {
  if (valeur === null) return null;
  if (!Number.isFinite(valeur) || valeur < 0) throw new Error(`${nom} : nombre positif ou nul attendu (ou vide).`);
  return valeur;
}
export function verifierDans(valeur, enumeration, nom) {
  if (!valeursDe(enumeration).includes(valeur)) throw new Error(`${nom} : valeur inconnue « ${valeur} ».`);
  return valeur;
}
export function cleSure(cle) {
  if (cle === '' || CLES_INTERDITES.has(cle)) throw new Error(`Clé interdite : « ${cle} ».`);
  return cle;
}

export function exiger(collection, id, libelle) {
  if (!Object.hasOwn(collection, id)) throw new Error(`${libelle} introuvable : ${id}`);
  return collection[id];
}
export const exigerComposant = (etat, id) => exiger(etat.composants, id, 'Composant');
export const exigerProduction = (etat, id) => exiger(etat.productions, id, 'Production');
export const exigerFiche = (etat, id) => exiger(etat.fiches, id, 'Fiche');
export const exigerRecette = (etat, id) => exiger(etat.recettes, id, 'Recette');

/**
 * Garde-fou sur le temps : une semaine passée (lundi avant celui de la semaine de `h`) ne se modifie plus par erreur.
 * Ne s'applique qu'aux menus, composants, prévisions et fiches de fonction ; ventes, « fait » et corrections restent possibles.
 */
export function verifierSemaineModifiable(date, h) {
  if (estDateValide(date) && semainePassee(date, h.slice(0, 10))) throw new Error('Cette semaine est passée : elle ne peut plus être modifiée.');
}

export function verifierLundi(lundi) {
  verifierDate(lundi);
  if (jourSemaine(lundi) !== 1) throw new Error(`« ${lundi} » n'est pas un lundi.`);
}

/**
 * Valide et copie un grammage { valeur, unite, statut, source, etat }. `etat` est l'état du poids de la portion
 * (sec, cru_net, cuit) ; absent, il se lit « cuit » (sens d'une quantité servie, comme les données déjà enregistrées).
 */
export function normaliserGrammage(g, existant) {
  if (g === null || typeof g !== 'object') throw new Error('Grammage invalide.');
  const res = { ...existant, ...g };
  if (res.valeur !== null && (!Number.isFinite(res.valeur) || res.valeur <= 0)) {
    throw new Error('Le grammage doit être un nombre strictement positif (ou vide).');
  }
  verifierDans(res.unite, UNITE, 'Unité du grammage');
  if (res.unite === 'g' && res.valeur !== null && res.valeur > PORTION_MAX_G) throw new Error(MESSAGE_PORTION_TROP_GRANDE);
  if (!STATUTS_SAISIE.includes(res.statut)) throw new Error(`Provenance du grammage inconnue : « ${res.statut} ».`);
  const etat = res.etat ?? ETAT_POIDS.cuit;
  verifierDans(etat, ETAT_POIDS, 'État du poids');
  return { valeur: res.valeur, unite: res.unite, statut: res.statut, source: String(res.source ?? ''), etat };
}

/** Valide une liste d'étapes : étape connue et unique, coefficient > 0 (sortie / entrée), gain réservé à la cuisson. */
export function normaliserEtapes(etapes) {
  if (!Array.isArray(etapes)) throw new Error('La liste des étapes est invalide.');
  const vues = new Set();
  return etapes.map((e) => {
    verifierDans(e.etape, ETAPE, "Étape");
    if (vues.has(e.etape)) throw new Error(`Étape en double : « ${e.etape} » ne peut figurer qu'une fois (une perte ne se compte jamais deux fois).`);
    vues.add(e.etape);
    if (!Number.isFinite(e.coefficient) || e.coefficient <= 0) {
      throw new Error(`Le coefficient de ${e.etape} doit être strictement positif (sortie ÷ entrée) : zéro et les valeurs négatives sont refusés.`);
    }
    if (e.coefficient > 1 && e.etape !== 'cuisson') {
      throw new Error(`Le coefficient de ${e.etape} ne peut pas dépasser 1 : seul un gain de cuisson (absorption) augmente la quantité.`);
    }
    const statut = e.statut ?? 'INCONNU';
    if (!STATUTS_SAISIE.includes(statut)) throw new Error(`Provenance de l'étape ${e.etape} inconnue : « ${statut} ».`);
    return { etape: e.etape, coefficient: e.coefficient, statut, source: String(e.source ?? '') };
  });
}

/** Libellé d'une production avec le nom COURANT de son composant (le libellé enregistré garde l'ancien nom après un renommage). */
export function libelleCourant(etat, p) {
  const c = etat.composants[p.composantId];
  if (!c) return p.libelle;
  if (p.genre === 'principale') return c.nom;
  if (p.genre === 'complement') return `Complément : ${c.nom}`;
  return p.libelle;
}

export function terminer(etat, h, action, detail, valeur) {
  ajouterJournal(etat, h, action, detail);
  assurerProductions(etat, h);
  return valeur;
}

// ---------------------------------------------------------------- invariants

/**
 * Invariant : tout composant attribué ET validé a exactement une production « principale » ; un composant non
 * attribué, non validé ou supprimé perd ses productions non faites. Les productions faites ne sont jamais touchées.
 * Si la règle du composant a au moins deux étapes : une production « preparatoire » par étape sauf la dernière
 * (la principale est la finition). `h` (facultatif) sert à journaliser ce qu'un changement de règle retire.
 * Aucune étape n'est créée pour un composant dont la finition est faite ou dont le service est passé : la date du
 * jour vient de `h` ; sans lui, seule la finition faite compte.
 */
export function assurerProductions(etat, h = null) {
  const jour = (typeof h === 'string' && /^\d{4}-\d{2}-\d{2}/.test(h) ? h.slice(0, 10) : null);
  for (const p of Object.values(etat.productions)) {
    const c = etat.composants[p.composantId];
    if (p.etat !== 'fait' && (!c || !c.attribue || !c.valide)) delete etat.productions[p.id];
    else if (p.etat !== 'fait' && c) p.dateService = c.date;
  }
  for (const c of Object.values(etat.composants)) {
    if (!c.attribue || !c.valide) continue;
    const principales = Object.values(etat.productions).filter((p) => p.composantId === c.id && p.genre === 'principale');
    if (principales.length === 0) {
      const id = nouvelId('prod');
      etat.productions[id] = { ...productionVide(id), composantId: c.id, dateService: c.date, libelle: c.nom };
    } else {
      for (const extra of principales.slice(1)) if (extra.etat !== 'fait') delete etat.productions[extra.id];
    }
    assurerEtapes(etat, c, h, jour);
  }
  return etat;
}

/** Productions d'étapes d'un composant selon sa règle (idempotent ; une étape faite n'est jamais supprimée). */
function assurerEtapes(etat, c, h, jour = null) {
  const etapes = regleDe(etat, c)?.etapes ?? [];
  const actives = etapes.length >= 2 ? etapes : [];
  const avantFinition = actives.slice(0, -1);
  const finition = actives.length > 0 ? actives[actives.length - 1] : null;
  const retires = [];
  const vues = new Set();
  for (const p of Object.values(etat.productions)) {
    if (p.composantId !== c.id) continue;
    if (p.genre === 'principale') {
      if (p.etat !== 'fait') { p.etapeCle = finition?.cle ?? null; p.ordre = finition ? actives.length - 1 : null; }
      continue;
    }
    if (p.genre !== 'preparatoire' || !p.etapeCle) continue;
    const i = avantFinition.findIndex((x) => x.cle === p.etapeCle);
    if (i < 0 || vues.has(p.etapeCle)) {
      if (p.etat !== 'fait') { retires.push(p.libelle); delete etat.productions[p.id]; }
      continue;
    }
    vues.add(p.etapeCle);
    p.ordre = i;
    if (p.etat !== 'fait') p.libelle = `${avantFinition[i].libelle} : ${c.nom}`;
  }
  const finie = Object.values(etat.productions).some((p) => p.composantId === c.id && p.genre === 'principale' && p.etat === 'fait');
  const passe = jour !== null && c.date < jour;
  avantFinition.forEach((x, i) => {
    if (vues.has(x.cle) || finie || passe) return;
    const id = nouvelId('prod');
    etat.productions[id] = {
      ...productionVide(id), composantId: c.id, dateService: c.date, genre: 'preparatoire', libelle: `${x.libelle} : ${c.nom}`,
      etapeCle: x.cle, ordre: i,
    };
  });
  if (retires.length > 0 && h) {
    ajouterJournal(etat, h, 'etapesRetirees', `${c.nom} : étape retirée de la règle de préparation : ${retires.join(', ')}`);
  }
}
