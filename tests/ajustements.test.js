// Ajustements de la propriétaire sur les standards de base : état, valeur effective, actions, calcul, hygiène.
// Les nombres de portion viennent du test (TEST_ONLY par nature) ; les standards de base sont lus, jamais recopiés.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { ajusterStandard, revenirAuStandard } from '../app/js/domaine/actions-ajustements.js';
import { ajustementDe, lignesStandardsBase, valeurEffective } from '../app/js/domaine/ajustements.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { standardDeBase } from '../app/js/domaine/standards-base.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision } from './aide.js';

const presque = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

/** Menu 2 « carottes » avec une portion saisie (100 g cuits) ; renvoie [état, id du composant]. */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'carottes', h());
  prevision(e, S.lundi, 2, 40);
  const c = Object.values(e.composants).find((x) => x.famille === 'carottes');
  modifierComposant(e, c.id, { grammage: { valeur: 100, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat: 'cuit' } }, h());
  return [e, c.id];
}

// ---------------------------------------------------------------- état

test('état : collection ajustements vide, schéma inchangé, aller-retour export / import', () => {
  const e = etatInitial();
  assert.deepEqual(e.ajustements, {});
  assert.equal(e.schema, 1);
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  assert.deepEqual(importer(exporter(e, h(1))), e);
  assert.deepEqual(importer(exporter(e, h(1))).ajustements['rendement_parage|carottes'].valeur, 30);
});

test('import : un export sans ajustements se complète ; les entrées invalides et les clés dangereuses sont écartées', () => {
  const doc = (ajustements) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, etat: ajustements === undefined ? {} : { ajustements } });
  assert.deepEqual(importer(doc()).ajustements, {});
  const brut = '{"application":"sanji-entremetier","schema":1,"etat":{"ajustements":{"__proto__":{"valeur":1,"unite":"%"},'
    + '"constructor|x":{"valeur":"12","unite":"%"},"rendement_parage|carottes":{"valeur":12,"unite":"%","le":"2026-10-04T08:00:00","avant":{"valeur":18,"origine":"referentiel"}},'
    + '"a|sans-unite":{"valeur":12},"a|nan":{"valeur":null,"unite":"%"},"sans-barre":{"valeur":1,"unite":"%"},"a|liste":[1]}}}';
  const a = importer(brut).ajustements;
  assert.deepEqual(Object.keys(a), ['rendement_parage|carottes']);
  assert.deepEqual(a['rendement_parage|carottes'], { valeur: 12, unite: '%', le: '2026-10-04T08:00:00', avant: { valeur: 18, origine: 'referentiel' } });
  assert.equal(Object.prototype.polluted, undefined);
  assert.throws(() => importer(doc([1])), /ajustements/);
});

test('import : usage, unité et bornes sont ceux de ajusterStandard ; sinon l\'entrée est écartée', () => {
  const doc = (ajustements) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, etat: { ajustements } });
  const cles = (ajustements) => Object.keys(importer(doc(ajustements)).ajustements).sort();
  const pates = standardDeBase('pates_seches', 'rendement_cuisson');
  assert.equal(pates.unite, 'x', 'le rendement des pâtes est un gain');
  assert.deepEqual(cles({ 'rendement_cuisson|pates_seches': { valeur: 3, unite: '%' } }), [], '3 % de perte ne se lit pas comme un gain : écarté (aurait donné 0,97)');
  assert.deepEqual(cles({ 'rendement_cuisson|pates_seches': { valeur: 2.5, unite: 'x' } }), ['rendement_cuisson|pates_seches']);
  assert.deepEqual(cles({ 'x|constructor': { valeur: 1, unite: '%' }, 'buffet_couvert|riz': { valeur: 5, unite: 'g/couvert' } }), [], 'usage non ajustable');
  assert.deepEqual(cles({ 'rendement_parage|inconnue': { valeur: 10, unite: '%' } }), [], 'sujet sans standard de base');
  assert.deepEqual(cles({ 'rendement_parage|carottes': { valeur: 100, unite: '%' }, 'rendement_parage|poireaux': { valeur: -5, unite: '%' } }), [], 'perte hors de 0 à moins de 100');
  assert.deepEqual(cles({ 'rendement_cuisson|riz': { valeur: 0, unite: 'x' } }), [], 'gain nul');
  assert.deepEqual(cles({ 'conservation|riz': { valeur: -1, unite: 'jours' }, 'conservation|carottes': { valeur: 3, unite: 'h' } }), [], 'négatif ou autre unité');
  assert.deepEqual(cles({ 'temperature|pommes_de_terre': { valeur: -2, unite: '°C' } }), ['temperature|pommes_de_terre'], 'une température peut être négative');
  // Ce que ajusterStandard accepte revient à l'identique par l'import.
  const e = etatVide();
  ajusterStandard(e, 'riz', 'conservation', 3, h());
  ajusterStandard(e, 'regle:stockage_froid', 'temperature', 4, h());
  ajusterStandard(e, 'regle:feculents_legumes_cuits', 'conservation', 2, h());
  assert.deepEqual(importer(exporter(e, h(1))).ajustements, e.ajustements);
});

// ---------------------------------------------------------------- valeur effective et actions

test('valeurEffective : le standard de base sans ajustement, la valeur de la propriétaire avec', () => {
  const e = etatVide();
  const base = standardDeBase('carottes', 'rendement_parage');
  const v0 = valeurEffective(e, 'carottes', 'rendement_parage');
  assert.equal(v0.ajuste, false);
  assert.equal(v0.valeur, base.valeur);
  assert.equal(v0.statut, 'STANDARD_BASE');
  const { ajustement, avertissement } = ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  assert.equal(avertissement, null);
  assert.deepEqual(ajustement.avant, { valeur: base.valeur, origine: base.origine });
  const v1 = valeurEffective(e, 'carottes', 'rendement_parage');
  assert.deepEqual([v1.ajuste, v1.valeur, v1.origine, v1.statut, v1.libelle], [true, 30, 'propriete', 'RESTAURANT_VALIDE', 'votre valeur']);
  presque(v1.coefficient, 0.7);
  assert.equal(v1.base.valeur, base.valeur);
  assert.match(e.journal.at(-1).detail, /rendement_parage\|carottes.*standard de base.*30 % \(votre valeur\)/);
});

test('ajusterStandard : refuse ce qui ne se calcule pas, sans rien écrire', () => {
  const e = etatVide();
  assert.throws(() => ajusterStandard(e, 'carottes', 'rendement_parage', 100, h()), /entre 0 et moins de 100/);
  assert.throws(() => ajusterStandard(e, 'carottes', 'rendement_parage', 'abc', h()), /nombre/);
  assert.throws(() => ajusterStandard(e, 'carottes', 'rendement_parage', Infinity, h()), /nombre/);
  assert.throws(() => ajusterStandard(e, 'carottes', 'buffet_couvert', 5, h()), /ne se règle pas/);
  assert.throws(() => ajusterStandard(e, 'inconnue', 'rendement_parage', 10, h()), /standard de base/);
  assert.throws(() => ajusterStandard(e, 'carottes', 'rendement_parage', 10, 'pas une heure'), /Horodatage/);
  assert.deepEqual(e.ajustements, {});
  assert.deepEqual(e.journal, []);
});

test('revenirAuStandard : supprime l\'ajustement, journalise, et ne fait rien sans ajustement', () => {
  const e = etatVide();
  assert.equal(revenirAuStandard(e, 'carottes', 'rendement_parage', h()), false);
  assert.deepEqual(e.journal, []);
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  assert.equal(revenirAuStandard(e, 'carottes', 'rendement_parage', h(1)), true);
  assert.equal(ajustementDe(e, 'carottes', 'rendement_parage'), null);
  assert.equal(valeurEffective(e, 'carottes', 'rendement_parage').ajuste, false);
  assert.match(e.journal.at(-1).detail, /retour au standard de base/);
});

test('un nouvel ajustement garde le « avant » du standard de base d\'origine', () => {
  const e = etatVide();
  const base = standardDeBase('carottes', 'rendement_parage');
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  ajusterStandard(e, 'carottes', 'rendement_parage', 35, h(1));
  assert.equal(ajustementDe(e, 'carottes', 'rendement_parage').valeur, 35);
  assert.equal(ajustementDe(e, 'carottes', 'rendement_parage').avant.valeur, base.valeur);
});

// ---------------------------------------------------------------- calcul

test('calcul : un ajustement change le brut ; revenir au standard rétablit la valeur de base', () => {
  const [e, id] = monde();
  const base = calculerComposant(e, id);
  assert.equal(base.statut, 'CALCULE');
  assert.equal(base.standardBase, true);
  ajusterStandard(e, 'carottes', 'rendement_parage', 40, h());
  const ajuste = calculerComposant(e, id);
  presque(ajuste.brut, 4000 / 0.6);
  assert.notEqual(Math.round(ajuste.brut), Math.round(base.brut));
  assert.equal(ajuste.etapes.find((x) => x.etape === 'parage').statut, 'RESTAURANT_VALIDE');
  assert.equal(ajuste.standardBase, false, 'plus aucun standard de base dans la chaîne');
  assert.match(ajuste.formule, /÷ 0,60 \(parage\)/);
  revenirAuStandard(e, 'carottes', 'rendement_parage', h(1));
  assert.equal(calculerComposant(e, id).brut, base.brut);
  assert.equal(calculerComposant(e, id).formule, base.formule);
});

test('calcul : une correction du plat passe toujours devant l\'ajustement', () => {
  const [e, id] = monde();
  ajusterStandard(e, 'carottes', 'rendement_parage', 40, h());
  modifierComposant(e, id, { etapes: [{ etape: 'parage', coefficient: 0.5, statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' }] }, h());
  presque(calculerComposant(e, id).brut, 4000 / 0.5);
});

test('calcul : l\'ajustement d\'une famille ne touche pas une autre famille', () => {
  const [e, id] = monde();
  const avant = calculerComposant(e, id).brut;
  ajusterStandard(e, 'poireaux', 'rendement_parage', 50, h());
  assert.equal(calculerComposant(e, id).brut, avant);
});

test('calcul : le rendement de cuisson ajusté (gain) change le brut d\'un féculent', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  const c = Object.values(e.composants).find((x) => x.famille === 'riz');
  modifierComposant(e, c.id, { grammage: { valeur: 100, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat: 'cuit' } }, h());
  const base = standardDeBase('riz', 'rendement_cuisson');
  presque(calculerComposant(e, c.id).brut, 4000 / base.coefficient);
  ajusterStandard(e, 'riz', 'rendement_cuisson', 4, h());
  presque(calculerComposant(e, c.id).brut, 1000);
});

// ---------------------------------------------------------------- hygiène

test('hygiène : au-delà de la limite de référence, l\'action réussit avec un avertissement (prudent_min)', () => {
  const e = etatVide();
  const froid = standardDeBase(null, 'temperature', { regle: 'stockage_froid' });
  assert.equal(froid.sens, 'prudent_min');
  const limite = froid.fourchette.max;
  const ok = ajusterStandard(e, 'regle:stockage_froid', 'temperature', limite - 1, h());
  assert.equal(ok.avertissement, null);
  const trop = ajusterStandard(e, 'regle:stockage_froid', 'temperature', limite + 3, h(1));
  assert.match(trop.avertissement, /au-delà de la limite de référence \(.+\) : à valider avec le plan d'autocontrôle/);
  assert.equal(ajustementDe(e, 'regle:stockage_froid', 'temperature').valeur, limite + 3, 'jamais bloquant');
  assert.match(e.journal.at(-1).detail, /au-delà de la limite de référence/);
  assert.equal(valeurEffective(e, 'regle:stockage_froid', 'temperature').valeur, limite + 3);
});

test('hygiène : prudent_max (cuisson à cœur) avertit en dessous du minimum ; conservation avertit au-delà du maximum', () => {
  const e = etatVide();
  const coeur = standardDeBase(null, 'temperature', { regle: 'cuisson_coeur' });
  assert.equal(coeur.sens, 'prudent_max');
  assert.equal(ajusterStandard(e, 'regle:cuisson_coeur', 'temperature', coeur.fourchette.min + 5, h()).avertissement, null);
  assert.ok(ajusterStandard(e, 'regle:cuisson_coeur', 'temperature', coeur.fourchette.min - 5, h()).avertissement);
  // Une famille dont la fourchette n'est pas un point (le riz a 1–1 : le test ne pourrait pas échouer).
  const leg = standardDeBase('legumineuses', 'conservation');
  assert.ok(leg.fourchette.min < leg.fourchette.max);
  assert.equal(ajusterStandard(e, 'legumineuses', 'conservation', leg.valeur, h()).avertissement, null, 'à la borne prudente : rien');
  assert.ok(ajusterStandard(e, 'legumineuses', 'conservation', leg.valeur + 0.5, h()).avertissement, 'au-delà de la borne prudente : averti');
  assert.ok(ajusterStandard(e, 'legumineuses', 'conservation', leg.fourchette.max + 2, h()).avertissement);
});

test('hygiène : aucun avertissement pour un rendement', () => {
  const e = etatVide();
  assert.equal(ajusterStandard(e, 'carottes', 'rendement_parage', 60, h()).avertissement, null);
});

test('hygiène : pommes de terre, plage 6–10 °C à respecter des deux côtés (sens « plage ») ; valeur par défaut au milieu', () => {
  const e = etatVide();
  const pdt = standardDeBase('pommes_de_terre', 'temperature');
  assert.equal(pdt.sens, 'plage');
  assert.deepEqual([pdt.valeur, pdt.fourchette.min, pdt.fourchette.max], [8, 6, 10]);
  assert.equal(ajusterStandard(e, 'pommes_de_terre', 'temperature', 6, h()).avertissement, null);
  assert.equal(ajusterStandard(e, 'pommes_de_terre', 'temperature', 10, h()).avertissement, null);
  assert.match(ajusterStandard(e, 'pommes_de_terre', 'temperature', 2, h()).avertissement, /au-delà de la limite de référence/);
  assert.ok(ajusterStandard(e, 'pommes_de_terre', 'temperature', 12, h()).avertissement);
  assert.equal(ajustementDe(e, 'pommes_de_terre', 'temperature').valeur, 12, 'jamais bloquant');
});

test('hygiène : la borne prudente compte, pas le maximum de la fourchette (pâtes cuites, légumineuses)', () => {
  const e = etatVide();
  const pates = standardDeBase('pates_seches', 'conservation');
  assert.ok(pates.fourchette.min < pates.fourchette.max, 'fourchette non réduite à un point');
  assert.ok(ajusterStandard(e, 'pates_seches', 'conservation', pates.fourchette.max, h()).avertissement, 'au maximum : averti');
  assert.ok(ajusterStandard(e, 'pates_seches', 'conservation', 3, h()).avertissement, 'entre la borne prudente et le maximum : averti');
  const leg = standardDeBase('legumineuses', 'conservation');
  assert.ok(leg.fourchette.min < leg.fourchette.max);
  assert.ok(ajusterStandard(e, 'legumineuses', 'conservation', leg.fourchette.max, h()).avertissement);
  assert.equal(ajusterStandard(e, 'legumineuses', 'conservation', leg.valeur, h()).avertissement, null, 'à la borne prudente : rien');
});

test('hygiène : la règle générale qui couvre la famille avertit aussi (féculents et légumes cuits : au plus 2 jours)', () => {
  const e = etatVide();
  const regle = standardDeBase(null, 'conservation', { regle: 'feculents_legumes_cuits' });
  assert.equal(regle.valeur, 2);
  assert.ok(ajusterStandard(e, 'pates_seches', 'conservation', 3, h()).avertissement);
  assert.equal(ajusterStandard(e, 'carottes', 'conservation', regle.valeur, h()).avertissement, null);
  assert.match(ajusterStandard(e, 'carottes', 'conservation', regle.valeur + 1, h()).avertissement, /au-delà de la limite de référence/);
  assert.ok(ajusterStandard(e, 'riz', 'conservation', 2, h()).avertissement, 'le riz : borne de 1 jour');
});

// ---------------------------------------------------------------- liste de Réglages

test('lignesStandardsBase : cinq usages, une ligne par sujet, l\'ajustement se voit', () => {
  const e = etatVide();
  const avant = lignesStandardsBase(e);
  assert.deepEqual(avant.map((u) => u.usage), ['rendement_parage', 'rendement_cuisson', 'conservation', 'cuisson_temps', 'temperature']);
  assert.ok(avant.every((u) => u.lignes.length > 0));
  assert.ok(avant.every((u) => new Set(u.lignes.map((l) => l.sujet)).size === u.lignes.length));
  assert.ok(avant.every((u) => u.lignes.every((l) => !l.ajuste)));
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  const ligne = lignesStandardsBase(e)[0].lignes.find((l) => l.sujet === 'carottes');
  assert.equal(ligne.ajuste, true);
  assert.equal(ligne.base.statut, 'STANDARD_BASE');
});
