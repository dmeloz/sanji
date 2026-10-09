// Production (onglet 2) : la liste de mise en place du jour (refonte minimaliste du 2026-10-09).
// `param` = la date (AAAA-MM-JJ) ; le routeur donne aujourd'hui par défaut. Aucune règle métier ici : les lignes viennent
// de la feuille Jour (`feuilleDuJour`), les gestes de `taches.js`, le corps de la page de `vue-jour.js`.
// En-tête : « Production » + la date, une ligne. On change de jour en glissant (gauche = suivant, droite = précédent) ou par
// les flèches ‹ › ; le dimanche est sauté.

import { jourApresGeste, jourOuvertVoisin, libelleJour } from '../domaine/dates.js';
import { feuilleDuJour } from '../domaine/planification.js';
import { boutonProposerPlanning } from './assistant-planning.js';
import { h } from './dom.js';
import { problemeHorsLigne } from './horsligne.js';
import { lien } from './elements.js';
import { activerGlisser } from './glisser.js';
import { blocMenuDuJour } from './menu-du-jour.js';
import { corps } from './vue-jour.js';

export function titre() { return 'Production'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** « Production » et la date en une ligne, flèches ‹ › discrètes à droite (l'autre moyen de changer de jour que le glissement). */
function entete(date) {
  const flecheJour = (sens, texte, nom) => h('a', { href: `#/production/${jourOuvertVoisin(date, sens)}`, classe: 'prod-fleche', 'aria-label': nom }, texte);
  return h('header', { classe: 'jour-tete prod-tete' },
    h('div', { classe: 'prod-titre-ligne' },
      h('h1', { classe: 'page-titre' }, 'Production'),
      h('span', { classe: 'prod-date' }, majuscule(libelleJour(date))),
      h('span', { classe: 'prod-fleches' }, flecheJour(-1, '‹', 'Jour précédent'), flecheJour(1, '›', 'Jour suivant'))),
    problemeHorsLigne() ? h('span', { classe: 'prod-horsligne' }, h('span', { classe: 'prod-horsligne-point', 'aria-hidden': 'true' }), problemeHorsLigne()) : null);
}

/** Pied de page : prévisions du jour, assistant (facultatif). */
function pied(date) {
  return h('div', { classe: 'prod-pied pas-imprime' },
    lien(`#/semaine/${date}`, 'Prévisions →', 'jour-lien'),
    boutonProposerPlanning(date));
}

export function rendre(etat, date) {
  const racine = h('div', { classe: 'vue vue-jour vue-production' });
  const feuille = feuilleDuJour(etat, date);
  racine.appendChild(entete(date));
  const menu = blocMenuDuJour(etat, date);
  if (menu) racine.appendChild(menu);
  for (const n of corps(etat, date, feuille)) racine.appendChild(n);
  racine.appendChild(pied(date));
  // Glissement : la règle (seuil, vertical ignoré, dimanche sauté) est `jourApresGeste` ; ici on la branche sur le doigt.
  activerGlisser(racine, {
    decider: ({ dx, dy, dt }) => { const cible = jourApresGeste(date, dx, dy, undefined, dt); return cible === null ? null : (cible > date ? 'suivant' : 'precedent'); },
    suivant: () => { location.hash = `#/production/${jourOuvertVoisin(date, 1)}`; },
    precedent: () => { location.hash = `#/production/${jourOuvertVoisin(date, -1)}`; },
  });
  return racine;
}
