// Réglages de l'assistant IA (activation, clé d'API, modèle). Ils vivent HORS de l'état de l'application : dans le
// stockage local du navigateur, jamais dans `etat`, donc jamais dans la sauvegarde exportée ni dans le journal.
// Sans stockage disponible, les réglages restent en mémoire pour la session.

import { fournisseurDesactive } from '../harness/fournisseur.js';
import { creerFournisseurWeb, MODELE_PAR_DEFAUT, MODELES } from './fournisseur-web.js';

const CLE_STOCKAGE = 'sanji-assistant-ia';
const MOTIF_CLE = /sk-ant-[A-Za-z0-9_-]+/;

let enMemoire = null;

function stockage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const vides = () => ({ actif: false, cle: '', modele: MODELE_PAR_DEFAUT });

function nettoyer(brut) {
  const base = vides();
  if (!brut || typeof brut !== 'object') return base;
  return {
    actif: brut.actif === true,
    cle: typeof brut.cle === 'string' && MOTIF_CLE.test(brut.cle) ? brut.cle.match(MOTIF_CLE)[0] : '',
    modele: MODELES.some((m) => m.id === brut.modele) ? brut.modele : base.modele,
  };
}

/** Réglages courants, toujours complets et valides. */
export function lireReglagesIA() {
  const s = stockage();
  if (!s) return nettoyer(enMemoire);
  try {
    const texte = s.getItem(CLE_STOCKAGE);
    return nettoyer(texte ? JSON.parse(texte) : null);
  } catch {
    return vides();
  }
}

/**
 * Fusionne `changements` dans les réglages et les enregistre. Une clé collée est nettoyée (espaces, retours, caractères
 * invisibles) ; un texte qui ne ressemble pas à une clé Anthropic est refusé.
 * @param {{actif?:boolean, cle?:string, modele?:string}} changements
 * @returns {{actif:boolean, cle:string, modele:string}}
 */
export function enregistrerReglagesIA(changements) {
  const suivant = { ...lireReglagesIA() };
  if ('actif' in changements) suivant.actif = changements.actif === true;
  if ('modele' in changements) {
    if (!MODELES.some((m) => m.id === changements.modele)) throw new Error('Modèle inconnu.');
    suivant.modele = changements.modele;
  }
  if ('cle' in changements) {
    const texte = String(changements.cle ?? '');
    if (texte.trim() === '') {
      suivant.cle = '';
    } else {
      const trouvee = texte.match(MOTIF_CLE);
      if (!trouvee) throw new Error('Cette clé ne ressemble pas à une clé Anthropic (elle commence par sk-ant-).');
      suivant.cle = trouvee[0];
    }
  }
  enMemoire = suivant;
  const s = stockage();
  if (s) {
    try {
      s.setItem(CLE_STOCKAGE, JSON.stringify(suivant));
    } catch {
      throw new Error("Impossible d'enregistrer les réglages sur cet appareil.");
    }
  }
  return suivant;
}

/** Efface la clé et désactive l'assistant. */
export function effacerReglagesIA() {
  enMemoire = null;
  const s = stockage();
  if (s) {
    try {
      s.removeItem(CLE_STOCKAGE);
    } catch {
      // Une clé qui reste stockée ne doit jamais passer pour effacée.
      throw new Error("Impossible d'effacer la clé sur cet appareil.");
    }
  }
}

/** Vrai si l'assistant est activé ET qu'une clé est enregistrée. */
export const assistantPret = (reglages = lireReglagesIA()) => reglages.actif && reglages.cle !== '';

/** Fournisseur du harness : le modèle choisi si l'assistant est prêt, sinon le fournisseur désactivé (calcul seul). */
export function fournisseurDepuisReglages(reglages = lireReglagesIA(), options = {}) {
  return assistantPret(reglages) ? creerFournisseurWeb({ cle: reglages.cle, modele: reglages.modele, ...options }) : fournisseurDesactive;
}

/** Forme affichable de la clé : seuls les 4 derniers caractères restent visibles. */
export const cleMasquee = (cle) => (cle ? `sk-ant-…${cle.slice(-4)}` : 'aucune clé');
