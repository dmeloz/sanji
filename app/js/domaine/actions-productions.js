// Actions sur les productions (planifier, fait, écart, pesée).
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { exiger, exigerComposant, exigerProduction, libelleCourant, normaliserEtapes, terminer, verifierDans, verifierDate, verifierH } from './actions-socle.js';
import { calculerComposant } from './calcul.js';
import { estOuvert } from './dates.js';
import { nouvelId, productionVide } from './etat.js';
import { champsDeComposant, retenirFiche } from './fiches-retenues.js';
import { cibleProduction, ecartProduction, etatTache, evaluerAvance, refusOrdreEtape, regleDe, repereConservation } from './planification.js';
import { grammageEffectif } from './savoir.js';
import { ETAPE } from './statuts.js';

// ---------------------------------------------------------------- productions

function deplacer(etat, productionId, date, h, action) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Cette production est déjà faite : corrigez le réel plutôt que de la déplacer.');
  if (date === null) {
    p.jourDecide = null;
    return terminer(etat, h, action, `${libelleCourant(etat, p)} : retour à planifier`, { production: p, evaluation: null, alertes: [] });
  }
  verifierDate(date);
  if (!estOuvert(date)) throw new Error('Le dimanche est un jour non travaillé : aucune tâche.');
  if (date > p.dateService) throw new Error('La production ne peut pas être décidée après son service.');
  const refus = refusOrdreEtape(etat, p, { date });
  if (refus) throw new Error(refus);
  const c = etat.composants[p.composantId];
  const evaluation = evaluerAvance(date, p.dateService, regleDe(etat, c, p.etapeCle ?? null), repereConservation(c, etat));
  p.jourDecide = date;
  return terminer(etat, h, action, `${libelleCourant(etat, p)} -> ${date}`, { production: p, evaluation, alertes: [...evaluation.alertes] });
}

/**
 * Décide le jour d'une production (date seule), même hors règle (l'évaluation et ses alertes sont retournées).
 * Refus : dimanche, date après le service, ordre des étapes.
 * @returns {{production:object, evaluation:object, alertes:string[]}}
 */
export function planifier(etat, productionId, date, h) {
  return deplacer(etat, productionId, date, h, 'planifier');
}

/** Reporte une production à un autre jour, ou la remet « à planifier » avec `null`. */
export function reporter(etat, productionId, date, h) {
  return deplacer(etat, productionId, date, h, 'reporter');
}

/** Démarre une production : la cible du moment est mémorisée pour détecter un changement en cours de route. */
export function demarrer(etat, productionId, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Cette production est déjà faite.');
  p.etat = 'en_cours';
  p.cibleAuDemarrage = cibleProduction(etat, productionId);
  return terminer(etat, h, 'demarrer', libelleCourant(etat, p), p);
}

/**
 * Marque une production faite. Sans quantité, la cible est proposée comme réel (corrigerReel la remplace).
 * Fige l'instantané des paramètres et des versions utilisés ; il n'est plus jamais réécrit.
 * `sansQuantite` (liste de Production) : « fait » ne dépend pas de la quantité ; cible inconnue, le réel reste null, rien n'est inventé.
 */
export function marquerFait(etat, productionId, quantite, h, { sansQuantite = false } = {}) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Déjà fait : utilisez corrigerReel pour changer la quantité réelle.');
  const refus = refusOrdreEtape(etat, p, { fait: true });
  if (refus) throw new Error(refus);
  const c = etat.composants[p.composantId];
  const cible = cibleProduction(etat, productionId);
  const reel = quantite === undefined || quantite === null ? cible : quantite;
  if (reel !== null && (!Number.isFinite(reel) || reel < 0)) throw new Error('Quantité réelle : nombre positif ou nul attendu.');
  if (reel === null && p.genre !== 'preparatoire' && !sansQuantite) throw new Error('Quantité à saisir : la cible est inconnue (composant à préciser).');
  const calc = c ? calculerComposant(etat, c.id) : null;
  const recette = c?.recetteId ? etat.recettes[c.recetteId] ?? null : null;
  // L'instantané garde la portion effective utilisée (plat, référence, standard ou base) avec son état et son origine.
  const portion = c ? grammageEffectif(etat, c) : null;
  p.instantane = structuredClone({
    h,
    composant: c ? { nom: c.nom, type: c.type, role: c.role, produitNom: c.produitNom, grammage: portion ?? c.grammage,
      etapes: c.etapes, recetteId: c.recetteId, recetteVersion: c.recetteVersion } : null,
    recette: recette ? { id: recette.id, version: recette.version, valide: recette.valide } : null,
    portions: calc?.portions.total ?? null, cible, formule: calc?.formule ?? '', dependances: calc?.dependances ?? [],
    aValider: calc?.aValider ?? null,
  });
  p.avantFait = { etat: p.etat, cibleAuDemarrage: p.cibleAuDemarrage };
  if (p.cibleAuDemarrage === null) p.cibleAuDemarrage = cible;
  p.etat = 'fait';
  p.quantiteReelle = reel;
  p.unite = calc?.uniteTravail ?? c?.grammage.unite ?? null;
  p.hFait = h;
  return terminer(etat, h, 'marquerFait', `${libelleCourant(etat, p)} : ${reel ?? '—'}`, p);
}

/** Fenêtre pendant laquelle un marquage « fait » peut être annulé (un toucher par erreur). */
const FENETRE_ANNULATION_MS = 2 * 60 * 1000;

/**
 * Annule un marquage « fait » fait par erreur, dans les deux minutes qui suivent : la production redevient ce
 * qu'elle était (à faire ou en cours), sans quantité réelle ni instantané. Passé ce délai, utiliser corrigerReel.
 */
export function annulerFait(etat, productionId, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat !== 'fait') throw new Error("La production n'est pas faite : rien à annuler.");
  const ecoule = Date.parse(h) - Date.parse(p.hFait);
  if (!Number.isFinite(ecoule) || ecoule > FENETRE_ANNULATION_MS) {
    throw new Error('Trop tard pour annuler : utilisez « Corriger » pour changer la quantité réelle.');
  }
  const refus = refusOrdreEtape(etat, p, { annuler: true });
  if (refus) throw new Error(refus);
  const avant = p.avantFait ?? { etat: 'a_faire', cibleAuDemarrage: null };
  p.etat = avant.etat;
  p.cibleAuDemarrage = avant.cibleAuDemarrage;
  p.quantiteReelle = null;
  p.hFait = null;
  p.instantane = null;
  p.avantFait = null;
  return terminer(etat, h, 'annulerFait', libelleCourant(etat, p), p);
}

/** Corrige la quantité réelle d'une production faite (l'instantané reste celui du marquage). */
export function corrigerReel(etat, productionId, quantite, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat !== 'fait') throw new Error("La production n'est pas faite : marquez-la d'abord faite.");
  if (!Number.isFinite(quantite) || quantite < 0) throw new Error('Quantité réelle : nombre positif ou nul attendu.');
  const avant = p.quantiteReelle;
  p.quantiteReelle = quantite;
  return terminer(etat, h, 'corrigerReel', `${libelleCourant(etat, p)} : ${avant} -> ${quantite}`, p);
}

/**
 * Arbitre un écart : 'complement' (crée une production « complement » pour le reste), 'ajustement' ou
 * 'aucune' (aucune production supplémentaire). La décision n'éteint l'écart que tant que la cible reste la même.
 * @returns {{decision:{type:string, cible:number|null, h:string}, complement:object|null}}
 */
export function deciderEcart(etat, productionId, type, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (!['complement', 'ajustement', 'aucune'].includes(type)) throw new Error("Décision d'écart inconnue (complement, ajustement ou aucune).");
  const c = exiger(etat.composants, p.composantId, 'Composant');
  let complement = null;
  if (type === 'complement') {
    if (p.etat !== 'fait') throw new Error("Un complément n'a de sens qu'une fois la production faite : marquez-la faite d'abord.");
    const ecart = ecartProduction(etat, c.id);
    if (!(ecart > 0)) throw new Error("Aucun complément à produire : le réel couvre déjà le besoin.");
    complement = Object.values(etat.productions).find((x) => x.composantId === c.id && x.genre === 'complement' && x.etat !== 'fait') ?? null;
    if (!complement) {
      const id = nouvelId('prod');
      complement = { ...productionVide(id), composantId: c.id, dateService: c.date, genre: 'complement', libelle: `Complément : ${c.nom}` };
      etat.productions[id] = complement;
    }
  }
  // L'écart est celui du composant (toutes ses productions faites ensemble) : une décision règle les cartes sœurs aussi.
  const soeurs = Object.values(etat.productions).filter((x) => x.id !== p.id && x.composantId === c.id && x.genre !== 'preparatoire'
    && (x.etat === 'fait' || x.etat === 'en_cours') && etatTache(etat, x.id) === 'ecart');
  p.decisionEcart = { type, cible: cibleProduction(etat, productionId), h };
  for (const x of soeurs) x.decisionEcart = { type, cible: cibleProduction(etat, x.id), h };
  return terminer(etat, h, 'deciderEcart', `${libelleCourant(etat, p)} : ${type}`, { decision: p.decisionEcart, complement });
}

/** Ajoute une action préparatoire (sans cible chiffrée) liée à un composant, par exemple lorsque la conservation n'est pas validée. */
export function ajouterPreparatoire(etat, composantId, libelle, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  if (typeof libelle !== 'string' || libelle.trim() === '') throw new Error("Décrivez l'action préparatoire.");
  const id = nouvelId('prod');
  etat.productions[id] = { ...productionVide(id), composantId, dateService: c.date, genre: 'preparatoire', libelle: libelle.trim() };
  return terminer(etat, h, 'ajouterPreparatoire', `${c.nom} : ${libelle.trim()}`, id);
}

/** Supprime une production non faite autre que la principale (celle-ci disparaît avec l'attribution du composant). */
export function supprimerProduction(etat, productionId, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error("Production déjà faite : elle reste dans l'historique.");
  if (p.genre === 'principale') throw new Error("La production principale ne se supprime pas : rendez le composant non attribué.");
  if (p.etapeCle) throw new Error("Cette tâche est une étape de la règle de préparation : modifiez les étapes dans les règles de préparation.");
  delete etat.productions[productionId];
  return terminer(etat, h, 'supprimerProduction', p.libelle, true);
}

/** Pesée avant/après d'une étape : le coefficient (après ÷ avant) devient une valeur « validé restaurant ». */
export function enregistrerPesee(etat, composantId, etape, avant, apres, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  verifierDans(etape, ETAPE, 'Étape');
  if (!Number.isFinite(avant) || avant <= 0 || !Number.isFinite(apres) || apres <= 0) {
    throw new Error('Pesée invalide : les poids avant et après doivent être strictement positifs.');
  }
  const [entree] = normaliserEtapes([{ etape, coefficient: apres / avant, statut: 'RESTAURANT_VALIDE', source: `pesée du ${h.slice(0, 10)}` }]);
  c.etapes = [...c.etapes.filter((e) => e.etape !== etape), entree];
  return terminer(etat, h, 'enregistrerPesee', `${c.nom} ${etape} : ${avant} -> ${apres}`, entree);
}

/** Fiche retenue du nom : ce que la propriétaire vient de régler (catégorie, rôle, attribution en menu 2), sans la portion. */
export function retenirReglage(etat, c, h) {
  retenirFiche(etat, c.nom, champsDeComposant(c), h);
}
