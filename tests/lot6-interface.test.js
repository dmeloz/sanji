// Lot 6 — Réglages, Données, Fiches des éléments et Historique sous faux DOM.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom; let reglages; let fiches; let historique;
before(async () => {
  dom = installerFauxDom();
  reglages = await import('../app/js/ui/vue-reglages.js');
  fiches = await import('../app/js/ui/vue-fiches-elements.js');
  historique = await import('../app/js/ui/vue-historique.js');
});
after(() => dom.restaurer());
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));

test('Réglages : groupes lisibles en cartes, toutes les rubriques gardent leur accès', () => {
  const page = reglages.rendre(etatVide());
  assert.deepEqual(page.tous((x) => x.balise === 'h2').map((x) => x.textContent), ['Production', 'Poste', 'Assistant', 'Données']);
  assert.equal(page.tous((x) => x.balise === 'a' && x.attributs.href?.startsWith('#/reglages/')).length, reglages.CLES_RUBRIQUES.length);
  assert.equal(parClasse(page, 'reglages-groupe').length, 4, 'un groupe par titre');
});

test('Données : sauvegarde, copies, état, journal et remise à neuf ont des repères distincts', () => {
  const page = reglages.rendre(etatVide(), 'donnees');
  assert.ok(page.className.includes('vue-reglages-donnees'));
  assert.deepEqual(page.tous((x) => x.balise === 'h2').map((x) => x.textContent), [
    'Sauvegarde', 'Copies automatiques', "État de l'application", 'Journal des modifications', 'Repartir à neuf',
  ]);
  assert.ok(parClasse(page, 'reglage-danger').length > 0, 'zone de remise à neuf repérée');
});

test('Fiches des éléments : recherche et cinq rubriques se repèrent comme sections distinctes', () => {
  const page = fiches.rendre(etatVide());
  assert.deepEqual(parClasse(page, 'fe-rubrique').map((x) => x.attributs['aria-label']), [
    'Pâtes et féculents', 'Sauces', 'Légumes et garnitures', 'Produits', 'Autres',
  ]);
  assert.equal(parClasse(page, 'fe-recherche').length, 1, 'champ de recherche présent');
});

test('Historique : lignes hebdomadaires en cartes, dates et indicateurs gardent une colonne stable', () => {
  const page = historique.rendre(etatVide());
  assert.ok(page.className.includes('vue-historique'));
  assert.match(page.textContent, /Aucune semaine passée/);
});
