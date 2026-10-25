// Jour au poste (reprises de Kōzō, 2026-10-03) : « fait » annulable juste après, jauge d'avancement.
// Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { annulerFait, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { cibleProduction, etatTache, feuilleDuJour } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

/** Une production planifiée le mardi pour le mercredi. */
function productionPlanifiee() {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  planifier(e, p, S.mardi, h());
  return { e, p };
}

test('annulerFait : remet la production à faire juste après le marquage, comme si rien n\'avait été fait', () => {
  const { e, p } = productionPlanifiee();
  const avant = structuredClone(e.productions[p]);
  marquerFait(e, p, undefined, h(1));
  assert.equal(e.productions[p].etat, 'fait');
  annulerFait(e, p, h(2));
  const apres = e.productions[p];
  assert.equal(apres.etat, 'a_faire');
  assert.deepEqual([apres.quantiteReelle, apres.hFait, apres.instantane, apres.cibleAuDemarrage],
    [null, null, null, avant.cibleAuDemarrage]);
  assert.equal(apres.jourDecide, S.mardi, 'le jour décidé reste');
  assert.equal(etatTache(e, p), 'a_faire');
  assert.ok(e.journal.some((j) => j.action === 'annulerFait'), 'l\'annulation est au journal');
});

test('annulerFait : refusée après deux minutes ou si la production n\'est pas faite', () => {
  const { e, p } = productionPlanifiee();
  assert.throws(() => annulerFait(e, p, h(1)), /n'est pas faite/);
  marquerFait(e, p, undefined, h(1));
  assert.throws(() => annulerFait(e, p, h(5)), /trop tard|corrigerReel|Corriger/i);
  assert.equal(e.productions[p].etat, 'fait', 'rien n\'a changé');
});

test('jour : l\'avancement compte les productions décidées ce jour, faites ou non', () => {
  const { e, p } = productionPlanifiee();
  assert.deepEqual(feuilleDuJour(e, S.mardi).avancement, { faites: 0, total: 1 });
  marquerFait(e, p, undefined, h(1));
  assert.deepEqual(feuilleDuJour(e, S.mardi).avancement, { faites: 1, total: 1 });
  assert.deepEqual(feuilleDuJour(e, S.lundi).avancement, { faites: 0, total: 0 }, 'un autre jour : rien');
  assert.equal(cibleProduction(e, p), 500);
});
