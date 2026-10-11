// Standards de base (décision validée du 2026-10-04, « Standards de base et ajustement terrain ») : la base métier, les
// repères de portion validés et le référentiel culinaire sont utilisés directement par les calculs ; la valeur de la
// propriétaire (correction du plat, référence du nom, standard maison) passe toujours devant, ailleurs (savoir.js).
// Ce module ne choisit que la valeur de BASE. Aucun chiffre ici : les valeurs viennent de donnees/base-metier.js et
// donnees/savoir-culinaire.js (généré depuis savoir/culinaire/, rattachements choisis à la main).
//
// API (domaine pur, sans DOM) :
//  - USAGES : 'rendement_parage' | 'rendement_cuisson' | 'conservation' | 'cuisson_temps' | 'temperature'
//    | 'buffet_couvert' | 'refroidissement' (h, règle générale) | 'limite_duree' (h, règle générale)
//    | 'duree_stockage' (h, semaines ou mois, jamais converties) | 'allergene'.
//  - standardDeBase(sujet, usage, { etatPoids?, regle? }) -> Standard | null
//      sujet : clé de famille (FAMILLES de savoir.js), « groupe:<clé> », « categorie:<clé> » ou null (règles générales).
//      etatPoids : 'sec' | 'cru_net' | 'cuit' : écarte les entrées d'un autre état (une entrée sans état convient).
//      regle : clé de REGLES_GENERALES (« cuisson_coeur », « stockage_froid »…) : ne lit que cette règle.
//      Sans `regle`, l'ordre est : famille, puis groupe, puis règle générale qui vise explicitement le groupe ou la
//      catégorie du sujet (une règle qui vaut pour tout ne se lit qu'en la nommant).
//  - Standard = { usage, valeur, fourchette: {min, max}, unite, uniteSource, etatPoids, sens, origine: 'referentiel'
//      | 'base_metier', statut: 'STANDARD_BASE', libelle: 'standard de base', provenance: { id | table, produit?, source,
//      verification, confiance, version }, ecart: null | { referentiel: {min, max}, base_metier: {min, max} },
//      coefficient? (rendements seulement : sortie / entrée, à appliquer comme une étape) }
//    Valeur : milieu de la fourchette (quantités, rendements, durées de cuisson) ; borne prudente pour l'hygiène
//    (`sens` du rattachement : prudent_min = minimum, prudent_max = maximum ; plage = température à respecter des deux côtés, valeur au milieu, avertit hors de la fourchette) ; un seuil seul (min ou max) est pris tel
//    quel (l'autre borne de la fourchette vaut null). Rendement en « % » = perte (coefficient = 1 − perte / 100) ;
//    en « x » = gain (coefficient = valeur).
//    Choix : référentiel quand sa vérification à la source est « confirmee » ; sinon base métier si elle a la valeur ;
//    sinon référentiel. `ecart` est renseigné quand les deux existent et que leurs fourchettes diffèrent.
//  - rendementDeBase(famille, 'parage' | 'cuisson') -> Standard (avec coefficient) | null.
//  - reperesConservation(famille) -> Standard[] : toutes les durées de conservation qui visent la famille (famille,
//    groupe, règles générales), de la plus précise à la plus générale, chacune avec `cible`.
//  - reperesCuisson(famille) -> Standard[] : rendement de cuisson et temps de cuisson de la famille.
//  - reperesAide(familleOuTheme) -> entrées d'aide (non rattachées) de cette famille ou de ce thème.
//  - rattachementsDe(usage) -> entrées rattachées à cet usage (allergènes, écrans d'aide…).
//  - texteProvenance(standard, { prefixe = true }) -> « standard de base, référentiel culinaire : … » (libellé
//    affichable ; sans préfixe : « référentiel culinaire : … » ou « base métier : … », pour la source d'une étape).

import { BASE_METIER, VERSION_BASE } from '../donnees/base-metier.js';
import { REGLES_GENERALES, SAVOIR_CULINAIRE, VERSION_REFERENTIEL } from '../donnees/savoir-culinaire.js';
import { FAMILLES, familleParCle } from './savoir.js';
import { LIBELLE_STANDARD_BASE } from './statuts.js';

export const USAGES = Object.freeze(['rendement_parage', 'rendement_cuisson', 'conservation', 'cuisson_temps',
  'temperature', 'buffet_couvert', 'refroidissement', 'limite_duree', 'duree_stockage', 'allergene']);
export const STATUT_STANDARD_BASE = 'STANDARD_BASE';
export { LIBELLE_STANDARD_BASE, REGLES_GENERALES };

const RATTACHEES = SAVOIR_CULINAIRE.filter((x) => x.rattachement);
const REGLES = new Map(REGLES_GENERALES.map((r) => [r.cle, r]));
const TABLE_BASE = Object.freeze({ parage: '11.1', cuisson: '11.2' });

const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arrondi = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
const etatDe = (x) => x.rattachement.cible.etat ?? x.etat_poids ?? null;
const universelle = (r) => !(r?.groupes?.length) && !(r?.categories?.length);
const couvre = (r, s) => Boolean(r) && (universelle(r) || (r.groupes ?? []).includes(s.groupe)
  || (r.categories ?? []).includes(s.categorie));

/** Sujet résolu : { famille, groupe, categorie } (chaque champ peut être null). */
function resoudre(sujet) {
  const vide = { famille: null, groupe: null, categorie: null };
  if (typeof sujet !== 'string' || sujet === '') return vide;
  if (sujet.startsWith('groupe:')) {
    const groupe = sujet.slice('groupe:'.length);
    return { famille: null, groupe, categorie: FAMILLES.find((f) => f.groupe === groupe)?.categorie ?? null };
  }
  if (sujet.startsWith('categorie:')) return { ...vide, categorie: sujet.slice('categorie:'.length) };
  const f = familleParCle(sujet);
  return f ? { famille: f.cle, groupe: f.groupe, categorie: f.categorie } : vide;
}
const sujetVide = (s) => !s.famille && !s.groupe && !s.categorie;

/** Entrée rattachée la plus précise pour un usage et un sujet, ou null. */
function entreeReferentiel(usage, s, { etatPoids = null, regle = null } = {}) {
  const liste = RATTACHEES.filter((x) => x.rattachement.usage === usage && x.valeur);
  const c = (x) => x.rattachement.cible;
  const niveaux = regle
    ? [liste.filter((x) => c(x).regle_generale === regle && (sujetVide(s) || couvre(REGLES.get(regle), s)))]
    : [
      s.famille ? liste.filter((x) => c(x).famille === s.famille) : [],
      s.groupe ? liste.filter((x) => c(x).groupe === s.groupe) : [],
      liste.filter((x) => c(x).regle_generale && !universelle(REGLES.get(c(x).regle_generale))
        && couvre(REGLES.get(c(x).regle_generale), s)),
    ];
  const rendement = usage === 'rendement_parage' || usage === 'rendement_cuisson';
  for (const niveau of niveaux) {
    const admis = rendement || !etatPoids ? niveau : niveau.filter((x) => !etatDe(x) || etatDe(x) === etatPoids);
    if (admis.length === 0) continue;
    return [...admis].sort((a, b) => Number(etatDe(b) === etatPoids) - Number(etatDe(a) === etatPoids))[0];
  }
  return null;
}

/** Coefficient (sortie / entrée) d'une valeur de rendement exprimée en perte « % » ou en gain « x ». */
const coefficientDe = (valeur, unite) => (unite === '%' ? arrondi(1 - valeur / 100, 6) : valeur);

function depuisReferentiel(x, usage) {
  const r = x.rattachement;
  const min = nombre(x.valeur.min);
  const max = nombre(x.valeur.max);
  let valeur;
  if (min !== null && max !== null) {
    valeur = r.sens === 'prudent_min' ? min : r.sens === 'prudent_max' ? max : arrondi((min + max) / 2);
  } else valeur = min ?? max;
  const std = {
    usage, valeur, fourchette: { min, max }, unite: r.unite, uniteSource: x.valeur.unite, etatPoids: etatDe(x),
    sens: r.sens ?? null, origine: 'referentiel', statut: STATUT_STANDARD_BASE, libelle: LIBELLE_STANDARD_BASE,
    cible: r.cible,
    provenance: {
      id: x.id, sujet: x.sujet, source: x.sources.map((s) => s.titre).join(' ; '),
      verification: x.verification?.resultat ?? null, confiance: x.confiance, version: VERSION_REFERENTIEL,
    },
    ecart: null,
  };
  if (usage === 'rendement_parage' || usage === 'rendement_cuisson') std.coefficient = coefficientDe(valeur, r.unite);
  return std;
}

/** Standard de la base métier pour une étape d'une famille (lignes 11.1 parage, 11.2 cuisson), ou null. */
function depuisBase(cleFamille, etape) {
  const f = familleParCle(cleFamille);
  const lien = f?.etapes.find((x) => x.etape === etape);
  const ligne = lien ? BASE_METIER.find((l) => l.etape === etape && l.produit === lien.produitBase) : null;
  if (!ligne) return null;
  const coefficient = (ligne.coefMin + ligne.coefMax) / 2;
  const gain = ligne.coefMin >= 1;
  const fourchette = gain ? { min: ligne.coefMin, max: ligne.coefMax }
    : { min: arrondi((1 - ligne.coefMax) * 100, 2), max: arrondi((1 - ligne.coefMin) * 100, 2) };
  return {
    usage: `rendement_${etape}`, valeur: gain ? coefficient : arrondi((fourchette.min + fourchette.max) / 2, 2),
    fourchette, unite: gain ? 'x' : '%', uniteSource: ligne.texte, etatPoids: null, sens: null, origine: 'base_metier',
    statut: STATUT_STANDARD_BASE, libelle: LIBELLE_STANDARD_BASE, cible: { famille: f.cle },
    provenance: { table: TABLE_BASE[etape], produit: ligne.produit, source: `base métier : ${ligne.texte}`,
      verification: null, confiance: null, version: VERSION_BASE },
    ecart: null, coefficient,
  };
}

const memeFourchette = (a, b) => ['min', 'max'].every((k) => (a[k] === null || b[k] === null ? a[k] === b[k]
  : Math.abs(a[k] - b[k]) < 1e-6));

/**
 * Standard de base pour un sujet et un usage (voir l'en-tête), ou null si ni le référentiel ni la base ne le donnent.
 * @param {string|null} sujet
 * @param {string} usage
 * @param {{etatPoids?:string|null, regle?:string|null}} [options]
 */
export function standardDeBase(sujet, usage, { etatPoids = null, regle = null } = {}) {
  if (!USAGES.includes(usage)) return null;
  const s = resoudre(sujet);
  const x = entreeReferentiel(usage, s, { etatPoids, regle });
  const ref = x ? depuisReferentiel(x, usage) : null;
  const etape = usage === 'rendement_parage' ? 'parage' : usage === 'rendement_cuisson' ? 'cuisson' : null;
  const base = etape && s.famille && !regle ? depuisBase(s.famille, etape) : null;
  let choix;
  if (ref && ref.provenance.verification === 'confirmee') choix = ref;
  else choix = base ?? ref;
  if (!choix) return null;
  if (ref && base && (ref.unite !== base.unite || !memeFourchette(ref.fourchette, base.fourchette))) {
    choix.ecart = { referentiel: { ...ref.fourchette }, base_metier: { ...base.fourchette } };
  }
  return choix;
}

/** Rendement de base d'une famille pour une étape (« parage » ou « cuisson »), avec son coefficient, ou null. */
export function rendementDeBase(famille, type) {
  if (type !== 'parage' && type !== 'cuisson') return null;
  return standardDeBase(famille, `rendement_${type}`);
}

/** Durées de conservation qui visent la famille : famille, groupe, puis règles générales (universelles comprises). */
export function reperesConservation(famille) {
  const s = resoudre(famille);
  if (sujetVide(s)) return [];
  const rang = (x) => {
    const c = x.rattachement.cible;
    if (c.famille) return c.famille === s.famille ? 0 : -1;
    if (c.groupe) return c.groupe === s.groupe ? 1 : -1;
    const r = REGLES.get(c.regle_generale);
    if (!couvre(r, s)) return -1;
    return universelle(r) ? 3 : 2;
  };
  return RATTACHEES.filter((x) => x.rattachement.usage === 'conservation' && x.valeur && rang(x) >= 0)
    .sort((a, b) => rang(a) - rang(b))
    .map((x) => depuisReferentiel(x, 'conservation'));
}

/** Rendement de cuisson et temps de cuisson de base d'une famille (ceux qui existent). */
export function reperesCuisson(famille) {
  return [rendementDeBase(famille, 'cuisson'), standardDeBase(famille, 'cuisson_temps')].filter(Boolean);
}

/** Entrées d'aide (non rattachées) d'une famille (`aide.famille`) ou d'un thème du référentiel. */
export function reperesAide(cle) {
  if (typeof cle !== 'string' || cle === '') return [];
  return SAVOIR_CULINAIRE.filter((x) => x.aide && (x.aide.famille === cle || x.theme === cle));
}

/** Entrées rattachées à un usage, dans l'ordre du référentiel. */
export function rattachementsDe(usage) {
  return RATTACHEES.filter((x) => x.rattachement.usage === usage);
}

const nombreFr = (n) => String(n).replace('.', ',');
const texteFourchette = (f) => (f.min !== null && f.max !== null
  ? (f.min === f.max ? nombreFr(f.min) : `${nombreFr(f.min)}–${nombreFr(f.max)}`)
  : f.min !== null ? `au moins ${nombreFr(f.min)}` : `au plus ${nombreFr(f.max)}`);
const LIBELLE_VERIFICATION = Object.freeze({
  confirmee: 'confirmé à la source', partielle: 'confirmé en partie', non_confirmee: 'non confirmé à la source',
  base_sanji_seule: 'base métier seule',
});

/** Provenance lisible d'un standard : « standard de base, référentiel culinaire : 12–25 % de perte … (id, confirmé à la source) ». */
export function texteProvenance(std, { prefixe = true } = {}) {
  if (!std) return '';
  const debut = prefixe ? `${LIBELLE_STANDARD_BASE}, ` : '';
  if (std.origine === 'base_metier') return `${debut}base métier : ${std.provenance.produit} ${std.uniteSource}`;
  const verif = LIBELLE_VERIFICATION[std.provenance.verification];
  return `${debut}référentiel culinaire : ${texteFourchette(std.fourchette)} ${std.uniteSource}`
    + ` (${std.provenance.id}${verif ? `, ${verif}` : ''})`;
}
