// v116 : un jour de la Semaine ouvre Production ; ce que la page de jour apportait vit dans la feuille « Services du jour ».
// Faux DOM : ni mise en page ni navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { etatVide, h as horo } from './aide.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

let dom; let magasin; let production; let routeur; let actions; let dates; let tableau; let feuille; let couverts;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  production = await import('../app/js/ui/vue-production.js');
  routeur = await import('../app/js/ui/routeur.js');
  actions = await import('../app/js/domaine/actions.js');
  dates = await import('../app/js/domaine/dates.js');
  tableau = await import('../app/js/ui/vue-tableau.js');
  feuille = await import('../app/js/ui/feuille-services.js');
  couverts = await import('../app/js/domaine/actions-couverts.js');
});
after(() => dom.restaurer());

const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const liens = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const ouvertes = () => dom.corps.tous((x) => x.balise === 'dialog' && x.open);
const ligneServices = (n) => parClasse(n, 'prod-services')[0];

function semaine() {
  const e = etatVide();
  actions.definirMenu(e, S.lundiSuivant, 1, 'riz, carottes', horo());
  actions.definirMenu(e, S.lundiSuivant, 2, 'courgettes, quinoa', horo());
  actions.definirPrevision(e, S.lundiSuivant, 1, 40, horo());
  actions.creerFiche(e, { date: S.lundiSuivant, service: 'midi', numero: 'F7', couverts: 12, horaire: '12:00', mode: 'menu_fixe', menuFixe: 1, allergies: 'arachides' }, horo());
  return e;
}
const pageProduction = (e, date = S.lundiSuivant) => { magasin.remplacer(e); return production.rendre(magasin.etat(), date); };

test('routeur : #/semaine/<date> mène à Production du jour, sans boucle ; le tableau reste', () => {
  assert.deepEqual(routeur.analyserHash(`#/semaine/${S.lundiSuivant}`, S.samedi), { vue: 'production', param: S.lundiSuivant });
  assert.deepEqual(routeur.analyserHash(`#/detail/${S.lundiSuivant}`, S.samedi), { vue: 'production', param: S.lundiSuivant });
  const redirige = routeur.analyserHash(`#/semaine/${S.lundiSuivant}`, S.samedi);
  assert.deepEqual(routeur.analyserHash(`#/${redirige.vue}/${redirige.param}`, S.samedi), redirige);
  assert.deepEqual(routeur.analyserHash('#/semaine', S.samedi), { vue: 'semaine', param: null });
  assert.deepEqual(routeur.analyserHash(`#/semaine/${S.lundiSuivant}/tableau`, S.samedi), { vue: 'semaine', param: S.lundiSuivant, sous: 'tableau' });
});

test('tableau de la semaine : aucun lien ne mène encore à la page de jour', () => {
  const e = semaine();
  magasin.remplacer(e);
  const n = tableau.rendre(magasin.etat(), S.lundiSuivant);
  const versJour = liens(n).filter((l) => /^#\/semaine\/\d{4}-\d{2}-\d{2}$/.test(l));
  assert.deepEqual(versJour, []);
  assert.ok(liens(n).includes(`#/production/${S.lundiSuivant}`), 'le jour mène à Production');
});

test('Production : une ligne « Services du jour » (couverts, fiches), un seul bouton d\'au moins 44 px, aucun details', () => {
  const e = semaine();
  couverts.definirCouvertsMidi(e, S.lundiSuivant, { total: 60 }, horo());
  const n = pageProduction(e);
  const ligne = ligneServices(n);
  assert.ok(ligne, 'ligne Services du jour');
  assert.equal(ligne.balise, 'button');
  assert.match(ligne.textContent, /Services du jour · couverts (60|à saisir) · 1 fiche/);
  assert.equal(n.tous((x) => x.balise === 'details').length, 0);
});

test('la ligne ouvre la feuille : couverts, menus, attribution, fiches, allergies, points à confirmer', async () => {
  const e = semaine();
  const n = pageProduction(e);
  await ligneServices(n).click();
  const f = ouvertes().at(-1);
  const t = f.textContent;
  for (const attendu of ['Couverts midi', 'Menu 1', 'riz, carottes', 'Menu 2', 'courgettes, quinoa', 'Fiche F7', 'Allergies', 'arachides',
    'Nouvelle fiche', 'Détail du jour']) assert.ok(t.includes(attendu), attendu);
  assert.match(t, /\d+ points? à confirmer ce jour-là/);
  assert.ok(f.tous((x) => x.balise === 'button').some((b) => b.textContent === 'Voir'), 'bouton Voir');
  assert.ok(f.tous((x) => x.attributs.role === 'switch').length >= 1, 'bascule au poste / hors poste par élément');
  assert.equal(f.tous((x) => x.balise === 'details').length, 0, 'aucun repli dans la feuille');
  f.close();
});

test('la bascule au poste de la feuille écrit l\'attribution', async () => {
  const e = semaine();
  const n = pageProduction(e);
  await ligneServices(n).click();
  const f = ouvertes().at(-1);
  const interrupteur = f.tous((x) => x.attributs.role === 'switch')[0];
  const id = Object.values(magasin.etat().composants).find((c) => `sem-poste-${c.id}` === interrupteur.attributs.id).id;
  const avant = magasin.etat().composants[id].attribue;
  interrupteur.checked = !avant;
  await interrupteur.declencher?.('change');
  assert.equal(magasin.etat().composants[id].attribue, !avant);
  f.close();
});

test('« Couverts midi » de la feuille ouvre la feuille de saisie', async () => {
  const n = pageProduction(semaine());
  await ligneServices(n).click();
  const f = ouvertes().at(-1);
  const bouton = f.tous((x) => x.balise === 'button' && /les couverts midi du/.test(x.attributs['aria-label'] ?? ''))[0];
  assert.ok(bouton);
  await bouton.click();
  assert.equal(ouvertes().at(-1).querySelector('h2').textContent, 'Couverts midi');
  ouvertes().forEach((d) => d.close());
});

test('« Détail du jour » s\'ouvre depuis la première feuille et reprend les rubriques', async () => {
  const n = pageProduction(semaine());
  await ligneServices(n).click();
  const premiere = ouvertes().at(-1);
  const bouton = premiere.tous((x) => x.balise === 'button' && x.textContent === 'Détail du jour')[0];
  await bouton.click();
  const detail = ouvertes().at(-1);
  assert.equal(detail.querySelector('h2').textContent, 'Détail du jour');
  for (const attendu of ['Menus du jour', 'Fiches de fonction', 'Allergies du jour', 'Créneaux du jour', 'Après service', 'Points à confirmer', 'Nouvelle fiche']) {
    assert.ok(detail.textContent.includes(attendu), attendu);
  }
  ouvertes().forEach((d) => d.close());
});

test('« Voir » (points à confirmer) ouvre le détail du jour', async () => {
  const n = pageProduction(semaine());
  await ligneServices(n).click();
  const voir = ouvertes().at(-1).tous((x) => x.balise === 'button' && x.textContent === 'Voir')[0];
  await voir.click();
  assert.equal(ouvertes().at(-1).querySelector('h2').textContent, 'Détail du jour');
  ouvertes().forEach((d) => d.close());
});

test('dimanche (fermé) : Production s\'affiche sans ligne Services, sans erreur ; samedi : pas de menu, la ligne reste', () => {
  const e = semaine();
  const dimanche = pageProduction(e, dates.ajouterJours(S.lundiSuivant, 6));
  assert.equal(ligneServices(dimanche), undefined);
  assert.match(dimanche.textContent, /fermé/);
  const samedi = pageProduction(e, dates.ajouterJours(S.lundiSuivant, 5));
  assert.ok(ligneServices(samedi));
});

test('la feuille dit les menus, leur certitude et ce qui reste à saisir', async () => {
  const e = semaine();
  const n = pageProduction(e);
  await ligneServices(n).click();
  const t = ouvertes().at(-1).textContent;
  assert.match(t, /estimée 40/);
  assert.match(t, /confirmée 12/);
  assert.match(t, /prévision à saisir/);
  assert.match(t, /répartition confirmée/);
  assert.match(t, /allergènes à confirmer/);
  ouvertes().forEach((d) => d.close());
});

test('couverts midi saisis : la certitude est « provisoire » et ne laisse pas d\'« estimée 0 » ; une prévision estimée à 0 se dit « estimée 0 »', async () => {
  const lire = async (e) => {
    await ligneServices(pageProduction(e)).click();
    const f = ouvertes().at(-1);
    const t = f.textContent;
    f.close();
    return t;
  };
  const avec = semaine();
  couverts.definirCouvertsMidi(avec, S.lundiSuivant, { total: 60 }, horo());
  const t = await lire(avec);
  assert.match(t, /provisoire 20/);
  assert.match(t, /provisoire 40/);
  assert.doesNotMatch(t, /estimée 0/);
  const zero = semaine();
  actions.definirPrevision(zero, S.lundiSuivant, 2, 0, horo());
  assert.match(await lire(zero), /estimée 0/);
});

test('samedi : la feuille dit qu\'il n\'y a pas de menu du jour', async () => {
  const f = (() => { magasin.remplacer(semaine()); feuille.ouvrirServices(dates.ajouterJours(S.lundiSuivant, 5)); return ouvertes().at(-1); })();
  assert.match(f.textContent, /Pas de menu du jour/);
  f.close();
});

test('Semaine : la vue ne rend plus que le tableau, même appelée avec une date', async () => {
  const vue = await import('../app/js/ui/vue-semaine.js');
  magasin.remplacer(semaine());
  assert.equal(vue.titre(S.lundiSuivant), 'Semaine');
  assert.equal(parClasse(vue.rendre(magasin.etat(), S.lundiSuivant), 'sem-puce').length, 0);
  assert.equal(typeof feuille.ouvrirServices, 'function');
});

// ---------------------------------------------------------------- relecture v116 : feuilles vivantes, ancre, à plat

test('Services du jour : la feuille se redessine seule quand l\'état change (nouvelle fiche visible, pas de doublon à recréer)', async () => {
  const e = semaine();
  const n = pageProduction(e);
  await ligneServices(n).click();
  const f = ouvertes().at(-1);
  assert.doesNotMatch(f.textContent, /Fiche F9/);
  await magasin.agir((x, t) => actions.creerFiche(x, { date: S.lundiSuivant, service: 'soir', numero: 'F9', couverts: 8, horaire: '19:00', mode: 'hors_menu' }, t));
  assert.match(f.textContent, /Fiche F9/);
  f.close();
  // fermée : plus d'abonnement, un changement d'état ne lève rien
  await magasin.agir((x, t) => actions.creerFiche(x, { date: S.lundiSuivant, service: 'soir', numero: 'F10', couverts: 2, horaire: '20:00', mode: 'hors_menu' }, t));
});

test('Détail du jour : la feuille se redessine seule (un composant supprimé disparaît), sans aucun details, avec les rubriques à plat', async () => {
  magasin.remplacer(semaine());
  feuille.ouvrirDetailDuJour(S.lundiSuivant);
  const d = ouvertes().at(-1);
  assert.equal(d.tous((x) => x.balise === 'details').length, 0, 'aucun details');
  for (const titre of ['Couverts midi', 'Fiches de fonction', 'Allergies du jour', 'Créneaux du jour', 'Après service']) {
    assert.ok(d.tous((x) => x.balise === 'h2').some((h2) => h2.textContent.startsWith(titre)), titre);
  }
  const c = Object.values(magasin.etat().composants).find((x) => x.date === S.lundiSuivant);
  assert.ok(d.textContent.includes(c.nom));
  const avant = d.textContent.split(c.nom).length;
  await magasin.agir((x, t) => actions.supprimerComposant(x, c.id, t));
  assert.ok(d.textContent.split(c.nom).length < avant, 'la ligne a disparu');
  d.close();
});

test('« Voir » mène à la section « Points à confirmer » du détail', async () => {
  const appels = [];
  const { Element } = await import('./aide-dom.js');
  const origine = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function suivre() { appels.push(this.attributs.id); };
  try {
    const n = pageProduction(semaine());
    await ligneServices(n).click();
    await ouvertes().at(-1).tous((x) => x.balise === 'button' && x.textContent === 'Voir')[0].click();
    assert.deepEqual(appels, ['points']);
  } finally { Element.prototype.scrollIntoView = origine; ouvertes().forEach((d) => d.close()); }
});

test('fiche en lecture seule : « Modifier la fiche » ouvre la modification', async () => {
  const e = semaine();
  const fiche = Object.values(e.fiches)[0];
  magasin.remplacer(e);
  const fiches = await import('../app/js/ui/fiches.js');
  fiches.ouvrirFiche(fiche.id);
  const lecture = ouvertes().at(-1);
  assert.equal(lecture.tous((x) => x.balise === 'a').length, 0, 'plus de lien « Ouvrir le jour pour modifier »');
  await lecture.tous((x) => x.balise === 'button' && x.textContent === 'Modifier la fiche')[0].click();
  const edition = ouvertes().at(-1);
  assert.notEqual(edition, lecture);
  assert.ok(edition.tous((x) => x.balise === 'input' || x.balise === 'select').length > 0, 'formulaire de modification');
  ouvertes().forEach((d) => d.close());
});
