// Réinitialiser une semaine FUTURE pour la ressaisir (menus, couverts, composants, préparations, fiches de ces jours).
// Ne touche jamais aux standards maison, aux ajustements, à la mémoire d'attribution, aux règles, aux autres semaines.

import { terminer } from './actions.js';
import { datesDeLaSemaine, estDateValide, jourSemaine, lundiDe } from './dates.js';

/** Vrai si ce lundi est strictement après la semaine d'aujourd'hui (une semaine en cours ou passée ne se réinitialise pas). */
export const semaineReinitialisable = (lundi, aujourd) => estDateValide(lundi) && estDateValide(aujourd)
  && jourSemaine(lundi) === 1 && lundi > lundiDe(aujourd);

/**
 * Efface les jours lundi à samedi de la semaine, leurs composants, productions, cases cochées, suivi des achats et fiches.
 * @returns {{jours:number, composants:number, fiches:number}}
 */
export function reinitialiserSemaine(etat, lundi, aujourd, h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  if (!estDateValide(lundi) || jourSemaine(lundi) !== 1) throw new Error(`« ${lundi} » n'est pas un lundi.`);
  if (!semaineReinitialisable(lundi, aujourd)) throw new Error('Seule une semaine à venir se réinitialise : la semaine en cours et les semaines passées restent telles quelles.');
  // Lundi à samedi seulement : le dimanche est hors périmètre (fermé, sans menu ni fiche).
  const dates = new Set(datesDeLaSemaine(lundi).slice(0, 6));
  const composants = Object.values(etat.composants).filter((c) => dates.has(c.date)).map((c) => c.id);
  const supprimes = new Set(composants);
  const jours = Object.keys(etat.jours).filter((d) => dates.has(d));
  const fiches = Object.values(etat.fiches).filter((f) => dates.has(f.date)).map((f) => f.id);
  for (const id of composants) delete etat.composants[id];
  for (const p of Object.values(etat.productions)) if (supprimes.has(p.composantId) || dates.has(p.dateService)) delete etat.productions[p.id];
  for (const cle of Object.keys(etat.articlesCoches ?? {})) if (supprimes.has(cle.split('|')[0])) delete etat.articlesCoches[cle];
  for (const cle of Object.keys(etat.produits ?? {})) if (cle.startsWith(`${lundi}|`)) delete etat.produits[cle];
  for (const id of fiches) delete etat.fiches[id];
  for (const d of jours) delete etat.jours[d];
  return terminer(etat, h, 'reinitialiserSemaine', `${lundi} : ${jours.length} jour(s), ${composants.length} composant(s), ${fiches.length} fiche(s)`,
    { jours: jours.length, composants: composants.length, fiches: fiches.length });
}
