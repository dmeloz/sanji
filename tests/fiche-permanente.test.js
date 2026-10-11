// Fiche permanente (v114, v118) : orthographes retenues, fiches d'éléments retenues par nom, import/export. Les plats retenus n'existent plus
// (v118) : voir fiches-elements.test.js pour la migration, la clôture par élément et la page des fiches.
// Plats génériques ; aucune donnée de restaurant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { corrigerNom, oublierFiche } from '../app/js/domaine/actions-fiches.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { correctionDuJour } from '../app/js/domaine/actions-validation.js';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { rapportApprentissage } from '../app/js/domaine/rapport-apprentissage.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { enseignerAuPoste, h } from './aide.js';

const PASSE = '2026-09-28'; // lundi, avant h() (2026-10-01)
const FUTUR = '2026-10-12'; // lundi
const FUTUR2 = '2026-10-13';
const TROIS_SEMAINES = '2026-11-02'; // lundi
const TROIS_SEMAINES2 = '2026-11-03';
const parNom = (e, date, menu, nom) => Object.values(e.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);
const duMenu = (e, date, menu) => Object.values(e.composants).filter((c) => c.date === date && c.menu === menu);

// ------------------------------------------------------------- couche 1 : corriger le nom

test('corriger le nom : l\'orthographe d\'origine est retenue et corrigée à l\'import suivant', () => {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'Boulghour, courgette sautée', h());
  const id = parNom(e, FUTUR, 2, 'Boulghour').id;
  const r = corrigerNom(e, id, 'Boulgour', h(5));
  assert.equal(e.composants[id].nom, 'Boulgour');
  assert.deepEqual(e.noms.boulghour, { nom: 'Boulgour', h: h(5) });
  assert.equal(r.retenue, true);
  definirMenu(e, FUTUR2, 2, 'Boulghour', h(6));
  assert.deepEqual(duMenu(e, FUTUR2, 2).map((c) => c.nom), ['Boulgour']);
  assert.deepEqual(lirePlat('Boulghour', 2, { noms: e.noms }).elements.map((x) => x.nom), ['Boulgour']);
});

test('corriger le nom : les semaines à venir sont corrigées, les passées restent intactes', () => {
  const e = etatInitial();
  definirMenu(e, PASSE, 2, 'Boulghour', h());
  definirMenu(e, FUTUR, 1, 'Boulghour', h());
  definirMenu(e, FUTUR2, 2, 'Boulghour', h());
  const id = parNom(e, FUTUR, 1, 'Boulghour').id;
  const r = corrigerNom(e, id, 'Boulgour', h(5));
  assert.equal(r.corriges, 2);
  assert.ok(parNom(e, FUTUR2, 2, 'Boulgour'));
  assert.ok(parNom(e, PASSE, 2, 'Boulghour'), 'la semaine passée garde l\'ancienne orthographe');
  assert.ok(e.journal.some((j) => j.action === 'corrigerNom'));
});

test('corriger le nom : refuse un nom vide, trop long ou une clé dangereuse ; ne change rien', () => {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'Boulghour', h());
  const id = parNom(e, FUTUR, 2, 'Boulghour').id;
  const avant = structuredClone(e);
  for (const mauvais of ['', '   ', 'x'.repeat(61), '__proto__', 'constructor']) {
    assert.throws(() => corrigerNom(e, id, mauvais, h(5)), undefined, mauvais);
  }
  assert.deepEqual(e, avant);
});

test('corriger la casse seule : le nom change, aucune orthographe n\'est retenue', () => {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'boulgour', h());
  const r = corrigerNom(e, duMenu(e, FUTUR, 2)[0].id, 'Boulgour', h(5));
  assert.equal(r.retenue, false);
  assert.deepEqual(e.noms, {});
});

// ------------------------------------------------------------- couche 2 : fiche retenue par nom

// « Zorbi » : mot inconnu, donc sans famille : sa portion n'a pas de standard maison, elle vit dans la fiche retenue du nom.
function zorbiRetenu() {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'Zorbi', h());
  const id = parNom(e, FUTUR, 2, 'Zorbi').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  saisirPortionInconnue(e, id, 80, h(2));
  return { e, id };
}

test('fiche retenue : écrite par les 4 choix et la portion tapée, reprise 3 semaines plus tard en menus 1 et 2', () => {
  const { e } = zorbiRetenu();
  const fiche = e.fiches_retenues.zorbi;
  assert.equal(fiche.categorie, 'autre');
  assert.equal(fiche.role, 'garniture');
  assert.deepEqual(fiche.grammage, { valeur: 80, unite: 'g', etat: 'cuit' });
  definirMenu(e, TROIS_SEMAINES, 1, 'Zorbi', h(10));
  definirMenu(e, TROIS_SEMAINES2, 2, 'Zorbi', h(10));
  for (const [date, menu] of [[TROIS_SEMAINES, 1], [TROIS_SEMAINES2, 2]]) {
    assert.notEqual(parNom(e, date, menu, 'Zorbi').categorie, 'a_preciser', `menu ${menu} : plus « à préciser »`);
  }
  const c2 = parNom(e, TROIS_SEMAINES2, 2, 'Zorbi');
  assert.equal(c2.role, 'garniture');
  assert.equal(grammageEffectif(e, c2).valeur, 80, 'menu 2 (même rôle) : portion posée, plus « à saisir »');
  const c1 = parNom(e, TROIS_SEMAINES, 1, 'Zorbi');
  assert.equal(c1.role, 'garniture', 'v114 : le rôle réglé est repris aussi en menu 1');
  assert.equal(grammageEffectif(e, c1).valeur, 80, 'même rôle : portion reprise');
  assert.equal(parNom(e, TROIS_SEMAINES2, 2, 'Zorbi').attribue, true, 'l\'attribution retenue (au poste) vaut en menu 2');
  assert.equal(parNom(e, TROIS_SEMAINES, 1, 'Zorbi').attribue, true, 'le menu 1 reste au poste');
});

test('fiche retenue : la correction du plat passe devant et « pour ce plat seulement » n\'écrit pas la fiche', () => {
  const { e } = zorbiRetenu();
  definirMenu(e, TROIS_SEMAINES2, 2, 'Zorbi', h(10));
  const c = parNom(e, TROIS_SEMAINES2, 2, 'Zorbi');
  correctionDuJour(e, c.id, { valeur: 95 }, h(11));
  assert.equal(grammageEffectif(e, e.composants[c.id]).valeur, 95);
  assert.equal(e.fiches_retenues.zorbi.grammage.valeur, 80, 'la fiche garde 80 g');
});

test('fiche retenue : jamais appliquée à un autre nom ni aux semaines passées', () => {
  const { e } = zorbiRetenu();
  definirMenu(e, PASSE, 2, 'Zorbi', h(10));
  definirMenu(e, TROIS_SEMAINES2, 2, 'Zorbine', h(10));
  const passe = parNom(e, PASSE, 2, 'Zorbi');
  assert.equal(passe.grammage.valeur, 80, 'un menu créé maintenant reprend la fiche, même daté du passé (création, pas modification)');
  const autre = parNom(e, TROIS_SEMAINES2, 2, 'Zorbine');
  assert.equal(autre.grammage.valeur, null);
  assert.equal(autre.categorie, 'a_preciser');
});

test('fiche retenue : une portion tapée met à jour les éléments à venir du même nom, pas ceux du passé', () => {
  const e = etatInitial();
  definirMenu(e, PASSE, 2, 'Zorbi', h());
  definirMenu(e, FUTUR, 2, 'Zorbi', h());
  definirMenu(e, FUTUR2, 1, 'Zorbi', h());
  const id = parNom(e, FUTUR, 2, 'Zorbi').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  saisirPortionInconnue(e, id, 70, h(2));
  assert.equal(parNom(e, FUTUR2, 1, 'Zorbi').grammage.valeur, 70);
  assert.equal(parNom(e, PASSE, 2, 'Zorbi').grammage.valeur, null);
});

test('fiche retenue : suit la correction du nom (la fiche passe au nom correct)', () => {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'Boulghour', h());
  const id = parNom(e, FUTUR, 2, 'Boulghour').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  assert.ok(e.fiches_retenues.boulghour);
  corrigerNom(e, id, 'Boulgour', h(2));
  assert.ok(e.fiches_retenues.boulgour);
  assert.equal(e.fiches_retenues.boulghour, undefined);
});

// ------------------------------------------------------------- couche 3 : oublier, rapport

test('oublier : retire la fiche et l\'orthographe associée, sans toucher aux éléments créés', () => {
  const e = etatInitial();
  definirMenu(e, FUTUR, 2, 'Boulghour', h());
  const id = parNom(e, FUTUR, 2, 'Boulghour').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  corrigerNom(e, id, 'Boulgour', h(2));
  oublierFiche(e, 'boulgour', h(3));
  assert.deepEqual(e.fiches_retenues, {});
  assert.deepEqual(e.noms, {});
  assert.equal(e.composants[id].nom, 'Boulgour');
  assert.throws(() => oublierFiche(e, 'boulgour', h(4)));
});

test('rapport : le nombre de fiches retenues est compté (la liste vit sur la page des fiches)', () => {
  const { e } = zorbiRetenu();
  const r = rapportApprentissage(e);
  assert.equal(r.fichesRetenues, 1);
  assert.equal(r.fiches, undefined);
  assert.equal(r.plats, undefined);
});

// ------------------------------------------------------------- import / export

const doc = (etat) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, exporteLe: h(), etat });

test('export puis import : orthographes et fiches retenues reviennent identiques', () => {
  const { e } = zorbiRetenu();
  e.noms.boulghour = { nom: 'Boulgour', h: h(3) };
  definirMenu(e, FUTUR, 1, 'Fusilli al ferretto', h(4));
  modifierComposant(e, parNom(e, FUTUR, 1, 'sauce à confirmer').id, { nom: 'tomate' }, h(5));
  const relu = importer(exporter(e, h(6)));
  assert.deepEqual(relu.noms, e.noms);
  assert.deepEqual(relu.fiches_retenues, e.fiches_retenues);
  assert.ok(relu.fiches_retenues.tomate, 'la sauce nommée est une fiche d\'élément');
});

test('import : un ancien fichier sans les champs donne des collections vides', () => {
  const relu = importer(doc({}));
  assert.deepEqual([relu.noms, relu.fiches_retenues, relu.plats_retenus], [{}, {}, undefined]);
});

test('import : entrées invalides, clés dangereuses et tailles', () => {
  const noms = JSON.parse('{"__proto__":{"nom":"x"},"constructor":{"nom":"x"},"vide":{"nom":""},"long":{"nom":"' + 'x'.repeat(61) + '"},"Maj":{"nom":"x"},"ok":{"nom":"Bon","h":"2026-10-01T08:00:00.000Z"},"soi":{"nom":"soi"}}');
  const fiches = JSON.parse('{"__proto__":{"categorie":"autre"},"a":{"categorie":"nimporte"},"b":{"categorie":"a_preciser"},"c":{"categorie":"autre","role":"garniture","grammage":{"valeur":-1,"unite":"g"}},"d":{"categorie":"legume","grammage":{"valeur":80,"unite":"g","etat":"cuit"}}}');
  const relu = importer(doc({ noms, fiches_retenues: fiches }));
  assert.deepEqual(Object.keys(relu.noms), ['ok']);
  assert.deepEqual(Object.keys(relu.fiches_retenues).sort(), ['c', 'd']);
  assert.equal(relu.fiches_retenues.c.grammage, undefined, 'un grammage invalide est retiré');
  const trop = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`variante${i}`, { nom: `Nom ${i}` }]));
  assert.equal(Object.keys(importer(doc({ noms: trop })).noms).length, 500);
  assert.throws(() => importer(doc({ noms: [] })), /noms/);
  assert.throws(() => importer(doc({ fiches_retenues: 'x' })), /fiches_retenues/);
});
