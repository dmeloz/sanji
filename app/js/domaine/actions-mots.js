// Actions sur les mots retenus (voir mots-retenus.js). Chaque action journalise en clair.

import { modifierComposant, terminer } from './actions.js';
import { cleMemoire, lireMemoire } from './etat.js';
import { CATEGORIES_MOT, categorieMotValide, champsPourMot, motDe } from './mots-retenus.js';
import { champsDeComposant, retenirFiche } from './fiches-retenues.js';
import { appliquerSavoir } from './savoir.js';

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

/** Classe un élément encore « à préciser » : champs du classement, savoir de l'application, suggestion retirée. */
export function classer(etat, c, categorie, h) {
  const cle = cleMemoire(c.nom, c.menu);
  const existait = Object.hasOwn(etat.memoire, cle);
  modifierComposant(etat, c.id, champsPourMot(categorie, c.menu), h);
  // La mémoire du nom écrite par ce geste porte le mot : « Oublier » la retire, celle posée avant par la propriétaire reste.
  if (!existait && Object.hasOwn(etat.memoire, cle)) etat.memoire[cle].viaMot = motDe(c.nom);
  appliquerSavoir(etat.composants[c.id]);
  delete etat.composants[c.id].suggestion;
}

/**
 * Retient un mot pour tous les plats et toutes les semaines, puis reclasse les éléments encore « à préciser » qui portent
 * ce mot, du jour de `h` à venir (les jours passés ne changent jamais). Une seule écriture : tout ou rien.
 * @returns {{mot:string, reclasses:number}}
 */
export function retenirMot(etat, texte, categorie, h) {
  verifierH(h);
  if (!categorieMotValide(categorie)) throw new Error(`Classement de mot inconnu : « ${categorie} ».`);
  const mot = motDe(texte);
  if (mot === '') throw new Error('Ce mot ne peut pas être retenu (vide, trop long ou seulement des mots de liaison).');
  if (!etat.mots || typeof etat.mots !== 'object') etat.mots = {};
  etat.mots[mot] = { categorie, h };
  const aVenir = Object.values(etat.composants).filter((c) => (c.categorie === 'a_preciser' || c.suggestion) && c.date >= h.slice(0, 10) && motDe(c.nom) === mot
    && lireMemoire(etat.memoire, c.nom, c.menu) === null); // une décision de la propriétaire sur ce nom n'est jamais écrasée
  for (const c of aVenir) classer(etat, c, categorie, h);
  terminer(etat, h, 'retenirMot', `${mot} = ${CATEGORIES_MOT[categorie].toLowerCase()} (${aVenir.length} élément(s) reclassé(s))`, null);
  return { mot, reclasses: aVenir.length };
}

/** Le geste de la fiche : classe l'élément, retient son mot pour tous les plats, reclasse les semaines à venir. */
export function enseignerMot(etat, composantId, categorie, h) {
  verifierH(h);
  const c = etat.composants[composantId];
  if (!c) throw new Error('Composant introuvable.');
  if (!categorieMotValide(categorie)) throw new Error(`Classement de mot inconnu : « ${categorie} ».`);
  classer(etat, c, categorie, h);
  // Le geste est une confirmation de la propriétaire : l'élément entier entre dans la fiche retenue de son nom.
  retenirFiche(etat, c.nom, champsDeComposant(etat.composants[c.id]), h);
  return retenirMot(etat, c.nom, categorie, h);
}

/** Oublie un mot retenu : les éléments déjà classés restent classés ; la mémoire de nom écrite par le geste est retirée. */
export function oublierMot(etat, mot, h) {
  verifierH(h);
  if (!etat.mots || !Object.hasOwn(etat.mots, mot)) throw new Error('Ce mot n\'est pas retenu.');
  delete etat.mots[mot];
  for (const [cle, m] of Object.entries(etat.memoire)) if (m?.viaMot === mot) delete etat.memoire[cle];
  return terminer(etat, h, 'oublierMot', mot, true);
}
