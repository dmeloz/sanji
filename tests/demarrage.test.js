// Démarrage et routeur : jamais une page muette sur « Chargement… », adresse mal formée tolérée, titre de page à jour.
// Faux DOM : pas de navigateur (le blocage réel d'IndexedDB et le focus se vérifient à l'écran).

import test from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';
import { afficherEchecDemarrage, attendreAuPlus } from '../app/js/main.js';
import { analyserHash } from '../app/js/ui/routeur.js';

test('attendreAuPlus : rend la valeur d\'une promesse assez rapide', async () => {
  assert.equal(await attendreAuPlus(Promise.resolve('LU'), 1000, 'trop long'), 'LU');
});

test('attendreAuPlus : une promesse qui ne répond jamais est rejetée avec la raison donnée', async () => {
  await assert.rejects(attendreAuPlus(new Promise(() => {}), 20, 'lecture bloquée'), /lecture bloquée/);
});

test('attendreAuPlus : l\'erreur d\'une promesse rapide est transmise telle quelle', async () => {
  await assert.rejects(attendreAuPlus(Promise.reject(new Error('base cassée')), 1000, 'trop long'), /base cassée/);
});

test('afficherEchecDemarrage : remplace « Chargement… » par la cause, la consigne et un bouton « Recharger »', () => {
  const dom = installerFauxDom();
  try {
    const racine = globalThis.document.createElement('main');
    afficherEchecDemarrage(racine, new Error('lecture trop longue'));
    assert.match(racine.textContent, /Sanji n'a pas pu démarrer : lecture trop longue/);
    assert.match(racine.textContent, /Fermez les autres fenêtres Sanji/);
    assert.doesNotMatch(racine.textContent, /Chargement/);
    assert.deepEqual(boutons(racine).map((b) => b.textContent), ['Recharger']);
  } finally { dom.restaurer(); }
});

test('afficherEchecDemarrage : une erreur sans message ne produit pas « undefined »', () => {
  const dom = installerFauxDom();
  try {
    const racine = globalThis.document.createElement('main');
    afficherEchecDemarrage(racine, undefined);
    assert.match(racine.textContent, /cause inconnue/);
    assert.doesNotMatch(racine.textContent, /undefined/);
  } finally { dom.restaurer(); }
});

test('analyserHash : une adresse mal formée (« %E0 ») ne fait pas échouer le routeur et mène à l\'accueil', () => {
  const aujourd = '2026-10-06';
  assert.deepEqual(analyserHash('#/fiche/%E0', aujourd), analyserHash('#/inconnue', aujourd));
  assert.doesNotThrow(() => analyserHash('#/production/%E0%A4%A', aujourd));
  assert.equal(analyserHash('#/production/%E0', aujourd).param, aujourd, 'date illisible : repli sur aujourd\'hui');
});

test('routeur : le titre du document suit la page affichée', async () => {
  const dom = installerFauxDom();
  try {
    const zone = globalThis.document.createElement('div');
    zone.setAttribute('id', 'vue');
    dom.corps.appendChild(zone);
    const magasin = await import('../app/js/magasin.js');
    const routeur = await import('../app/js/ui/routeur.js');
    magasin.remplacer(etatVide());
    globalThis.location.hash = '#/aujourdhui';
    routeur.rendre();
    assert.equal(globalThis.document.title, 'Aujourd\'hui — Sanji');
    globalThis.location.hash = '#/stock/restes';
    routeur.rendre();
    assert.match(globalThis.document.title, /^Stock.* — Sanji$/);
  } finally { dom.restaurer(); }
});
