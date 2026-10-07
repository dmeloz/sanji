// Photo facultative du menu papier : réduite à 1600 px de côté maximum, en JPEG, stockée à part (non exportée).

import { enregistrerPhoto, lirePhoto, supprimerPhoto } from '../stockage.js';

const COTE_MAX = 1600;
const QUALITE = 0.85;
const urls = new Map();

function chargerImage(fichier) {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resoudre(image); };
    image.onerror = () => { URL.revokeObjectURL(url); rejeter(new Error("Image illisible : choisissez une photo (JPEG, PNG, HEIC…).")); };
    image.src = url;
  });
}

/** Réduit une image à `max` px de côté au plus et la renvoie en JPEG (Blob). */
export async function reduireImage(fichier, max = COTE_MAX) {
  const image = await chargerImage(fichier);
  const echelle = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const largeur = Math.max(1, Math.round(image.naturalWidth * echelle));
  const hauteur = Math.max(1, Math.round(image.naturalHeight * echelle));
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  return new Promise((resoudre, rejeter) => {
    toile.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error('Réduction de la photo impossible.'))), 'image/jpeg', QUALITE);
  });
}

/** Adresse locale (blob:) de la photo d'une date, ou null. */
export async function urlPhoto(date) {
  if (urls.has(date)) return urls.get(date);
  const blob = await lirePhoto(date);
  const url = blob ? URL.createObjectURL(blob) : null;
  urls.set(date, url);
  return url;
}

const MORCEAU_BASE64 = 0x8000;

/** Un Blob encodé pour l'API : { media_type: 'image/jpeg', base64 }. Sans FileReader. Rien n'est stocké. */
export async function blobEnBase64(blob) {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += MORCEAU_BASE64) binaire += String.fromCharCode(...octets.subarray(i, i + MORCEAU_BASE64));
  return { media_type: 'image/jpeg', base64: btoa(binaire) };
}

/** La photo d'une date encodée pour l'API : { media_type, base64 }, ou null s'il n'y en a pas. */
export async function photoEnBase64(date) {
  const blob = await lirePhoto(date);
  return blob ? blobEnBase64(blob) : null;
}

function oublier(date) {
  const url = urls.get(date);
  if (url) URL.revokeObjectURL(url);
  urls.delete(date);
}

/** Réduit puis enregistre. Renvoie true si la photo est conservée sur l'appareil, false si elle reste en mémoire. */
export async function importerPhoto(date, fichier) {
  const blob = await reduireImage(fichier);
  const conservee = await enregistrerPhoto(date, blob);
  oublier(date);
  return conservee;
}

export async function retirerPhoto(date) {
  await supprimerPhoto(date);
  oublier(date);
}
