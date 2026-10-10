// Onglet Articles (refonte 2) sous faux DOM : la liste par jour et par menu, les cases, Semaine / Aujourd'hui, le partage.
// Ni mise en page ni partage natif réels (à vérifier à l'écran à 390 px, clair et sombre). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { definirRegle } from '../app/js/domaine/actions.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

let dom;
let magasin;
let routeur;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vue = await import('../app/js/ui/vue-articles.js');
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
const page = (iso, etat) => aDate(iso, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat()); });

function semaine() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.mardi, 2, 20);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_TEST' });
  composantValide(e, S.mardi, 2, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_MARDI_TEST' });
  composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_SANS_PREVISION_TEST' });
  return e;
}

test('l\'écran est branché au routeur sous le nom « Articles », sans gestion de stock', () => {
  assert.equal(routeur.VUES.articles, vue);
  assert.equal(vue.titre(), 'Articles');
  const texte = page(S.lundi, semaine()).textContent;
  assert.doesNotMatch(texte, /en stock|stock théorique|DLC|Restes|Achats|restes/i);
});

test('semaine : un bloc par jour de production, les services dessous, la quantité en g ou kg à droite en police des quantités', () => {
  vue.oublierVue();
  const p = page(S.lundi, semaine());
  assert.match(p.textContent, /À avoir pour chaque jour de production/);
  const jours = classes(p, 'art-jour');
  // Le mardi se prépare dès le lundi (avance habituelle) : un seul jour de production, deux services dessous.
  assert.deepEqual(jours.map((j) => j.attributs['aria-label']), ["Lundi 5 octobre · aujourd'hui · pour mardi 6"]);
  const lignes = classes(jours[0], 'art-ligne').map((l) => classes(l, 'art-nom')[0].textContent);
  assert.deepEqual(lignes, ['ARTICLE_LUNDI_TEST', 'ARTICLE_SANS_PREVISION_TEST', 'ARTICLE_MARDI_TEST'], 'par service, puis menu 1 puis menu 2');
  const premiere = classes(jours[0], 'art-ligne')[0];
  assert.doesNotMatch(premiere.textContent, /menu 1/, 'le menu est dit par le sous-titre, plus par la ligne');
  assert.ok(classes(premiere, 'art-qte')[0].className.includes('au-qte'));
  assert.match(classes(premiere, 'art-qte')[0].textContent, /^\d+(,\d)?\s(g|kg)$/, 'en g ou kg comme Production');
});

/** Un service le lundi suivant (se prépare le samedi, le dimanche étant fermé) et un le mardi, dont la règle autorise 3 jours d'avance. */
function lundiSuivant() {
  const e = etatVide();
  prevision(e, S.lundiSuivant, 1, 10);
  prevision(e, S.lundiSuivant, 2, 10);
  prevision(e, S.mardiSuivant, 2, 10);
  composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_LUNDI_PROCHAIN_TEST' });
  composantValide(e, S.mardiSuivant, 2, J.PRODUIT_SEC_TEST, { nom: 'ARTICLE_MARDI_PROCHAIN_TEST' });
  definirRegle(e, { nom: 'ARTICLE_MARDI_PROCHAIN_TEST', avanceMaxJours: 3, limiteUtilisationJours: 3 }, h());
  return e;
}

test('jour de production : « Samedi 10 octobre · pour lundi 12 et mardi 13 », services en sous-titres, « aujourd\'hui » quand le service est le jour même', () => {
  vue.oublierVue();
  const e = lundiSuivant();
  e.jours[S.lundiSuivant].menus[1].intitule = 'INTITULE_M1_TEST';
  const samedi = classes(page(S.samedi, e), 'art-jour');
  assert.deepEqual(samedi.map((j) => j.attributs['aria-label']), ["Samedi 10 octobre · aujourd'hui · pour lundi 12 et mardi 13"]);
  assert.deepEqual(classes(samedi[0], 'art-menu-titre').map((t) => t.textContent), ['Lundi 12 · Menu 1 · INTITULE_M1_TEST', 'Mardi 13 · Menu 2']);
  const lundi = classes(page(S.lundiSuivant, e), 'art-jour');
  assert.equal(lundi[0].attributs['aria-label'], "Lundi 12 octobre · aujourd'hui · pour mardi 13");
  assert.deepEqual(classes(lundi[0], 'art-menu-titre').map((t) => t.textContent), ['Menu 1 · INTITULE_M1_TEST', 'Mardi 13 · Menu 2']);
  const mardi = classes(page(S.mardiSuivant, e), 'art-jour');
  assert.equal(mardi[0].attributs['aria-label'], "Mardi 13 octobre · aujourd'hui", 'service le jour même : pas de « pour »');
});

test('quantité inconnue : étiquette « à chiffrer » (icône + mot), sans alerte ; un toucher ouvre la feuille qui dit la raison', async () => {
  const p = page(S.lundi, semaine());
  const ligne = classes(p, 'art-ligne').find((l) => /ARTICLE_SANS_PREVISION_TEST/.test(l.textContent));
  const bouton = classes(ligne, 'prod-asaisir')[0];
  assert.match(bouton.textContent, /à chiffrer/);
  assert.ok(bouton.tous((x) => x.balise === 'svg').length >= 1, 'jamais la couleur seule');
  assert.doesNotMatch(ligne.textContent, /menu 1/);
  assert.equal(classes(p, 'encadre-alerte').length + classes(p, 'encadre-erreur').length, 0);
  await bouton.click();
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /Il manque la prévision du menu 1 du mardi 6 octobre/);
  for (const d of panneauxOuverts(dom.corps)) d.close();
});

test('articles groupés par menu sous « Menu N · intitulé du jour de service » ; sans intitulé, « Menu N » seul', () => {
  vue.oublierVue();
  const e = semaine();
  e.jours[S.mardi].menus[2].intitule = 'INTITULE_M2_TEST';
  const titres = classes(page(S.lundi, e), 'art-menu-titre').map((t) => t.textContent);
  assert.deepEqual(titres, ['Menu 1', 'Mardi 6 · Menu 1', 'Mardi 6 · Menu 2 · INTITULE_M2_TEST']);
});

test('cases : un mot pour l\'état (Cocher / Décocher), la coche reste après redessin, et se retire en la retouchant', async () => {
  const e = semaine();
  let p = page(S.lundi, e);
  const caseDe = (noeud) => classes(classes(noeud, 'art-ligne')[0], 'case-fait')[0];
  assert.equal(caseDe(p).attributs.role, 'checkbox');
  assert.equal(caseDe(p).attributs['aria-checked'], 'false');
  assert.match(caseDe(p).textContent, /Cocher : ARTICLE_LUNDI_TEST/);
  await aDate(S.lundi, () => caseDe(p).click());
  p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  assert.equal(caseDe(p).attributs['aria-checked'], 'true');
  assert.match(caseDe(p).textContent, /Décocher : ARTICLE_LUNDI_TEST/);
  assert.match(caseDe(p).textContent, /✓/, 'jamais la couleur seule');
  await aDate(S.lundi, () => caseDe(p).click());
  p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  assert.equal(caseDe(p).attributs['aria-checked'], 'false');
});

test('Semaine / Aujourd\'hui : le choix filtre les jours, l\'état pressé est écrit', async () => {
  vue.oublierVue();
  magasin.remplacer(semaine());
  let p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  const seg = (noeud) => classes(noeud, 'stock-segment');
  assert.deepEqual(seg(p).map((b) => [b.textContent, b.attributs['aria-pressed']]), [['Semaine', 'true'], ["Aujourd'hui", 'false']]);
  await aDate(S.lundi, () => seg(p)[1].click());
  p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  assert.deepEqual(classes(p, 'art-jour').map((j) => j.attributs['aria-label']), ["Lundi 5 octobre · aujourd'hui · pour mardi 6"]);
  assert.equal(seg(p)[1].attributs['aria-pressed'], 'true');
  vue.oublierVue();
});

test('rien à lister : une phrase et le lien pour saisir les menus ; le dimanche dit « Fermé »', () => {
  vue.oublierVue();
  const vide = page(S.lundi, etatVide());
  assert.match(vide.textContent, /Aucun article pour l'instant/);
  assert.ok(vide.tous((x) => x.balise === 'a').some((a) => a.attributs.href === `#/import/${S.lundi}`));
  assert.equal(classes(vide, 'art-pouce').length, 0, 'rien à partager');
  vue.oublierVue();
  aDate(S.dimanche, () => { magasin.remplacer(lundiSuivant()); });
  const dim = aDate(S.dimanche, () => vue.rendre(magasin.etat()));
  assert.deepEqual(classes(dim, 'art-jour').map((j) => j.attributs['aria-label']), ['Lundi 12 octobre · pour mardi 13'], 'le dimanche, la semaine qui vient');
});

test('partager : le texte de la liste, cases cochées marquées ; le bouton est dans la barre fixe', async () => {
  vue.oublierVue();
  const e = semaine();
  const p = page(S.lundi, e);
  const barre = classes(p, 'art-pouce')[0];
  assert.ok(barre);
  const partage = boutons(barre).find((b) => b.textContent === 'Partager la liste');
  assert.ok(partage);
  const envoyes = [];
  const avant = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { share: async (d) => { envoyes.push(d); } }, configurable: true });
  try {
    await partage.click();
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: avant, configurable: true });
  }
  assert.equal(envoyes.length, 1);
  const lignes = envoyes[0].text.split('\n');
  assert.equal(lignes[0], "Lundi 5 octobre · aujourd'hui · pour mardi 6", 'les mêmes titres que l\'écran');
  assert.match(lignes[1], /^\[ \] ARTICLE_LUNDI_TEST \(menu 1\) · \d+(,\d)?\s(g|kg)$/);
  assert.equal(lignes[2], '[ ] ARTICLE_SANS_PREVISION_TEST (mardi 6 · menu 1) · à chiffrer');
});

test('CSS : cibles de 44 px, quantité en police dédiée, barre de partage fixe au-dessus des onglets', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('Articles (refonte 2'));
  assert.match(bloc, /\.art-ligne \{[^}]*grid-template-columns: var\(--cible\)/);
  assert.match(bloc, /\.art-pouce \{[^}]*position: fixed[^}]*bottom: var\(--haut-onglets\)/);
  assert.match(css, /\.au-qte \{[^}]*var\(--police-qte\)/);
  assert.doesNotMatch(bloc, /gradient|https?:\/\//);
});
