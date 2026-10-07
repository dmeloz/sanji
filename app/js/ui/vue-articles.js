// Articles (onglet 4, refonte 2) : la liste simple des articles du poste entremétier, par jour et par menu.
// Décision du 2026-10-07 « Onglet Articles sans gestion de stock » : ni restes, ni DLC, ni achats, pas de stock théorique.
// Cette vue est le relais de l'onglet ; son contenu (liste à cocher, Semaine / Aujourd'hui, partage) arrive à l'étape Articles.
// Les anciennes vues vue-stock.js et vue-produits.js restent dans le code, masquées : aucune route ne les ouvre.

import { h } from './dom.js';
import { ligneVide } from './elements.js';

export function titre() { return 'Articles'; }

export function rendre() {
  return h('div', { classe: 'vue vue-articles' },
    h('h1', { classe: 'page-titre' }, 'Articles'),
    ligneVide("La liste des articles du poste n'est pas encore disponible."));
}
