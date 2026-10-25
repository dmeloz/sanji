// v134, côté interface : plus aucun créneau ni semaine type à l'écran. Chaque écran principal est rendu sur un état peuplé neuf
// (jeu TEST_ONLY) et ne doit pas contenir ces mots ; la feuille « Planifier » accepte une date seule et refuse un dimanche
// avec le message du domaine. Faux DOM : ni mise en page ni IndexedDB.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importer } from '../app/js/domaine/etat.js';
import { figerHorloge, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { detailDuJour } from './aide-detail.js';

const AUJOURD = '2026-10-12'; // lundi de la seconde semaine du jeu peuplé
const peuple = () => importer(readFileSync(new URL('./jeux/TEST_ONLY-etat-peuple.json', import.meta.url), 'utf8'), AUJOURD);
const INTERDIT = /cr[ée]neau|semaine type|jour off|capacit[ée] par/i;

let dom; let magasin; let routeur; let vues; let feuilleServices; let taches; let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(AUJOURD);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vues = { detail: await import('../app/js/ui/vue-detail.js'), tableau: await import('../app/js/ui/vue-tableau.js') };
  feuilleServices = await import('../app/js/ui/feuille-services.js');
  taches = await import('../app/js/ui/taches.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const fermerTout = () => { for (const d of panneauxOuverts(dom.corps)) { d.close(); d.remove(); } };
const page = (hash) => { const { vue, param, sous } = routeur.analyserHash(hash, AUJOURD); return routeur.VUES[vue].rendre(magasin.etat(), param, sous); };

test('écrans principaux : aucun mot « créneau » ni « semaine type » sur un état peuplé neuf', () => {
  magasin.remplacer(peuple());
  const routes = ['#/aujourdhui', '#/production', `#/production/${AUJOURD}`, '#/semaine', `#/semaine/${AUJOURD}/tableau`, '#/articles', '#/reglages', '#/reglages/organisation'];
  for (const r of routes) assert.doesNotMatch(page(r).textContent, INTERDIT, r);
  assert.doesNotMatch(vues.tableau.rendre(magasin.etat(), AUJOURD).textContent, INTERDIT, 'tableau de la semaine');
  assert.doesNotMatch(detailDuJour(vues.detail, magasin.etat(), AUJOURD).textContent, INTERDIT, 'détail du jour');
  assert.equal(detailDuJour(vues.detail, magasin.etat(), AUJOURD).tous((x) => x.attributs.id === 'creneaux').length, 0, 'plus de section créneaux');
});

test('feuille Services puis Détail du jour : rubriques sans « Créneaux du jour »', async () => {
  fermerTout();
  magasin.remplacer(peuple());
  feuilleServices.ouvrirServices(AUJOURD);
  const services = panneauxOuverts(dom.corps).at(-1);
  assert.doesNotMatch(services.textContent, INTERDIT);
  await services.tous((x) => x.balise === 'button' && x.textContent === 'Détail du jour')[0].click();
  const detail = panneauxOuverts(dom.corps).at(-1);
  assert.doesNotMatch(detail.textContent, INTERDIT);
  fermerTout();
});

test('feuille Planifier : une date seule suffit ; un dimanche est refusé avec le message du domaine ; « Remettre à planifier »', async () => {
  fermerTout();
  magasin.remplacer(peuple());
  const prod = Object.values(magasin.etat().productions).find((p) => p.genre === 'principale' && p.etat !== 'fait' && p.dateService > AUJOURD && !p.jourDecide);
  assert.ok(prod, 'le jeu peuplé a une production à planifier');
  taches.dialogPlanifier(prod.id, 'planifier');
  const d = panneauxOuverts(dom.corps)[0];
  assert.doesNotMatch(d.textContent, INTERDIT);
  assert.match(d.textContent, /Jour/);
  assert.match(d.textContent, /Service : /);
  assert.equal(d.tous((x) => x.balise === 'select').length, 0, 'aucun choix de créneau');
  const champ = d.tous((x) => x.balise === 'input' && x.getAttribute('type') === 'date')[0];
  assert.ok(champ, 'un champ date');
  const erreurs = () => d.tous((x) => x.attributs.role === 'alert' && !x.hidden).map((x) => x.textContent);
  champ.value = '2026-10-18'; // dimanche
  await d.querySelector('form').declencher('submit');
  assert.deepEqual(erreurs(), ['Le dimanche est un jour non travaillé : aucune tâche.']);
  assert.equal(magasin.etat().productions[prod.id].jourDecide, null, 'rien n\'est enregistré');
  champ.value = prod.dateService;
  await d.querySelector('form').declencher('submit');
  assert.equal(magasin.etat().productions[prod.id].jourDecide, prod.dateService, 'la date seule est enregistrée');
  assert.equal(d.open, false);
  fermerTout();
  taches.dialogPlanifier(prod.id, 'reporter');
  const r = panneauxOuverts(dom.corps)[0];
  assert.match(r.textContent, /Remettre à planifier/);
  await r.tous((x) => x.balise === 'button' && x.textContent === 'Remettre à planifier')[0].click();
  assert.equal(magasin.etat().productions[prod.id].jourDecide, null);
  fermerTout();
});
