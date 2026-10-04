// Stock (onglet 4) : trois vues, Restes, DLC, Achats. Vue-relais : « achats » délègue à la vue Produits (vue-produits.js) ;
// « restes » et « dlc » affichent un texte provisoire. `param` = le lundi de la semaine, `sous` = « restes », « dlc » ou « achats ».

import { h } from './dom.js';
import * as vueProduits from './vue-produits.js';

export const SOUS_VUES = ['restes', 'dlc', 'achats'];

const TITRES = { restes: 'Stock · Restes', dlc: 'Stock · DLC', achats: 'Stock · Achats' };

export function titre(param, sous = 'achats') { return TITRES[sous] ?? TITRES.achats; }

export function rendre(etat, lundi, sous = 'achats') {
  if (sous === 'restes' || sous === 'dlc') {
    return h('div', { classe: 'vue vue-stock' },
      h('h1', { classe: 'page-titre' }, TITRES[sous]),
      h('p', { classe: 'vide' }, 'À venir.'),
      h('p', null, h('a', { href: lundi ? `#/stock/achats/${lundi}` : '#/stock/achats', classe: 'btn' }, 'Voir les achats')));
  }
  return vueProduits.rendre(etat, lundi);
}
