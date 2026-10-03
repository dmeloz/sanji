// A-P1 : ordre de lecture de la feuille Jour (domaine). Une seule liste, aucun filtre : service du menu 1, du menu 2,
// autres tâches, puis après service (avances) ; les faites à part ; aucune tâche ne disparaît faute de donnée.
// Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouterPreparatoire, creerFiche, definirMenu, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

/** Un lundi avec un élément par menu, une avance pour mardi et une action préparatoire. */
function lundiType() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.lundi, 2, 10);
  prevision(e, S.mardi, 1, 10);
  const m1 = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M1_TEST' });
  const m2 = composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M2_TEST' });
  const mardi = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_MARDI_TEST' });
  planifier(e, principaleDe(e, m1), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, m2), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, mardi), S.lundi, 'apres_midi', h());
  ajouterPreparatoire(e, m1, 'ACTION_TEST', h());
  return { e, m1, m2, mardi };
}

const noms = (liste) => liste.map((l) => l.nom);

test('lecture : menu 1, menu 2, autres, puis après service, dans cet ordre', () => {
  const { e } = lundiType();
  const { lecture } = feuilleDuJour(e, S.lundi);
  assert.deepEqual(noms(lecture.service1).filter((n) => n === 'ELEMENT_M1_TEST'), ['ELEMENT_M1_TEST']);
  assert.deepEqual(noms(lecture.service2), ['ELEMENT_M2_TEST']);
  assert.equal(lecture.service1.concat(lecture.service2).some((l) => l.genre === 'preparatoire'), false);
  assert.deepEqual(noms(lecture.apres), ['ELEMENT_MARDI_TEST']);
});

test('lecture : une action préparatoire est une « autre tâche » (si elle est décidée ce jour)', () => {
  const { e, m1 } = lundiType();
  const prep = Object.values(e.productions).find((p) => p.genre === 'preparatoire' && p.composantId === m1);
  planifier(e, prep.id, S.lundi, 'avant_midi', h());
  const { lecture } = feuilleDuJour(e, S.lundi);
  assert.equal(lecture.autres.some((l) => l.genre === 'preparatoire'), true);
});

test('lecture : une avance garde son jour de service et son écart (badge J+n), dans la même liste', () => {
  const { e } = lundiType();
  const [avance] = feuilleDuJour(e, S.lundi).lecture.apres;
  assert.equal(avance.dateService, S.mardi);
  assert.equal(avance.avanceJours, 1);
  assert.equal(avance.source, 'decidee');
});

test('lecture : une avance seulement possible (pas encore planifiée) est dans « après service », jamais cachée', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_J2_TEST' });
  const { lecture } = feuilleDuJour(e, S.lundi);
  assert.equal(lecture.apres.length, 1);
  assert.equal(lecture.apres[0].avanceJours, 2);
  assert.equal(lecture.apres[0].source, 'suggestion');
});

test('lecture : une tâche faite va dans « faites », une tâche du jour pas encore planifiée reste dans la liste de travail', () => {
  const { e, m1 } = lundiType();
  marquerFait(e, principaleDe(e, m1), undefined, h(1));
  const nonPlanifie = composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_LIBRE_TEST' });
  const { lecture } = feuilleDuJour(e, S.lundi);
  assert.deepEqual(noms(lecture.faites), ['ELEMENT_M1_TEST']);
  assert.equal(lecture.service1.length, 0);
  const libre = lecture.service2.find((l) => l.composantId === nonPlanifie);
  assert.ok(libre, 'visible dans la liste de travail');
  assert.equal(libre.source, 'a_planifier');
  assert.equal(lecture.decisions.some((d) => d.composantId === nonPlanifie), false, 'pas répétée dans les décisions');
});

test('lecture : une quantité inconnue ne retire aucune ligne et ne devient pas une décision', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  const { lecture, decisions, quantitesManquantes } = feuilleDuJour(e, S.lundi);
  assert.deepEqual(decisions, []);
  assert.deepEqual(lecture.decisions, []);
  assert.ok(quantitesManquantes.length >= 2, 'dites comme information neutre');
});

test('lecture : état du poids, couverts, menus et fiches de fonction du jour', () => {
  const { e } = lundiType();
  definirMenu(e, S.lundi, 1, 'INTITULE_TEST_1', h());
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 12, mode: 'menu_fixe', menuFixe: 1 }, h());
  const f = feuilleDuJour(e, S.lundi).lecture;
  assert.equal(f.service2[0].etatPoids, 'cuit', 'l\'état du poids vient du grammage (cuit par défaut)');
  assert.equal(f.menus[0].intitule, 'INTITULE_TEST_1');
  assert.equal(f.fiches.length, 1);
  assert.equal(typeof f.couverts[1], 'number');
  assert.equal(f.couverts.total >= f.couverts[1], true);
  const vide = feuilleDuJour(etatVide(), S.jeudi).lecture;
  assert.equal(vide.couverts.total, null, 'sans prévision : aucun chiffre');
  assert.deepEqual(vide.fiches, []);
});
