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

test('en-tête : « Production » et la date en une ligne, aucun sélecteur Aujourd\'hui / Demain, flèches ‹ › vers le jour précédent et suivant', () => {
  const { e } = lundi();
  const noeud = page(e, S.lundi);
  const tete = classes(noeud, 'prod-tete')[0];
  assert.match(tete.textContent, /^Production\s*Lundi 5 octobre/);
  assert.equal(classes(noeud, 'prod-segment').length, 0, 'plus de sélecteur Aujourd\'hui / Demain');
  assert.equal(classes(noeud, 'prod-selecteur').length, 0);
  assert.equal(classes(noeud, 'jour-barre').length, 0, 'plus de barre de jours');
  assert.equal(classes(noeud, 'prod-adecider').length, 0, 'plus de puce « à décider »');
  const hrefs = classes(tete, 'prod-fleche').map((a) => [a.textContent, a.attributs.href]);
  assert.deepEqual(hrefs, [['‹', '#/production/2026-10-03'], ['›', `#/production/${S.mardi}`]]);
  const dimanche = classes(page(e, S.samediPrecedent), 'prod-fleche').map((a) => a.attributs.href);
  assert.equal(dimanche[1], `#/production/${S.lundi}`, 'le jour suivant le samedi est le lundi (dimanche sauté)');
});

test('en-tête : aucun état hors ligne quand tout est normal, aucun « x/n » ni jauge', () => {
  const { e, brut } = lundi();
  const texte = classes(page(e), 'prod-tete')[0].textContent;
  assert.doesNotMatch(texte, /hors ligne/, 'la normalité ne s\'affiche pas (vérification en cours ou prêt)');
  assert.doesNotMatch(texte, /synchronis|en attente/i);
  marquerFait(e, principaleDe(e, brut), undefined, h(1));
  assert.doesNotMatch(classes(page(e), 'prod-tete')[0].textContent, /\d\/\d/);
  assert.equal(classes(page(e), 'prod-jauge').length, 0);
});

test('ligne Recette : case, nom (lien vers la fiche), quantité ; ni étiquette, ni créneau, ni provenance, ni chevron (ils se lisent dans la fiche)', () => {
  const { e, recette } = lundi();
  const noeud = page(e);
  const ligne = ligneDe(noeud, 'RECETTE_TEST');
  assert.equal(classes(ligne, 'prod-etiquette').length, 0);
  assert.equal(classes(ligne, 'prod-etiquettes').length, 0);
  assert.doesNotMatch(ligne.textContent, /Recette|après le service|provenance/);
  assert.ok(classes(noeud, 'jour-bloc').some((b) => b.querySelector('h2').textContent === 'M2' && b.tous((x) => x === ligne).length));
  assert.equal(classes(ligne, 'mep-qte').length, 1);
  assert.equal(classes(ligne, 'prod-chevron').length, 0);
  assert.equal(classes(ligne, 'prod-nom')[0].attributs.href, `#/fiche/${encodeURIComponent(recette)}`);
});

test('ligne Brut : seulement nom et quantité ; ni pastille « Brut », ni créneau, destination, provenance ou chevron', () => {
  const { e, brut } = lundi();
  const ligne = ligneDe(page(e), 'BRUT_TEST');
  assert.equal(classes(ligne, 'prod-etiquette').length, 0);
  assert.equal(classes(ligne, 'prod-etiquettes').length, 0);
  assert.doesNotMatch(ligne.textContent, /avant le service|menu/i);
  assert.equal(classes(ligne, 'prod-provenance').length, 0);
  assert.equal(classes(ligne, 'prod-chevron').length, 0);
  assert.equal(classes(ligne, 'mep-qte').length, 1);
  // La fiche du produit s'ouvre depuis le nom.
  const hrefs = ligne.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
  assert.deepEqual(hrefs, [`#/fiche/${encodeURIComponent(brut)}`]);
});

test('une quantité absente n\'est ni une alerte ni une décision : étiquette « à préciser », sans provenance', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 2, J.PREPARATION_TEST, { nom: 'SANS_PREVISION_TEST' });
  planifier(e, principaleDe(e, c), S.lundi, 'avant_midi', h());
  const noeud = page(e);
  const ligne = ligneDe(noeud, 'SANS_PREVISION_TEST');
  assert.match(ligne.textContent, /à préciser/, 'l\'étiquette dit pourquoi, sans « — » seul');
  assert.equal(classes(ligne, 'prod-provenance').length, 0);
  assert.equal(classes(noeud, 'jour-decisions').length, 0);
});

test('gestes conservés : case « Fait », Corriger le réel, impression, case cochée grisée à sa place', () => {
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
  const debut = css.indexOf('Production (refonte 1, onglet 2)');
  const fin = css.indexOf('/* =====', debut);
  const bloc = css.slice(debut, fin > debut ? fin : undefined); // le bloc Production d'origine, pas ceux des écrans suivants
  const bloc2 = css.slice(css.indexOf('Production, refonte 2')); // les règles épurées de la refonte 2 (dernier bloc)
  const mini = css.slice(css.indexOf('Production minimaliste')); // retours d'essai du 2026-10-09 : flèches, « à saisir », résumés
  assert.match(mini, /\.prod-fleche \{[^}]*width: var\(--cible\); height: var\(--cible\)/);
  assert.match(mini, /\.prod-asaisir \{[^}]*min-height: var\(--cible\)/);
  assert.match(mini, /\.prod-resume \{[^}]*min-height: 48px/);
  assert.match(css, /\.prod-plus \{[^}]*min-width: var\(--cible\)[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.prod-ligne \.mep-qte \{ font-family: var\(--police-qte\)/);
  assert.match(css, /--cible: 44px/);
  assert.match(css, /--t-legende: 13px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(bloc, /transition|animation/, 'aucun mouvement ajouté');
});
