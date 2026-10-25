import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterJours, aMenuDuJour, aServiceDuSoir, datesDeLaSemaine, estDateValide, estOuvert,
  jourSemaine, joursEntre, libelleJour, lundiDe,
} from '../app/js/domaine/dates.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

test('jourSemaine : 1 = lundi … 7 = dimanche', () => {
  assert.equal(jourSemaine(S.lundi), 1);
  assert.equal(jourSemaine(S.samedi), 6);
  assert.equal(jourSemaine(S.dimanche), 7);
});

test('dimanche : fermé, sans menu du jour', () => {
  assert.equal(estOuvert(S.dimanche), false);
  assert.equal(estOuvert(S.samedi), true);
  assert.equal(aMenuDuJour(S.dimanche), false);
  assert.equal(aMenuDuJour(S.samedi), false);
  assert.equal(aMenuDuJour(S.vendredi), true);
});

test('aServiceDuSoir : du mercredi au samedi seulement (information de calendrier, sans effet sur les calculs)', () => {
  assert.deepEqual([S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi, S.samedi, S.dimanche].map(aServiceDuSoir),
    [false, false, true, true, true, true, false]);
  assert.throws(() => aServiceDuSoir('2026-02-30'), /Date invalide/);
});

test('semaine à cheval sur deux mois et deux années', () => {
  assert.equal(lundiDe('2026-10-03'), S.lundiChevauchement); // samedi 3 octobre -> lundi 28 septembre
  assert.deepEqual(datesDeLaSemaine(S.lundiChevauchement),
    ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.equal(ajouterJours('2026-09-30', 1), '2026-10-01');
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
  assert.equal(ajouterJours('2028-02-28', 1), '2028-02-29'); // année bissextile
  assert.equal(ajouterJours('2026-10-05', -5), '2026-09-30');
});

test('lundiDe : le dimanche appartient à la semaine qui se termine', () => {
  assert.equal(lundiDe(S.dimanche), S.lundi);
  assert.equal(lundiDe(S.lundi), S.lundi);
});

test('joursEntre : jours calendaires signés, dimanche compté', () => {
  assert.equal(joursEntre(S.samedi, S.lundiSuivant), 2);
  assert.equal(joursEntre(S.vendredi, S.lundiSuivant), 3);
  assert.equal(joursEntre(S.lundiSuivant, S.samedi), -2);
  assert.equal(joursEntre(S.lundi, S.lundi), 0);
  assert.equal(joursEntre('2026-10-24', '2026-10-26'), 2); // passage à l'heure d'hiver : pas de décalage
});

test('dates invalides refusées', () => {
  for (const d of ['2026-02-30', '2026-13-01', '05/10/2026', '', null, undefined, 20261005]) {
    assert.equal(estDateValide(d), false, String(d));
  }
  assert.throws(() => jourSemaine('pas une date'), /Date invalide/);
  assert.throws(() => ajouterJours('2026-2-3', 1), /Date invalide/);
});

test('libelleJour', () => {
  assert.equal(libelleJour(S.lundi), 'lundi 5 octobre');
  assert.equal(libelleJour('2026-10-01'), 'jeudi 1er octobre');
  assert.equal(libelleJour(S.dimanche), 'dimanche 11 octobre');
});
