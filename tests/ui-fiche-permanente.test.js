// Fiche d'un élément sous faux DOM (v118) : « Corriger le nom », « Voir sa fiche retenue », feuille de clôture par élément, Réglages.
// Ce n'est pas un test dans un navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu } from '../app/js/domaine/actions.js';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatInitial } from '../app/js/domaine/etat.js';
import { retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { h } from './aide.js';

let dom;
let magasin;
let vueFiche;
let cloture;
let apprentissage;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueFiche = await import('../app/js/ui/vue-fiche.js');
  cloture = await import('../app/js/ui/feuille-cloture.js');
  apprentissage = await import('../app/js/ui/section-apprentissage.js');
});
after(() => dom.restaurer());

const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const fermerFeuilles = () => dom.corps.tous((x) => x.balise === 'dialog').forEach((d) => d.remove());
const parNom = (e, nom) => Object.values(e.composants).find((c) => c.nom === nom);

test('fiche : « Corriger le nom » et « Enregistrer » sont là ; plus de « sauce reprise »', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Spaghetti carbonara', h());
  magasin.remplacer(e);
  const page = vueFiche.rendre(magasin.etat(), parNom(magasin.etat(), 'carbonara').id);
  assert.match(page.textContent, /Corriger le nom/);
  assert.ok(parTexte(page, 'Enregistrer'));
  assert.doesNotMatch(page.textContent, /reprise|reconfirmer/);
});

test('fiche : une sauce « à confirmer » sans nom n\'offre pas « Corriger le nom »', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Fusilli al ferretto', h());
  magasin.remplacer(e);
  assert.doesNotMatch(vueFiche.rendre(magasin.etat(), parNom(magasin.etat(), 'sauce à confirmer').id).textContent, /Corriger le nom/);
});

test('fiche : « Voir sa fiche retenue » n\'apparaît que si l\'élément est retenu, et ouvre la petite fiche', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Spaghetti carbonara', h());
  magasin.remplacer(e);
  const id = parNom(magasin.etat(), 'carbonara').id;
  assert.equal(parTexte(vueFiche.rendre(magasin.etat(), id), 'Voir sa fiche retenue'), undefined);
  retenirFiche(e, 'carbonara', { categorie: 'sauce', role: 'sauce' }, h(1));
  magasin.remplacer(e);
  parTexte(vueFiche.rendre(magasin.etat(), id), 'Voir sa fiche retenue').click();
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /carbonara/);
  assert.match(feuille.textContent, /Corriger le nom/);
  fermerFeuilles();
});

test('feuille de clôture : un élément à la fois ou tous les nommés ; la sauce sans nom est listée à part avec « Préciser »', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Gnocchi alla sorrentina', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  magasin.remplacer(e);
  cloture.ouvrirCloture('2026-10-12');
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /Retenir les éléments de la semaine/);
  assert.match(feuille.textContent, /0 élément déjà retenu/);
  assert.ok(parTexte(feuille, 'Retenir les 3 éléments nommés'));
  assert.equal(boutons(feuille).filter((b) => b.textContent === 'Retenir tel quel').length, 3, 'Gnocchi, sorrentina, Fusilli');
  assert.match(feuille.textContent, /sauce à confirmer · sauce à nommer/);
  assert.ok(feuille.tous((x) => x.balise === 'a' && x.textContent === 'Préciser').length === 1);
  assert.ok(feuille.tous((x) => x.balise === 'a' && x.attributs.href === '#/fiches').length === 1, 'lien « Toutes les fiches »');
  parTexte(feuille, 'Retenir tel quel').click();
  assert.equal(Object.keys(magasin.etat().fiches_retenues).length, 1);
  parTexte(panneauxOuverts(dom.corps)[0], 'Retenir les 2 éléments nommés').click();
  assert.deepEqual(Object.keys(magasin.etat().fiches_retenues).sort(), ['fusilli al ferretto', 'gnocchi', 'sorrentina']);
  assert.equal(magasin.etat().plats_retenus, undefined);
  assert.match(panneauxOuverts(dom.corps)[0].textContent, /Tous les éléments nommés de la semaine sont retenus/);
  assert.ok(!boutons(panneauxOuverts(dom.corps)[0]).some((b) => /Retenir les .* nommés/.test(b.textContent)));
  assert.ok(parNom(magasin.etat(), 'sauce à confirmer'), 'rien n\'est inventé');
  fermerFeuilles();
});

test('Réglages > Apprentissage : plus de liste de fiches ni de plats, un lien vers les fiches des éléments', () => {
  const e = etatInitial();
  retenirFiche(e, 'Zorbi', { categorie: 'autre', role: 'garniture' }, h());
  magasin.remplacer(e);
  const sections = apprentissage.sectionsApprentissage(magasin.etat());
  const texte = sections.map((s) => s?.textContent ?? '').join(' ');
  assert.doesNotMatch(texte, /Plats retenus|Fiches retenues par nom/);
  assert.match(texte, /1 fiche d'élément retenue/);
  const lien = sections.flatMap((s) => (s ? s.tous((x) => x.balise === 'a' && x.attributs.href === '#/fiches') : []));
  assert.equal(lien.length, 1);
  assert.match(lien[0].textContent, /Voir les fiches des éléments/);
});
