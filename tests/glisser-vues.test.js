// Glisser pour changer de jour ou de semaine (v124) : Détail du jour, Import, Semaine, Articles, sous faux DOM.
// Le toucher réel (doigt, défilement, feuille) ne se teste pas ici : à vérifier sur iPhone.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, menuValide, prevision } from './aide.js';
import { articlesDuPoste } from '../app/js/domaine/articles.js';
import { directionDuGeste } from '../app/js/ui/glisser.js';

let dom; let magasin; let articles; let importation; let semaine; let services;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  articles = await import('../app/js/ui/vue-articles.js');
  importation = await import('../app/js/ui/vue-import.js');
  semaine = await import('../app/js/ui/vue-semaine.js');
  services = await import('../app/js/ui/feuille-services.js');
});
after(() => dom.restaurer());

const classes = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const champ = (n, id) => n.tous((x) => x.attributs.id === id)[0];
const SUR_UN_CHAMP = { closest: () => ({}) };

/** Un doigt qui glisse de `dx` px (négatif = vers la gauche) en 200 ms, à partir de `cible`. */
function geste(element, dx, { dy = 0, cible = {}, x = 200, doigts = 1 } = {}) {
  element.declencher('touchstart', { touches: Array.from({ length: doigts }, () => ({ clientX: x, clientY: 300 })), target: cible });
  return element.declencher('touchend', { changedTouches: [{ clientX: x + dx, clientY: 300 + dy }] });
}

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle { constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); } };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

test('le geste de 60 px suffit pour feuilleter ; en dessous, un défilement vertical ou trop lent, rien', () => {
  assert.equal(directionDuGeste({ dx: -70, dy: 5, dt: 200 }, 60), 'suivant');
  assert.equal(directionDuGeste({ dx: 70, dy: 5, dt: 200 }, 60), 'precedent');
  assert.equal(directionDuGeste({ dx: -50, dy: 0, dt: 200 }, 60), null);
  assert.equal(directionDuGeste({ dx: -70, dy: 60, dt: 200 }, 60), null);
});

// ---------------------------------------------------------------- Semaine
test('Semaine : glisser vers la gauche ouvre la semaine suivante, vers la droite la précédente ; un geste court ou sur un bouton, rien', () => {
  magasin.remplacer(etatVide());
  const p = aDate(S.lundi, () => semaine.rendre(magasin.etat(), S.lundi));
  location.hash = '';
  geste(p, -30);
  assert.equal(location.hash, '', 'trop court');
  geste(p, -90, { cible: SUR_UN_CHAMP });
  assert.equal(location.hash, '', 'un geste qui part d\'un bouton ou d\'un champ ne feuillette pas');
  geste(p, -90);
  assert.equal(location.hash, `#/semaine/${S.lundiSuivant}/tableau`);
  geste(p, 90);
  assert.equal(location.hash, '#/semaine/2026-09-28/tableau');
});

test('Semaine : sans paramètre un samedi, la semaine affichée est la suivante : glisser part d\'elle', () => {
  magasin.remplacer(etatVide());
  const samedi = '2026-10-10'; // la semaine par défaut est alors celle du 12
  const p = aDate(samedi, () => semaine.rendre(magasin.etat()));
  location.hash = '';
  geste(p, -90);
  assert.equal(location.hash, '#/semaine/2026-10-19/tableau');
  geste(p, 90);
  assert.equal(location.hash, `#/semaine/${S.lundi}/tableau`);
});

test('glisser : un pincement, un départ au bord de l\'écran ou un geste annulé ne feuillettent pas', () => {
  magasin.remplacer(etatVide());
  const p = aDate(S.lundi, () => semaine.rendre(magasin.etat(), S.lundi));
  globalThis.window.innerWidth = 400;
  location.hash = '';
  geste(p, 90, { doigts: 2 });
  assert.equal(location.hash, '', 'deux doigts');
  geste(p, 90, { x: 10 });
  assert.equal(location.hash, '', 'bord gauche');
  geste(p, -90, { x: 390 - 90 + 90 - 0, cible: {} });
  assert.equal(location.hash, '', 'bord droit');
  p.declencher('touchstart', { touches: [{ clientX: 200, clientY: 300 }], target: {} });
  p.declencher('touchcancel', {});
  p.declencher('touchend', { changedTouches: [{ clientX: 100, clientY: 300 }] });
  assert.equal(location.hash, '', 'geste annulé');
  geste(p, -90);
  assert.notEqual(location.hash, '', 'un geste normal feuillette');
  delete globalThis.window.innerWidth;
});

// ---------------------------------------------------------------- Import
function pageImport(etat) { magasin.remplacer(etat); return importation.rendre(magasin.etat(), S.lundi); }

test('Import : glisser change de semaine tant que rien n\'a été saisi', () => {
  const p = pageImport(etatVide());
  location.hash = '';
  geste(p, -90);
  assert.equal(location.hash, `#/import/${S.lundiSuivant}`);
  geste(p, 90);
  assert.equal(location.hash, '#/import/2026-09-28');
});

test('Import : un intitulé tapé ou un texte collé non enregistré empêche de changer de semaine', () => {
  const p = pageImport(etatVide());
  champ(p, `menu-${S.lundi}-1`).value = 'INTITULE_TAPE_TEST';
  location.hash = '';
  geste(p, -90);
  geste(p, 90);
  assert.equal(location.hash, '', 'saisie en cours : on ne change pas de semaine');
  champ(p, `menu-${S.lundi}-1`).value = '';
  champ(p, 'feuille-texte').value = 'Lundi\nTEXTE_COLLE_TEST';
  geste(p, -90);
  assert.equal(location.hash, '', 'texte collé : idem');
  assert.match(dom.corps.tous((x) => x.attributs.id === 'messages')[0].textContent, /Enregistrez ou annulez d'abord/);
});

test('Import : un champ vidé par rapport à l\'enregistré bloque ; un texte repris bloque aussi', () => {
  const e = etatVide();
  menuValide(e, S.lundi, 1, 'INTITULE_ENREGISTRE_TEST');
  const p = pageImport(e);
  champ(p, `menu-${S.lundi}-1`).value = '';
  location.hash = '';
  geste(p, -90);
  assert.equal(location.hash, '', 'champ vidé');
  // Un texte daté de la semaine suivante, collé ici puis réparti : l'écran de cette semaine s'ouvre avec le texte repris.
  const r = pageImport(etatVide());
  champ(r, 'feuille-texte').value = 'Lundi 12 octobre\nA_TEST\nB_TEST\nMardi 13 octobre\nC_TEST\nD_TEST\nMercredi 14 octobre\nE_TEST\nF_TEST';
  r.tous((x) => x.balise === 'button' && x.textContent === 'Répartir dans la semaine')[0].click();
  assert.equal(location.hash, `#/import/${S.lundiSuivant}`);
  const q = importation.rendre(magasin.etat(), S.lundiSuivant);
  location.hash = '';
  geste(q, -90);
  assert.equal(location.hash, '', 'texte repris');
});

test('Import : une semaine déjà enregistrée, non modifiée, se feuillette ; modifiée, non', () => {
  const e = etatVide();
  menuValide(e, S.lundi, 1, 'INTITULE_ENREGISTRE_TEST');
  const p = pageImport(e);
  location.hash = '';
  geste(p, -90);
  assert.equal(location.hash, `#/import/${S.lundiSuivant}`, 'rien de modifié par rapport à l\'enregistré');
  champ(p, `menu-${S.lundi}-1`).value = 'AUTRE_INTITULE_TEST';
  location.hash = '';
  geste(p, -90);
  assert.equal(location.hash, '');
});

// ---------------------------------------------------------------- Articles
function etatArticles() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.lundiSuivant, 1, 10);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_TEST' });
  composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_PROCHAIN_TEST' });
  return e;
}
const pageArticles = (etat, iso) => aDate(iso, () => { magasin.remplacer(etat); return articles.rendre(magasin.etat()); });
const joursAffiches = (p) => classes(p, 'art-jour').map((j) => j.attributs['aria-label']);
const bouton = (p, texte) => p.tous((x) => x.balise === 'button' && x.textContent === texte)[0];

test('Articles : en vue « Aujourd\'hui », glisser passe au jour de production suivant puis précédent, sans sortir de la liste', async () => {
  articles.oublierVue();
  const e = etatArticles();
  const jours = aDate(S.lundi, () => articlesDuPoste(e, S.lundi).jours);
  assert.ok(jours.length >= 2, 'le jeu donne au moins deux jours de production');
  const depart = pageArticles(e, S.lundi);
  await bouton(depart, "Aujourd'hui").click();
  let p = pageArticles(e, S.lundi);
  assert.equal(joursAffiches(p).length, 1);
  assert.match(joursAffiches(p)[0], /aujourd'hui/);
  // Glisser vers la droite au tout début de la liste : on reste sur le jour courant.
  aDate(S.lundi, () => geste(p, 90));
  p = pageArticles(e, S.lundi);
  assert.match(joursAffiches(p)[0], /aujourd'hui/, 'pas de jour avant le premier');
  aDate(S.lundi, () => geste(p, -90, { cible: SUR_UN_CHAMP }));
  p = pageArticles(e, S.lundi);
  assert.match(joursAffiches(p)[0], /aujourd'hui/, 'un geste sur un bouton ne feuillette pas');
  for (let i = 1; i < jours.length; i += 1) {
    aDate(S.lundi, () => geste(p, -90));
    p = pageArticles(e, S.lundi);
    assert.equal(joursAffiches(p).length, 1);
    assert.match(joursAffiches(p)[0], new RegExp(`\\b${Number(jours[i].date.slice(8))}\\b`), 'le jour suivant de la liste');
  }
  aDate(S.lundi, () => geste(p, -90));
  p = pageArticles(e, S.lundi);
  assert.equal(joursAffiches(p).length, 1, 'au dernier jour : on y reste');
  aDate(S.lundi, () => geste(p, 90));
  p = pageArticles(e, S.lundi);
  assert.equal(joursAffiches(p).length, 1);
  articles.oublierVue();
});

test('Articles : un jour glissé devenu périmé (antérieur à aujourd\'hui) est oublié', async () => {
  articles.oublierVue();
  const e = etatArticles();
  let p = pageArticles(e, S.lundi);
  await bouton(p, "Aujourd'hui").click();
  p = pageArticles(e, S.lundi);
  aDate(S.lundi, () => geste(p, -90));
  assert.ok(!/aujourd'hui/.test(joursAffiches(pageArticles(e, S.lundi))[0]), 'on est sur un autre jour');
  const lendemain = aDate('2026-10-06', () => joursAffiches((magasin.remplacer(e), articles.rendre(magasin.etat()))));
  assert.ok(lendemain.length <= 1);
  const apres = aDate('2026-10-12', () => joursAffiches((magasin.remplacer(e), articles.rendre(magasin.etat()))));
  assert.equal(apres.length, 1, 'le jour courant s\'affiche, pas une liste vide');
  assert.match(apres[0], /aujourd'hui/, 'retour au jour courant, pas de jour passé');
  articles.oublierVue();
});

test('Articles : en vue « Semaine », glisser ne change rien (toute la liste est déjà là)', () => {
  articles.oublierVue();
  const e = etatArticles();
  let p = pageArticles(e, S.lundi);
  const avant = joursAffiches(p);
  aDate(S.lundi, () => geste(p, -90));
  p = pageArticles(e, S.lundi);
  assert.deepEqual(joursAffiches(p), avant);
});

// ---------------------------------------------------------------- Détail du jour
test('Détail du jour : glisser change de date et redessine la feuille ; un geste sur un champ, rien', () => {
  magasin.remplacer(etatVide());
  const dialogue = services.ouvrirDetailDuJour(S.lundi);
  const texte = () => dialogue.textContent;
  assert.match(texte(), /Lundi 5 octobre/);
  geste(dialogue, -90, { cible: SUR_UN_CHAMP });
  assert.match(texte(), /Lundi 5 octobre/, 'sur un champ : rien');
  geste(dialogue, -90);
  assert.match(texte(), /Mardi 6 octobre/, 'jour suivant');
  geste(dialogue, 90);
  geste(dialogue, 90);
  assert.match(texte(), /Samedi 3 octobre/, 'le dimanche est sauté');
  for (const d of panneauxOuverts(dom.corps)) d.close();
});

test('Détail du jour : après un changement de jour par glissement, le défilement revient en haut', () => {
  magasin.remplacer(etatVide());
  const dialogue = services.ouvrirDetailDuJour(S.lundi);
  const defilant = classes(dialogue, 'vue-detail')[0].parent.parent;
  defilant.scrollTop = 120;
  geste(dialogue, -90);
  assert.equal(defilant.scrollTop, 0);
  for (const d of panneauxOuverts(dom.corps)) d.close();
});
