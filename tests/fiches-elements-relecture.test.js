// Relecture v118 : aucune portion déjà saisie ne se perd (hors poste en menu 2, migration, portion de la page, collision de renommage).
import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { definirPortionFiche, renommerFiche } from '../app/js/domaine/actions-fiches.js';
import { etatInitial, importer } from '../app/js/domaine/etat.js';
import { portionDeFiche } from '../app/js/domaine/fiches-elements.js';
import { reprendreFiche, retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { h } from './aide.js';

const doc = (etat) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, exporteLe: h(), etat });
const G80 = { valeur: 80, unite: 'g', etat: 'cuit' };

test('HAUT-1 : un élément qui passe hors poste en menu 2 ne détruit pas la fiche partagée (portion, rôle) ; seule l\'attribution part', () => {
  const e = etatInitial();
  retenirFiche(e, 'Haricots verts', { categorie: 'legume', role: 'garniture', grammage: G80 }, h());
  definirMenu(e, '2026-10-13', 2, 'Haricots verts', h(1));
  const c = Object.values(e.composants).find((x) => x.menu === 2);
  modifierComposant(e, c.id, { attribue: false }, h(2));
  const f = e.fiches_retenues['haricots verts'];
  assert.ok(f, 'la fiche existe encore');
  assert.deepEqual([f.role, f.grammage], ['garniture', G80]);
  assert.equal(f.attribue, undefined);
  assert.equal(e.memoire['haricots verts|2'].attribue, false);
  retenirFiche(e, 'Inconnu', { categorie: 'autre', attribue: false }, h(3));
  assert.equal(e.fiches_retenues.inconnu, undefined, 'sans fiche, rien n\'est écrit');
});

test('MOYEN-1 : migration d\'une fiche hors poste : décision dans memoire, portion et rôle gardés ; une fiche vide disparaît', () => {
  const fiches = { zorbi: { nom: 'Zorbi', categorie: 'autre', role: 'garniture', grammage: G80, attribue: false, h: h() }, vide: { attribue: false, h: h() } };
  const relu = importer(doc({ fiches_retenues: fiches }));
  assert.equal(relu.memoire['zorbi|2'].attribue, false);
  assert.deepEqual([relu.fiches_retenues.zorbi.role, relu.fiches_retenues.zorbi.grammage, relu.fiches_retenues.zorbi.attribue], ['garniture', G80, undefined]);
  assert.equal(relu.fiches_retenues.vide, undefined);
});

test('MOYEN-2 : la portion tapée sur la page est toujours celle de la fiche ; le standard de famille reste intact s\'il existe déjà', () => {
  const e = etatInitial();
  retenirFiche(e, 'Boulgour', { categorie: 'feculent', role: 'garniture', famille: 'boulgour', grammage: G80 }, h());
  definirPortionFiche(e, 'boulgour', 100, 'cuit', h(1));
  assert.equal(e.fiches_retenues.boulgour.grammage.valeur, 100);
  assert.equal(portionDeFiche(e, 'boulgour', e.fiches_retenues.boulgour).valeur, 100);
  assert.equal(e.standards.boulgour, undefined, 'le standard de la famille n\'est pas touché');
  definirMenu(e, '2026-11-02', 2, 'Boulgour', h(2));
  assert.equal(Object.values(e.composants).find((c) => c.nom === 'Boulgour').grammage.valeur, 100);
  const c = { nom: 'Boulgour', role: 'garniture', grammage: { valeur: null } };
  reprendreFiche(e, c);
  assert.equal(c.grammage.valeur, 100);
});

test('MOYEN-2 : sans portion ni standard maison, la portion devient aussi le standard de la famille ; un standard existant reste', () => {
  const e = etatInitial();
  retenirFiche(e, 'Boulgour', { categorie: 'feculent', role: 'garniture', famille: 'boulgour' }, h());
  definirPortionFiche(e, 'boulgour', 70, 'cuit', h(1));
  assert.equal(e.fiches_retenues.boulgour.grammage.valeur, 70);
  assert.equal(e.standards.boulgour.garniture.valeur, 70);
  const f = etatInitial();
  f.standards.quinoa = { garniture: { valeur: 60, unite: 'g', etat: 'cuit', h: h() } };
  retenirFiche(f, 'Quinoa', { categorie: 'feculent', role: 'garniture', famille: 'quinoa' }, h());
  definirPortionFiche(f, 'quinoa', 90, 'cuit', h(1));
  assert.equal(f.standards.quinoa.garniture.valeur, 60);
  assert.equal(f.fiches_retenues.quinoa.grammage.valeur, 90);
});

test('MOYEN-3 : renommer vers un nom qui a déjà une fiche fusionne : la cible gagne, l\'ancienne complète', () => {
  const e = etatInitial();
  retenirFiche(e, 'Boulghour', { categorie: 'autre', role: 'garniture', grammage: G80 }, h());
  retenirFiche(e, 'Boulgour', { categorie: 'feculent' }, h(1));
  renommerFiche(e, 'boulghour', 'Boulgour', h(2));
  assert.equal(e.fiches_retenues.boulghour, undefined);
  const f = e.fiches_retenues.boulgour;
  assert.deepEqual([f.categorie, f.role, f.grammage], ['feculent', 'garniture', G80]);
});
