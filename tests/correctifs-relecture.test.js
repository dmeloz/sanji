// Défauts trouvés par la relecture indépendante, rejoués ici (jeu de test : aucun nom de plat du restaurant n'entre dans app/).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  definirMenu, memoriser, modifierComposant, reprendreMemoire,
} from '../app/js/domaine/actions.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

const parNom = (etat, date, menu, nom) => Object.values(etat.composants).find((c) => c.date === date && c.menu === menu && c.nom.toLowerCase() === nom.toLowerCase());

// ---------------------------------------------------------------- 1. mémoire par menu

test('mémoire : une référence mémorisée en menu 1 ne contamine pas le menu 2 (protéine jamais attribuée par erreur)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Poulet rôti, carottes', h());
  const poulet1 = parNom(e, S.lundi, 1, 'Poulet rôti');
  assert.ok(poulet1, 'le poulet est lu au menu 1');
  memoriser(e, poulet1.id, h(1));
  assert.ok(e.memoire['poulet roti|1'], 'écrit sous la clé nom|menu');
  assert.equal(e.memoire['poulet roti'], undefined, 'plus de clé nom seule');
  definirMenu(e, S.mardi, 2, 'Poulet rôti, carottes', h(2));
  assert.equal(parNom(e, S.mardi, 2, 'Poulet rôti').attribue, false, 'une protéine du menu 2 n\'est pas mise au poste');
});

test('mémoire : une référence maison (grammage) mémorisée en menu 2 est reprise en menu 2, pas en menu 1', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'Riz', h());
  const riz2 = parNom(e, S.lundi, 2, 'Riz');
  modifierComposant(e, riz2.id, { role: 'garniture', grammage: { valeur: 111, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'cuit' } }, h(1));
  memoriser(e, riz2.id, h(2));
  assert.ok(e.memoire['riz|2']);
  definirMenu(e, S.mardi, 2, 'Riz', h(3));
  definirMenu(e, S.mardi, 1, 'Riz', h(4));
  const r2 = parNom(e, S.mardi, 2, 'Riz');
  const r1 = parNom(e, S.mardi, 1, 'Riz');
  modifierComposant(e, r2.id, { role: 'garniture' }, h(5));
  modifierComposant(e, r1.id, { role: 'garniture' }, h(5));
  assert.equal(grammageEffectif(e, e.composants[r2.id]).valeur, 111, 'repris par grammageEffectif en menu 2');
  assert.notEqual(grammageEffectif(e, e.composants[r1.id])?.valeur, 111, 'pas en menu 1');
  assert.ok(reprendreMemoire(e, r2.id, h(6)).champs.includes('grammage'));
  assert.deepEqual(reprendreMemoire(e, r1.id, h(7)), { applique: false, champs: [] });
});

test('mémoire : une entrée nom|menu issue de l\'attribution n\'empêche pas de reprendre le grammage mémorisé', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'Riz', h());
  const riz = parNom(e, S.lundi, 2, 'Riz');
  modifierComposant(e, riz.id, { role: 'garniture', grammage: { valeur: 90, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'cuit' } }, h(1));
  modifierComposant(e, riz.id, { attribue: false }, h(2)); // écrit nom|menu
  memoriser(e, riz.id, h(3));
  definirMenu(e, S.mardi, 2, 'Riz', h(4));
  const autre = parNom(e, S.mardi, 2, 'Riz');
  modifierComposant(e, autre.id, { role: 'garniture' }, h(5));
  assert.ok(reprendreMemoire(e, autre.id, h(6)).champs.includes('grammage'));
});

test('mémoire : repli sur l\'ancienne clé nom, sauf une protéine attribuée au poste en menu 2', () => {
  const e = etatVide();
  e.memoire.poulet = { nom: 'poulet', attribue: true, type: 'a_preciser', categorie: 'proteine', charge: null, parRole: {}, etapes: {} };
  definirMenu(e, S.lundi, 2, 'Poulet, carottes', h());
  assert.equal(parNom(e, S.lundi, 2, 'Poulet').attribue, false);
  definirMenu(e, S.lundi, 1, 'Poulet, carottes', h());
  assert.equal(parNom(e, S.lundi, 1, 'Poulet').attribue, true);
  assert.equal(typeof pointsAConfirmer(e, S.lundi).length, 'number');
});
