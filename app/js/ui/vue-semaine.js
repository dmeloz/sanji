// Semaine (onglet 3). Vue-relais : un jour (#/semaine/<date>) délègue au détail du jour (vue-detail.js) ;
// sans date, ou avec `sous === 'tableau'` (#/semaine/<lundi>/tableau), au tableau de la semaine (vue-tableau.js).

import * as vueDetail from './vue-detail.js';
import * as vueTableau from './vue-tableau.js';

const estJour = (param, sous) => Boolean(param) && sous !== 'tableau';

export function titre(param, sous) { return estJour(param, sous) ? vueDetail.titre() : 'Semaine'; }

export function rendre(etat, param, sous) {
  return estJour(param, sous) ? vueDetail.rendre(etat, param) : vueTableau.rendre(etat, param ?? null);
}
