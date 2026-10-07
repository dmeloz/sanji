// Couverts du midi : un total saisi par le chef, une répartition menu 1 / menu 2 calculée (décision du 2026-10-07).
// Pur : ni DOM ni heure courante (l'heure vient de l'appelant).

import { definirCouvertsMidi } from './actions-couverts.js';
import { calculerComposant } from './calcul.js';
import { aMenuDuJour } from './dates.js';
import { jourOuVide } from './etat.js';
import { moyenneVentes, repereVentes } from './points.js';

/** Sans historique de ventes : un tiers des couverts au menu 1, deux tiers au menu 2 (décision du 2026-10-07). */
export const PART_MENU_1_SANS_HISTORIQUE = 1 / 3;
/** Les ventes se saisissent dès 14 h (décision du brief). */
export const HEURE_VENTES_A_SAISIR = '14:00';

const DEFAUT = Object.freeze({ part: PART_MENU_1_SANS_HISTORIQUE, base: 'defaut', jours: [] });

/**
 * Part du menu 1 : moyenne des ventes M1 / (M1 + M2) des 3 derniers mêmes jours de semaine, à condition que les deux menus
 * aient 3 jours de ventes sur les mêmes dates ; sinon le défaut 1/3.
 * @returns {{part:number, base:'historique'|'defaut', jours:string[]}}
 */
export function proportionMenu1(etat, date) {
  const r1 = repereVentes(etat, date, 1);
  const r2 = repereVentes(etat, date, 2);
  const memesDates = r1.length === 3 && r2.length === 3 && r1.every((x, i) => x.date === r2[i].date);
  if (!memesDates) return { ...DEFAUT, jours: [] };
  const [a, b] = [moyenneVentes(r1), moyenneVentes(r2)];
  if (a + b === 0) return { ...DEFAUT, jours: [] };
  return { part: a / (a + b), base: 'historique', jours: r1.map((x) => x.date) };
}

/** Répartition calculée d'un total : m1 arrondi, m2 = le reste (la somme reste égale au total). */
export function repartitionCalculee(etat, date, total) {
  const { part, base, jours } = proportionMenu1(etat, date);
  const m1 = Math.round(total * part);
  return { m1, m2: total - m1, part, base, jours };
}

const nombreOuNul = (v) => (Number.isFinite(v) ? v : null);

/**
 * Couverts du midi d'après les prévisions seules (hors fiches de fonction). `manuel` : répartition décidée par le chef.
 * Certitude : « provisoire » si un total a été saisi, « estimée » pour des prévisions menu par menu, null sans chiffre.
 */
export function couvertsMidiDuJour(etat, date) {
  const jour = jourOuVide(etat, date);
  const [m1, m2] = [1, 2].map((m) => nombreOuNul(jour.previsions?.[m]?.portions));
  const total = m1 === null && m2 === null ? null : (m1 ?? 0) + (m2 ?? 0);
  const couverts = jour.couverts ?? null;
  return {
    total, m1, m2,
    manuel: couverts?.repartition != null,
    certitude: couverts ? 'provisoire' : total === null ? null : 'estimee',
  };
}

/** Vrai dès 14 h un jour à menu tant que les ventes des deux menus ne sont pas saisies. `heure` : « HH:MM ». */
export function ventesASaisir(etat, date, heure) {
  if (typeof heure !== 'string' || !aMenuDuJour(date)) return false;
  if (heure < HEURE_VENTES_A_SAISIR) return false; // « HH:MM » se compare comme du texte
  const v = jourOuVide(etat, date).ventes;
  return !(Number.isFinite(v[1]) && Number.isFinite(v[2]));
}

/**
 * Ce que donnerait une saisie, sans rien enregistrer (travaille sur une copie) : répartition et, par composant du jour,
 * couverts × portion = quantité. L'état d'origine n'est jamais modifié.
 */
export function apercuCouverts(etat, date, total, repartition) {
  const copie = structuredClone(etat);
  const h = new Date(0).toISOString(); // horodatage fictif : la copie est jetée
  const couverts = definirCouvertsMidi(copie, date, { total, repartition }, h);
  const calc = repartitionCalculee(copie, date, total);
  const composants = Object.values(copie.composants)
    .filter((c) => c.date === date && c.attribue && (c.menu === 1 || c.menu === 2))
    .map((c) => {
      const r = calculerComposant(copie, c.id);
      const g = r.dependances.find((d) => d.parametre === 'grammage');
      return {
        menu: c.menu, nom: c.nom, couverts: r.portions.total,
        portion: g ? { valeur: g.valeur, unite: g.unite, etat: g.etat } : null,
        quantite: r.statut === 'CALCULE' ? r.quantiteTravail : null,
        unite: r.statut === 'CALCULE' ? r.uniteTravail : null,
      };
    });
  return { m1: couverts.repartition?.[1] ?? calc.m1, m2: couverts.repartition?.[2] ?? calc.m2,
    base: calc.base, part: calc.part, jours: calc.jours, manuel: couverts.repartition !== null, composants };
}
