// Borne haute d'une portion : la même dans le domaine (saisie de Production et de « Préparer la semaine »).
import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard } from '../app/js/domaine/actions.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { correctionDuJour } from '../app/js/domaine/actions-validation.js';
import { PORTION_MAX_G } from '../app/js/domaine/savoir.js';
import { etatVide, h } from './aide.js';

function risotto() {
  const e = etatVide();
  definirMenu(e, '2026-10-13', 1, 'Risotto aux bolets', h());
  return { e, id: Object.values(e.composants).find((c) => c.nom === 'Risotto').id };
}

test('la borne est 2000 g', () => assert.equal(PORTION_MAX_G, 2000));

test('une portion tapée trop grande est refusée en clair, rien n\'est enregistré', () => {
  const { e, id } = risotto();
  assert.throws(() => saisirPortionInconnue(e, id, 1e9, h(1), 'sec'), /Portion trop grande : au plus 2000 g par portion\./);
  assert.throws(() => saisirPortionInconnue(e, id, 8000, h(1), 'sec'), /Portion trop grande/);
  assert.deepEqual(e.standards, {});
});

test('la borne elle-même est acceptée', () => {
  const { e, id } = risotto();
  saisirPortionInconnue(e, id, PORTION_MAX_G, h(1), 'sec');
});

test('correctionDuJour et definirStandard refusent aussi une portion trop grande', () => {
  const { e, id } = risotto();
  assert.throws(() => correctionDuJour(e, id, { valeur: 8000, etat: 'sec' }, h(1)), /Portion trop grande/);
  assert.throws(() => definirStandard(e, 'riz', 'plat_principal', { valeur: 8000, unite: 'g', etat: 'sec' }, h(1)), /Portion trop grande/);
});
