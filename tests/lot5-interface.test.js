// Lot 5 — balayage de Semaine et états vides d’Articles.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { figerHorloge, installerFauxDom } from './aide-dom.js';
import { planifier } from '../app/js/domaine/actions.js';
import { principaleDe } from './aide.js';
import { etatVide, h, composantValide, prevision, menuValide } from './aide.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

let dom; let restore; let magasin; let semaine; let articles;
before(async () => {
  restore = figerHorloge(S.lundi);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  semaine = await import('../app/js/ui/vue-tableau.js');
  articles = await import('../app/js/ui/vue-articles.js');
});
after(() => { dom.restaurer(); restore(); articles.oublierVue(); });
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));

test('Semaine : les jours ont une carte de lecture stable et gardent les menus M1/M2 séparés', () => {
  const e = etatVide();
  for (const menu of [1, 2]) { menuValide(e, S.lundi, menu, 'MENU_TEST'); prevision(e, S.lundi, menu, 20); }
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_TEST_M1' });
  composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_TEST_M2' });
  const page = semaine.rendre(e, S.lundi);
  const jours = parClasse(page, 'bord-jour');
  assert.ok(jours.length > 0);
  assert.ok(jours.some((jour) => parClasse(jour, 'bord-menu').length === 2));
});

test('Articles : semaine sans article dit quelle période manque et mène à l’import', () => {
  articles.oublierVue(); magasin.remplacer(etatVide());
  const page = articles.rendre(magasin.etat());
  assert.match(page.textContent, /Aucun article sur les deux prochaines semaines/);
  assert.ok(page.tous((x) => x.balise === 'a' && x.getAttribute('href') === `#/import/${S.lundi}`).length > 0);
});

test('Articles : journée vide alors que la semaine a des articles propose la semaine de production', () => {
  articles.oublierVue();
  const e = etatVide();
  prevision(e, S.mardi, 1, 20);
  const composant = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_MARDI_TEST' });
  planifier(e, principaleDe(e, composant), S.mardi, h());
  magasin.remplacer(e);
  const page = articles.rendre(magasin.etat());
  const jour = page.tous((x) => x.balise === 'button' && x.textContent === "Aujourd'hui")[0];
  jour.click();
  const vide = parClasse(articles.rendre(magasin.etat()), 'art-vide-aujourdhui')[0];
  assert.ok(vide);
  assert.match(vide.textContent, /Aucun article n’est prévu pour aujourd’hui/);
  const b = vide.tous((x) => x.balise === 'button' && x.textContent === 'Voir la liste de la semaine')[0];
  assert.ok(b, 'un bouton ramène à la liste de la semaine, dans Articles');
  b.declencher('click');
  assert.ok(parClasse(articles.rendre(magasin.etat()), 'art-jour').length > 0, 'la liste de la semaine est de nouveau affichée');
});
