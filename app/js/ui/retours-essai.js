// Retours d'essai : stockage local à l'appareil, HORS de l'état et de la sauvegarde. Rien n'est envoyé.

import { VERSION_APP } from '../version.js';
import { horodatageLocal } from './format.js';

const CLE = 'sanji-retours-essai';
const MAX_RETOURS = 30;
const DUREE_MAX_MS = 14 * 24 * 3600 * 1000; // noms et allergies d'une fiche ne restent pas plus de deux semaines
let memoire = [];
let repli = false; // le stockage local a refusé une écriture : la mémoire fait foi

function stockage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function lireRetours() {
  const s = stockage();
  if (!s || repli) return [...memoire];
  try {
    const liste = JSON.parse(s.getItem(CLE) ?? '[]');
    return Array.isArray(liste) ? liste : [];
  } catch { return [...memoire]; }
}

function ecrire(liste) {
  memoire = liste;
  try { stockage()?.setItem(CLE, JSON.stringify(liste)); } catch { repli = true; }
}

/** Ajoute un retour en tête ; `type` : 'menu' | 'fiche'. Renvoie le retour noté. */
export function noterRetour({ type, lu, final, remarque }) {
  const retour = { type, h: horodatageLocal(new Date()), version: VERSION_APP, lu, final, ...(remarque ? { remarque } : {}) };
  const limite = Date.now() - DUREE_MAX_MS;
  const recents = lireRetours().filter((r) => Date.parse(r.h) >= limite);
  ecrire([retour, ...recents].slice(0, MAX_RETOURS));
  return retour;
}

export function effacerRetours() {
  memoire = [];
  repli = false;
  try { stockage()?.removeItem(CLE); } catch { /* rien à retirer */ }
}
