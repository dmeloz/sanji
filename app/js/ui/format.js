// Fonctions pures de format et de lecture de saisie (testables sous Node, sans DOM).

import { formaterQuantite } from '../domaine/calcul.js';
import { h } from './dom.js';

const ESPACES = /[\s  ]/g;
const arrondi = (n, chiffres = 4) => Math.round(n * 10 ** chiffres) / 10 ** chiffres;

/** Lit un nombre saisi (virgule française acceptée). Vide -> null ; texte invalide -> Error en français. */
export function parseNombre(texte, libelle = 'valeur') {
  const t = String(texte ?? '').replace(ESPACES, '').replace(',', '.');
  if (t === '') return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) throw new Error(`« ${libelle} » : nombre invalide (« ${String(texte).trim()} »).`);
  return Number(t);
}

/** Entier saisi ; vide -> null ; décimal -> Error en français. */
export function parseEntier(texte, libelle = 'valeur') {
  const n = parseNombre(texte, libelle);
  if (n !== null && !Number.isInteger(n)) throw new Error(`« ${libelle} » : nombre entier attendu.`);
  return n;
}

/** Nombre pour un champ de saisie : virgule française, sans bruit de virgule flottante. */
export function formaterNombre(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(arrondi(n, 6)).replace('.', ',');
}

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** Date locale -> « AAAA-MM-JJTHH:MM:SS » (heure locale, sans Z). */
export function horodatageLocal(d) {
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
    + `T${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

/** « 2026-10-02T14:30:00 » -> « 02/10/2026 à 14:30 ». Chaîne inattendue : renvoyée telle quelle. */
export function formaterHeure(h) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(h ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} à ${m[4]}:${m[5]}` : String(h ?? '');
}

export const pluriel = (n, singulier, plur = `${singulier}s`) => `${n} ${n >= 2 ? plur : singulier}`;

/** Quantité affichable ; sans unité connue, le nombre seul ; sans valeur, « — ». */
export function quantite(valeur, unite) {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return '—';
  return unite ? formaterQuantite(valeur, unite) : String(valeur);
}

const UNITE_POIDS = /^(?:k?g|m?l|cl|dl)$/i;

/**
 * Affichage d'une quantité déjà formatée (« 5 399 g », « 13 pièces », « 3 personnes ») pour un conteneur en police de
 * quantité : le nombre seul reste en chasse fixe. Quatre chiffres : pas de groupement (« 5399 ») ; cinq et plus : le
 * séparateur est un `span.sep-milliers` rendu étroit par le CSS. Une unité de poids reste collée au nombre (`.qte-unite`,
 * plus petite) ; tout autre mot (pièces, portions, personnes…) sort de la police de quantité (`.qte-mot`).
 * Les valeurs ne changent pas : le texte copié reste celui du formatage du domaine.
 * @returns {Array<string|Node>} nœuds à passer à `h(...)` (une chaîne non numérique : un `span.qte-mot`).
 */
export function qteNoeuds(texte) {
  const t = String(texte ?? '');
  const m = /^(\d+(?:[\s\u202f\u00a0]\d{3})*(?:,\d+)?)(?:[\s\u202f\u00a0]+(.+))?$/.exec(t);
  if (!m) return t.length > 1 && /[\p{L}]/u.test(t) ? [h('span', { classe: 'qte-mot' }, t)] : [t];
  const [entier, ...reste] = m[1].split(',');
  const chiffres = entier.replace(/[\s\u202f\u00a0]/g, '');
  const decimales = reste.length > 0 ? `,${reste.join(',')}` : '';
  const sortie = [];
  if (chiffres.length <= 4) sortie.push(chiffres + decimales);
  else {
    const groupes = entier.split(/[\s\u202f\u00a0]/);
    groupes.forEach((g, i) => {
      if (i > 0) sortie.push(h('span', { classe: 'sep-milliers' }, '\u202f'));
      sortie.push(g);
    });
    if (decimales) sortie.push(decimales);
  }
  const unite = m[2];
  if (unite) {
    sortie.push(h('span', { classe: 'sep-unite' }, '\u202f'));
    sortie.push(h('span', { classe: UNITE_POIDS.test(unite) ? 'qte-unite' : 'qte-mot' }, unite));
  }
  return sortie;
}

/** `quantite(valeur, unite)` prête pour un conteneur en police de quantité (voir `qteNoeuds`). */
export const quantiteNoeuds = (valeur, unite) => qteNoeuds(quantite(valeur, unite));

/** Phrase d'avertissement de conservation : « Se garde 2 jours · avance de 3 jours » (sans identifiant technique). */
export function phraseConservation(texteRepere, joursAvance) {
  const t = String(texteRepere ?? '');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} · avance de ${joursAvance} jours`;
}

/** Nom du fichier de sauvegarde pour une date locale. */
export const nomFichierSauvegarde = (date) => `sanji-${date}.json`;

/** Milieu d'une fourchette de coefficients de la base métier. */
export const milieu = (coefMin, coefMax) => arrondi((coefMin + coefMax) / 2, 6);

/** Coefficient (sortie / entrée) -> mode de saisie et valeur : perte en % ou gain en ×. */
export function modeDepuisCoefficient(coefficient) {
  return coefficient > 1
    ? { mode: 'gain', valeur: arrondi(coefficient, 6) }
    : { mode: 'perte', valeur: arrondi((1 - coefficient) * 100, 6) };
}

/** Saisie -> coefficient : perte en % (1 − perte/100) ou gain en ×. */
export function coefficientDepuis(mode, valeur) {
  return mode === 'gain' ? valeur : arrondi(1 - valeur / 100, 10);
}

/** « perte 17,5 % », « gain × 2,5 » ou « sans perte ». */
export function libelleCoefficient(coefficient) {
  const { mode, valeur } = modeDepuisCoefficient(coefficient);
  if (mode === 'gain') return `gain × ${formaterNombre(valeur)}`;
  return valeur === 0 ? 'sans perte' : `perte ${formaterNombre(valeur)} %`;
}
