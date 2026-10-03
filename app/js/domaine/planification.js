// Planification par créneau, avances, écarts et feuille du jour.
// Les valeurs de charge sont des points (1, 2, 3), jamais des minutes.

import { ajouterJours, creneauxDuJour, estOuvert, joursEntre, jourSemaine } from './dates.js';
import { calculerComposant, arrondirQuantite } from './calcul.js';
import { normaliser, jourOuVide } from './etat.js';
import { POINTS_CHARGE } from './statuts.js';

const AVANCE_HABITUELLE = 2;
const HORIZON_AVANCES = 4;
const ORDRE_CRENEAUX_INVERSE = ['avant_soir', 'apres_midi', 'avant_midi'];

/** État d'un créneau : valeur du jour, sinon semaine type. Un créneau qui n'existe pas ce jour-là est `indisponible`. */
export function etatCreneau(etat, date, creneau) {
  if (!creneauxDuJour(date).includes(creneau)) return 'indisponible';
  const duJour = jourOuVide(etat, date).creneaux?.[creneau];
  if (duJour) return duJour;
  return etat.reglages?.semaineType?.[jourSemaine(date)]?.[creneau] ?? 'libre';
}

/** Règle de préparation du composant (clé = nom normalisé), ou null. */
export function regleDe(etat, composant) {
  if (!composant) return null;
  const cle = normaliser(composant.nom);
  return Object.values(etat.regles ?? {}).find((r) => r.cle === cle) ?? null;
}

/**
 * Évalue une avance de travail (voir conception, section 8).
 * @param {string|null} dateProduction
 * @param {string} dateService
 * @param {object|null} regle règle de préparation (avanceMaxJours, limiteUtilisationJours)
 * @returns {{jours:number|null, exception:boolean, autorisee:boolean,
 *   conservation:'sans_objet'|'validee'|'a_confirmer'|'depassee', couvre:boolean, alertes:string[]}}
 */
export function evaluerAvance(dateProduction, dateService, regle) {
  const res = { jours: null, exception: false, autorisee: false, conservation: 'sans_objet', couvre: false, alertes: [] };
  if (!dateProduction) { res.alertes.push('date de production non décidée'); return res; }
  res.jours = joursEntre(dateProduction, dateService);
  if (res.jours < 0) { res.alertes.push('production prévue après le service'); return res; }
  if (!estOuvert(dateProduction)) { res.alertes.push('dimanche : jour non travaillé'); return res; }
  if (res.jours === 0) { res.autorisee = true; res.couvre = true; return res; }
  const limite = Number.isFinite(regle?.limiteUtilisationJours) ? regle.limiteUtilisationJours : null;
  if (limite === null) res.conservation = 'a_confirmer';
  else res.conservation = limite >= res.jours ? 'validee' : 'depassee';
  if (res.jours <= AVANCE_HABITUELLE) {
    res.autorisee = true;
    res.couvre = res.conservation !== 'depassee';
  } else {
    res.exception = true;
    const avanceMax = Number.isFinite(regle?.avanceMaxJours) ? regle.avanceMaxJours : null;
    res.autorisee = avanceMax !== null && avanceMax >= res.jours && limite !== null && limite >= res.jours;
    res.couvre = res.autorisee;
    if (!res.autorisee) res.alertes.push('hors règle : avance de plus de deux jours sans règle validée pour cette préparation');
    else res.alertes.push('avance exceptionnelle autorisée par la règle de la préparation');
  }
  if (res.conservation === 'a_confirmer') res.alertes.push('conservation à confirmer');
  if (res.conservation === 'depassee') res.alertes.push("limite d'utilisation dépassée : le besoin n'est pas couvert");
  return res;
}

/** Date de production d'une production : le jour décidé, à défaut la date du marquage « fait ». */
function dateProduction(prod) {
  return prod.jourDecide ?? (prod.hFait ? String(prod.hFait).slice(0, 10) : null);
}

function evaluationDe(etat, prod, composant) {
  const date = dateProduction(prod);
  return date ? evaluerAvance(date, prod.dateService, regleDe(etat, composant)) : null;
}

/** Évaluation de l'avance d'une production (null si sa date de production est inconnue). */
export function evaluationProduction(etat, productionId) {
  const p = etat.productions?.[productionId];
  if (!p) return null;
  return evaluationDe(etat, p, etat.composants?.[p.composantId] ?? null);
}

/** Somme des quantités réellement faites qui couvrent le besoin (préparatoires et avances non couvrantes exclues). */
function sommeReelsCouvrants(etat, composantId, exclureId = null) {
  const composant = etat.composants?.[composantId];
  let somme = 0;
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.composantId !== composantId || p.id === exclureId || p.etat !== 'fait' || p.genre === 'preparatoire') continue;
    if (!Number.isFinite(p.quantiteReelle)) continue;
    const ev = evaluationDe(etat, p, composant);
    if (ev && !ev.couvre) continue;
    somme += p.quantiteReelle;
  }
  return somme;
}

/** Quantité de travail arrondie du composant, ou null si le calcul est inconnu. */
function quantiteTravailArrondie(etat, composantId) {
  if (!etat.composants?.[composantId]) return null;
  const calc = calculerComposant(etat, composantId);
  return calc.statut === 'CALCULE' ? arrondirQuantite(calc.quantiteTravail, calc.uniteTravail) : null;
}

/**
 * Cible d'une production (arrondie à l'unité d'affichage). Principale : quantité de travail du composant ;
 * complément : le reste à produire ; préparatoire : null.
 */
export function cibleProduction(etat, productionId) {
  const p = etat.productions?.[productionId];
  if (!p || p.genre === 'preparatoire') return null;
  const total = quantiteTravailArrondie(etat, p.composantId);
  if (total === null) return null;
  if (p.genre === 'principale') return total;
  const calc = calculerComposant(etat, p.composantId);
  return arrondirQuantite(Math.max(0, total - sommeReelsCouvrants(etat, p.composantId, p.id)), calc.uniteTravail);
}

/**
 * Écart = besoin actuel − somme des quantités faites qui le couvrent (positif : il manque ; négatif : surplus).
 * Null si le besoin est inconnu.
 */
export function ecartProduction(etat, composantId) {
  const total = quantiteTravailArrondie(etat, composantId);
  if (total === null) return null;
  const calc = calculerComposant(etat, composantId);
  return arrondirQuantite(total - sommeReelsCouvrants(etat, composantId), calc.uniteTravail);
}

/** État dérivé d'une tâche : a_preciser, ecart, fait, en_cours, a_planifier ou a_faire. */
export function etatTache(etat, productionId) {
  const p = etat.productions?.[productionId];
  if (!p) throw new Error(`Production introuvable : ${productionId}`);
  const existe = Boolean(etat.composants?.[p.composantId]);
  if (existe && p.etat !== 'fait' && calculerComposant(etat, p.composantId).statut === 'INCONNU') return 'a_preciser';
  if (existe && p.genre !== 'preparatoire') {
    const cible = cibleProduction(etat, productionId);
    const decide = p.decisionEcart && p.decisionEcart.cible === cible;
    if (p.etat === 'fait') {
      const ecart = ecartProduction(etat, p.composantId);
      if (ecart !== null && ecart !== 0 && !decide) return 'ecart';
    } else if (p.etat === 'en_cours' && p.cibleAuDemarrage !== cible && !decide) {
      return 'ecart';
    }
  }
  if (p.etat === 'fait') return 'fait';
  if (p.etat === 'en_cours') return 'en_cours';
  return p.jourDecide ? 'a_faire' : 'a_planifier';
}

/**
 * Charge d'un créneau : nombre de productions non faites par échelle courte / moyenne / longue, en points.
 * La capacité réglée est facultative ; sans elle il n'y a jamais de surcharge.
 */
export function chargeCreneau(etat, date, creneau) {
  const res = {
    etatCreneau: etatCreneau(etat, date, creneau), courtes: 0, moyennes: 0, longues: 0, nonEstimees: 0,
    points: 0, capacite: etat.reglages?.capaciteCreneau ?? null, surcharge: false, alertes: [],
  };
  let nombreProductions = 0;
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat === 'fait' || p.jourDecide !== date || p.creneauDecide !== creneau) continue;
    nombreProductions += 1;
    const charge = etat.composants?.[p.composantId]?.charge;
    if (charge === 'courte') res.courtes += 1;
    else if (charge === 'moyenne') res.moyennes += 1;
    else if (charge === 'longue') res.longues += 1;
    else res.nonEstimees += 1;
  }
  res.points = res.courtes * POINTS_CHARGE.courte + res.moyennes * POINTS_CHARGE.moyenne + res.longues * POINTS_CHARGE.longue;
  res.surcharge = Number.isFinite(res.capacite) && res.points > res.capacite;
  if (nombreProductions > 0 && res.etatCreneau !== 'libre') {
    res.alertes.push(`créneau signalé ${res.etatCreneau === 'charge' ? 'chargé' : 'indisponible'} : production décidée sur ce créneau`);
  }
  if (res.surcharge) res.alertes.push('charge supérieure à la capacité réglée');
  return res;
}

function candidatsAvance(dateService, avanceMax) {
  const liste = [];
  for (let k = 0; k <= avanceMax; k += 1) {
    const date = ajouterJours(dateService, -k);
    if (!estOuvert(date)) continue;
    const creneaux = k === 0 ? ['avant_midi'] : ORDRE_CRENEAUX_INVERSE;
    for (const creneau of creneaux) if (creneauxDuJour(date).includes(creneau)) liste.push({ date, creneau });
  }
  return liste;
}

/**
 * Suggestion de jour et de créneau : le jour du service avant midi si possible, sinon on remonte créneau par
 * créneau (2 jours au plus, ou l'avance maximale de la règle). Jamais un créneau chargé ou indisponible,
 * jamais le dimanche, jamais une avance qui ne couvre pas le besoin.
 * @returns {{date:string, creneau:string, evaluation:object}|null}
 */
export function suggererCreneau(etat, productionId) {
  const p = etat.productions?.[productionId];
  if (!p || p.etat === 'fait') return null;
  const composant = etat.composants?.[p.composantId] ?? null;
  const regle = regleDe(etat, composant);
  const avanceMax = Number.isInteger(regle?.avanceMaxJours) && regle.avanceMaxJours >= 0 ? regle.avanceMaxJours : AVANCE_HABITUELLE;
  const points = POINTS_CHARGE[composant?.charge] ?? 0;
  for (const { date, creneau } of candidatsAvance(p.dateService, avanceMax)) {
    if (etatCreneau(etat, date, creneau) !== 'libre') continue;
    const charge = chargeCreneau(etat, date, creneau);
    const dejaLa = p.jourDecide === date && p.creneauDecide === creneau ? points : 0;
    if (Number.isFinite(charge.capacite) && charge.points - dejaLa + points > charge.capacite) continue;
    const evaluation = evaluerAvance(date, p.dateService, regle);
    if (evaluation.autorisee && evaluation.couvre) return { date, creneau, evaluation };
  }
  return null;
}

/** Ligne d'affichage d'une production (feuille du jour, avances). */
function ligne(etat, p) {
  const composant = etat.composants?.[p.composantId] ?? null;
  const calc = composant ? calculerComposant(etat, composant.id) : null;
  return {
    productionId: p.id, composantId: p.composantId, nom: composant?.nom ?? p.libelle, menu: composant?.menu ?? null,
    dateService: p.dateService, genre: p.genre, libelle: p.libelle, jourDecide: p.jourDecide,
    creneauDecide: p.creneauDecide, etat: etatTache(etat, p.id), cible: cibleProduction(etat, p.id),
    unite: p.unite ?? calc?.uniteTravail ?? null, quantiteReelle: p.quantiteReelle, charge: composant?.charge ?? null,
  };
}

/**
 * Productions non faites dont le service tombe dans les 4 jours suivants et qui ne sont pas décidées pour un
 * autre jour, avec l'évaluation de l'avance depuis `aujourdhui` et le premier créneau libre du jour
 * parmi après-midi / avant-soir (null s'il n'y en a pas).
 */
export function avancesPossibles(etat, aujourdhui) {
  const resultat = [];
  const creneauxPossibles = creneauxDuJour(aujourdhui).filter((c) => c === 'apres_midi' || c === 'avant_soir');
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat === 'fait' || !etat.composants?.[p.composantId]) continue;
    const jours = joursEntre(aujourdhui, p.dateService);
    if (jours < 1 || jours > HORIZON_AVANCES) continue;
    if (p.jourDecide && p.jourDecide !== aujourdhui) continue;
    const composant = etat.composants[p.composantId];
    const evaluation = evaluerAvance(aujourdhui, p.dateService, regleDe(etat, composant));
    const creneau = creneauxPossibles.find((c) => etatCreneau(etat, aujourdhui, c) === 'libre') ?? null;
    resultat.push({ ...ligne(etat, p), evaluation, creneau });
  }
  return resultat.sort((a, b) => a.dateService.localeCompare(b.dateService) || a.nom.localeCompare(b.nom));
}

/**
 * Feuille quotidienne.
 * - aFaire : par créneau du jour, productions non faites décidées ce jour (créneau null si non précisé) ;
 * - dejaPret : productions faites dont le service est ce jour ou plus tard, avec l'évaluation d'avance
 *   (couvre faux : affiché « non couvert ») ;
 * - attendus : productions non faites décidées un jour antérieur pour un service à venir (« prévu samedi ») ;
 * - decisions : à planifier ou écart à arbitrer, pour un service dans les 4 jours ;
 * - quantitesManquantes : les éléments « à préciser » (quantité inconnue) dans la même fenêtre. Ce n'est pas une
 *   décision : le chef saisit ou révise les quantités quand il veut, et tout se recalcule ;
 * - aAvancer : avances possibles non déjà décidées ce jour, seulement pour les éléments dont la quantité est connue ;
 *   revueMiSemaine : vrai le mardi.
 */
export function feuilleDuJour(etat, date) {
  const dejaPret = [];
  const attendus = [];
  const decisions = [];
  const quantitesManquantes = [];
  const parCreneau = new Map(creneauxDuJour(date).map((c) => [c, []]));
  const horizon = ajouterJours(date, HORIZON_AVANCES);
  for (const p of Object.values(etat.productions ?? {})) {
    const composant = etat.composants?.[p.composantId];
    if (!composant) continue;
    const l = ligne(etat, p);
    if (p.etat === 'fait') {
      if (p.dateService >= date) dejaPret.push({ ...l, evaluation: evaluationDe(etat, p, composant) });
    } else if (p.jourDecide === date) {
      const cle = parCreneau.has(p.creneauDecide) ? p.creneauDecide : null;
      if (!parCreneau.has(cle)) parCreneau.set(cle, []);
      parCreneau.get(cle).push(l);
    } else if (p.jourDecide && p.jourDecide < date && p.dateService >= date) {
      attendus.push(l);
    }
    if (['a_preciser', 'a_planifier', 'ecart'].includes(l.etat) && p.dateService >= date && p.dateService <= horizon
      && !(p.etat !== 'fait' && p.jourDecide && p.jourDecide < date)) {
      if (l.etat === 'a_preciser') quantitesManquantes.push(l);
      else decisions.push({ ...l, motif: l.etat });
    }
  }
  const aFaire = [...parCreneau.entries()].map(([creneau, taches]) => ({
    creneau, etatCreneau: creneau ? etatCreneau(etat, date, creneau) : null,
    charge: creneau ? chargeCreneau(etat, date, creneau) : null, taches,
  }));
  // Avancement du jour : productions décidées ce jour, faites ou non (la jauge « 3 sur 7 faits »).
  const decidees = Object.values(etat.productions ?? {}).filter((p) => p.jourDecide === date && etat.composants?.[p.composantId]);
  const avancement = { faites: decidees.filter((p) => p.etat === 'fait').length, total: decidees.length };
  const aAvancer = estOuvert(date) ? avancesPossibles(etat, date).filter((a) => a.jourDecide !== date && a.etat !== 'a_preciser') : [];
  return { aFaire, dejaPret, decisions, quantitesManquantes, aAvancer, attendus, avancement, revueMiSemaine: jourSemaine(date) === 2 };
}
