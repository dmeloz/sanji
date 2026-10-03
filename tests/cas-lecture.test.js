import test from 'node:test';
import { strict as assert } from 'node:assert';
import { CAS_LECTURE } from './jeux/TEST_ONLY-cas-lecture.js';

test('CAS_LECTURE est un tableau gelé', () => {
  assert(Array.isArray(CAS_LECTURE));
  assert(Object.isFrozen(CAS_LECTURE));
});

test('Contient exactement 30 cas', () => {
  assert.equal(CAS_LECTURE.length, 30);
});

test('Tous les numéros de 1 à 30 sont présents et uniques', () => {
  const numeros = CAS_LECTURE.map(cas => cas.numero);
  assert.deepEqual(numeros.sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('Chaque cas a la structure complète', () => {
  CAS_LECTURE.forEach((cas, index) => {
    assert(typeof cas.numero === 'number', `Cas ${index}: numero doit être un nombre`);
    assert(typeof cas.intitule === 'string' && cas.intitule.length > 0, `Cas ${index}: intitule vide`);
    assert([1, 2].includes(cas.menu), `Cas ${index}: menu doit être 1 ou 2`);
    assert(typeof cas.provisoire === 'boolean', `Cas ${index}: provisoire doit être boolean`);
    assert(Array.isArray(cas.auPoste), `Cas ${index}: auPoste doit être un tableau`);
    assert(Array.isArray(cas.horsPoste), `Cas ${index}: horsPoste doit être un tableau`);
    assert(Array.isArray(cas.aConfirmer), `Cas ${index}: aConfirmer doit être un tableau`);
    assert(typeof cas.avance === 'string' && cas.avance.length > 0, `Cas ${index}: avance vide`);
    assert(typeof cas.note === 'string' && cas.note.length > 0, `Cas ${index}: note vide`);
  });
});

test('Tous les éléments des tableaux auPoste, horsPoste, aConfirmer sont des chaînes', () => {
  CAS_LECTURE.forEach((cas, index) => {
    cas.auPoste.forEach((el, i) => {
      assert(typeof el === 'string' && el.length > 0, `Cas ${index}: auPoste[${i}] invalide`);
    });
    cas.horsPoste.forEach((el, i) => {
      assert(typeof el === 'string' && el.length > 0, `Cas ${index}: horsPoste[${i}] invalide`);
    });
    cas.aConfirmer.forEach((el, i) => {
      assert(typeof el === 'string' && el.length > 0, `Cas ${index}: aConfirmer[${i}] invalide`);
    });
  });
});

test('Exactement 5 cas sont marqués provisoire : 21, 22, 23, 29, 30', () => {
  const casProvisoires = CAS_LECTURE.filter(cas => cas.provisoire).map(cas => cas.numero);
  assert.deepEqual(casProvisoires.sort((a, b) => a - b), [21, 22, 23, 29, 30]);
});

test('Tous les autres cas (1-20, 24-28) ont provisoire = false', () => {
  const casNonProvisoires = CAS_LECTURE.filter(cas => !cas.provisoire).map(cas => cas.numero);
  const attendus = Array.from({ length: 20 }, (_, i) => i + 1).concat(Array.from({ length: 5 }, (_, i) => i + 24));
  assert.deepEqual(casNonProvisoires.sort((a, b) => a - b), attendus);
});

test('Cas 1-20 ont menu = 1', () => {
  const casMenu1 = CAS_LECTURE.filter(cas => cas.numero <= 20).map(cas => cas.numero);
  casMenu1.forEach(numero => {
    const cas = CAS_LECTURE.find(c => c.numero === numero);
    assert.equal(cas.menu, 1, `Cas ${numero} doit être Menu 1`);
  });
});

test('Cas 21-30 ont menu = 2', () => {
  const casMenu2 = CAS_LECTURE.filter(cas => cas.numero >= 21).map(cas => cas.numero);
  casMenu2.forEach(numero => {
    const cas = CAS_LECTURE.find(c => c.numero === numero);
    assert.equal(cas.menu, 2, `Cas ${numero} doit être Menu 2`);
  });
});

test('Aucun intitulé n\'est vide', () => {
  CAS_LECTURE.forEach(cas => {
    assert(cas.intitule.trim().length > 0, `Cas ${cas.numero}: intitulé vide`);
  });
});

test('Tous les cas sont gelés (Object.freeze)', () => {
  CAS_LECTURE.forEach((cas, index) => {
    assert(Object.isFrozen(cas), `Cas ${index} n\'est pas gelé`);
  });
});
