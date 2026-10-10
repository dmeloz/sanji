// Carte « Fin de semaine » (v115) : le rappel de clôture est une carte visible sous « Prochaine » le samedi dès 18:00 et le dimanche.
// Faux DOM : ni mise en page ni tactile réels (à vérifier à l'écran à 390 px).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { retenirTelQuel } from '../app/js/domaine/actions-fiches.js';
import { etatVide, h } from './aide.js';

const LUNDI = '2026-10-12';
let dom;
let magasin;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-aujourdhui.js');
});
after(() => dom.restaurer());

function aLHeure(iso, heure, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T${heure}:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const page = (iso, heure, etat) => aLHeure(iso, heure, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat()); });
const carteDe = (p) => p.tous((x) => x.balise === 'section' && x.attributs['aria-label'] === 'Fin de semaine')[0];
const rappels = (p) => p.tous((x) => x.balise === 'nav' && x.attributs['aria-label'] === 'Rappels')[0];
const AVEC_PLAT = () => {
  const e = etatVide();
  definirMenu(e, LUNDI, 1, 'Gnocchi alla sorrentina', h());
  return e;
};

test('la carte « Fin de semaine » est présente le samedi à 18:00 et le dimanche avec un plat non retenu', () => {
  for (const [jour, heure] of [['2026-10-17', '18:00'], ['2026-10-18', '09:00']]) {
    const carte = carteDe(page(jour, heure, AVEC_PLAT()));
    assert.ok(carte, `${jour} ${heure}`);
    assert.match(carte.textContent, /Fin de semaine/);
    assert.match(carte.textContent, /Retenir les plats de la semaine · 1 à retenir/);
    assert.ok(boutons(carte).some((b) => b.textContent === 'Retenir les plats'));
  }
});

test('la carte est absente le samedi à 17:59, en semaine et quand tout est retenu', () => {
  assert.equal(carteDe(page('2026-10-17', '17:59', AVEC_PLAT())), undefined);
  assert.equal(carteDe(page('2026-10-14', '20:00', AVEC_PLAT())), undefined);
  const e = AVEC_PLAT();
  retenirTelQuel(e, LUNDI, 1, h(1));
  assert.equal(carteDe(page('2026-10-18', '09:00', e)), undefined);
});

test('la carte précède les Rappels et la ligne « Retenir les plats » n\'y figure plus', () => {
  const p = page('2026-10-18', '09:00', AVEC_PLAT());
  const ordre = p.tous(() => true);
  const r = rappels(p);
  if (r) {
    assert.ok(ordre.indexOf(carteDe(p)) < ordre.indexOf(r));
    assert.ok(!boutons(r).some((b) => /Retenir les plats/.test(b.textContent)));
  }
  assert.equal(boutons(p).filter((b) => /Retenir les plats/.test(b.textContent)).length, 1, 'un seul accès');
});

test('le bouton « Retenir les plats » ouvre la feuille de clôture', () => {
  const p = page('2026-10-18', '09:00', AVEC_PLAT());
  aLHeure('2026-10-18', '09:00', () => boutons(carteDe(p)).find((b) => b.textContent === 'Retenir les plats').click());
  const feuilles = dom.corps.tous((x) => x.balise === 'dialog' && x.open);
  assert.ok(feuilles.some((f) => /Retenir les plats de la semaine/.test(f.textContent)));
  dom.corps.tous((x) => x.balise === 'dialog').forEach((dl) => dl.remove());
});
