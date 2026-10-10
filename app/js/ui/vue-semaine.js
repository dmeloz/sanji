// Semaine (onglet 3) : la vue d'ensemble de la semaine (vue-tableau.js), habillée par `.vue-semaine-globale`, avec le bouton « ⋯ »
// (Importer les menus, Proposer un planning, Vue de la semaine) et l'historique. Depuis la v116, un jour n'a plus de page ici :
// `#/semaine/<date>` mène à Production de ce jour (routeur), et ce que l'ancienne page de jour offrait (couverts, menus, attribution,
// fiches, allergies, points à confirmer, détail) est dans la feuille « Services du jour » (feuille-services.js).

import { lundiDe } from '../domaine/dates.js';
import { aujourdhui } from '../magasin.js';
import { ouvrirAssistantPlanning } from './assistant-planning.js';
import { h } from './dom.js';
import { panneau } from './panneau.js';
import { demanderReinitialisation, peutReinitialiser } from './reinitialiser-semaine.js';
import * as vueTableau from './vue-tableau.js';

export function titre() { return 'Semaine'; }

/** Le seul bouton d'action de Semaine : une feuille avec « Importer les menus » et « Proposer un planning ». */
function boutonActions(lundi, date) {
  return h('span', { classe: 'sa-groupe' },
    h('a', { href: '#/historique', classe: 'sa-fleche', 'aria-label': 'Historique des semaines' }, '↺'),
    boutonActionsFeuille(lundi, date));
}

function boutonActionsFeuille(lundi, date) {
  return h('button', {
    type: 'button', classe: 'sa-actions', 'aria-label': 'Actions de la semaine',
    onClick: () => panneau({
      titre: 'Semaine', lectureSeule: true,
      corps: ({ fermer }) => [
        h('a', { href: `#/import/${lundi}`, classe: 'btn sa-action', onClick: () => fermer() }, 'Importer les menus'),
        h('button', { type: 'button', classe: 'btn sa-action', onClick: () => { fermer(); ouvrirAssistantPlanning({ date }); } }, 'Proposer un planning'),
        h('a', { href: `#/semaine/${lundi}/tableau`, classe: 'btn sa-action', onClick: () => fermer() }, 'Vue de la semaine'),
        peutReinitialiser(lundi) ? h('button', { type: 'button', classe: 'btn sa-action', onClick: () => { fermer(); demanderReinitialisation(lundi); } }, 'Réinitialiser la semaine') : null,
      ],
    }),
  }, '⋯');
}

/** Semaine globale : un lundi (ou une date, ramenée à sa semaine) ou, sans paramètre, la semaine en cours. */
export function rendre(etat, param) {
  const date = param ?? aujourdhui();
  const interieur = vueTableau.rendre(etat, param ?? null, { actions: boutonActions(lundiDe(date), date) });
  return h('div', { classe: 'vue-semaine-globale' }, interieur);
}
