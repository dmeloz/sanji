// Stockage local dans IndexedDB : base « sanji », magasins « etat » (clé unique) et « photos » (clé = date).
// Aucun accès à indexedDB ni à navigator au niveau supérieur : uniquement dans les fonctions.
// Si IndexedDB est indisponible, les fonctions d'état échouent (l'appelant passe en mémoire) ; les photos
// restent en mémoire pour la session.

const NOM_BASE = 'sanji';
const VERSION_IDB = 1;
const MAGASIN_ETAT = 'etat';
const MAGASIN_PHOTOS = 'photos';
const CLE_ETAT = 'principal';

let promesseBase = null;
const photosEnMemoire = new Map();

/** Vrai si le navigateur expose IndexedDB (ne garantit pas que l'ouverture réussira). */
export function stockageDisponible() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function ouvrir() {
  if (promesseBase) return promesseBase;
  promesseBase = new Promise((resoudre, rejeter) => {
    if (!stockageDisponible()) {
      rejeter(new Error("IndexedDB n'est pas disponible sur ce navigateur."));
      return;
    }
    let requete;
    try {
      requete = indexedDB.open(NOM_BASE, VERSION_IDB);
    } catch (erreur) {
      rejeter(erreur);
      return;
    }
    requete.onupgradeneeded = () => {
      const db = requete.result;
      if (!db.objectStoreNames.contains(MAGASIN_ETAT)) db.createObjectStore(MAGASIN_ETAT);
      if (!db.objectStoreNames.contains(MAGASIN_PHOTOS)) db.createObjectStore(MAGASIN_PHOTOS);
    };
    requete.onsuccess = () => {
      const db = requete.result;
      db.onversionchange = () => { db.close(); promesseBase = null; };
      resoudre(db);
    };
    requete.onerror = () => rejeter(requete.error ?? new Error("Ouverture de la base locale impossible."));
    requete.onblocked = () => rejeter(new Error('Base locale bloquée par un autre onglet de l\'application.'));
  });
  promesseBase.catch(() => { promesseBase = null; });
  return promesseBase;
}

/** Exécute une opération dans une transaction et renvoie le résultat de la requête une fois la transaction terminée. */
async function transaction(nomMagasin, mode, operation) {
  const db = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    let requete;
    try {
      const tx = db.transaction(nomMagasin, mode);
      requete = operation(tx.objectStore(nomMagasin));
      tx.oncomplete = () => resoudre(requete?.result);
      tx.onerror = () => rejeter(tx.error ?? new Error('Erreur de stockage local.'));
      tx.onabort = () => rejeter(tx.error ?? new Error('Écriture locale annulée (espace insuffisant ?).'));
    } catch (erreur) {
      rejeter(erreur);
    }
  });
}

/** Demande un stockage persistant si le navigateur le permet. Renvoie true, false, ou null (non disponible). */
export async function demanderPersistance() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) return null;
    if (typeof navigator.storage.persisted === 'function' && await navigator.storage.persisted()) return true;
    if (typeof navigator.storage.persist !== 'function') return null;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Document d'état enregistré, ou null s'il n'y en a pas encore. Rejette si la base est inaccessible. */
export async function chargerEtat() {
  const etat = await transaction(MAGASIN_ETAT, 'readonly', (s) => s.get(CLE_ETAT));
  return etat ?? null;
}

/** Remplace le document d'état. Rejette si l'écriture échoue. */
export async function enregistrerEtat(etat) {
  await transaction(MAGASIN_ETAT, 'readwrite', (s) => s.put(etat, CLE_ETAT));
}

/** Photo du menu d'une date (Blob) ou null. */
export async function lirePhoto(date) {
  try {
    const blob = await transaction(MAGASIN_PHOTOS, 'readonly', (s) => s.get(date));
    return blob ?? photosEnMemoire.get(date) ?? null;
  } catch {
    return photosEnMemoire.get(date) ?? null;
  }
}

/** Enregistre la photo d'une date. Renvoie true si elle est conservée sur l'appareil, false si elle reste en mémoire. */
export async function enregistrerPhoto(date, blob) {
  try {
    await transaction(MAGASIN_PHOTOS, 'readwrite', (s) => s.put(blob, date));
    photosEnMemoire.delete(date);
    return true;
  } catch {
    photosEnMemoire.set(date, blob);
    return false;
  }
}

export async function supprimerPhoto(date) {
  photosEnMemoire.delete(date);
  try {
    await transaction(MAGASIN_PHOTOS, 'readwrite', (s) => s.delete(date));
  } catch {
    // Base inaccessible : la copie en mémoire est déjà retirée.
  }
}

// Accès par clé au magasin « etat », pour les copies de sécurité (sauvegarde-auto.js). La clé de l'état courant
// (« principal ») ne sert qu'à chargerEtat/enregistrerEtat ; les copies ont toutes le préfixe « copie| ».

/** Toutes les clés du magasin « etat ». */
export async function listerCles() {
  return (await transaction(MAGASIN_ETAT, 'readonly', (s) => s.getAllKeys())) ?? [];
}

export async function lireCle(cle) {
  return (await transaction(MAGASIN_ETAT, 'readonly', (s) => s.get(cle))) ?? null;
}

export async function ecrireCle(cle, valeur) {
  await transaction(MAGASIN_ETAT, 'readwrite', (s) => s.put(valeur, cle));
}

export async function supprimerCle(cle) {
  await transaction(MAGASIN_ETAT, 'readwrite', (s) => s.delete(cle));
}
