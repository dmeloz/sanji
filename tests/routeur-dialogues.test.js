// Routeur : un dialogue resté ouvert se ferme au changement de page, mais pas quand seul l'état change (même page).
// Faux DOM : pas de vrai <dialog> (ni Échap ni focus réels).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom;
let routeur;
let magasin;
let panneau;
before(async () => {
  dom = installerFauxDom();
  const zone = globalThis.document.createElement('div');
  zone.setAttribute('id', 'vue');
  dom.corps.appendChild(zone);
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  ({ panneau } = await import('../app/js/ui/panneau.js'));
  magasin.remplacer(etatVide());
});
after(() => dom.restaurer());

test('un dialogue ouvert se ferme au changement de page ; un simple redessin de la même page le laisse ouvert', () => {
  globalThis.location.hash = '#/aujourdhui';
  routeur.rendre();
  panneau({ titre: 'DIALOGUE_TEST', corps: [], lectureSeule: true });
  assert.equal(panneauxOuverts(dom.corps).length, 1);
  routeur.rendre(); // même page (changement d'état) : le dialogue reste
  assert.equal(panneauxOuverts(dom.corps).length, 1, 'même page : il reste ouvert');
  globalThis.location.hash = '#/semaine';
  routeur.rendre();
  assert.equal(panneauxOuverts(dom.corps).length, 0, 'autre page : il est fermé');
  assert.equal(dom.corps.tous((x) => x.balise === 'dialog').length, 0, 'et retiré du document');
});
