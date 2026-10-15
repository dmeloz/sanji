// Journal de diagnostic : stockage local à l'appareil, HORS de l'état et de la sauvegarde. Rien n'est envoyé.
// Note des types d'événements, des itinéraires, des libellés de boutons, des durées, des codes, des messages techniques
// bornés et, depuis l'accord de la propriétaire du 2026-10-07, ce que l'IA a RENDU (texte borné) ; les photos envoyées à
// l'IA sont gardées sur l'appareil (5 au plus, 14 jours). Jamais la clé, jamais une saisie, jamais une requête.

import { MAX_CONTENU, MAX_LIBELLE, MAX_TEXTE, nettoyer } from '../domaine/rapport-diagnostic.js';
import { enregistrerPhoto, lirePhoto, supprimerPhoto } from '../stockage.js';
import { VERSION_APP } from '../version.js';
import { horodatageLocal } from './format.js';

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
    const evenement = { ...propre, h: horodatageLocal(new Date()), type: nettoyer(String(type), 30) };
    ecrire([...lireEvenements(), evenement].slice(-MAX_EVENEMENTS));
  } catch { /* le journal ne doit jamais gêner l'application */ }
}

export function effacerJournal() {
  if (ecriture) { clearTimeout(ecriture); ecriture = null; }
  memoire = [];
  charge = true; // le journal est vide : rien à relire dans le stockage
  repli = false;
  effacerPhotosDiagnostic().catch(() => {});
  try { stockage()?.removeItem(CLE); } catch { /* rien à retirer */ }
}

// Photos envoyées à l'IA, gardées sur l'appareil (magasin de photos existant, clés « diag| … », registre en localStorage) :
// les 5 dernières, 14 jours, jointes au fichier de diagnostic. Effacées avec « Effacer le journal ».
const CLE_PHOTOS = 'sanji-photos-diagnostic';
const MAX_PHOTOS = 5;
const TAILLE_PHOTO_MAX = 800 * 1024;
let registreMemoire = [];

const photoRecente = (e) => e && typeof e.cle === 'string' && Date.parse(e.h) >= Date.now() - DUREE_MAX_MS;

function lireRegistre() {
  try {
    const liste = JSON.parse(stockage()?.getItem(CLE_PHOTOS) ?? 'null');
    return Array.isArray(liste) ? liste.filter(photoRecente) : registreMemoire.filter(photoRecente);
  } catch { return registreMemoire.filter(photoRecente); }
}

function ecrireRegistre(liste) {
  registreMemoire = liste;
  try { stockage()?.setItem(CLE_PHOTOS, JSON.stringify(liste)); } catch { /* le registre reste en mémoire */ }
}

/** `type` : 'feuille' | 'fiche'. Garde la photo, les 5 dernières, 14 jours ; une photo de plus de 800 Ko est ignorée. Ne lève jamais. */
export async function garderPhotoPourDiagnostic(type, blob) {
  try {
    if (!blob || typeof blob.size !== 'number' || blob.size === 0 || blob.size > TAILLE_PHOTO_MAX) return;
    const maintenant = new Date(); // millisecondes en plus : deux photos dans la même seconde gardent des clés distinctes
    const h = `${horodatageLocal(maintenant)}.${String(maintenant.getMilliseconds()).padStart(3, '0')}`;
    const entree = { cle: `diag|${h}|${type === 'fiche' ? 'fiche' : 'feuille'}`, type: type === 'fiche' ? 'fiche' : 'feuille', h };
    await enregistrerPhoto(entree.cle, blob);
    const toutes = [...lireRegistre(), entree];
    const gardees = toutes.slice(-MAX_PHOTOS);
    for (const e of toutes) if (!gardees.includes(e)) await supprimerPhoto(e.cle);
    ecrireRegistre(gardees);
  } catch { /* le diagnostic ne doit jamais gêner l'application */ }
}

/** Les photos gardées, la plus ancienne d'abord : [{ type, h, blob }]. */
export async function photosGardees() {
  const sortie = [];
  for (const e of lireRegistre()) {
    try {
      const blob = await lirePhoto(e.cle);
      if (blob) sortie.push({ type: e.type, h: e.h, blob });
    } catch { /* photo illisible : ignorée */ }
  }
  return sortie;
}

async function effacerPhotosDiagnostic() {
  const entrees = lireRegistre();
  registreMemoire = [];
  try { stockage()?.removeItem(CLE_PHOTOS); } catch { /* rien à retirer */ }
  for (const e of entrees) await supprimerPhoto(e.cle);
}

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
