// Mots retenus (v111) : règles de structure de lirePlat, mémoire par mot, import/export, rapport, reclassement des semaines
// à venir et geste « pour enseigner » sous faux DOM. Plats classiques génériques ; aucune donnée de restaurant.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { lirePlat, proposerComposants } from '../app/js/domaine/analyse-menu.js';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { enseignerMot, oublierMot, retenirMot } from '../app/js/domaine/actions-mots.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { motDe } from '../app/js/domaine/mots-retenus.js';
import { rapportApprentissage } from '../app/js/domaine/rapport-apprentissage.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { boutons, installerFauxDom } from './aide-dom.js';
import { h } from './aide.js';

const PASSE = '2026-09-28'; // avant h() (2026-10-01)
const FUTUR = '2026-10-12';
const noms = (plat, menu = 1, options) => lirePlat(plat, menu, options).elements.map((e) => e.nom);
const element = (plat, nom, menu = 1, options) => lirePlat(plat, menu, options).elements.find((e) => e.nom === nom);

// ------------------------------------------------------------- couche 1 : structure

test('« Gnocchi alla sorrentina » : gnocchi + complément inconnu proposé comme sauce à confirmer, jamais un mot muet', () => {
  const lecture = lirePlat('Gnocchi alla sorrentina', 1);
  const complement = lecture.elements.find((e) => e.nom === 'sorrentina');
  assert.equal(complement.suggestion, 'sauce');
  assert.equal(complement.statut, 'a_confirmer');
  assert.equal(complement.categorie, 'a_preciser');
  assert.ok(lecture.ambiguites.some((a) => a.type === 'mot_propose' && a.suggestion === 'sauce'));
  assert.ok(!lecture.ambiguites.some((a) => a.type === 'mot_inconnu'));
  assert.equal(lecture.elements.filter((e) => e.categorie === 'sauce' && e.origine === 'implicite').length, 0, 'pas de sauce implicite en double');
});

test('prépositions italiennes : « Polenta con salsiccia » est coupé, complément proposé « à confirmer »', () => {
  const e = element('Polenta con salsiccia', 'salsiccia');
  assert.equal(e?.suggestion, 'sauce');
  assert.equal(e.statut, 'a_confirmer');
});

test('noms de plats français : « à la », « à l\'», « au », « aux » + mot inconnu ne coupent pas, rien en plus', () => {
  for (const [plat, menu] of [['Riz au lait', 1], ['Riz à la grecque', 1], ["Pâtes à l'ancienne", 1], ['Pâtes à la minute', 1],
    ["Pommes de terre à l'ail", 2], ["Riz aux saveurs d'Asie", 1], ['Spaghetti aux palourdes', 1]]) {
    const lecture = lirePlat(plat, menu);
    assert.ok(!lecture.elements.some((e) => e.suggestion), `${plat} : aucune proposition`);
    assert.ok(!lecture.ambiguites.some((a) => a.type === 'mot_propose'), plat);
    assert.equal(lecture.elements.filter((e) => e.origine !== 'implicite').length, 1, `${plat} : un seul élément (nom entier)`);
  }
});

test('un mot retenu fait couper « Gnocchi à la sorrentina » (préposition française + mot connu)', () => {
  assert.equal(noms('Gnocchi à la sorrentina').filter((n) => n !== 'sauce à confirmer').length, 1);
  const mots = { sorrentina: { categorie: 'sauce', h: h() } };
  assert.deepEqual(noms('Gnocchi à la sorrentina', 1, { mots }), ['Gnocchi', 'sorrentina']);
});

test('mots connus : la règle de structure ne change rien (sauce, produit, forme)', () => {
  assert.deepEqual(noms("Penne all'arrabbiata"), ['Penne', 'arrabbiata']);
  assert.equal(element("Penne all'arrabbiata", 'arrabbiata').categorie, 'sauce');
  assert.deepEqual(noms('Tagliatelle alla bolognaise'), ['Tagliatelle', 'bolognaise']);
  assert.deepEqual(noms('Risotto al nero di seppia').slice(0, 2), ['Risotto', 'nero di seppia']);
  assert.deepEqual(noms('Rösti au lard', 2), ['Rösti', 'lard']);
});

test('« Fusilli al ferretto à la N\'Duja » : forme qualifiée conservée dans le nom, sauce reconnue', () => {
  const lecture = lirePlat("Fusilli al ferretto à la N'Duja", 1);
  assert.deepEqual(lecture.elements.map((e) => e.nom), ['Fusilli al ferretto', "N'Duja"]);
  assert.equal(lecture.elements[0].categorie, 'feculent');
  assert.equal(lecture.elements[1].categorie, 'sauce');
});

test('« de », « di » nomment le plat : « Gnocchi di patate » reste entier', () => {
  assert.equal(noms('Gnocchi di patate')[0], 'Gnocchi di patate');
});

test('un complément italien de plus de 2 mots n\'est pas deviné : le texte reste entier', () => {
  assert.ok(!lirePlat('Penne alla maison du chef du soir', 1).elements.some((e) => e.suggestion));
});

// ------------------------------------------------------------- couche 2 : mémoire par mot

test('motDe : sans accent, minuscules, sans article ni préposition ; vide si rien ne reste ou trop long', () => {
  assert.equal(motDe("à la N'Duja"), 'nduja');
  assert.equal(motDe("l'Aneth"), 'aneth');
  assert.equal(motDe('Sorrentina'), 'sorrentina');
  assert.equal(motDe('aux'), '');
  assert.equal(motDe('x'.repeat(41)), '');
});

test('un mot retenu passe avant les règles de structure, pour les deux menus', () => {
  const mots = { sorrentina: { categorie: 'sauce', h: h() } };
  for (const menu of [1, 2]) {
    const e = element('Gnocchi alla sorrentina', 'sorrentina', menu, { mots });
    assert.equal(e.categorie, 'sauce');
    assert.equal(e.origine, 'mot_retenu');
    assert.equal(e.suggestion, undefined);
  }
});

test('un mot retenu comme forme de pâtes est gardé dans le nom du féculent', () => {
  const mots = { rigatino: { categorie: 'forme_pates', h: h() } };
  assert.equal(noms('Fusilli al rigatino', 1, { mots })[0], 'Fusilli al rigatino');
});

test('un mot retenu ne s\'applique jamais à un autre mot', () => {
  const mots = { sorrentina: { categorie: 'sauce', h: h() } };
  const e = element('Gnocchi alla sorrentinella', 'sorrentinella', 1, { mots });
  assert.equal(e.categorie, 'a_preciser');
  assert.equal(e.suggestion, 'sauce');
});

test('un mot retenu l\'emporte sur le vocabulaire connu', () => {
  const mots = { arrabbiata: { categorie: 'produit', h: h() } };
  assert.equal(element("Penne all'arrabbiata", 'arrabbiata', 1, { mots }).categorie, 'autre');
});

test('proposerComposants transmet les mots et la suggestion', () => {
  const [, c] = proposerComposants('Gnocchi alla sorrentina', 1, {}, undefined, { sorrentina: { categorie: 'sauce' } });
  assert.equal(c.categorie, 'sauce');
  assert.equal(proposerComposants('Gnocchi alla sorrentina', 1).find((p) => p.nom === 'sorrentina').suggestion, 'sauce');
});

// ------------------------------------------------------------- import / export

const importe = (mots) => importer(exporter({ ...etatInitial(), mots }, h()));

test('état neuf : mots vide ; un export sans « mots » donne {}', () => {
  assert.deepEqual(etatInitial().mots, {});
  const ancien = JSON.parse(exporter(etatInitial(), h()));
  delete ancien.etat.mots;
  assert.deepEqual(importer(JSON.stringify(ancien)).mots, {});
});

test('export puis import : les mots valides sont gardés', () => {
  const mots = { nduja: { categorie: 'sauce', h: h() }, ferretto: { categorie: 'forme_pates', h: h() } };
  assert.deepEqual(importe(mots).mots, mots);
});

test('import : classement inconnu, mot vide, trop long ou non normalisé, clé dangereuse sont écartés', () => {
  const mots = JSON.parse(`{ "ok": {"categorie":"produit"}, "mauvais": {"categorie":"dessert"}, "": {"categorie":"sauce"},
    "${'x'.repeat(41)}": {"categorie":"sauce"}, "La Nduja": {"categorie":"sauce"}, "à la sauce": {"categorie":"sauce"},
    "toString": {"categorie":"hasOwnProperty"}, "__proto__": {"categorie":"sauce"}, "mot": "sauce" }`);
  assert.deepEqual(Object.keys(importe(mots).mots), ['ok']);
});

test('import : « mots » qui n\'est pas un objet refuse le fichier', () => {
  const ancien = JSON.parse(exporter(etatInitial(), h()));
  ancien.etat.mots = [];
  assert.throws(() => importer(JSON.stringify(ancien)), /mots/);
});

// ------------------------------------------------------------- rapport

test('rapport : les mots retenus pour tous les plats sont comptés avec les noms retenus', () => {
  const etat = { memoire: { 'zeta|1': { categorie: 'legume' } }, mots: { nduja: { categorie: 'sauce' }, bidon: { categorie: 'x' } }, composants: {} };
  const r = rapportApprentissage(etat);
  assert.equal(r.motsRetenus, 2);
  assert.deepEqual(r.mots.find((m) => m.pourTous), { nom: 'nduja', menu: null, categorie: 'sauce', pourTous: true });
});

// ------------------------------------------------------------- actions

function monde() {
  const etat = etatInitial();
  definirMenu(etat, PASSE, 1, 'Gnocchi alla sorrentina', h());
  definirMenu(etat, FUTUR, 1, 'Gnocchi alla sorrentina', h());
  definirMenu(etat, FUTUR, 2, 'Poulet rôti, gnocchi alla sorrentina', h());
  return etat;
}
const duJour = (etat, date, menu) => Object.values(etat.composants).find((c) => c.date === date && c.menu === menu && c.nom === 'sorrentina');

test('le menu génère un composant « à préciser » portant la suggestion', () => {
  const etat = monde();
  assert.equal(duJour(etat, FUTUR, 1).categorie, 'a_preciser');
  assert.equal(duJour(etat, FUTUR, 1).suggestion, 'sauce');
  assert.match(pointsAConfirmer(etat, FUTUR).find((p) => p.type === 'composant_inconnu').texte, /sorrentina : à confirmer \(sauce proposée\)/);
});

test('enseignerMot : classe l\'élément, retient le mot, reclasse les semaines à venir, laisse le passé', () => {
  const etat = monde();
  const r = enseignerMot(etat, duJour(etat, FUTUR, 1).id, 'sauce', h());
  assert.deepEqual(r, { mot: 'sorrentina', reclasses: 1 });
  assert.deepEqual(etat.mots.sorrentina, { categorie: 'sauce', h: h() });
  assert.equal(duJour(etat, FUTUR, 1).categorie, 'sauce');
  assert.equal(duJour(etat, FUTUR, 1).role, 'sauce');
  assert.equal(duJour(etat, FUTUR, 1).suggestion, undefined);
  assert.equal(duJour(etat, FUTUR, 2).categorie, 'sauce', 'menu 2 reclassé aussi');
  assert.equal(duJour(etat, PASSE, 1).categorie, 'a_preciser', 'semaine passée inchangée');
  assert.match(etat.journal.at(-1).detail, /sorrentina = sauce \(1 élément/);
});

test('retenirMot : un mot invalide ou un classement inconnu ne change rien', () => {
  const etat = monde();
  assert.throws(() => retenirMot(etat, 'aux', 'sauce', h()), /ne peut pas être retenu/);
  assert.throws(() => retenirMot(etat, 'sorrentina', 'dessert', h()), /inconnu/);
  assert.deepEqual(etat.mots, {});
});

test('oublierMot : le mot disparaît, les éléments déjà classés restent classés', () => {
  const etat = monde();
  enseignerMot(etat, duJour(etat, FUTUR, 1).id, 'sauce', h());
  oublierMot(etat, 'sorrentina', h(1));
  assert.deepEqual(etat.mots, {});
  assert.equal(duJour(etat, FUTUR, 1).categorie, 'sauce');
  assert.throws(() => oublierMot(etat, 'sorrentina', h(2)), /pas retenu/);
});

test('une semaine saisie après l\'apprentissage lit le mot sans rien demander', () => {
  const etat = monde();
  enseignerMot(etat, duJour(etat, FUTUR, 1).id, 'sauce', h());
  definirMenu(etat, '2026-10-19', 1, 'Gnocchi alla sorrentina', h(2));
  const c = Object.values(etat.composants).find((x) => x.date === '2026-10-19' && x.nom === 'sorrentina');
  assert.equal(c.categorie, 'sauce');
});

// ------------------------------------------------------------- geste (faux DOM)

let dom;
let magasin;
let enseigner;
let fiche;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  enseigner = await import('../app/js/ui/enseigner-mot.js');
  fiche = await import('../app/js/ui/vue-fiche.js');
});
after(() => dom.restaurer());

test('geste : quatre choix, un toucher classe, retient et annonce le mot', () => {
  const etat = monde();
  magasin.remplacer(etat);
  const c = duJour(magasin.etat(), FUTUR, 1);
  const bloc = enseigner.blocEnseigner(c);
  assert.deepEqual(boutons(bloc).map((b) => b.textContent), ['Forme de pâtes', 'Sauce', 'Produit', 'Garniture']);
  boutons(bloc).find((b) => b.textContent === 'Sauce').click();
  assert.equal(magasin.etat().mots.sorrentina.categorie, 'sauce');
  assert.equal(duJour(magasin.etat(), FUTUR, 1).categorie, 'sauce');
  assert.match(dom.corps.textContent, /Retenu : sorrentina = sauce, pour tous les plats\./);
  assert.equal(enseigner.blocEnseigner(duJour(magasin.etat(), FUTUR, 1)), null, 'plus à préciser : plus de choix');
});

test('fiche d\'un élément proposé : pastille « proposée · à confirmer », 4 choix, le suggéré en principal', () => {
  const etat = monde();
  magasin.remplacer(etat);
  const c = duJour(magasin.etat(), FUTUR, 1);
  const page = fiche.rendre(magasin.etat(), c.id);
  assert.match(page.textContent, /sauce proposée · à confirmer/);
  const choix = boutons(page).filter((b) => /enseigner-choix/.test(b.className));
  assert.deepEqual(choix.map((b) => b.textContent), ['Forme de pâtes', 'Sauce', 'Produit', 'Garniture']);
  assert.deepEqual(choix.filter((b) => /btn-principal/.test(b.className)).map((b) => b.textContent), ['Sauce']);
});

test('fiche : un clic retient le mot, efface la suggestion et reclasse les semaines à venir', () => {
  const etat = monde();
  magasin.remplacer(etat);
  const c = duJour(magasin.etat(), FUTUR, 1);
  boutons(fiche.rendre(magasin.etat(), c.id)).find((b) => b.textContent === 'Sauce').click();
  assert.equal(magasin.etat().mots.sorrentina.categorie, 'sauce');
  assert.equal(duJour(magasin.etat(), FUTUR, 1).suggestion, undefined);
  assert.equal(duJour(magasin.etat(), FUTUR, 2).categorie, 'sauce');
  assert.equal(duJour(magasin.etat(), PASSE, 1).categorie, 'a_preciser');
  const apres = fiche.rendre(magasin.etat(), c.id);
  assert.doesNotMatch(apres.textContent, /proposée · à confirmer/);
  assert.doesNotMatch(apres.textContent, /qu'est-ce que c'est/, 'plus de bloc d\'enseignement');
  assert.equal(boutons(apres).filter((b) => /enseigner-choix/.test(b.className)).length, 4, 'v118 : seul le bloc « Fiche de l\'élément » reste (4 choix)');
});

test('fiche : un élément déjà précisé n\'a pas le bloc', () => {
  const etat = monde();
  magasin.remplacer(etat);
  const gnocchi = Object.values(magasin.etat().composants).find((x) => x.nom === 'Gnocchi');
  assert.equal(enseigner.blocEnseigner(gnocchi), null);
  const page = fiche.rendre(magasin.etat(), gnocchi.id);
  assert.doesNotMatch(page.textContent, /qu'est-ce que c'est/);
  assert.equal(boutons(page).filter((b) => /enseigner-choix/.test(b.className)).length, 4, 'v118 : le bloc « Fiche de l\'élément » (4 choix) remplace l\'absence de bloc');
});

test('import : une suggestion qui n\'est pas un classement autorisé est supprimée', () => {
  const etat = monde();
  const [a, b, c] = Object.values(etat.composants).filter((x) => x.suggestion);
  a.suggestion = 'toString'; b.suggestion = 'xyz';
  const lu = importer(exporter(etat, h()));
  for (const x of [a, b]) assert.equal('suggestion' in lu.composants[x.id], false);
  assert.equal(lu.composants[c.id].suggestion, 'sauce');
});

test('fiche : une suggestion invalide ne plante pas et n\'ouvre pas de choix proposé', () => {
  const etat = monde();
  const c = duJour(etat, FUTUR, 1);
  c.suggestion = 'toString';
  magasin.remplacer(etat);
  const page = fiche.rendre(magasin.etat(), c.id);
  assert.doesNotMatch(page.textContent, /proposée · à confirmer/);
});

test('oublierMot : les entrées de mémoire créées par le geste sont retirées, la lecture ne redonne plus la catégorie', () => {
  const etat = monde();
  enseignerMot(etat, duJour(etat, FUTUR, 1).id, 'sauce', h());
  assert.ok(etat.memoire['sorrentina|1'], 'le geste a écrit la mémoire du nom');
  oublierMot(etat, 'sorrentina', h(1));
  assert.deepEqual(etat.memoire, {});
  const e = lirePlat('Gnocchi alla sorrentina', 1, { memoire: etat.memoire, mots: etat.mots }).elements.find((x) => x.nom === 'sorrentina');
  assert.equal(e.categorie, 'a_preciser');
  assert.equal(duJour(etat, FUTUR, 1).categorie, 'sauce', 'l\'élément déjà classé reste classé');
});

test('oublierMot : une mémoire posée par la propriétaire avant le geste est gardée', () => {
  const etat = monde();
  etat.memoire['sorrentina|1'] = { nom: 'sorrentina', attribue: true, categorie: 'autre' };
  enseignerMot(etat, duJour(etat, FUTUR, 1).id, 'sauce', h());
  oublierMot(etat, 'sorrentina', h(1));
  assert.ok(etat.memoire['sorrentina|1']);
});

test('reclassement : une décision explicite (hors poste) n\'est pas écrasée', () => {
  const etat = monde();
  modifierComposant(etat, duJour(etat, FUTUR, 1).id, { attribue: false }, h());
  retenirMot(etat, 'sorrentina', 'sauce', h(1));
  assert.equal(duJour(etat, FUTUR, 1).categorie, 'a_preciser');
  assert.equal(duJour(etat, FUTUR, 1).attribue, false);
  assert.equal(duJour(etat, FUTUR, 2).categorie, 'sauce', 'les autres sont reclassés');
});

test('import : h des mots doit être une date valide ; 500 mots au plus', () => {
  const lu = importe({ nduja: { categorie: 'sauce', h: 'pas une date' }, ok: { categorie: 'produit', h: h() } });
  assert.equal(lu.mots.nduja.h, null);
  assert.equal(lu.mots.ok.h, h());
  const beaucoup = Object.fromEntries(Array.from({ length: 520 }, (_, i) => [`mot${'abcdefghij'[i % 10]}${'abcdefghij'[Math.floor(i / 10) % 10]}${'abcdefghij'[Math.floor(i / 100)]}`, { categorie: 'produit', h: h() }]));
  assert.equal(Object.keys(importe(beaucoup).mots).length, 500);
});
