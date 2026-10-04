// Fiche technique d'un composant (#/fiche/<composantId>). Vue-relais : délègue pour l'instant à vue-composant.js.

import * as vueComposant from './vue-composant.js';

export function titre() { return 'Fiche technique'; }

export function rendre(etat, composantId) {
  return vueComposant.rendre(etat, composantId);
}
