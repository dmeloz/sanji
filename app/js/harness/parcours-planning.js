// Premier parcours vertical : menus validés → composants du poste → calcul → proposition de planning.
// Tout est déterministe et réutilise le domaine (`suggererJour`, `etatTache`) ; le modèle, s'il existe, ne fait que
// proposer une autre répartition que `controlerBrouillon` revérifie. Aucune écriture dans l'état réel.

import { planifier } from '../domaine/actions.js';
import { etatTache, sansAvanceParDefaut, suggererJour } from '../domaine/planification.js';

/**
 * Productions « à planifier » du poste dans la période : composant attribué, pas encore décidée, pas commencée.
 * @returns {object[]} triées par service, nom puis identifiant (ordre stable)
 */
export function productionsAPlanifier(etat, dateDebut, dateFin) {
  return Object.values(etat.productions ?? {})
    .filter((p) => p.etat === 'a_faire' && !p.jourDecide
      && p.dateService >= dateDebut && p.dateService <= dateFin && etat.composants?.[p.composantId]?.attribue)
    .sort((a, b) => a.dateService.localeCompare(b.dateService)
      || etat.composants[a.composantId].nom.localeCompare(etat.composants[b.composantId].nom)
      || a.id.localeCompare(b.id));
}

/**
 * Propose un jour pour chaque production à planifier. La copie de simulation reçoit chaque choix pour que les étapes
 * d'un même composant se voient d'une production à l'autre. Ce qui ne peut pas être placé sans règle validée reste « à décider ».
 * @param {object} etat
 * @param {{h:string, aujourdhui:string, dateDebut:string, dateFin:string}} periode
 * @returns {{brouillon:object, nonPlacees:{productionId:string, composantId:string, texte:string}[]}}
 */
export function proposerPlanning(etat, { h, aujourdhui, dateDebut, dateFin }) {
  const sim = structuredClone(etat);
  const items = [];
  const nonPlacees = [];
  for (const { id } of productionsAPlanifier(etat, dateDebut, dateFin)) {
    const p = sim.productions[id];
    const composant = sim.composants[p.composantId];
    if (etatTache(sim, id) === 'a_preciser') {
      nonPlacees.push({ productionId: id, composantId: composant.id, texte: `${composant.nom} : quantité inconnue, à préciser avant de planifier` });
      continue;
    }
    const suggestion = suggererJour(sim, id, aujourdhui);
    // Base du menu 1 (pâtes, risotto) : jour même uniquement, sans règle d'avance validée.
    const sansAvance = sansAvanceParDefaut(sim, composant, p);
    if (!suggestion || (sansAvance && suggestion.date !== p.dateService)) {
      nonPlacees.push({
        productionId: id, composantId: composant.id,
        texte: `${composant.nom} : aucun jour compatible avec les règles pour le service du ${p.dateService}`,
      });
      continue;
    }
    items.push({ productionId: id, date: suggestion.date });
    planifier(sim, id, suggestion.date, h);
  }
  return { brouillon: { type: 'planning', items }, nonPlacees };
}
