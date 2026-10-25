// Planification par date (jour décidé), avances, écarts et feuille du jour. Plus aucun créneau horaire (v134).

import { ajouterJours, estOuvert, joursEntre, jourSemaine } from './dates.js';
import { valeurEffective } from './ajustements.js';
import { calculerComposant, arrondirQuantite, portionsMenu } from './calcul.js';
import { normaliser, jourOuVide } from './etat.js';
import { familleParCle } from './savoir.js';
import { reperesConservation, standardDeBase } from './standards-base.js';

const AVANCE_HABITUELLE = 2;
const HORIZON_AVANCES = 4;

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
 * Repère de conservation du référentiel (standard de base) pour un composant : la plus courte des durées en jours des
 * produits cuits de sa famille (borne prudente), ou null. Il AVERTIT seulement, il ne bloque jamais : seule la limite
 * d'utilisation saisie par la propriétaire (`limiteUtilisationJours`) a un effet bloquant.
 * Avec `etat`, la valeur ajustée par la propriétaire (`etat.ajustements`, plus courte ou plus longue) passe devant :
 * « se garde N jours (votre valeur) ».
 * @returns {{jours:number, texte:string, provenance:string}|null}
 */
export function repereConservation(composant, etat = null) {
  if (!composant?.famille) return null;
  const candidats = reperesConservation(composant.famille)
    .filter((x) => x.unite === 'jours' && Number.isFinite(x.valeur) && (!x.etatPoids || x.etatPoids === 'cuit'));
  if (candidats.length === 0) return null;
  if (etat) {
    // Votre valeur passe devant : la plus précise des valeurs ajustées (famille, groupe, règle générale) remplace le standard.
    const groupe = familleParCle(composant.famille)?.groupe;
    const sujets = [composant.famille, ...(groupe ? [`groupe:${groupe}`] : []), ...candidats.map((x) => {
      const c = x.cible ?? {};
      return c.famille ?? (c.groupe ? `groupe:${c.groupe}` : c.regle_generale ? `regle:${c.regle_generale}` : null);
    })];
    for (const sujet of sujets) {
      const eff = sujet ? valeurEffective(etat, sujet, 'conservation') : null;
      if (!eff?.ajuste || eff.unite !== 'jours') continue;
      const u = eff.valeur > 1 ? 'jours' : 'jour';
      return {
        jours: eff.valeur,
        texte: `se garde ${String(eff.valeur).replace('.', ',')} ${u}`,
        provenance: 'votre valeur',
      };
    }
  }
  const std = candidats.reduce((a, b) => (b.valeur < a.valeur ? b : a));
  const unite = std.valeur > 1 ? 'jours' : 'jour';
  return {
    jours: std.valeur,
    texte: `se garde ${String(std.valeur).replace('.', ',')} ${unite}`,
    provenance: 'standard de base',
  };
}

/**
 * Phrase d'aide sur le refroidissement après cuisson (standard de base : de 50 à 10 °C en 2 h au plus), ou null si le
 * référentiel ne le donne pas. Information, jamais un blocage.
 */
export function aideRefroidissement() {
  const std = standardDeBase(null, 'refroidissement', { regle: 'refroidissement' });
  if (!std || std.unite !== 'h') return null;
  return `Refroidir vite après la cuisson : ${String(std.valeur).replace('.', ',')} ${std.uniteSource} au plus (standard de base, ${std.origine === 'referentiel' ? 'référentiel culinaire' : 'base métier'}).`;
}

/**
 * Évalue une avance de travail (voir conception, section 8).
 * @param {string|null} dateProduction
 * @param {string} dateService
 * @param {object|null} regle règle de préparation (avanceMaxJours, limiteUtilisationJours)
 * @param {{jours:number, texte:string, provenance:string}|null} [repere] (absent = null) repère de conservation du référentiel
 *   (`repereConservation`), lu seulement quand la propriétaire n'a pas saisi de limite : il avertit, il ne bloque pas.
 * @returns {{jours:number|null, exception:boolean, autorisee:boolean,
 *   conservation:'sans_objet'|'validee'|'a_confirmer'|'referentiel'|'depassee', couvre:boolean, alertes:string[],
 *   repere?:{jours:number, texte:string, provenance:string, depasse:boolean}}}
 */
export function evaluerAvance(dateProduction, dateService, regle, repere) {
  const res = { jours: null, exception: false, autorisee: false, conservation: 'sans_objet', couvre: false, alertes: [] };
  if (!dateProduction) { res.alertes.push('date de production non décidée'); return res; }
  res.jours = joursEntre(dateProduction, dateService);
  if (res.jours < 0) { res.alertes.push('production prévue après le service'); return res; }
  if (!estOuvert(dateProduction)) { res.alertes.push('dimanche : jour non travaillé'); return res; }
  if (res.jours === 0) { res.autorisee = true; res.couvre = true; return res; }
  const limite = Number.isFinite(regle?.limiteUtilisationJours) ? regle.limiteUtilisationJours : null;
  if (regle?.etape) return evaluerEtape(res, regle, limite, repere);
  if (limite === null) appliquerRepere(res, repere);
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

/**
 * Sans limite saisie : le repère du référentiel remplace « conservation à confirmer ». Une avance plus longue que la
 * durée du repère donne un avertissement, jamais un blocage ni un classement « hors règle ».
 */
function appliquerRepere(res, repere) {
  if (!repere || !Number.isFinite(repere.jours)) { res.conservation = 'a_confirmer'; return; }
  res.conservation = 'referentiel';
  const depasse = res.jours > repere.jours;
  res.repere = { ...repere, depasse };
  if (depasse) res.alertes.push(`avertissement de conservation : ${repere.texte}, avance de ${res.jours} jours`);
}

/** Avance d'une étape : son propre maximum (jamais la règle générale de deux jours seule, jamais une conservation). */
function evaluerEtape(res, regle, limite, repere) {
  const maximum = Number.isFinite(regle.avanceMaxJours) ? regle.avanceMaxJours : null;
  res.exception = res.jours > AVANCE_HABITUELLE;
  if (maximum === null) {
    res.conservation = 'a_confirmer';
    res.autorisee = res.jours <= AVANCE_HABITUELLE;
    if (!res.autorisee) res.alertes.push("hors règle : avance de l'étape non définie, plus de deux jours");
    res.alertes.push('conservation à confirmer');
  } else {
    res.autorisee = res.jours <= maximum;
    if (regle.finition) {
      if (limite === null) appliquerRepere(res, repere);
      else res.conservation = limite >= res.jours ? 'validee' : 'depassee';
    }
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

/**
 * Date réelle de production, pour dater une conservation : celle du marquage « fait » si la production est faite
 * (elle a pu être faite avant son jour prévu), sinon le jour décidé.
 */
export function dateRealiseeProduction(prod) {
  if (prod.etat === 'fait' && prod.hFait) return String(prod.hFait).slice(0, 10);
  return dateProduction(prod);
}

function evaluationDe(etat, prod, composant, reelle = false) {
  const date = reelle ? dateRealiseeProduction(prod) : dateProduction(prod);
  return date ? evaluerAvance(date, prod.dateService, regleDe(etat, composant, prod.etapeCle ?? null), repereConservation(composant, etat)) : null;
}

/** Évaluation de l'avance d'une production (null si sa date de production est inconnue). `reelle` : partir de la date réelle du « fait » (conservation). */
export function evaluationProduction(etat, productionId, { reelle = false } = {}) {
  const p = etat.productions?.[productionId];
  if (!p) return null;
  return evaluationDe(etat, p, etat.composants?.[p.composantId] ?? null, reelle);
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

/**
 * Quantités réellement faites que l'écart ne compte PAS (même règle que `sommeReelsCouvrants`) et pourquoi : un réel fait
 * un dimanche (jour non travaillé), après le service, hors règle ou au-delà de la limite d'utilisation ne couvre pas le
 * besoin. Sert à dire pourquoi « il manque » une quantité alors que le réel égale la cible.
 * @returns {{quantite:number, raison:string}|null} null quand tout le réel est compté
 */
export function reelNonCompte(etat, composantId) {
  const composant = etat.composants?.[composantId];
  let quantite = 0;
  let raison = '';
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.composantId !== composantId || p.etat !== 'fait' || p.genre === 'preparatoire' || !Number.isFinite(p.quantiteReelle)) continue;
    const ev = evaluationDe(etat, p, composant);
    if (!ev || ev.couvre) continue;
    quantite += p.quantiteReelle;
    if (!raison) raison = ev.alertes[0] ?? 'ne couvre pas le besoin';
  }
  return quantite > 0 ? { quantite, raison } : null;
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
      // Un « fait » sans quantité (cible inconnue au moment du pointage) n'a pas de réel à comparer : jamais un écart.
      const ecart = Number.isFinite(p.quantiteReelle) ? ecartProduction(etat, p.composantId) : null;
      if (ecart !== null && ecart !== 0 && !decide) return 'ecart';
    } else if (p.etat === 'en_cours' && p.cibleAuDemarrage !== cible && !decide) {
      return 'ecart';
    }
  }
  if (p.etat === 'fait') return 'fait';
  if (p.etat === 'en_cours') return 'en_cours';
  return p.jourDecide ? 'a_faire' : 'a_planifier';
}

/** Avance maximale d'une règle (jours) : la sienne si elle est valide, sinon l'avance habituelle de deux jours. */
export function avanceMaxDe(regle) {
  return Number.isInteger(regle?.avanceMaxJours) && regle.avanceMaxJours >= 0 ? regle.avanceMaxJours : AVANCE_HABITUELLE;
}

/** Dates candidates : le jour du service puis J-1, J-2… jusqu'à l'avance maximale ; le dimanche est sauté. */
function candidatsAvance(dateService, avanceMax) {
  const liste = [];
  for (let k = 0; k <= avanceMax; k += 1) {
    const date = ajouterJours(dateService, -k);
    if (estOuvert(date)) liste.push(date);
  }
  return liste;
}

/**
 * Suggestion de jour : le jour du service si possible, sinon on remonte jour par jour (2 jours au plus, ou l'avance
 * maximale de la règle). Jamais le dimanche, jamais une avance qui ne couvre pas le besoin. `depuis` (date) écarte les
 * jours déjà passés. Aucune capacité ni disponibilité : la date seule.
 * @returns {{date:string, evaluation:object}|null}
 */
export function suggererJour(etat, productionId, depuis = null) {
  const p = etat.productions?.[productionId];
  if (!p || p.etat === 'fait') return null;
  const composant = etat.composants?.[p.composantId] ?? null;
  const regle = regleDe(etat, composant, p.etapeCle ?? null);
  for (const date of candidatsAvance(p.dateService, avanceMaxDe(regle))) {
    if (depuis && date < depuis) continue;
    const evaluation = evaluerAvance(date, p.dateService, regle, repereConservation(composant, etat));
    if (evaluation.autorisee && evaluation.couvre) return { date, evaluation };
  }
  return null;
}

/**
 * Base d'une recette du menu 1 (pâtes, riz à risotto) : production principale d'un composant de menu 1, féculent, plat
 * principal. Elle se fait le jour même : pas d'avance proposée, sauf si la règle de préparation du nom définit
 * explicitement une avance maximale supérieure à 0 (exception validée par la propriétaire).
 */
export function sansAvanceParDefaut(etat, composant, p) {
  if (!composant || p.genre !== 'principale') return false;
  if (composant.menu !== 1 || composant.categorie !== 'feculent' || composant.role !== 'plat_principal') return false;
  const avance = regleDe(etat, composant, p.etapeCle ?? null)?.avanceMaxJours;
  return !(Number.isInteger(avance) && avance > 0);
}

/** Jour de production d'une production non faite : le jour décidé, le jour du service (sans avance) ou la date la plus ancienne sans avertissement. */
function jourDeUneProduction(etat, p, composant, depuis) {
  if (p.jourDecide) return { date: p.jourDecide, planifie: true };
  if (sansAvanceParDefaut(etat, composant, p)) return { date: p.dateService, planifie: false };
  const regle = regleDe(etat, composant, p.etapeCle ?? null);
  const repere = repereConservation(composant, etat);
  let retenue = p.dateService;
  for (const date of candidatsAvance(p.dateService, avanceMaxDe(regle))) {
    if (date < depuis || date >= retenue) continue;
    const ev = evaluerAvance(date, p.dateService, regle, repere);
    if (ev.autorisee && ev.couvre && !ev.repere?.depasse) retenue = date;
  }
  return { date: retenue, planifie: false };
}

/**
 * Jour où le poste doit avoir les articles d'un composant : le plus ancien de ses jours de production non faits (avances
 * comprises), borné à `depuis` (premier jour ouvert d'aujourd'hui) et au jour du service. Un jour planifié à la main passe devant ;
 * pâtes et risotto du menu 1 : le jour du service ; une avance qui se garde moins longtemps (avertissement de conservation) recule.
 * @returns {{date:string, planifie:boolean}|null} null : composant inconnu, production principale faite ou service passé
 */
export function jourDeProduction(etat, composantId, depuis) {
  const composant = etat.composants?.[composantId];
  const productions = Object.values(etat.productions ?? {}).filter((p) => p.composantId === composantId);
  const principale = productions.find((p) => p.genre === 'principale');
  if (!composant || principale?.etat === 'fait') return null;
  // Sans production (composant non attribué ou non validé) : le jour du service, jamais une disparition.
  const dateService = principale?.dateService ?? composant.date;
  if (dateService < depuis) return null;
  const jours = productions.filter((p) => p.etat !== 'fait').map((p) => jourDeUneProduction(etat, p, composant, depuis));
  if (jours.length === 0) return { date: dateService, planifie: false };
  const premier = jours.reduce((a, b) => (b.date < a.date || (b.date === a.date && b.planifie) ? b : a));
  const date = [premier.date < depuis ? depuis : premier.date, dateService].sort()[0];
  return { date, planifie: premier.planifie };
}

/** Ligne d'affichage d'une production (feuille du jour, avances). */
function ligne(etat, p) {
  const composant = etat.composants?.[p.composantId] ?? null;
  const calc = composant ? calculerComposant(etat, composant.id) : null;
  return {
    productionId: p.id, composantId: p.composantId, nom: composant?.nom ?? p.libelle, menu: composant?.menu ?? null,
    dateService: p.dateService, genre: p.genre, libelle: p.libelle, jourDecide: p.jourDecide,
    etat: etatTache(etat, p.id), cible: cibleProduction(etat, p.id),
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
 * Annuler un « fait » (`annuler`) : aucune étape suivante ne doit être faite.
 */
export function refusOrdreEtape(etat, p, { date = null, fait = false, annuler = false } = {}) {
  if (!p.etapeCle || !Number.isInteger(p.ordre)) return null;
  const soeurs = Object.values(etat.productions ?? {}).filter((x) => x.composantId === p.composantId && x.id !== p.id
    && x.etapeCle && Number.isInteger(x.ordre));
  const nom = (x) => String(x.libelle).split(' : ')[0];
  if (annuler) {
    const suivante = soeurs.filter((x) => x.ordre > p.ordre && x.etat === 'fait').sort((a, b) => a.ordre - b.ordre)[0];
    return suivante ? `L'étape « ${nom(suivante)} » est déjà faite : défaites-la d'abord avant d'annuler « ${nom(p)} ».` : null;
  }
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
 * autre jour, avec l'évaluation de l'avance depuis `aujourdhui`.
 */
export function avancesPossibles(etat, aujourdhui) {
  const resultat = [];
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat === 'fait' || !etat.composants?.[p.composantId]) continue;
    const jours = joursEntre(aujourdhui, p.dateService);
    if (jours < 1 || jours > HORIZON_AVANCES) continue;
    if (p.jourDecide && p.jourDecide !== aujourdhui) continue;
    const composant = etat.composants[p.composantId];
    // Pâtes et risotto du menu 1 : jour même. Déjà planifiée ce jour à la main : elle reste affichée, avec son évaluation.
    if (!p.jourDecide && sansAvanceParDefaut(etat, composant, p)) continue;
    const evaluation = evaluerAvance(aujourdhui, p.dateService, regleDe(etat, composant, p.etapeCle ?? null), repereConservation(composant, etat));
    resultat.push({ ...ligne(etat, p), evaluation });
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
    const evaluation = evaluerAvance(aujourdhui, p.dateService, regleDe(etat, composant, p.etapeCle ?? null), repereConservation(composant, etat));
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
 * - aFaire : productions non faites décidées ce jour, à plat ;
 * - dejaPret : productions faites dont le service est ce jour ou plus tard, avec l'évaluation d'avance
 *   (couvre faux : affiché « non couvert ») ;
 * - attendus : productions non faites décidées un jour antérieur pour un service à venir (« prévu samedi ») ;
 * - decisions : à planifier ou écart à arbitrer, pour un service dans les 4 jours ;
 * - quantitesManquantes : les éléments « à préciser » (quantité inconnue) dans la même fenêtre. Ce n'est pas une
 *   décision : le chef saisit ou révise les quantités quand il veut, et tout se recalcule ;
 * - aAvancer : avances possibles non déjà décidées ce jour, seulement pour les éléments dont la quantité est connue ;
 *   revueMiSemaine : vrai le mardi.
 */
/**
 * Ordre de lecture de la feuille Jour (une seule liste, aucun filtre) : tâches pour le service du jour du menu 1,
 * du menu 2, autres tâches (préparatoires), puis « après service » = tout ce qui sert un jour suivant (avances
 * décidées ou seulement possibles). Les tâches faites aujourd'hui restent dans leur section (`fait: true`) ; `pretsPlusTard` = faites un jour précédent pour un service à venir. Chaque ligne dit
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
  const classer = (l, source, fait = false) => {
    classees.add(l.productionId);
    const ligneLue = { ...l, source, fait, avanceJours: Math.max(0, joursEntre(date, l.dateService)) };
    if (l.dateService > date) apres.push(ligneLue);
    else if (l.genre === 'preparatoire') autres.push(ligneLue);
    else if (l.menu === 1) service1.push(ligneLue);
    else if (l.menu === 2) service2.push(ligneLue);
    else autres.push(ligneLue);
  };
  // Une tâche faite aujourd'hui (décidée ce jour, faite ce jour ou servie ce jour) reste à sa place, marquée `fait`.
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat !== 'fait' || !etat.composants?.[p.composantId]) continue;
    const faitCeJour = typeof p.hFait === 'string' && p.hFait.slice(0, 10) === date;
    if (p.jourDecide === date || p.dateService === date || faitCeJour) classer(ligne(etat, p), 'faite', true);
  }
  for (const t of f.aFaire) classer(t, 'decidee');
  for (const t of f.attendus) classer(t, 'attendue');
  // Un service du jour pas encore planifié reste dans la liste de travail (jamais seulement dans les décisions).
  const dejaPlacees = new Set();
  for (const d of f.decisions) {
    if (d.motif === 'a_planifier' && d.dateService <= date) { classer(d, 'a_planifier'); dejaPlacees.add(d.productionId); }
  }
  // Une quantité inconnue ne retire pas la ligne d'un service du jour : « quantité à compléter », sans alerte.
  // Une tâche déjà classée (planifiée aujourd'hui, quantité inconnue) n'est pas reprise : une seule ligne, comptée une fois.
  for (const q of f.quantitesManquantes) if (q.dateService <= date && !classees.has(q.productionId)) classer(q, 'a_preciser');
  for (const a of f.aAvancer) classer(a, 'suggestion');
  // À nom égal, les étapes d'une même préparation se lisent dans l'ordre de la règle.
  const parNom = (a, b) => String(a.nom).localeCompare(String(b.nom)) || (a.ordre ?? 0) - (b.ordre ?? 0);
  autres.sort(parNom);
  // Menus 1 et 2 : lecture par rôle (base féculent, garnitures, protéine ou poisson, herbe, sauce), puis ordre de l'intitulé.
  for (const [menu, liste] of [[1, service1], [2, service2]]) {
    const intitule = normaliser(jourOuVide(etat, date).menus?.[menu]?.intitule ?? '');
    const rang = (l) => rangLecture(etat.composants?.[l.composantId]);
    const place = (l) => { const i = intitule.indexOf(normaliser(String(l.nom))); return i < 0 ? Infinity : i; };
    liste.sort((a, b) => rang(a) - rang(b) || (place(a) === place(b) ? 0 : place(a) < place(b) ? -1 : 1) || parNom(a, b));
  }
  apres.sort((a, b) => a.dateService.localeCompare(b.dateService) || parNom(a, b));
  // Seules restent à part les productions faites un jour précédent pour un service à venir.
  const pretsPlusTard = f.dejaPret.filter((x) => !classees.has(x.productionId));
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
    service1, service2, autres, apres, pretsPlusTard, decisions, menus, fiches,
    couverts: { 1: couverts[1], 2: couverts[2], total: connus.length > 0 ? connus.reduce((s, n) => s + n, 0) : null },
  };
}

export function feuilleDuJour(etat, date) {
  const aFaire = [];
  const dejaPret = [];
  const attendus = [];
  const decisions = [];
  const quantitesManquantes = [];
  const horizon = ajouterJours(date, HORIZON_AVANCES);
  for (const p of Object.values(etat.productions ?? {})) {
    const composant = etat.composants?.[p.composantId];
    if (!composant) continue;
    const l = ligne(etat, p);
    if (p.etat === 'fait') {
      if (p.dateService >= date) dejaPret.push({ ...l, evaluation: evaluationDe(etat, p, composant) });
    } else if (p.jourDecide === date) {
      aFaire.push(l);
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
  // Avancement du jour : productions décidées ce jour, faites ou non (la jauge « 3 sur 7 faits »).
  const decidees = Object.values(etat.productions ?? {}).filter((p) => p.jourDecide === date && etat.composants?.[p.composantId]);
  const avancement = { faites: decidees.filter((p) => p.etat === 'fait').length, total: decidees.length };
  const aAvancer = estOuvert(date) ? avancesPossibles(etat, date).filter((a) => a.jourDecide !== date && a.etat !== 'a_preciser') : [];
  const lots = estOuvert(date) ? lotsPossibles(etat, date) : [];
  const resultat = { aFaire, dejaPret, decisions, quantitesManquantes, aAvancer, lots, attendus, avancement, revueMiSemaine: jourSemaine(date) === 2 };
  resultat.lecture = lectureDuJour(etat, date, resultat);
  return resultat;
}
