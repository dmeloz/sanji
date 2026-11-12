// Actions sur la mémoire maison et les standards maison.
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { cleSure, exigerComposant, normaliserEtapes, terminer, verifierDans, verifierH } from './actions-socle.js';
import { cleMemoire, lireMemoire } from './analyse-menu.js';
import { memoireVide, normaliser } from './etat.js';
import { champsDeComposant, reprendreSurAVenir, retenirFiche } from './fiches-retenues.js';
import { GROUPES, MESSAGE_PORTION_TROP_GRANDE, PORTION_MAX_G, familleParCle, groupeDeCleStandard } from './savoir.js';
import { ETAT_POIDS, ROLE, UNITE } from './statuts.js';

// ---------------------------------------------------------------- mémoire maison

/** Copie les paramètres connus d'un composant validé dans la mémoire (clé = nom normalisé ; grammage par rôle). */
export function memoriser(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  if (!c.valide) throw new Error("Seul un composant validé peut être mémorisé.");
  cleSure(normaliser(c.nom));
  const cle = cleMemoire(c.nom, c.menu); // par menu : une référence du menu 1 ne vaut pas pour le menu 2
  const m = Object.hasOwn(etat.memoire, cle) ? etat.memoire[cle] : memoireVide();
  Object.assign(m, { nom: c.nom, attribue: c.attribue, type: c.type, categorie: c.categorie, charge: c.charge });
  if (c.role && c.grammage.valeur !== null && c.grammage.statut !== 'INCONNU') m.parRole[c.role] = { grammage: structuredClone(c.grammage) };
  for (const e of c.etapes) if (e.statut !== 'INCONNU') m.etapes[e.etape] = { coefficient: e.coefficient, statut: e.statut, source: e.source };
  etat.memoire[cle] = m;
  // La fiche retenue du nom (indépendante du menu) garde aussi la portion : reprise aux semaines suivantes, menus 1 et 2.
  const g = c.role && c.grammage.valeur > 0 && ['RESTAURANT_VALIDE', 'SAISI_SERVICE'].includes(c.grammage.statut) ? { valeur: c.grammage.valeur, unite: c.grammage.unite, etat: c.grammage.etat } : undefined;
  retenirFiche(etat, c.nom, { ...champsDeComposant(c), grammage: g }, h);
  if (g) reprendreSurAVenir(etat, c.nom, h.slice(0, 10));
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
  const m = lireMemoire(etat.memoire, c.nom, c.menu);
  if (!m) return { applique: false, champs: [] };
  const champs = ['attribue', 'categorie'];
  c.attribue = m.attribue;
  c.categorie = m.categorie;
  if (m.type && m.type !== 'a_preciser') { c.type = m.type; champs.push('type'); }
  if (m.charge) { c.charge = m.charge; champs.push('charge'); }
  if (c.role && m.parRole?.[c.role]?.grammage) {
    // Reprise, pas correction : l'apprentissage ne la compte pas (le grammage d'origine, lui, a déjà compté).
    c.grammage = { ...structuredClone(m.parRole[c.role].grammage), repris: true };
    champs.push('grammage');
  }
  const reprises = Object.entries(m.etapes ?? {}).map(([etape, v]) => ({ etape, ...v }));
  if (reprises.length > 0) {
    c.etapes = normaliserEtapes([...c.etapes.filter((e) => !(e.etape in m.etapes)), ...reprises]);
    champs.push('etapes');
  }
  return terminer(etat, h, 'reprendreMemoire', `${c.nom} : ${champs.join(', ')}`, { applique: true, champs });
}

// ---------------------------------------------------------------- standards maison

/** Nom lisible d'une famille ou d'une catégorie de standard, pour le journal. */
function nomStandard(cle) {
  const g = groupeDeCleStandard(cle);
  return g ? `${GROUPES.find((x) => x.cle === g).libelle} (catégorie)` : cle;
}

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
  if (valeur > PORTION_MAX_G) throw new Error(MESSAGE_PORTION_TROP_GRANDE);
  verifierDans(unite, UNITE, 'Unité du standard');
  verifierDans(etatPoids, ETAT_POIDS, 'État du poids du standard');
  if (etat.standards === null || typeof etat.standards !== 'object') etat.standards = {};
  if (!Object.hasOwn(etat.standards, cleFamille)) etat.standards[cleFamille] = {};
  const standard = { valeur, unite, etat: etatPoids, h };
  etat.standards[cleFamille][role] = standard;
  return terminer(etat, h, 'definirStandard', `${nomStandard(cleFamille)} ${role} : ${valeur} ${unite} (${etatPoids})`, standard);
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
  return terminer(etat, h, 'supprimerStandard', `${nomStandard(cleFamille)} ${role}`, true);
}
