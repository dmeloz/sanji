// Ajustements de la propriétaire sur les standards de base (décision du 2026-10-04, « Standards de base et ajustement
// terrain ») : quand la réalité de la cuisine diffère du manuel, la valeur changée dans Réglages passe devant pour toujours.
// Domaine pur, sans DOM, sans chiffre : la valeur de base vient de standards-base.js.
//
// API :
//  - USAGES_AJUSTABLES : rendements de parage et de cuisson, conservation, temps de cuisson, températures.
//  - cleAjustement(usage, sujet) -> « usage|sujet ». Sujet : clé de famille, « groupe:<clé> », « categorie:<clé> » ou
//    « regle:<clé> » (règle générale du référentiel : « regle:stockage_froid »…).
//  - ajustementDe(etat, sujet, usage) -> { valeur, unite, le, avant } | null.
//  - valeurEffective(etat, sujet, usage, { etatPoids?, regle? }) -> le standard de base tel quel (`ajuste: false`), ou,
//    si la propriétaire a ajusté : { ...standard, valeur, unite, origine: 'propriete', statut: 'RESTAURANT_VALIDE',
//    libelle: 'votre valeur', ajuste: true, ajustement, base: <standard de base ou null>, coefficient? (rendements) }.
//  - limiteHygiene(base, valeur, sujet?) -> texte d'avertissement ou null (conservation et température : au-delà de la
//    borne prudente du standard de base, selon `sens` ; `plage` : hors de la fourchette ; conservation : les règles
//    générales qui couvrent la famille comptent aussi).
//  - lignesStandardsBase(etat) -> [{ usage, titre, lignes: [{ usage, sujet, libelle, effectif, base, ajuste }] }].

import { REGLES_GENERALES, rattachementsDe, reperesConservation, standardDeBase, texteProvenance } from './standards-base.js';
import { GROUPES, familleParCle } from './savoir.js';

export const USAGES_AJUSTABLES = Object.freeze(['rendement_parage', 'rendement_cuisson', 'conservation', 'cuisson_temps', 'temperature']);
export const ORIGINE_PROPRIETE = 'propriete';
export const STATUT_PROPRIETE = 'RESTAURANT_VALIDE';
export const LIBELLE_PROPRIETE = 'votre valeur';

export const cleAjustement = (usage, sujet) => `${usage}|${sujet}`;

export function ajustementDe(etat, sujet, usage) {
  if (typeof sujet !== 'string' || sujet === '') return null;
  const table = etat?.ajustements;
  const cle = cleAjustement(usage, sujet);
  if (!table || typeof table !== 'object' || !Object.hasOwn(table, cle)) return null;
  const a = table[cle];
  return a && Number.isFinite(a.valeur) ? a : null;
}

/** Standard de base d'un sujet (« regle:<clé> » vise une règle générale). */
export function baseDe(sujet, usage, { etatPoids = null, regle = null } = {}) {
  if (typeof sujet === 'string' && sujet.startsWith('regle:')) return standardDeBase(null, usage, { etatPoids, regle: sujet.slice(6) });
  return standardDeBase(sujet ?? null, usage, { etatPoids, regle });
}

/** Coefficient (sortie / entrée) d'un rendement : « % » = perte, « x » = gain ; null si la valeur est inutilisable. */
export function coefficientDe(valeur, unite) {
  const c = unite === '%' ? 1 - valeur / 100 : unite === 'x' ? valeur : null;
  return Number.isFinite(c) && c > 0 ? Math.round(c * 1e6) / 1e6 : null;
}

export function valeurEffective(etat, sujet, usage, opts = {}) {
  const base = baseDe(sujet, usage, opts);
  const a = ajustementDe(etat, sujet ?? (opts.regle ? `regle:${opts.regle}` : null), usage);
  if (!a) return base ? { ...base, ajuste: false } : null;
  const eff = {
    usage, valeur: a.valeur, unite: a.unite, uniteSource: base?.uniteSource ?? a.unite,
    fourchette: base?.fourchette ?? { min: null, max: null }, etatPoids: base?.etatPoids ?? null, sens: base?.sens ?? null,
    origine: ORIGINE_PROPRIETE, statut: STATUT_PROPRIETE, libelle: LIBELLE_PROPRIETE, cible: base?.cible ?? null,
    provenance: base?.provenance ?? null, ecart: base?.ecart ?? null, ajuste: true, ajustement: a, base,
  };
  if (usage === 'rendement_parage' || usage === 'rendement_cuisson') {
    const c = coefficientDe(a.valeur, a.unite);
    if (c === null) return base ? { ...base, ajuste: false } : null;
    eff.coefficient = c;
  }
  return eff;
}

/** Vrai si `valeur` dépasse la limite de ce standard : borne prudente (`valeur` du standard) ou, pour `plage`, l'un des bords. */
function depasseLimite(std, valeur) {
  if (std.sens === 'prudent_min') return valeur > std.valeur;
  if (std.sens === 'prudent_max') return valeur < std.valeur;
  if (std.sens === 'plage') return (std.fourchette.min !== null && valeur < std.fourchette.min) || (std.fourchette.max !== null && valeur > std.fourchette.max);
  return false;
}

/**
 * Avertissement (jamais bloquant) si la valeur dépasse la limite de référence ; null sinon. La limite est la borne
 * PRUDENTE du standard (`base.valeur`), jamais l'autre bord de sa fourchette ; pour une conservation, les standards de
 * la famille (`sujet`) et les règles générales qui la couvrent comptent aussi (le plus précis qui est dépassé parle).
 */
export function limiteHygiene(base, valeur, sujet = null) {
  if (!base || !['conservation', 'temperature'].includes(base.usage) || !Number.isFinite(valeur)) return null;
  const candidats = [base];
  if (base.usage === 'conservation' && typeof sujet === 'string' && !sujet.startsWith('regle:')) {
    candidats.push(...reperesConservation(sujet).filter((x) => x.unite === base.unite && (!x.etatPoids || x.etatPoids === 'cuit')));
  }
  const std = candidats.find((x) => depasseLimite(x, valeur));
  if (!std) return null;
  return `${String(valeur).replace('.', ',')} ${base.unite} est au-delà de la limite de référence (${texteProvenance(std, { prefixe: false })}) : à valider avec le plan d'autocontrôle.`;
}

// ---------------------------------------------------------------- liste pour Réglages

const TITRES = Object.freeze({
  rendement_parage: 'Rendements de parage', rendement_cuisson: 'Rendements de cuisson', conservation: 'Conservation',
  cuisson_temps: 'Cuisson', temperature: 'Températures',
});

function sujetDe(cible) {
  if (cible.famille) return cible.famille;
  if (cible.groupe) return `groupe:${cible.groupe}`;
  if (cible.regle_generale) return `regle:${cible.regle_generale}`;
  return null;
}

const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function libelleDe(sujet) {
  return majuscule(libelleBrut(sujet));
}

function libelleBrut(sujet) {
  if (sujet.startsWith('regle:')) return REGLES_GENERALES.find((r) => r.cle === sujet.slice(6))?.libelle ?? sujet.slice(6);
  if (sujet.startsWith('groupe:')) return GROUPES.find((g) => g.cle === sujet.slice(7))?.libelle ?? sujet.slice(7);
  return familleParCle(sujet)?.libelle ?? sujet;
}

/** Une ligne par sujet rattaché de chaque usage ajustable (un sujet n'apparaît qu'une fois par usage). */
export function lignesStandardsBase(etat) {
  return USAGES_AJUSTABLES.map((usage) => {
    const vus = new Set();
    const lignes = [];
    for (const x of rattachementsDe(usage)) {
      const sujet = sujetDe(x.rattachement.cible);
      if (!sujet || vus.has(sujet)) continue;
      vus.add(sujet);
      const effectif = valeurEffective(etat, sujet, usage);
      if (!effectif) continue;
      lignes.push({ usage, sujet, libelle: libelleDe(sujet), effectif, base: effectif.ajuste ? effectif.base : effectif, ajuste: effectif.ajuste });
    }
    return { usage, titre: TITRES[usage], lignes };
  });
}
