// Onglet Cuisine (refonte, étape 6) sous faux DOM : remarques de Sanji, fiches par rubrique, portions et règles, réglages de l'app.
// Ni mise en page ni navigateur (à vérifier à l'écran à 390 px).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom; let magasin; let routeur; let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vue = await import('../app/js/ui/vue-cuisine.js');
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
const hrefs = (noeud) => noeud.tous((x) => x.balise === 'a').map((a) => a.attributs.href);

test('route et onglet : #/cuisine est une vue ; Cuisine, Réglages et Fiches des éléments allument l\'onglet Cuisine', () => {
  assert.deepEqual(routeur.analyserHash('#/cuisine', '2026-10-05'), { vue: 'cuisine', param: null });
  assert.equal(routeur.VUES.cuisine, vue);
  assert.equal(vue.titre(), 'Cuisine');
  for (const v of ['cuisine', 'reglages', 'fiches']) assert.equal(routeur.ONGLET_DE_VUE[v], 'cuisine', v);
});

test('état vide : un seul titre de page, trois sections, les cinq rubriques métier puis les réglages de l\'app ; pas de carte de remarques', () => {
  const p = vue.rendre(etatVide());
  assert.deepEqual(p.tous((x) => x.balise === 'h1').map((x) => x.textContent), ['Cuisine']);
  assert.deepEqual(p.tous((x) => x.balise === 'h2').map((x) => x.textContent), ['Fiches des éléments', 'Portions et règles', 'Application']);
  assert.deepEqual(hrefs(p), ['#/fiches', '#/reglages/standards', '#/reglages/standards-base', '#/reglages/organisation', '#/reglages/reperes', '#/reglages/produits', '#/reglages']);
  assert.match(p.textContent, /Aucune fiche pour l'instant/);
  assert.match(p.textContent, /avance normale : 2 jours/);
  assert.equal(classes(p, 'cui-remarques').length, 0);
  assert.equal(boutons(p).length, 0, 'la page ne fait que mener : aucun réglage ici');
});

test('fiches : une ligne par rubrique non vide, avec son nombre, puis la recherche', () => {
  const e = etatVide();
  e.fiches_retenues = {
    penne: { nom: 'Penne', categorie: 'feculent', role: 'plat_principal', attribue: true },
    'sauce tomate': { nom: 'Sauce tomate', categorie: 'sauce', role: 'sauce', attribue: true },
  };
  const p = vue.rendre(e);
  const lignes = classes(p, 'cui-ligne').filter((a) => a.attributs.href === '#/fiches');
  const total = lignes.at(-1).textContent;
  assert.match(total, /Chercher un élément/);
  assert.ok(lignes.length >= 2, 'au moins une rubrique et la recherche');
  assert.ok(lignes.slice(0, -1).every((a) => classes(a, 'cui-ligne-nombre').length === 1), 'chaque rubrique dit son nombre');
});

test('« Sanji a remarqué » : une correction répétée devient une carte, avec un bouton qui ouvre la feuille de décision', async () => {
  const { composantVide } = await import('../app/js/domaine/etat.js');
  const e = etatVide();
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  const p = aDate('2026-10-05', () => { magasin.remplacer(e); return vue.rendre(magasin.etat()); });
  const carte = classes(p, 'cui-remarques')[0];
  assert.match(carte.textContent, /Sanji a remarqué · 1/);
  assert.match(carte.textContent, /Vous corrigez souvent riz/);
  const bouton = boutons(carte)[0];
  assert.equal(bouton.textContent, 'Voir et décider');
  await bouton.click();
  assert.ok(dom.corps.tous((x) => x.balise === 'dialog').length > 0, 'la feuille de la proposition s\'ouvre');
  dom.corps.tous((x) => x.balise === 'dialog').forEach((d) => d.remove());
});

test('CSS : bloc de l\'onglet Cuisine, texte à 15 px au moins, nombre en police des quantités, rien en hex', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('Onglet Cuisine, refonte étape 6'));
  assert.ok(bloc.length > 100);
  assert.ok([...bloc.matchAll(/font-size: (\d+)px/g)].every((m) => Number(m[1]) >= 15));
  assert.match(bloc, /\.cui-ligne-nombre \{[^}]*var\(--police-qte\)/);
  assert.doesNotMatch(bloc, /#[0-9a-fA-F]{3,6}\b/);
});
