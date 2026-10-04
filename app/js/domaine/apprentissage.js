// Apprentissage : « l'application en sait de plus en plus sur votre cuisine » (décision du 2026-10-04, point 8 :
// une correction répétée dans le même sens fait proposer la mise à jour du standard). Domaine pur, sans DOM.
//
// Une correction de portion = une valeur propre au plat (grammage du composant : correction du plat, « seulement cette
// fois », grammage tapé) qui s'écarte de ce que la portion aurait été sans elle : standard maison, sinon standard de
// base. La référence mémorisée par nom n'entre pas dans cette base de comparaison (elle recopie la correction).
// La date d'une correction est celle du service du plat : la correction elle-même n'est pas horodatée.
//
// Règle : pour une même famille (ou catégorie de légumes sans famille), un même rôle et un même état de poids, au moins
// 3 corrections dans le MÊME SENS sur les 30 derniers jours donnent une proposition : la médiane des valeurs corrigées
// dans ce sens, arrondie au gramme. Seules comptent les corrections postérieures au dernier standard maison (celui
// qu'on vient de valider ne se rediscute pas avec les corrections qui l'ont produit). Rien n'est appliqué ici.
// Une proposition écartée (`etat.validations['apprentissage:famille|rôle']`, statut « ecarte ») se tait 30 jours, ou
// jusqu'à 3 nouvelles corrections.

import { ajouterJours, joursEntre } from './dates.js';
import { GROUPES, ROLES_STANDARD, cleStandardGroupe, familleParCle, grammageEffectif, groupeDeCleStandard } from './savoir.js';
import { estStandardBase, libelle } from './statuts.js';
import { cleStandardDe } from './validation.js';

export const MIN_CORRECTIONS = 3;
export const JOURS_FENETRE = 30;
export const JOURS_SILENCE = 30;

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
function corrections(etat, debut) {
  const sansMemoire = { ...etat, memoire: {} };
  const liste = [];
  for (const c of Object.values(etat.composants ?? {})) {
    const g = c.grammage;
    if (!positif(g?.valeur) || g.statut === 'INCONNU' || estStandardBase(g.statut)) continue;
    if (!c.date || c.date < debut) continue;
    const cleFamille = cleStandardDe(c);
    if (!cleFamille || !ROLES_STANDARD.includes(c.role)) continue;
    const actuel = grammageEffectif(sansMemoire, { ...c, grammage: { valeur: null, unite: g.unite, statut: 'INCONNU', source: '', etat: g.etat } });
    // Comparable seulement dans la même unité et le même état du poids.
    if (!actuel || actuel.unite !== g.unite || actuel.etat !== (g.etat ?? 'cuit') || actuel.valeur === g.valeur) continue;
    liste.push({
      id: c.id, nom: c.nom, date: c.date, cleFamille, role: c.role, unite: g.unite, etatPoids: g.etat ?? 'cuit',
      valeur: g.valeur, sens: g.valeur > actuel.valeur ? 'plus' : 'moins', actuel,
    });
  }
  return liste;
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
  for (const x of corrections(etat, debut)) {
    if (x.date <= dernierStandard(etat, x.cleFamille, x.role)) continue;
    const cle = `${x.cleFamille}|${x.role}|${x.etatPoids}|${x.unite}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(x);
  }
  const propositions = [];
  for (const toutes of groupes.values()) {
    // Un seul sens à la fois : le plus fréquent, s'il atteint le seuil (les sens mélangés ne font pas une tendance).
    const liste = ['plus', 'moins'].map((s) => toutes.filter((x) => x.sens === s)).sort((a, b) => b.length - a.length)[0];
    if (liste.length < MIN_CORRECTIONS) continue;
    const { cleFamille, role, etatPoids, unite, sens } = liste[0];
    const ecart = etat.validations?.[cleApprentissage(cleFamille, role)];
    if (ecart?.statut === 'ecarte') {
      const vus = new Set(Array.isArray(ecart.vus) ? ecart.vus : []);
      const nouvelles = liste.filter((x) => !vus.has(x.id)).length;
      const silence = jourDe(ecart.h) !== '' && joursEntre(jourDe(ecart.h), aujourdhui) < JOURS_SILENCE;
      if (silence && nouvelles < MIN_CORRECTIONS) continue;
    }
    const triees = [...liste].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const actuelle = triees.at(-1).actuel;
    const valeur = Math.round(mediane(liste.map((x) => x.valeur)));
    if (!positif(valeur) || valeur === actuelle.valeur) continue;
    const nom = libelleDe(cleFamille);
    const roleTexte = role.replace('_', ' ');
    propositions.push({
      cle: cleApprentissage(cleFamille, role), cleFamille, libelle: nom, role, etatPoids, unite, valeur, sens,
      nombre: liste.length, dates: triees.map((x) => x.date), valeursCorrigees: triees.map((x) => x.valeur),
      actuelle: { valeur: actuelle.valeur, unite: actuelle.unite, etat: actuelle.etat, origine: actuelle.origine, source: actuelle.source },
      historique: triees.slice(-5).map((x) => ({ date: x.date, nom: x.nom, valeur: x.valeur })),
      composantIds: triees.map((x) => x.id),
      texte: `Vous corrigez souvent ${nom} (${roleTexte}) vers ${valeur} ${libelle('UNITE', unite)} : en faire votre standard ?`,
    });
  }
  return propositions.sort((a, b) => a.libelle.localeCompare(b.libelle) || a.role.localeCompare(b.role)
    || a.etatPoids.localeCompare(b.etatPoids));
}
