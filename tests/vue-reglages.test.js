// Écran Réglages de la refonte 1 (vue-reglages.js) sous faux DOM : racine en sections, informations sans réglage.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom;
let vue;
before(async () => {
  dom = installerFauxDom();
  vue = await import('../app/js/ui/vue-reglages.js');
});
after(() => dom.restaurer());

const hrefs = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href).filter((l) => typeof l === 'string');

test('racine : retour « Aujourd\'hui », titre, sections, les six rubriques dans l\'ordre et Import des menus', () => {
  const r = vue.rendre(etatVide(), null);
  assert.equal(r.tous((x) => x.balise === 'h1')[0].textContent, 'Réglages');
  const retour = r.tous((x) => x.balise === 'a')[0];
  assert.equal(retour.attributs.href, '#/aujourdhui');
  assert.match(retour.textContent, /Aujourd'hui/);
  assert.deepEqual(r.tous((x) => x.balise === 'h2').map((x) => x.textContent),
    ['Règles de production', 'Repères', 'Poste et commandes', 'Affichage', 'Données']);
  assert.deepEqual(hrefs(r).filter((l) => l.startsWith('#/reglages/')), vue.CLES_RUBRIQUES.map((c) => `#/reglages/${c}`));
  assert.ok(hrefs(r).includes('#/import'));
  assert.match(r.textContent, /Import des menus/);
});

test('racine : informations seulement (ni avance −/+, ni planning, taux d\'activité, jours off, thème)', () => {
  const r = vue.rendre(etatVide(), null);
  const t = r.textContent;
  assert.match(t, /Avance normale2 jours \(règle\)/);
  assert.match(t, /suit le réglage du téléphone \(clair \/ sombre\)/);
  assert.match(t, /en Production et en mode poste/);
  assert.equal(boutons(r).length, 0, 'aucun bouton ni interrupteur à la racine');
  assert.equal(r.tous((x) => x.balise === 'input' || x.balise === 'select').length, 0);
  assert.doesNotMatch(t, /Mon planning|Taux d'activité|Jours off|Importer le planning/i);
});

test('racine : pied « Fonctionne hors ligne » et état existant de horsligne.js', () => {
  const t = vue.rendre(etatVide(), null).textContent;
  assert.match(t, /Fonctionne hors ligne/);
  assert.match(t, /hors ligne : vérification en cours|hors ligne prêt|hors ligne indisponible/);
});

test('racine : la semaine type non confirmée est dite « à confirmer » en toutes lettres', () => {
  const e = etatVide();
  e.reglages.semaineTypeConfirmee = false;
  assert.match(vue.rendre(e, null).textContent, /à confirmer/);
  e.reglages.semaineTypeConfirmee = true;
  const lignes = vue.rendre(e, null).tous((x) => x.balise === 'a' && x.attributs.href === '#/reglages/organisation');
  assert.doesNotMatch(lignes[0].textContent, /à confirmer[^·]*·/);
  assert.match(lignes[0].textContent, /semaine type confirmée/);
});

test('sous-pages : lien « ‹ Réglages », titre propre', () => {
  for (const c of vue.CLES_RUBRIQUES) {
    const p = vue.rendre(etatVide(), c);
    assert.equal(p.tous((x) => x.balise === 'a' && x.textContent === '‹ Réglages')[0].attributs.href, '#/reglages');
    assert.equal(p.tous((x) => x.balise === 'h1')[0].textContent, vue.titre(c));
  }
});

test('style : bloc Réglages en fin de feuille, cibles par jeton, légendes à 13 px au moins', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('/* ===== Écran Réglages (refonte 1)'));
  assert.ok(bloc.length > 100);
  assert.match(bloc, /\.reglage-info[^}]*var\(--cible\)/);
  assert.doesNotMatch(bloc, /font-size:\s*(1[0-2]|[0-9])px/);
});
