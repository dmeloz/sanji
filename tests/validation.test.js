// Assistant de validation progressive des portions (B-P1b, partie 1) : valeurs à valider, quatre gestes, garde-fous.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard, modifierComposant } from '../app/js/domaine/actions.js';
import {
  corrigerStandard, correctionDuJour, reporterValidation, validerStandard,
} from '../app/js/domaine/actions-validation.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { valeursAValider } from '../app/js/domaine/validation.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_REPERES as R } from './jeux/TEST_ONLY-savoir.js';
import { etatVide, h, prevision } from './aide.js';

/** Menu 2 « riz » au poste (garniture) : le repère validé du riz en garniture est une fourchette 50–70 g sec. */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  const riz = Object.values(e.composants).find((c) => c.famille === 'riz');
  return { e, riz };
}

const CLE = 'riz|garniture';

test('valeursAValider : la portion qui vient d\'un repère est proposée avec sa fourchette, ses sources et son effet', () => {
  const { e, riz } = monde();
  const liste = valeursAValider(e, S.lundi);
  assert.equal(liste.length, 1);
  const v = liste[0];
  assert.equal(v.cle, CLE);
  assert.equal(v.famille, 'riz');
  assert.equal(v.role, 'garniture');
  assert.deepEqual(v.proposition, { min: 50, max: 70, unite: 'g', etat: 'sec' });
  assert.ok(v.sources.length > 0);
  assert.deepEqual(v.composantIds, [riz.id]);
  assert.equal(v.effet.portions, 40);
  assert.equal(v.effet.unite, 'g');
  assert.equal(v.effet.quantite, 40 * 60, 'effet de l\'estimation actuelle (milieu) : 40 portions × 60 g');
});

test('valeursAValider : hors de l\'horizon, ou avec une portion corrigée sur le plat, rien n\'est proposé', () => {
  const { e, riz } = monde();
  assert.equal(valeursAValider(e, '2026-09-20').length, 0, 'service lointain');
  assert.equal(valeursAValider(e, S.lundi, 4).length, 1);
  assert.equal(valeursAValider(e, '2026-10-02', 4).length, 1, 'le lundi est à 3 jours : dans l\'horizon');
  assert.equal(valeursAValider(e, '2026-10-01', 4).length, 0, 'le lundi est à 4 jours : hors horizon');
  assert.equal(valeursAValider(e, '2026-10-06', 4).length, 0, 'service passé');
  modifierComposant(e, riz.id, { grammage: { valeur: 55, unite: 'g', etat: 'sec', statut: 'SAISI_SERVICE', source: '' } }, h());
  assert.equal(valeursAValider(e, S.lundi).length, 0);
});

test('valeursAValider : un repère de la base (origine « base ») est proposé aussi', () => {
  const { e } = monde();
  const l = valeursAValider(e, S.lundi, 4, [R.familleRiz]);
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].proposition, { min: 50, max: 50, unite: 'g', etat: 'sec' });
});

test('valider : une estimation validée crée un standard maison avec la valeur CHOISIE, pas le milieu', () => {
  const { e, riz } = monde();
  const st = validerStandard(e, 'riz', 'garniture', { valeur: 55 }, h());
  assert.deepEqual(e.standards.riz.garniture, { valeur: 55, unite: 'g', etat: 'sec', h: h() });
  assert.equal(st.valeur, 55);
  const g = grammageEffectif(e, riz);
  assert.equal(g.origine, 'standard');
  assert.equal(g.valeur, 55);
  const journal = e.journal.at(-1);
  assert.equal(journal.action, 'validerStandard');
  assert.match(journal.detail, /50–70/, 'le journal garde la proposition vue');
  assert.match(journal.detail, /55/);
});

test('valider : une valeur absente, nulle ou illisible est refusée et rien n\'est écrit', () => {
  const { e } = monde();
  const nb = e.journal.length;
  for (const saisie of [{}, { valeur: null }, { valeur: 0 }, { valeur: -3 }, { valeur: Number.NaN }, { valeur: '60' }, null]) {
    assert.throws(() => validerStandard(e, 'riz', 'garniture', saisie, h()), /valeur/i, JSON.stringify(saisie));
  }
  assert.deepEqual(e.standards, {});
  assert.equal(e.journal.length, nb);
});

test('valider : hors de la fourchette seulement avec une confirmation explicite', () => {
  const { e } = monde();
  assert.throws(() => validerStandard(e, 'riz', 'garniture', { valeur: 90 }, h()), /hors de la fourchette/);
  assert.throws(() => validerStandard(e, 'riz', 'garniture', { valeur: 40, confirmeHorsFourchette: false }, h()), /hors de la fourchette/);
  assert.deepEqual(e.standards, {});
  validerStandard(e, 'riz', 'garniture', { valeur: 90, confirmeHorsFourchette: true }, h());
  assert.equal(e.standards.riz.garniture.valeur, 90);
});

test('valider : sans repère à valider, ou sur un standard déjà validé, c\'est refusé (aucun écrasement silencieux)', () => {
  const { e } = monde();
  assert.throws(() => validerStandard(e, 'carottes', 'garniture', { valeur: 100 }, h()), /repère/);
  assert.throws(() => validerStandard(e, 'inconnue', 'garniture', { valeur: 100 }, h()), /inconnue/);
  validerStandard(e, 'riz', 'garniture', { valeur: 60 }, h(1));
  assert.throws(() => validerStandard(e, 'riz', 'garniture', { valeur: 65 }, h(2)), /déjà/);
  assert.equal(e.standards.riz.garniture.valeur, 60);
  definirStandard(e, 'riz', 'plat_principal', { valeur: 80, unite: 'g', etat: 'sec' }, h(3));
  assert.throws(() => validerStandard(e, 'riz', 'plat_principal', { valeur: 85 }, h(4)), /déjà|repère/);
  assert.equal(e.standards.riz.plat_principal.valeur, 80);
});

test('une valeur validée n\'est plus proposée ; les plats de la famille sont regroupés sous une seule valeur', () => {
  const { e } = monde();
  definirMenu(e, S.mardi, 2, 'riz', h());
  prevision(e, S.mardi, 2, 20);
  const avant = valeursAValider(e, S.lundi);
  assert.equal(avant.length, 1);
  assert.equal(avant[0].composantIds.length, 2);
  assert.equal(avant[0].effet.portions, 60);
  validerStandard(e, 'riz', 'garniture', { valeur: 60 }, h());
  assert.deepEqual(valeursAValider(e, S.lundi), []);
});

test('corriger : une autre valeur remplace explicitement le standard, avec avant et après au journal', () => {
  const { e } = monde();
  validerStandard(e, 'riz', 'garniture', { valeur: 60 }, h(1));
  corrigerStandard(e, 'riz', 'garniture', { valeur: 65 }, h(2));
  assert.equal(e.standards.riz.garniture.valeur, 65);
  const j = e.journal.at(-1);
  assert.equal(j.action, 'corrigerStandard');
  assert.match(j.detail, /60/);
  assert.match(j.detail, /65/);
  assert.throws(() => corrigerStandard(e, 'riz', 'garniture', { valeur: null }, h(3)), /valeur/i);
  assert.throws(() => corrigerStandard(e, 'riz', 'garniture', { valeur: 65 }, h(3)), /déjà cette valeur/);
  assert.throws(() => corrigerStandard(e, 'riz', 'garniture', { valeur: 500 }, h(3)), /hors de la fourchette/);
  assert.equal(e.standards.riz.garniture.valeur, 65);
});

test('corriger : sans standard encore, la valeur saisie crée le standard (le journal garde la proposition vue)', () => {
  const { e } = monde();
  corrigerStandard(e, 'riz', 'garniture', { valeur: 58 }, h());
  assert.equal(e.standards.riz.garniture.valeur, 58);
  assert.match(e.journal.at(-1).detail, /50–70/);
});

test('seulement cette fois : le grammage du plat change, jamais le standard, provenance « saisi au service »', () => {
  const { e, riz } = monde();
  correctionDuJour(e, riz.id, { valeur: 52 }, h());
  assert.deepEqual(e.standards, {});
  const g = e.composants[riz.id].grammage;
  assert.equal(g.valeur, 52);
  assert.equal(g.statut, 'SAISI_SERVICE');
  assert.equal(g.unite, 'g');
  assert.equal(g.etat, 'sec');
  assert.equal(grammageEffectif(e, riz).origine, 'plat');
  assert.equal(calculerComposant(e, riz.id).quantiteTravail, 40 * 52);
  assert.deepEqual(valeursAValider(e, S.lundi), [], 'ce plat n\'est plus une estimation');
  assert.throws(() => correctionDuJour(e, riz.id, { valeur: null }, h()), /valeur/i);
  assert.throws(() => correctionDuJour(e, 'absent', { valeur: 10 }, h()), /introuvable/);
});

test('plus tard : masqué jusqu\'au lendemain, ne bloque aucune quantité', () => {
  const { e, riz } = monde();
  const avant = calculerComposant(e, riz.id);
  reporterValidation(e, CLE, '2026-10-04T09:00:00');
  assert.deepEqual(e.validations[CLE], { statut: 'plus_tard', h: '2026-10-04T09:00:00' });
  assert.deepEqual(valeursAValider(e, '2026-10-04'), [], 'masquée aujourd\'hui');
  assert.equal(valeursAValider(e, '2026-10-05').length, 1, 'revient le lendemain');
  assert.equal(e.standards.riz, undefined);
  const apres = calculerComposant(e, riz.id);
  assert.equal(apres.quantiteTravail, avant.quantiteTravail);
  assert.equal(apres.statut, avant.statut);
  assert.equal(grammageEffectif(e, riz).origine, 'standard_base');
  assert.throws(() => reporterValidation(e, '', h()), /clé/i);
});
