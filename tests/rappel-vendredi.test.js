// Rappel du vendredi (décision du 2026-10-07) : « Menus de la semaine prochaine · à importer » sur Aujourd'hui.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aujourdhuiDe } from '../app/js/domaine/tableau-blanc.js';
import { saisirMenusSemaine } from '../app/js/domaine/actions.js';
import { etatVide, h } from './aide.js';

const VENDREDI = '2026-10-09';
const LUNDI_SUIVANT = '2026-10-12';

test('rappel : le vendredi, une semaine suivante vide donne le rappel vers son lundi', () => {
  assert.deepEqual(aujourdhuiDe(etatVide(), VENDREDI).rappelVendredi, { lundi: LUNDI_SUIVANT });
});

test('rappel : jamais en semaine, ni quand la semaine suivante a déjà un menu', () => {
  for (const jour of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
    assert.equal(aujourdhuiDe(etatVide(), jour).rappelVendredi, null, jour);
  }
  const e = etatVide();
  saisirMenusSemaine(e, LUNDI_SUIVANT, { [LUNDI_SUIVANT]: { menu1: 'Penne au pesto', menu2: 'Sauté de veau, riz' } }, h());
  assert.equal(aujourdhuiDe(e, VENDREDI).rappelVendredi, null);
});

test('rappel : le week-end le rappelle encore, jusqu\'à ce que la semaine soit importée', () => {
  assert.deepEqual(aujourdhuiDe(etatVide(), '2026-10-10').rappelVendredi, { lundi: LUNDI_SUIVANT });
  assert.deepEqual(aujourdhuiDe(etatVide(), '2026-10-11').rappelVendredi, { lundi: LUNDI_SUIVANT });
});
