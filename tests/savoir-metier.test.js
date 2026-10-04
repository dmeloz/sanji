// B-P0 : les six repères de portion validés par la propriétaire le 2026-10-03 (source savoir/reperes-portion/savoir-metier.json,
// module généré donnees/savoir-metier.js), leur effet sur la portion effective, et les deux nouvelles collections d'état.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPERES_VALIDES, VERSION_SAVOIR } from '../app/js/donnees/savoir-metier.js';
import { genererFichier } from '../outils/generer-savoir-metier.mjs';
import { definirStandard, definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { etatInitial, exporter, importer, APPLICATION } from '../app/js/domaine/etat.js';
import { grammageEffectif, lignesStandards } from '../app/js/domaine/savoir.js';
import { LIBELLE_ESTIMATION_A_VALIDER } from '../app/js/domaine/statuts.js';
import { etatVide, h, prevision } from './aide.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

const chemin = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const parNom = (e, nom) => Object.values(e.composants).find((c) => c.nom === nom);
const ligne = (produit, role) => REPERES_VALIDES.find((r) => r.produit === produit && r.role === role);
const menu = (nom, role) => {
  const e = etatVide();
  prevision(e, S.lundi, role === 'plat_principal' ? 1 : 2, 40);
  definirMenu(e, S.lundi, role === 'plat_principal' ? 1 : 2, nom, h());
  const c = parNom(e, nom);
  return { e, c };
};

test('les six repères validés : valeurs, états, unités, statut', () => {
  const attendu = [
    ['pâtes sèches', 'garniture', 'sec', 50, 75, 'g', ['Société Suisse de Nutrition 2024', 'Migusto 2024'], true],
    ['pâtes sèches', 'plat_principal', 'sec', 80, 100, 'g', ['Migusto 2024', 'Swissmilk'], true],
    ['riz', 'garniture', 'sec', 50, 70, 'g', ['Société Suisse de Nutrition 2024', 'Migusto 2024'], true],
    ['légumineuses sèches', 'garniture', 'sec', 60, 70, 'g', ['Société Suisse de Nutrition 2024', 'Migusto 2024'], true],
    ['viande sans os (émincé, escalope, ragoût)', 'plat_principal', 'cru_net', 100, 120, 'g', ['Migusto 2024', 'Swissmilk'], false],
    ['œufs', 'plat_principal', 'cru_net', 2, 3, 'piece', ['Société Suisse de Nutrition 2024', 'GEM-RCN 2015'], false],
  ];
  assert.equal(REPERES_VALIDES.length, 6);
  assert.deepEqual(REPERES_VALIDES.map((r) => [r.produit, r.role, r.etat, r.min, r.max, r.unite, r.sources.map((x) => x.titre), r.appliquee]), attendu);
  for (const r of REPERES_VALIDES) {
    assert.deepEqual([r.validation, r.validePar, r.valideLe], ['valide_chef', 'propriétaire', '2026-10-03']);
  }
  assert.equal(VERSION_SAVOIR, '2026-10-03');
});

test('aucune moyenne n\'est stockée : min et max séparés, rien d\'autre de numérique', () => {
  for (const r of REPERES_VALIDES) {
    assert.ok(r.min < r.max);
    const nombres = Object.entries(r).filter(([, v]) => typeof v === 'number').map(([k]) => k).sort();
    assert.deepEqual(nombres, ['max', 'min'], r.produit);
    assert.equal(Object.hasOwn(r, 'valeur'), false);
  }
});

test('les données générées sont gelées et identiques à ce que produit le générateur', () => {
  const source = JSON.parse(readFileSync(chemin('../savoir/reperes-portion/savoir-metier.json'), 'utf8'));
  assert.equal(readFileSync(chemin('../app/js/donnees/savoir-metier.js'), 'utf8'), genererFichier(source), 'relancer « npm run savoir »');
  assert.match(readFileSync(chemin('../app/js/donnees/savoir-metier.js'), 'utf8'), /^\/\/ FICHIER GÉNÉRÉ : NE PAS ÉDITER/);
  assert.deepEqual(JSON.parse(JSON.stringify(REPERES_VALIDES)), source.reperes);
  assert.ok(Object.isFrozen(REPERES_VALIDES) && Object.isFrozen(REPERES_VALIDES[0]) && Object.isFrozen(REPERES_VALIDES[0].sources[0]));
});

// Adapté le 2026-10-04 (décision « Standards de base ») : un repère validé est un standard de base, utilisé directement
// (milieu de la fourchette, étiqueté « standard de base »), plus « à valider ».
test('pâtes en plat principal, 40 portions : 40 × milieu de 80–100 g = 3 600 g secs, standard de base', () => {
  const { e, c } = menu('pâtes', 'plat_principal');
  const g = grammageEffectif(e, c);
  assert.deepEqual([g.valeur, g.unite, g.etat, g.statut, g.origine, g.repere], [90, 'g', 'sec', 'STANDARD_BASE', 'standard_base', 'valide']);
  assert.equal(g.source, 'standard de base : repère validé par la propriétaire (fourchette 80–100 g, état sec)');
  const calc = calculerComposant(e, c.id);
  assert.equal(calc.quantiteTravail, 3600);
  assert.equal(calc.aValider, false, `jamais « ${LIBELLE_ESTIMATION_A_VALIDER} »`);
  assert.equal(calc.standardBase, true);
});

test('riz en garniture, 40 portions : 40 × milieu de 50–70 g = 2 400 g secs, standard de base', () => {
  const { e, c } = menu('riz', 'garniture');
  const g = grammageEffectif(e, c);
  assert.deepEqual([g.valeur, g.etat, g.statut, g.origine], [60, 'sec', 'STANDARD_BASE', 'standard_base']);
  assert.match(g.source, /fourchette 50–70 g, état sec/);
  const calc = calculerComposant(e, c.id);
  assert.equal(calc.quantiteTravail, 2400);
  assert.equal(calc.aValider, false);
});

test('lignesStandards : le repère validé est proposé à côté du standard, sans en créer un', () => {
  const e = etatVide();
  const riz = lignesStandards(e).find((l) => l.cleFamille === 'riz' && l.role === 'garniture');
  assert.deepEqual([riz.repereBase.min, riz.repereBase.max, riz.repereBase.valide, riz.standard], [50, 70, true, null]);
  assert.equal(riz.repereBase.sources, 'Société Suisse de Nutrition 2024 ; Migusto 2024');
  assert.deepEqual(e.standards, {});
});

test('un standard maison prime sur le repère validé, une correction sur un plat prime sur tout', () => {
  const { e, c } = menu('riz', 'garniture');
  definirStandard(e, 'riz', 'garniture', { valeur: 33, unite: 'g', etat: 'cuit' }, h());
  assert.deepEqual([grammageEffectif(e, c).origine, grammageEffectif(e, c).valeur], ['standard', 33]);
  modifierComposant(e, c.id, { grammage: { valeur: 44, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat: 'sec' } }, h());
  assert.deepEqual([grammageEffectif(e, c).origine, grammageEffectif(e, c).valeur], ['plat', 44]);
});

test('les validés passent avant les repères de la base ; un jeu explicite remplace le défaut', () => {
  const { e, c } = menu('riz', 'garniture');
  const base = { produit: 'riz', role: 'garniture', etat: 'sec', min: 10, max: 20, unite: 'g', texte: '10–20 g' };
  assert.equal(grammageEffectif(e, c, [...REPERES_VALIDES, base]).repere, 'valide');
  assert.deepEqual(['origine', 'repere', 'valeur'].map((k) => grammageEffectif(e, c, [base])[k]), ['standard_base', 'base', 15]);
  assert.equal(grammageEffectif(e, c, []), null);
});

test('viande et œufs : validés mais appliquee:false, non utilisés par le calcul', () => {
  for (const r of [ligne('œufs', 'plat_principal'), ligne('viande sans os (émincé, escalope, ragoût)', 'plat_principal')]) {
    assert.equal(r.appliquee, false);
    assert.equal(r.validation, 'valide_chef');
  }
  assert.equal(ligne('œufs', 'plat_principal').unite, 'piece');
  // Aucune famille ne porte ces libellés : même fournie explicitement, une ligne non appliquée n'est jamais lue par famille,
  // et le jeu par défaut ne la contient pas.
  const { e, c } = menu('poulet', 'plat_principal');
  assert.equal(grammageEffectif(e, c), null);
  const oeufs = menu('œufs', 'plat_principal');
  assert.equal(grammageEffectif(oeufs.e, oeufs.c), null);
  const defaut = lignesStandards(etatInitial()).map((l) => l.repereBase?.produit).filter(Boolean);
  assert.equal(defaut.some((p) => /viande|œufs/.test(p)), false);
});

test('état : lectures et validations existent, survivent à export puis import, un ancien export s\'importe', () => {
  const e = etatInitial();
  assert.deepEqual([e.lectures, e.validations, e.schema], [{}, {}, 1]);
  e.lectures['riz et carottes|1'] = { elements: [{ nom: 'TEST_ONLY' }], ambiguites: [] };
  e.validations['a|2'] = { exemple: 'TEST_ONLY2' };
  const relu = importer(exporter(e, h()));
  assert.deepEqual(relu.lectures, e.lectures);
  assert.deepEqual(relu.validations, e.validations);
  const ancien = JSON.parse(exporter(etatInitial(), h()));
  delete ancien.etat.lectures;
  delete ancien.etat.validations;
  const lu = importer(JSON.stringify({ ...ancien, application: APPLICATION }));
  assert.deepEqual([lu.lectures, lu.validations], [{}, {}]);
});
