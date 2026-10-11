// Réinitialiser une semaine à venir. Données TEST_ONLY.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { etatVide, h } from './aide.js';
import { creerFiche, definirMenu, definirPrevision } from '../app/js/domaine/actions.js';
import { reinitialiserSemaine, semaineReinitialisable } from '../app/js/domaine/actions-semaine.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { exporter, importer } from '../app/js/domaine/etat.js';

const AUJOURD = '2026-10-07'; // mercredi ; semaine en cours : lundi 5
const COURANT = '2026-10-05';
const FUTUR = '2026-10-12';
const SUIVANT = '2026-10-19';

function etatAvecDeuxSemaines() {
  const e = etatVide();
  for (const lundi of [COURANT, FUTUR, SUIVANT]) {
    definirMenu(e, lundi, 1, 'riz, carottes', h());
    definirMenu(e, lundi, 2, 'courgettes, quinoa', h());
    definirPrevision(e, lundi, 1, 40, h());
  }
  definirCouvertsMidi(e, FUTUR, { total: 60 }, h());
  creerFiche(e, { numero: 'F1', date: FUTUR, service: 'midi', couverts: 10, mode: 'choix_libre' }, h());
  e.memoire['riz|1'] = { categorie: 'feculent', attribue: true };
  e.standards['legumes|garniture'] = { valeur: 90, unite: 'g' };
  e.ajustements['quantite|riz'] = { valeur: 70 };
  return e;
}

test('semaineReinitialisable : strictement après la semaine d\'aujourd\'hui, et un lundi', () => {
  assert.equal(semaineReinitialisable(FUTUR, AUJOURD), true);
  assert.equal(semaineReinitialisable(COURANT, AUJOURD), false);
  assert.equal(semaineReinitialisable('2026-09-28', AUJOURD), false);
  assert.equal(semaineReinitialisable('2026-10-13', AUJOURD), false, 'pas un lundi');
});

test('refus sur la semaine en cours et sur une semaine passée, état intact', () => {
  const e = etatAvecDeuxSemaines();
  const avant = JSON.stringify(e);
  assert.throws(() => reinitialiserSemaine(e, COURANT, AUJOURD, h(5)), /semaine à venir/);
  assert.throws(() => reinitialiserSemaine(e, '2026-09-28', AUJOURD, h(5)), /semaine à venir/);
  assert.throws(() => reinitialiserSemaine(e, '2026-10-13', AUJOURD, h(5)), /pas un lundi/);
  assert.equal(JSON.stringify(e), avant);
});

test('efface menus, couverts, fiches, composants et productions de la semaine à venir, rien d\'autre', () => {
  const e = etatAvecDeuxSemaines();
  const composantFutur = Object.values(e.composants).find((c) => c.date === FUTUR);
  assert.ok(composantFutur && Object.values(e.productions).some((p) => p.composantId === composantFutur.id));
  e.articlesCoches[`${composantFutur.id}|carottes`] = h();
  const autres = Object.values(e.composants).filter((c) => c.date !== FUTUR).map((c) => c.id);
  const productionsAutres = Object.values(e.productions).filter((p) => autres.includes(p.composantId)).length;
  const memoire = JSON.stringify(e.memoire); const standards = JSON.stringify(e.standards); const ajust = JSON.stringify(e.ajustements);
  const jourCourant = JSON.stringify(e.jours[COURANT]); const jourSuivant = JSON.stringify(e.jours[SUIVANT]);

  const r = reinitialiserSemaine(e, FUTUR, AUJOURD, h(9));

  assert.ok(r.composants > 0);
  assert.equal(e.jours[FUTUR], undefined);
  assert.equal(Object.values(e.composants).some((c) => c.date === FUTUR), false);
  assert.equal(Object.values(e.productions).some((p) => p.composantId === composantFutur.id), false);
  assert.equal(Object.keys(e.articlesCoches).length, 0);
  assert.equal(Object.values(e.fiches).some((f) => f.date === FUTUR), false);
  assert.equal(Object.values(e.productions).filter((p) => autres.includes(p.composantId)).length, productionsAutres);
  assert.equal(JSON.stringify(e.jours[COURANT]), jourCourant);
  assert.equal(JSON.stringify(e.jours[SUIVANT]), jourSuivant);
  assert.equal(JSON.stringify(e.memoire), memoire);
  assert.equal(JSON.stringify(e.standards), standards);
  assert.equal(JSON.stringify(e.ajustements), ajust);
  assert.equal(e.journal.at(-1).action, 'reinitialiserSemaine');
});

test('export puis import restent valides après la réinitialisation', () => {
  const e = etatAvecDeuxSemaines();
  reinitialiserSemaine(e, FUTUR, AUJOURD, h(9));
  const relu = importer(exporter(e, h(10)), AUJOURD);
  assert.equal(relu.jours[FUTUR], undefined);
  assert.ok(relu.jours[SUIVANT]);
});
