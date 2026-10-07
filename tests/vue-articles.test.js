// Onglet Articles (refonte 2) sous faux DOM : la liste par jour et par menu, les cases, Semaine / Aujourd'hui, le partage.
// Ni mise en page ni partage natif réels (à vérifier à l'écran à 390 px, clair et sombre). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, prevision } from './aide.js';

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

test('semaine : un bloc par jour, les articles par menu, la quantité brute à droite en police des quantités', () => {
  vue.oublierVue();
  const p = page(S.lundi, semaine());
  assert.match(p.textContent, /Semaine du lundi 5 octobre · pour le poste/);
  const jours = classes(p, 'art-jour');
  assert.deepEqual(jours.map((j) => j.attributs['aria-label']), ["Lundi 5 octobre · aujourd'hui", 'Mardi 6 octobre']);
  const mardi = classes(jours[1], 'art-ligne').map((l) => classes(l, 'art-nom')[0].textContent);
  assert.deepEqual(mardi, ['ARTICLE_SANS_PREVISION_TEST', 'ARTICLE_MARDI_TEST'], 'menu 1 puis menu 2');
  const premiere = classes(jours[0], 'art-ligne')[0];
  assert.match(premiere.textContent, /menu 1/);
  assert.ok(classes(premiere, 'art-qte')[0].className.includes('au-qte'));
  assert.match(classes(premiere, 'art-qte')[0].textContent, /\d/);
});

test('quantité inconnue : « menu 1 · à compléter » et « — », sans alerte', () => {
  const p = page(S.lundi, semaine());
  const ligne = classes(p, 'art-ligne').find((l) => /ARTICLE_SANS_PREVISION_TEST/.test(l.textContent));
  assert.match(ligne.textContent, /menu 1 · à compléter/);
  assert.match(ligne.textContent, /—/);
  assert.equal(classes(p, 'encadre-alerte').length + classes(p, 'encadre-erreur').length, 0);
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
  assert.deepEqual(classes(p, 'art-jour').map((j) => j.attributs['aria-label']), ["Lundi 5 octobre · aujourd'hui"]);
  assert.equal(seg(p)[1].attributs['aria-pressed'], 'true');
  vue.oublierVue();
});

test('rien à lister : une phrase et le lien pour saisir les menus ; le dimanche dit « Fermé »', () => {
  vue.oublierVue();
  const vide = page(S.lundi, etatVide());
  assert.match(vide.textContent, /Aucun article pour le poste/);
  assert.ok(vide.tous((x) => x.balise === 'a').some((a) => a.attributs.href === `#/import/${S.lundi}`));
  assert.equal(classes(vide, 'art-pouce').length, 0, 'rien à partager');
  const e = semaine();
  vue.oublierVue();
  aDate(S.dimanche, () => { magasin.remplacer(e); });
  const dim = aDate(S.dimanche, () => vue.rendre(magasin.etat()));
  assert.match(dim.textContent, /Semaine du lundi 12 octobre/, 'le dimanche, la semaine qui vient');
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
  assert.match(envoyes[0].text, /Lundi 5 octobre · aujourd'hui\n\[ \] ARTICLE_LUNDI_TEST \(menu 1\) · /);
  assert.match(envoyes[0].text, /\[ \] ARTICLE_SANS_PREVISION_TEST \(menu 1\) · à compléter/);
});

test('CSS : cibles de 44 px, quantité en police dédiée, barre de partage fixe au-dessus des onglets', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('Articles (refonte 2'));
  assert.match(bloc, /\.art-ligne \{[^}]*grid-template-columns: var\(--cible\)/);
  assert.match(bloc, /\.art-pouce \{[^}]*position: fixed[^}]*bottom: var\(--haut-onglets\)/);
  assert.match(css, /\.au-qte \{[^}]*var\(--police-qte\)/);
  assert.doesNotMatch(bloc, /gradient|https?:\/\//);
});
