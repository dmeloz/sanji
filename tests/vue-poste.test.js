// Mode en poste (refonte 1) : une étape à la fois, étapes de la règle, « Fait » avec ordre respecté, Terminer, sans minuteur.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { definirRegle } from '../app/js/domaine/actions.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

let dom;
let magasin;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-poste.js');
});
beforeEach(() => vue.oublier());
after(() => dom.restaurer());

const ETAPES = [{ libelle: 'Couper', avanceMaxJours: 1 }, { libelle: 'Cuire', avanceMaxJours: 1 }, { libelle: 'Dresser', avanceMaxJours: 0 }];
const liens = (r) => r.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const bouton = (r, texte) => boutons(r).find((b) => b.textContent === texte);
const libellesBoutons = (r) => boutons(r).map((b) => b.textContent);

function scenario(etapes = ETAPES, nom = 'carottes') {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom });
  if (etapes.length) definirRegle(e, { nom, etapes }, h());
  magasin.remplacer(e);
  return { e: magasin.etat(), c };
}

test('poste : titre', () => assert.equal(vue.titre(), 'Mode en poste'));

test('poste : « Écran maintenu allumé » seulement si l\'API existe, sinon « l\'écran peut se mettre en veille »', () => {
  const { e, c } = scenario();
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { wakeLock: { request: async () => ({}) } } });
    assert.match(vue.rendre(e, c).textContent, /Écran maintenu allumé/);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: {} });
    const t = vue.rendre(e, c).textContent;
    assert.doesNotMatch(t, /Écran maintenu allumé/);
    assert.match(t, /l'écran peut se mettre en veille/);
  } finally {
    if (avant) Object.defineProperty(globalThis, 'navigator', avant); else delete globalThis.navigator;
  }
});

test('poste : nom, quantité en police quantité, écran allumé, étape 1 sur N, aucun minuteur', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  const t = racine.textContent;
  assert.match(t, /carottes/);
  assert.doesNotMatch(t, /Écran maintenu allumé/, 'sans API d\'écran allumé, la vue ne le promet pas');
  assert.match(t, /Étape 1 sur 3/);
  assert.match(t, /Couper/);
  assert.ok(racine.tous((x) => x.className.includes('poste-qte'))[0], 'quantité dans poste-qte');
  assert.doesNotMatch(t, /minut|timer|Lancer|\d+:\d\d/i);
  assert.ok(liens(racine).includes(`#/fiche/${encodeURIComponent(c)}`), 'quitter vers la fiche');
});

test('poste : Suivante et Précédente avancent et reculent d\'une étape', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  assert.equal(bouton(racine, 'Précédente'), undefined, 'Précédente inactive sur la première');
  bouton(racine, 'Suivante').ecouteurs.click[0]();
  assert.match(racine.textContent, /Étape 2 sur 3/);
  assert.match(racine.textContent, /Cuire/);
  bouton(racine, 'Précédente').ecouteurs.click[0]();
  assert.match(racine.textContent, /Étape 1 sur 3/);
});

test('poste : « Terminer » sur la dernière étape ramène à la fiche, sans « Suivante »', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  bouton(racine, 'Suivante').ecouteurs.click[0]();
  bouton(racine, 'Suivante').ecouteurs.click[0]();
  assert.match(racine.textContent, /Étape 3 sur 3/);
  assert.ok(!libellesBoutons(racine).includes('Suivante'));
  const fin = racine.tous((x) => x.balise === 'a' && x.textContent === 'Terminer')[0];
  assert.equal(fin.attributs.href, `#/fiche/${encodeURIComponent(c)}`);
});

test('poste : « Fait » d\'une étape suivante avant la précédente est refusé, dit en texte', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  bouton(racine, 'Suivante').ecouteurs.click[0]();
  bouton(racine, 'Fait').ecouteurs.click[0]();
  const alerte = racine.tous((x) => x.attributs.role === 'alert')[0];
  assert.ok(alerte, 'refus affiché');
  assert.match(alerte.textContent, /doit être faite avant/);
  const faits = Object.values(magasin.etat().productions).filter((p) => p.composantId === c && p.etat === 'fait');
  assert.equal(faits.length, 0);
});

test('poste : « Fait » sur la première étape la marque faite ; le geste devient « Annuler le fait »', () => {
  const { e, c } = scenario();
  bouton(vue.rendre(e, c), 'Fait').ecouteurs.click[0]();
  const e2 = magasin.etat();
  const premiere = Object.values(e2.productions).find((p) => p.composantId === c && p.etapeCle && p.ordre === 0);
  assert.equal(premiere.etat, 'fait');
  const racine = vue.rendre(e2, c);
  assert.ok(libellesBoutons(racine).includes('Annuler le fait'));
  assert.ok(!libellesBoutons(racine).includes('Fait'));
});

test('poste : à l\'ouverture, on part de la première étape pas encore faite', () => {
  const { e, c } = scenario();
  bouton(vue.rendre(e, c), 'Fait').ecouteurs.click[0]();
  vue.oublier();
  assert.match(vue.rendre(magasin.etat(), c).textContent, /Étape 2 sur 3/);
});

test('poste : moins de deux étapes, message et lien vers la fiche', () => {
  const { e, c } = scenario([{ libelle: 'Couper', avanceMaxJours: 1 }], 'poireaux');
  const racine = vue.rendre(e, c);
  assert.match(racine.textContent, /Pas d'étapes pour ce composant/);
  assert.deepEqual(liens(racine), [`#/fiche/${encodeURIComponent(c)}`]);
  assert.equal(boutons(racine).length, 0);
  const sans = vue.rendre(magasin.etat(), 'inconnu');
  assert.match(sans.textContent, /Pas d'étapes pour ce composant/);
});
