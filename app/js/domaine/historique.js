// Historique des semaines passées (décision du 2026-10-07) : lecture seule, rien n'est écrit ni effacé. Pur : sans DOM.

import { aMenuDuJour, datesDeLaSemaine, lundiDe } from './dates.js';
import { jourOuVide } from './etat.js';

const nombre = (v) => (Number.isFinite(v) ? v : null);
const intitule = (jour, menu) => String(jour.menus?.[menu]?.intitule ?? '').trim();

/** Un jour à menu : intitulés des deux menus, ventes du midi et couverts servis (null si aucune vente saisie). */
function resumeJour(etat, date) {
  const jour = jourOuVide(etat, date);
  const [v1, v2] = [nombre(jour.ventes?.[1]), nombre(jour.ventes?.[2])];
  return {
    date, menu1: intitule(jour, 1), menu2: intitule(jour, 2),
    ventes: { 1: v1, 2: v2 },
    servis: v1 === null && v2 === null ? null : (v1 ?? 0) + (v2 ?? 0),
  };
}

const aUnMenu = (j) => j.menu1 !== '' || j.menu2 !== '';

/**
 * Semaines passées (avant la semaine de `aujourd`) qui ont au moins un menu, de la plus récente à la plus ancienne.
 * `ventesSaisies` : les deux menus de chaque jour à menu ont leurs ventes. `joursSansMenu` : jours du lundi au vendredi sans menu.
 * @returns {{lundi:string, jours:object[], ventesSaisies:boolean, joursSansMenu:number, totalServi:number}[]}
 */
export function historiqueSemaines(etat, aujourd) {
  const courante = lundiDe(aujourd);
  const lundis = new Set(Object.keys(etat.jours ?? {}).map(lundiDe));
  return [...lundis].filter((lundi) => lundi < courante).sort().reverse().map((lundi) => {
    const dates = datesDeLaSemaine(lundi);
    const jours = dates.map((d) => resumeJour(etat, d)).filter(aUnMenu);
    return {
      lundi, jours,
      ventesSaisies: jours.every((j) => j.ventes[1] !== null && j.ventes[2] !== null),
      joursSansMenu: dates.filter((d) => aMenuDuJour(d) && !aUnMenu(resumeJour(etat, d))).length,
      totalServi: jours.reduce((somme, j) => somme + (j.servis ?? 0), 0),
    };
  }).filter((s) => s.jours.length > 0);
}
