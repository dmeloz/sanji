// Menu du jour sur Production : intitulés du jour affiché, rien le week-end, « non saisi », lien vers la Semaine. Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const page = (etat, date) => aDate(S.lundi, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat(), date); });

function avecMenus() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'INTITULE_M1_LUNDI_TEST', h());
  definirMenu(e, S.mardi, 1, 'INTITULE_M1_MARDI_TEST', h());
  definirMenu(e, S.mardi, 2, 'INTITULE_M2_MARDI_TEST', h());
  return e;
}

test('Production : le menu du jour suit le jour affiché (Aujourd\'hui puis Demain), avec lien vers la Semaine', () => {
  const e = avecMenus();
  const auj = classes(page(e, S.lundi), 'mj-bloc')[0];
  assert.match(auj.textContent, /M1 · INTITULE_M1_LUNDI_TEST/);
  assert.doesNotMatch(auj.textContent, /MARDI/);
  assert.equal(auj.attributs.href, `#/semaine/${S.lundi}`);
  const dem = classes(page(e, S.mardi), 'mj-bloc')[0];
  assert.match(dem.textContent, /M1 · INTITULE_M1_MARDI_TEST/);
  assert.match(dem.textContent, /M2 · INTITULE_M2_MARDI_TEST/);
  assert.equal(dem.attributs.href, `#/semaine/${S.mardi}`);
});

test('Production : un menu non saisi est dit « non saisi »', () => {
  const bloc = classes(page(avecMenus(), S.lundi), 'mj-bloc')[0];
  assert.match(bloc.textContent, /M2 · non saisi/);
});

test('Production : aucun menu saisi un jour ouvert, une ligne discrète vers l\'import de la semaine', () => {
  const p = page(etatVide(), S.lundi);
  assert.equal(classes(p, 'mj-bloc').length, 0);
  const ligne = classes(p, 'mj-vide')[0];
  assert.match(ligne.textContent, /Menu non saisi · Importer ›/);
  assert.ok(ligne.tous((x) => x.balise === 'a').some((a) => a.attributs.href === `#/import/${S.lundi}`));
});

test('Production : rien le samedi ni le dimanche', () => {
  for (const d of [S.samedi, S.dimanche]) {
    const p = page(avecMenus(), d);
    assert.equal(classes(p, 'mj-bloc').length + classes(p, 'mj-vide').length, 0, d);
  }
});
