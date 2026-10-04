// Import des menus (#/import[/date]). Vue-relais : délègue pour l'instant à la saisie de la semaine (vue-menus.js).

import * as vueMenus from './vue-menus.js';

export function titre() { return 'Import des menus'; }

export function rendre(etat, lundi) {
  return vueMenus.rendre(etat, lundi);
}
