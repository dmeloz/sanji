// État du poids d'une portion (v132) : où une portion est stockée, lesquelles sont suspectes, comment les corriger, et « comment
// c'est calculé » en toutes lettres. Une portion est stockée à QUATRE endroits, chacun avec son état du poids :
//  - 'standard'  : etat.standards[famille ou groupe:…][rôle]                      (standard maison)
//  - 'plat'      : composant.grammage (correction du plat, ou copie reprise d'une fiche / d'une référence : `repris`)
//  - 'reference' : etat.memoire[nom|menu].parRole[rôle].grammage                   (référence du nom)
//  - 'fiche'     : etat.fiches_retenues[nom].grammage                              (fiche retenue)
// Un « lieu » = { type, … } désigne un de ces endroits. Rien n'est corrigé seul : la propriétaire confirme (« c'est bien du cuit »)
// ou change l'état du poids (valeur et unité inchangées). Aucun chiffre ici : les repères viennent de `lignesStandards`.

import { terminer } from './actions.js';
import { calculerComposant } from './calcul.js';
import { cleMemoire, normaliser } from './etat.js';
import { cleDeNom } from './fiches-retenues.js';
import { etatRepereFamille, quantiteEnPoids } from './mise-en-place.js';
import { cleStandardGroupe, FAMILLES, familleDe, familleParCle, grammageEffectif, groupeDeCleStandard, lignesStandards } from './savoir.js';
import { ETAT_POIDS, libelle } from './statuts.js';
import { lundiDe } from './dates.js';

const TYPES_LIEU = ['standard', 'plat', 'reference', 'fiche'];
const ORDRE_LIEU = Object.fromEntries(TYPES_LIEU.map((t, i) => [t, i]));
const CONFIRMATION = 'cuit_confirme';

const propre = (objet, cle) => (objet && typeof objet === 'object' && typeof cle === 'string' && Object.hasOwn(objet, cle) ? objet[cle] : undefined);
const positif = (v) => Number.isFinite(v) && v > 0;
/** Une portion sans état connu se lit « cuit » (comme `grammageEffectif`). */
const etatLu = (g) => (Object.hasOwn(ETAT_POIDS, g?.etat) ? g.etat : ETAT_POIDS.cuit);
const nombreFr = (v, decimales = 2) => String(Math.round(v * 10 ** decimales) / 10 ** decimales).replace('.', ',');

function verifierH(h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) throw new Error('Horodatage manquant ou invalide : chaque action reçoit l\'heure (ISO) en dernier argument.');
}

/** Clé, dans `etat.validations`, de « oui, c'est bien du cuit » pour un standard maison (v131). */
export const cleCuitConfirme = (cleFamille, role) => `etat_poids:${cleFamille}|${role}`;

/** Clé de confirmation d'un lieu : elle distingue l'endroit (un standard, un plat précis, une référence, une fiche). */
export function cleConfirmationLieu(lieu) {
  if (lieu.type === 'standard') return cleCuitConfirme(lieu.cleFamille, lieu.role);
  if (lieu.type === 'plat') return `etat_poids:plat:${lieu.composantId}`;
  if (lieu.type === 'reference') return `etat_poids:reference:${lieu.cle}|${lieu.role}`;
  return `etat_poids:fiche:${lieu.cle}`;
}

/** La portion (objet réel, modifiable) à un lieu, ou null si elle n'y est plus. */
function portionDuLieu(etat, lieu) {
  let g;
  if (lieu?.type === 'standard') g = propre(propre(etat.standards, lieu.cleFamille), lieu.role);
  else if (lieu?.type === 'plat') g = propre(etat.composants, lieu.composantId)?.grammage;
  else if (lieu?.type === 'reference') g = propre(propre(propre(etat.memoire, lieu.cle), 'parRole')?.[lieu.role], 'grammage');
  else if (lieu?.type === 'fiche') g = propre(etat.fiches_retenues, lieu.cle)?.grammage;
  return positif(g?.valeur) ? g : null;
}

const confirmee = (etat, lieu, g) => {
  const c = propre(etat.validations, cleConfirmationLieu(lieu));
  return Boolean(c) && (c.valeur === undefined || (c.valeur === g.valeur && c.unite === g.unite));
};

/** Clé réellement présente dans `etat.memoire` pour un nom et un menu (« nom|menu », sinon l'ancienne clé « nom »). */
function cleMemoireReelle(memoire, nom, menu) {
  const cle = cleMemoire(nom, menu);
  if (propre(memoire, cle)) return cle;
  const ancienne = normaliser(nom);
  return propre(memoire, ancienne) ? ancienne : null;
}

/** Où est la source d'une portion REPRISE (fiche retenue ou référence du nom) ; null si elle n'existe plus. */
function origineRepris(etat, c) {
  const lieu = /fiche retenue/.test(c.grammage?.source ?? '') ? { type: 'fiche', cle: cleDeNom(c.nom) }
    : { type: 'reference', cle: cleMemoireReelle(etat.memoire, c.nom, c.menu), role: c.role };
  return lieu.cle && portionDuLieu(etat, lieu) ? lieu : null;
}

/** Toutes les portions stockées, avec leur famille (celle qu'on lit dans le nom quand l'endroit n'en porte pas). */
function portionsStockees(etat, debut, lignes) {
  const sortie = [];
  const ajouter = (lieu, famille, role, nom, g, repris = false) => {
    if (famille && role && positif(g?.valeur)) sortie.push({ lieu, famille, role, nom, g, repris });
  };
  for (const [cle, roles] of Object.entries(etat.standards ?? {})) {
    // Un standard de catégorie s'applique aux familles du groupe : la première dont le repère est « sec » sert de famille de comparaison.
    const groupe = groupeDeCleStandard(cle);
    if (!groupe && !familleParCle(cle)) continue;
    for (const [role, g] of Object.entries(roles ?? {})) {
      const famille = groupe ? FAMILLES.find((f) => f.groupe === groupe && etatRepereFamille(lignes, f.cle, g?.unite) === ETAT_POIDS.sec)?.cle : cle;
      ajouter({ type: 'standard', cleFamille: cle, role }, famille, role, null, g);
    }
  }
  for (const c of Object.values(etat.composants ?? {})) {
    if (c.type === 'preparation_maison' || (debut && c.date < debut)) continue;
    if (c.grammage?.repris === true && origineRepris(etat, c)) continue; // couverte par son origine : la correction s'y fait, la copie la suit
    ajouter({ type: 'plat', composantId: c.id }, c.famille, c.role, c.nom, c.grammage, c.grammage?.repris === true);
  }
  for (const [cle, m] of Object.entries(etat.memoire ?? {})) {
    for (const [role, v] of Object.entries(m?.parRole ?? {})) ajouter({ type: 'reference', cle, role }, familleDe(m.nom ?? cle)?.cle ?? null, role, m.nom ?? null, v?.grammage);
  }
  for (const [cle, f] of Object.entries(etat.fiches_retenues ?? {})) {
    ajouter({ type: 'fiche', cle }, f.famille ?? familleDe(f.nom ?? cle)?.cle ?? null, f.role, f.nom ?? null, f.grammage);
  }
  return sortie;
}

/** Fourchette du repère validé de la famille ({min, max}), pour le rôle donné de préférence ; null sans repère. */
function fourchetteRepere(lignes, famille, role, unite) {
  const reperes = lignes.filter((l) => l.cleFamille === famille && l.repereBase?.portee === 'famille' && l.repereBase.valide && l.repereBase.unite === unite);
  const r = (reperes.find((l) => l.role === role) ?? reperes[0])?.repereBase;
  return r ? { min: r.min, max: r.max } : null;
}

const PHRASE_LIEU = { standard: 'enregistrée dans vos standards', plat: 'tapée sur ce plat', reference: 'mémorisée comme référence de ce nom', fiche: 'retenue dans la fiche de ce nom' };

function texteSuspect(groupe, famille, fourchette) {
  const u = libelle('UNITE', groupe.unite);
  const portion = `${nombreFr(groupe.valeur)} ${u}`;
  const types = [...new Set(groupe.lieux.map((l) => l.type))].sort((a, b) => ORDRE_LIEU[a] - ORDRE_LIEU[b]);
  const seulStandard = types.length === 1 && types[0] === 'standard';
  const deCategorie = groupe.lieux.some((l) => groupeDeCleStandard(l.cleFamille));
  const debut = seulStandard ? `Votre standard de ${deCategorie ? 'la catégorie' : famille.toLowerCase()} (${portion}) est enregistré en poids cuit`
    : `Votre portion de ${groupe.nom ?? famille.toLowerCase()} (${portion}), ${types.map((t) => PHRASE_LIEU[t]).join(' et ')}, est enregistrée en poids cuit`;
  const repere = fourchette ? ` (${nombreFr(fourchette.min)}–${nombreFr(fourchette.max)} ${u})` : '';
  let ecart = '';
  if (fourchette && groupe.valeur < fourchette.min) ecart = ` ${portion} est en dessous du repère.`;
  else if (fourchette && groupe.valeur > fourchette.max) ecart = ` ${portion} est au-dessus du repère.`;
  return `${debut} : le repère de ${famille.toLowerCase()} est en poids sec${repere}.${ecart} C'est bien du cuit ?`;
}

/**
 * Portions enregistrées « cuit » alors que le repère validé de leur famille est « sec », QUEL QUE SOIT l'endroit où elles sont stockées.
 * Une carte par portion : les endroits qui portent la même valeur (famille, rôle, valeur, unité) sont regroupés dans `lieux`
 * (le plat, sa référence, sa fiche retenue). Un endroit déjà confirmé (« c'est bien du cuit », pour cette valeur) est écarté.
 * `aujourd` : seuls les plats de la semaine en cours et des suivantes comptent (les anciens plats ne sont plus servis).
 * @returns {{cle:string, cleFamille:string, role:string, libelle:string, nom:string|null, valeur:number, unite:string,
 *   lieux:object[], composantId:string|null, texte:string}[]}
 */
export function portionsCuitesSuspectes(etat, aujourd = null) {
  const lignes = lignesStandards(etat);
  const groupes = new Map();
  for (const p of portionsStockees(etat, aujourd ? lundiDe(aujourd) : null, lignes)) {
    if (etatLu(p.g) !== ETAT_POIDS.cuit || etatRepereFamille(lignes, p.famille, p.g.unite) !== ETAT_POIDS.sec || confirmee(etat, p.lieu, p.g)) continue;
    const cle = `${p.famille}|${p.role}|${p.g.valeur}|${p.g.unite}`;
    if (!groupes.has(cle)) {
      groupes.set(cle, { cle, cleFamille: p.famille, role: p.role, libelle: familleParCle(p.famille).libelle, nom: null, valeur: p.g.valeur, unite: p.g.unite, lieux: [], composantId: null });
    }
    const groupe = groupes.get(cle);
    groupe.lieux.push(p.lieu);
    // Le nom dit à la propriétaire de quoi on parle : un plat qu'elle a tapé d'abord, sinon la référence ou la fiche du nom.
    if (p.nom && (!groupe.nom || (p.lieu.type === 'plat' && !p.repris))) groupe.nom = p.nom;
    if (p.lieu.type === 'plat' && !groupe.composantId) groupe.composantId = p.lieu.composantId;
  }
  return [...groupes.values()].map((g) => ({
    ...g, lieux: g.lieux.sort((a, b) => ORDRE_LIEU[a.type] - ORDRE_LIEU[b.type]),
    texte: texteSuspect(g, g.libelle, fourchetteRepere(lignes, g.cleFamille, g.role, g.unite)),
  }));
}

// ---------------------------------------------------------------- actions

function exigerPortion(etat, lieu) {
  const g = portionDuLieu(etat, lieu);
  if (!g) throw new Error("Cette portion n'existe plus à cet endroit : rien à faire.");
  return g;
}

/** Change l'état du poids d'un lieu (valeur et unité intactes) ; renvoie ce qui est dit au journal. */
function appliquerEtat(etat, lieu, etatPoids, h) {
  const g = exigerPortion(etat, lieu);
  // Seul l'état change : `h` (qui date la portion pour l'apprentissage) et tout autre champ restent intacts, pour un standard comme pour une fiche.
  g.etat = etatPoids;
  suivreCopiesReprises(etat, lieu, g, etatPoids);
  return `${lieu.type} ${g.valeur} ${g.unite} → ${etatPoids}`;
}

/** Les copies reprises d'une fiche ou d'une référence (même valeur) suivent la correction de leur origine. */
function suivreCopiesReprises(etat, lieu, g, etatPoids) {
  if (lieu.type !== 'fiche' && lieu.type !== 'reference') return;
  for (const c of Object.values(etat.composants ?? {})) {
    const copie = c.grammage;
    if (copie?.repris !== true || copie.valeur !== g.valeur || copie.unite !== g.unite) continue;
    if (JSON.stringify(origineRepris(etat, c)) === JSON.stringify(lieu)) copie.etat = etatPoids;
  }
}

function exigerEtatPoids(etatPoids) {
  if (!Object.hasOwn(ETAT_POIDS, etatPoids)) throw new Error(`État du poids inconnu : « ${etatPoids} ».`);
}

/** Change l'état du poids de la portion de plusieurs lieux (une carte), en une action. Tout est vérifié avant d'écrire. */
export function corrigerEtatPoidsLieux(etat, lieux, etatPoids, h) {
  verifierH(h);
  exigerEtatPoids(etatPoids);
  if (!Array.isArray(lieux) || lieux.length === 0) throw new Error('Aucune portion à corriger.');
  lieux.forEach((l) => exigerPortion(etat, l));
  const faits = lieux.map((l) => appliquerEtat(etat, l, etatPoids, h));
  return terminer(etat, h, 'corrigerEtatPoids', `état du poids : ${faits.join(' ; ')}`, lieux.length);
}

/** Change l'état du poids de la portion d'un seul lieu (sec / cru / cuit). */
export const definirEtatPoidsPortion = (etat, lieu, etatPoids, h) => corrigerEtatPoidsLieux(etat, [lieu], etatPoids, h);

/** « Oui, c'est du cuit » : les portions restent telles quelles ; la carte se tait pour cette valeur, à chacun de ces endroits. */
export function confirmerPortionsCuites(etat, lieux, h) {
  verifierH(h);
  if (!Array.isArray(lieux) || lieux.length === 0) throw new Error('Aucune portion à confirmer.');
  const portions = lieux.map((l) => exigerPortion(etat, l));
  if (etat.validations === null || typeof etat.validations !== 'object') etat.validations = {};
  lieux.forEach((l, i) => { etat.validations[cleConfirmationLieu(l)] = { statut: CONFIRMATION, h, valeur: portions[i].valeur, unite: portions[i].unite }; });
  return terminer(etat, h, 'confirmerPortionCuite', `confirmé en poids cuit : ${lieux.map((l) => l.type).join(', ')}`, lieux.length);
}

// ---------------------------------------------------------------- « comment c'est calculé »

const ETAPE_EN_CLAIR = { portionnement: () => 'portionnement', parage: () => 'perte de parage', cuisson: (c) => (c > 1 ? 'gain de cuisson' : 'perte de cuisson') };

/** Où est stockée la portion qui sert au calcul, avec son nom en clair ; lieu null pour un repère de base (rien à corriger). */
function origineDe(etat, c, g) {
  const famille = familleParCle(c.famille)?.libelle.toLowerCase() ?? 'cette famille';
  if (g.origine === 'plat') {
    // Une copie reprise se corrige à sa source (la copie la suit) ; source disparue : on corrige la copie.
    if (c.grammage?.repris === true) return { lieu: origineRepris(etat, c) ?? { type: 'plat', composantId: c.id }, texte: /fiche retenue/.test(g.source) ? 'fiche retenue de ce nom' : 'référence de ce nom' };
    return { lieu: { type: 'plat', composantId: c.id }, texte: 'corrigé sur ce plat' };
  }
  if (g.origine === 'reference') {
    const cle = cleMemoireReelle(etat.memoire, c.nom, c.menu);
    return { lieu: cle ? { type: 'reference', cle, role: c.role } : null, texte: 'référence de ce nom' };
  }
  if (g.origine === 'standard') {
    const parFamille = g.source === 'standard maison';
    const cle = parFamille ? c.famille : cleStandardGroupe(familleParCle(c.famille)?.groupe ?? 'legumes');
    return { lieu: { type: 'standard', cleFamille: cle, role: c.role }, texte: parFamille ? `votre standard de ${famille}` : 'votre standard de la catégorie' };
  }
  return { lieu: null, texte: 'repère de base' };
}

/**
 * La quantité d'un composant en toutes lettres, à partir des vraies valeurs du calcul (source unique : l'interface n'écrit aucun chiffre).
 * @returns {{texte:string|null, etatPoids:string|null, origine:string|null, lieu:object|null, suspect:boolean,
 *   avertissement:string|null}} `texte` null : quantité inconnue. `lieu` : où corriger l'état du poids (null : repère de base).
 */
export function expliquerQuantite(etat, composantId) {
  const vide = { texte: null, etatPoids: null, origine: null, lieu: null, suspect: false, avertissement: null };
  const c = etat.composants?.[composantId];
  if (!c) return vide;
  const calc = calculerComposant(etat, composantId);
  const g = grammageEffectif(etat, c);
  const quantite = quantiteEnPoids(calc.quantiteTravail, calc.uniteTravail);
  if (!g || calc.statut !== 'CALCULE' || !quantite || calc.uniteTravail === 'portion') return vide;
  const preparation = c.type === 'preparation_maison';
  const { lieu, texte: origine } = origineDe(etat, c, g);
  const etatPoids = preparation ? ETAT_POIDS.cuit : g.etat;
  const n = calc.portions.total;
  const unite = libelle('UNITE', g.unite);
  const etapes = calc.etapes.filter((e) => e.appliquee)
    .map((e) => ` ÷ ${nombreFr(e.coefficient, 3)} (${ETAPE_EN_CLAIR[e.etape]?.(e.coefficient) ?? e.etape})`).join('');
  const texte = `${nombreFr(n)} ${n >= 2 ? 'portions' : 'portion'} × ${nombreFr(g.valeur)} ${unite} (poids ${libelle('ETAT_POIDS', etatPoids)}, ${origine})${etapes} = ${quantite}`;

  const lignes = lignesStandards(etat);
  const attendu = lieu && !preparation && etatPoids === ETAT_POIDS.cuit && c.famille ? etatRepereFamille(lignes, c.famille, g.unite) : null;
  const portion = lieu ? portionDuLieu(etat, lieu) : null;
  const suspect = attendu === ETAT_POIDS.sec && Boolean(portion) && !confirmee(etat, lieu, portion);
  let avertissement = null;
  const f = preparation ? null : fourchetteRepere(lignes, c.famille, c.role, g.unite);
  if (suspect) {
    const dessous = f && g.valeur < f.min ? ` ; ${nombreFr(g.valeur)} ${unite} est en dessous` : '';
    avertissement = `Attention : le repère de cette famille est en poids sec${f ? ` (${nombreFr(f.min)}–${nombreFr(f.max)} ${unite})` : ''}${dessous}. Vérifiez le poids de cette portion.`;
  } else if (f && (g.valeur < f.min || g.valeur > f.max)) {
    // Simple note, jamais une carte : quel que soit l'état du poids, une portion hors du repère validé se vérifie.
    avertissement = `Attention : ${nombreFr(g.valeur)} ${unite} est ${g.valeur < f.min ? 'en dessous du' : 'au-dessus du'} repère de cette famille (${nombreFr(f.min)}–${nombreFr(f.max)} ${unite}). Vérifiez la portion.`;
  }
  return { texte, etatPoids, origine, lieu: preparation ? null : lieu, suspect, avertissement };
}
