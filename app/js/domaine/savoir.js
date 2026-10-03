// Savoir culinaire de l'application : ce qu'elle sait d'un nom de plat sans qu'on le lui demande.
//  - FAMILLES : les produits de base connus, les mots du menu qui les désignent et les lignes de la base métier
//    qui s'y rapportent. AUCUN CHIFFRE dans ces tables : les coefficients viennent uniquement de BASE_METIER,
//    les portions uniquement des standards saisis par le chef ou de PORTIONS_BASE (repères facultatifs de la base).
//  - Un seul lexique : les mots des familles + MOTS_SANS_FAMILLE (mots qui ne donnent qu'une catégorie).
//  - lireNom / familleDe : lecture d'un nom ; appliquerSavoir : remplissage d'un composant ; grammageEffectif :
//    portion à utiliser pour calculer ; lignesStandards et lignesStandardsGroupes : données de l'écran Réglages.
// Rien n'est inventé : sans famille, sans standard et sans repère, il n'y a pas de portion.

import { BASE_METIER, PORTIONS_BASE } from '../donnees/base-metier.js';
import { REPERES_VALIDES } from '../donnees/savoir-metier.js';
import { normaliser } from './etat.js';
import { ETAT_POIDS, ROLE, UNITE, libelle } from './statuts.js';

/**
 * Repères par défaut : les repères validés par la propriétaire et déjà branchés (`appliquee !== false`), puis ceux de
 * la base (PORTIONS_BASE). Les validés passent d'abord : `find` prend la première ligne correspondante.
 */
export const reperesParDefaut = () => [...REPERES_VALIDES.filter((r) => r.appliquee !== false), ...PORTIONS_BASE];

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    Object.values(valeur).forEach(geler);
    Object.freeze(valeur);
  }
  return valeur;
}

// ---------------------------------------------------------------- groupes et familles

/** Grandes catégories : les repères de portion de la base peuvent être donnés par groupe ou par famille. */
export const GROUPES = geler([
  { cle: 'cereales', libelle: 'Pâtes, riz, céréales' },
  { cle: 'pommes_de_terre', libelle: 'Pommes de terre' },
  { cle: 'legumineuses', libelle: 'Légumineuses' },
  { cle: 'legumes', libelle: 'Légumes' },
]);

const famille = (cle, libelle, categorie, groupe, mots, etapes = []) => ({ cle, libelle, categorie, groupe, mots, etapes });
const parage = (produitBase) => [{ etape: 'parage', produitBase }];
const cuisson = (produitBase) => [{ etape: 'cuisson', produitBase }];

/**
 * Produits de base connus : { cle, libelle, categorie, groupe, mots, etapes:[{etape, produitBase}] }.
 * `mots` : mots ou expressions du menu qui désignent le produit (singulier, sans accent ; le pluriel est toléré).
 * `produitBase` : libellé exact d'une ligne de BASE_METIER pour l'étape. N'est associée qu'une étape qui
 * s'applique sans condition : une perte conditionnelle (tomates pelées à vif et épépinées, par exemple) n'y figure pas.
 * Une famille sans étape (céréales sans ligne de cuisson dans la base) est reconnue mais ne reçoit aucune étape.
 */
export const FAMILLES = geler([
  // Pâtes, riz, céréales : gain de cuisson à l'eau quand la base le donne.
  famille('pates_seches', 'pâtes sèches', 'feculent', 'cereales',
    ['pates', 'spaghetti', 'tagliatelle', 'penne', 'nouille', 'trofie', 'mafalda', 'fusilli', 'cortecce', 'rigatoni',
      'linguine', 'farfalle', 'orecchiette', 'macaroni'], cuisson('Pâtes')),
  famille('riz', 'riz', 'feculent', 'cereales', ['riz', 'risotto'], cuisson('Riz')),
  famille('polenta', 'polenta', 'feculent', 'cereales', ['polenta'], cuisson('Polenta')),
  famille('quinoa', 'quinoa', 'feculent', 'cereales', ['quinoa'], cuisson('Quinoa')),
  famille('semoule', 'semoule, couscous', 'feculent', 'cereales', ['semoule', 'couscous'], cuisson('Semoule, couscous')),
  famille('ble', 'blé', 'feculent', 'cereales', ['ble']),
  famille('orge', 'orge', 'feculent', 'cereales', ['orge']),
  famille('epeautre', 'épeautre', 'feculent', 'cereales', ['epeautre']),
  famille('boulgour', 'boulgour', 'feculent', 'cereales', ['boulgour']),
  // Légumineuses.
  famille('legumineuses', 'légumineuses sèches', 'feculent', 'legumineuses',
    ['lentille', 'pois chiche', 'haricot blanc', 'haricot rouge'],
    cuisson('Légumineuses sèches (lentilles, pois chiches, haricots)')),
  // Pommes de terre : perte de parage seulement (la perte de cuisson dépend de la méthode).
  famille('pommes_de_terre', 'pommes de terre', 'feculent', 'pommes_de_terre',
    ['pomme de terre', 'pomme mousseline', 'pomme au beurre', 'pomme vapeur', 'pomme nature', 'pomme puree',
      'pomme rissolee', 'pomme sautee', 'pomme duchesse', 'pomme fondante', 'pomme noisette', 'pomme allumette',
      'pomme frite', 'pomme boulangere', 'pomme grenaille', 'pomme nouvelle', 'pomme rosti'], parage('Pommes de terre')),
  // Légumes : perte de parage.
  famille('carottes', 'carottes', 'legume', 'legumes', ['carotte'], parage('Carottes')),
  famille('panais', 'panais', 'legume', 'legumes', ['panais'], parage('Panais')),
  famille('navets', 'navets', 'legume', 'legumes', ['navet'], parage('Navets')),
  famille('endives', 'endives', 'legume', 'legumes', ['endive'], parage('Endives')),
  famille('blettes', 'blettes', 'legume', 'legumes', ['blette', 'bette', 'cote de bette', 'cote de blette'],
    parage('Blettes (côtes + feuilles)')),
  famille('poireaux', 'poireaux', 'legume', 'legumes', ['poireau'], parage('Poireaux')),
  famille('fenouil', 'fenouil', 'legume', 'legumes', ['fenouil'], parage('Fenouil')),
  famille('courgettes', 'courgettes', 'legume', 'legumes', ['courgette'], parage('Courgettes')),
  famille('aubergines', 'aubergines', 'legume', 'legumes', ['aubergine'], parage('Aubergines')),
  // Choux : une famille par chou nommé, car la perte diffère. « chou » seul reste sans famille.
  famille('brocoli', 'brocoli', 'legume', 'legumes', ['brocoli'], parage('Brocoli')),
  famille('chou_fleur', 'chou-fleur', 'legume', 'legumes', ['chou fleur'], parage('Chou-fleur')),
  famille('chou_blanc_rouge', 'chou blanc ou rouge', 'legume', 'legumes', ['chou blanc', 'chou rouge'],
    parage('Chou blanc / rouge')),
  famille('choux_de_bruxelles', 'choux de Bruxelles', 'legume', 'legumes', ['chou de bruxelles'],
    parage('Chou de Bruxelles')),
]);

/**
 * Mots du lexique qui donnent une catégorie sans désigner un produit de base connu (pas de famille : le plat reste
 * « générique », sans grammage inventé). Entrées au singulier, sans accent ; le pluriel est toléré à la comparaison.
 * « pate » reste ici : « pâté » et « pâte » ne sont pas des pâtes alimentaires ; seul « pâtes » désigne la famille.
 */
export const MOTS_SANS_FAMILLE = geler({
  feculent: ['pate', 'puree', 'frite', 'gnocchi', 'croquette', 'dauphine', 'rosti', 'patate douce', 'ravioli',
    'lasagne', 'tortellini', 'cannelloni', 'spatzli', 'knopfli', 'gratin dauphinois'],
  legume: ['poivron', 'tomate', 'haricot vert', 'epinard', 'chou', 'petit pois', 'asperge', 'legume', 'ratatouille',
    'betterave', 'celeri', 'courge', 'potiron', 'butternut', 'oignon', 'echalote', 'champignon', 'salade', 'artichaut',
    'radis', 'concombre', 'mais', 'jardiniere', 'macedoine', 'chicoree', 'cardon', 'salsifi', 'topinambour', 'colrave',
    'bolet', 'olive'],
  proteine: ['poulet', 'volaille', 'boeuf', 'veau', 'porc', 'agneau', 'canard', 'dinde', 'lapin', 'pintade', 'poisson',
    'saumon', 'cabillaud', 'colin', 'thon', 'lotte', 'merlu', 'truite', 'dorade', 'sole', 'crevette', 'gambas',
    'langoustine', 'moule', 'calamar', 'seiche', 'oeuf', 'jambon', 'saucisse', 'steak', 'escalope', 'magret', 'filet',
    'cuisse', 'gigot', 'roti', 'tofu', 'lieu', 'merlan', 'lard', 'boudin', 'entrecote', 'bavette', 'cote', 'cotelette',
    'carre', 'cerf', 'chevreuil', 'sanglier', 'lievre', 'atriau', 'fletan', 'perche', 'fera', 'omble', 'sandre',
    'brochet'],
  sauce: ['sauce', 'jus', 'veloute', 'coulis', 'vinaigrette', 'mayonnaise', 'bearnaise', 'hollandaise', 'beurre blanc',
    'emulsion', 'fumet', 'bisque', 'reduction', 'pesto', 'fond'],
});

/** Rôles pour lesquels un standard maison a un sens (une ligne par famille et par rôle à l'écran Réglages). */
export const ROLES_STANDARD = Object.freeze([ROLE.plat_principal, ROLE.garniture]);

const FAMILLES_PAR_CLE = new Map(FAMILLES.map((f) => [f.cle, f]));
const GROUPES_PAR_CLE = new Map(GROUPES.map((g) => [g.cle, g]));

/** Clé sous laquelle le standard maison d'une grande catégorie est rangé dans état.standards. */
export const cleStandardGroupe = (cleGroupe) => `groupe:${cleGroupe}`;

/** Clé du groupe d'une clé de standard de catégorie, ou null si ce n'en est pas une ou si le groupe est inconnu. */
export function groupeDeCleStandard(cle) {
  if (typeof cle !== 'string' || !cle.startsWith('groupe:')) return null;
  const g = cle.slice('groupe:'.length);
  return GROUPES_PAR_CLE.has(g) ? g : null;
}

/** Famille de clé donnée, ou null. */
export function familleParCle(cle) {
  return FAMILLES_PAR_CLE.get(cle) ?? null;
}

// ---------------------------------------------------------------- lecture d'un nom

// Mots de forme : ils disent comment c'est préparé, pas ce que c'est. Le produit nommé ensuite décide.
const FORMES = new Set(['puree', 'gratin', 'tagliatelle', 'spaghetti', 'nouille', 'croquette', 'mousseline',
  'ecrase', 'poelee', 'fricassee', 'mousse', 'flan', 'galette', 'tian']);
const MOTIF_FORME = new RegExp(`^(?:${[...FORMES].join('|')})(?:s|x)? (?:de |d )`);

const lexiqueCompile = [
  ...FAMILLES.flatMap((f) => f.mots.map((mot) => ({ mot, categorie: f.categorie, famille: f }))),
  ...Object.entries(MOTS_SANS_FAMILLE).flatMap(([categorie, mots]) => mots.map((mot) => ({ mot, categorie, famille: null }))),
].map((entree) => ({
  ...entree,
  motif: new RegExp('(?:^| )(' + entree.mot.split(' ').map((m) => `${m}(?:s|x)?`).join(' ') + ')(?= |$)', 'g'),
}));

/** Toutes les occurrences du lexique dans un texte normalisé : { categorie, famille, debut, longueur }. */
function occurrences(texte) {
  const trouvees = [];
  for (const { categorie, famille: f, motif } of lexiqueCompile) {
    motif.lastIndex = 0;
    for (let m = motif.exec(texte); m; m = motif.exec(texte)) {
      trouvees.push({ categorie, famille: f, debut: m.index + (m[0].length - m[1].length), longueur: m[1].length });
      motif.lastIndex = m.index + 1;
    }
  }
  // Le premier mot reconnu décide ; à position égale, l'expression la plus longue l'emporte ; à égalité parfaite,
  // le mot qui désigne une famille (« pâtes ») passe avant le mot général (« pâte »).
  return trouvees.sort((a, b) => a.debut - b.debut || b.longueur - a.longueur
    || Number(b.famille !== null) - Number(a.famille !== null));
}

/**
 * Lit un nom de plat : { categorie, famille } (`a_preciser` et null si rien n'est reconnu).
 * Règle : le premier mot reconnu décide (« <protéine> sauce … » reste une protéine). Exception : un mot de
 * forme suivi de « de » (« purée de … », « tagliatelle de … ») laisse décider le produit nommé ensuite.
 * La famille est celle du mot qui décide ; elle est null si ce mot ne désigne pas un produit de base connu.
 */
export function lireNom(nom) {
  const texte = normaliser(nom).replace(/[^a-z0-9]+/g, ' ').trim();
  const trouvees = occurrences(texte);
  if (trouvees.length === 0) return { categorie: 'a_preciser', famille: null };
  const tete = trouvees[0];
  let decisive = tete;
  if (MOTIF_FORME.test(texte)) {
    const suite = trouvees.find((t) => t.debut >= tete.debut + tete.longueur && t.categorie !== 'sauce');
    if (suite) decisive = suite;
  }
  return { categorie: decisive.categorie, famille: decisive.famille };
}

/** Famille d'un nom de plat (même règle de lecture que la catégorie), ou null. */
export function familleDe(nom) {
  return lireNom(nom).famille;
}

// ---------------------------------------------------------------- application à un composant

/** Étapes de la base pour une famille : coefficient = milieu de la fourchette ; une ligne introuvable est ignorée. */
function etapesDeBase(f) {
  const etapes = [];
  for (const { etape, produitBase } of f.etapes) {
    const ligne = BASE_METIER.find((l) => l.etape === etape && l.produit === produitBase);
    if (!ligne) continue;
    etapes.push({
      etape, coefficient: (ligne.coefMin + ligne.coefMax) / 2, statut: 'BASE_METIER_ESTIMATION',
      source: `base métier : ${ligne.texte}`,
    });
  }
  return etapes;
}

/**
 * Remplit un composant avec ce que l'application sait de son nom, SEULEMENT pour les champs vides :
 * famille, produitNom, role, type, etapes. Le grammage n'est jamais copié : il se résout au calcul (grammageEffectif).
 * La famille n'est retenue que si elle est compatible avec la catégorie du composant (une catégorie corrigée
 * par le chef l'emporte). Modifie et renvoie le composant.
 * @param {object} etat
 * @param {object} composant
 */
export function appliquerSavoir(etat, composant) {
  const c = composant;
  const lue = familleDe(c.nom);
  const compatible = lue && (c.categorie === 'a_preciser' || c.categorie === lue.categorie) ? lue : null;
  const f = c.famille ? familleParCle(c.famille) : compatible;
  if (!c.famille) c.famille = f?.cle ?? null;
  if (!c.produitNom && f) c.produitNom = f.libelle;
  if (c.role === null || c.role === undefined) {
    c.role = c.menu === 1 ? ROLE.plat_principal : c.categorie === 'sauce' ? ROLE.sauce : ROLE.garniture;
  }
  if (c.type === 'a_preciser') {
    if (f) c.type = 'produit_simple';
    else if (c.categorie !== 'a_preciser') c.type = 'generique';
  }
  if (f && (c.etapes ?? []).length === 0) c.etapes = etapesDeBase(f);
  return c;
}

// ---------------------------------------------------------------- portion effective

const positif = (v) => Number.isFinite(v) && v > 0;
const propre = (objet, cle) => (objet && typeof objet === 'object' && Object.hasOwn(objet, cle) ? objet[cle] : undefined);
/** Une portion sans état connu se lit « cuit » : c'était le sens d'une quantité servie. */
const etatConnu = (e) => (typeof e === 'string' && Object.hasOwn(ETAT_POIDS, e) ? e : ETAT_POIDS.cuit);
const uniteConnue = (u) => typeof u === 'string' && Object.hasOwn(UNITE, u);

/** Standard maison valide de la famille et du rôle, ou null. */
function standardDe(etat, cleFamille, role) {
  const s = propre(propre(etat?.standards, cleFamille), role);
  return s && positif(s.valeur) && uniteConnue(s.unite) ? s : null;
}

/**
 * Ligne de repère de portion (PORTIONS_BASE) pour une famille et un rôle : d'abord une ligne dont le produit
 * égale le libellé de la famille, à défaut une ligne dont le produit égale le libellé du groupe de la famille.
 * La comparaison se fait sur les libellés normalisés ; la première ligne correspondante, dans l'ordre de la table, est prise.
 */
const texteSources = (s) => (Array.isArray(s) ? s.map((x) => x?.titre).filter(Boolean).join(' ; ') : (s ?? ''));

function repereDe(f, role, reperes) {
  const valide = (r) => positif(r?.min) && Number.isFinite(r.max) && r.max >= r.min && uniteConnue(r.unite)
    && typeof r.etat === 'string' && Object.hasOwn(ETAT_POIDS, r.etat);
  const chercher = (libelle) => (reperes ?? []).find((r) => r.role === role && valide(r)
    && normaliser(r.produit) === normaliser(libelle));
  const detail = (ligne, portee, groupe) => ({
    valeur: (ligne.min + ligne.max) / 2, unite: ligne.unite, etat: ligne.etat, min: ligne.min, max: ligne.max,
    texte: ligne.texte ?? '', sources: texteSources(ligne.sources), valide: ligne.validation === 'valide_chef', note: ligne.note ?? '', produit: ligne.produit, portee, groupe,
  });
  const parFamille = f.libelle ? chercher(f.libelle) : null;
  if (parFamille) return detail(parFamille, 'famille', f.groupe);
  const groupe = GROUPES_PAR_CLE.get(f.groupe);
  const parGroupe = groupe ? chercher(groupe.libelle) : null;
  return parGroupe ? detail(parGroupe, 'groupe', f.groupe) : null;
}

/**
 * Portion à utiliser pour calculer un composant, ou null (alors point « grammage », aucune quantité inventée).
 * Ordre de priorité :
 *  1. la correction faite sur le plat lui-même (composant.grammage.valeur renseignée) : origine « plat » ;
 *  2. la référence mémorisée pour ce nom et ce rôle (geste « mémoriser comme référence maison ») : « reference » ;
 *  3. le standard maison de la famille et du rôle (état.standards) : « standard » ;
 *  4. le standard maison de la grande catégorie et du rôle (état.standards, clé « groupe:… ») : « standard ».
 *     Un légume sans famille connue en dépend aussi (catégorie « Légumes ») ;
 *  5. le repère de portion, milieu de la fourchette, par famille puis par groupe : validé par la propriétaire
 *     (origine « repere_valide ») ou de la base (PORTIONS_BASE, origine « base »). Statut : toujours estimation.
 * Une préparation maison se compte en quantité finie : son état est toujours « cuit », et un standard ou un repère
 * exprimé en poids sec ou cru net ne lui est pas appliqué.
 * @param {object} etat
 * @param {object} composant
 * @param {object[]} [reperes] repères de portion (PORTIONS_BASE par défaut ; paramètre prévu pour les tests)
 * @returns {{valeur:number, unite:string, etat:string, statut:string, source:string, origine:string}|null}
 */
export function grammageEffectif(etat, composant, reperes = reperesParDefaut()) {
  const c = composant;
  if (!c) return null;
  const preparation = c.type === 'preparation_maison';
  const etatDe = (e) => (preparation ? ETAT_POIDS.cuit : etatConnu(e));

  const g = c.grammage;
  if (positif(g?.valeur)) {
    return { valeur: g.valeur, unite: g.unite ?? 'g', etat: etatDe(g.etat), statut: g.statut ?? 'INCONNU',
      source: String(g.source ?? ''), origine: 'plat' };
  }

  if (c.role) {
    const ref = propre(propre(etat?.memoire, normaliser(c.nom))?.parRole, c.role)?.grammage;
    if (positif(ref?.valeur)) {
      return { valeur: ref.valeur, unite: ref.unite ?? 'g', etat: etatDe(ref.etat), statut: ref.statut ?? 'INCONNU',
        source: String(ref.source ?? ''), origine: 'reference' };
    }
  }

  const f = c.famille ? familleParCle(c.famille) : null;
  // Sans famille, seul un légume a une catégorie de portion (les autres produits sans famille n'en ont pas).
  const cleGroupe = f ? f.groupe : (c.categorie === 'legume' ? 'legumes' : null);
  if (cleGroupe && c.role) {
    const s = f ? standardDe(etat, f.cle, c.role) : null;
    if (s && (!preparation || etatConnu(s.etat) === ETAT_POIDS.cuit)) {
      return { valeur: s.valeur, unite: s.unite, etat: etatConnu(s.etat), statut: 'RESTAURANT_VALIDE',
        source: 'standard maison', origine: 'standard' };
    }
    const sg = standardDe(etat, cleStandardGroupe(cleGroupe), c.role);
    if (sg && (!preparation || etatConnu(sg.etat) === ETAT_POIDS.cuit)) {
      return { valeur: sg.valeur, unite: sg.unite, etat: etatConnu(sg.etat), statut: 'RESTAURANT_VALIDE',
        source: `standard maison de la catégorie « ${GROUPES_PAR_CLE.get(cleGroupe).libelle} »`, origine: 'standard' };
    }
    const r = repereDe(f ?? { libelle: '', groupe: cleGroupe }, c.role, reperes);
    if (r && (!preparation || r.etat === ETAT_POIDS.cuit)) {
      const groupe = r.portee === 'groupe' ? ` (repère du groupe « ${GROUPES_PAR_CLE.get(r.groupe).libelle} »)` : '';
      if (r.valide) {
        const unite = r.unite === 'g' ? ' g' : ` ${libelle('UNITE', r.unite)}`;
        const etatTexte = libelle('ETAT_POIDS', r.etat);
        return { valeur: r.valeur, unite: r.unite, etat: r.etat, statut: 'BASE_METIER_ESTIMATION',
          source: `repère validé par la propriétaire (fourchette ${r.min}–${r.max}${unite}, état ${etatTexte})${groupe}`,
          origine: 'repere_valide' };
      }
      return { valeur: r.valeur, unite: r.unite, etat: r.etat, statut: 'BASE_METIER_ESTIMATION',
        source: `base métier : ${r.texte}${groupe}`, origine: 'base' };
    }
  }
  return null;
}

// ---------------------------------------------------------------- standards maison (écran Réglages)

/**
 * Une ligne par famille et par rôle utile (plat_principal, garniture), pour l'écran Réglages.
 * `groupe` : clé du groupe de la famille (GROUPES), pour regrouper les lignes. `standard` : le standard maison
 * enregistré ou null. `repereBase` : repère de la base pour cette famille (ligne de la famille, à défaut ligne
 * de son groupe) ou null ; `portee` dit laquelle des deux a servi.
 * @returns {{cleFamille:string, libelle:string, categorie:string, groupe:string, role:string,
 *   standard:{valeur:number, unite:string, etat:string, h:string|null}|null,
 *   repereBase:{valeur:number, unite:string, etat:string, min:number, max:number, texte:string, sources:string,
 *   note:string, produit:string, portee:'famille'|'groupe', groupe:string}|null}[]}
 */
export function lignesStandards(etat, reperes = reperesParDefaut()) {
  return FAMILLES.flatMap((f) => ROLES_STANDARD.map((role) => {
    const s = standardDe(etat, f.cle, role);
    return {
      cleFamille: f.cle, libelle: f.libelle, categorie: f.categorie, groupe: f.groupe, role,
      standard: s ? { valeur: s.valeur, unite: s.unite, etat: etatConnu(s.etat), h: s.h ?? null } : null,
      repereBase: repereDe(f, role, reperes),
    };
  }));
}

/**
 * Une ligne par grande catégorie et par rôle utile, pour l'écran Réglages. Même forme que lignesStandards :
 * `cleFamille` porte la clé « groupe:… » (celle de definirStandard), `libelle` nomme toute la catégorie.
 */
export function lignesStandardsGroupes(etat, reperes = reperesParDefaut()) {
  return GROUPES.flatMap((g) => ROLES_STANDARD.map((role) => {
    const cle = cleStandardGroupe(g.cle);
    const s = standardDe(etat, cle, role);
    return {
      cleFamille: cle, libelle: `${g.libelle} (toute la catégorie)`, categorie: null, groupe: g.cle, role,
      standard: s ? { valeur: s.valeur, unite: s.unite, etat: etatConnu(s.etat), h: s.h ?? null } : null,
      repereBase: repereDe({ libelle: '', groupe: g.cle }, role, reperes),
    };
  }));
}
