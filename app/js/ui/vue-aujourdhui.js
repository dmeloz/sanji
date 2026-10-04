// Aujourd'hui (onglet 1, accueil). Vue-relais : délègue pour l'instant au tableau de bord (vue-tableau.js).
// Interface commune des vues : `titre(param, sous)` et `rendre(etat, param, sous)`. Le routeur n'a pas à changer quand cet écran est remplacé.

import * as vueTableau from './vue-tableau.js';

export function titre() { return "Aujourd'hui"; }

export function rendre(etat) {
  return vueTableau.rendre(etat, null);
}
