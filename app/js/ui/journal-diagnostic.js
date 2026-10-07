// Journal de diagnostic : stockage local à l'appareil, HORS de l'état et de la sauvegarde. Rien n'est envoyé.
// Note des types d'événements, des itinéraires, des libellés de boutons, des durées, des codes, des messages techniques
// bornés et, depuis l'accord de la propriétaire du 2026-10-07, ce que l'IA a RENDU (texte borné) ; les photos envoyées à
// l'IA ne restent qu'EN MÉMOIRE (3 au plus, jusqu'à la fermeture). Jamais la clé, jamais une saisie, jamais une requête.

import { MAX_CONTENU, MAX_LIBELLE, MAX_TEXTE, nettoyer } from '../domaine/rapport-diagnostic.js';
import { VERSION_APP } from '../version.js';

export { nettoyer };

const CLE = 'sanji-journal-diagnostic';
const MAX_EVENEMENTS = 300;
const DUREE_MAX_MS = 14 * 24 * 3600 * 1000;
const MAX_LIGNES_PILE = 3;
let memoire = [];
let repli = false; // le stockage local a refusé une écriture : la mémoire fait foi
let installe = false;

function stockage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const recents = (liste) => {
  const limite = Date.now() - DUREE_MAX_MS;
  return liste.filter((e) => e && typeof e === 'object' && Date.parse(e.h) >= limite);
};

// La liste vit en mémoire, lue UNE seule fois dans le stockage : un clic ne relit ni ne réécrit 300 événements (micro-blocage
// au tap sur iPhone). L'écriture est regroupée (1 s) et forcée quand l'application passe en arrière-plan.
let charge = false;
let ecriture = null;

function charger() {
  if (charge) return;
  charge = true;
  const s = stockage();
  if (!s) return;
  try {
    const liste = JSON.parse(s.getItem(CLE) ?? '[]');
    if (Array.isArray(liste)) memoire = liste;
  } catch { /* journal illisible : on repart d'un journal vide */ }
}

export function lireEvenements() {
  charger();
  return recents(memoire);
}

function vider() {
  if (ecriture) { clearTimeout(ecriture); ecriture = null; }
  try { stockage()?.setItem(CLE, JSON.stringify(memoire)); } catch { repli = true; }
}

function ecrire(liste) {
  memoire = liste;
  if (ecriture) return;
  ecriture = setTimeout(vider, 1000);
  ecriture?.unref?.();
}

/** Ajoute un événement ; seules les valeurs texte, nombre et booléen sont gardées, bornées. Ne lève jamais. */
export function noter(type, donnees = {}) {
  try {
    const propre = {};
    for (const [cle, v] of Object.entries(donnees ?? {})) {
      const nom = String(cle).replace(/[^A-Za-z0-9_]/g, '').slice(0, 30);
      const valeur = nettoyer(v, cle === 'libelle' ? MAX_LIBELLE : cle === 'contenu' ? MAX_CONTENU : MAX_TEXTE);
      if (nom && nom !== 'h' && nom !== 'type' && valeur !== undefined) propre[nom] = valeur;
    }
    const evenement = { ...propre, h: new Date().toISOString(), type: nettoyer(String(type), 30) };
    ecrire([...lireEvenements(), evenement].slice(-MAX_EVENEMENTS));
  } catch { /* le journal ne doit jamais gêner l'application */ }
}

export function effacerJournal() {
  if (ecriture) { clearTimeout(ecriture); ecriture = null; }
  memoire = [];
  charge = true; // le journal est vide : rien à relire dans le stockage
  repli = false;
  photos.length = 0;
  try { stockage()?.removeItem(CLE); } catch { /* rien à retirer */ }
}

// Photos envoyées à l'IA, gardées EN MÉMOIRE seulement (jamais dans le stockage), pour être jointes au diagnostic.
const MAX_PHOTOS = 3;
const TAILLE_PHOTO_MAX = 800 * 1024;
const photos = [];

/** `type` : 'feuille' | 'fiche'. Les 3 dernières photos sont gardées ; une photo de plus de 800 Ko est ignorée. Ne lève jamais. */
export function garderPhotoPourDiagnostic(type, blob) {
  try {
    if (!blob || typeof blob.size !== 'number' || blob.size === 0 || blob.size > TAILLE_PHOTO_MAX) return;
    photos.push({ type: type === 'fiche' ? 'fiche' : 'feuille', h: new Date().toISOString(), blob });
    while (photos.length > MAX_PHOTOS) photos.shift();
  } catch { /* le diagnostic ne doit jamais gêner l'application */ }
}

/** Copie de la liste (la plus ancienne d'abord). */
export function photosGardees() { return [...photos]; }

const sansChemin = (texte) => String(texte ?? '').replace(/https?:\/\/[^\s)]*\//g, '');

function noterErreur(message, fichier, ligne, pile) {
  const nomFichier = sansChemin(fichier).split('?')[0];
  const lignes = sansChemin(pile).split('\n').slice(0, MAX_LIGNES_PILE).map((l) => l.trim()).join(' | ');
  noter('erreur', { message: String(message ?? ''), fichier: nomFichier ? `${nomFichier}:${Number(ligne) || 0}` : '', pile: lignes });
}

function surClic(evenement) {
  const element = evenement?.target?.closest?.('button, a.btn');
  if (!element) return;
  const libelle = element.textContent || element.getAttribute?.('aria-label') || '';
  noter('clic', { libelle });
}

/** Branche les écouteurs, une seule fois. Ne lève jamais. */
export function installerJournal() {
  if (installe) return;
  installe = true;
  try {
    const fenetre = globalThis.window;
    fenetre.addEventListener('error', (e) => noterErreur(e?.message, e?.filename, e?.lineno, e?.error?.stack));
    fenetre.addEventListener('unhandledrejection', (e) => noterErreur(e?.reason?.message ?? e?.reason, '', 0, e?.reason?.stack));
    fenetre.addEventListener('hashchange', () => noter('navigation', { route: globalThis.location?.hash ?? '' }));
    fenetre.addEventListener('pagehide', vider);
    globalThis.document.addEventListener('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') vider(); });
    fenetre.addEventListener('online', () => noter('reseau', { enLigne: true }));
    fenetre.addEventListener('offline', () => noter('reseau', { enLigne: false }));
    globalThis.document.addEventListener('click', surClic, true);
    let standalone = false;
    try { standalone = globalThis.matchMedia?.('(display-mode: standalone)')?.matches === true || globalThis.navigator?.standalone === true; } catch { /* inconnu */ }
    noter('demarrage', { version: VERSION_APP, standalone, enLigne: globalThis.navigator?.onLine !== false });
  } catch { /* le démarrage ne dépend pas du journal */ }
}
