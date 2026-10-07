// Couverts du midi (décision du 2026-10-07) : total saisi, répartition calculée ou décidée, recalcul de la production.
// Jeux TEST_ONLY : dates de tests/jeux/TEST_ONLY-semaine.js (2026-10-05 est un lundi).

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirPrevision, definirStandard, saisirVentes } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant, portionsMenu } from '../app/js/domaine/calcul.js';
import {
  HEURE_VENTES_A_SAISIR, PART_MENU_1_SANS_HISTORIQUE, apercuCouverts, couvertsMidiDuJour, proportionMenu1,
  repartitionCalculee, ventesASaisir,
} from '../app/js/domaine/couverts-midi.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { repereVentes } from '../app/js/domaine/points.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

const LUNDI = '2026-10-19';
const LUNDIS = ['2026-10-12', '2026-10-05', '2026-09-28']; // les trois lundis précédents, du plus récent au plus ancien

function ventes(e, date, v1, v2) {
  if (v1 !== null) saisirVentes(e, date, 1, v1, h());
  if (v2 !== null) saisirVentes(e, date, 2, v2, h());
}
function avecHistorique(paires) {
  const e = etatVide();
  LUNDIS.forEach((d, i) => ventes(e, d, paires[i][0], paires[i][1]));
  return e;
}
function jourAvecPates() {
  const e = etatVide();
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  return e;
}
const pates = (e) => Object.values(e.composants).find((c) => c.nom === 'Tagliatelles');

test('défaut sans historique : un tiers / deux tiers (60 → 20 / 40, 50 → 17 / 33)', () => {
  const e = etatVide();
  assert.equal(PART_MENU_1_SANS_HISTORIQUE, 1 / 3);
  assert.deepEqual(proportionMenu1(e, LUNDI), { part: 1 / 3, base: 'defaut', jours: [] });
  assert.deepEqual(repartitionCalculee(e, LUNDI, 60), { m1: 20, m2: 40, part: 1 / 3, base: 'defaut', jours: [] });
  const r = repartitionCalculee(e, LUNDI, 50);
  assert.deepEqual([r.m1, r.m2], [17, 33]);
  assert.deepEqual([repartitionCalculee(e, LUNDI, 0).m1, repartitionCalculee(e, LUNDI, 0).m2], [0, 0]);
});

test('historique de 3 mêmes jours : part = moyenne M1 / (M1 + M2)', () => {
  const e = avecHistorique([[20, 40], [30, 30], [10, 50]]);
  const p = proportionMenu1(e, LUNDI);
  assert.equal(p.base, 'historique');
  assert.equal(p.part, 20 / 60);
  assert.deepEqual(p.jours, LUNDIS);
  const e2 = avecHistorique([[30, 10], [30, 10], [30, 10]]);
  assert.deepEqual(repartitionCalculee(e2, LUNDI, 40), { m1: 30, m2: 10, part: 0.75, base: 'historique', jours: LUNDIS });
});

test('historique insuffisant : 2 jours, un seul menu saisi, dates différentes ou ventes à 0 donnent le défaut', () => {
  const deuxJours = etatVide();
  LUNDIS.slice(0, 2).forEach((d) => ventes(deuxJours, d, 20, 40));
  assert.equal(proportionMenu1(deuxJours, LUNDI).base, 'defaut');

  const unMenu = avecHistorique([[20, null], [30, null], [10, null]]);
  assert.equal(proportionMenu1(unMenu, LUNDI).base, 'defaut');

  const decales = etatVide();
  LUNDIS.forEach((d) => ventes(decales, d, 20, null));
  ventes(decales, LUNDIS[0], null, 40);
  ventes(decales, LUNDIS[1], null, 40);
  ventes(decales, '2026-09-21', null, 40); // M2 : 12, 5, 21 ; M1 : 12, 5, 28
  assert.equal(proportionMenu1(decales, LUNDI).base, 'defaut');

  assert.equal(proportionMenu1(avecHistorique([[0, 0], [0, 0], [0, 0]]), LUNDI).base, 'defaut');
});

test('repereVentes : même jour de semaine et dates antérieures seulement', () => {
  const e = etatVide();
  ventes(e, '2026-10-12', 10, 1); // lundi
  ventes(e, '2026-10-13', 99, 1); // mardi : exclu
  ventes(e, LUNDI, 77, 1); // la date elle-même : exclue
  ventes(e, '2026-10-26', 55, 1); // futur : exclu
  assert.deepEqual(repereVentes(e, LUNDI, 1), [{ date: '2026-10-12', ventes: 10 }]);
});

test('definirCouvertsMidi : calcul par défaut, écrit les prévisions des deux menus, certitude provisoire', () => {
  const e = etatVide();
  const c = definirCouvertsMidi(e, S.mercredi, { total: 60 }, h());
  assert.deepEqual(c, { total: 60, repartition: null, h: h() });
  assert.deepEqual(e.jours[S.mercredi].previsions, { 1: { portions: 20, h: h() }, 2: { portions: 40, h: h() } });
  assert.equal(portionsMenu(e, S.mercredi, 1).details[0].certitude, 'provisoire');
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: 60, m1: 20, m2: 40, manuel: false, certitude: 'provisoire' });
  assert.equal(e.journal.at(-1).action, 'definirCouvertsMidi');
});

test('definirCouvertsMidi : répartition décidée valide, puis retour au calcul', () => {
  const e = etatVide();
  definirCouvertsMidi(e, S.mercredi, { total: 60, repartition: { 1: 45, 2: 15 } }, h());
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: 60, m1: 45, m2: 15, manuel: true, certitude: 'provisoire' });
  assert.deepEqual(e.jours[S.mercredi].couverts.repartition, { 1: 45, 2: 15 });
  definirCouvertsMidi(e, S.mercredi, { total: 60, repartition: null }, h(1));
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: 60, m1: 20, m2: 40, manuel: false, certitude: 'provisoire' });
});

test('definirCouvertsMidi : total 0 accepté', () => {
  const e = etatVide();
  definirCouvertsMidi(e, S.mercredi, { total: 0 }, h());
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: 0, m1: 0, m2: 0, manuel: false, certitude: 'provisoire' });
});

test('definirCouvertsMidi : refus (somme, négatif, décimal, non entier, week-end, date, horodatage) sans rien écrire', () => {
  const e = etatVide();
  const avant = structuredClone(e);
  const refus = [
    [S.mercredi, { total: 60, repartition: { 1: 30, 2: 20 } }, /doit faire 60/],
    [S.mercredi, { total: 60, repartition: { 1: -5, 2: 65 } }, /Répartition/],
    [S.mercredi, { total: 60, repartition: { 1: 30.5, 2: 29.5 } }, /Répartition/],
    [S.mercredi, { total: 60, repartition: { 1: 60 } }, /Répartition/],
    [S.mercredi, { total: -1 }, /entier/],
    [S.mercredi, { total: 1.5 }, /entier/],
    [S.mercredi, { total: '60' }, /entier/],
    [S.mercredi, {}, /entier/],
    [S.samedi, { total: 10 }, /Pas de menu/],
    [S.dimanche, { total: 10 }, /Pas de menu/],
    ['2026-13-45', { total: 10 }, /Date invalide/],
  ];
  for (const [date, saisie, motif] of refus) assert.throws(() => definirCouvertsMidi(e, date, saisie, h()), motif);
  assert.throws(() => definirCouvertsMidi(e, S.mercredi, { total: 10 }, 'pas une date'), /Horodatage/);
  assert.throws(() => definirCouvertsMidi(e, S.mercredi, { total: 10 }, undefined), /Horodatage/);
  assert.deepEqual(e, avant);
});

test('la production se recalcule après la saisie des couverts', () => {
  const e = jourAvecPates();
  definirCouvertsMidi(e, S.mercredi, { total: 60 }, h()); // menu 1 : 20 portions
  const avant = calculerComposant(e, pates(e).id);
  definirCouvertsMidi(e, S.mercredi, { total: 90 }, h(1)); // menu 1 : 30 portions
  const apres = calculerComposant(e, pates(e).id);
  assert.equal(avant.statut, 'CALCULE');
  assert.equal(avant.portions.total, 20);
  assert.equal(apres.portions.total, 30);
  assert.ok(apres.quantiteTravail > avant.quantiteTravail);
});

test('aucune décision « À décider » ne naît de la certitude provisoire des couverts', () => {
  const e = jourAvecPates();
  definirPrevision(e, S.mercredi, 1, 20, h());
  definirPrevision(e, S.mercredi, 2, 40, h());
  const avant = decisionsDe(e, S.mercredi).cartes.map((c) => c.id);
  definirCouvertsMidi(e, S.mercredi, { total: 60 }, h(1));
  assert.deepEqual(decisionsDe(e, S.mercredi).cartes.map((c) => c.id), avant);
});

test('definirPrevision remet le total saisi à null (certitude redevient estimée)', () => {
  const e = etatVide();
  definirCouvertsMidi(e, S.mercredi, { total: 60 }, h());
  definirPrevision(e, S.mercredi, 1, 25, h(1));
  assert.equal(e.jours[S.mercredi].couverts, null);
  assert.equal(couvertsMidiDuJour(e, S.mercredi).certitude, 'estimee');
  assert.equal(portionsMenu(e, S.mercredi, 1).details[0].certitude, 'estimee');
});

test('couvertsMidiDuJour : sans prévision, rien ; une seule prévision compte seule ; les fiches ne comptent pas', () => {
  const e = etatVide();
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: null, m1: null, m2: null, manuel: false, certitude: null });
  definirPrevision(e, S.mercredi, 2, 12, h());
  assert.deepEqual(couvertsMidiDuJour(e, S.mercredi), { total: 12, m1: null, m2: 12, manuel: false, certitude: 'estimee' });
  assert.equal(couvertsMidiDuJour(e, S.samedi).total, null);
});

test('ventesASaisir : dès 14:00, jour à menu, tant que les deux ventes manquent', () => {
  const e = etatVide();
  assert.equal(HEURE_VENTES_A_SAISIR, '14:00');
  assert.equal(ventesASaisir(e, S.mercredi, '13:59'), false);
  assert.equal(ventesASaisir(e, S.mercredi, '14:00'), true);
  assert.equal(ventesASaisir(e, S.mercredi, '18:30'), true);
  assert.equal(ventesASaisir(e, S.samedi, '15:00'), false);
  assert.equal(ventesASaisir(e, S.mercredi, null), false);
  assert.equal(ventesASaisir(e, S.mercredi, 1400), false);
  ventes(e, S.mercredi, 20, null);
  assert.equal(ventesASaisir(e, S.mercredi, '15:00'), true, 'un seul menu saisi : encore à saisir');
  ventes(e, S.mercredi, null, 40);
  assert.equal(ventesASaisir(e, S.mercredi, '15:00'), false);
});

test('apercuCouverts : répartition, couverts × portion = quantité, sans toucher à l\'état', () => {
  const e = jourAvecPates();
  const avant = structuredClone(e);
  const a = apercuCouverts(e, S.mercredi, 60, null);
  assert.deepEqual(avant, e, 'état d\'origine intact');
  assert.deepEqual([a.m1, a.m2, a.base, a.manuel, a.jours], [20, 40, 'defaut', false, []]);
  const p = a.composants.find((c) => c.nom === 'Tagliatelles');
  assert.equal(p.menu, 1);
  assert.equal(p.couverts, 20);
  assert.deepEqual(p.portion, { valeur: 100, unite: 'g', etat: 'sec' });
  assert.equal(p.unite, 'g');
  assert.ok(p.quantite > 0);
  const manuelle = apercuCouverts(e, S.mercredi, 60, { 1: 45, 2: 15 });
  assert.deepEqual([manuelle.m1, manuelle.m2, manuelle.manuel], [45, 15, true]);
  assert.ok(manuelle.composants.find((c) => c.nom === 'Tagliatelles').quantite > p.quantite);
  assert.throws(() => apercuCouverts(e, S.mercredi, 60, { 1: 1, 2: 1 }), /doit faire/);
  assert.deepEqual(avant, e);
});

test('import : ancienne sauvegarde sans couverts, couverts valide, couverts invalides remplacés par null', () => {
  const e = etatVide();
  definirCouvertsMidi(e, S.mercredi, { total: 60, repartition: { 1: 45, 2: 15 } }, h());
  definirCouvertsMidi(e, S.jeudi, { total: 30 }, h());
  const relu = importer(exporter(e, h()));
  assert.deepEqual(relu.jours[S.mercredi].couverts, { total: 60, repartition: { 1: 45, 2: 15 }, h: h() });
  assert.deepEqual(relu.jours[S.jeudi].couverts, { total: 30, repartition: null, h: h() });

  const brut = (couverts) => {
    const doc = JSON.parse(exporter(etatVide(), h()));
    doc.etat.jours = { [S.mercredi]: { date: S.mercredi, ...(couverts === undefined ? {} : { couverts }) } };
    return importer(JSON.stringify(doc)).jours[S.mercredi].couverts;
  };
  assert.equal(brut(undefined), null);
  const invalides = [
    'x', 12, [], { total: -1, repartition: null, h: 'a' }, { total: 1.5, repartition: null, h: 'a' }, { total: '3', repartition: null, h: 'a' },
    { total: 3, repartition: null }, { total: 3, repartition: null, h: 5 }, { total: 3, repartition: { 1: 1, 2: 1 }, h: 'a' },
    { total: 3, repartition: { 1: 1.5, 2: 1.5 }, h: 'a' }, { total: 3, repartition: { 1: -1, 2: 4 }, h: 'a' },
    { total: 3, repartition: 'x', h: 'a' }, { total: 3, h: 'a' },
  ];
  for (const c of invalides) assert.equal(brut(c), null, JSON.stringify(c));
  const dangereux = JSON.parse('{"total":3,"repartition":{"1":1,"2":2,"__proto__":{"x":1}},"h":"a","__proto__":{"y":1}}');
  assert.deepEqual(brut(dangereux), { total: 3, repartition: { 1: 1, 2: 2 }, h: 'a' });
});
