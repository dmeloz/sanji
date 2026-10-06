// Montre interne du harness : une horloge injectable et la logique « ce créneau est-il déjà passé ? ».
// Le domaine ne connaît pas l'heure ; le harness la lui fournit par une fonction d'exclusion. Les heures de fin de
// créneau sont des RÉGLAGES de la propriétaire (`bornes`) : aucune valeur n'est fixée ici. Sans borne pour un créneau,
// il n'est jamais exclu (comportement d'avant l'horloge).

import { CRENEAU } from '../domaine/statuts.js';
import { CODES, ErreurHarness } from './contrats.js';

const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const deux = (n) => String(n).padStart(2, '0');

/** Heure locale « AAAA-MM-JJTHH:MM:SS » (sans Z), comme `maintenant()` de magasin.js. */
export function formaterLocal(date) {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}T${deux(date.getHours())}:${deux(date.getMinutes())}:${deux(date.getSeconds())}`;
}

/**
 * Horloge : `source()` renvoie un `Date`. Injecter une source fixe dans les tests ; en production la source par défaut
 * est l'heure de l'appareil.
 * @param {() => Date} [source]
 */
export function creerHorloge(source = () => new Date()) {
  return Object.freeze({
    maintenant: () => formaterLocal(source()),
    aujourdhui: () => formaterLocal(source()).slice(0, 10),
    heure: () => formaterLocal(source()).slice(11, 16),
  });
}

/** Horloge arrêtée sur un instant « AAAA-MM-JJTHH:MM[:SS] » (tests, rejeu). */
export function horlogeFixe(instant) {
  const [date, heure = '00:00:00'] = instant.split('T');
  const [a, m, j] = date.split('-').map(Number);
  const [hh, mm, ss = 0] = heure.split(':').map(Number);
  return creerHorloge(() => new Date(a, m - 1, j, hh, mm, ss));
}

/**
 * Valide les bornes de fin de créneau : `{ avant_midi?: 'HH:MM', apres_midi?: 'HH:MM', avant_soir?: 'HH:MM' }`.
 * @returns {object|null} les bornes (copie gelée) ou null si absentes
 */
export function verifierBornes(bornes) {
  if (bornes === null || bornes === undefined) return null;
  if (typeof bornes !== 'object' || Array.isArray(bornes)) throw new ErreurHarness(CODES.ENTREE_INVALIDE, 'Bornes de créneaux : objet attendu.');
  const connus = Object.values(CRENEAU);
  for (const [creneau, heure] of Object.entries(bornes)) {
    if (!connus.includes(creneau)) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `Bornes de créneaux : créneau inconnu « ${creneau} ».`);
    if (typeof heure !== 'string' || !FORMAT_HEURE.test(heure)) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `Bornes de créneaux : heure « ${heure} » invalide (HH:MM attendu).`);
  }
  return Object.freeze({ ...bornes });
}

/**
 * Vrai si le créneau est terminé à l'instant `maintenant` : un jour passé, ou aujourd'hui à partir de l'heure de fin.
 * Sans borne pour ce créneau, jamais passé.
 * @param {object|null} bornes
 * @param {string} date AAAA-MM-JJ
 * @param {string} creneau
 * @param {string} maintenant « AAAA-MM-JJTHH:MM[:SS] »
 */
export function creneauPasse(bornes, date, creneau, maintenant) {
  const fin = bornes?.[creneau];
  if (!fin) return false;
  const jour = maintenant.slice(0, 10);
  if (date < jour) return true;
  return date === jour && maintenant.slice(11, 16) >= fin;
}

/** Fonction `(date, creneau) => boolean` attendue par `suggererCreneau`, le validateur et les commandes. */
export function exclusionDuPasse(horloge, bornes) {
  if (!horloge || !bornes) return null;
  return (date, creneau) => creneauPasse(bornes, date, creneau, horloge.maintenant());
}
