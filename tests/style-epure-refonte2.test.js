// Style épuré partout (refonte 2, décision du 2026-10-07) : étiquettes avec icône + mot, listes à plat, jour en cours en encre.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h as horloge } from './aide.js';

let dom;
let pastille;
let reglages;
let tableau;
before(async () => {
  dom = installerFauxDom();
  ({ pastille } = await import('../app/js/ui/elements.js'));
  reglages = await import('../app/js/ui/vue-reglages.js');
  tableau = await import('../app/js/ui/vue-tableau.js');
});
after(() => dom.restaurer());

const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const bloc = css.slice(css.indexOf('/* ===== Style épuré partout'));

for (const [ton, classe] of [['ambre', 'etq-ambre'], ['vert', 'etq-action'], ['rouge', 'etq-rouge'], ['ia', 'etq-ia'], ['chef', 'etq-chef']]) {
  test(`pastille ${ton} : icône SVG décorative + mot, classe ${classe}`, () => {
    // Act
    const p = pastille('à confirmer', ton);
    // Assert
    const [icone] = p.tous((x) => x.balise === 'svg');
    assert.ok(icone, 'une icône');
    assert.equal(icone.attributs['aria-hidden'], 'true');
    assert.equal(p.textContent, 'à confirmer');
    assert.ok(p.className.split(' ').includes(classe));
    assert.ok(p.className.split(' ').includes(`pastille-${ton}`), 'ancien nom de classe conservé');
  });
}

test('pastille neutre : le mot seul, sans icône', () => {
  const p = pastille('version 3', 'gris');
  assert.equal(p.tous((x) => x.balise === 'svg').length, 0);
  assert.equal(p.textContent, 'version 3');
});

test('Réglages : la liste des rubriques est une liste à plat, sans carte autour', () => {
  const racine = reglages.rendre(etatVide(), null);
  const listes = classes(racine, 'liste-rubriques-reglages');
  assert.ok(listes.length > 0);
  for (const l of listes) {
    assert.ok(l.className.split(' ').includes('liste'));
    assert.ok(!l.parent.className.split(' ').includes('carte'));
  }
  assert.match(css, /\.liste-rubriques-reglages \{[^}]*background: transparent/);
});

test('Semaine : la liste des jours est à plat et le jour en cours est en encre, pas en bleu clair', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz et carottes', horloge());
  const noeud = tableau.rendre(e, S.lundi);
  assert.ok(classes(noeud, 'bord-jours').every((ul) => ul.className.split(' ').includes('liste')));
  assert.match(bloc, /\.bord-aujourdhui \{[^}]*background: var\(--encre\)/);
  assert.match(bloc, /\.vue-semaine-globale \.bord-zone \{[^}]*background: transparent/);
});

test('CSS ajouté : aucune couleur hexadécimale, aucune police sous 15 px, aucune valeur sombre', () => {
  assert.ok(bloc.length > 100);
  const etq = css.slice(css.indexOf("/* Étiquettes d'état"), css.indexOf('.btn {', css.indexOf("/* Étiquettes d'état")));
  for (const b of [bloc, etq]) {
    assert.doesNotMatch(b, /#[0-9a-fA-F]{3,6}\b/);
    assert.doesNotMatch(b, /font-size: ?(1[0-4]|[0-9])px/);
    assert.doesNotMatch(b, /prefers-color-scheme/);
  }
});
