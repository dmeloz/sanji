// Planification par créneau, avances, écarts et feuille du jour.
// Les valeurs de charge sont des points (1, 2, 3), jamais des minutes.

import { ajouterJours, creneauxDuJour, estOuvert, joursEntre, jourSemaine } from './dates.js';
import { calculerComposant, arrondirQuantite, portionsMenu } from './calcul.js';
import { normaliser, jourOuVide } from './etat.js';
import { familleParCle } from './savoir.js';
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

/** Règle de préparation du nom du composant (clé = nom normalisé), ou null. */
function regleDuNom(etat, composant) {
  if (!composant) return null;
  const cle = normaliser(composant.nom);
  return Object.values(etat.regles ?? {}).find((r) => r.cle === cle) ?? null;
}

/**
 * Règle de préparation du composant (clé = nom normalisé), ou null. Avec `etapeCle` et une règle d'au moins deux
 * étapes : la règle de cette étape (`etape: true`, avance maximale de l'étape ; la finition vaut 0 jour à défaut).
 * Une avance d'étape n'est jamais une durée de conservation : seule la finition garde la limite d'utilisation du nom.
 * Sans étapes définies, ou pour une clé inconnue : la règle du nom, inchangée.
 */
export function regleDe(etat, composant, etapeCle = null) {
  const regle = regleDuNom(etat, composant);
  const etapes = regle?.etapes ?? [];
  if (!etapeCle || etapes.length < 2) return regle;
  const index = etapes.findIndex((x) => x.cle === etapeCle);
  if (index < 0) return regle;
  const finition = index === etapes.length - 1;
  const avance = Number.isInteger(etapes[index].avanceMaxJours) ? etapes[index].avanceMaxJours : null;
  return {
    ...regle, etape: true, etapeCle, finition,
    avanceMaxJours: avance ?? (finition ? 0 : null),
    limiteUtilisationJours: finition ? regle.limiteUtilisationJours : null,
  };
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
  if (regle?.etape) return evaluerEtape(res, regle, limite);
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

/** Avance d'une étape : son propre maximum (jamais la règle générale de deux jours seule, jamais une conservation). */
function evaluerEtape(res, regle, limite) {
  const maximum = Number.isFinite(regle.avanceMaxJours) ? regle.avanceMaxJours : null;
  res.exception = res.jours > AVANCE_HABITUELLE;
  if (maximum === null) {
    res.conservation = 'a_confirmer';
    res.autorisee = res.jours <= AVANCE_HABITUELLE;
    if (!res.autorisee) res.alertes.push("hors règle : avance de l'étape non définie, plus de deux jours");
    res.alertes.push('conservation à confirmer');
  } else {
    res.autorisee = res.jours <= maximum;
    if (regle.finition) res.conservation = limite === null ? 'a_confirmer' : (limite >= res.jours ? 'validee' : 'depassee');
    if (!res.autorisee) res.alertes.push(`hors règle : avance de ${res.jours} jours, maximum ${maximum} pour cette étape`);
    else if (res.exception) res.alertes.push("avance exceptionnelle autorisée par la règle de l'étape");
    if (res.conservation === 'a_confirmer') res.alertes.push('conservation à confirmer');
    if (res.conservation === 'depassee') res.alertes.push("limite d'utilisation dépassée : le besoin n'est pas couvert");
  }
  res.couvre = res.autorisee && res.conservation !== 'depassee';
  return res;
}

/** Date de production d'une production : le jour décidé, à défaut la date du marquage « fait ». */
function dateProduction(prod) {
  return prod.jourDecide ?? (prod.hFait ? String(prod.hFait).slice(0, 10) : null);
}

function evaluationDe(etat, prod, composant) {
  const date = dateProduction(prod);
  return date ? evaluerAvance(date, prod.dateService, regleDe(etat, composant, prod.etapeCle ?? null)) : null;
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
  const regle = regleDe(etat, composant, p.etapeCle ?? null);
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

/**
 * Base d'une recette du menu 1 (pâtes, riz à risotto) : production principale d'un composant de menu 1, féculent, plat
 * principal. Elle se fait le jour même : pas d'avance proposée, sauf si la règle de préparation du nom définit
 * explicitement une avance maximale supérieure à 0 (exception validée par la propriétaire).
 */
function sansAvanceParDefaut(etat, composant, p) {
  if (!composant || p.genre !== 'principale') return false;
  if (composant.menu !== 1 || composant.categorie !== 'feculent' || composant.role !== 'plat_principal') return false;
  const avance = regleDe(etat, composant, p.etapeCle ?? null)?.avanceMaxJours;
  return !(Number.isInteger(avance) && avance > 0);
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
    etatPoids: etatPoidsDe(composant, calc), hFait: p.hFait ?? null, etapeCle: p.etapeCle ?? null, ordre: p.ordre ?? null,
  };
}

/**
 * Étapes d'un composant pour l'affichage, dans l'ordre : les préparatoires d'étape puis la finition (production
 * principale). Vide si le composant n'a pas de règle d'étapes (ni étape déjà faite).
 * @returns {{etapeCle:string, libelle:string, ordre:number, etat:string, faitLe:string|null, jourDecide:string|null}[]}
 */
export function etapesComposant(etat, composantId) {
  const composant = etat.composants?.[composantId];
  if (!composant) return [];
  const etapes = regleDuNom(etat, composant)?.etapes ?? [];
  const libelleDe = (cle, repli) => etapes.find((x) => x.cle === cle)?.libelle ?? repli;
  const lignes = [];
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.composantId !== composantId || !p.etapeCle) continue;
    lignes.push({
      etapeCle: p.etapeCle, libelle: libelleDe(p.etapeCle, p.libelle), ordre: p.ordre ?? 0, etat: etatTache(etat, p.id),
      faitLe: p.etat === 'fait' && p.hFait ? String(p.hFait).slice(0, 10) : null, jourDecide: p.jourDecide ?? null,
    });
  }
  return lignes.sort((a, b) => a.ordre - b.ordre);
}

/**
 * Contrôle d'ordre entre les étapes d'un même composant ; retourne un message de refus ou null.
 * Planifier (`date`) : une étape ne tombe ni après l'étape suivante, ni avant la précédente.
 * Fait (`fait`) : l'étape précédente doit déjà être faite.
 */
export function refusOrdreEtape(etat, p, { date = null, fait = false } = {}) {
  if (!p.etapeCle || !Number.isInteger(p.ordre)) return null;
  const soeurs = Object.values(etat.productions ?? {}).filter((x) => x.composantId === p.composantId && x.id !== p.id
    && x.etapeCle && Number.isInteger(x.ordre));
  const nom = (x) => String(x.libelle).split(' : ')[0];
  if (fait) {
    const manquante = soeurs.filter((x) => x.ordre < p.ordre && x.etat !== 'fait').sort((a, b) => a.ordre - b.ordre)[0];
    return manquante ? `L'étape « ${nom(manquante)} » doit être faite avant « ${nom(p)} ».` : null;
  }
  for (const x of soeurs) {
    const jour = dateProduction(x);
    if (!jour || !date) continue;
    if (x.ordre > p.ordre && jour < date) return `« ${nom(p)} » ne peut pas se faire après l'étape suivante « ${nom(x)} » (${jour}).`;
    if (x.ordre < p.ordre && jour > date) return `« ${nom(p)} » ne peut pas se faire avant l'étape précédente « ${nom(x)} » (${jour}).`;
  }
  return null;
}

/** État du poids de la quantité affichée : `sec`, `cru_net`, `cuit`, `fini` (préparation maison) ou null si inconnu. */
function etatPoidsDe(composant, calc) {
  if (!composant || !calc) return null;
  if (composant.type === 'preparation_maison') return 'fini';
  return calc.dependances.find((d) => d.parametre === 'grammage')?.etat ?? null;
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
    // Pâtes et risotto du menu 1 : jour même. Déjà planifiée ce jour à la main : elle reste affichée, avec son évaluation.
    if (!p.jourDecide && sansAvanceParDefaut(etat, composant, p)) continue;
    const evaluation = evaluerAvance(aujourdhui, p.dateService, regleDe(etat, composant, p.etapeCle ?? null));
    const creneau = creneauxPossibles.find((c) => etatCreneau(etat, aujourdhui, c) === 'libre') ?? null;
    resultat.push({ ...ligne(etat, p), evaluation, creneau });
  }
  return resultat.sort((a, b) => a.dateService.localeCompare(b.dateService) || a.nom.localeCompare(b.nom));
}

/**
 * Lots possibles : productions non faites d'une même famille de produits et d'une même unité, que l'on peut toutes
 * faire `aujourdhui` dans la limite d'avance autorisée (jamais hors règle), et dont la cible est connue. Une SUGGESTION
 * (une casserole pour plusieurs services) : chaque production garde sa cible, son réel et son service, et se marque
 * faite séparément. Il faut au moins deux productions pour former un lot.
 * @returns {{famille:string, libelle:string, unite:string, total:number,
 *   productions:{productionId:string, composantId:string, nom:string, dateService:string, cible:number, evaluation:object}[]}[]}
 */
export function lotsPossibles(etat, aujourdhui) {
  if (!estOuvert(aujourdhui)) return [];
  const groupes = new Map();
  for (const p of Object.values(etat.productions ?? {})) {
    const composant = etat.composants?.[p.composantId];
    if (!composant?.famille || p.genre !== 'principale' || p.etat === 'fait') continue;
    if (p.jourDecide && p.jourDecide !== aujourdhui) continue;
    if (joursEntre(aujourdhui, p.dateService) < 0) continue;
    if (!p.jourDecide && p.dateService > aujourdhui && sansAvanceParDefaut(etat, composant, p)) continue;
    const cible = cibleProduction(etat, p.id);
    const unite = p.unite ?? calculerComposant(etat, composant.id).uniteTravail ?? null;
    if (cible === null || !unite) continue;
    const evaluation = evaluerAvance(aujourdhui, p.dateService, regleDe(etat, composant, p.etapeCle ?? null));
    if (!evaluation.autorisee || !evaluation.couvre) continue;
    const cle = `${composant.famille}|${unite}`;
    if (!groupes.has(cle)) groupes.set(cle, { famille: composant.famille, unite, productions: [] });
    groupes.get(cle).productions.push({ productionId: p.id, composantId: composant.id, nom: composant.nom, dateService: p.dateService, cible, evaluation });
  }
  return [...groupes.values()]
    .filter((g) => g.productions.length >= 2)
    .map((g) => ({
      ...g,
      libelle: familleParCle(g.famille)?.libelle ?? g.famille,
      productions: g.productions.sort((a, b) => a.dateService.localeCompare(b.dateService)),
      total: g.productions.reduce((somme, x) => somme + x.cible, 0),
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle));
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
const ORDRE_CRENEAU_LECTURE = ['avant_midi', 'apres_midi', 'avant_soir'];
const rangCreneau = (c) => (ORDRE_CRENEAU_LECTURE.includes(c) ? ORDRE_CRENEAU_LECTURE.indexOf(c) : ORDRE_CRENEAU_LECTURE.length);

/**
 * Ordre de lecture de la feuille Jour (une seule liste, aucun filtre) : tâches pour le service du jour du menu 1,
 * du menu 2, autres tâches (préparatoires), puis « après service » = tout ce qui sert un jour suivant (avances
 * décidées ou seulement possibles). Les tâches faites sont à part (`faites`, repliées par la vue). Chaque ligne dit
 * d'où elle vient (`source`) et son écart de service en jours (`avanceJours`). Aucune tâche ne dépend d'une donnée
 * qui manque : une quantité inconnue donne une ligne « à préciser », pas une absence.
 */
function rangLecture(c) {
  if (c?.role === 'plat_principal' && c.categorie === 'feculent') return 0;
  if (c?.role === 'garniture') return c.categorie === 'feculent' ? 1 : c.categorie === 'legume' ? 2 : 3;
  if (c?.role === 'composant_recette') return 4;
  if (c?.role === 'herbe') return 5;
  if (c?.role === 'sauce') return 6;
  return 7;
}

function lectureDuJour(etat, date, f) {
  const service1 = [];
  const service2 = [];
  const autres = [];
  const apres = [];
  const classees = new Set();
  const classer = (l, source, creneau = l.creneauDecide ?? null) => {
    classees.add(l.productionId);
    const ligneLue = { ...l, source, creneau, avanceJours: Math.max(0, joursEntre(date, l.dateService)) };
    if (l.dateService > date) apres.push(ligneLue);
    else if (l.genre === 'preparatoire') autres.push(ligneLue);
    else if (l.menu === 1) service1.push(ligneLue);
    else if (l.menu === 2) service2.push(ligneLue);
    else autres.push(ligneLue);
  };
  for (const g of f.aFaire) for (const t of g.taches) classer(t, 'decidee', g.creneau);
  for (const t of f.attendus) classer(t, 'attendue');
  // Un service du jour pas encore planifié reste dans la liste de travail (jamais seulement dans les décisions).
  const dejaPlacees = new Set();
  for (const d of f.decisions) {
    if (d.motif === 'a_planifier' && d.dateService <= date) { classer(d, 'a_planifier'); dejaPlacees.add(d.productionId); }
  }
  // Une quantité inconnue ne retire pas la ligne d'un service du jour : « quantité à compléter », sans alerte.
  // Une tâche déjà classée (planifiée aujourd'hui, quantité inconnue) n'est pas reprise : une seule ligne, comptée une fois.
  for (const q of f.quantitesManquantes) if (q.dateService <= date && !classees.has(q.productionId)) classer(q, 'a_preciser');
  for (const a of f.aAvancer) classer(a, 'suggestion', a.creneau);
  // À créneau et nom égaux, les étapes d'une même préparation se lisent dans l'ordre de la règle.
  const parNom = (a, b) => rangCreneau(a.creneau) - rangCreneau(b.creneau) || String(a.nom).localeCompare(String(b.nom))
    || (a.ordre ?? 0) - (b.ordre ?? 0);
  autres.sort(parNom);
  // Menus 1 et 2 : lecture par rôle (base féculent, garnitures, protéine ou poisson, herbe, sauce), puis ordre de l'intitulé.
  for (const [menu, liste] of [[1, service1], [2, service2]]) {
    const intitule = normaliser(jourOuVide(etat, date).menus?.[menu]?.intitule ?? '');
    const rang = (l) => rangLecture(etat.composants?.[l.composantId]);
    const place = (l) => { const i = intitule.indexOf(normaliser(String(l.nom))); return i < 0 ? Infinity : i; };
    liste.sort((a, b) => rang(a) - rang(b) || (place(a) === place(b) ? 0 : place(a) < place(b) ? -1 : 1) || parNom(a, b));
  }
  apres.sort((a, b) => a.dateService.localeCompare(b.dateService) || parNom(a, b));
  const faites = [...f.dejaPret];
  const vues = new Set(faites.map((x) => x.productionId));
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat === 'fait' && p.jourDecide === date && !vues.has(p.id) && etat.composants?.[p.composantId]) faites.push(ligne(etat, p));
  }
  const aAvancerIds = new Set(f.aAvancer.map((a) => a.productionId));
  const decisions = f.decisions.filter((d) => !dejaPlacees.has(d.productionId)
    && !(d.motif === 'a_planifier' && aAvancerIds.has(d.productionId)));
  const jour = jourOuVide(etat, date);
  const menus = [1, 2].map((menu) => ({ menu, intitule: String(jour.menus?.[menu]?.intitule ?? '').trim() }));
  const couverts = {};
  for (const menu of [1, 2]) {
    const portions = portionsMenu(etat, date, menu);
    couverts[menu] = menus[menu - 1].intitule !== '' && (portions.total > 0 || !portions.previsionManquante) ? Math.round(portions.total) : null;
  }
  const connus = [couverts[1], couverts[2]].filter((n) => n !== null);
  const fiches = Object.values(etat.fiches ?? {}).filter((x) => x.statut === 'active' && x.date === date)
    .sort((a, b) => String(a.horaire).localeCompare(String(b.horaire)));
  return {
    service1, service2, autres, apres, faites, decisions, menus, fiches,
    couverts: { 1: couverts[1], 2: couverts[2], total: connus.length > 0 ? connus.reduce((s, n) => s + n, 0) : null },
  };
}

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
      else if (l.etat === 'a_planifier' && p.dateService > date && sansAvanceParDefaut(etat, composant, p)) continue;
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
  const lots = estOuvert(date) ? lotsPossibles(etat, date) : [];
  const resultat = { aFaire, dejaPret, decisions, quantitesManquantes, aAvancer, lots, attendus, avancement, revueMiSemaine: jourSemaine(date) === 2 };
  resultat.lecture = lectureDuJour(etat, date, resultat);
  return resultat;
}
