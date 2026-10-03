// Analyse d'un intitulé de menu : lecture du plat (lirePlat) et composants proposés (proposerComposants).
// Le lexique (savoir.js) et le vocabulaire générique (vocabulaire-plats.js) servent uniquement à classer des mots :
// ils ne portent aucun chiffre. Rien n'est inventé : un mot inconnu reste « à préciser », une sauce implicite reste « à confirmer ».

import { normaliser } from './etat.js';
import { FAMILLES, MOTS_SANS_FAMILLE, lireNom } from './savoir.js';
import {
  ALIAS, CHAMPIGNONS, EPICES, FORMES_PATES, HERBES, MOTS_DE_LIAISON, PRODUITS, SAUCES,
} from './vocabulaire-plats.js';

// ---------------------------------------------------------------- mémoire d'attribution

/** Clé de la mémoire d'attribution : nom normalisé et numéro de menu (« poulet|1 »). */
export const cleMemoire = (nom, menu) => `${normaliser(nom)}|${menu}`;

/** Entrée de mémoire d'un nom pour un menu : la clé « nom|menu » d'abord, à défaut l'ancienne clé « nom ». */
export function lireMemoire(memoire, nom, menu) {
  if (!memoire || typeof memoire !== 'object') return null;
  for (const cle of [cleMemoire(nom, menu), normaliser(nom)]) {
    if (cle !== '' && cle !== `|${menu}` && Object.hasOwn(memoire, cle)) return memoire[cle];
  }
  return null;
}

// ---------------------------------------------------------------- jetons

const sansApostrophe = (s) => s.replace(/['’]/g, '');
const net = (mot) => sansApostrophe(normaliser(mot)).replace(/[^a-z0-9&-]/g, '').replace(/^-+|-+$/g, '');
const SEP = Object.freeze({ sep: true });

/** Un jeton : { raw (texte original), n (mot normalisé), glue (pas d'espace après : « l' ») }. */
function jeton(raw, n, glue = false) { return { raw, n, glue }; }

/** Coupures fortes écrites en toutes lettres : « accompagné de », « servi avec », « sur lit de ». */
function coupuresFortes(jetons) {
  const sortie = [];
  const e = (i) => jetons[i]?.n;
  for (let i = 0; i < jetons.length; i += 1) {
    const t = jetons[i];
    if (t.sep) { sortie.push(t); continue; }
    if (/^accompagn(?:e|ee|es|ees|ement|ements)$/.test(t.n) && (e(i + 1) === 'de' || e(i + 1) === 'd')) { sortie.push(SEP); i += 1; continue; }
    if (/^servi(?:e|es|s)?$/.test(t.n) && e(i + 1) === 'avec') { sortie.push(SEP); i += 1; continue; }
    if (t.n === 'sur') {
      const k = e(i + 1) === 'un' || e(i + 1) === 'une' ? 2 : 1;
      if (e(i + k) === 'lit' && (e(i + k + 1) === 'de' || e(i + k + 1) === 'd')) { sortie.push(SEP); i += k + 1; continue; }
    }
    sortie.push(t);
  }
  return sortie;
}

/** Texte → jetons ; virgule, point-virgule, deux-points et tiret long donnent un séparateur. */
function tokeniser(texte) {
  const brut = String(texte ?? '').replace(/\s[-—–]\s|[—–]/g, ' , ').replace(/[,;:]/g, ' , ');
  const jetons = [];
  for (const mot of brut.split(/\s+/).filter(Boolean)) {
    if (mot === ',') { jetons.push(SEP); continue; }
    const m = /^(d|l|all|dell|nell|dall|sull)['’](.+)$/i.exec(mot);
    if (m) {
      jetons.push(jeton(`${m[1]}'`, normaliser(m[1]), true));
      const n = net(m[2]);
      if (n !== '') jetons.push(jeton(m[2], n));
      continue;
    }
    const n = net(mot);
    if (n !== '') jetons.push(jeton(mot, n));
  }
  return coupuresFortes(jetons);
}

function nomDe(jetons) {
  let texte = '';
  let collant = true;
  for (const t of jetons) {
    if (t.raw === '') continue;
    texte += (collant ? '' : ' ') + t.raw;
    collant = t.glue === true;
  }
  return texte.trim();
}
const canonDe = (jetons) => jetons.map((t) => t.n).join(' ');

const motEgal = (n, w) => n === w || n === `${w}s` || n === `${w}x` || `${n}s` === w;

// ---------------------------------------------------------------- alias

const ALIAS_JETONS = [...ALIAS].map(([de, vers]) => ({ de: normaliser(de).split(' '), vers: normaliser(vers).split(' ') }))
  .sort((a, b) => b.de.length - a.de.length);

/** Remplace les variantes de nom par le nom retenu, en gardant dans `raw` le texte original. */
function remplacerAlias(jetons) {
  const sortie = [];
  for (let i = 0; i < jetons.length; i += 1) {
    const a = jetons[i].sep ? null : ALIAS_JETONS.find((x) => x.de.every((w, k) => jetons[i + k] && !jetons[i + k].sep && motEgal(jetons[i + k].n, w)));
    if (!a) { sortie.push(jetons[i]); continue; }
    const origine = jetons.slice(i, i + a.de.length);
    a.vers.forEach((w, k) => sortie.push(jeton(k === 0 ? nomDe(origine) : '', w, k === 0 && origine.at(-1).glue)));
    i += a.de.length - 1;
  }
  return sortie;
}

// ---------------------------------------------------------------- expressions reconnues

const mots = (texte) => sansApostrophe(normaliser(texte)).split(' ');

/** Toutes les expressions connues : lexique de savoir.js + vocabulaire de vocabulaire-plats.js, la plus longue d'abord. */
const EXPRESSIONS = (() => {
  const liste = [];
  const ajouter = (texte, categorie, extra = {}) => liste.push({ mots: mots(texte), categorie, kind: categorie === 'sauce' ? 'sauce' : null, ...extra });
  for (const f of FAMILLES) {
    for (const mot of f.mots) {
      ajouter(mot, f.categorie, { lexique: true, kind: f.cle === 'pates_seches' ? 'pate' : f.cle === 'riz' ? (mot === 'risotto' ? 'risotto' : 'riz') : null });
    }
  }
  for (const [categorie, lot] of Object.entries(MOTS_SANS_FAMILLE)) {
    for (const mot of lot) ajouter(mot, categorie, { lexique: true, kind: categorie === 'sauce' ? 'sauce' : ['pate', 'ravioli', 'lasagne', 'tortellini', 'cannelloni', 'gnocchi', 'spatzli'].includes(mot) ? 'pate' : null });
  }
  FORMES_PATES.forEach((mot) => ajouter(mot, 'feculent', { kind: 'pate' }));
  [...HERBES, ...EPICES].forEach((mot) => ajouter(mot, 'autre', { kind: 'herbe' }));
  CHAMPIGNONS.forEach((mot) => ajouter(mot, 'legume', { kind: 'champignon' }));
  for (const [categorie, lot] of Object.entries(PRODUITS)) {
    lot.forEach((mot) => ajouter(mot, categorie === 'fromage' ? 'autre' : categorie, { kind: categorie === 'fromage' ? 'fromage' : null }));
  }
  for (const s of SAUCES) s.alias.forEach((mot) => ajouter(mot, 'sauce', { kind: 'sauce', sauce: s }));
  return liste.sort((a, b) => b.mots.length - a.mots.length);
})();

/** Expressions trouvées dans des jetons (la plus longue d'abord, de gauche à droite, sans chevauchement). */
function expressionsDe(jetons) {
  const trouvees = [];
  for (let i = 0; i < jetons.length;) {
    const e = jetons[i].sep ? null : EXPRESSIONS.find((x) => x.mots.every((w, k) => jetons[i + k] && !jetons[i + k].sep && motEgal(jetons[i + k].n, w)));
    if (e) { trouvees.push({ debut: i, fin: i + e.mots.length, e }); i += e.mots.length; } else i += 1;
  }
  return trouvees;
}
const aExpression = (jetons) => expressionsDe(jetons).length > 0;

/**
 * Expression qui décide de la catégorie : la première. Pour un mot du lexique, la règle de savoir.js (lireNom) fait foi,
 * y compris l'exception d'une forme suivie de « de » (« tagliatelle de courgette » : le produit nommé ensuite décide).
 */
function decisive(jetons) {
  const trouvees = expressionsDe(jetons);
  if (trouvees.length === 0) return null;
  const tete = trouvees[0];
  if (!tete.e.lexique) return tete.e;
  const lue = lireNom(canonDe(jetons)).categorie;
  if (lue === tete.e.categorie) return tete.e;
  return trouvees.find((t) => t.debut >= tete.fin && t.e.categorie === lue)?.e ?? tete.e;
}
const categorieDe = (jetons) => decisive(jetons)?.categorie ?? 'a_preciser';

// ---------------------------------------------------------------- expressions figées et connecteurs

/** Expressions figées : jamais coupées. Retourne des intervalles { debut, fin, recette }. */
function figees(jetons) {
  const r = [];
  const n = (i) => jetons[i]?.n ?? '';
  for (let i = 0; i < jetons.length; i += 1) {
    if (jetons[i].sep) continue;
    if (n(i) === 'facon') r.push({ debut: i, fin: jetons.length });
    else if (n(i) === 'a' && n(i + 1) === 'la' && /(?:aise|aises|ienne|iennes)$/.test(n(i + 2))) r.push({ debut: i, fin: i + 3, recette: true });
    else if (n(i) === 'au' && n(i + 1) === 'parfum' && n(i + 2) === 'de') r.push({ debut: i, fin: jetons.length });
    else if (n(i) === 'saveur' || n(i) === 'essence') r.push({ debut: i, fin: jetons.length });
    else if (n(i) === 'huile' && (n(i + 1) === 'de' || n(i + 1) === 'd')) r.push({ debut: i, fin: i + 3 });
    else if (n(i) === 'en' && (n(i + 1) === 'croute' || n(i + 1) === 'papillote')) r.push({ debut: i, fin: i + 2 });
    else if (n(i) === 'dans' && n(i + 1) === 'son' && n(i + 2) === 'jus') r.push({ debut: i, fin: i + 3 });
    else if (n(i) === 'au' && n(i + 1) === 'four') r.push({ debut: i, fin: i + 2 });
  }
  return r;
}
const bloque = (zones, i) => zones.some((z) => i >= z.debut && i < z.fin);

const CONNECTEURS = [['a', 'la'], ['a', 'l'], ['au'], ['aux'], ['avec'], ['alla'], ['alle'], ['al'], ['ai'], ['agli'], ['all']];
function longueurConnecteur(jetons, i) {
  const c = CONNECTEURS.find((seq) => seq.every((w, k) => jetons[i + k]?.n === w));
  return c ? c.length : 0;
}

/** Retire les mots de liaison au bord d'un élément (« et à l'aneth » devient « aneth »). */
function rogner(jetons) {
  let d = 0;
  let f = jetons.length;
  while (d < f - 1 && MOTS_DE_LIAISON.includes(jetons[d].n)) d += 1;
  while (f - 1 > d && MOTS_DE_LIAISON.includes(jetons[f - 1].n)) f -= 1;
  const reste = jetons.slice(d, f);
  return reste.length === 1 && MOTS_DE_LIAISON.includes(reste[0].n) ? [] : reste;
}

/** Coupe sur « et », « & », « e » quand les deux côtés contiennent une expression reconnue. */
function couperListe(jetons) {
  const zones = figees(jetons);
  const morceaux = [];
  let debut = 0;
  for (let i = 1; i < jetons.length - 1; i += 1) {
    if (!['et', '&', 'e'].includes(jetons[i].n) || bloque(zones, i)) continue;
    const gauche = jetons.slice(debut, i);
    const droite = jetons.slice(i + 1);
    if (!aExpression(gauche) || !aExpression(droite)) continue;
    morceaux.push(gauche);
    debut = i + 1;
  }
  morceaux.push(jetons.slice(debut));
  return morceaux.map(rogner).filter((m) => m.length > 0);
}

// ---------------------------------------------------------------- découpe d'un segment

// Mots devant lesquels on ne coupe jamais une protéine suivie d'une garniture écrite sans virgule.
const LIAISONS_PROTEINE = new Set(['de', 'du', 'des', 'd', 'au', 'aux', 'a', 'la', 'le', 'les', 'l', 'en', 'sur', 'sous', 'avec', 'et',
  'sauce', 'jus', 'facon']);

/** « Escalope pommes frites » : une protéine suivie d'un produit connu se coupe ; en cas de doute, le nom reste entier. */
function couperProteine(jetons) {
  if (jetons.length < 2 || categorieDe(jetons) !== 'proteine') return [jetons];
  for (let i = 1; i < jetons.length; i += 1) {
    if (LIAISONS_PROTEINE.has(jetons[i - 1].n) || LIAISONS_PROTEINE.has(jetons[i].n)) continue;
    const gauche = jetons.slice(0, i);
    const droite = jetons.slice(i);
    if (lireNom(canonDe(gauche)).categorie === 'proteine' && lireNom(canonDe(droite)).famille !== null) return [gauche, droite];
  }
  return [jetons];
}

const kindDe = (jetons) => decisive(jetons)?.kind ?? null;
const estBase = (jetons) => ['pate', 'risotto'].includes(kindDe(jetons));
const sansLiaisonDebut = (jetons) => {
  let d = 0;
  while (d < jetons.length - 1 && ['au', 'aux', 'a', 'la', 'le', 'les', 'l', 'de', 'du', 'des', 'd'].includes(jetons[d].n)) d += 1;
  return jetons.slice(d);
};

/** Fragment : { jetons, alternatives?, queueSauce? }. */
function decouper(jetonsBruts, menu) {
  const jetons = rogner(jetonsBruts);
  if (jetons.length === 0) return [];
  const zones = figees(jetons);

  // « X ou Y » : des alternatives, un choix à demander.
  const ou = jetons.map((t, i) => (t.n === 'ou' && !bloque(zones, i) ? i : -1)).filter((i) => i > 0 && i < jetons.length - 1);
  if (ou.length > 0) {
    const bornes = [-1, ...ou, jetons.length];
    const parts = bornes.slice(0, -1).map((b, k) => rogner(jetons.slice(b + 1, bornes[k + 1])));
    if (parts.every((p) => p.length > 0 && aExpression(p))) return [{ jetons, alternatives: parts.map(nomDe) }];
  }

  // Queue « sauce Z » : sauce connue, ou sauce quelconque d'un plat de pâtes ou de risotto.
  const iS = jetons.findIndex((t, i) => i > 0 && t.n === 'sauce' && !bloque(zones, i));
  if (iS > 0 && iS < jetons.length - 1) {
    const z = sansLiaisonDebut(jetons.slice(iS + 1));
    const premiere = expressionsDe(z)[0];
    const connue = premiere && premiere.debut === 0 && premiere.e.kind === 'sauce' ? premiere.e : null;
    if (connue || estBase(jetons.slice(0, iS))) {
      const recette = (connue?.sauce?.recette ?? false) || expressionsDe(z).length === 0;
      return [...decouper(jetons.slice(0, iS), menu), { jetons: rogner(jetons.slice(iS)), queueSauce: { recette } }];
    }
  }

  // « X aux/au/à la/avec/alla/ai Y » : coupe seulement si X ET Y contiennent une expression reconnue.
  for (let i = 1; i < jetons.length - 1; i += 1) {
    if (bloque(zones, i)) continue;
    const k = longueurConnecteur(jetons, i);
    if (k === 0) continue;
    const x = jetons.slice(0, i);
    const y = jetons.slice(i + k);
    if (!aExpression(x) || !aExpression(y)) continue;
    const morceaux = couperListe(y);
    // « poulet au riz » : une protéine suivie d'un seul ingrédient est un plat nommé, il reste entier.
    if (categorieDe(x) === 'proteine' && morceaux.length === 1) return [{ jetons }];
    return [...decouper(x, menu), ...morceaux.flatMap((m) => juxtaposes(m, menu))];
  }

  // « X et Y » sans connecteur : coupé seulement au menu 2 quand un côté est au poste et l'autre non (« poulet et riz »).
  // Deux produits au poste (« riz et carottes ») restent ensemble : la règle de coupure est celle de « X aux Y ».
  const liste = couperListe(jetons);
  const auPoste = (j) => ['legume', 'feculent'].includes(categorieDe(j));
  if (liste.length > 1 && menu === 2 && liste.some(auPoste) && !liste.every(auPoste)) return liste.flatMap((m) => decouper(m, menu));

  // « Spaghetti carbonara » : pâtes ou riz suivi d'un nom de sauce.
  const tete = expressionsDe(jetons)[0];
  if (tete && tete.debut === 0 && ['pate', 'riz', 'risotto'].includes(tete.e.kind) && tete.fin < jetons.length) {
    const reste = jetons.slice(tete.fin);
    const sauce = expressionsDe(reste);
    if (sauce.length === 1 && sauce[0].debut === 0 && sauce[0].fin === reste.length && sauce[0].e.kind === 'sauce'
      && !bloque(zones, tete.fin)) {
      return [{ jetons: jetons.slice(0, tete.fin) }, { jetons: reste }];
    }
  }

  return couperProteine(jetons).map((j) => ({ jetons: j }));
}

/** « gorgonzola parmigiano » : plusieurs produits d'un seul mot, côte à côte, sont autant d'éléments. */
function juxtaposes(morceau, menu) {
  const trouvees = expressionsDe(morceau);
  if (morceau.length > 1 && trouvees.length === morceau.length && trouvees.every((t) => t.fin - t.debut === 1 && t.e.kind !== 'sauce')) {
    return morceau.map((t) => ({ jetons: [t] }));
  }
  return decouper(morceau, menu);
}

// ---------------------------------------------------------------- lecture d'un plat

function candidatesDeSauce() {
  return SAUCES.map((s) => ({ cle: s.cle, nom: s.nom, ingredients: [...s.ingredients], allergenes: [...s.allergenes] }));
}

function elementDe(fragment, menu) {
  const { jetons } = fragment;
  const e = decisive(jetons);
  let categorie = e?.categorie ?? 'a_preciser';
  const nom = nomDe(jetons);
  const recetteFigee = figees(jetons).some((z) => z.recette);
  const kind = e?.kind ?? null;
  if (fragment.queueSauce) categorie = 'sauce';

  let statut = 'lu';
  if (categorie === 'a_preciser' || recetteFigee || fragment.alternatives) statut = 'a_confirmer';
  if (fragment.queueSauce?.recette) statut = 'a_confirmer';
  if (kind === 'sauce' && e?.sauce?.recette) statut = 'a_confirmer';

  let role;
  if (categorie === 'sauce') role = 'sauce';
  else if (kind === 'herbe') role = 'herbe';
  else if (menu === 1) role = categorie === 'proteine' ? 'composant_recette' : 'plat_principal';
  else role = 'garniture';

  let propriete;
  if (menu === 1) propriete = 'poste';
  else if (categorie === 'a_preciser') propriete = 'a_confirmer';
  else propriete = categorie === 'legume' || categorie === 'feculent' ? 'poste' : 'hors_poste';

  const element = { nom, canonique: canonDe(jetons), categorie, role, propriete, origine: 'intitule', statut };
  if (fragment.alternatives) element.alternatives = fragment.alternatives;
  return { element, base: estBase(jetons) ? kind : null, recette: recetteFigee ? recetteLisible(jetons) : null };
}

function recetteLisible(jetons) {
  const z = figees(jetons).find((x) => x.recette);
  return nomDe(jetons.slice(z.debut, z.fin));
}

/**
 * Lit un intitulé de plat.
 * Ordre : (0) lecture corrigée par le chef, (1) alias, (2) expressions du lexique insécables, (3) coupures fortes
 * et « ou », (4) expressions figées, (5) « X aux Y », (6) queue « sauce Z », (7) poste ou hors poste selon le menu,
 * (8) sauce implicite du menu 1 « à confirmer » (jamais choisie), (9) mot inconnu « à préciser ».
 * @param {string} intitule
 * @param {1|2} menu
 * @param {{memoire?:object, lectures?:object}} [options] `lectures` : lectures corrigées, clé « intitulé normalisé|menu »
 * @returns {{original:string, normalise:string, elements:object[], ambiguites:object[]}}
 */
export function lirePlat(intitule, menu, { lectures } = {}) {
  const original = String(intitule ?? '');
  const jetons = remplacerAlias(tokeniser(original));
  const normalise = jetons.filter((t) => !t.sep).map((t) => t.n).join(' ');

  const cle = `${normaliser(original)}|${menu}`;
  if (lectures && Object.hasOwn(lectures, cle)) {
    const corrigee = lectures[cle];
    return structuredClone({ original, normalise, elements: Array.isArray(corrigee) ? corrigee : (corrigee.elements ?? []),
      ambiguites: Array.isArray(corrigee) ? [] : (corrigee.ambiguites ?? []) });
  }

  const segments = [];
  let courant = [];
  for (const t of jetons) {
    if (t.sep) { segments.push(courant); courant = []; } else courant.push(t);
  }
  segments.push(courant);

  const elements = [];
  const ambiguites = [];
  const bases = [];
  for (const fragment of segments.flatMap((seg) => decouper(seg, menu))) {
    const { element, base, recette } = elementDe(fragment, menu);
    elements.push(element);
    if (base) bases.push(base);
    if (element.alternatives) ambiguites.push({ type: 'choix', texte: element.nom });
    if (recette) ambiguites.push({ type: 'recette', texte: recette });
    if (element.categorie === 'sauce' && element.statut === 'a_confirmer') ambiguites.push({ type: 'sauce', texte: element.nom });
    if (element.categorie === 'a_preciser') ambiguites.push({ type: 'mot_inconnu', texte: element.nom });
  }

  if (menu === 1 && bases.length > 0 && !elements.some((e) => e.categorie === 'sauce')) {
    const nom = bases.includes('pate') ? 'sauce à confirmer' : 'base de risotto à confirmer';
    elements.push({ nom, canonique: normaliser(nom), categorie: 'sauce', role: 'sauce', propriete: 'poste', origine: 'implicite',
      statut: 'a_confirmer', candidates: candidatesDeSauce() });
    ambiguites.push({ type: 'sauce_implicite', texte: nom });
  }
  return { original, normalise, elements, ambiguites };
}

// ---------------------------------------------------------------- composants proposés

/**
 * Catégorie proposée pour un nom (`a_preciser` si rien n'est reconnu).
 * Règle : le premier mot reconnu décide (« <protéine> sauce … » reste une protéine). Exception : un mot de
 * forme suivi de « de » (« purée de … », « tagliatelle de … ») laisse décider le produit nommé ensuite.
 * Le lexique et la lecture vivent dans savoir.js : il n'y a qu'un seul lexique pour l'application.
 */
export function categoriePropose(nom) {
  return lireNom(nom).categorie;
}

/**
 * Propose des composants (jamais validés) : projection de `lirePlat`.
 * Un élément au poste est attribué ; un élément hors poste ou à confirmer ne l'est pas. Une exception mémorisée
 * (clé « nom|menu », à défaut ancienne clé « nom ») prime. La sauce implicite est un composant « sauce » sans quantité.
 * @param {string} intitule
 * @param {1|2} menu
 * @param {object} [memoire] état.memoire
 * @param {object} [lectures] lectures corrigées par le chef (voir lirePlat)
 * @returns {{nom:string, categorie:string, attribue:boolean, type:'a_preciser', depuisMemoire?:true}[]}
 */
export function proposerComposants(intitule, menu, memoire = {}, lectures = undefined) {
  return lirePlat(intitule, menu, { memoire, lectures }).elements.map((element) => {
    const { nom, categorie } = element;
    const attribue = element.propriete === 'poste';
    const proposition = { nom, categorie, attribue, type: 'a_preciser' };
    const memorise = lireMemoire(memoire, nom, menu);
    if (memorise) {
      proposition.categorie = memorise.categorie ?? categorie;
      proposition.attribue = typeof memorise.attribue === 'boolean' ? memorise.attribue : attribue;
      proposition.depuisMemoire = true;
    }
    return proposition;
  });
}
