import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoriePropose, proposerComposants } from '../app/js/domaine/analyse-menu.js';

const noms = (r) => r.map((c) => c.nom);

test('découpe sur virgule, accompagné de, sur lit de ; « et », « & », « avec » ne séparent pas', () => {
  const r = proposerComposants('riz, carottes accompagné de pâtes sur lit de salade', 1);
  assert.deepEqual(noms(r), ['riz', 'carottes', 'pâtes', 'salade']);
  // Dans un menu réel, « et » relie les éléments d'un même plat : un seul composant.
  assert.deepEqual(noms(proposerComposants('riz et carottes & poulet avec jus', 1)), ['riz et carottes & poulet avec jus']);
  assert.deepEqual(noms(proposerComposants('riz et carottes, poulet', 2)), ['riz et carottes', 'poulet']);
  assert.deepEqual(noms(proposerComposants('  riz ,, carottes  ', 1)), ['riz', 'carottes']);
  assert.deepEqual(proposerComposants('', 1), []);
  assert.deepEqual(proposerComposants(null, 2), []);
  // « et » et « avec » ne coupent pas un mot.
  assert.deepEqual(noms(proposerComposants('PRODUIT_SEC_TEST', 1)), ['PRODUIT_SEC_TEST']);
});

test('l\'intitulé est conservé tel que saisi (casse, accents)', () => {
  assert.deepEqual(noms(proposerComposants('Carottes Rôties', 1)), ['Carottes Rôties']);
});

test('menu 1 : tout attribué ; menu 2 : seulement légumes et féculents', () => {
  const m1 = proposerComposants('riz, carottes, poulet, sauce TEST, ELEMENT_INCONNU_TEST', 1);
  assert.ok(m1.every((c) => c.attribue === true));
  const m2 = proposerComposants('riz, carottes, poulet, sauce TEST, ELEMENT_INCONNU_TEST', 2);
  assert.deepEqual(m2.map((c) => [c.nom, c.categorie, c.attribue]), [
    ['riz', 'feculent', true], ['carottes', 'legume', true], ['poulet', 'proteine', false],
    ['sauce TEST', 'sauce', false], ['ELEMENT_INCONNU_TEST', 'a_preciser', false],
  ]);
});

test('jamais validé, type à préciser', () => {
  for (const c of proposerComposants('riz, carottes', 1)) {
    assert.equal(c.type, 'a_preciser');
    assert.equal('valide' in c, false);
    assert.equal(c.depuisMemoire, undefined);
  }
});

test('la mémoire (exception mémorisée) prime sur le lexique et le menu', () => {
  const memoire = { poulet: { attribue: true, categorie: 'proteine' }, riz: { attribue: false, categorie: 'autre' } };
  const m2 = proposerComposants('Poulet, riz, carottes', 2, memoire);
  assert.deepEqual(m2[0], { nom: 'Poulet', categorie: 'proteine', attribue: true, type: 'a_preciser', depuisMemoire: true });
  assert.deepEqual(m2[1], { nom: 'riz', categorie: 'autre', attribue: false, type: 'a_preciser', depuisMemoire: true });
  assert.equal(m2[2].depuisMemoire, undefined);
  // Pas d'injection par un nom spécial.
  assert.doesNotThrow(() => proposerComposants('constructor, __proto__', 1, {}));
});

test('catégories : pluriels, accents, multi-mots, ambiguïtés laissées au chef', () => {
  assert.equal(categoriePropose('Pommes de terre'), 'feculent');
  assert.equal(categoriePropose('haricots verts'), 'legume');
  assert.equal(categoriePropose('haricots blancs'), 'feculent');
  // Un mot de forme suivi de « de » laisse décider le produit nommé ensuite.
  assert.equal(categoriePropose('Purée de carottes'), 'legume');
  assert.equal(categoriePropose('purée de pommes de terre'), 'feculent');
  assert.equal(categoriePropose('purée'), 'feculent');
  assert.equal(categoriePropose('tagliatelle de légumes'), 'legume');
  assert.equal(categoriePropose('tagliatelles'), 'feculent');
  assert.equal(categoriePropose('croquettes de poisson'), 'proteine');
  // Le premier mot reconnu décide.
  assert.equal(categoriePropose('sauce poulet'), 'sauce');
  assert.equal(categoriePropose('poulet sauce curry'), 'proteine');
  assert.equal(categoriePropose('riz et carottes'), 'feculent');
  // À position égale, l'expression la plus longue l'emporte.
  assert.equal(categoriePropose('côte de bettes'), 'legume');
  assert.equal(categoriePropose('côte de porc'), 'proteine');
  assert.equal(categoriePropose('pomme mousseline'), 'feculent');
  assert.equal(categoriePropose('pommes vapeur'), 'feculent');
  assert.equal(categoriePropose('pommes'), 'a_preciser'); // fruit ou pomme de terre : on ne devine pas
  assert.equal(categoriePropose('ELEMENT_INCONNU_TEST'), 'a_preciser');
  assert.equal(categoriePropose('priz'), 'a_preciser'); // pas de correspondance dans un mot
});

test('le lexique ne contient aucun chiffre', () => {
  // Le lexique vit dans savoir.js (un seul lexique pour l'application) : groupes, familles et mots sans famille.
  const src = readFileSync(new URL('../app/js/domaine/savoir.js', import.meta.url), 'utf8');
  const bloc = src.slice(src.indexOf('export const GROUPES'), src.indexOf('// Mots de forme'));
  assert.ok(bloc.length > 200);
  assert.equal(/\d/.test(bloc), false);
});
