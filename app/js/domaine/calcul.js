// Moteur de calcul : portions d'un menu et chaîne quantité servie -> brut à prévoir.
// Aucune quantité n'est inventée : un paramètre manquant donne un statut INCONNU.

import { aMenuDuJour } from './dates.js';
import { grammageEffectif } from './savoir.js';
import { ETAT_POIDS, estStandardBase, libelle } from './statuts.js';

export { chercherBase } from './base.js';

const ORDRE_ETAPES = ['portionnement', 'cuisson', 'parage'];
const ETAPES_PREPARATION = ['portionnement'];
const SEUIL_A_MESURER = 0.15;

const nombre = (v) => (Number.isFinite(v) ? v : 0);

/** Arrondi d'une quantité : à l'unité (g, ml) ou à la pièce / portion supérieure. */
export function arrondirQuantite(valeur, unite) {
  if (!Number.isFinite(valeur)) return null;
  const r = unite === 'piece' || unite === 'portion' ? Math.ceil(valeur - 1e-9) : Math.round(valeur);
  return r || 0;
}

function separerMilliers(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function nomUnite(unite, n) {
  if (unite === 'piece') return n >= 2 ? 'pièces' : 'pièce';
  if (unite === 'portion') return n >= 2 ? 'portions' : 'portion';
  return unite;
}

/** « 2 526 g », « 13 pièces », « 40 portions » (arrondi d'affichage). */
export function formaterQuantite(valeur, unite) {
  const n = arrondirQuantite(valeur, unite);
  return n === null ? '—' : `${separerMilliers(n)} ${nomUnite(unite, n)}`.trim();
}

/** Valeur exacte (jusqu'à 2 décimales, virgule), sans arrondi à l'unité : pour un grammage par portion. */
function formaterExact(valeur, unite) {
  const [entier, decimales] = String(Math.round(valeur * 100) / 100).split('.');
  return `${separerMilliers(entier)}${decimales ? `,${decimales}` : ''} ${nomUnite(unite, valeur)}`.trim();
}

/** Deux décimales ; trois si la troisième compte (milieu d'une fourchette de la base : 0,865), pour que la formule se recalcule. */
function formaterCoefficient(c) {
  const trois = c.toFixed(3);
  return (trois.endsWith('0') ? c.toFixed(2) : trois).replace('.', ',');
}

/**
 * Portions d'un menu pour un jour : prévision hors groupes + fiches actives du midi.
 * Le calcul relit toujours l'état courant : une fiche modifiée ou annulée ne compte jamais deux fois.
 * @returns {{total:number, prevision:number, previsionManquante?:true, groupesConfirmes:number,
 *   groupesProvisoires:number, details:{source:string, portions:number, certitude:string, ficheId?:string, numero?:string}[]}}
 */
export function portionsMenu(etat, date, menu) {
  const details = [];
  const res = { total: 0, prevision: 0, groupesConfirmes: 0, groupesProvisoires: 0, details };
  const prev = etat.jours?.[date]?.previsions?.[menu]?.portions;
  if (Number.isFinite(prev)) {
    res.prevision = prev;
    details.push({ source: 'prevision', portions: prev, certitude: 'estimee' });
  } else {
    res.previsionManquante = true;
  }
  if (aMenuDuJour(date)) {
    for (const f of Object.values(etat.fiches ?? {})) {
      if (f.statut !== 'active' || f.service !== 'midi' || f.date !== date || f.mode === 'hors_menu') continue;
      let portions;
      let certitude;
      if (f.mode === 'menu_fixe') {
        if (Number(f.menuFixe) !== menu) continue;
        portions = nombre(f.couverts);
        certitude = 'confirmee';
      } else if (f.mode === 'choix_libre') {
        portions = nombre(f.repartition?.[menu]);
        certitude = f.statutRepartition === 'confirmee' ? 'confirmee' : 'provisoire';
      } else continue;
      details.push({ source: 'fiche', ficheId: f.id, numero: f.numero, portions, certitude });
      if (certitude === 'confirmee') res.groupesConfirmes += portions;
      else res.groupesProvisoires += portions;
    }
  }
  res.total = res.prevision + res.groupesConfirmes + res.groupesProvisoires;
  return res;
}

// Seule une valeur de provenance inconnue reste à préciser. Une valeur issue des standards de base (STANDARD_BASE, ou son
// ancien nom BASE_METIER_ESTIMATION) est utilisée directement (décision du 2026-10-04) : elle n'est plus « à valider ».
const estimation = (statut) => statut === 'INCONNU';

/** Phrase du calcul en clair pour une étape que l'état du poids de la portion empêche d'appliquer. */
function phraseNonAppliquee(e) {
  if (e.etape === 'cuisson') return e.coefficient > 1 ? "le gain de cuisson n'est pas appliqué" : "la perte de cuisson n'est pas appliquée";
  return `la perte de ${e.etape} n'est pas appliquée`;
}

/**
 * Calcule la quantité de travail d'un composant (voir conception, sections 7 et 16.1).
 * La portion vient de grammageEffectif (plat, référence du nom, standard maison, repère de la base) et porte son
 * état : « cuit » remonte toute la chaîne (portionnement, cuisson, parage) ; « cru_net » et « sec » sont déjà des
 * quantités d'avant cuisson, donc ni portionnement ni cuisson ne sont appliqués (seul le parage mène au brut).
 * Une préparation maison se compte en quantité finie : son état est toujours « cuit ».
 * @param {object} etat
 * @param {string} composantId
 * @returns {object} { portions, unite, quantiteServie, etapes:[{etape, coefficient, statut, appliquee, quantiteAvant}],
 *   brut, quantiteTravail, uniteTravail, libelleQuantite, statut:'CALCULE'|'INCONNU', aValider, aMesurer, standardBase, dependances,
 *   formule, manquants, ingredients, quantiteCuiteEstimee }
 * `quantiteCuiteEstimee` : seulement si une étape de cuisson existe sans être appliquée (portion en poids sec ou
 * cru net) : quantité × coefficient de cuisson, à titre d'information ; sinon null.
 */
export function calculerComposant(etat, composantId) {
  const c = etat.composants?.[composantId];
  if (!c) throw new Error(`Composant introuvable : ${composantId}`);
  const portions = portionsMenu(etat, c.date, c.menu);
  const manquants = [];
  const bloquants = [];
  const dependances = [];
  const res = {
    portions, unite: null, quantiteServie: null, etapes: [], brut: null, quantiteTravail: null,
    uniteTravail: null, libelleQuantite: '', statut: 'INCONNU', aValider: false, aMesurer: false, standardBase: false,
    dependances, formule: '', manquants, ingredients: null, quantiteCuiteEstimee: null,
  };
  const signaler = (texte) => { manquants.push(texte); bloquants.push(texte); };
  if (portions.previsionManquante) manquants.push('prévision hors groupes');
  const nPortions = formaterQuantite(portions.total, 'portion');

  // Composant générique : portions seulement, composition à définir.
  if (c.type === 'generique') {
    res.unite = 'portion';
    res.uniteTravail = 'portion';
    res.libelleQuantite = 'portions, composition à définir';
    res.aValider = true;
    manquants.push('composition');
    // Une herbe va à la botte ou à la pièce, une sauce implicite n'a pas de portion avant d'être confirmée :
    // aucune quantité en portions, information neutre (ni bloquante ni alerte).
    const herbe = c.role === 'herbe';
    if (herbe || (c.role === 'sauce' && /à confirmer\s*$/i.test(String(c.nom ?? '')))) {
      res.unite = null;
      res.uniteTravail = null;
      res.libelleQuantite = herbe ? 'à la botte ou à la pièce : quantité à définir' : 'sauce à confirmer';
      res.formule = herbe ? 'Quantité à définir : une herbe se compte à la botte ou à la pièce, pas à la portion.'
        : "Sauce à confirmer : pas de portion tant qu'elle n'est pas choisie.";
      return res;
    }
    if (portions.previsionManquante && portions.total === 0) {
      bloquants.push('prévision hors groupes');
      res.formule = 'Quantité inconnue : prévision hors groupes à saisir.';
      return res;
    }
    // Un légume sans famille peut avoir une portion par le standard de sa catégorie : quantité servie seulement,
    // la perte de parage reste inconnue (aucune étape n'est connue pour lui).
    const gg = c.categorie === 'legume' ? grammageEffectif(etat, c) : null;
    if (gg) {
      const servie = portions.total * gg.valeur;
      dependances.push({ parametre: 'grammage', valeur: gg.valeur, statut: gg.statut, unite: gg.unite, etat: gg.etat, origine: gg.origine });
      res.unite = gg.unite;
      res.uniteTravail = gg.unite;
      res.quantiteServie = servie;
      res.quantiteTravail = servie;
      res.libelleQuantite = 'quantité servie, perte de parage inconnue';
      res.standardBase = estStandardBase(gg.statut);
      res.statut = 'CALCULE';
      res.formule = `${nPortions} × ${formaterExact(gg.valeur, gg.unite)} = ${formaterQuantite(servie, gg.unite)}, perte de parage inconnue`;
      return res;
    }
    res.quantiteTravail = portions.total;
    res.statut = 'CALCULE';
    res.formule = `${nPortions}, composition à définir`;
    return res;
  }

  const estPreparation = c.type === 'preparation_maison';
  res.libelleQuantite = estPreparation ? 'quantité finie à produire'
    : c.type === 'produit_simple' ? 'brut à prévoir' : 'quantité à préciser';
  if (!estPreparation && c.type !== 'produit_simple') signaler('type de composant');
  if (portions.previsionManquante && portions.total === 0) bloquants.push('prévision hors groupes');

  // Portion effective : jamais inventée, null si aucune source ne la donne.
  const g = grammageEffectif(etat, c);
  res.unite = g?.unite ?? c.grammage?.unite ?? null;
  if (!g) signaler('grammage');
  else dependances.push({ parametre: 'grammage', valeur: g.valeur, statut: g.statut, unite: g.unite, etat: g.etat, origine: g.origine });
  const etatPoids = estPreparation || !g ? ETAT_POIDS.cuit : g.etat;
  // Hors « cuit », la quantité est déjà celle d'avant cuisson : seul le parage reste à remonter.
  const dansLaChaine = (nom) => etatPoids === ETAT_POIDS.cuit || nom === 'parage';

  // Étapes applicables, dans l'ordre fixe ; une même étape ne compte qu'une fois.
  const applicables = estPreparation ? ETAPES_PREPARATION : c.type === 'produit_simple' ? ORDRE_ETAPES : [];
  const etapes = [];
  for (const nom of applicables) {
    const lignes = (c.etapes ?? []).filter((e) => e.etape === nom);
    if (lignes.length === 0) continue;
    if (lignes.length > 1) { signaler(`étape en double (${nom})`); continue; }
    const e = lignes[0];
    if (!Number.isFinite(e.coefficient) || e.coefficient <= 0) { signaler(`coefficient ${nom}`); continue; }
    const appliquee = dansLaChaine(nom);
    etapes.push({ etape: nom, coefficient: e.coefficient, statut: e.statut, appliquee });
    if (appliquee) dependances.push({ parametre: nom, valeur: e.coefficient, statut: e.statut });
  }
  const appliquees = etapes.filter((e) => e.appliquee);

  // Recette de la préparation maison.
  let recette = null;
  if (estPreparation) {
    recette = c.recetteId ? etat.recettes?.[c.recetteId] ?? null : null;
    if (recette) {
      dependances.push({ parametre: 'recette', valeur: recette.version, statut: recette.valide ? 'RESTAURANT_VALIDE' : 'INCONNU' });
    }
    if (!recette || !recette.valide) manquants.push('recette');
  }

  // Seules les étapes réellement appliquées comptent pour la validation et la mesure. `aMesurer` reste une information :
  // une forte perte ou un fort gain de base gagne à être pesé, mais ne bloque rien. `standardBase` : la quantité repose
  // au moins en partie sur un standard de base (libellé « standard de base » dans les commandes).
  res.aValider = estimation(g?.statut ?? 'INCONNU') || appliquees.some((e) => estimation(e.statut)) || Boolean(recette && !recette.valide);
  res.aMesurer = appliquees.some((e) => estStandardBase(e.statut)
    && Math.round(Math.abs(1 - e.coefficient) * 1e6) / 1e6 >= SEUIL_A_MESURER);
  res.standardBase = estStandardBase(g?.statut) || appliquees.some((e) => estStandardBase(e.statut));

  if (bloquants.length > 0) {
    res.etapes = etapes.map((e) => ({ ...e, quantiteAvant: null }));
    res.formule = `Quantité inconnue : il manque ${bloquants.join(', ')}.`;
    return res;
  }

  // Chaîne de calcul : à chaque étape appliquée, quantité avant = quantité courante / coefficient.
  const u = g.unite;
  const servie = portions.total * g.valeur;
  let courante = servie;
  let formule = `${nPortions} × ${formaterExact(g.valeur, u)} = ${formaterQuantite(servie, u)}`;
  formule += etatPoids === ETAT_POIDS.cuit ? (appliquees.length > 0 ? ' servis' : '') : ` (poids ${libelle('ETAT_POIDS', etatPoids)})`;
  res.quantiteServie = servie;
  res.etapes = etapes.map((e) => {
    if (!e.appliquee) return { ...e, quantiteAvant: null };
    courante /= e.coefficient;
    formule += ` ; ÷ ${formaterCoefficient(e.coefficient)} (${e.etape}${e.coefficient > 1 ? ', gain' : ''}) = ${formaterQuantite(courante, u)}`;
    return { ...e, quantiteAvant: courante };
  });
  res.brut = courante;
  res.quantiteTravail = courante;
  res.uniteTravail = u;
  res.statut = 'CALCULE';
  formule += estPreparation ? ' à produire' : appliquees.length > 0 ? ' bruts'
    : etapes.length === 0 ? ' à prévoir (aucune étape de perte ou de gain)' : ' à prévoir';

  // Étapes présentes mais non appliquées : dit en clair, et quantité cuite estimée à titre d'information seulement.
  const nonAppliquees = etapes.filter((e) => !e.appliquee);
  if (nonAppliquees.length > 0) {
    const notes = [`portion exprimée en poids ${libelle('ETAT_POIDS', etatPoids)} : ${nonAppliquees.map(phraseNonAppliquee).join(' ; ')}`];
    const cuite = nonAppliquees.find((e) => e.etape === 'cuisson');
    if (cuite) {
      res.quantiteCuiteEstimee = servie * cuite.coefficient;
      notes.push(`quantité cuite estimée ${formaterQuantite(res.quantiteCuiteEstimee, u)}, à titre d'information seulement`);
    }
    formule += ` (${notes.join(' ; ')})`;
  }
  if (portions.previsionManquante) formule += ' (prévision hors groupes non saisie)';
  res.formule = formule;

  if (estPreparation) {
    const exploitable = recette && recette.valide && Number.isFinite(recette.rendement?.valeur)
      && recette.rendement.valeur > 0 && recette.rendement.unite === u
      && (recette.ingredients ?? []).every((i) => Number.isFinite(i.quantite));
    if (exploitable) {
      res.ingredients = recette.ingredients.map((i) => ({
        nom: i.nom, quantite: (courante / recette.rendement.valeur) * i.quantite, unite: i.unite,
      }));
    } else if (recette && recette.valide) {
      manquants.push('rendement ou quantités de la recette (unité du rendement = unité du grammage)');
    }
  }
  return res;
}
