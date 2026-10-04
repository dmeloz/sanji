// Refonte 1, écran Production (onglet 2) : sélecteur Aujourd'hui / Demain, en-tête, ligne Recette / Brut, provenance,
// chevron, replis conservés. Faux DOM : ni mise en page ni tactile (à vérifier à l'écran à 390 px). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { marquerFait, planifier } from '../app/js/domaine/actions.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let vue;
let routeur;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
  routeur = await import('../app/js/ui/routeur.js');
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
const page = (etat, date = S.lundi, iso = S.lundi) => aDate(iso, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat(), date); });
const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');

/** Lundi : une recette (préparation maison, menu 2) et un produit brut (menu 1), chacun planifié le jour même. */
function lundi() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.lundi, 2, 10);
  const brut = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'BRUT_TEST' });
  const recette = composantValide(e, S.lundi, 2, J.PREPARATION_TEST, { nom: 'RECETTE_TEST' });
  planifier(e, principaleDe(e, brut), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, recette), S.lundi, 'apres_midi', h());
  return { e, brut, recette };
}
const ligneDe = (noeud, nom) => classes(noeud, 'mep-ligne').find((l) => classes(l, 'mep-nom')[0].textContent === nom);

test('Production : le routeur la sert à #/production, titre « Production »', () => {
  assert.equal(routeur.VUES.production, vue);
  assert.equal(vue.titre(), 'Production');
});

test('sélecteur Aujourd\'hui / Demain : deux liens vers les jours, le jour affiché porte aria-current', () => {
  const { e } = lundi();
  const noeud = page(e, S.lundi);
  const seg = classes(noeud, 'prod-segment');
  assert.deepEqual(seg.map((a) => a.textContent), ['Aujourd\'hui', 'Demain']);
  assert.deepEqual(seg.map((a) => a.attributs.href), [`#/production/${S.lundi}`, `#/production/${S.mardi}`]);
  assert.equal(seg[0].attributs['aria-current'], 'date');
  assert.equal(seg[1].attributs['aria-current'], undefined);
  const demain = page(e, S.mardi);
  assert.equal(classes(demain, 'prod-segment')[1].attributs['aria-current'], 'date');
  assert.equal(classes(demain, 'prod-segment')[0].attributs['aria-current'], undefined);
  const plusLoin = page(e, S.jeudi);
  assert.equal(classes(plusLoin, 'prod-segment').filter((a) => a.attributs['aria-current']).length, 0, 'ni l\'un ni l\'autre');
  assert.ok(classes(plusLoin, 'jour-barre').length === 1, 'la barre de jours reste pour aller plus loin');
});

test('en-tête : « date · x / n faites » et « hors ligne prêt » (pas de synchronisation)', () => {
  const { e, brut } = lundi();
  const texte = classes(page(e), 'prod-tete')[0].textContent;
  assert.match(texte, /Lundi 5 octobre \(aujourd'hui\) · 0 \/ 2 faites/);
  assert.match(texte, /hors ligne/);
  assert.doesNotMatch(texte, /synchronis|en attente/i);
  marquerFait(e, principaleDe(e, brut), undefined, h(1));
  assert.match(classes(page(e), 'prod-tete')[0].textContent, /1 \/ 2 faites/);
});

test('ligne Recette : étiquette, destination menu, créneau, provenance, quantité, chevron vers la fiche', () => {
  const { e, recette } = lundi();
  const ligne = ligneDe(page(e), 'RECETTE_TEST');
  const etiquette = classes(ligne, 'prod-etiquette')[0];
  assert.equal(etiquette.textContent, 'Recette');
  assert.match(classes(ligne, 'prod-etiquettes')[0].textContent, /Recette.*menu 2 · après le service de midi/);
  assert.match(classes(ligne, 'prod-provenance')[0].textContent, /provenance : (calculé|standard de base|validé restaurant|saisi au service)/);
  assert.equal(classes(ligne, 'mep-qte').length, 1);
  const chevron = classes(ligne, 'prod-chevron')[0];
  assert.equal(chevron.attributs.href, `#/fiche/${encodeURIComponent(recette)}`);
  assert.match(chevron.attributs['aria-label'], /Ouvrir la fiche : RECETTE_TEST/);
});

test('ligne Brut : seulement nom, étiquette, créneau et quantité ; pas de destination, de provenance ni de chevron', () => {
  const { e, brut } = lundi();
  const ligne = ligneDe(page(e), 'BRUT_TEST');
  assert.equal(classes(ligne, 'prod-etiquette')[0].textContent, 'Brut');
  const ligneEtiquettes = classes(ligne, 'prod-etiquettes')[0].textContent;
  assert.match(ligneEtiquettes, /avant le service de midi/);
  assert.doesNotMatch(ligneEtiquettes, /menu/);
  assert.equal(classes(ligne, 'prod-provenance').length, 0);
  assert.equal(classes(ligne, 'prod-chevron').length, 0);
  assert.equal(classes(ligne, 'mep-qte').length, 1);
  // La fiche du produit reste accessible, repliée sous « Actions ».
  const hrefs = ligne.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
  assert.deepEqual(hrefs, [`#/fiche/${encodeURIComponent(brut)}`]);
});

test('une quantité absente n\'est ni une alerte ni une décision : « quantité à compléter », sans provenance', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 2, J.PREPARATION_TEST, { nom: 'SANS_PREVISION_TEST' });
  planifier(e, principaleDe(e, c), S.lundi, 'avant_midi', h());
  const noeud = page(e);
  const ligne = ligneDe(noeud, 'SANS_PREVISION_TEST');
  assert.match(ligne.textContent, /quantité à compléter/);
  assert.equal(classes(ligne, 'prod-provenance').length, 0);
  assert.equal(classes(noeud, 'jour-decisions').length, 0);
});

test('gestes conservés : case « Fait », Corriger le réel, impression, case cochée barrée à sa place', () => {
  const { e, brut } = lundi();
  marquerFait(e, principaleDe(e, brut), undefined, h(1));
  const noeud = page(e);
  const faite = classes(ligneDe(noeud, 'BRUT_TEST'), 'case-fait')[0];
  assert.equal(faite.attributs['aria-checked'], 'true');
  assert.match(ligneDe(noeud, 'BRUT_TEST').textContent, /Corriger/);
  assert.equal(classes(ligneDe(noeud, 'RECETTE_TEST'), 'case-fait')[0].attributs['aria-checked'], 'false');
  assert.match(noeud.textContent, /Imprimer la feuille du jour/);
});

test('vocabulaire : aucun terme écarté par la propriétaire sur l\'écran', () => {
  const { e } = lundi();
  const texte = page(e).textContent;
  for (const interdit of [/minuteur/i, /en stock/i, /balaie/i, /appui long/i, /bon de commande/i, /chambre froide/i, /fiche personnelle/i, /estimation fragile/i]) {
    assert.doesNotMatch(texte, interdit);
  }
});

test('accessibilité : cibles de 44 px, légendes de 13 px, quantités en police dédiée, mouvement réduit déjà respecté', () => {
  const bloc = css.slice(css.indexOf('Production (refonte 1, onglet 2)'));
  assert.match(bloc, /\.prod-segment \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.prod-chevron \{[^}]*min-width: var\(--cible\)[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.prod-ligne \.mep-qte \{ font-family: var\(--police-qte\)/);
  assert.match(css, /--cible: 44px/);
  assert.match(css, /--t-legende: 13px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(bloc, /transition|animation/, 'aucun mouvement ajouté');
});
