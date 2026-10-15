// Garde-fou des quantités à produire, par catégorie et par rôle (v131, signalement « 240 g de risotto pour 20 personnes »).
// Les valeurs attendues viennent des standards de base RÉELS (repères validés lus dans savoir/reperes-portion, coefficients de
// `standardDeBase`), jamais d'une valeur de restaurant écrite ici : portion × 20 couverts ÷ coefficients des étapes appliquées.
// Les quantités gelées de la v118 (tests/jeux/TEST_ONLY-calculs-v118.js) attestent qu'aucun calcul n'a dérivé depuis.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { definirMenu, definirStandard } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { FAMILLES } from '../app/js/domaine/savoir.js';
import { standardDeBase } from '../app/js/domaine/standards-base.js';
import { CALCULS_V118 } from './jeux/TEST_ONLY-calculs-v118.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-13';
const COUVERTS = 20;
const PORTION_MAISON = 100;
const TOLERANCE = 0.001;
const REPERES = JSON.parse(readFileSync(new URL('../savoir/reperes-portion/savoir-metier.json', import.meta.url), 'utf8')).reperes;
const FAMILLE_DU_REPERE = { 'pâtes sèches': 'pates_seches', riz: 'riz', 'légumineuses sèches': 'legumineuses' };
const MENU_DU_ROLE = { garniture: 2, plat_principal: 1 };

/** 20 couverts tous au menu du rôle ; renvoie le calcul du composant de cette famille et de ce rôle. */
function calculDe(famille, role, standard = null) {
  const e = etatVide();
  const menu = MENU_DU_ROLE[role];
  const nom = famille.mots[0];
  definirMenu(e, JOUR, menu, menu === 1 ? nom : `Filet de bar, ${nom}`, h());
  definirCouvertsMidi(e, JOUR, { total: COUVERTS, repartition: menu === 1 ? { 1: COUVERTS, 2: 0 } : { 1: 0, 2: COUVERTS } }, h(1));
  if (standard) definirStandard(e, famille.cle, role, { valeur: PORTION_MAISON, unite: 'g', etat: standard }, h(2));
  const c = Object.values(e.composants).find((x) => x.famille === famille.cle && x.menu === menu && x.role === role);
  return c ? calculerComposant(e, c.id) : null;
}

const coefficient = (famille, etape) => standardDeBase(famille, `rendement_${etape}`)?.coefficient ?? 1;

// ------------------------------------------------------------------ 1. repères de portion validés (pâtes, riz, légumineuses)

for (const repere of REPERES.filter((r) => FAMILLE_DU_REPERE[r.produit] && r.appliquee)) {
  const famille = FAMILLES.find((f) => f.cle === FAMILLE_DU_REPERE[repere.produit]);
  test(`${repere.produit} (${repere.role}) : ${COUVERTS} couverts × milieu du repère validé ${repere.min}–${repere.max} g ${repere.etat}`, () => {
    const calcul = calculDe(famille, repere.role);
    assert.equal(calcul.statut, 'CALCULE');
    assert.equal(calcul.unite, repere.unite);
    assert.ok(Math.abs(calcul.quantiteTravail - COUVERTS * (repere.min + repere.max) / 2) < TOLERANCE, `reçu ${calcul.quantiteTravail}`);
    // Poids sec : aucune étape de cuisson n'est remontée (le repère est déjà une quantité d'avant cuisson).
    assert.equal(calcul.etapes.every((x) => !x.appliquee || x.etape === 'parage'), true);
  });
}

// ------------------------------------------------------------------ 2. chaque famille : standard maison × couverts ÷ coefficients de base

for (const famille of FAMILLES) {
  for (const role of Object.keys(MENU_DU_ROLE)) {
    for (const etatPoids of ['cru_net', 'cuit']) {
      const attendu = COUVERTS * PORTION_MAISON / coefficient(famille.cle, 'parage') / (etatPoids === 'cuit' ? coefficient(famille.cle, 'cuisson') : 1);
      test(`${famille.cle} (${role}, ${etatPoids}) : ${COUVERTS} × ${PORTION_MAISON} g ÷ coefficients des standards de base`, () => {
        const calcul = calculDe(famille, role, etatPoids);
        if (calcul === null) return; // famille que le lexique ne produit pas dans ce rôle
        assert.equal(calcul.statut, 'CALCULE');
        assert.ok(Math.abs(calcul.quantiteTravail - attendu) < TOLERANCE, `reçu ${calcul.quantiteTravail}, attendu ${attendu}`);
      });
    }
  }
}

// ------------------------------------------------------------------ 3. rien n'est inventé là où aucune portion n'existe

test('un risotto en plat principal (menu 1) n\'a aucun repère : quantité inconnue tant que la portion n\'est pas tapée', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto aux bolets', h());
  definirCouvertsMidi(e, JOUR, { total: COUVERTS, repartition: null }, h(1));
  const risotto = Object.values(e.composants).find((c) => c.menu === 1 && c.nom === 'Risotto');
  const calcul = calculerComposant(e, risotto.id);
  assert.equal(calcul.statut, 'INCONNU');
  assert.equal(calcul.quantiteTravail, null);
});

test('sauce implicite à confirmer, légume sans portion et élément de recette : jamais une quantité en poids inventée', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Penne aux crevettes', h());
  definirMenu(e, JOUR, 2, 'Filet de bar, brocoli', h());
  definirCouvertsMidi(e, JOUR, { total: COUVERTS, repartition: { 1: 10, 2: 10 } }, h(1));
  const parNom = (nom) => calculerComposant(e, Object.values(e.composants).find((c) => c.nom === nom).id);
  const sauce = parNom('sauce à confirmer');
  assert.equal(sauce.quantiteTravail, null);
  assert.equal(sauce.uniteTravail, null);
  const brocoli = parNom('brocoli');
  assert.equal(brocoli.statut, 'INCONNU');
  assert.equal(brocoli.quantiteTravail, null);
  const crevettes = parNom('crevettes');
  assert.equal(crevettes.uniteTravail, 'portion'); // composition à définir : des portions, pas des grammes
  assert.equal(crevettes.quantiteTravail, 10);
});

test('la répartition des couverts du midi se retrouve intégralement dans les portions des deux menus', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Penne aux crevettes', h());
  definirMenu(e, JOUR, 2, 'Filet de bar, riz, brocoli', h());
  definirCouvertsMidi(e, JOUR, { total: COUVERTS, repartition: null }, h(1));
  const portions = Object.values(e.composants).map((c) => [c.menu, calculerComposant(e, c.id).portions.total]);
  const parMenu = (menu) => portions.find(([m]) => m === menu)[1];
  assert.equal(parMenu(1) + parMenu(2), COUVERTS);
});

// ------------------------------------------------------------------ 4. aucune dérive depuis la v118

test('les quantités de chaque famille, rôle et portion sont celles de la v118 (valeurs gelées)', () => {
  const ecarts = [];
  for (const famille of FAMILLES) {
    for (const role of Object.keys(MENU_DU_ROLE)) {
      for (const portion of ['base', 'cru_net', 'cuit']) {
        const cle = `${famille.cle}|${role}|${portion}`;
        if (!Object.hasOwn(CALCULS_V118, cle)) continue;
        const calcul = calculDe(famille, role, portion === 'base' ? null : portion);
        const recu = calcul?.statut === 'CALCULE' ? Math.round(calcul.quantiteTravail * 1000) / 1000 : null;
        if (recu !== CALCULS_V118[cle]) ecarts.push(`${cle} : v118 ${CALCULS_V118[cle]}, maintenant ${recu}`);
      }
    }
  }
  assert.deepEqual(ecarts, []);
});
