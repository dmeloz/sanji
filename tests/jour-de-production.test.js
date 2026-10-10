// Jour de production d'un composant (onglet Articles, v117) : le jour où le poste doit avoir l'article, avances comprises.
// Jeux TEST_ONLY ; 2026-10-05 est un lundi, le samedi 10-03 précède, le dimanche est fermé.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirPrevision, definirRegle, definirStandard, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { avanceMaxDe, jourDeProduction } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

function un(date, surcharge = {}) {
  const e = etatVide();
  prevision(e, date, 1, 20);
  const c = composantValide(e, date, 1, J.PRODUIT_SEC_TEST, surcharge);
  return { e, c, p: principaleDe(e, c) };
}

test('avanceMaxDe : la règle, sinon l\'avance habituelle de deux jours', () => {
  assert.equal(avanceMaxDe(null), 2);
  assert.equal(avanceMaxDe({ avanceMaxJours: 0 }), 0);
  assert.equal(avanceMaxDe({ avanceMaxJours: 3 }), 3);
  assert.equal(avanceMaxDe({ avanceMaxJours: -1 }), 2);
  assert.equal(avanceMaxDe({ avanceMaxJours: null }), 2);
});

test('jourDeProduction : service lundi sans règle, le dimanche fermé : le samedi', () => {
  const { e, c } = un(S.lundi);
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.samediPrecedent, planifie: false });
});

test('jourDeProduction : service mercredi sans règle : le lundi', () => {
  const { e, c } = un(S.mercredi);
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.lundi, planifie: false });
});

test('jourDeProduction : les pâtes du menu 1 restent le jour du service', () => {
  const { e, c } = un(S.mercredi, { role: 'plat_principal' });
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.mercredi, planifie: false });
});

test('jourDeProduction : une avance maximale de 1 jour donne J-1', () => {
  const { e, c } = un(S.mercredi);
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', avanceMaxJours: 1 }, h());
  assert.equal(jourDeProduction(e, c, S.veille).date, S.mardi);
});

test('jourDeProduction : le jour décidé à la main gagne, même plus tard que le calcul', () => {
  const { e, c, p } = un(S.mercredi);
  planifier(e, p, S.mardi, 'avant_midi', h());
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.mardi, planifie: true });
});

test('jourDeProduction : une préparation à étapes se lit à sa première étape', () => {
  const { e, c } = un(S.lundi);
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', etapes: [
    { libelle: 'Couper', avanceMaxJours: 3 }, { libelle: 'Blanchir', avanceMaxJours: 1 }, { libelle: 'Finir', avanceMaxJours: 0 },
  ] }, h());
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.veille, planifie: false });
});

test('jourDeProduction : jamais avant `depuis`, ni après le service ; un service passé n\'a plus de jour', () => {
  const { e, c } = un(S.lundi);
  assert.equal(jourDeProduction(e, c, S.lundi).date, S.lundi, 'le samedi est passé : le jour même');
  assert.equal(jourDeProduction(e, c, S.mardi), null, 'le service est passé');
});

test('jourDeProduction : une principale déjà faite sort de la liste', () => {
  const { e, c, p } = un(S.lundi);
  marquerFait(e, p, null, h(), { sansQuantite: true });
  assert.equal(jourDeProduction(e, c, S.veille), null);
});

test('jourDeProduction : une préparation qui se garde moins que l\'avance recule au premier jour sans avertissement', () => {
  const e = etatVide();
  definirMenu(e, S.jeudi, 2, 'riz', h());
  definirPrevision(e, S.jeudi, 2, 10, h());
  definirStandard(e, 'riz', 'garniture', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  const riz = Object.values(e.composants).find((c) => c.nom === 'riz');
  assert.equal(jourDeProduction(e, riz.id, S.veille).date, S.mercredi, 'le riz cuit se garde 1 jour : la veille, pas J-2');
});

test('jourDeProduction : composant inconnu : null ; sans production principale : le jour du service (jamais une disparition)', () => {
  assert.equal(jourDeProduction(etatVide(), 'inconnu', S.lundi), null);
  const { e, c, p } = un(S.mercredi);
  delete e.productions[p];
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.mercredi, planifie: false });
  assert.deepEqual(jourDeProduction(e, c, S.mardi), { date: S.mercredi, planifie: false });
  assert.equal(jourDeProduction(e, c, S.jeudi), null, 'service passé');
});

test('jourDeProduction : à égalité de dates, la production planifiée à la main l\'emporte', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 20);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', etapes: [{ libelle: 'Couper', avanceMaxJours: 0 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  const prods = Object.values(e.productions).filter((x) => x.composantId === c);
  const finition = prods.find((x) => x.genre === 'principale');
  planifier(e, finition.id, S.lundi, 'avant_midi', h());
  assert.deepEqual(jourDeProduction(e, c, S.veille), { date: S.lundi, planifie: true });
});
