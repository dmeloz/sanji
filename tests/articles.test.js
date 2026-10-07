// Onglet Articles (décision du 2026-10-07, « sans gestion de stock ») : la liste simple des articles du poste, par jour et par menu,
// lue dans les composants au poste (même source que les besoins de produits). Cocher une ligne est un geste durable de l'état.
// Jeux TEST_ONLY : dates de tests/jeux/TEST_ONLY-semaine.js (2026-10-05 est un lundi).

import test from 'node:test';
import assert from 'node:assert/strict';
import { cocherArticle } from '../app/js/domaine/actions-articles.js';
import { articlesDuPoste } from '../app/js/domaine/articles.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

/** Lundi : un produit au menu 1 ; mardi : un produit au menu 2 et un sans prévision (quantité à compléter). */
function semaine() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.mardi, 2, 20);
  const a = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_TEST' });
  const b = composantValide(e, S.mardi, 2, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_MARDI_TEST' });
  const c = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_SANS_PREVISION_TEST' });
  return { e, a, b, c };
}
const aplatir = (r) => r.jours.flatMap((j) => j.articles.map((x) => ({ date: j.date, ...x })));

test('articles : par jour et par menu, la quantité brute calculée et son unité', () => {
  const { e, a } = semaine();
  const r = articlesDuPoste(e, S.lundi);
  assert.equal(r.lundi, S.lundi);
  assert.deepEqual(r.jours.map((j) => j.date), [S.lundi, S.mardi]);
  assert.equal(r.jours[0].estAujourdhui, true);
  assert.equal(r.jours[1].estAujourdhui, false);
  const lundi = r.jours[0].articles;
  assert.equal(lundi.length, 1);
  const calc = calculerComposant(e, a);
  assert.deepEqual([lundi[0].nom, lundi[0].menu, lundi[0].quantite, lundi[0].unite, lundi[0].aCompleter], ['ARTICLE_LUNDI_TEST', 1, calc.brut, calc.uniteTravail, false]);
  const mardi = r.jours[1].articles;
  assert.deepEqual(mardi.map((x) => [x.menu, x.nom]), [[1, 'ARTICLE_SANS_PREVISION_TEST'], [2, 'ARTICLE_MARDI_TEST']], 'menu 1 puis menu 2');
});

test('articles : une quantité inconnue reste « à compléter », sans quantité inventée', () => {
  const { e } = semaine();
  const sans = aplatir(articlesDuPoste(e, S.lundi)).find((x) => x.nom === 'ARTICLE_SANS_PREVISION_TEST');
  assert.equal(sans.aCompleter, true);
  assert.equal(sans.quantite, null);
  assert.equal(sans.unite, null);
});

test('articles : seuls les jours à venir de la semaine du jour ; le dimanche mène à la semaine suivante ; rien à lister = aucun jour', () => {
  const { e } = semaine();
  assert.deepEqual(articlesDuPoste(e, S.mardi).jours.map((j) => j.date), [S.mardi], 'lundi est passé');
  assert.deepEqual(articlesDuPoste(e, S.mercredi).jours, [], 'plus rien cette semaine');
  const dim = articlesDuPoste(e, S.dimanche);
  assert.equal(dim.lundi, S.lundiSuivant, 'le dimanche est fermé : on liste la semaine qui vient');
  assert.deepEqual(articlesDuPoste(etatVide(), S.lundi).jours, []);
});

test('articles : un composant non attribué ou non validé n\'est pas un article du poste', () => {
  const { e, a } = semaine();
  e.composants[a].attribue = false;
  assert.ok(!aplatir(articlesDuPoste(e, S.lundi)).some((x) => x.nom === 'ARTICLE_LUNDI_TEST'));
  e.composants[a].attribue = true;
  e.composants[a].valide = false;
  assert.ok(!aplatir(articlesDuPoste(e, S.lundi)).some((x) => x.nom === 'ARTICLE_LUNDI_TEST'));
});

test('cocher : un geste durable, décocher le retire, le journal le dit', () => {
  const { e } = semaine();
  const cle = aplatir(articlesDuPoste(e, S.lundi))[0].cle;
  assert.equal(aplatir(articlesDuPoste(e, S.lundi))[0].coche, false);
  cocherArticle(e, cle, true, h(1));
  assert.equal(aplatir(articlesDuPoste(e, S.lundi))[0].coche, true);
  assert.equal(e.journal.at(-1).action, 'cocherArticle');
  cocherArticle(e, cle, false, h(2));
  assert.equal(aplatir(articlesDuPoste(e, S.lundi))[0].coche, false);
  assert.deepEqual(e.articlesCoches, {}, 'rien ne reste après décochage');
});

test('cocher : refuse une clé qui ne désigne aucun composant, un état non booléen, un horodatage invalide', () => {
  const { e } = semaine();
  assert.throws(() => cocherArticle(e, 'inconnu|riz', true, h()), /Article inconnu/);
  assert.throws(() => cocherArticle(e, 42, true, h()), /Article inconnu/);
  for (const dangereuse of ['__proto__|x', 'constructor|x', 'toString|x']) assert.throws(() => cocherArticle(e, dangereuse, true, h()), /Article inconnu/, dangereuse);
  const cle = aplatir(articlesDuPoste(e, S.lundi))[0].cle;
  assert.throws(() => cocherArticle(e, cle, 'oui', h()), /vrai ou faux/);
  assert.throws(() => cocherArticle(e, cle, true, 'pas une date'), /Horodatage/);
  assert.deepEqual(e.articlesCoches, {});
});

test('sauvegarde : les cases cochées voyagent dans l\'export ; une ancienne sauvegarde sans le champ reste valide ; une valeur invalide est écartée', () => {
  const { e } = semaine();
  const cle = aplatir(articlesDuPoste(e, S.lundi))[0].cle;
  cocherArticle(e, cle, true, h(1));
  const retour = importer(exporter(e, h(2)));
  assert.deepEqual(Object.keys(retour.articlesCoches), [cle]);
  // Ancienne sauvegarde (sans le champ) : défaut vide.
  const doc = JSON.parse(exporter(e, h(2)));
  delete doc.etat.articlesCoches;
  assert.deepEqual(importer(JSON.stringify(doc)).articlesCoches, {});
  // Valeurs invalides : écartées, jamais recopiées.
  doc.etat.articlesCoches = { [cle]: 'pas une date', '__proto__': 'x', [`${'x'.repeat(400)}|y`]: h(1), ok: 42 };
  assert.deepEqual(importer(JSON.stringify(doc)).articlesCoches, {});
  doc.etat.articlesCoches = 'texte';
  assert.deepEqual(importer(JSON.stringify(doc)).articlesCoches, {});
});
