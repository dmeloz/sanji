// Regroupement suggéré de productions identiques (« une casserole pour plusieurs jours »), reprise de Kōzō.
// Une suggestion : chaque production garde sa cible, son réel et son service. Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { marquerFait, planifier } from '../app/js/domaine/actions.js';
import { lotsPossibles } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

const RIZ = { ...J.PRODUIT_SEC_TEST, nom: 'riz' };
const CAROTTES = { ...J.PRODUIT_SEC_TEST, nom: 'carottes', categorie: 'legume' };

function semaine() {
  const e = etatVide();
  for (const jour of [S.mardi, S.mercredi, S.vendredi]) prevision(e, jour, 1, 10);
  const ids = {
    rizMardi: principaleDe(e, composantValide(e, S.mardi, 1, RIZ)),
    rizMercredi: principaleDe(e, composantValide(e, S.mercredi, 1, RIZ)),
    rizVendredi: principaleDe(e, composantValide(e, S.vendredi, 1, RIZ)),
    carottesMardi: principaleDe(e, composantValide(e, S.mardi, 1, CAROTTES)),
  };
  return { e, ids };
}

test('lots : deux productions de la même famille et de la même unité, toutes deux avançables, forment un lot', () => {
  const { e, ids } = semaine();
  const lots = lotsPossibles(e, S.lundi);
  assert.equal(lots.length, 1, 'carottes seule ne forme pas de lot ; le riz du vendredi (4 jours) est hors règle');
  const lot = lots[0];
  assert.equal(lot.famille, 'riz');
  assert.equal(lot.unite, 'g');
  assert.deepEqual(lot.productions.map((p) => p.productionId).sort(), [ids.rizMardi, ids.rizMercredi].sort());
  assert.equal(lot.total, 1000, '500 g + 500 g');
  assert.ok(lot.productions.every((p) => p.cible === 500 && p.evaluation.autorisee));
});

test('lots : une production faite, décidée un autre jour ou sans cible connue n\'entre pas dans un lot', () => {
  const { e, ids } = semaine();
  planifier(e, ids.rizMercredi, S.mardi, 'apres_midi', h());
  assert.equal(lotsPossibles(e, S.lundi).length, 0, 'décidée mardi : plus avançable lundi');
  const { e: e2, ids: ids2 } = semaine();
  marquerFait(e2, ids2.rizMardi, undefined, h(1));
  assert.equal(lotsPossibles(e2, S.lundi).length, 0, 'une seule restante : pas de lot');
  const e3 = etatVide();
  composantValide(e3, S.mardi, 1, RIZ);
  composantValide(e3, S.mercredi, 1, RIZ);
  assert.equal(lotsPossibles(e3, S.lundi).length, 0, 'sans prévision, aucune cible : rien n\'est regroupé');
});

test('lots : le jour même, une production décidée ce jour compte avec celles qu\'on peut avancer', () => {
  const { e, ids } = semaine();
  planifier(e, ids.rizMardi, S.lundi, 'apres_midi', h());
  const lots = lotsPossibles(e, S.lundi);
  assert.equal(lots.length, 1);
  assert.equal(lots[0].productions.length, 2);
});
