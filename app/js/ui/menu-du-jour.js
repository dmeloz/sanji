// Menu du jour (Production, Articles) : les intitulés saisis du jour, deux lignes compactes, sans lien (la ligne « Services du jour » de Production ouvre la feuille).
// Lecture seule : rien n'est calculé ici, les intitulés viennent de l'état.

import { aMenuDuJour, estOuvert, lundiDe } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { h } from './dom.js';
import { lien } from './elements.js';

const MENUS = [1, 2];

/** Bloc « M1 · … / M2 · … » du jour `date` ; null le week-end, ou un jour fermé sans aucun menu saisi. */
export function blocMenuDuJour(etat, date) {
  if (!aMenuDuJour(date)) return null;
  const { menus } = jourOuVide(etat, date);
  const intitules = MENUS.map((n) => String(menus?.[n]?.intitule ?? '').trim());
  if (intitules.every((t) => t === '')) {
    if (!estOuvert(date)) return null;
    return h('p', { classe: 'mj-vide' }, 'Menu non saisi · ', lien(`#/import/${lundiDe(date)}`, 'Importer ›', 'mj-lien-import'));
  }
  return h('div', { classe: 'mj-bloc', role: 'group', 'aria-label': 'Menu du jour' },
    intitules.map((texte, i) => h('span', { classe: 'mj-ligne' },
      h('span', { classe: 'mj-etiquette' }, `M${MENUS[i]} · `),
      texte ? h('span', { classe: 'mj-intitule' }, texte) : h('span', { classe: 'mj-nonsaisi' }, 'non saisi'))));
}
