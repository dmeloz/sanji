// Hors ligne (horsligne.js) : la pastille de Réglages reste neutre pendant la vérification, et une vérification qui ne
// se termine jamais (serviceWorker.ready sans réponse) finit par afficher un problème. Un fichier à part : l'état de
// horsligne.js vit dans le module, il commence ici à « vérification en cours ».

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom;
let horsligne;
let reglages;
before(async () => {
  dom = installerFauxDom();
  horsligne = await import('../app/js/ui/horsligne.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => dom.restaurer());

const pastilles = (noeud) => noeud.tous((x) => x.className.split(' ').includes('pastille'));

test('pendant la vérification, la pastille est neutre : jamais « Fonctionne hors ligne » en vert', () => {
  assert.equal(horsligne.situationHorsLigne().attente, true);
  const pied = reglages.rendre(etatVide(), null).tous((x) => x.className.split(' ').includes('reglages-pied'))[0];
  const [pastille] = pastilles(pied);
  assert.equal(pastille.textContent, 'Vérification en cours');
  assert.ok(pastille.className.split(' ').includes('pastille-gris'));
  assert.doesNotMatch(pied.textContent, /Fonctionne hors ligne/);
});

test('un service worker qui ne répond jamais est signalé au bout du délai maximal', async () => {
  assert.equal(horsligne.DELAI_MAX_MS, 10000);
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { serviceWorker: { register: async () => ({}), ready: new Promise(() => {}) } },
  });
  try {
    assert.equal(horsligne.problemeHorsLigne(), null, 'avant : attente, rien à montrer');
    const garde = setInterval(() => {}, 1000); // le faux DOM détache les minuteurs : garder la boucle vivante
    try { await horsligne.preparerHorsLigne({ delaiMax: 30 }); } finally { clearInterval(garde); }
  } finally {
    if (avant) Object.defineProperty(globalThis, 'navigator', avant); else delete globalThis.navigator;
  }
  assert.equal(horsligne.situationHorsLigne().attente, false);
  assert.match(horsligne.problemeHorsLigne(), /le service worker ne répond pas/);
  const pied = reglages.rendre(etatVide(), null).tous((x) => x.className.split(' ').includes('reglages-pied'))[0];
  assert.equal(pastilles(pied)[0].textContent, 'Hors ligne pas encore prêt');
});
