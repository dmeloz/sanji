// Page « Fiches des éléments » (#/fiches) sous faux DOM : sections fixes, recherche, petite fiche en feuille, accès depuis Réglages.
// Ce n'est pas un test dans un navigateur : la mise en page à 390 px se vérifie à l'écran.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { etatInitial } from '../app/js/domaine/etat.js';
import { retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { h } from './aide.js';

let dom;
let magasin;
let vue;
let routeur;
let reglages;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-fiches-elements.js');
  routeur = await import('../app/js/ui/routeur.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => dom.restaurer());

const fermerFeuilles = () => dom.corps.tous((x) => x.balise === 'dialog').forEach((d) => d.remove());
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);
const sections = (p) => p.tous((x) => x.balise === 'section');
const lignes = (p) => p.tous((x) => x.balise === 'button' && x.className === 'fe-ligne');
const champRecherche = (p) => p.tous((x) => x.balise === 'input' && x.attributs.id === 'fe-recherche')[0];

function avecFiches() {
  const e = etatInitial();
  retenirFiche(e, 'Spaghetti carbonara', { categorie: 'sauce', role: 'sauce' }, h(1));
  retenirFiche(e, 'Risotto', { categorie: 'feculent', role: 'plat_principal', grammage: { valeur: 80, unite: 'g', etat: 'sec' } }, h(1));
  retenirFiche(e, 'Côtes de bette à la crème', { categorie: 'legume', role: 'garniture' }, h(1));
  retenirFiche(e, 'Épinards', { categorie: 'legume', role: 'garniture' }, h(1));
  magasin.remplacer(e);
  return magasin.etat();
}

test('page : titre, recherche, cinq sections toujours visibles dans l\'ordre avec leur nombre, aucun onglet ni details', () => {
  const p = vue.rendre(avecFiches());
  assert.equal(vue.titre(), 'Fiches des éléments');
  assert.match(p.textContent, /Fiches des éléments/);
  assert.ok(champRecherche(p));
  assert.deepEqual(sections(p).map((s) => s.attributs['aria-label']), ['Pâtes et féculents', 'Sauces', 'Légumes et garnitures', 'Produits', 'Autres']);
  assert.match(p.textContent, /Pâtes et féculents · 1/);
  assert.match(p.textContent, /Légumes et garnitures · 2/);
  assert.match(p.textContent, /Autres · 0/);
  assert.equal(p.tous((x) => x.balise === 'details').length, 0);
  assert.doesNotMatch(p.textContent, /Hors poste|Entremétier/);
  assert.match(p.textContent, /80 g sec/);
  assert.match(p.textContent, /portion à saisir/);
});

test('page : sans fiche, le message dit comment elles se créent ; les sections restent là', () => {
  magasin.remplacer(etatInitial());
  const p = vue.rendre(magasin.etat());
  assert.match(p.textContent, /Aucune fiche pour l'instant : elles se créent quand vous réglez un élément\./);
  assert.equal(sections(p).length, 5);
});

test('page : la recherche filtre par nom sans casse ni accents', () => {
  const p = vue.rendre(avecFiches());
  const c = champRecherche(p);
  c.value = 'EPINARD';
  c.declencher('input');
  assert.deepEqual(lignes(p).map((l) => l.attributs['aria-label'].split(' :')[0]), ['Épinards']);
  c.value = 'zzz';
  c.declencher('input');
  assert.equal(lignes(p).length, 0);
  assert.match(p.textContent, /Aucune fiche ne correspond à « zzz »/);
  c.value = '';
  c.declencher('input');
  assert.equal(lignes(p).length, 4);
});

test('page : un toucher ouvre la petite fiche ; renommer, changer de catégorie, portion, oublier redessinent la feuille', async () => {
  const p = vue.rendre(avecFiches());
  lignes(p).find((l) => /Épinards/.test(l.textContent)).click();
  let feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /Corriger le nom/);
  assert.match(feuille.textContent, /Catégorie/);
  assert.doesNotMatch(feuille.textContent, /Hors poste|hors poste/);
  // portion
  const portion = feuille.tous((x) => x.balise === 'input' && x.attributs.type === 'text').find((c) => c.value !== 'Épinards');
  portion.value = '90';
  parTexte(feuille, 'Enregistrer la portion').click();
  assert.equal(magasin.etat().fiches_retenues.epinards.grammage.valeur, 90);
  // catégorie : produit (plus de fonction, donc plus de portion)
  parTexte(panneauxOuverts(dom.corps)[0], 'Produit').click();
  feuille = panneauxOuverts(dom.corps)[0];
  assert.equal(magasin.etat().fiches_retenues.epinards.categorie, 'autre');
  assert.equal(parTexte(feuille, 'Produit').attributs['aria-pressed'], 'true');
  // renommer : l'alias est retenu et la feuille suit la nouvelle clé
  feuille = panneauxOuverts(dom.corps)[0];
  const champNom = feuille.tous((x) => x.balise === 'input' && x.value === 'Épinards')[0];
  champNom.value = 'Epinard';
  parTexte(feuille, 'Enregistrer').click();
  assert.ok(magasin.etat().fiches_retenues.epinard);
  assert.equal(magasin.etat().fiches_retenues.epinards, undefined);
  assert.deepEqual(magasin.etat().noms.epinards.nom, 'Epinard');
  assert.match(panneauxOuverts(dom.corps)[0].textContent, /Epinard/);
  // oublier : confirmation puis la fiche part
  parTexte(panneauxOuverts(dom.corps)[0], 'Oublier cette fiche').click();
  const confirmation = panneauxOuverts(dom.corps).at(-1);
  assert.match(confirmation.textContent, /Oublier cette fiche \?/);
  assert.ok(magasin.etat().fiches_retenues.epinard, 'rien n\'est oublié avant la confirmation');
  await confirmation.querySelector('form').declencher('submit');
  assert.equal(magasin.etat().fiches_retenues.epinard, undefined);
  fermerFeuilles();
});

test('routeur : #/fiches est une vue, sous l\'onglet Aujourd\'hui ; Réglages > Poste a la ligne « Fiches des éléments »', () => {
  assert.deepEqual(routeur.analyserHash('#/fiches', '2026-10-12'), { vue: 'fiches', param: null });
  assert.equal(routeur.ONGLET_DE_VUE.fiches, 'aujourdhui');
  assert.equal(typeof routeur.VUES.fiches.rendre, 'function');
  const p = reglages.rendre(avecFiches());
  const lien = p.tous((x) => x.balise === 'a' && x.attributs.href === '#/fiches')[0];
  assert.ok(lien);
  assert.match(lien.textContent, /Fiches des éléments/);
  assert.match(lien.textContent, /4/);
});

test('CSS : la page ne déborde pas à 390 px (min-width: 0), lignes de 44 px, rien en hex', () => {
  const brut = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = brut.slice(brut.indexOf('/* v118'));
  for (const s of ['.fe-ligne', '.fe-ligne-nom', '.fe-recherche', '.fe-rubrique', '.fe-zone', '.cloture-element-nom']) {
    const m = bloc.match(new RegExp(`${s.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`));
    assert.match(m?.[1] ?? '', /min-width:\s*0/, s);
  }
  assert.match(bloc, /\.fe-ligne \{[^}]*min-height: var\(--cible\)/);
  assert.doesNotMatch(bloc, /#[0-9a-fA-F]{3,8}\b|font-size:\s*(\d|1[0-4])px|box-shadow|gradient/);
});
