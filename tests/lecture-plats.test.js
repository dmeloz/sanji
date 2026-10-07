// Lecture des intitulés de plats (B-P1a) : lirePlat sur les 30 cas du jeu TEST_ONLY, et cas ciblés.
//
// Trois dimensions mesurées séparément pour chaque cas :
//  (a) éléments : tout élément attendu « au poste » est lu au poste, et aucun élément n'est inventé comme certain ;
//  (b) poste : aucun élément attendu « hors poste » n'est mis au poste ;
//  (c) à confirmer : ce qui doit être confirmé (sauce, base de risotto, recette, choix) est bien signalé.
//
// RÈGLE DE CORRESPONDANCE TOLÉRANTE entre un nom attendu (« riz à risotto ») et un élément lu (« risotto ») :
//  1. les deux textes passent par `canonique` (sans accent, minuscules, variantes de nom remplacées : « funghi » = « champignon ») ;
//  2. on retire les mots vides (de, du, des, d, la, le, les, l, a, au, aux, en, et, nature) et le pluriel (s, x final) ;
//     le mot « sauce » est retiré s'il reste un autre mot (« sauce bolognaise » devient « bolognaise ») ;
//  3. chaque mot attendu doit se retrouver dans l'élément (son nom, sa forme canonique ou l'une de ses alternatives),
//     soit identique, soit de la même classe : riz = risotto ; toute forme de pâtes = « pâte » ;
//  4. un élément plus long que l'attendu correspond (« suprême de poulet » correspond à « poulet »), l'inverse non.
//  Une entrée attendue n'est contrôlée en (c) que si elle parle de sauce, base, recette, fiche ou choix : les allergènes,
//  identifications de légumes et étapes ne sont pas du ressort de la lecture.
//  « Inventé » : un élément lu dans l'intitulé dont un mot n'est pas dans le texte, ou un élément implicite qui n'est pas
//  « à confirmer », ou une sauce présélectionnée.

import test from 'node:test';
import assert from 'node:assert/strict';
import { lirePlat, proposerComposants } from '../app/js/domaine/analyse-menu.js';
import { ALIAS, FORMES_PATES, canonique } from '../app/js/domaine/vocabulaire-plats.js';
import { CAS_LECTURE } from './jeux/TEST_ONLY-cas-lecture.js';

// ---------------------------------------------------------------- correspondance

const VIDES = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'nature']);
const sing = (m) => m.replace(/[sx]$/, '');
const PATES = new Set(FORMES_PATES.flatMap((f) => f.split(' ')).map(sing));
const classe = (m) => {
  const s = sing(m);
  if (s === 'riz' || s === 'risotto') return 'riz';
  if (PATES.has(s) || s === 'pate') return 'pate';
  return s;
};
const motsDe = (texte) => canonique(texte).replace(/'/g, ' ').replace(/[^a-z0-9-]+/g, ' ').trim().split(' ')
  .filter((m) => m !== '' && !VIDES.has(m));
const motsAttendus = (attendu) => {
  let mots = motsDe(attendu);
  if (mots.length > 1) mots = mots.filter((m) => m !== 'sauce');
  return mots;
};
const classesElement = (e) => new Set([e.nom, e.canonique, ...(e.alternatives ?? [])].filter(Boolean)
  .flatMap(motsDe).map(classe));

function correspond(attendu, element) {
  const classes = classesElement(element);
  const mots = motsAttendus(attendu);
  if (mots.length === 0) return false;
  if (attendu === 'sauce') return element.categorie === 'sauce';
  return mots.every((m) => classes.has(classe(m)));
}

// ---------------------------------------------------------------- mesures

const sauceImplicite = (e) => e.origine === 'implicite';

function inventes(lecture) {
  const texte = new Set(motsDe(lecture.normalise).map(classe));
  const motsLus = new Set(motsDe(canonique(lecture.original)).map(classe));
  return lecture.elements.filter((e) => {
    if (sauceImplicite(e)) {
      return e.statut !== 'a_confirmer' || e.categorie !== 'sauce' || e.candidates === undefined
        || e.candidates.some((c) => 'choisie' in c || 'selectionnee' in c || 'defaut' in c);
    }
    return motsDe(e.canonique ?? e.nom).some((m) => !texte.has(classe(m)) && !motsLus.has(classe(m)));
  });
}

function mesurer(cas) {
  const lecture = lirePlat(cas.intitule, cas.menu, {});
  const els = lecture.elements;
  const echecs = [];

  const manquants = cas.auPoste.filter((a) => !els.some((e) => e.propriete === 'poste' && correspond(a, e)));
  const faux = inventes(lecture);
  const a = manquants.length === 0 && faux.length === 0;
  if (manquants.length) echecs.push(`éléments manquants au poste : ${manquants.join(', ')}`);
  if (faux.length) echecs.push(`éléments inventés : ${faux.map((e) => e.nom).join(', ')}`);

  const mal = [
    ...cas.horsPoste.filter((h) => els.some((e) => e.propriete === 'poste' && correspond(h, e))),
    ...(cas.menu === 2 ? els.filter((e) => e.propriete === 'poste' && (e.categorie === 'proteine' || e.categorie === 'sauce'))
      .map((e) => e.nom) : []),
  ];
  const b = mal.length === 0;
  if (!b) echecs.push(`hors poste mis au poste : ${[...new Set(mal)].join(', ')}`);

  const signale = (entree) => {
    if (/choix/.test(entree)) return els.some((e) => (e.alternatives ?? []).length > 1);
    if (/sauce|base/.test(entree)) return els.some((e) => e.categorie === 'sauce' && e.statut === 'a_confirmer');
    return els.some((e) => e.statut === 'a_confirmer');
  };
  const nonSignales = cas.aConfirmer.filter((x) => /sauce|base|recette|fiche|choix/.test(x)).filter((x) => !signale(x));
  const c = nonSignales.length === 0;
  if (!c) echecs.push(`non signalé à confirmer : ${nonSignales.join(', ')}`);

  return { cas, lecture, a, b, c, ok: a && b && c, echecs, nbInventes: faux.length };
}

const resultats = CAS_LECTURE.map(mesurer);
const compte = (f, liste = resultats) => liste.filter(f).length;
const reels = resultats.filter((r) => !r.cas.provisoire);

const rapport = () => {
  const lignes = resultats.filter((r) => !r.ok).map((r) => `  cas ${r.cas.numero}${r.cas.provisoire ? ' (provisoire)' : ''} « ${r.cas.intitule} » menu ${r.cas.menu}\n`
    + `    ${r.echecs.join(' ; ')}\n    lu : ${r.lecture.elements.map((e) => `${e.nom} [${e.propriete}/${e.statut}]`).join(' | ')}`);
  return `éléments ${compte((r) => r.a)}/30, poste ${compte((r) => r.b)}/30, à confirmer ${compte((r) => r.c)}/30 ; `
    + `non provisoires entièrement corrects ${compte((r) => r.ok, reels)}/${reels.length}\n${lignes.join('\n')}`;
};

test('les 30 cas : aucune sauce ni ingrédient inventé', () => {
  const listes = resultats.filter((r) => r.nbInventes > 0);
  assert.equal(listes.length, 0, rapport());
  assert.equal(CAS_LECTURE.length, 30);
});

test('les 30 cas : aucun élément hors poste mis au poste (dimension poste)', () => {
  assert.equal(compte((r) => r.b), 30, rapport());
});

const SEUIL = Math.ceil(reels.length * 0.9);
const atteint = compte((r) => r.ok, reels) >= SEUIL;
test(`seuil : au moins 90 % des cas non provisoires entièrement corrects (${SEUIL} sur ${reels.length})`,
  () => { assert.ok(atteint, `score obtenu ${compte((r) => r.ok, reels)}/${reels.length}\n${rapport()}`); });

test('rapport des trois dimensions (information)', () => {
  console.log(`# lecture des plats : ${rapport()}`.split('\n').map((l, i) => (i === 0 ? l : `# ${l}`)).join('\n'));
  assert.ok(true);
});

// ---------------------------------------------------------------- règle de correspondance

test('correspondance tolérante : riz à risotto = risotto, pâtes = une forme de pâtes, champignons = funghi', () => {
  const el = (nom, extra = {}) => ({ nom, canonique: canonique(nom), categorie: 'feculent', ...extra });
  assert.equal(correspond('riz à risotto', el('Risotto')), true);
  assert.equal(correspond('pâtes', el('Mezze maniche')), true);
  assert.equal(correspond('champignons', el('funghi', { categorie: 'legume' })), true);
  assert.equal(correspond('poulet', el('Suprême de poulet', { categorie: 'proteine' })), true);
  assert.equal(correspond('suprême de poulet', el('poulet', { categorie: 'proteine' })), false);
  assert.equal(correspond('pommes', el('frites ou pommes nature', { alternatives: ['frites', 'pommes nature'] })), true);
  assert.equal(ALIAS.length > 5, true);
});

// ---------------------------------------------------------------- exemples de la propriétaire

const noms = (l) => l.elements.map((e) => e.nom);

test('« Trofie au saumon fumé et à l\'aneth » : trofie, saumon fumé, aneth au poste + sauce implicite à confirmer', () => {
  const l = lirePlat('Trofie au saumon fumé et à l\'aneth', 1, {});
  assert.deepEqual(noms(l).slice(0, 3), ['Trofie', 'saumon fumé', 'aneth']);
  const [trofie, saumon, aneth, sauce] = l.elements;
  assert.deepEqual([trofie.role, saumon.role, aneth.role], ['plat_principal', 'composant_recette', 'herbe']);
  assert.deepEqual([trofie, saumon, aneth, sauce].map((e) => e.propriete), ['poste', 'poste', 'poste', 'poste']);
  assert.deepEqual([trofie, saumon, aneth].map((e) => e.statut), ['lu', 'lu', 'lu']);
  assert.equal(l.elements.length, 4);
  assert.equal(sauce.origine, 'implicite');
  assert.equal(sauce.statut, 'a_confirmer');
  assert.equal(sauce.categorie, 'sauce');
  assert.ok(sauce.candidates.length >= 5);
});

test('« Suprême de poulet aux petits pois et riz basmati » (menu 2) : petits pois et riz au poste, poulet hors poste', () => {
  const l = lirePlat('Suprême de poulet aux petits pois et riz basmati', 2, {});
  assert.deepEqual(l.elements.filter((e) => e.propriete === 'poste').map((e) => e.nom), ['petits pois', 'riz basmati']);
  const poulet = l.elements.find((e) => /poulet/i.test(e.nom));
  assert.equal(poulet.propriete, 'hors_poste');
  assert.equal(l.elements.some((e) => e.origine === 'implicite'), false, 'pas de sauce implicite au menu 2');
  const p = proposerComposants('Suprême de poulet aux petits pois et riz basmati', 2);
  assert.deepEqual(p.map((c) => [c.nom, c.attribue]), [['Suprême de poulet', false], ['petits pois', true], ['riz basmati', true]]);
});

test('« Risotto aux bolets » : risotto + bolets, plus la base de risotto à confirmer', () => {
  const l = lirePlat('Risotto aux bolets', 1, {});
  assert.deepEqual(noms(l).slice(0, 2), ['Risotto', 'bolets']);
  const base = l.elements[2];
  assert.equal(base.nom, 'base de risotto à confirmer');
  assert.equal(base.statut, 'a_confirmer');
  assert.equal(l.elements.length, 3);
});

// ---------------------------------------------------------------- sauce jamais choisie, crème jamais par défaut

test('aucune sauce n\'est présélectionnée et la crème n\'est jamais la valeur par défaut', () => {
  for (const intitule of ['Tagliatelle au saumon fumé', 'Penne aux courgettes', 'Spaghetti', 'Linguine au homard']) {
    const sauce = lirePlat(intitule, 1, {}).elements.find((e) => e.origine === 'implicite');
    assert.ok(sauce, intitule);
    assert.equal(sauce.statut, 'a_confirmer');
    assert.equal(/cr[eè]me/i.test(sauce.nom), false);
    assert.ok(sauce.candidates.some((c) => /cr[eè]me/i.test(c.nom)), 'la crème reste une candidate parmi d\'autres');
    assert.notEqual(/cr[eè]me/i.test(sauce.candidates[0].nom), true, 'la crème n\'est pas la première proposition');
    for (const c of sauce.candidates) {
      assert.deepEqual(Object.keys(c).sort(), ['allergenes', 'cle', 'ingredients', 'nom']);
      assert.equal(/\d/.test(JSON.stringify(c)), false, 'aucune quantité');
    }
    const [propose] = proposerComposants(intitule, 1).filter((c) => c.categorie === 'sauce');
    assert.deepEqual([propose.nom, propose.type, propose.attribue], ['sauce à confirmer', 'a_preciser', true]);
  }
  assert.equal(lirePlat('Risotto aux asperges', 1, {}).elements.at(-1).nom, 'base de risotto à confirmer');
});

test('une sauce lue dans l\'intitulé supprime la sauce implicite', () => {
  assert.equal(lirePlat('Pappardelle, crème, jambon', 1, {}).elements.some((e) => e.origine === 'implicite'), false);
  assert.equal(lirePlat('Penne sauce curry', 1, {}).elements.some((e) => e.origine === 'implicite'), false);
});

// ---------------------------------------------------------------- garde-fous de coupure

test('« poulet au riz », « poulet rôti sauce aux carottes » et « tagliatelle de courgette » restent entiers', () => {
  for (const [intitule, menu] of [['Poulet au riz', 1], ['Poulet au riz', 2], ['Poulet rôti sauce aux carottes', 1],
    ['Poulet rôti sauce aux carottes', 2], ['Tagliatelle de courgette', 2]]) {
    assert.deepEqual(noms(lirePlat(intitule, menu, {})).filter((n) => !/à confirmer/.test(n)), [intitule], `${intitule} menu ${menu}`);
  }
});

test('aucune coupure à l\'intérieur d\'une expression du lexique', () => {
  assert.deepEqual(noms(lirePlat('Pommes de terre aux choux de Bruxelles', 2, {})), ['Pommes de terre', 'choux de Bruxelles']);
  assert.deepEqual(noms(lirePlat('Poulet et pommes de terre', 2, {})), ['Poulet', 'pommes de terre']);
  assert.deepEqual(noms(lirePlat('Côte de blette, haricots verts', 2, {})), ['Côte de blette', 'haricots verts']);
  assert.deepEqual(noms(lirePlat('Pois chiches aux carottes', 2, {})), ['Pois chiches', 'carottes']);
});

test('expressions figées : façon, à la … -aise, huile de, en croûte, dans son jus ne sont jamais coupées', () => {
  assert.deepEqual(noms(lirePlat('Risotto à la milanaise', 2, {})), ['Risotto à la milanaise']);
  assert.deepEqual(noms(lirePlat('Poulet façon grand-mère aux carottes', 2, {})), ['Poulet façon grand-mère aux carottes']);
  assert.deepEqual(noms(lirePlat('Saumon en croûte aux épinards', 2, {})), ['Saumon en croûte aux épinards']);
  const l = lirePlat('Risotto à la milanaise', 1, {});
  assert.equal(l.ambiguites.length > 0, true, 'la recette « milanaise » est à confirmer');
  assert.equal(l.elements[0].statut, 'a_confirmer');
});

test('« X ou Y » donne des alternatives : un choix à demander, jamais additionnées', () => {
  const l = lirePlat('Filets de perche meunière, frites ou pommes nature', 2, {});
  const choix = l.elements.find((e) => e.alternatives);
  assert.deepEqual(choix.alternatives, ['frites', 'pommes nature']);
  assert.equal(choix.statut, 'a_confirmer');
  assert.equal(l.elements.filter((e) => /frites|pommes/.test(e.nom)).length, 1);
  assert.equal(l.ambiguites.some((a) => /frites/.test(a.texte ?? a)), true);
  assert.equal(proposerComposants('Filets de perche meunière, frites ou pommes nature', 2).length, 2);
});

test('un mot inconnu reste un élément à préciser, visible, jamais inventé', () => {
  const l = lirePlat('Risotto, ELEMENT_INCONNU_TEST', 1, {});
  const inconnu = l.elements.find((e) => /INCONNU/.test(e.nom));
  assert.deepEqual([inconnu.categorie, inconnu.statut], ['a_preciser', 'a_confirmer']);
  assert.equal(l.ambiguites.length > 0, true);
});

test('lecture : l\'original est gardé, le texte normalisé remplace les variantes de nom', () => {
  const l = lirePlat('Risotto aux Cèpes', 1, {});
  assert.equal(l.original, 'Risotto aux Cèpes');
  assert.equal(l.normalise, 'risotto aux bolet');
  assert.deepEqual(noms(l).slice(0, 2), ['Risotto', 'Cèpes']);
});

// ---------------------------------------------------------------- lecture corrigée par le chef, mémoire

test('une lecture déjà corrigée par le chef s\'applique telle quelle (intitulé normalisé, menu)', () => {
  const corrigee = { elements: [{ nom: 'Trofie maison', categorie: 'feculent', role: 'plat_principal', propriete: 'poste', origine: 'intitule', statut: 'lu' }], ambiguites: [] };
  const lectures = { 'trofie au pesto|1': corrigee };
  assert.deepEqual(noms(lirePlat('Trofie  au PESTO', 1, { lectures })), ['Trofie maison']);
  assert.notDeepEqual(noms(lirePlat('Trofie au pesto', 2, { lectures })), ['Trofie maison'], 'autre menu : lecture normale');
  assert.deepEqual(proposerComposants('Trofie au pesto', 1, {}, lectures).map((c) => c.nom), ['Trofie maison']);
});

test('une attribution mémorisée en menu 1 ne contamine pas le menu 2', () => {
  const memoire = { 'poulet|1': { nom: 'poulet', attribue: true, categorie: 'proteine' } };
  const m1 = proposerComposants('Poulet', 1, memoire);
  const m2 = proposerComposants('Poulet', 2, memoire);
  assert.deepEqual(m1[0], { nom: 'Poulet', categorie: 'proteine', attribue: true, type: 'a_preciser', depuisMemoire: true });
  assert.deepEqual(m2[0], { nom: 'Poulet', categorie: 'proteine', attribue: false, type: 'a_preciser' });
  const memoire2 = { 'poulet|2': { nom: 'poulet', attribue: true, categorie: 'proteine' } };
  assert.equal(proposerComposants('Poulet', 1, memoire2)[0].depuisMemoire, undefined);
  assert.equal(proposerComposants('Poulet', 2, memoire2)[0].attribue, true);
});

test('une ancienne clé de mémoire (nom seul) est lue en repli ; la clé par menu prime', () => {
  // Le repli ne contredit pas le menu : une protéine ne s'attribue jamais au poste en menu 2 par l'ancienne clé.
  assert.equal(proposerComposants('Poulet', 2, { poulet: { attribue: true, categorie: 'proteine' } })[0].attribue, false);
  assert.equal(proposerComposants('Riz', 2, { riz: { attribue: false, categorie: 'autre' } })[0].attribue, false);
  // Menu 1 = tout au poste : une ancienne entrée « protéine non attribuée » (peut-être écrite depuis le menu 2) n'est pas reprise.
  assert.equal(proposerComposants('Poulet', 1, { poulet: { attribue: false, categorie: 'proteine' } })[0].attribue, true);
  const les2 = { poulet: { attribue: true, categorie: 'proteine' }, 'poulet|2': { attribue: false, categorie: 'proteine' } };
  assert.equal(proposerComposants('Poulet', 2, les2)[0].attribue, false);
});

test('les éléments hors poste ne sont pas attribués sans exception mémorisée', () => {
  const p = proposerComposants('Suprême de poulet, riz', 2);
  assert.deepEqual(p.map((c) => c.attribue), [false, true]);
});

test('vocabulaire : légumes, féculents et sauces courants d\'une feuille imprimée sont reconnus, sans rien inventer', () => {
  const lu = (texte, menu) => lirePlat(texte, menu).elements.map((e) => `${e.nom}/${e.categorie}`);
  assert.ok(lu('Risotto au pesto, artichaud', 1).includes('artichaud/legume'));
  assert.ok(lu('Macaroni tomates, roquette', 1).includes('roquette/legume'));
  assert.ok(lu('Poisson sauce safran, quinotto, piperade', 2).includes('quinotto/feculent'));
  assert.ok(lu('Poisson sauce safran, quinotto, piperade', 2).includes('piperade/legume'));
  assert.ok(lu('Onglet, pommes paillasson, carottes', 2).includes('pommes paillasson/feculent'));
  assert.ok(lu('Dos de lieu, orge perlé, pack Choï', 2).includes('pack Choï/legume'));
  assert.ok(lu('Darne de saumon, salsa chimichuri, riz', 2).some((e) => e.endsWith('/sauce')));
  // Un nom de plat ou une garniture inconnue reste « à préciser » : rien n'est deviné.
  assert.ok(lu('Union Cheese burger, salade Waldorf', 2).some((e) => e.endsWith('/a_preciser')));
});

test('mémoire : un mot appris par la propriétaire n\'est plus « à préciser » dans le même menu, mais le reste inchangé', () => {
  const memoire = { 'chayote verte|2': { nom: 'chayote verte', categorie: 'legume', attribue: true } };
  const intitule = 'Sauté de veau, riz, chayote verte';
  const avec = lirePlat(intitule, 2, { memoire });
  const chayote = avec.elements.find((e) => e.nom === 'chayote verte');
  assert.equal(chayote.categorie, 'legume');
  assert.equal(chayote.statut, 'lu');
  assert.equal(chayote.propriete, 'poste');
  assert.ok(!avec.ambiguites.some((a) => a.type === 'mot_inconnu'));
  // Sans mémoire, ou pour l'autre menu : toujours à préciser (la mémoire est par menu).
  assert.equal(lirePlat(intitule, 2).elements.find((e) => e.nom === 'chayote verte').categorie, 'a_preciser');
  assert.equal(lirePlat(intitule, 1, { memoire }).elements.find((e) => e.nom === 'chayote verte').categorie, 'a_preciser');
  // Une mémoire qui ne précise rien n'écrase pas la lecture.
  const vide = { 'chayote verte|2': { nom: 'chayote verte', categorie: 'a_preciser', attribue: true } };
  assert.equal(lirePlat(intitule, 2, { memoire: vide }).elements.find((e) => e.nom === 'chayote verte').categorie, 'a_preciser');
});
