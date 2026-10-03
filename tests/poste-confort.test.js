// Confort au poste (reprises de Kōzō) : écran maintenu allumé sur la feuille du jour, glissement horizontal pour
// changer de jour. Fonctions sans DOM réel : l'API d'écran allumé est simulée.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ecranAllumePossible, maintenirAllume, reprendreSiVisible } from '../app/js/ui/ecran-allume.js';
import { directionDuGeste } from '../app/js/ui/glisser.js';

function simulerEcran({ refuse = false } = {}) {
  const compteurs = { demandes: 0, relaches: 0 };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: {
    wakeLock: {
      request: async () => {
        compteurs.demandes += 1;
        if (refuse) throw new Error('refusé');
        return { addEventListener() {}, release: async () => { compteurs.relaches += 1; } };
      },
    },
  } });
  return compteurs;
}

test('écran allumé : demandé une fois sur la feuille du jour, relâché en la quittant', async () => {
  const c = simulerEcran();
  assert.equal(ecranAllumePossible(), true);
  await maintenirAllume(true);
  await maintenirAllume(true);
  assert.equal(c.demandes, 1, 'pas de demande en double');
  await maintenirAllume(false);
  assert.equal(c.relaches, 1);
  await maintenirAllume(false);
  assert.equal(c.relaches, 1, 'rien à relâcher la seconde fois');
});

test('écran allumé : le verrou est repris au retour au premier plan, et un refus n\'est pas une erreur', async () => {
  const c = simulerEcran();
  await maintenirAllume(true);
  await maintenirAllume(false);
  await maintenirAllume(true);
  assert.equal(c.demandes, 2);
  const refus = simulerEcran({ refuse: true });
  await maintenirAllume(false);
  await assert.doesNotReject(maintenirAllume(true));
  await assert.doesNotReject(reprendreSiVisible());
  assert.ok(refus.demandes >= 1);
  await maintenirAllume(false);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: {} });
  assert.equal(ecranAllumePossible(), false, 'sans l\'API : rien ne s\'affiche, rien ne casse');
  await assert.doesNotReject(maintenirAllume(true));
  await maintenirAllume(false);
});

test('glissement : un geste net et horizontal change de jour, un défilement vertical ne le fait pas', () => {
  assert.equal(directionDuGeste({ dx: -120, dy: 10, dt: 200 }), 'suivant');
  assert.equal(directionDuGeste({ dx: 120, dy: -10, dt: 200 }), 'precedent');
  assert.equal(directionDuGeste({ dx: -40, dy: 5, dt: 150 }), null, 'trop court');
  assert.equal(directionDuGeste({ dx: -120, dy: 90, dt: 200 }), null, 'plutôt vertical : c\'est un défilement');
  assert.equal(directionDuGeste({ dx: -150, dy: 5, dt: 1500 }), null, 'trop lent : pas un geste de feuilletage');
  assert.equal(directionDuGeste({ dx: 0, dy: 0, dt: 0 }), null);
});

test('impression : une feuille de style d\'impression masque la navigation et les boutons, pas les mentions d\'incertitude', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('@media print'));
  assert.match(bloc, /\.onglets/);
  assert.match(bloc, /button/);
  assert.doesNotMatch(bloc, /\.pastille[^{]*\{[^}]*display:\s*none/, 'les pastilles « estimation à valider » restent imprimées');
});
