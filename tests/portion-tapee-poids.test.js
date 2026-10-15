// Régression v131 : « 240 g de risotto pour 20 personnes ». Le risotto du menu 1 (riz, plat principal) n'a aucun repère de portion :
// la propriétaire tape sa portion. Elle était enregistrée « cuit » et remontée par le gain de cuisson (÷ 2,5) : un riz tapé
// comme du riz SEC (90 g, comme les pâtes) donnait 2,5 fois trop peu. L'état du poids d'une portion tapée suit celui du repère
// validé de la même famille (riz : sec), jamais une valeur inventée.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { correctionDuJour } from '../app/js/domaine/actions-validation.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { etatPortionTapee } from '../app/js/domaine/mise-en-place.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-13';
const PORTION_TAPEE = 90;

function risottoMenu1() {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto aux bolets', h());
  definirMenu(e, JOUR, 2, 'Filet de bar, riz, brocoli', h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  const risotto = Object.values(e.composants).find((c) => c.menu === 1 && c.nom === 'Risotto');
  return { e, id: risotto.id };
}

test('une portion de riz tapée pour un risotto en plat principal est un poids sec : 20 couverts × la portion, sans gain de cuisson', () => {
  const { e, id } = risottoMenu1();
  assert.equal(etatPortionTapee(e, id), 'sec');
  saisirPortionInconnue(e, id, PORTION_TAPEE, h(2));
  assert.equal(grammageEffectif(e, e.composants[id]).etat, 'sec');
  const calcul = calculerComposant(e, id);
  assert.equal(calcul.portions.total, 20);
  assert.equal(calcul.quantiteTravail, 20 * PORTION_TAPEE);
});

test('une famille sans repère ni gain de cuisson garde l\'état du composant (rien n\'est deviné)', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 2, 'Saumon, pommes de terre, fenouil', h());
  const pdt = Object.values(e.composants).find((c) => c.famille === 'pommes_de_terre');
  assert.equal(etatPortionTapee(e, pdt.id), pdt.grammage.etat);
});

// ------------------------------------------------------------------ l'état du poids est CHOISI (v131)

test('saisirPortionInconnue enregistre tel quel l\'état du poids choisi, même contraire à la suggestion', () => {
  for (const choix of ['sec', 'cru_net', 'cuit']) {
    const { e, id } = risottoMenu1();
    saisirPortionInconnue(e, id, PORTION_TAPEE, h(2), choix);
    assert.equal(e.standards.riz.plat_principal.etat, choix);
  }
});

test('saisirPortionInconnue refuse un état du poids inconnu, sans rien écrire', () => {
  const { e, id } = risottoMenu1();
  assert.throws(() => saisirPortionInconnue(e, id, PORTION_TAPEE, h(2), 'tiede'));
  assert.equal(e.standards?.riz, undefined);
});

test('correctionDuJour : sans portion connue, l\'état par défaut est celui du repère de la famille (riz : sec) ; un état passé est gardé', () => {
  const { e, id } = risottoMenu1();
  correctionDuJour(e, id, { valeur: PORTION_TAPEE }, h(2));
  assert.equal(e.composants[id].grammage.etat, 'sec');
  correctionDuJour(e, id, { valeur: PORTION_TAPEE, etat: 'cuit' }, h(3));
  assert.equal(e.composants[id].grammage.etat, 'cuit');
});
