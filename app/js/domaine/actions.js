// Actions : elles modifient l'état reçu, ajoutent une ligne au journal et rétablissent les invariants.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.
// Invariant : aucune action (hors marquerFait et corrigerReel) ne touche à `quantiteReelle` ni à `instantane`.

import {
  aMenuDuJour, creneauxDuJour, creneauxDuJourSemaine, datesDeLaSemaine, estOuvert, estDateValide, jourSemaine,
} from './dates.js';
import {
  ajouterJournal, assurerJour, composantVide, ficheVide, fournisseurVide, memoireVide, normaliser, nouvelId,
  productionVide, recetteVide, regleVide, suiviProduitVide,
} from './etat.js';
import { categoriePropose, proposerComposants } from './analyse-menu.js';
import { calculerComposant } from './calcul.js';
import { chargeCreneau, cibleProduction, ecartProduction, evaluerAvance, regleDe } from './planification.js';
import { besoinsProduits, cleSuivi } from './produits.js';
import { appliquerSavoir, familleParCle, grammageEffectif, groupeDeCleStandard } from './savoir.js';
import {
  CATEGORIE, CHARGE, ETAPE, ETAT_CRENEAU, ETAT_POIDS, PROVENANCE, ROLE, TYPE_COMPOSANT, UNITE, VERIF,
} from './statuts.js';

const valeursDe = (enumeration) => Object.values(enumeration);
const STATUTS_SAISIE = valeursDe(PROVENANCE).filter((s) => s !== 'CALCULE');
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

// ---------------------------------------------------------------- vérifications

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}
function verifierDate(date) {
  if (!estDateValide(date)) throw new Error(`Date invalide : « ${date} » (format attendu AAAA-MM-JJ).`);
}
function verifierMenu(menu) {
  if (menu !== 1 && menu !== 2) throw new Error('Le menu doit être 1 ou 2.');
}
function verifierMenuDuJour(date, menu) {
  verifierDate(date);
  verifierMenu(menu);
  if (!aMenuDuJour(date)) throw new Error("Pas de menu du jour ce jour-là : les menus existent du lundi au vendredi.");
}
function verifierEntierOuNul(valeur, nom, minimum = 0) {
  if (valeur === null) return null;
  if (!Number.isInteger(valeur) || valeur < minimum) throw new Error(`${nom} : entier supérieur ou égal à ${minimum} attendu (ou vide).`);
  return valeur;
}
function verifierQuantiteOuNul(valeur, nom) {
  if (valeur === null) return null;
  if (!Number.isFinite(valeur) || valeur < 0) throw new Error(`${nom} : nombre positif ou nul attendu (ou vide).`);
  return valeur;
}
function verifierDans(valeur, enumeration, nom) {
  if (!valeursDe(enumeration).includes(valeur)) throw new Error(`${nom} : valeur inconnue « ${valeur} ».`);
  return valeur;
}
function cleSure(cle) {
  if (cle === '' || CLES_INTERDITES.has(cle)) throw new Error(`Clé interdite : « ${cle} ».`);
  return cle;
}

function exiger(collection, id, libelle) {
  if (!Object.hasOwn(collection, id)) throw new Error(`${libelle} introuvable : ${id}`);
  return collection[id];
}
const exigerComposant = (etat, id) => exiger(etat.composants, id, 'Composant');
const exigerProduction = (etat, id) => exiger(etat.productions, id, 'Production');
const exigerFiche = (etat, id) => exiger(etat.fiches, id, 'Fiche');
const exigerRecette = (etat, id) => exiger(etat.recettes, id, 'Recette');

function verifierLundi(lundi) {
  verifierDate(lundi);
  if (jourSemaine(lundi) !== 1) throw new Error(`« ${lundi} » n'est pas un lundi.`);
}

/**
 * Valide et copie un grammage { valeur, unite, statut, source, etat }. `etat` est l'état du poids de la portion
 * (sec, cru_net, cuit) ; absent, il se lit « cuit » (sens d'une quantité servie, comme les données déjà enregistrées).
 */
function normaliserGrammage(g, existant) {
  if (g === null || typeof g !== 'object') throw new Error('Grammage invalide.');
  const res = { ...existant, ...g };
  if (res.valeur !== null && (!Number.isFinite(res.valeur) || res.valeur <= 0)) {
    throw new Error('Le grammage doit être un nombre strictement positif (ou vide).');
  }
  verifierDans(res.unite, UNITE, 'Unité du grammage');
  if (!STATUTS_SAISIE.includes(res.statut)) throw new Error(`Provenance du grammage inconnue : « ${res.statut} ».`);
  const etat = res.etat ?? ETAT_POIDS.cuit;
  verifierDans(etat, ETAT_POIDS, 'État du poids');
  return { valeur: res.valeur, unite: res.unite, statut: res.statut, source: String(res.source ?? ''), etat };
}

/** Valide une liste d'étapes : étape connue et unique, coefficient > 0 (sortie / entrée), gain réservé à la cuisson. */
function normaliserEtapes(etapes) {
  if (!Array.isArray(etapes)) throw new Error('La liste des étapes est invalide.');
  const vues = new Set();
  return etapes.map((e) => {
    verifierDans(e.etape, ETAPE, "Étape");
    if (vues.has(e.etape)) throw new Error(`Étape en double : « ${e.etape} » ne peut figurer qu'une fois (une perte ne se compte jamais deux fois).`);
    vues.add(e.etape);
    if (!Number.isFinite(e.coefficient) || e.coefficient <= 0) {
      throw new Error(`Le coefficient de ${e.etape} doit être strictement positif (sortie ÷ entrée) : zéro et les valeurs négatives sont refusés.`);
    }
    if (e.coefficient > 1 && e.etape !== 'cuisson') {
      throw new Error(`Le coefficient de ${e.etape} ne peut pas dépasser 1 : seul un gain de cuisson (absorption) augmente la quantité.`);
    }
    const statut = e.statut ?? 'INCONNU';
    if (!STATUTS_SAISIE.includes(statut)) throw new Error(`Provenance de l'étape ${e.etape} inconnue : « ${statut} ».`);
    return { etape: e.etape, coefficient: e.coefficient, statut, source: String(e.source ?? '') };
  });
}

function terminer(etat, h, action, detail, valeur) {
  ajouterJournal(etat, h, action, detail);
  assurerProductions(etat);
  return valeur;
}

// ---------------------------------------------------------------- invariants

/**
 * Invariant : tout composant attribué ET validé a exactement une production « principale » ; un composant non
 * attribué, non validé ou supprimé perd ses productions non faites. Les productions faites ne sont jamais touchées.
 */
export function assurerProductions(etat) {
  for (const p of Object.values(etat.productions)) {
    const c = etat.composants[p.composantId];
    if (p.etat !== 'fait' && (!c || !c.attribue || !c.valide)) delete etat.productions[p.id];
    else if (p.etat !== 'fait' && c) p.dateService = c.date;
  }
  for (const c of Object.values(etat.composants)) {
    if (!c.attribue || !c.valide) continue;
    const principales = Object.values(etat.productions).filter((p) => p.composantId === c.id && p.genre === 'principale');
    if (principales.length === 0) {
      const id = nouvelId('prod');
      etat.productions[id] = { ...productionVide(id), composantId: c.id, dateService: c.date, libelle: c.nom };
    } else {
      for (const extra of principales.slice(1)) if (extra.etat !== 'fait') delete etat.productions[extra.id];
    }
  }
  return etat;
}

// ---------------------------------------------------------------- menus et composants

function creerComposant(etat, date, menu, champs) {
  const id = nouvelId('comp');
  const c = { ...composantVide(id), date, menu, nom: champs.nom, categorie: champs.categorie ?? 'a_preciser',
    attribue: champs.attribue ?? true, type: champs.type ?? 'a_preciser', valide: champs.valide ?? false };
  etat.composants[id] = c;
  return c;
}

/**
 * Régénère les composants d'un menu à partir de son intitulé, en FUSIONNANT : un composant dont le nom normalisé
 * est inchangé est conservé (réglages et productions compris) ; un composant disparu de l'intitulé est supprimé,
 * sauf s'il a une production faite ; un nom nouveau crée un composant « valide » qui reçoit le savoir de
 * l'application (appliquerSavoir). Aucune validation manuelle. Retourne les identifiants créés.
 */
function fusionnerComposants(etat, date, menu) {
  const m = etat.jours[date].menus[menu];
  const propositions = proposerComposants(m.intitule, menu, etat.memoire);
  const voulus = new Set(propositions.map((p) => normaliser(p.nom)));
  const duMenu = () => Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  for (const c of duMenu()) {
    if (voulus.has(normaliser(c.nom))) {
      c.valide = true; // plus de validation manuelle : un composant resté non validé par l'ancien parcours l'est désormais
      continue;
    }
    const aProductionFaite = Object.values(etat.productions).some((p) => p.composantId === c.id && p.etat === 'fait');
    if (!aProductionFaite) delete etat.composants[c.id];
  }
  const presents = new Set(duMenu().map((c) => normaliser(c.nom)));
  const ids = [];
  for (const p of propositions) {
    const cle = normaliser(p.nom);
    if (presents.has(cle)) continue;
    presents.add(cle);
    const c = creerComposant(etat, date, menu, { ...p, valide: true });
    appliquerSavoir(etat, c);
    ids.push(c.id);
  }
  const saisi = m.intitule.trim() !== '';
  m.transcriptionValidee = saisi;
  m.composantsValides = saisi;
  return ids;
}

/**
 * Enregistre l'intitulé d'un menu (sans journal). Les composants sont régénérés par fusion si l'intitulé a changé, ou
 * s'il est saisi mais pas encore validé (donnée d'avant la section 16) ; un intitulé identique ne change rien.
 */
function enregistrerMenu(etat, date, menu, texte) {
  const m = assurerJour(etat, date).menus[menu];
  const change = m.intitule !== texte;
  m.intitule = texte;
  if (change || (texte.trim() !== '' && !m.transcriptionValidee)) fusionnerComposants(etat, date, menu);
  return m;
}

/**
 * Saisit l'intitulé complet d'un menu (transcription exacte). L'intitulé enregistré vaut transcription validée
 * (`transcriptionValidee`, `composantsValides` : vrai) et les composants du menu sont régénérés par fusion.
 * Un intitulé identique à l'enregistré ne change rien.
 */
export function definirMenu(etat, date, menu, intitule, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  const m = enregistrerMenu(etat, date, menu, String(intitule ?? ''));
  return terminer(etat, h, 'definirMenu', `${date} menu ${menu}`, m);
}

/**
 * Compatibilité : le chef n'a plus à valider la transcription (definirMenu la valide). Conservée sans effet
 * nuisible : l'intitulé doit être non vide.
 */
export function validerTranscription(etat, date, menu, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  const m = assurerJour(etat, date).menus[menu];
  if (m.intitule.trim() === '') throw new Error("Rien à valider : l'intitulé du menu est vide.");
  m.transcriptionValidee = true;
  return terminer(etat, h, 'validerTranscription', `${date} menu ${menu}`, m);
}

/**
 * Régénère les composants du menu par fusion (comme definirMenu), sans exiger de validation préalable.
 * Retourne les identifiants des composants créés.
 */
export function genererComposants(etat, date, menu, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  assurerJour(etat, date);
  const ids = fusionnerComposants(etat, date, menu);
  return terminer(etat, h, 'genererComposants', `${date} menu ${menu} : ${ids.length} créé(s)`, ids);
}

/**
 * Saisie des menus d'une semaine d'un coup : `saisie = { [date]: { menu1, menu2, prevision1, prevision2 } }`, avec des
 * dates du lundi au vendredi de la semaine. Intitulé : chaîne vide ou absent = ne rien changer, null = effacer ;
 * les composants sont régénérés par fusion (comme definirMenu). Prévision : entier ≥ 0 ; null ou absent = ne rien
 * changer. Tout est vérifié avant la première modification ; une seule ligne de journal.
 * @returns {{menus:number, previsions:number}} nombre d'intitulés et de prévisions enregistrés
 */
export function saisirMenusSemaine(etat, lundi, saisie, h) {
  verifierH(h);
  verifierLundi(lundi);
  if (saisie === null || typeof saisie !== 'object' || Array.isArray(saisie)) throw new Error('Saisie de la semaine invalide.');
  const jours = datesDeLaSemaine(lundi).slice(0, 5);
  const horsSemaine = Object.keys(saisie).filter((d) => !jours.includes(d));
  if (horsSemaine.length > 0) throw new Error(`Date hors de la semaine du ${lundi} (lundi au vendredi) : ${horsSemaine.join(', ')}.`);
  for (const date of jours) {
    if (!Object.hasOwn(saisie, date)) continue;
    const j = saisie[date];
    if (j === null || typeof j !== 'object') throw new Error(`Saisie du ${date} invalide.`);
    for (const menu of [1, 2]) {
      const intitule = j[`menu${menu}`];
      if (intitule !== undefined && intitule !== null && typeof intitule !== 'string') throw new Error(`Menu ${menu} du ${date} : texte attendu.`);
      const prevision = j[`prevision${menu}`];
      if (prevision !== undefined) verifierEntierOuNul(prevision, `Prévision du menu ${menu} du ${date}`);
    }
  }
  let menus = 0;
  let previsions = 0;
  for (const date of jours) {
    if (!Object.hasOwn(saisie, date)) continue;
    for (const menu of [1, 2]) {
      const intitule = saisie[date][`menu${menu}`];
      if (typeof intitule === 'string' && intitule.trim() !== '') {
        enregistrerMenu(etat, date, menu, intitule.trim());
        menus += 1;
      } else if (intitule === null && etat.jours[date] && etat.jours[date].menus[menu].intitule !== '') {
        enregistrerMenu(etat, date, menu, '');
        menus += 1;
      }
      const prevision = saisie[date][`prevision${menu}`];
      if (Number.isInteger(prevision)) {
        assurerJour(etat, date).previsions[menu] = { portions: prevision, h };
        previsions += 1;
      }
    }
  }
  return terminer(etat, h, 'saisirMenusSemaine', `${lundi} : ${menus} menu(s), ${previsions} prévision(s)`, { menus, previsions });
}

/** Ajoute un composant à la main (non validé). champs : nom, categorie, attribue, type. */
export function ajouterComposant(etat, date, menu, champs, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  if (typeof champs?.nom !== 'string' || champs.nom.trim() === '') throw new Error('Le nom du composant est obligatoire.');
  if (champs.categorie !== undefined) verifierDans(champs.categorie, CATEGORIE, 'Catégorie');
  if (champs.type !== undefined) verifierDans(champs.type, TYPE_COMPOSANT, 'Type');
  // Sans catégorie donnée, l'application la déduit du nom ; une exception mémorisée pour ce nom prime sur la règle du menu.
  const nomPropre = champs.nom.trim();
  const categorie = champs.categorie ?? categoriePropose(nomPropre);
  const memorise = etat.memoire && Object.hasOwn(etat.memoire, normaliser(nomPropre)) ? etat.memoire[normaliser(nomPropre)] : null;
  const attribue = typeof champs.attribue === 'boolean' ? champs.attribue
    : typeof memorise?.attribue === 'boolean' ? memorise.attribue
      : menu === 1 || categorie === 'legume' || categorie === 'feculent';
  // Plus de validation manuelle (conception, section 16) : le composant est valide d'emblée et reçoit le savoir
  // de l'application (famille, rôle, type, étapes de la base), comme un composant issu de l'intitulé.
  const c = creerComposant(etat, date, menu, { ...champs, nom: nomPropre, categorie, attribue, valide: true });
  appliquerSavoir(etat, c);
  assurerJour(etat, date);
  return terminer(etat, h, 'ajouterComposant', `${c.nom} (${date} menu ${menu})`, c.id);
}

const CHAMPS_COMPOSANT = ['nom', 'categorie', 'attribue', 'type', 'role', 'produitNom', 'grammage', 'etapes', 'recetteId', 'charge', 'allergenes'];

/** Mémorise par nom, sans geste supplémentaire, l'attribution et la catégorie choisies par le chef (rien d'autre). */
function memoriserAttribution(etat, c) {
  const cle = normaliser(c.nom);
  if (cle === '' || CLES_INTERDITES.has(cle)) return;
  const m = Object.hasOwn(etat.memoire, cle) ? etat.memoire[cle] : memoireVide();
  Object.assign(m, { nom: c.nom, attribue: c.attribue, categorie: c.categorie });
  etat.memoire[cle] = m;
}

/**
 * Modifie un composant. Champs acceptés : nom, categorie, attribue, type, role, produitNom, grammage
 * ({valeur, unite, statut, source, etat}, fusionné avec l'existant), etapes (liste complète, remplace l'existante),
 * recetteId, charge, allergenes ({statut, liste}). Le champ `valide` ne se change que par validerComposant.
 * Une étape en double, un coefficient nul ou négatif sont refusés.
 * Seul un changement d'attribution (au poste ou non) ou de catégorie est mémorisé, par nom, et réappliqué à la saisie
 * suivante. Une correction de portion, de type ou d'étape reste sur ce plat : ni standard, ni base, ni autre plat.
 */
export function modifierComposant(etat, composantId, champs, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  const inconnus = Object.keys(champs ?? {}).filter((k) => !CHAMPS_COMPOSANT.includes(k));
  if (inconnus.length > 0) throw new Error(`Champ non modifiable : ${inconnus.join(', ')}.`);
  const maj = {};
  if ('nom' in champs) {
    if (typeof champs.nom !== 'string' || champs.nom.trim() === '') throw new Error('Le nom du composant est obligatoire.');
    maj.nom = champs.nom.trim();
  }
  if ('categorie' in champs) maj.categorie = verifierDans(champs.categorie, CATEGORIE, 'Catégorie');
  if ('attribue' in champs) {
    if (typeof champs.attribue !== 'boolean') throw new Error("« attribue » doit être vrai ou faux.");
    maj.attribue = champs.attribue;
  }
  if ('type' in champs) maj.type = verifierDans(champs.type, TYPE_COMPOSANT, 'Type');
  if ('role' in champs) maj.role = champs.role === null ? null : verifierDans(champs.role, ROLE, 'Rôle');
  if ('produitNom' in champs) maj.produitNom = String(champs.produitNom ?? '');
  if ('grammage' in champs) maj.grammage = normaliserGrammage(champs.grammage, c.grammage);
  if ('etapes' in champs) maj.etapes = normaliserEtapes(champs.etapes);
  if ('charge' in champs) maj.charge = champs.charge === null ? null : verifierDans(champs.charge, CHARGE, 'Charge');
  if ('recetteId' in champs) {
    if (champs.recetteId === null) { maj.recetteId = null; maj.recetteVersion = null; } else {
      maj.recetteId = champs.recetteId;
      maj.recetteVersion = exigerRecette(etat, champs.recetteId).version;
    }
  }
  if ('allergenes' in champs) {
    const a = { ...c.allergenes, ...champs.allergenes };
    if (!['a_confirmer', 'valide'].includes(a.statut)) throw new Error("Statut d'allergènes inconnu.");
    if (!Array.isArray(a.liste)) throw new Error("La liste d'allergènes est invalide.");
    maj.allergenes = { statut: a.statut, liste: [...a.liste], h: a.statut === 'valide' ? h : null };
  }
  const attributionChangee = ('attribue' in maj && maj.attribue !== c.attribue)
    || ('categorie' in maj && maj.categorie !== c.categorie);
  Object.assign(c, maj);
  if (attributionChangee) memoriserAttribution(etat, c);
  return terminer(etat, h, 'modifierComposant', `${c.nom} : ${Object.keys(maj).join(', ')}`, c);
}

/** Compatibilité : un composant créé par l'analyse est déjà valide. Conservée sans effet nuisible. */
export function validerComposant(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  c.valide = true;
  return terminer(etat, h, 'validerComposant', c.nom, c);
}

/** Supprime un composant et ses productions non faites (les productions faites sont conservées). */
export function supprimerComposant(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  delete etat.composants[composantId];
  return terminer(etat, h, 'supprimerComposant', c.nom, true);
}

/** Compatibilité : valide tous les composants du menu (transcription validée requise). Retourne les identifiants validés. */
export function validerComposantsMenu(etat, date, menu, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  const m = assurerJour(etat, date).menus[menu];
  if (!m.transcriptionValidee) throw new Error("Validez d'abord la transcription du menu.");
  const ids = [];
  for (const c of Object.values(etat.composants)) {
    if (c.date === date && c.menu === menu) { c.valide = true; ids.push(c.id); }
  }
  m.composantsValides = true;
  return terminer(etat, h, 'validerComposantsMenu', `${date} menu ${menu} : ${ids.length} composant(s)`, ids);
}

// ---------------------------------------------------------------- prévisions et fiches

/** Prévision de portions hors groupes (entier ≥ 0, ou null pour effacer), horodatée. Ne touche jamais au réel. */
export function definirPrevision(etat, date, menu, portions, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierEntierOuNul(portions, 'Prévision');
  const j = assurerJour(etat, date);
  const avant = j.previsions[menu].portions;
  j.previsions[menu] = { portions, h };
  return terminer(etat, h, 'definirPrevision', `${date} menu ${menu} : ${avant ?? '—'} -> ${portions ?? '—'}`, j.previsions[menu]);
}

function nombreRepartition(r) {
  if (r === null || typeof r !== 'object') throw new Error('Répartition invalide.');
  const res = {};
  for (const m of [1, 2]) {
    const v = r[m] ?? 0;
    if (!Number.isInteger(v) || v < 0) throw new Error(`Répartition du menu ${m} : entier supérieur ou égal à 0 attendu.`);
    res[m] = v;
  }
  return res;
}

const CHAMPS_FICHE = ['numero', 'date', 'service', 'horaire', 'couverts', 'mode', 'menuFixe', 'repartition', 'allergies', 'remarques'];

/** Applique des champs validés à une fiche ; renvoie la liste des champs réellement modifiés. */
function appliquerChampsFiche(fiche, champs) {
  const inconnus = Object.keys(champs ?? {}).filter((k) => !CHAMPS_FICHE.includes(k));
  if (inconnus.length > 0) throw new Error(`Champ de fiche non modifiable : ${inconnus.join(', ')}.`);
  const futur = { ...fiche, ...champs };
  verifierDate(futur.date);
  if (!['midi', 'soir'].includes(futur.service)) throw new Error('Le service doit être « midi » ou « soir ».');
  if (!['menu_fixe', 'choix_libre', 'hors_menu'].includes(futur.mode)) throw new Error('Mode de fiche inconnu.');
  if (!Number.isInteger(futur.couverts) || futur.couverts < 0) throw new Error('Les couverts : entier supérieur ou égal à 0 attendu.');
  if (futur.mode === 'menu_fixe' && futur.menuFixe !== 1 && futur.menuFixe !== 2) throw new Error('Un menu fixé doit indiquer le menu 1 ou 2.');
  const repartition = nombreRepartition(futur.repartition);
  const modifies = [];
  for (const k of CHAMPS_FICHE) {
    if (!(k in (champs ?? {}))) continue;
    const valeur = k === 'repartition' ? repartition : champs[k];
    if (JSON.stringify(valeur) !== JSON.stringify(fiche[k])) { fiche[k] = valeur; modifies.push(k); }
  }
  return modifies;
}

/**
 * Crée une fiche de fonction. champs : numero, date, service ('midi'|'soir'), horaire, couverts, mode
 * ('menu_fixe'|'choix_libre'|'hors_menu'), menuFixe (1|2), repartition {1,2}, allergies, remarques.
 * Une répartition de choix libre est toujours créée « provisoire ». Retourne l'identifiant.
 */
export function creerFiche(etat, champs, h) {
  verifierH(h);
  const id = nouvelId('fiche');
  const fiche = ficheVide(id);
  appliquerChampsFiche(fiche, champs);
  fiche.historique.push({ version: 1, h, resume: 'création' });
  etat.fiches[id] = fiche;
  return terminer(etat, h, 'creerFiche', `${fiche.date} ${fiche.service} ${fiche.numero}`, id);
}

/**
 * Modifie une fiche active : la version augmente et l'historique garde le résumé. Une répartition modifiée
 * redevient « provisoire » tant qu'elle n'est pas confirmée par confirmerRepartition.
 */
export function modifierFiche(etat, ficheId, champs, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (f.statut === 'annulee') throw new Error('Cette fiche est annulée : elle ne se modifie plus.');
  const modifies = appliquerChampsFiche(f, champs);
  if (modifies.includes('repartition') || modifies.includes('mode')) f.statutRepartition = 'provisoire';
  if (modifies.length > 0) {
    f.version += 1;
    f.historique.push({ version: f.version, h, resume: `modifiée : ${modifies.join(', ')}` });
  }
  return terminer(etat, h, 'modifierFiche', `${f.numero || f.id} : ${modifies.join(', ') || 'aucun changement'}`, f);
}

/** Annule une fiche : son besoin disparaît du calcul (la fiche reste consultable). */
export function annulerFiche(etat, ficheId, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (f.statut !== 'annulee') {
    f.statut = 'annulee';
    f.version += 1;
    f.historique.push({ version: f.version, h, resume: 'annulée' });
  }
  return terminer(etat, h, 'annulerFiche', f.numero || f.id, f);
}

/** Confirme le choix réel d'un groupe à choix libre : la répartition confirmée remplace la provisoire. */
export function confirmerRepartition(etat, ficheId, repartition, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (f.statut === 'annulee') throw new Error('Cette fiche est annulée.');
  if (f.mode !== 'choix_libre') throw new Error('Seule une fiche à choix libre a une répartition à confirmer.');
  f.repartition = nombreRepartition(repartition);
  f.statutRepartition = 'confirmee';
  f.version += 1;
  f.historique.push({ version: f.version, h, resume: 'répartition confirmée' });
  return terminer(etat, h, 'confirmerRepartition', f.numero || f.id, f);
}

/** Trace une adaptation ou substitution confirmée par l'humain. */
export function ajouterAdaptation(etat, ficheId, texte, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (typeof texte !== 'string' || texte.trim() === '') throw new Error("Décrivez l'adaptation.");
  const a = { h, texte: texte.trim() };
  f.adaptations.push(a);
  return terminer(etat, h, 'ajouterAdaptation', f.numero || f.id, a);
}

// ---------------------------------------------------------------- créneaux et réglages

/** État d'un créneau pour un jour précis (null : retour à la semaine type). */
export function definirCreneau(etat, date, creneau, valeur, h) {
  verifierH(h);
  verifierDate(date);
  if (!creneauxDuJour(date).includes(creneau)) throw new Error(`Ce créneau n'existe pas ce jour-là (${date}).`);
  if (valeur !== null) verifierDans(valeur, ETAT_CRENEAU, 'État du créneau');
  assurerJour(etat, date).creneaux[creneau] = valeur;
  return terminer(etat, h, 'definirCreneau', `${date} ${creneau} : ${valeur ?? 'semaine type'}`, valeur);
}

/** État par défaut d'un créneau de la semaine type (numeroJour 1 = lundi … 6 = samedi). */
export function definirSemaineType(etat, numeroJour, creneau, valeur, h) {
  verifierH(h);
  if (!Number.isInteger(numeroJour) || numeroJour < 1 || numeroJour > 6) throw new Error('Jour de semaine type : 1 (lundi) à 6 (samedi).');
  if (!creneauxDuJourSemaine(numeroJour).includes(creneau)) throw new Error("Ce créneau n'existe pas ce jour-là.");
  verifierDans(valeur, ETAT_CRENEAU, 'État du créneau');
  etat.reglages.semaineType[numeroJour][creneau] = valeur;
  return terminer(etat, h, 'definirSemaineType', `jour ${numeroJour} ${creneau} : ${valeur}`, valeur);
}

/** Le chef confirme la semaine type. */
export function confirmerSemaineType(etat, h) {
  verifierH(h);
  etat.reglages.semaineTypeConfirmee = true;
  return terminer(etat, h, 'confirmerSemaineType', '', true);
}

/** Capacité d'un créneau en points de charge (entier ≥ 1, ou null : aucune alerte de capacité). */
export function definirCapacite(etat, points, h) {
  verifierH(h);
  verifierEntierOuNul(points, 'Capacité', 1);
  etat.reglages.capaciteCreneau = points;
  return terminer(etat, h, 'definirCapacite', String(points ?? 'non renseignée'), points);
}

// ---------------------------------------------------------------- productions

function deplacer(etat, productionId, date, creneau, h, action) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Cette production est déjà faite : corrigez le réel plutôt que de la déplacer.');
  if (date === null) {
    p.jourDecide = null;
    p.creneauDecide = null;
    return terminer(etat, h, action, `${p.libelle} : retour à planifier`, { production: p, evaluation: null, alertes: [] });
  }
  verifierDate(date);
  if (!estOuvert(date)) throw new Error('Le dimanche est un jour non travaillé : aucune tâche.');
  if (!creneauxDuJour(date).includes(creneau)) throw new Error("Créneau impossible ce jour-là : lundi et mardi n'ont pas de créneau avant le service du soir.");
  if (date > p.dateService) throw new Error('La production ne peut pas être décidée après son service.');
  const c = etat.composants[p.composantId];
  const evaluation = evaluerAvance(date, p.dateService, regleDe(etat, c));
  p.jourDecide = date;
  p.creneauDecide = creneau;
  const alertes = [...evaluation.alertes, ...chargeCreneau(etat, date, creneau).alertes];
  return terminer(etat, h, action, `${p.libelle} -> ${date} ${creneau}`, { production: p, evaluation, alertes });
}

/**
 * Décide jour + créneau d'une production, même hors règle (l'évaluation et les alertes sont retournées).
 * Refus : dimanche, créneau inexistant ce jour-là, date après le service.
 * @returns {{production:object, evaluation:object, alertes:string[]}}
 */
export function planifier(etat, productionId, date, creneau, h) {
  return deplacer(etat, productionId, date, creneau, h, 'planifier');
}

/** Reporte une production à un autre jour/créneau, ou la remet « à planifier » avec (null, null). */
export function reporter(etat, productionId, date, creneau, h) {
  return deplacer(etat, productionId, date, creneau, h, 'reporter');
}

/** Démarre une production : la cible du moment est mémorisée pour détecter un changement en cours de route. */
export function demarrer(etat, productionId, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Cette production est déjà faite.');
  p.etat = 'en_cours';
  p.cibleAuDemarrage = cibleProduction(etat, productionId);
  return terminer(etat, h, 'demarrer', p.libelle, p);
}

/**
 * Marque une production faite. Sans quantité, la cible est proposée comme réel (corrigerReel la remplace).
 * Fige l'instantané des paramètres et des versions utilisés ; il n'est plus jamais réécrit.
 */
export function marquerFait(etat, productionId, quantite, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat === 'fait') throw new Error('Déjà fait : utilisez corrigerReel pour changer la quantité réelle.');
  const c = etat.composants[p.composantId];
  const cible = cibleProduction(etat, productionId);
  const reel = quantite === undefined || quantite === null ? cible : quantite;
  if (reel !== null && (!Number.isFinite(reel) || reel < 0)) throw new Error('Quantité réelle : nombre positif ou nul attendu.');
  if (reel === null && p.genre !== 'preparatoire') throw new Error('Quantité à saisir : la cible est inconnue (composant à préciser).');
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
  if (p.cibleAuDemarrage === null) p.cibleAuDemarrage = cible;
  p.etat = 'fait';
  p.quantiteReelle = reel;
  p.unite = calc?.uniteTravail ?? c?.grammage.unite ?? null;
  p.hFait = h;
  return terminer(etat, h, 'marquerFait', `${p.libelle} : ${reel ?? '—'}`, p);
}

/** Corrige la quantité réelle d'une production faite (l'instantané reste celui du marquage). */
export function corrigerReel(etat, productionId, quantite, h) {
  verifierH(h);
  const p = exigerProduction(etat, productionId);
  if (p.etat !== 'fait') throw new Error("La production n'est pas faite : marquez-la d'abord faite.");
  if (!Number.isFinite(quantite) || quantite < 0) throw new Error('Quantité réelle : nombre positif ou nul attendu.');
  const avant = p.quantiteReelle;
  p.quantiteReelle = quantite;
  return terminer(etat, h, 'corrigerReel', `${p.libelle} : ${avant} -> ${quantite}`, p);
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
  p.decisionEcart = { type, cible: cibleProduction(etat, productionId), h };
  return terminer(etat, h, 'deciderEcart', `${p.libelle} : ${type}`, { decision: p.decisionEcart, complement });
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

// ---------------------------------------------------------------- mémoire maison

/** Copie les paramètres connus d'un composant validé dans la mémoire (clé = nom normalisé ; grammage par rôle). */
export function memoriser(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  if (!c.valide) throw new Error("Seul un composant validé peut être mémorisé.");
  const cle = cleSure(normaliser(c.nom));
  const m = Object.hasOwn(etat.memoire, cle) ? etat.memoire[cle] : memoireVide();
  Object.assign(m, { nom: c.nom, attribue: c.attribue, type: c.type, categorie: c.categorie, charge: c.charge });
  if (c.role && c.grammage.valeur !== null && c.grammage.statut !== 'INCONNU') m.parRole[c.role] = { grammage: structuredClone(c.grammage) };
  for (const e of c.etapes) if (e.statut !== 'INCONNU') m.etapes[e.etape] = { coefficient: e.coefficient, statut: e.statut, source: e.source };
  etat.memoire[cle] = m;
  return terminer(etat, h, 'memoriser', c.nom, m);
}

/**
 * Reprend explicitement la mémoire d'un composant (même nom normalisé) : attribution, catégorie, type, charge,
 * grammage du rôle courant et étapes. Rien n'est repris sans cet appel.
 * @returns {{applique:boolean, champs:string[]}}
 */
export function reprendreMemoire(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  const cle = normaliser(c.nom);
  if (!Object.hasOwn(etat.memoire, cle)) return { applique: false, champs: [] };
  const m = etat.memoire[cle];
  const champs = ['attribue', 'categorie'];
  c.attribue = m.attribue;
  c.categorie = m.categorie;
  if (m.type && m.type !== 'a_preciser') { c.type = m.type; champs.push('type'); }
  if (m.charge) { c.charge = m.charge; champs.push('charge'); }
  if (c.role && m.parRole?.[c.role]?.grammage) { c.grammage = structuredClone(m.parRole[c.role].grammage); champs.push('grammage'); }
  const reprises = Object.entries(m.etapes ?? {}).map(([etape, v]) => ({ etape, ...v }));
  if (reprises.length > 0) {
    c.etapes = normaliserEtapes([...c.etapes.filter((e) => !(e.etape in m.etapes)), ...reprises]);
    champs.push('etapes');
  }
  return terminer(etat, h, 'reprendreMemoire', `${c.nom} : ${champs.join(', ')}`, { applique: true, champs });
}

// ---------------------------------------------------------------- standards maison

function verifierFamilleEtRole(cleFamille, role) {
  // Une clé « groupe:… » désigne une grande catégorie (standard valable pour toutes ses familles).
  if (!familleParCle(cleFamille) && !groupeDeCleStandard(cleFamille)) {
    throw new Error(`Famille de produits inconnue : « ${cleFamille} » (ni catégorie « groupe:… » connue).`);
  }
  verifierDans(role, ROLE, 'Rôle');
}

/**
 * Définit le standard maison d'une famille de produits (ou d'une grande catégorie, clé « groupe:… ») et d'un rôle : la portion que le chef sert, avec l'état de
 * son poids (sec, cru_net, cuit). `saisie = { valeur, unite, etat }`. Il passe avant le repère de la base ; seule
 * cette action (et supprimerStandard) le modifie, jamais une correction faite sur un plat.
 * Refus : famille ou rôle inconnu, valeur non strictement positive, unité ou état du poids invalide.
 * @returns {{valeur:number, unite:string, etat:string, h:string}} le standard enregistré
 */
export function definirStandard(etat, cleFamille, role, saisie, h) {
  verifierH(h);
  verifierFamilleEtRole(cleFamille, role);
  if (saisie === null || typeof saisie !== 'object') throw new Error("Standard invalide : une valeur, une unité et l'état du poids sont attendus.");
  const { valeur, unite, etat: etatPoids } = saisie;
  if (!Number.isFinite(valeur) || valeur <= 0) throw new Error('La portion du standard doit être un nombre strictement positif.');
  verifierDans(unite, UNITE, 'Unité du standard');
  verifierDans(etatPoids, ETAT_POIDS, 'État du poids du standard');
  if (etat.standards === null || typeof etat.standards !== 'object') etat.standards = {};
  if (!Object.hasOwn(etat.standards, cleFamille)) etat.standards[cleFamille] = {};
  const standard = { valeur, unite, etat: etatPoids, h };
  etat.standards[cleFamille][role] = standard;
  return terminer(etat, h, 'definirStandard', `${cleFamille} ${role} : ${valeur} ${unite} (${etatPoids})`, standard);
}

/**
 * Supprime le standard maison d'une famille et d'un rôle : les plats retombent sur le repère de la base, s'il existe.
 * Refus : famille ou rôle inconnu. Sans standard à supprimer, ne fait rien et renvoie false.
 * @returns {boolean} vrai si un standard a été supprimé
 */
export function supprimerStandard(etat, cleFamille, role, h) {
  verifierH(h);
  verifierFamilleEtRole(cleFamille, role);
  const roles = etat.standards && Object.hasOwn(etat.standards, cleFamille) ? etat.standards[cleFamille] : null;
  if (!roles || !Object.hasOwn(roles, role)) return false;
  delete roles[role];
  if (Object.keys(roles).length === 0) delete etat.standards[cleFamille];
  return terminer(etat, h, 'supprimerStandard', `${cleFamille} ${role}`, true);
}

// ---------------------------------------------------------------- règles, recettes, fournisseurs

/**
 * Crée ou met à jour la règle de préparation d'un nom (clé = nom normalisé, unique). champs : nom, cle,
 * avanceMaxJours, limiteUtilisationJours, note, id (mise à jour). `valideLe` est renseigné quand la limite
 * d'utilisation l'est. Retourne l'identifiant.
 */
export function definirRegle(etat, champs, h) {
  verifierH(h);
  const nom = String(champs?.nom ?? '').trim();
  if (nom === '') throw new Error('Le nom de la règle est obligatoire.');
  const cle = cleSure(normaliser(champs.cle ?? nom));
  const avanceMaxJours = verifierEntierOuNul(champs.avanceMaxJours ?? null, "Avance maximale");
  const limiteUtilisationJours = verifierEntierOuNul(champs.limiteUtilisationJours ?? null, "Limite d'utilisation");
  const existante = (champs.id && etat.regles[champs.id]) || Object.values(etat.regles).find((r) => r.cle === cle);
  const id = existante?.id ?? nouvelId('regle');
  etat.regles[id] = { ...regleVide(id), nom, cle, avanceMaxJours, limiteUtilisationJours,
    valideLe: limiteUtilisationJours !== null ? h : null, note: String(champs.note ?? '') };
  return terminer(etat, h, 'definirRegle', nom, id);
}

export function supprimerRegle(etat, regleId, h) {
  verifierH(h);
  const r = exiger(etat.regles, regleId, 'Règle');
  delete etat.regles[regleId];
  return terminer(etat, h, 'supprimerRegle', r.nom, true);
}

function normaliserRecette(champs, existante) {
  const nom = String(champs.nom ?? existante.nom).trim();
  if (nom === '') throw new Error('Le nom de la recette est obligatoire.');
  const rendement = { ...existante.rendement, ...(champs.rendement ?? {}) };
  if (rendement.valeur !== null && (!Number.isFinite(rendement.valeur) || rendement.valeur <= 0)) throw new Error('Le rendement doit être strictement positif (ou vide).');
  verifierDans(rendement.unite, UNITE, 'Unité du rendement');
  const ingredients = (champs.ingredients ?? existante.ingredients).map((i) => {
    if (String(i.nom ?? '').trim() === '') throw new Error("Chaque ingrédient doit avoir un nom.");
    verifierQuantiteOuNul(i.quantite ?? null, `Quantité de ${i.nom}`);
    return { nom: String(i.nom).trim(), quantite: i.quantite ?? null, unite: verifierDans(i.unite ?? 'g', UNITE, 'Unité'), fournisseurId: i.fournisseurId ?? null };
  });
  const allergenes = [...(champs.allergenes ?? existante.allergenes)];
  return { nom, rendement: { valeur: rendement.valeur, unite: rendement.unite }, ingredients, allergenes };
}

/** Crée une recette (version 1, non validée). champs : nom, rendement {valeur, unite}, ingredients, allergenes. */
export function creerRecette(etat, champs, h) {
  verifierH(h);
  const id = nouvelId('recette');
  etat.recettes[id] = { ...recetteVide(id), ...normaliserRecette(champs ?? {}, recetteVide(id)) };
  return terminer(etat, h, 'creerRecette', etat.recettes[id].nom, id);
}

/** Nouvelle version : l'ancienne passe dans l'historique et la recette doit être revalidée. */
export function modifierRecette(etat, recetteId, champs, h) {
  verifierH(h);
  const r = exigerRecette(etat, recetteId);
  const maj = normaliserRecette(champs ?? {}, r);
  r.historique.push({ version: r.version, h, resume: 'version remplacée', nom: r.nom, rendement: r.rendement,
    ingredients: r.ingredients, allergenes: r.allergenes, valide: r.valide });
  Object.assign(r, maj, { version: r.version + 1, valide: false });
  return terminer(etat, h, 'modifierRecette', `${r.nom} v${r.version}`, r);
}

/** Valide la recette actuelle : rendement et quantités de tous les ingrédients doivent être renseignés. */
export function validerRecette(etat, recetteId, h) {
  verifierH(h);
  const r = exigerRecette(etat, recetteId);
  if (!Number.isFinite(r.rendement.valeur) || r.rendement.valeur <= 0) throw new Error('Validation impossible : le rendement est à renseigner.');
  if (r.ingredients.length === 0 || r.ingredients.some((i) => !Number.isFinite(i.quantite) || i.quantite <= 0)) {
    throw new Error('Validation impossible : chaque ingrédient doit avoir une quantité.');
  }
  r.valide = true;
  r.historique.push({ version: r.version, h, resume: 'validée' });
  return terminer(etat, h, 'validerRecette', `${r.nom} v${r.version}`, r);
}

/** Crée ou met à jour un fournisseur (champs : id, nom, delaiJours, heureLimite, note). Retourne l'identifiant. */
export function definirFournisseur(etat, champs, h) {
  verifierH(h);
  const nom = String(champs?.nom ?? '').trim();
  if (nom === '') throw new Error('Le nom du fournisseur est obligatoire.');
  const delaiJours = verifierEntierOuNul(champs.delaiJours ?? null, 'Délai fournisseur');
  const id = champs.id && etat.fournisseurs[champs.id] ? champs.id : nouvelId('fourn');
  etat.fournisseurs[id] = { ...fournisseurVide(id), nom, delaiJours, heureLimite: String(champs.heureLimite ?? ''), note: String(champs.note ?? '') };
  return terminer(etat, h, 'definirFournisseur', nom, id);
}

export function supprimerFournisseur(etat, fournisseurId, h) {
  verifierH(h);
  const f = exiger(etat.fournisseurs, fournisseurId, 'Fournisseur');
  delete etat.fournisseurs[fournisseurId];
  for (const s of Object.values(etat.produits)) if (s.fournisseurId === fournisseurId) s.fournisseurId = null;
  for (const r of Object.values(etat.recettes)) for (const i of r.ingredients) if (i.fournisseurId === fournisseurId) i.fournisseurId = null;
  return terminer(etat, h, 'supprimerFournisseur', f.nom, true);
}

// ---------------------------------------------------------------- produits et commande

function suiviDe(etat, lundi, cle, unite) {
  verifierLundi(lundi);
  const k = cleSuivi(lundi, cleSure(cle), unite);
  if (!Object.hasOwn(etat.produits, k)) etat.produits[k] = suiviProduitVide();
  return etat.produits[k];
}

/**
 * Contrôle d'un produit : statut ('a_verifier', 'suffisant', 'a_commander'), quantité vérifiée disponible, et le
 * besoin du moment est mémorisé (besoinAuControle). « suffisant » exige une quantité vérifiée au moins égale au besoin.
 * Si le besoin change ensuite, le statut affiché devient « à revérifier ».
 */
export function controlerProduit(etat, lundi, cle, unite, statut, quantiteVerifiee, h) {
  verifierH(h);
  verifierLundi(lundi);
  verifierDans(statut, VERIF, 'Statut de contrôle');
  if (statut === 'a_verifier') {
    return terminer(etat, h, 'controlerProduit', `${cle} : ${statut}`,
      Object.assign(suiviDe(etat, lundi, cle, unite), { statut, quantiteVerifiee: null, besoinAuControle: null }));
  }
  const ligne = besoinsProduits(etat, lundi).lignes.find((l) => l.cle === cle && l.unite === unite);
  if (!ligne) throw new Error(`Ce produit n'a pas de besoin cette semaine : ${cle} (${unite}).`);
  if (!Number.isFinite(quantiteVerifiee) || quantiteVerifiee < 0) {
    throw new Error('Une quantité vérifiée (nombre positif ou nul) est nécessaire : une impression de disponibilité ne suffit pas.');
  }
  if (statut === 'suffisant' && Math.round(quantiteVerifiee) < Math.round(ligne.besoinBrut)) {
    throw new Error('« Suffisant » est impossible : la quantité vérifiée est inférieure au besoin.');
  }
  const suivi = Object.assign(suiviDe(etat, lundi, cle, unite), { statut, quantiteVerifiee, besoinAuControle: ligne.besoinBrut });
  return terminer(etat, h, 'controlerProduit', `${cle} : ${statut}`, suivi);
}

/** Saisie manuelle de l'achat : champs quantiteAcheter, conditionnement, fournisseurId. Jamais calculée. */
export function definirAchat(etat, lundi, cle, unite, champs, h) {
  verifierH(h);
  const suivi = suiviDe(etat, lundi, cle, unite);
  if ('quantiteAcheter' in champs) suivi.quantiteAcheter = verifierQuantiteOuNul(champs.quantiteAcheter, 'Quantité à acheter');
  if ('conditionnement' in champs) suivi.conditionnement = String(champs.conditionnement ?? '');
  if ('fournisseurId' in champs) {
    if (champs.fournisseurId !== null) exiger(etat.fournisseurs, champs.fournisseurId, 'Fournisseur');
    suivi.fournisseurId = champs.fournisseurId;
  }
  return terminer(etat, h, 'definirAchat', cle, suivi);
}

/** Marque une ligne commandée (une quantité à acheter doit avoir été saisie). */
export function marquerCommande(etat, lundi, cle, unite, h) {
  verifierH(h);
  const suivi = suiviDe(etat, lundi, cle, unite);
  if (!Number.isFinite(suivi.quantiteAcheter)) throw new Error("Saisissez d'abord la quantité réellement achetée.");
  suivi.commandeLe = h;
  return terminer(etat, h, 'marquerCommande', cle, suivi);
}

// ---------------------------------------------------------------- après service

/** Ventes réelles d'un menu (repère pour les prévisions futures ; ne modifie jamais une prévision). */
export function saisirVentes(etat, date, menu, ventes, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierEntierOuNul(ventes, 'Ventes');
  const j = assurerJour(etat, date);
  j.ventes[menu] = ventes;
  j.ventes.h = h;
  return terminer(etat, h, 'saisirVentes', `${date} menu ${menu} : ${ventes ?? '—'}`, j.ventes);
}

/** Surplus utilisable, rebut et note d'un composant (le rebut n'est pas une perte normale de parage ou de cuisson). */
export function saisirApresService(etat, composantId, saisie, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  const surplus = verifierQuantiteOuNul(saisie?.surplus ?? null, 'Surplus');
  const rebut = verifierQuantiteOuNul(saisie?.rebut ?? null, 'Rebut');
  c.apresService = { surplus, rebut, note: String(saisie?.note ?? '') };
  return terminer(etat, h, 'saisirApresService', c.nom, c.apresService);
}
