// Actions sur les orthographes et fiches d'éléments retenues (voir fiches-retenues.js). Chaque action journalise en clair.

import { definirStandard, modifierComposant, terminer } from './actions.js';
import { classer } from './actions-mots.js';
import { elementsDeLaSemaine, lectureDeCloture } from './cloture.js';
import { cleMemoire, estSauceAConfirmer, normaliser } from './etat.js';
import { nomDeFiche } from './fiches-elements.js';
import { FICHES_MAX, NOM_MAX, champsDeComposant, cleDeNom, evincerLePlusAncien, grammageValide, reprendreSurAVenir, retenirFiche } from './fiches-retenues.js';
import { categorieMotValide, champsPourMot } from './mots-retenus.js';
import { ROLES_STANDARD, familleDe } from './savoir.js';
import { ETAT_POIDS } from './statuts.js';

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
}

/** Les mémoires « nom|menu » de l'ancienne orthographe passent à la nouvelle (sans écraser une mémoire déjà là). */
function deplacerMemoire(etat, ancien, nouveau) {
  for (const menu of [1, 2]) {
    const de = cleMemoire(ancien, menu);
    const vers = cleMemoire(nouveau, menu);
    if (Object.hasOwn(etat.memoire, de) && !Object.hasOwn(etat.memoire, vers)) etat.memoire[vers] = etat.memoire[de];
    delete etat.memoire[de];
  }
}

/** Un nom correct qui contient déjà l'ancien (« riz basmati » → « riz basmati parfumé ») ne devient pas un alias : il redoublerait un mot. */
const aliasUtile = (cleAncienne, cle) => cleAncienne !== cle && !` ${cle} `.includes(` ${cleAncienne} `);

/** Retient l'ancienne orthographe : `lirePlat` la corrigera aux imports suivants. */
function retenirAlias(etat, cleAncienne, nom, h) {
  if (!Object.hasOwn(etat.noms, cleAncienne)) evincerLePlusAncien(etat.noms, FICHES_MAX);
  etat.noms[cleAncienne] = { nom, h };
}

/** Le nom change vraiment : orthographes, mémoires et fiche de l'ancien nom passent au nouveau (la fiche en garde le nom d'affichage). */
function deplacerNom(etat, ancien, cleAncienne, nom, cle, h) {
  for (const [v, e] of Object.entries(etat.noms)) if (normaliser(e.nom) === cleAncienne) etat.noms[v] = { nom, h }; // l'ancien « nom correct » est renommé
  delete etat.noms[cle]; // le nouveau nom est correct : il n'est plus une variante
  deplacerMemoire(etat, ancien, nom);
  if (!Object.hasOwn(etat.fiches_retenues, cleAncienne)) return;
  // La fiche cible garde ses champs ; celle de l'ancien nom ne les complète que s'ils manquent.
  etat.fiches_retenues[cle] = { ...etat.fiches_retenues[cleAncienne], nom, ...(etat.fiches_retenues[cle] ?? {}) };
  delete etat.fiches_retenues[cleAncienne];
}

/**
 * Corrige l'orthographe d'un élément : le nom change sur l'élément et sur ceux du jour de `h` et après qui portent la même
 * orthographe (les jours passés ne changent jamais) ; l'ancienne orthographe est retenue (`etat.noms`) pour que `lirePlat`
 * la corrige aux imports suivants ; la fiche retenue et les mémoires de l'ancien nom passent au nouveau. Tout ou rien.
 * @returns {{ancien:string, nom:string, corriges:number, retenue:boolean}}
 */
export function corrigerNom(etat, composantId, nouveauNom, h) {
  verifierH(h);
  const c = etat.composants[composantId];
  if (!c) throw new Error('Composant introuvable.');
  const nom = typeof nouveauNom === 'string' ? nouveauNom.trim().replace(/\s+/g, ' ') : '';
  if (nom === '') throw new Error('Le nom ne peut pas être vide.');
  if (nom.length > NOM_MAX) throw new Error(`Le nom est trop long (${NOM_MAX} caractères au plus).`);
  const cle = cleDeNom(nom);
  if (cle === '') throw new Error('Ce nom ne peut pas être retenu.');
  if (estSauceAConfirmer(c)) throw new Error('Cette sauce n\'a pas encore de nom : choisissez-la avec « Choisir la sauce ».');
  const ancien = c.nom;
  const cleAncienne = normaliser(ancien);
  const change = cleAncienne !== cle; // seule la casse ou les accents changent : rien à déplacer ni à retenir
  if (change && cleDeNom(ancien) === '') throw new Error('L\'ancienne orthographe ne peut pas être retenue.');
  const alias = change && aliasUtile(cleAncienne, cle);
  const jour = h.slice(0, 10);
  const cibles = Object.values(etat.composants).filter((x) => x.id === c.id || (x.date >= jour && normaliser(x.nom) === cleAncienne));
  if (alias) retenirAlias(etat, cleAncienne, nom, h);
  // Une correction d'orthographe ne change que le nom : ni catégorie, ni attribution.
  for (const x of cibles) modifierComposant(etat, x.id, { nom }, h);
  if (change) deplacerNom(etat, ancien, cleAncienne, nom, cle, h);
  retenirFiche(etat, nom, champsDeComposant(c), h);
  terminer(etat, h, 'corrigerNom', `${ancien} → ${nom} (${cibles.length} élément(s) à venir ou en cours)`, null);
  return { ancien, nom, corriges: cibles.length, retenue: alias };
}

/** Oublie la fiche retenue d'un nom et ses orthographes retenues ; les éléments déjà créés ne changent pas. */
export function oublierFiche(etat, cle, h) {
  verifierH(h);
  if (!Object.hasOwn(etat.fiches_retenues, cle)) throw new Error('Cette fiche n\'est pas retenue.');
  delete etat.fiches_retenues[cle];
  for (const [v, e] of Object.entries(etat.noms)) if (normaliser(e.nom) === cle) delete etat.noms[v];
  return terminer(etat, h, 'oublierFiche', cle, true);
}

// ---------------------------------------------------------------- retenir des éléments (clôture de la semaine)

/** Retient l'élément : si la lecture n'a fait que le proposer, sa proposition est prise telle quelle (jamais inventée). */
function retenirUn(etat, c, h) {
  const l = lectureDeCloture(c);
  if (l.bloque) throw new Error(`« ${c.nom} » ne peut pas être retenu : ${l.raison}.`);
  if (l.propose) classer(etat, c, l.choix, h);
  retenirFiche(etat, c.nom, champsDeComposant(etat.composants[c.id]), h);
}

/** Clôture : « Retenir tel quel » pour un élément. Une sauce sans nom ou un mot sans proposition sont refusés, sans rien changer. */
export function retenirElement(etat, composantId, h) {
  verifierH(h);
  const c = etat.composants[composantId];
  if (!c) throw new Error('Composant introuvable.');
  retenirUn(etat, c, h);
  return terminer(etat, h, 'retenirElement', c.nom, true);
}

/**
 * Depuis la fiche technique d'un élément AU POSTE : classe l'élément dans un des quatre choix et retient sa fiche. L'élément reste au
 * poste (contrairement à `enseignerMot`, qui suit la règle du menu 2) ; aucun mot n'est retenu pour tous les plats.
 */
export function classerEtRetenir(etat, composantId, choix, h) {
  verifierH(h);
  const c = etat.composants[composantId];
  if (!c) throw new Error('Composant introuvable.');
  if (c.attribue !== true) throw new Error('Seul un élément au poste a une fiche.');
  if (!categorieMotValide(choix)) throw new Error(`Classement inconnu : « ${choix} ».`);
  const champs = { ...champsPourMot(choix, c.menu), attribue: true };
  if (choix === 'produit' && ['garniture', 'sauce'].includes(c.role)) champs.role = 'autre'; // sinon la fiche se relirait « garniture »
  modifierComposant(etat, composantId, champs, h);
  retenirFiche(etat, c.nom, champsDeComposant(etat.composants[composantId]), h);
  return terminer(etat, h, 'classerEtRetenir', `${c.nom} = ${choix}`, true);
}

/** Clôture : retient les éléments nommés de la semaine du `lundi` (un par nom) ; jamais une sauce sans nom ni un mot à préciser. */
export function retenirElementsDeLaSemaine(etat, lundi, h) {
  verifierH(h);
  const faits = new Set();
  for (const plat of elementsDeLaSemaine(etat, lundi).plats) {
    for (const e of plat.elements) {
      const cle = normaliser(e.nom);
      if (e.retenu || e.bloque || faits.has(cle)) continue;
      faits.add(cle);
      retenirUn(etat, etat.composants[e.id], h);
    }
  }
  if (faits.size > 0) terminer(etat, h, 'retenirElements', `semaine du ${lundi} : ${faits.size} élément(s)`, true);
  return { retenus: faits.size };
}

// ---------------------------------------------------------------- la petite fiche (page « Fiches des éléments »)

function exigerFiche(etat, cle) {
  if (!Object.hasOwn(etat.fiches_retenues, cle)) throw new Error('Cette fiche n\'est pas retenue.');
  return etat.fiches_retenues[cle];
}

/**
 * Corrige le nom d'une fiche. Si des éléments du jour de `h` ou après portent ce nom, c'est `corrigerNom` (ils changent aussi) ;
 * sinon seule la fiche change. Dans les deux cas l'ancienne orthographe est retenue.
 * @returns {{ancien:string, nom:string, corriges:number, retenue:boolean}}
 */
export function renommerFiche(etat, cle, nouveauNom, h) {
  verifierH(h);
  const fiche = exigerFiche(etat, cle);
  const avenir = Object.values(etat.composants).filter((c) => c.date >= h.slice(0, 10) && normaliser(c.nom) === cle)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (avenir.length > 0) return corrigerNom(etat, avenir[0].id, nouveauNom, h);
  const nom = typeof nouveauNom === 'string' ? nouveauNom.trim().replace(/\s+/g, ' ') : '';
  const cleNeuve = cleDeNom(nom);
  if (nom === '') throw new Error('Le nom ne peut pas être vide.');
  if (nom.length > NOM_MAX) throw new Error(`Le nom est trop long (${NOM_MAX} caractères au plus).`);
  if (cleNeuve === '') throw new Error('Ce nom ne peut pas être retenu.');
  const ancien = nomDeFiche(cle, fiche);
  const alias = cleNeuve !== cle && aliasUtile(cle, cleNeuve);
  if (alias) retenirAlias(etat, cle, nom, h);
  if (cleNeuve !== cle) deplacerNom(etat, ancien, cle, nom, cleNeuve, h);
  else fiche.nom = nom;
  terminer(etat, h, 'renommerFiche', `${ancien} → ${nom}`, null);
  return { ancien, nom, corriges: 0, retenue: alias };
}

/** Change la catégorie d'une fiche (un des quatre choix d'`enseigner-mot.js`). Les éléments déjà créés ne changent pas. */
export function reclasserFiche(etat, cle, choix, h) {
  verifierH(h);
  const fiche = exigerFiche(etat, cle);
  if (!categorieMotValide(choix)) throw new Error(`Classement inconnu : « ${choix} ».`);
  const { categorie, role } = champsPourMot(choix, 1);
  fiche.categorie = categorie;
  if (role) fiche.role = role;
  else if (fiche.role === 'sauce' || (choix === 'produit' && fiche.role === 'garniture')) delete fiche.role; // sinon la fiche se relirait « garniture »
  if (!fiche.role || fiche.role === 'sauce') delete fiche.grammage; // une portion n'a de sens que pour un plat principal ou une garniture
  fiche.h = h;
  return terminer(etat, h, 'reclasserFiche', `${nomDeFiche(cle, fiche)} = ${choix}`, true);
}

/**
 * Portion tapée sur la fiche : toujours écrite dans la fiche (reprise aux éléments du même nom à venir). Famille et rôle connus,
 * sans portion ni standard maison jusque-là : elle devient aussi le standard de la famille. Sans fonction (plat principal ou garniture) : refusée.
 */
export function definirPortionFiche(etat, cle, valeur, etatPoids, h) {
  verifierH(h);
  const fiche = exigerFiche(etat, cle);
  if (!ROLES_STANDARD.includes(fiche.role)) {
    throw new Error('Cette fiche n\'a pas de fonction (plat principal ou garniture) : réglez la portion sur l\'élément, dans Production.');
  }
  if (!Object.hasOwn(ETAT_POIDS, etatPoids)) throw new Error('État du poids inconnu : sec, cru net ou cuit.');
  const g = grammageValide({ valeur, unite: 'g', etat: etatPoids });
  if (!g) throw new Error('La portion doit être un nombre strictement positif.');
  const famille = fiche.famille ?? familleDe(nomDeFiche(cle, fiche))?.cle;
  // La portion tapée est toujours celle de la fiche. Le standard maison de la famille n'est posé que s'il n'y en avait ni dans
  // la fiche ni dans les réglages : jamais écrasé par ce geste.
  const standard = famille && !fiche.grammage && !etat.standards?.[famille]?.[fiche.role];
  fiche.grammage = g;
  fiche.h = h;
  if (standard) {
    definirStandard(etat, famille, fiche.role, g, h);
    return { portee: 'standard' };
  }
  reprendreSurAVenir(etat, nomDeFiche(cle, fiche), h.slice(0, 10));
  terminer(etat, h, 'definirPortionFiche', `${nomDeFiche(cle, fiche)} : ${g.valeur} g (${g.etat})`, true);
  return { portee: 'fiche' };
}

