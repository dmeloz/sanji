// Écran Réglages de la refonte 1 (vue-reglages.js) sous faux DOM : racine en sections, informations sans réglage.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom;
let vue; let cuisine;
before(async () => {
  dom = installerFauxDom();
  vue = await import('../app/js/ui/vue-reglages.js');
  cuisine = await import('../app/js/ui/vue-cuisine.js');
});
after(() => dom.restaurer());

const hrefs = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href).filter((l) => typeof l === 'string');

test('racine (étape 6) : retour « Cuisine », titre, deux sections ; les rubriques métier n\'y sont plus', () => {
  const r = vue.rendre(etatVide(), null);
  assert.equal(r.tous((x) => x.balise === 'h1')[0].textContent, 'Réglages de l\'app');
  const retour = r.tous((x) => x.balise === 'a')[0];
  assert.equal(retour.attributs.href, '#/cuisine');
  assert.match(retour.textContent, /Cuisine/);
  assert.deepEqual(r.tous((x) => x.balise === 'h2').map((x) => x.textContent),
    ['Application', 'Outils avancés']);
  assert.deepEqual(hrefs(r).filter((l) => l.startsWith('#/reglages/')), ['#/reglages/donnees', '#/reglages/assistant-ia', '#/reglages/apprentissage']);
  assert.ok(hrefs(r).includes('#/historique'));
  assert.doesNotMatch(r.textContent, /Standards maison|Import des menus/);
});

test('racine : informations seulement (ni avance −/+, ni planning, taux d\'activité, jours off, thème)', () => {
  const r = vue.rendre(etatVide(), null);
  const t = r.textContent;
  assert.match(t, /Apparence : toujours claire/);
  assert.match(t, /en Production et en mode poste/);
  assert.deepEqual(boutons(r).map((b) => b.textContent), ['Vérifier les mises à jour'], 'un seul bouton à la racine : la vérification des mises à jour');
  assert.equal(r.tous((x) => x.balise === 'input' || x.balise === 'select').length, 0);
  assert.doesNotMatch(t, /Mon planning|Taux d'activité|Jours off|Importer le planning/i);
});

test('racine : pied neutre pendant la vérification (jamais « Fonctionne hors ligne ») et état existant de horsligne.js', () => {
  const t = vue.rendre(etatVide(), null).textContent;
  assert.match(t, /Vérification en cours/);
  assert.doesNotMatch(t, /Fonctionne hors ligne/);
  assert.match(t, /hors ligne : vérification en cours/);
});

test('Cuisine : la ligne des avances ne parle plus de semaine type (v134), seulement des règles de préparation', () => {
  const e = etatVide();
  const lignes = cuisine.rendre(e).tous((x) => x.balise === 'a' && x.attributs.href === '#/reglages/organisation');
  assert.doesNotMatch(lignes[0].textContent, /semaine type|à confirmer|créneau/i);
  assert.match(lignes[0].textContent, /règle de préparation/);
  assert.doesNotMatch(vue.rendre(e, 'organisation').textContent, /semaine type|créneau|capacité/i);
});

test('sous-pages : lien de retour (« ‹ Cuisine » pour le métier, « ‹ Réglages » sinon), titre propre', () => {
  for (const c of vue.CLES_RUBRIQUES) {
    const p = vue.rendre(etatVide(), c);
    const metier = ['standards-base', 'standards', 'reperes', 'organisation', 'produits'].includes(c);
    assert.equal(p.tous((x) => x.balise === 'a' && x.textContent === (metier ? '‹ Cuisine' : '‹ Réglages'))[0].attributs.href, metier ? '#/cuisine' : '#/reglages');
    assert.equal(p.tous((x) => x.balise === 'h1')[0].textContent, vue.titre(c));
  }
});

test('style : bloc Réglages en fin de feuille, cibles par jeton, légendes à 15 px au moins', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('/* ===== Écran Réglages (refonte 1)'));
  assert.ok(bloc.length > 100);
  assert.match(bloc, /\.reglage-info[^}]*var\(--cible\)/);
  assert.doesNotMatch(bloc, /font-size:\s*(1[0-4]|[0-9])px/);
});
