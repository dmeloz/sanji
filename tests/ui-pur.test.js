// Fonctions pures de l'interface : lecture des nombres saisis, formats, routage par hash.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coefficientDepuis, formaterHeure, formaterNombre, horodatageLocal, libelleCoefficient, milieu, modeDepuisCoefficient,
  nomFichierSauvegarde, parseEntier, parseNombre, pluriel, quantite,
} from '../app/js/ui/format.js';
import { analyserHash, ONGLET_DE_VUE, VUES } from '../app/js/ui/routeur.js';

test('parseNombre accepte la virgule française, les espaces et le vide', () => {
  assert.equal(parseNombre('12,5'), 12.5);
  assert.equal(parseNombre(' 1 250 '), 1250);
  assert.equal(parseNombre('0,75'), 0.75);
  assert.equal(parseNombre('3'), 3);
  assert.equal(parseNombre(''), null);
  assert.equal(parseNombre('   '), null);
  assert.equal(parseNombre(null), null);
});

test('parseNombre refuse un texte non numérique avec un message en français', () => {
  assert.throws(() => parseNombre('douze', 'Couverts'), /« Couverts » : nombre invalide/);
  assert.throws(() => parseNombre('1,2,3'), /nombre invalide/);
  assert.throws(() => parseNombre('12abc'), /nombre invalide/);
});

test('parseEntier refuse un décimal', () => {
  assert.equal(parseEntier('40'), 40);
  assert.equal(parseEntier(''), null);
  assert.throws(() => parseEntier('4,5', 'Couverts'), /entier attendu/);
});

test('formaterNombre : virgule française, pas de bruit de virgule flottante, vide pour null', () => {
  assert.equal(formaterNombre(12.5), '12,5');
  assert.equal(formaterNombre(0.1 + 0.2), '0,3');
  assert.equal(formaterNombre(null), '');
  assert.equal(formaterNombre(undefined), '');
  assert.equal(parseNombre(formaterNombre(17.5)), 17.5);
});

test('horodatageLocal : heure locale sans Z ; formaterHeure lisible', () => {
  const h = horodatageLocal(new Date(2026, 9, 2, 8, 5, 9));
  assert.equal(h, '2026-10-02T08:05:09');
  assert.equal(h.endsWith('Z'), false);
  assert.equal(formaterHeure(h), '02/10/2026 à 08:05');
  assert.equal(formaterHeure(null), '');
  assert.ok(!Number.isNaN(Date.parse(h)));
});

test('perte en % et gain × : coefficient = 1 − perte/100, aller-retour', () => {
  assert.equal(coefficientDepuis('perte', 20), 0.8);
  assert.equal(coefficientDepuis('perte', 17.5), 0.825);
  assert.equal(coefficientDepuis('gain', 2.5), 2.5);
  assert.deepEqual(modeDepuisCoefficient(0.825), { mode: 'perte', valeur: 17.5 });
  assert.deepEqual(modeDepuisCoefficient(2.5), { mode: 'gain', valeur: 2.5 });
  assert.equal(libelleCoefficient(0.825), 'perte 17,5 %');
  assert.equal(libelleCoefficient(2.5), 'gain × 2,5');
  assert.equal(libelleCoefficient(1), 'sans perte');
});

test('milieu d\'une fourchette de coefficients', () => {
  assert.equal(milieu(0.8, 0.85), 0.825);
  assert.equal(milieu(2.5, 3), 2.75);
});

test('quantite, pluriel, nom de fichier', () => {
  assert.equal(quantite(null, 'g'), '—');
  assert.equal(quantite(2526.4, 'g'), '2 526 g');
  assert.equal(quantite(12, null), '12');
  assert.equal(pluriel(1, 'jour'), '1 jour');
  assert.equal(pluriel(2, 'jour'), '2 jours');
  assert.equal(nomFichierSauvegarde('2026-10-02'), 'sanji-2026-10-02.json');
});

test('analyserHash : routes, défauts et dates invalides', () => {
  const j = '2026-10-07'; // mercredi
  assert.deepEqual(analyserHash('', j), { vue: 'tableau', param: null }, 'tableau par défaut, semaine choisie par le contexte');
  assert.deepEqual(analyserHash('#/tableau', j), { vue: 'tableau', param: null });
  assert.deepEqual(analyserHash('#/tableau/2026-10-14', j), { vue: 'tableau', param: '2026-10-12' }, 'ramenée au lundi');
  assert.deepEqual(analyserHash('#/tableau/pas-une-date', j), { vue: 'tableau', param: null });
  // Anciennes adresses : elles mènent au tableau.
  assert.deepEqual(analyserHash('#/accueil', j), { vue: 'tableau', param: null });
  assert.deepEqual(analyserHash('#/semaine/2026-10-14', j), { vue: 'tableau', param: '2026-10-12' });
  assert.deepEqual(analyserHash('#/menus', j), { vue: 'menus', param: '2026-10-05' });
  assert.deepEqual(analyserHash('#/menus/2026-10-14', j), { vue: 'menus', param: '2026-10-12' });
  assert.deepEqual(analyserHash('#/jour', j), { vue: 'jour', param: j });
  assert.deepEqual(analyserHash('#/jour/2026-10-10', j), { vue: 'jour', param: '2026-10-10' });
  assert.deepEqual(analyserHash('#/detail/2026-13-45', j), { vue: 'detail', param: j });
  assert.deepEqual(analyserHash('#/produits/2026-10-08', j), { vue: 'produits', param: '2026-10-05' });
  assert.deepEqual(analyserHash('#/composant/comp_1abc', j), { vue: 'composant', param: 'comp_1abc' });
  assert.deepEqual(analyserHash('#/composant', j), { vue: 'tableau', param: null });
  assert.deepEqual(analyserHash('#/reglages', j), { vue: 'reglages', param: null });
  assert.deepEqual(analyserHash('#/inconnu', j), { vue: 'tableau', param: null });
});

test('routeur : chaque vue a un onglet, et le tableau blanc est l\'accueil', () => {
  assert.equal(ONGLET_DE_VUE.tableau, 'tableau');
  assert.equal(ONGLET_DE_VUE.menus, 'tableau');
  for (const vue of Object.keys(VUES)) {
    assert.equal(typeof VUES[vue].rendre, 'function', vue);
    assert.equal(typeof VUES[vue].titre, 'function', vue);
    assert.ok(ONGLET_DE_VUE[vue], `onglet manquant : ${vue}`);
  }
  assert.equal(VUES.tableau.titre(), 'Tableau');
});
