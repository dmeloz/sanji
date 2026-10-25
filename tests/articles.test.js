// Onglet Articles (décision du 2026-10-07, « sans gestion de stock ») : la liste simple des articles du poste, par jour et par menu,
// lue dans les composants au poste (même source que les besoins de produits). Cocher une ligne est un geste durable de l'état.
// Jeux TEST_ONLY : dates de tests/jeux/TEST_ONLY-semaine.js (2026-10-05 est un lundi).

import test from 'node:test';
import assert from 'node:assert/strict';
import { marquerFait, planifier } from '../app/js/domaine/actions.js';
import { cocherArticle } from '../app/js/domaine/actions-articles.js';
import { articlesDuPoste } from '../app/js/domaine/articles.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

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

test('articles : rangés au jour de production, avec le jour du service, par menu, la quantité brute et son unité', () => {
  const { e, a } = semaine();
  const r = articlesDuPoste(e, S.lundi);
  assert.equal(r.lundi, S.lundi);
  // Le lundi à midi : le mardi se prépare dès aujourd'hui (avance habituelle), il rejoint donc le jour de production du lundi.
  assert.deepEqual(r.jours.map((j) => j.date), [S.lundi]);
  assert.equal(r.jours[0].estAujourdhui, true);
  assert.deepEqual(r.jours[0].services, [S.lundi, S.mardi]);
  const articles = r.jours[0].articles;
  const calc = calculerComposant(e, a);
  const lundi = articles[0];
  assert.deepEqual([lundi.nom, lundi.menu, lundi.quantite, lundi.unite, lundi.aCompleter, lundi.dateService],
    ['ARTICLE_LUNDI_TEST', 1, calc.brut, calc.uniteTravail, false, S.lundi]);
  assert.deepEqual(articles.slice(1).map((x) => [x.dateService, x.menu, x.nom]),
    [[S.mardi, 1, 'ARTICLE_SANS_PREVISION_TEST'], [S.mardi, 2, 'ARTICLE_MARDI_TEST']], 'par service, puis menu 1 puis menu 2');
});

test('articles : le samedi voit le lundi suivant, au jour de production (samedi), avec son jour de service', () => {
  const e = etatVide();
  prevision(e, S.lundiSuivant, 1, 10);
  composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_PROCHAIN_TEST' });
  const r = articlesDuPoste(e, S.samedi);
  assert.equal(r.lundi, S.lundi, 'la semaine du samedi ; la semaine suivante est lue aussi');
  assert.deepEqual(r.jours.map((j) => [j.date, j.services]), [[S.samedi, [S.lundiSuivant]]]);
  assert.equal(r.jours[0].articles[0].dateService, S.lundiSuivant);
});

test('articles : le dimanche mène au lundi, jour de production du service du lundi', () => {
  const e = etatVide();
  prevision(e, S.lundiSuivant, 1, 10);
  composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_PROCHAIN_TEST' });
  const r = articlesDuPoste(e, S.dimanche);
  assert.deepEqual(r.jours.map((j) => j.date), [S.lundiSuivant]);
});

test('articles : un jour planifié à la main est le jour de production (planifie)', () => {
  const { e, b } = semaine();
  planifier(e, principaleDe(e, b), S.mardi, h());
  const mardi = articlesDuPoste(e, S.lundi).jours.find((j) => j.date === S.mardi);
  assert.deepEqual(mardi.articles.map((x) => x.nom), ['ARTICLE_MARDI_TEST']);
});

test('articles : un composant sans production reste listé, au jour de son service', () => {
  const { e, a } = semaine();
  delete e.productions[principaleDe(e, a)];
  const r = aplatir(articlesDuPoste(e, S.lundi)).find((x) => x.nom === 'ARTICLE_LUNDI_TEST');
  assert.deepEqual([r.date, r.dateService], [S.lundi, S.lundi]);
});

test('articles : une production faite sort de la liste ; une case cochée reste cochée quand le jour change', () => {
  const { e, a, b } = semaine();
  const avant = aplatir(articlesDuPoste(e, S.lundi)).find((x) => x.nom === 'ARTICLE_MARDI_TEST');
  cocherArticle(e, avant.cle, true, h(1));
  planifier(e, principaleDe(e, b), S.mardi, h());
  const apres = aplatir(articlesDuPoste(e, S.lundi)).find((x) => x.nom === 'ARTICLE_MARDI_TEST');
  assert.notEqual(apres.date, avant.date, 'le jour de production a changé');
  assert.equal(apres.cle, avant.cle);
  assert.equal(apres.coche, true);
  marquerFait(e, principaleDe(e, a), null, h(2), { sansQuantite: true });
  assert.ok(!aplatir(articlesDuPoste(e, S.lundi)).some((x) => x.nom === 'ARTICLE_LUNDI_TEST'));
});

test('articles : une quantité inconnue reste « à compléter », sans quantité inventée', () => {
  const { e } = semaine();
  const sans = aplatir(articlesDuPoste(e, S.lundi)).find((x) => x.nom === 'ARTICLE_SANS_PREVISION_TEST');
  assert.equal(sans.aCompleter, true);
  assert.equal(sans.quantite, null);
  assert.equal(sans.unite, null);
});

test('articles : seuls les services à venir ; le dimanche mène à la semaine suivante ; rien à lister = aucun jour', () => {
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

test('articles : la sauce implicite « à confirmer » n\'est pas un article (rien n\'est choisi, rien à acheter)', async () => {
  const { definirMenu } = await import('../app/js/domaine/actions.js');
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Tagliatelles', h());
  prevision(e, S.lundi, 1, 10);
  assert.ok(Object.values(e.composants).some((c) => /sauce à confirmer/.test(c.nom)), 'la lecture crée bien la sauce implicite');
  for (const c of Object.values(e.composants)) { c.attribue = true; c.valide = true; }
  const noms = aplatir(articlesDuPoste(e, S.lundi)).map((x) => x.nom);
  assert.ok(noms.length > 0);
  assert.ok(!noms.some((n) => /à confirmer/.test(n)), `articles : ${noms.join(', ')}`);
});
