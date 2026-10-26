// Lot 6 — Réglages, Données, Fiches des éléments et Historique sous faux DOM.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom; let reglages; let fiches; let historique; let css;
before(async () => {
  dom = installerFauxDom();
  reglages = await import('../app/js/ui/vue-reglages.js');
  fiches = await import('../app/js/ui/vue-fiches-elements.js');
  historique = await import('../app/js/ui/vue-historique.js');
  css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
});
after(() => dom.restaurer());
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));

test('Réglages : groupes lisibles en cartes, toutes les rubriques gardent leur accès', () => {
  const page = reglages.rendre(etatVide());
  assert.deepEqual(page.tous((x) => x.balise === 'h2').map((x) => x.textContent), ['Production', 'Poste', 'Assistant', 'Données']);
  assert.equal(page.tous((x) => x.balise === 'a' && x.attributs.href?.startsWith('#/reglages/')).length, reglages.CLES_RUBRIQUES.length);
  assert.match(css, /\.vue-reglages-racine \.reglages-groupe\s*\{[^}]*background:\s*var\(--carte\)/);
  assert.doesNotMatch(css, /reglages-groupe-titre::before/, 'les rubriques ne sont pas numérotées : ce ne sont pas des étapes');
});

test('Données : sauvegarde, copies, état, journal et remise à neuf ont des repères distincts', () => {
  const page = reglages.rendre(etatVide(), 'donnees');
  assert.ok(page.className.includes('vue-reglages-donnees'));
  assert.deepEqual(page.tous((x) => x.balise === 'h2').map((x) => x.textContent), [
    'Sauvegarde', 'Copies automatiques', "État de l'application", 'Journal des modifications', 'Repartir à neuf',
  ]);
  assert.match(css, /\.vue-reglages-donnees\s*>\s*\.carte\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.vue-reglages-donnees \.reglage-danger/);
});

test('Fiches des éléments : recherche et cinq rubriques se repèrent comme sections distinctes', () => {
  const page = fiches.rendre(etatVide());
  assert.deepEqual(parClasse(page, 'fe-rubrique').map((x) => x.attributs['aria-label']), [
    'Pâtes et féculents', 'Sauces', 'Légumes et garnitures', 'Produits', 'Autres',
  ]);
  assert.match(css, /\.vue-fiches-elements \.fe-rubrique\s*\{[^}]*background:\s*var\(--carte\)/);
  assert.match(css, /\.vue-fiches-elements \.fe-recherche\s*\{[^}]*min-height:\s*var\(--cible\)/);
});

test('Historique : lignes hebdomadaires en cartes, dates et indicateurs gardent une colonne stable', () => {
  const page = historique.rendre(etatVide());
  assert.ok(page.className.includes('vue-historique'));
  assert.match(page.textContent, /Aucune semaine passée/);
  assert.match(css, /\.vue-historique \.hist-semaine\s*\{[^}]*background:\s*var\(--carte\)/);
  assert.match(css, /\.vue-historique \.hist-qte\s*\{[^}]*min-width/);
});

test('Lot 6 : les feuilles restent accessibles au toucher et sans listes déroulantes', () => {
  const bloc = css.slice(css.indexOf('/* ===== Refonte 3 — lot 6'));
  assert.match(bloc, /min-height:\s*var\(--cible\)/);
  assert.match(bloc, /font(-size)?:\s*var\(--t-corps\)/);
  assert.doesNotMatch(bloc, /gradient|details\s*\{/);
});
