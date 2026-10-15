// Données de la feuille « À décider » : une carte par décision RÉELLE, rien d'autre. Aucune règle nouvelle : le module
// assemble les fonctions existantes (écarts de la feuille du jour, points à confirmer, sauce implicite, apprentissage,
// valeurs à valider). Une quantité absente n'est JAMAIS une décision : grammage, prévision manquante et composant à
// préciser (points de chiffrage) n'y figurent pas. Pur : ni DOM ni heure courante.

import { obstacleValidationAllergenes } from './allergenes.js';
import { calculerComposant } from './calcul.js';
import { propositionsApprentissage } from './apprentissage.js';
import { ajouterJours, jourSemaine, lundiDe } from './dates.js';
import { estSauceAConfirmer } from './etat.js';
import { cibleProduction, ecartProduction, etatTache, evaluationProduction, reelNonCompte } from './planification.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { portionsCuitesSuspectes, valeursAValider } from './validation.js';

/** Points de quantité manquante : jamais une décision. */
export const POINTS_SANS_DECISION = Object.freeze(new Set(['grammage', 'prevision_manquante', 'composant_a_preciser']));

/** Genres de cartes, dans l'ordre d'affichage (ce qui bloque le travail d'abord) ; l'état du poids d'une portion passe avant tous. */
export const GENRES = Object.freeze(['ecart', 'avance_hors_regle', 'sauce', 'repartition', 'point', 'apprentissage', 'valeur']);

/**
 * Jours regardés : aujourd'hui jusqu'au samedi de la semaine, comme le bandeau de l'accueil ; le dimanche (jour fermé),
 * la semaine qui vient (lundi au samedi) : sinon le dimanche ne verrait presque rien.
 */
function datesDe(aujourd) {
  const lundi = jourSemaine(aujourd) === 7 ? ajouterJours(lundiDe(aujourd), 7) : lundiDe(aujourd);
  return [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)).filter((d) => d >= aujourd);
}

/**
 * Décisions à prendre.
 * Carte : { id, genre, date?, ... } selon le genre :
 * - ecart : productionId, composantId, nom, cible, reel, unite, ecart (nombres ou null), reelNonCompte ({quantite, raison} ou null : réel qui ne couvre pas le besoin)
 * - avance_hors_regle : productionId, composantId, nom, dateService, jours, limiteDepassee, fait (déjà faite : plus replanifiable)
 * - sauce : composantId, nom, date
 * - repartition : ficheId, numero, date, couverts
 * - point (autre point « à confirmer » sans quantité) : type, texte, composantId?, ficheId?, date?, obstacle? (allergènes : ce qui empêche la validation)
 * - apprentissage : proposition (de `propositionsApprentissage`)
 * - valeur : valeur (de `valeursAValider`)
 * @returns {{total:number, cartes:object[]}}
 */
export function decisionsDe(etat, aujourd) {
  const cartes = [];
  const dates = datesDe(aujourd);

  // Écarts à arbitrer : toute production faite (ou en cours) dont l'écart n'est pas décidé, jusqu'à la fin de la fenêtre,
  // y compris un service déjà passé ou un dimanche : une décision à prendre ne disparaît pas parce que le jour a changé.
  const fin = dates[dates.length - 1];
  // L'écart est celui du composant, pas d'une production : une seule carte par composant (la principale d'abord).
  const rang = { principale: 0, complement: 1 };
  const enEcart = Object.values(etat.productions ?? {}).sort((a, b) => (rang[a.genre] ?? 2) - (rang[b.genre] ?? 2));
  const composantsVus = new Set();
  for (const p of enEcart) {
    const composant = etat.composants?.[p.composantId];
    if (!composant || (p.etat !== 'fait' && p.etat !== 'en_cours') || p.dateService > fin) continue;
    if (etatTache(etat, p.id) !== 'ecart' || composantsVus.has(p.composantId)) continue;
    composantsVus.add(p.composantId);
    cartes.push({
      id: `ecart:${p.id}`, genre: 'ecart', productionId: p.id, composantId: p.composantId,
      nom: p.genre === 'complement' ? `Complément : ${composant.nom}` : composant.nom, cible: cibleProduction(etat, p.id), date: p.dateService,
      reel: Number.isFinite(p.quantiteReelle) ? p.quantiteReelle : null, unite: p.unite ?? calculerComposant(etat, composant.id)?.uniteTravail ?? null,
      ecart: ecartProduction(etat, p.composantId), reelNonCompte: reelNonCompte(etat, p.composantId),
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
            nom: etat.composants[pt.composantId].nom, dateService: date, date, jours: ev.jours, limiteDepassee, fait: p.etat === 'fait' });
        }
      } else if (pt.type === 'repartition_provisoire') {
        const f = etat.fiches[pt.ficheId];
        cartes.push({ id: `repartition:${f.id}`, genre: 'repartition', ficheId: f.id, numero: f.numero || f.id, date, couverts: Number(f.couverts) || 0 });
      } else {
        const id = `point:${pt.type}:${pt.composantId ?? pt.ficheId}:${date}`;
        if (vus.has(id)) continue;
        vus.add(id);
        const carte = { id, genre: 'point', type: pt.type, texte: pt.texte, composantId: pt.composantId ?? null, ficheId: pt.ficheId ?? null, date };
        // Allergènes : dire pourquoi valider la liste ne suffirait pas (composition ou recette), sinon la liste seule suffit.
        if (pt.type === 'allergenes') carte.obstacle = obstacleValidationAllergenes(etat, etat.composants[pt.composantId]);
        cartes.push(carte);
      }
    }
  }
  for (const pt of pointsGlobaux(etat)) cartes.push({ id: `point:${pt.type}`, genre: 'point', type: pt.type, texte: pt.texte, composantId: null, ficheId: null, date: null });

  for (const c of Object.values(etat.composants ?? {})) {
    if (dates.includes(c.date) && estSauceAConfirmer(c)) {
      cartes.push({ id: `sauce:${c.id}`, genre: 'sauce', composantId: c.id, nom: c.nom, date: c.date });
    }
  }

  // Portion enregistrée « cuit » alors que le repère validé est « sec » (standard, plat, référence du nom ou fiche retenue) :
  // jamais corrigée seule, c'est la propriétaire qui tranche. Une carte par portion ; `lieux` dit où elle est enregistrée.
  for (const p of portionsCuitesSuspectes(etat, aujourd)) {
    cartes.push({ id: `point:etat_poids_portion:${p.cle}`, genre: 'point', type: 'etat_poids_portion', composantId: p.composantId, ficheId: null, date: null,
      cleFamille: p.cleFamille, role: p.role, lieux: p.lieux, texte: p.texte });
  }

  for (const proposition of propositionsApprentissage(etat, aujourd)) {
    cartes.push({ id: `apprentissage:${proposition.cle}`, genre: 'apprentissage', proposition });
  }
  for (const valeur of valeursAValider(etat, aujourd)) {
    cartes.push({ id: `valeur:${valeur.cle}`, genre: 'valeur', valeur });
  }

  // Une portion au mauvais état du poids fausse des quantités : elle passe avant tout le reste (tri stable, ordre des genres ensuite).
  const rangCarte = (c) => (c.type === 'etat_poids_portion' ? -1 : GENRES.indexOf(c.genre));
  cartes.sort((a, b) => rangCarte(a) - rangCarte(b));
  return { total: cartes.length, cartes };
}
