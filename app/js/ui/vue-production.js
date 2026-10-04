// Production (onglet 2). Vue-relais : délègue pour l'instant à la feuille Jour (vue-jour.js).
// `param` = la date (AAAA-MM-JJ) ; le routeur donne aujourd'hui par défaut.

import * as vueJour from './vue-jour.js';

export function titre() { return 'Production'; }

export function rendre(etat, date) {
  return vueJour.rendre(etat, date);
}
