// Cocher un article du poste (onglet Articles). Un geste durable de l'état (`etat.articlesCoches`, clé → horodatage), journalisé en clair.

import { terminer } from './actions.js';

const LONGUEUR_MAX_CLE = 300;

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

/**
 * Coche ou décoche un article. La clé est celle de `articlesDuPoste` (« composant|article ») : le composant doit exister.
 * @returns {boolean} le nouvel état de la case
 */
export function cocherArticle(etat, cle, coche, h) {
  verifierH(h);
  const lisible = typeof cle === 'string' && cle.length <= LONGUEUR_MAX_CLE && cle.includes('|');
  const composantId = lisible ? cle.split('|')[0] : '';
  if (!lisible || !Object.hasOwn(etat.composants ?? {}, composantId)) throw new Error(`Article inconnu : ${String(cle).slice(0, 60)}.`);
  if (typeof coche !== 'boolean') throw new Error('Une case se coche ou se décoche : vrai ou faux attendu.');
  if (!etat.articlesCoches || typeof etat.articlesCoches !== 'object') etat.articlesCoches = {};
  if (coche) etat.articlesCoches[cle] = h;
  else delete etat.articlesCoches[cle];
  const nom = etat.composants[composantId].nom;
  return terminer(etat, h, 'cocherArticle', `${nom} (${cle.split('|').slice(1).join('|')}) : ${coche ? 'coché' : 'décoché'}`, coche);
}
