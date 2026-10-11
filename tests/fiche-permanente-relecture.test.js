// Relecture de la v114 (adaptée v118 : plus de plats retenus) : portion toujours prise dans la fiche à jour, plafonds avec éviction,
// alias sans mot redoublé, rôle et provenance de la portion retenue. Plats génériques.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouterComposant, definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { corrigerNom } from '../app/js/domaine/actions-fiches.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';
import { etatInitial, importer } from '../app/js/domaine/etat.js';
import { FICHES_MAX, reprendreFiche, retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { enseignerAuPoste, h } from './aide.js';

const [S1, S2, S3] = ['2026-10-12', '2026-10-19', '2026-11-02'];
const parNom = (e, date, menu, nom) => Object.values(e.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);
// H2 / M3 / M4

test('H2 : la portion reprise vient de la fiche à jour de l\'élément', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const id = parNom(e, S1, 2, 'Zorbi').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  saisirPortionInconnue(e, id, 150, h(2));
  definirMenu(e, S2, 2, 'Zorbi', h(3));
  const c2 = parNom(e, S2, 2, 'Zorbi');
  assert.equal(grammageEffectif(e, c2).valeur, 150);
  saisirPortionInconnue(e, c2.id, 180, h(4));
  definirMenu(e, S3, 2, 'Zorbi', h(5));
  assert.equal(grammageEffectif(e, parNom(e, S3, 2, 'Zorbi')).valeur, 180);
});

test('H2 : un ancien fichier avec un grammage dans un plat retenu l\'ignore (migration : la fiche n\'a que catégorie, rôle, attribution)', () => {
  const doc = { application: 'sanji-entremetier', schema: 1, exporteLe: h(), etat: { plats_retenus: { p: { menu: 2, elements: [{ nom: 'Zorbi', categorie: 'autre', role: 'garniture', attribue: true, grammage: { valeur: 80, unite: 'g', etat: 'cuit' } }], h: h() } } } };
  const fiche = importer(JSON.stringify(doc)).fiches_retenues.zorbi;
  assert.equal(fiche.categorie, 'autre');
  assert.equal(fiche.grammage, undefined);
});

test('M4 : la portion retenue est reprise quand le rôle est le même (le rôle réglé est repris en menu 1 aussi)', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const id = parNom(e, S1, 2, 'Zorbi').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  saisirPortionInconnue(e, id, 150, h(2));
  assert.equal(e.fiches_retenues.zorbi.grammage.valeur, 150);
  definirMenu(e, S3, 1, 'Zorbi', h(3));
  const c = parNom(e, S3, 1, 'Zorbi');
  assert.equal(c.role, 'garniture');
  assert.equal(c.grammage.valeur, 150);
});

test('M4 : seule une portion tapée ou validée par la propriétaire est retenue (jamais un standard de base ni un inconnu)', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const c = parNom(e, S1, 2, 'Zorbi');
  enseignerAuPoste(e, c.id, 'garniture', h(1));
  modifierComposant(e, c.id, { grammage: { valeur: 90, unite: 'g', statut: 'STANDARD_BASE', source: 'x', etat: 'cuit' } }, h(2));
  e.composants[c.id].valide = true;
  // memoriser est appelé par « Mémoriser comme référence maison »
  return import('../app/js/domaine/actions.js').then(({ memoriser }) => {
    memoriser(e, c.id, h(3));
    assert.equal(e.fiches_retenues.zorbi.grammage, undefined);
  });
});

// M1
test('M1 : fiches saturées, la plus ancienne est évincée (jamais un refus silencieux)', () => {
  const e = etatInitial();
  for (let i = 0; i < FICHES_MAX; i += 1) e.fiches_retenues[`nom${i}`] = { categorie: 'autre', h: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() };
  retenirFiche(e, 'Nouveau', { categorie: 'legume' }, h());
  assert.equal(Object.keys(e.fiches_retenues).length, FICHES_MAX);
  assert.ok(e.fiches_retenues.nouveau);
  assert.equal(e.fiches_retenues.nom0, undefined);
  assert.ok(e.fiches_retenues.nom1);
});

test('M1 : orthographes saturées, la plus ancienne est évincée', () => {
  const e = etatInitial();
  for (let i = 0; i < 500; i += 1) e.noms[`var${i}`] = { nom: `Nom ${i}`, h: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() };
  definirMenu(e, S1, 2, 'Boulghour', h());
  corrigerNom(e, parNom(e, S1, 2, 'Boulghour').id, 'Boulgour', h(1));
  assert.equal(Object.keys(e.noms).length, 500);
  assert.ok(e.noms.boulghour);
  assert.equal(e.noms.var0, undefined);
});

// M2
test('M2 : un nom correct qui contient déjà l\'ancien ne crée pas d\'alias et ne redouble pas de mot', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Riz basmati', h());
  const r = corrigerNom(e, parNom(e, S1, 2, 'Riz basmati').id, 'Riz basmati parfumé', h(1));
  assert.equal(r.retenue, false);
  assert.deepEqual(e.noms, {});
  const noms = { 'riz basmati': { nom: 'Riz basmati parfumé', h: h() } };
  assert.deepEqual(lirePlat('Riz basmati parfumé', 2, { noms }).elements.map((x) => x.nom), ['Riz basmati parfumé']);
  assert.deepEqual(lirePlat('Riz basmati', 2, { noms }).elements.map((x) => x.nom), ['Riz basmati parfumé']);
});

// Contre-relecture
test('MOYEN-2 : une sauce « à confirmer » implicite ne se renomme pas par « Corriger le nom »', () => {
  const e = etatInitial();
  definirMenu(e, S1, 1, 'Fusilli al ferretto', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  const avant = structuredClone(e);
  assert.throws(() => corrigerNom(e, parNom(e, S1, 1, 'sauce à confirmer').id, 'tomate', h(1)), /Choisir la sauce/);
  assert.deepEqual(e, avant);
});

test('MOYEN-1 : le rôle réglé (plat principal, menu 2) est repris à la création quand le savoir n\'a posé qu\'un rôle par défaut, avec sa portion', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const id = parNom(e, S1, 2, 'Zorbi').id;
  enseignerAuPoste(e, id, 'garniture', h(1));
  modifierComposant(e, id, { role: 'plat_principal' }, h(2));
  saisirPortionInconnue(e, id, 150, h(3));
  definirMenu(e, S3, 2, 'Zorbi, courgette sautée', h(4)); // autre intitulé : seule la fiche du nom est reprise
  const c = parNom(e, S3, 2, 'Zorbi');
  assert.equal(c.role, 'plat_principal');
  assert.equal(grammageEffectif(e, c).valeur, 150);
});

test('MOYEN-1 : un rôle posé explicitement n\'est pas remplacé par la fiche, et la portion d\'un autre rôle n\'est pas reprise', () => {
  const e = etatInitial();
  e.fiches_retenues.zorbi = { categorie: 'autre', role: 'garniture', grammage: { valeur: 80, unite: 'g', etat: 'cuit' }, h: h() };
  const c = { nom: 'Zorbi', role: 'plat_principal', grammage: { valeur: null } };
  reprendreFiche(e, c);
  assert.equal(c.role, 'plat_principal');
  assert.equal(c.grammage.valeur, null);
});

test('MOYEN-3 : une mémoire « à préciser » ne prime pas sur la catégorie proposée à l\'ajout', () => {
  const e = etatInitial();
  e.memoire['carottes|2'] = { nom: 'carottes', attribue: true, categorie: 'a_preciser' };
  const id = ajouterComposant(e, S1, 2, { nom: 'Carottes' }, h());
  assert.notEqual(e.composants[id].categorie, 'a_preciser');
  e.memoire['poireaux|2'] = { nom: 'poireaux', attribue: true, categorie: 'nimporte' };
  const id2 = ajouterComposant(e, S1, 2, { nom: 'Poireaux' }, h());
  assert.ok(['legume', 'a_preciser'].includes(e.composants[id2].categorie));
  assert.notEqual(e.composants[id2].categorie, 'nimporte');
});

test('BAS-1 : un appel sans champ valide n\'évince rien', () => {
  const e = etatInitial();
  for (let i = 0; i < FICHES_MAX; i += 1) e.fiches_retenues[`nom${i}`] = { categorie: 'autre', h: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() };
  retenirFiche(e, 'Nouveau', { categorie: 'a_preciser' }, h());
  assert.ok(e.fiches_retenues.nom0);
  assert.equal(e.fiches_retenues.nouveau, undefined);
});

test('BAS-4 : un grammage sans rôle n\'est jamais retenu (écriture et import)', () => {
  const e = etatInitial();
  retenirFiche(e, 'Zorbi', { grammage: { valeur: 80, unite: 'g', etat: 'cuit' } }, h());
  assert.equal(e.fiches_retenues.zorbi, undefined);
  const doc = JSON.stringify({ application: 'sanji-entremetier', schema: 1, exporteLe: h(),
    etat: { fiches_retenues: { a: { categorie: 'autre', grammage: { valeur: 80, unite: 'g' } }, b: { role: 'garniture', grammage: { valeur: 80, unite: 'g' } } } } });
  const f = importer(doc).fiches_retenues;
  assert.equal(f.a.grammage, undefined);
  assert.equal(f.b.grammage.valeur, 80);
});
