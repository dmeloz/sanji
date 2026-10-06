// Validateur de brouillons de planning. Un brouillon, venu du calcul ou d'un modèle, n'est jamais cru sur parole :
// structure fermée, références vérifiées dans l'état, puis rejeu à blanc sur une copie avec les fonctions du domaine.
// Une erreur refuse le brouillon ; un manque de donnée devient un point « à décider » sans commande.

import { creneauxDuJour, estOuvert, joursEntre } from '../domaine/dates.js';
import { planifier } from '../domaine/actions.js';
import { arrondirQuantite, calculerComposant } from '../domaine/calcul.js';
import {
  chargeCreneau, etatCreneau, etatTache, evaluerAvance, regleDe, repereConservation, sansAvanceParDefaut,
} from '../domaine/planification.js';
import { CRENEAU, POINTS_CHARGE } from '../domaine/statuts.js';
import { verifierSchema } from './contrats.js';

export const SCHEMA_BROUILLON = Object.freeze({
  type: 'objet',
  champs: {
    type: { type: 'texte', valeurs: ['planning'] },
    items: {
      type: 'tableau',
      elements: {
        type: 'objet',
        champs: {
          productionId: { type: 'texte' },
          date: { type: 'date' },
          creneau: { type: 'texte', valeurs: Object.values(CRENEAU) },
          quantite: { type: 'objet', optionnel: true, champs: { libelle: { type: 'texte' } } },
        },
      },
    },
    hypotheses: { type: 'tableau', optionnel: true, elements: { type: 'texte' } },
    incertitudes: { type: 'tableau', optionnel: true, elements: { type: 'texte' } },
  },
});

/** Résumé d'une évaluation d'avance : ce que le chef voit et ce que la politique relit. */
function resumerEvaluation(evaluation) {
  const { jours, conservation, couvre, autorisee, alertes, repere } = evaluation;
  // Une conservation non validée n'est jamais « couverte », même si le domaine tolère l'avance habituelle.
  return { jours, conservation, couvre: couvre && conservation !== 'a_confirmer', autorisee, alertes: [...alertes], ...(repere ? { repere: { texte: repere.texte, depasse: repere.depasse } } : {}) };
}

/** Quantité recalculée par le domaine : seule valeur affichée, quoi que dise le brouillon. */
export function quantiteDe(etat, composantId) {
  const calc = calculerComposant(etat, composantId);
  // `valeur` et `unite` : la quantité de travail arrondie comme partout dans l'application, null tant que le calcul est inconnu.
  const valeur = calc.statut === 'CALCULE' ? arrondirQuantite(calc.quantiteTravail, calc.uniteTravail) : null;
  return {
    libelle: calc.libelleQuantite, statut: calc.statut, aValider: Boolean(calc.aValider), standardBase: Boolean(calc.standardBase),
    valeur, unite: calc.uniteTravail ?? null,
  };
}

/**
 * Contrôle un item sur la copie de simulation `sim` (qui reçoit ensuite l'item, pour que les suivants voient la charge).
 * @returns {{erreurs:string[], item?:object, aDecider?:object}}
 */
function controlerItem(sim, brut, aujourdhui, h, exclure) {
  const { productionId, date, creneau } = brut;
  const p = sim.productions?.[productionId];
  const erreurs = [];
  if (!p) return { erreurs: [`production inconnue : ${productionId}`] };
  const composant = sim.composants?.[p.composantId];
  if (!composant) return { erreurs: [`composant introuvable pour ${productionId}`] };
  if (p.etat !== 'a_faire' || p.jourDecide || p.creneauDecide) erreurs.push(`${composant.nom} : déjà planifiée, commencée ou faite`);
  if (!estOuvert(date)) erreurs.push(`${composant.nom} : ${date} est un jour non travaillé`);
  else if (!creneauxDuJour(date).includes(creneau)) erreurs.push(`${composant.nom} : le créneau ${creneau} n'existe pas le ${date}`);
  if (joursEntre(date, p.dateService) < 0) erreurs.push(`${composant.nom} : ${date} est après le service du ${p.dateService}`);
  if (aujourdhui && date < aujourdhui) erreurs.push(`${composant.nom} : ${date} est déjà passé`);
  else if (exclure?.(date, creneau)) erreurs.push(`${composant.nom} : le créneau ${creneau} du ${date} est déjà terminé`);
  if (erreurs.length) return { erreurs };

  if (etatCreneau(sim, date, creneau) !== 'libre') return { erreurs: [`${composant.nom} : le créneau ${creneau} du ${date} n'est pas libre`] };
  const charge = chargeCreneau(sim, date, creneau);
  const points = POINTS_CHARGE[composant.charge] ?? 0;
  if (Number.isFinite(charge.capacite) && charge.points + points > charge.capacite) {
    return { erreurs: [`${composant.nom} : le créneau ${creneau} du ${date} dépasse sa capacité`] };
  }
  if (sansAvanceParDefaut(sim, composant, p) && date !== p.dateService) {
    return { erreurs: [`${composant.nom} : base du menu 1, à faire le jour même du service`] };
  }
  const evaluation = evaluerAvance(date, p.dateService, regleDe(sim, composant, p.etapeCle ?? null), repereConservation(composant, sim));
  if (!evaluation.autorisee || !evaluation.couvre) {
    return { erreurs: [`${composant.nom} : avance non autorisée ou conservation dépassée (${evaluation.alertes.join(' ; ') || 'hors règle'})`] };
  }
  if (etatTache(sim, productionId) === 'a_preciser') {
    return {
      erreurs: [],
      aDecider: { genre: 'quantite_inconnue', productionId, composantId: composant.id, texte: `${composant.nom} : quantité inconnue, à préciser avant de planifier` },
    };
  }
  const quantite = quantiteDe(sim, composant.id);
  if (brut.quantite && brut.quantite.libelle !== quantite.libelle) {
    return { erreurs: [`${composant.nom} : quantité annoncée « ${brut.quantite.libelle} » différente du calcul « ${quantite.libelle} »`] };
  }
  try {
    planifier(sim, productionId, date, creneau, h);
  } catch (erreur) {
    return { erreurs: [`${composant.nom} : ${erreur.message}`] };
  }
  // Décision de la propriétaire (2026-10-06) : une conservation non validée donne un avertissement léger, jamais une confirmation.
  const avertir = evaluation.jours > 0 && evaluation.conservation === 'a_confirmer';
  const motifs = avertir ? ['Avertissement : conservation non validée, ce produit ne doit pas être présenté comme couvert.'] : [];
  return {
    erreurs: [],
    item: {
      id: `item-${productionId}`, productionId, composantId: composant.id, nom: composant.nom, dateService: p.dateService,
      date, creneau, quantite, evaluation: resumerEvaluation(evaluation), exigeConfirmation: false, motifs,
      commande: { outil: 'planifier_production', entrees: { productionId, date, creneau } },
    },
  };
}

/**
 * Contrôle un brouillon de planning contre l'état courant, sans rien modifier.
 * @param {unknown} brouillon
 * @param {object} etat
 * @param {{h:string, aujourdhui?:string|null, exclure?:Function|null}} options `exclure(date, creneau)` : créneau terminé (horloge)
 * @returns {{erreurs:string[], items:object[], aDecider:object[], controles:{nom:string, ok:boolean, detail?:string}[]}}
 */
export function controlerBrouillon(brouillon, etat, { h, aujourdhui = null, exclure = null }) {
  const structure = verifierSchema(brouillon, SCHEMA_BROUILLON, 'brouillon');
  const controles = [{ nom: 'structure fermée du brouillon', ok: structure.length === 0, detail: structure[0] }];
  if (structure.length) return { erreurs: structure, items: [], aDecider: [], controles };

  const erreurs = [];
  const vus = new Set();
  const sim = structuredClone(etat);
  const items = [];
  const aDecider = [];
  for (const brut of brouillon.items) {
    if (vus.has(brut.productionId)) { erreurs.push(`production en double : ${brut.productionId}`); continue; }
    vus.add(brut.productionId);
    const r = controlerItem(sim, brut, aujourdhui, h, exclure);
    erreurs.push(...r.erreurs);
    if (r.item) items.push(r.item);
    if (r.aDecider) aDecider.push({ id: `decider-${r.aDecider.productionId}`, ...r.aDecider });
  }
  controles.push(
    { nom: 'références, jours, créneaux et capacité', ok: erreurs.length === 0, detail: erreurs[0] },
    { nom: "règles d'avance et de conservation (rejeu du domaine)", ok: erreurs.length === 0 },
    { nom: 'quantités recalculées par le domaine', ok: true },
  );
  return { erreurs, items, aDecider, controles };
}
