// Fermer une feuille en la tirant vers le bas (poignée ou titre). Données TEST_ONLY.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { fermerParGlisse } from '../app/js/ui/glisser.js';

let dom; let panneau;
before(async () => { dom = installerFauxDom(); ({ panneau } = await import('../app/js/ui/panneau.js')); });
after(() => dom.restaurer());

const poignee = (d) => d.tous((x) => x.className === 'panneau-poignee')[0];
const titre = (d) => d.tous((x) => x.className.includes('panneau-titre'))[0];
const doigt = (y) => ({ touches: [{ clientY: y }], changedTouches: [{ clientY: y }] });

test('fermerParGlisse : seuil de 80 px, ou geste vif, jamais vers le haut ni sur place', () => {
  assert.equal(fermerParGlisse({ dy: 100, dt: 600 }), true);
  assert.equal(fermerParGlisse({ dy: 80, dt: 900 }), true);
  assert.equal(fermerParGlisse({ dy: 79, dt: 900 }), false, 'court et lent');
  assert.equal(fermerParGlisse({ dy: 40, dt: 50 }), true, 'court mais vif');
  assert.equal(fermerParGlisse({ dy: 10, dt: 5 }), false, 'frémissement');
  assert.equal(fermerParGlisse({ dy: -200, dt: 100 }), false, 'vers le haut');
  assert.equal(fermerParGlisse({ dy: 0, dt: 0 }), false);
});

test('la poignée et le titre portent les écouteurs, le corps défilant non', () => {
  const d = panneau({ titre: 'Essai', corps: [] });
  for (const zone of [poignee(d), titre(d)]) for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.ok(zone.ecouteurs[t]?.length, t);
  const corps = d.tous((x) => x.className === 'panneau-corps')[0];
  assert.equal(Object.keys(corps.ecouteurs).some((t) => t.startsWith('touch')), false);
  d.close();
});

test('un long glissement depuis la poignée ferme la feuille (close), un glissement court ne la ferme pas', async () => {
  const d = panneau({ titre: 'Essai', corps: [] });
  let fermee = 0;
  d.addEventListener('close', () => { fermee += 1; });
  await poignee(d).declencher('touchstart', doigt(100));
  await poignee(d).declencher('touchmove', doigt(130));
  await poignee(d).declencher('touchend', doigt(130));
  assert.equal(d.open, true);
  assert.equal(fermee, 0);
  await titre(d).declencher('touchstart', doigt(100));
  await titre(d).declencher('touchend', doigt(220));
  assert.equal(d.open, false);
  assert.equal(fermee, 1);
  assert.equal(panneauxOuverts(dom.corps).includes(d), false);
});

test('un geste annulé (touchcancel) ne ferme pas', async () => {
  const d = panneau({ titre: 'Essai', corps: [] });
  await poignee(d).declencher('touchstart', doigt(100));
  await poignee(d).declencher('touchcancel', {});
  await poignee(d).declencher('touchend', doigt(300));
  assert.equal(d.open, true);
  d.close();
});
