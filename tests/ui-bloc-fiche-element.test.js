// Bloc « Fiche de l'élément » sur la fiche technique d'un élément au poste (v118) : les 4 choix, le choix actuel écrit, « Retenir la fiche ».
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { etatInitial } from '../app/js/domaine/etat.js';
import { h } from './aide.js';

let dom; let magasin; let vueFiche; let vueFiches;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueFiche = await import('../app/js/ui/vue-fiche.js');
  vueFiches = await import('../app/js/ui/vue-fiches-elements.js');
});
after(() => dom.restaurer());

const parNom = (e, nom) => Object.values(e.composants).find((c) => c.nom === nom);
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t || b.textContent.startsWith(`${t} ·`));
const bloc = (p) => p.tous((x) => x.attributs['aria-label'] === 'Fiche de l\'élément')[0];
const ouvrir = (nom) => vueFiche.rendre(magasin.etat(), parNom(magasin.etat(), nom).id);
function charger(intitule, menu = 1) {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', menu, intitule, h());
  magasin.remplacer(e);
}

test('bloc présent sur un élément au poste déjà lu : 4 choix, choix actuel écrit et pressé, « Retenir la fiche » principal', () => {
  charger('Spaghetti carbonara');
  const b = bloc(ouvrir('carbonara'));
  assert.ok(b);
  for (const t of ['Forme de pâtes', 'Sauce', 'Produit', 'Garniture']) assert.ok(parTexte(b, t), t);
  assert.match(parTexte(b, 'Sauce').textContent, /actuel/);
  assert.equal(parTexte(b, 'Sauce').attributs['aria-pressed'], 'true');
  assert.equal(parTexte(b, 'Produit').attributs['aria-pressed'], 'false');
  assert.ok(parTexte(b, 'Retenir la fiche'));
});

test('« Retenir la fiche » retient avec la catégorie courante ; ensuite « Voir sa fiche retenue » remplace le bouton ; la page la liste', () => {
  charger('Spaghetti carbonara');
  parTexte(bloc(ouvrir('carbonara')), 'Retenir la fiche').click();
  assert.equal(magasin.etat().fiches_retenues.carbonara.categorie, 'sauce');
  const b = bloc(ouvrir('carbonara'));
  assert.equal(parTexte(b, 'Retenir la fiche'), undefined);
  assert.ok(parTexte(b, 'Voir sa fiche retenue'));
  assert.match(vueFiches.rendre(magasin.etat()).textContent, /Sauces · 1/);
});

test('un choix classe l\'élément ET retient sa fiche, sans le sortir du poste', () => {
  charger('Boulgour', 2);
  parTexte(bloc(ouvrir('Boulgour')), 'Garniture').click();
  const c = parNom(magasin.etat(), 'Boulgour');
  assert.equal(c.attribue, true);
  assert.equal(magasin.etat().fiches_retenues.boulgour.role, 'garniture');
  assert.match(parTexte(bloc(ouvrir('Boulgour')), 'Garniture').textContent, /actuel/);
  parTexte(bloc(ouvrir('Boulgour')), 'Produit').click();
  assert.match(parTexte(bloc(ouvrir('Boulgour')), 'Produit').textContent, /actuel/);
  assert.match(vueFiches.rendre(magasin.etat()).textContent, /Produits · 1/);
});

test('bloc absent hors poste', () => {
  charger('Côtes de bette à la crème', 2);
  assert.equal(parNom(magasin.etat(), 'crème').attribue, false);
  assert.equal(bloc(ouvrir('crème')), undefined);
});

test('élément « à préciser » : un seul bloc de choix (celui d\'enseigner), jamais « Retenir la fiche »', () => {
  charger('Gnocchi alla sorrentina');
  const p = ouvrir('sorrentina');
  assert.equal(bloc(p), undefined);
  assert.equal(parTexte(p, 'Retenir la fiche'), undefined);
  assert.equal(p.tous((x) => x.className === 'enseigner').length, 1);
});
