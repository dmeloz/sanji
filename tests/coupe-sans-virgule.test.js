// Coupure protéine / garniture quand l'intitulé n'a pas de virgule (« Suprême de volaille risotto »).
// Reprise de Kōzō, 2026-10-03, en plus prudent : jamais de coupure après un mot de liaison ni dans une forme « de ».

import test from 'node:test';
import assert from 'node:assert/strict';
import { proposerComposants } from '../app/js/domaine/analyse-menu.js';

const noms = (intitule, menu = 1) => proposerComposants(intitule, menu).map((c) => c.nom);

test('coupure : une protéine suivie directement d\'un féculent ou d\'un légume connu se coupe', () => {
  assert.deepEqual(noms('Suprême de volaille risotto'), ['Suprême de volaille', 'risotto']);
  assert.deepEqual(noms('Escalope pommes frites'), ['Escalope', 'pommes frites']);
  assert.deepEqual(noms('Poulet rôti carottes, riz'), ['Poulet rôti', 'carottes', 'riz']);
});

test('coupure : jamais après un mot de liaison, dans une forme « de », ni quand le plat commence par la garniture', () => {
  assert.deepEqual(noms('Poulet au riz'), ['Poulet au riz']);
  assert.deepEqual(noms('Poulet rôti sauce aux carottes'), ['Poulet rôti sauce aux carottes']);
  assert.deepEqual(noms('Tagliatelle de courgette'), ['Tagliatelle de courgette']);
  assert.deepEqual(noms('Pâtes aux poireaux'), ['Pâtes aux poireaux']);
  assert.deepEqual(noms('Risotto aux courgettes'), ['Risotto aux courgettes']);
  assert.deepEqual(noms('Saumon sauce vierge tomates'), ['Saumon sauce vierge tomates'], 'tomates n\'a pas de famille : rien n\'est deviné');
});

test('coupure : les intitulés déjà séparés par des virgules ne changent pas, et le menu 2 garde sa règle d\'attribution', () => {
  assert.deepEqual(noms('poulet, riz, carottes'), ['poulet', 'riz', 'carottes']);
  const menu2 = proposerComposants('Suprême de volaille risotto', 2);
  assert.deepEqual(menu2.map((c) => [c.nom, c.attribue]), [['Suprême de volaille', false], ['risotto', true]]);
});
