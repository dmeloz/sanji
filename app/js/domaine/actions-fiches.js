// Actions sur les orthographes et fiches retenues (voir fiches-retenues.js). Chaque action journalise en clair.

import { modifierComposant, terminer } from './actions.js';
import { classer } from './actions-mots.js';
import { ajouterJournal, cleMemoire, estSauceAConfirmer, normaliser } from './etat.js';
import { FICHES_MAX, NOM_MAX, cleDeNom, evincerLePlusAncien, retenirFiche } from './fiches-retenues.js';
import { categorieMotValide } from './mots-retenus.js';
import { clePlat, platRetenuPour, resteAConfirmer, retenirPlatSiValide } from './plats-retenus.js';

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

/** Les plats retenus gardent la bonne orthographe : leurs éléments et leurs clés d'intitulé suivent le nouveau nom. */
function renommerDansLesPlats(etat, ancienne, nouvelle, nom) {
  const motif = new RegExp(`(^| )${ancienne.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
  for (const [cle, p] of Object.entries(etat.plats_retenus)) {
    for (const e of p.elements) if (normaliser(e.nom) === ancienne) e.nom = nom;
    const cleNeuve = cle.replace(motif, `$1${nouvelle}$2`);
    if (cleNeuve === cle) continue;
    if (!Object.hasOwn(etat.plats_retenus, cleNeuve)) etat.plats_retenus[cleNeuve] = p;
    delete etat.plats_retenus[cle];
  }
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
  // Un nom correct qui contient déjà l'ancien (« riz basmati » → « riz basmati parfumé ») ne devient pas un alias : il redoublerait un mot.
  const alias = change && !` ${cle} `.includes(` ${cleAncienne} `);
  const jour = h.slice(0, 10);
  const cibles = Object.values(etat.composants).filter((x) => x.id === c.id || (x.date >= jour && normaliser(x.nom) === cleAncienne));
  // L'orthographe est retenue AVANT les renommages : les plats retenus en chemin se rangent déjà sous le nom correct.
  if (alias) {
    if (!Object.hasOwn(etat.noms, cleAncienne)) evincerLePlusAncien(etat.noms, FICHES_MAX);
    etat.noms[cleAncienne] = { nom, h };
  }
  // Interne : une correction d'orthographe ne confirme jamais une sauce reprise et ne retient aucun plat.
  for (const x of cibles) modifierComposant(etat, x.id, { nom }, h, { interne: true });
  if (change) {
    for (const [v, e] of Object.entries(etat.noms)) if (normaliser(e.nom) === cleAncienne) etat.noms[v] = { nom, h }; // l'ancien « nom correct » est renommé
    delete etat.noms[cle]; // le nouveau nom est correct : il n'est plus une variante
    deplacerMemoire(etat, ancien, nom);
    if (Object.hasOwn(etat.fiches_retenues, cleAncienne)) {
      if (!Object.hasOwn(etat.fiches_retenues, cle)) etat.fiches_retenues[cle] = etat.fiches_retenues[cleAncienne];
      delete etat.fiches_retenues[cleAncienne];
    }
    renommerDansLesPlats(etat, cleAncienne, cle, nom);
  }
  retenirFiche(etat, nom, { categorie: c.categorie, role: c.role ?? undefined, attribue: c.menu === 2 ? c.attribue : undefined }, h);
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

/** Reconfirme une sauce reprise d'un plat retenu (« OK ») : elle n'est plus « à reconfirmer » ; le plat est retenu s'il est validé. */
export function confirmerReprise(etat, composantId, h) {
  verifierH(h);
  const c = etat.composants[composantId];
  if (!c?.reprise) throw new Error('Cet élément n\'est pas une reprise à reconfirmer.');
  delete c.reprise;
  if (retenirPlatSiValide(etat, c.date, c.menu, h)) ajouterJournal(etat, h, 'retenirPlat', `${c.date} menu ${c.menu}`);
  return terminer(etat, h, 'confirmerReprise', c.nom, true);
}

/**
 * Clôture de la semaine : « Retenir tel quel ». Confirme les éléments qui ont déjà un nom concret (une proposition de la lecture
 * est prise telle quelle, une sauce reprise est reconfirmée) et retient le plat. Une sauce sans nom ou un mot sans proposition
 * ne sont jamais inventés : le plat reste non retenu et l'erreur dit pourquoi.
 */
export function retenirTelQuel(etat, date, menu, h) {
  verifierH(h);
  const comps = Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  if (comps.length === 0) throw new Error('Aucun élément pour ce plat.');
  const bloquants = comps.map(resteAConfirmer).filter((r) => r?.bloquant).map((r) => r.texte);
  if (bloquants.length > 0) throw new Error(`Ce plat ne peut pas être retenu tel quel : ${bloquants.join(' ; ')}.`);
  for (const c of comps) {
    delete c.reprise;
    if (c.categorie === 'a_preciser' && categorieMotValide(c.suggestion)) classer(etat, c, c.suggestion, h);
  }
  if (!retenirPlatSiValide(etat, date, menu, h) && !platRetenuPour(etat, date, menu)) {
    throw new Error(clePlat(etat, etat.jours?.[date]?.menus?.[menu]?.intitule) === ''
      ? 'Ce plat ne peut pas être retenu : son intitulé est vide, trop long ou inutilisable comme clé.'
      : 'Ce plat ne peut pas être retenu : il reste un élément à confirmer.');
  }
  return terminer(etat, h, 'retenirTelQuel', `${date} menu ${menu}`, true);
}

/** Oublie un plat retenu : les éléments déjà créés et les fiches par nom ne changent pas. */
export function oublierPlat(etat, cle, h) {
  verifierH(h);
  if (!Object.hasOwn(etat.plats_retenus, cle)) throw new Error('Ce plat n\'est pas retenu.');
  delete etat.plats_retenus[cle];
  return terminer(etat, h, 'oublierPlat', cle, true);
}
