// Finition de la refonte 1 : quantités en police à chasse fixe (milliers, mots hors police), jour fermé, Production,
// variante sombre et mouvement réduit lus dans le CSS. Faux DOM : la mise en page réelle se vérifie à l'écran (390 px).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { creerFiche, definirMenu, definirPrevision, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let format;
let aujourdhuiVue;
let production;
let semaine;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  format = await import('../app/js/ui/format.js');
  aujourdhuiVue = await import('../app/js/ui/vue-aujourdhui.js');
  production = await import('../app/js/ui/vue-production.js');
  semaine = await import('../app/js/ui/vue-semaine.js');
});
after(() => dom.restaurer());

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const aDate = (iso, fonction) => {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
};
const enveloppe = (noeuds) => {
  const p = globalThis.document.createElement('span');
  for (const n of noeuds) p.appendChild(typeof n === 'string' ? globalThis.document.createTextNode(n) : n);
  return p;
};
const texte = (noeud) => noeud.textContent.replace(/[  ]/g, ' ');

test('quantité : quatre chiffres sans groupement, cinq chiffres avec séparateur étroit, unité de poids collée, valeur inchangée', () => {
  const q4 = enveloppe(format.quantiteNoeuds(5399, 'g'));
  assert.equal(classes(q4, 'sep-milliers').length, 0);
  assert.equal(texte(q4), '5399 g');
  assert.equal(classes(q4, 'sep-unite').length, 1, 'unité séparée par une espace rendue étroite');
  assert.equal(classes(q4, 'qte-unite')[0].textContent, 'g');
  const q5 = enveloppe(format.quantiteNoeuds(85000, 'g'));
  assert.equal(classes(q5, 'sep-milliers').length, 1);
  assert.equal(texte(q5), '85 000 g');
  assert.equal(classes(enveloppe(format.qteNoeuds('1 234 567 g')), 'sep-milliers').length, 2);
  assert.equal(texte(enveloppe(format.qteNoeuds('800 g'))), '800 g');
});

test('quantité : un mot (pièces, portions, personnes) ou un texte non numérique sort de la police de quantité', () => {
  const p = enveloppe(format.quantiteNoeuds(13, 'piece'));
  assert.equal(classes(p, 'qte-mot')[0].textContent, 'pièces');
  assert.equal(classes(p, 'qte-unite').length, 0);
  assert.equal(classes(enveloppe(format.qteNoeuds('sans quantité')), 'qte-mot').length, 1);
  assert.equal(classes(enveloppe(format.qteNoeuds('—')), 'qte-mot').length, 0);
  assert.match(css, /\.qte-mot \{[^}]*font-family: var\(--police\)/);
});

test('Semaine : « personnes » n\'est pas dans la police de quantité, seul le nombre l\'est', () => {
  const e = etatVide();
  definirMenu(e, S.lundiSuivant, 1, 'Tagliatelles', h());
  creerFiche(e, { date: S.lundiSuivant, service: 'midi', numero: 'F7', couverts: 12, horaire: '12:00', mode: 'menu_fixe', menuFixe: 1, allergies: '' }, h());
  magasin.remplacer(e);
  const page = aDate(S.lundiSuivant, () => semaine.rendre(magasin.etat(), S.lundiSuivant));
  assert.ok(classes(page, 'sem-qte').some((x) => x.textContent === '12'), 'le nombre seul en police de quantité');
  assert.match(page.textContent, /12 personnes/);
  assert.ok(!classes(page, 'sem-qte').some((x) => /personne/.test(x.textContent)));
});

test('Aujourd\'hui, dimanche : « Fermé aujourd\'hui » une seule fois, avec la prochaine journée ouverte', () => {
  magasin.remplacer(etatVide());
  const page = aDate(S.dimanche, () => aujourdhuiVue.rendre(magasin.etat()));
  assert.equal((page.textContent.match(/Fermé aujourd'hui/g) ?? []).length, 1);
  assert.match(classes(page, 'au-maintenant')[0].textContent, /Fermé aujourd'hui · Prochaine production : lundi 12/);
});

test('Production : la quantité de chaque ligne est en grand (graisse 600, à droite), l\'unité plus petite', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Tagliatelles', h());
  definirPrevision(e, S.lundi, 1, 40, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  const prod = Object.values(e.productions).find((p) => p.genre === 'principale');
  planifier(e, prod.id, S.lundi, 'avant_midi', h());
  magasin.remplacer(e);
  const page = aDate(S.lundi, () => production.rendre(magasin.etat(), S.lundi));
  const qte = classes(page, 'mep-qte');
  assert.ok(qte.length > 0);
  assert.ok(classes(qte[0], 'qte-unite').length === 1, 'unité dans son propre élément');
  assert.match(css, /\.prod-ligne \.mep-qte \{[^}]*font-size: max\(var\(--t-qte\), 20px\)[^}]*font-weight: 600[^}]*text-align: right/);
  assert.match(css, /\.prod-ligne \.mep-quantite \{[^}]*align-items: flex-end/);
});

test('CSS : bloc « Finition » en fin de fichier, séparateurs étroits, mouvement réduit global', () => {
  // Les blocs ajoutés par les lots suivants (audit v56) viennent après : le bloc Finition existe et reste avant eux.
  const marque = css.indexOf('/* ===== Finition');
  assert.ok(marque > 0, 'bloc Finition présent');
  assert.match(css.slice(marque, marque + 40), /Finition/);
  assert.match(css, /\.sep-milliers, \.sep-unite \{[^}]*width: 0\.2\d?em/);
  // Une taille de police nulle annulerait une largeur en em : le séparateur deviendrait invisible (vu sur capture).
  assert.doesNotMatch(css, /\.sep-milliers, \.sep-unite \{[^}]*font-size: 0/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important; transition: none !important/);
});

// ---------------------------------------------------------------- variante sombre : contrastes WCAG des paires texte / fond

const jetons = (bloc) => Object.fromEntries([...bloc.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('défilement vers une ancre : doux par défaut, immédiat si le mouvement réduit est demandé', async () => {
  const { Element } = await import('./aide-dom.js');
  const { versAncre } = await import('../app/js/ui/vue-detail.js');
  const cible = globalThis.document.createElement('section');
  cible.attributs.id = 'ancre-test';
  globalThis.document.body.appendChild(cible);
  const appels = [];
  Element.prototype.scrollIntoView = function scrollIntoView(options) { appels.push(options); };
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const reduit = (valeur) => Object.defineProperty(globalThis, 'matchMedia', { configurable: true, writable: true,
    value: (q) => ({ matches: valeur && /prefers-reduced-motion: reduce/.test(q) }) });
  try {
    reduit(false);
    versAncre('ancre-test')();
    reduit(true);
    versAncre('ancre-test')();
    assert.deepEqual(appels.map((o) => o.behavior), ['smooth', 'auto']);
  } finally {
    delete Element.prototype.scrollIntoView;
    if (avant) Object.defineProperty(globalThis, 'matchMedia', avant); else delete globalThis.matchMedia;
    cible.remove();
  }
});

test('variantes claire et sombre : aucune paire texte / fond sous 4,5:1', () => {
  const debutSombre = css.indexOf('@media (prefers-color-scheme: dark)');
  const clair = jetons(css.slice(css.indexOf(':root {'), debutSombre));
  const sombre = { ...clair, ...jetons(css.slice(debutSombre, css.indexOf('*, *::before', debutSombre))) };
  const paires = [['texte', 'fond'], ['texte', 'carte'], ['texte-doux', 'carte'], ['texte-doux', 'fond'], ['texte-moyen', 'carte'],
    ['texte-moyen', 'carte-2'], ['texte-doux', 'carte-2'], ['sur-encre', 'encre'], ['exception', 'exception-fond'],
    ['action-fonce', 'action-fond'], ['rouge-texte', 'rouge-fond'], ['sur-action', 'action'], ['action', 'carte'], ['action-fonce', 'carte'], ['texte', 'carte-2'], ['action', 'carte-2']];
  for (const [nom, jeu] of [['clair', clair], ['sombre', sombre]]) {
    for (const [t, f] of paires) assert.ok(contraste(jeu[t], jeu[f]) >= 4.5, `${nom} : ${t} sur ${f} = ${contraste(jeu[t], jeu[f]).toFixed(2)}`);
  }
});
