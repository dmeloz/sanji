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
  const lundi = '2026-10-05';
  assert.deepEqual(analyserHash('', j), { vue: 'aujourdhui', param: null }, 'Aujourd\'hui par défaut');
  assert.deepEqual(analyserHash('#/aujourdhui', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/production', j), { vue: 'production', param: j });
  assert.deepEqual(analyserHash('#/production/2026-10-10', j), { vue: 'production', param: '2026-10-10' });
  assert.deepEqual(analyserHash('#/production/2026-13-45', j), { vue: 'production', param: j }, 'date invalide : aujourd\'hui');
  assert.deepEqual(analyserHash('#/semaine', j), { vue: 'semaine', param: null }, 'sans date : tableau de la semaine');
  assert.deepEqual(analyserHash('#/semaine/2026-10-14', j), { vue: 'semaine', param: '2026-10-14' }, 'avec date : détail du jour');
  assert.deepEqual(analyserHash('#/semaine/pas-une-date', j), { vue: 'semaine', param: null });
  assert.deepEqual(analyserHash('#/semaine/2026-10-14/tableau', j), { vue: 'semaine', param: '2026-10-12', sous: 'tableau' }, 'ramenée au lundi');
  assert.deepEqual(analyserHash('#/stock', j), { vue: 'stock', param: lundi, sous: 'achats' });
  for (const sous of ['restes', 'dlc', 'achats']) {
    assert.deepEqual(analyserHash(`#/stock/${sous}`, j), { vue: 'stock', param: lundi, sous });
    assert.deepEqual(analyserHash(`#/stock/${sous}/2026-10-14`, j), { vue: 'stock', param: '2026-10-12', sous });
  }
  assert.deepEqual(analyserHash('#/stock/2026-10-14', j), { vue: 'stock', param: '2026-10-12', sous: 'achats' });
  assert.deepEqual(analyserHash('#/stock/inconnu', j), { vue: 'stock', param: lundi, sous: 'achats' });
  assert.deepEqual(analyserHash('#/fiche/comp_1abc', j), { vue: 'fiche', param: 'comp_1abc' });
  assert.deepEqual(analyserHash('#/fiche', j), { vue: 'aujourdhui', param: null }, 'fiche sans identifiant : accueil');
  assert.deepEqual(analyserHash('#/poste/comp_1abc', j), { vue: 'poste', param: 'comp_1abc' });
  assert.deepEqual(analyserHash('#/poste', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/import', j), { vue: 'import', param: lundi });
  assert.deepEqual(analyserHash('#/import/2026-10-14', j), { vue: 'import', param: '2026-10-12' });
  assert.deepEqual(analyserHash('#/reglages', j), { vue: 'reglages', param: null });
  for (const c of ['standards', 'organisation', 'produits', 'donnees']) assert.deepEqual(analyserHash(`#/reglages/${c}`, j), { vue: 'reglages', param: c });
  assert.deepEqual(analyserHash('#/reglages/inconnue', j), { vue: 'reglages', param: null }, 'clé inconnue : racine');
  assert.deepEqual(analyserHash('#/inconnu', j), { vue: 'aujourdhui', param: null }, 'route inconnue : accueil');
});

test('analyserHash : les anciennes adresses sont redirigées sans casse', () => {
  const j = '2026-10-07';
  assert.deepEqual(analyserHash('#/accueil', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/tableau', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/tableau/pas-une-date', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/tableau/2026-10-14', j), { vue: 'semaine', param: '2026-10-12', sous: 'tableau' });
  assert.deepEqual(analyserHash('#/jour', j), { vue: 'production', param: j });
  assert.deepEqual(analyserHash('#/jour/2026-10-10', j), { vue: 'production', param: '2026-10-10' });
  assert.deepEqual(analyserHash('#/detail/2026-10-10', j), { vue: 'semaine', param: '2026-10-10' });
  assert.deepEqual(analyserHash('#/detail/2026-13-45', j), { vue: 'semaine', param: j });
  assert.deepEqual(analyserHash('#/produits/2026-10-08', j), { vue: 'stock', param: '2026-10-05', sous: 'achats' });
  assert.deepEqual(analyserHash('#/produits', j), { vue: 'stock', param: '2026-10-05', sous: 'achats' });
  assert.deepEqual(analyserHash('#/composant/comp_1abc', j), { vue: 'fiche', param: 'comp_1abc' });
  assert.deepEqual(analyserHash('#/composant', j), { vue: 'aujourdhui', param: null });
  assert.deepEqual(analyserHash('#/menus', j), { vue: 'import', param: '2026-10-05' });
  assert.deepEqual(analyserHash('#/menus/2026-10-14', j), { vue: 'import', param: '2026-10-12' });
});

test('routeur : chaque vue a un onglet, quatre onglets, Aujourd\'hui est l\'accueil', () => {
  assert.equal(ONGLET_DE_VUE.aujourdhui, 'aujourdhui');
  assert.equal(ONGLET_DE_VUE.import, 'semaine');
  assert.equal(ONGLET_DE_VUE.fiche, 'production');
  for (const vue of Object.keys(VUES)) {
    assert.equal(typeof VUES[vue].rendre, 'function', vue);
    assert.equal(typeof VUES[vue].titre, 'function', vue);
    assert.ok(ONGLET_DE_VUE[vue], `onglet manquant : ${vue}`);
  }
  assert.equal(VUES.aujourdhui.titre(), 'Aujourd\'hui');
  assert.deepEqual([...new Set(Object.values(ONGLET_DE_VUE))].sort(), ['aujourdhui', 'production', 'semaine', 'stock']);
});
