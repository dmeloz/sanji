// Données de la feuille « À décider » : une carte par décision RÉELLE, rien d'autre. Aucune règle nouvelle : le module
// assemble les fonctions existantes (écarts de la feuille du jour, points à confirmer, sauce implicite, apprentissage,
// valeurs à valider). Une quantité absente n'est JAMAIS une décision : grammage, prévision manquante et composant à
// préciser (points de chiffrage) n'y figurent pas. Pur : ni DOM ni heure courante.

import { propositionsApprentissage } from './apprentissage.js';
import { ajouterJours, estOuvert, lundiDe } from './dates.js';
import { estSauceAConfirmer } from './etat.js';
import { cibleProduction, ecartProduction, evaluationProduction, feuilleDuJour } from './planification.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { decisionsSansDoublon } from './tableau-blanc.js';
import { valeursAValider } from './validation.js';

/** Points de quantité manquante : jamais une décision. */
export const POINTS_SANS_DECISION = Object.freeze(new Set(['grammage', 'prevision_manquante', 'composant_a_preciser']));

/** Genres de cartes, dans l'ordre d'affichage (ce qui bloque le travail d'abord). */
export const GENRES = Object.freeze(['ecart', 'avance_hors_regle', 'sauce', 'repartition', 'point', 'apprentissage', 'valeur']);

/** Jours regardés : aujourd'hui jusqu'au samedi de la semaine, comme le bandeau de l'accueil. */
function datesDe(aujourd) {
  const lundi = lundiDe(aujourd);
  return [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)).filter((d) => d >= aujourd);
}

/**
 * Décisions à prendre.
 * Carte : { id, genre, date?, ... } selon le genre :
 * - ecart : productionId, composantId, nom, cible, reel, unite, ecart (nombres ou null)
 * - avance_hors_regle : productionId, composantId, nom, dateService, jours, limiteDepassee
 * - sauce : composantId, nom, date
 * - repartition : ficheId, numero, date, couverts
 * - point (autre point « à confirmer » sans quantité) : type, texte, composantId?, ficheId?, date?
 * - apprentissage : proposition (de `propositionsApprentissage`)
 * - valeur : valeur (de `valeursAValider`)
 * @returns {{total:number, cartes:object[]}}
 */
export function decisionsDe(etat, aujourd) {
  const cartes = [];
  const dates = datesDe(aujourd);

  const feuille = estOuvert(aujourd) ? feuilleDuJour(etat, aujourd) : null;
  for (const d of feuille ? decisionsSansDoublon(feuille).filter((x) => x.motif === 'ecart') : []) {
    const p = etat.productions[d.productionId];
    cartes.push({
      id: `ecart:${d.productionId}`, genre: 'ecart', productionId: d.productionId, composantId: d.composantId,
      nom: p.libelle || d.libelle || d.nom, cible: cibleProduction(etat, d.productionId),
      reel: Number.isFinite(p.quantiteReelle) ? p.quantiteReelle : null, unite: p.unite ?? d.unite ?? null,
      ecart: ecartProduction(etat, d.composantId),
    });
  }

  const vus = new Set();
  for (const date of dates) {
    for (const pt of pointsAConfirmer(etat, date)) {
      if (pt.type === 'ecart' || POINTS_SANS_DECISION.has(pt.type)) continue;
      if (pt.type === 'avance_hors_regle') {
        for (const p of Object.values(etat.productions ?? {})) {
          if (p.composantId !== pt.composantId || p.dateService !== date) continue;
          const ev = evaluationProduction(etat, p.id);
          const limiteDepassee = ev?.conservation === 'depassee';
          if (!ev || !(ev.jours > 0) || !((ev.exception && !ev.autorisee) || limiteDepassee)) continue;
          const id = `avance:${p.id}`;
          if (vus.has(id)) continue;
          vus.add(id);
          cartes.push({ id, genre: 'avance_hors_regle', productionId: p.id, composantId: pt.composantId,
            nom: etat.composants[pt.composantId].nom, dateService: date, jours: ev.jours, limiteDepassee });
        }
      } else if (pt.type === 'repartition_provisoire') {
        const f = etat.fiches[pt.ficheId];
        cartes.push({ id: `repartition:${f.id}`, genre: 'repartition', ficheId: f.id, numero: f.numero || f.id, date, couverts: Number(f.couverts) || 0 });
      } else {
        const id = `point:${pt.type}:${pt.composantId ?? pt.ficheId}:${date}`;
        if (vus.has(id)) continue;
        vus.add(id);
        cartes.push({ id, genre: 'point', type: pt.type, texte: pt.texte, composantId: pt.composantId ?? null, ficheId: pt.ficheId ?? null, date });
      }
    }
  }
  for (const pt of pointsGlobaux(etat)) cartes.push({ id: `point:${pt.type}`, genre: 'point', type: pt.type, texte: pt.texte, composantId: null, ficheId: null, date: null });

  for (const c of Object.values(etat.composants ?? {})) {
    if (c.date >= aujourd && dates.includes(c.date) && estSauceAConfirmer(c)) {
      cartes.push({ id: `sauce:${c.id}`, genre: 'sauce', composantId: c.id, nom: c.nom, date: c.date });
    }
  }

  for (const proposition of propositionsApprentissage(etat, aujourd)) {
    cartes.push({ id: `apprentissage:${proposition.cle}`, genre: 'apprentissage', proposition });
  }
  for (const valeur of valeursAValider(etat, aujourd)) {
    cartes.push({ id: `valeur:${valeur.cle}`, genre: 'valeur', valeur });
  }

  cartes.sort((a, b) => GENRES.indexOf(a.genre) - GENRES.indexOf(b.genre));
  return { total: cartes.length, cartes };
}
