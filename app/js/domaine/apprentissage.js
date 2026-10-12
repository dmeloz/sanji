// Apprentissage : « l'application en sait de plus en plus sur votre cuisine » (décision du 2026-10-04, point 8 :
// une correction répétée dans le même sens fait proposer la mise à jour du standard). Domaine pur, sans DOM.
//
// Une correction de portion = une valeur propre au plat (grammage du composant : correction du plat, « seulement cette
// fois », grammage tapé) qui s'écarte de ce que la portion aurait été sans elle : standard maison, sinon standard de
// base. La référence mémorisée par nom n'entre pas dans cette base de comparaison (elle recopie la correction).
// La date d'une correction est celle du service du plat : la correction elle-même n'est pas horodatée.
//
// Règle : pour une même famille (ou catégorie de légumes sans famille), un même rôle et un même état de poids, au moins
// 3 corrections dans le MÊME SENS sur les 30 derniers jours (jusqu'à aujourd'hui : jamais une date future) donnent une
// proposition ; un seul plat compte une fois par jour (menu 1 et menu 2 confondus), et un grammage repris de la mémoire
// (`reprendreMemoire`, marqué `repris`) n'est pas une correction ; dès que les deux sens sont présents, rien n'est proposé : la médiane des valeurs corrigées
// dans ce sens, arrondie au gramme. Seules comptent les corrections postérieures au dernier standard maison (celui
// qu'on vient de valider ne se rediscute pas avec les corrections qui l'ont produit). Rien n'est appliqué ici.
// Première valeur (v129, principe 13) : une famille SANS aucun standard (ni maison ni de base : polenta, quinoa, orge…) reçoit
// une proposition dès 2 valeurs concordantes (même famille, même rôle, même état du poids, écart de 10 % au plus, jamais une
// date future) tapées pour des plats ou des fiches retenues différents : médiane arrondie. Même silence, mêmes gestes.
// Une proposition écartée (`etat.validations['apprentissage:famille|rôle']`, statut « ecarte ») se tait 30 jours, ou
// jusqu'à 3 nouvelles corrections.

import { ajouterJours, joursEntre } from './dates.js';
import { normaliser } from './etat.js';
import { nomDeFiche } from './fiches-elements.js';
import { GROUPES, ROLES_STANDARD, cleStandardGroupe, familleDe, familleParCle, grammageEffectif, groupeDeCleStandard } from './savoir.js';
import { estStandardBase, libelle } from './statuts.js';
import { cleStandardDe } from './validation.js';

export const MIN_CORRECTIONS = 3;
export const JOURS_FENETRE = 30;
export const JOURS_SILENCE = 30;
export const MIN_PREMIERES_VALEURS = 2;
/** Écart maximal (rapport du plus grand au plus petit) pour que des valeurs soient dites concordantes. */
const ECART_CONCORDANT = 1.1;

/** Clé, dans `etat.validations`, de l'état d'une proposition (famille ou catégorie, et rôle). */
export const cleApprentissage = (cleFamille, role) => `apprentissage:${cleFamille}|${role}`;

const positif = (v) => Number.isFinite(v) && v > 0;
const jourDe = (h) => String(h ?? '').slice(0, 10);

function mediane(valeurs) {
  const t = [...valeurs].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Libellé de la famille ou de la catégorie d'une clé de standard. */
function libelleDe(cleFamille) {
  const f = familleParCle(cleFamille);
  if (f) return f.libelle;
  const g = groupeDeCleStandard(cleFamille);
  return GROUPES.find((x) => x.cle === g)?.libelle ?? cleFamille;
}

/** Date d'un standard maison qui s'applique à cette clé (famille ou catégorie du groupe), la plus récente. */
function dernierStandard(etat, cleFamille, role) {
  const f = familleParCle(cleFamille);
  const cles = [cleFamille, ...(f ? [cleStandardGroupe(f.groupe)] : [])];
  const dates = cles.map((c) => jourDe(etat.standards?.[c]?.[role]?.h)).filter(Boolean);
  return dates.sort().at(-1) ?? '';
}

/** Corrections de portion des composants, avec leur écart au standard en vigueur (sans correction ni référence). */
function corrections(etat, debut, fin) {
  const sansMemoire = { ...etat, memoire: {} };
  const liste = [];
  for (const c of Object.values(etat.composants ?? {})) {
    const g = c.grammage;
    if (!positif(g?.valeur) || g.statut === 'INCONNU' || estStandardBase(g.statut)) continue;
    if (g.repris === true) continue; // grammage repris de la mémoire (reprendreMemoire) : pas une correction
    if (!c.date || c.date < debut || c.date > fin) continue; // ni hors fenêtre, ni dans le futur
    const cleFamille = cleStandardDe(c);
    if (!cleFamille || !ROLES_STANDARD.includes(c.role)) continue;
    const actuel = grammageEffectif(sansMemoire, { ...c, grammage: { valeur: null, unite: g.unite, statut: 'INCONNU', source: '', etat: g.etat } });
    // Comparable seulement dans la même unité et le même état du poids.
    // Sans aucun standard (`actuel` null) : valeur d'une première proposition, voir `premieresValeurs`.
    if (actuel && (actuel.unite !== g.unite || actuel.etat !== (g.etat ?? 'cuit') || actuel.valeur === g.valeur)) continue;
    liste.push({
      id: c.id, nom: c.nom, date: c.date, cleFamille, role: c.role, unite: g.unite, etatPoids: g.etat ?? 'cuit',
      valeur: g.valeur, menu: c.menu ?? 0, sens: actuel ? (g.valeur > actuel.valeur ? 'plus' : 'moins') : null, actuel,
    });
  }
  return liste;
}

/** Portions des fiches retenues dont la famille et le rôle n'ont aucun standard, dans la fenêtre (jamais une date future). */
function valeursDeFiches(etat, debut, fin) {
  const liste = [];
  for (const [cle, f] of Object.entries(etat.fiches_retenues ?? {})) {
    const g = f.grammage;
    const jour = jourDe(f.h);
    if (!positif(g?.valeur) || !ROLES_STANDARD.includes(f.role) || jour < debut || jour > fin) continue;
    const nom = nomDeFiche(cle, f);
    const cleFamille = f.famille ?? familleDe(nom)?.cle;
    if (!cleFamille) continue;
    const sansStandard = grammageEffectif({ ...etat, memoire: {} }, { nom, famille: cleFamille, role: f.role, categorie: f.categorie, menu: 1,
      grammage: { valeur: null, unite: g.unite, statut: 'INCONNU', source: '', etat: g.etat } }) === null;
    if (!sansStandard) continue;
    liste.push({ id: `fiche:${cle}`, nom, date: jour, cleFamille, role: f.role, unite: g.unite, etatPoids: g.etat, valeur: g.valeur,
      menu: 0, sens: null, actuel: null });
  }
  return liste;
}

/**
 * Valeurs concordantes d'une famille sans standard : un plat (nom normalisé) compte une fois (sa valeur la plus récente), une
 * fiche retenue du même nom que le plat aussi. Renvoie les groupes de MIN_PREMIERES_VALEURS valeurs au moins, toutes à 10 %
 * les unes des autres ; ceux qui divergent n'en donnent aucun.
 */
function premieresValeurs(etat, debut, fin, corrigees) {
  const parPlat = new Map();
  const toutes = [...corrigees.filter((x) => !x.actuel), ...valeursDeFiches(etat, debut, fin)]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const x of toutes) {
    if (x.date <= dernierStandard(etat, x.cleFamille, x.role)) continue;
    parPlat.set(`${x.cleFamille}|${x.role}|${x.etatPoids}|${x.unite}|${normaliser(x.nom)}`, x);
  }
  const groupes = new Map();
  for (const [plat, x] of parPlat) groupes.set(plat.slice(0, plat.lastIndexOf('|')), [...(groupes.get(plat.slice(0, plat.lastIndexOf('|'))) ?? []), x]);
  return [...groupes.values()].filter((l) => l.length >= MIN_PREMIERES_VALEURS
    && Math.max(...l.map((x) => x.valeur)) <= Math.min(...l.map((x) => x.valeur)) * ECART_CONCORDANT);
}

/**
 * Propositions de mise à jour de standard, fondées sur les corrections répétées de la propriétaire.
 * @param {object} etat
 * @param {string} aujourdhui AAAA-MM-JJ
 * @returns {{cle:string, cleFamille:string, libelle:string, role:string, etatPoids:string, unite:string, valeur:number,
 *   sens:'plus'|'moins', nombre:number, dates:string[], valeursCorrigees:number[],
 *   actuelle:{valeur:number, unite:string, etat:string, origine:string, source:string},
 *   historique:{date:string, nom:string, valeur:number}[], composantIds:string[], texte:string}[]}
 */
export function propositionsApprentissage(etat, aujourdhui) {
  const debut = ajouterJours(aujourdhui, -(JOURS_FENETRE - 1));
  const groupes = new Map();
  // Une correction par plat (nom normalisé) et par jour au plus : le même plat corrigé en menu 1 et en menu 2 compte une fois.
  const vusParJour = new Set();
  const toutes = corrections(etat, debut, aujourdhui);
  const triees = toutes.filter((x) => x.actuel).sort((a, b) => a.menu - b.menu || a.id.localeCompare(b.id));
  for (const x of triees) {
    if (x.date <= dernierStandard(etat, x.cleFamille, x.role)) continue;
    const cle = `${x.cleFamille}|${x.role}|${x.etatPoids}|${x.unite}`;
    const plat = `${cle}|${normaliser(x.nom)}|${x.date}`;
    if (vusParJour.has(plat)) continue;
    vusParJour.add(plat);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(x);
  }
  const propositions = [];
  const candidats = [...groupes.values()].map((g) => {
    // Les deux sens dans la fenêtre : pas de tendance, rien à proposer (même si un sens atteint le seuil).
    const [plus, moins] = ['plus', 'moins'].map((sens) => g.filter((x) => x.sens === sens));
    const liste = plus.length > 0 && moins.length > 0 ? [] : (plus.length > 0 ? plus : moins);
    return liste.length >= MIN_CORRECTIONS ? liste : [];
  }).concat(premieresValeurs(etat, debut, aujourdhui, toutes));
  for (const liste of candidats) {
    if (liste.length === 0) continue;
    const { cleFamille, role, etatPoids, unite, sens } = liste[0];
    const ecart = etat.validations?.[cleApprentissage(cleFamille, role)];
    if (ecart?.statut === 'ecarte') {
      const vus = new Set(Array.isArray(ecart.vus) ? ecart.vus : []);
      const nouvelles = liste.filter((x) => !vus.has(x.id)).length;
      const silence = jourDe(ecart.h) !== '' && joursEntre(jourDe(ecart.h), aujourdhui) < JOURS_SILENCE;
      if (silence && nouvelles < MIN_CORRECTIONS) continue;
    }
    const ordonnees = [...liste].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const actuelle = ordonnees.at(-1).actuel;
    const valeur = Math.round(mediane(liste.map((x) => x.valeur)));
    if (!positif(valeur) || valeur === actuelle?.valeur) continue;
    const nom = libelleDe(cleFamille);
    const roleTexte = role.replace('_', ' ');
    propositions.push({
      cle: cleApprentissage(cleFamille, role), cleFamille, libelle: nom, role, etatPoids, unite, valeur, sens,
      premiereValeur: !actuelle,
      nombre: liste.length, dates: ordonnees.map((x) => x.date), valeursCorrigees: ordonnees.map((x) => x.valeur),
      actuelle: actuelle ? { valeur: actuelle.valeur, unite: actuelle.unite, etat: actuelle.etat, origine: actuelle.origine, source: actuelle.source } : null,
      historique: ordonnees.slice(-5).map((x) => ({ date: x.date, nom: x.nom, valeur: x.valeur })),
      composantIds: ordonnees.map((x) => x.id),
      texte: actuelle
        ? `Vous corrigez souvent ${nom} (${roleTexte}) vers ${valeur} ${libelle('UNITE', unite)} : en faire votre standard ?`
        : `Vous avez tapé ${liste.length} fois à peu près ${valeur} ${libelle('UNITE', unite)} pour ${nom} (${roleTexte}) : en faire votre première valeur ?`,
    });
  }
  return propositions.sort((a, b) => a.libelle.localeCompare(b.libelle) || a.role.localeCompare(b.role)
    || a.etatPoids.localeCompare(b.etatPoids));
}
