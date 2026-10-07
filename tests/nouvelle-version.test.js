// Bandeau « Nouvelle version prête » (v100) : il n'apparaît que lorsqu'un nouveau service worker prend la main sur une page déjà
// pilotée par l'ancien (jamais à la première installation), propose un seul geste, et ne s'affiche qu'une fois.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';

let dom;
let mod;
before(async () => {
  dom = installerFauxDom();
  mod = await import('../app/js/ui/nouvelle-version.js');
});
after(() => dom.restaurer());

function fauxConteneur(controller) {
  const ecouteurs = {};
  return {
    controller,
    addEventListener: (nom, f) => { ecouteurs[nom] = f; },
    declencher: () => ecouteurs.controllerchange?.(),
  };
}

test('bandeau : le texte dit que la version est prête et le bouton « Mettre à jour » recharge', () => {
  let rechargee = 0;
  const b = mod.bandeauNouvelleVersion(() => { rechargee += 1; });
  assert.match(b.textContent, /Nouvelle version prête/);
  const [bouton] = b.tous((x) => x.balise === 'button');
  assert.equal(bouton.textContent, 'Mettre à jour');
  bouton.click();
  assert.equal(rechargee, 1);
});

test('surveiller : un nouveau worker qui prend la main sur une page déjà pilotée affiche le bandeau, une seule fois', () => {
  const conteneur = fauxConteneur({});
  let montre = 0;
  mod.surveillerNouvelleVersion(conteneur, () => { montre += 1; });
  conteneur.declencher();
  conteneur.declencher();
  assert.equal(montre, 1);
});

test('surveiller : première installation (aucun worker avant) ne montre rien', () => {
  const conteneur = fauxConteneur(null);
  let montre = 0;
  mod.surveillerNouvelleVersion(conteneur, () => { montre += 1; });
  conteneur.declencher();
  assert.equal(montre, 0);
});

test('surveiller : sans service worker (conteneur absent), rien ne plante', () => {
  assert.doesNotThrow(() => mod.surveillerNouvelleVersion(undefined, () => {}));
});
