// Relecture de la v114 : invariants de la sauce reprise, portion toujours prise dans la fiche à jour, plafonds avec éviction,
// alias sans mot redoublé, rôle et provenance de la portion retenue, plats renommés, rappel de clôture. Plats génériques.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouterComposant, definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { corrigerNom, oublierPlat, retenirTelQuel } from '../app/js/domaine/actions-fiches.js';
import { enseignerMot } from '../app/js/domaine/actions-mots.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';
import { etatInitial, importer } from '../app/js/domaine/etat.js';
import { FICHES_MAX, PLATS_MAX, reprendreFiche, retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { clePlat, rappelCloture } from '../app/js/domaine/plats-retenus.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { rapportApprentissage } from '../app/js/domaine/rapport-apprentissage.js';
import { h } from './aide.js';

const [S1, S2, S3] = ['2026-10-12', '2026-10-19', '2026-11-02'];
const parNom = (e, date, menu, nom) => Object.values(e.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);
const plat = (e, date, menu, intitule, sauce) => {
  definirMenu(e, date, menu, intitule, h());
  modifierComposant(e, Object.values(e.composants).find((c) => c.date === date && c.menu === menu && c.nom === 'sauce à confirmer').id, { nom: sauce }, h(1));
};

// H1 / M5
test('H1 : corriger l\'orthographe d\'une sauce reprise ne la confirme pas et ne retient pas le plat', () => {
  const e = etatInitial();
  plat(e, S1, 1, 'Fusilli al ferretto', 'Bolonaise');
  definirMenu(e, S3, 1, 'Fusilli al ferretto', h(2));
  oublierPlat(e, clePlat(e, 'Fusilli al ferretto'), h(3));
  const sauce = parNom(e, S3, 1, 'Bolonaise');
  assert.equal(sauce.reprise, true);
  corrigerNom(e, sauce.id, 'Bolognaise', h(4));
  assert.equal(e.composants[sauce.id].nom, 'Bolognaise');
  assert.equal(e.composants[sauce.id].reprise, true, 'toujours à reconfirmer');
  assert.deepEqual(e.plats_retenus, {}, 'le plat n\'est pas retenu en silence');
  assert.ok(!e.journal.some((j) => j.action === 'retenirPlat' && j.h === h(4)));
});

test('M5 : corriger un nom renomme les plats retenus et leurs clés', () => {
  const e = etatInitial();
  plat(e, S1, 1, 'Fusilli al ferretto', 'Bolonaise');
  definirMenu(e, S3, 1, 'Fusilli al ferretto', h(2));
  corrigerNom(e, parNom(e, S3, 1, 'Bolonaise').id, 'Bolognaise', h(4));
  const noms = Object.values(e.plats_retenus).flatMap((p) => p.elements.map((x) => x.nom));
  assert.ok(noms.includes('Bolognaise') && !noms.includes('Bolonaise'));
  definirMenu(e, '2026-11-09', 1, 'Fusilli al ferretto', h(5));
  assert.ok(parNom(e, '2026-11-09', 1, 'Bolognaise'));
  assert.ok(!parNom(e, '2026-11-09', 1, 'Bolonaise'), 'l\'ancienne orthographe n\'est pas recréée');
});

test('M5 : la clé d\'un plat qui contient l\'ancien nom suit le nouveau nom', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbo', h());
  enseignerMot(e, parNom(e, S1, 2, 'Zorbo').id, 'garniture', h(1));
  assert.deepEqual(Object.keys(e.plats_retenus), ['zorbo']);
  corrigerNom(e, parNom(e, S1, 2, 'Zorbo').id, 'Zorbi', h(2));
  assert.deepEqual(Object.keys(e.plats_retenus), ['zorbi']);
});

// H2 / M3 / M4
test('H2 : la portion d\'un plat repris vient de la fiche à jour, pas d\'un chiffre figé dans le plat', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const id = parNom(e, S1, 2, 'Zorbi').id;
  enseignerMot(e, id, 'garniture', h(1));
  saisirPortionInconnue(e, id, 150, h(2));
  assert.ok(Object.values(e.plats_retenus).every((p) => p.elements.every((x) => !('grammage' in x))));
  definirMenu(e, S2, 2, 'Zorbi', h(3));
  const c2 = parNom(e, S2, 2, 'Zorbi');
  assert.equal(grammageEffectif(e, c2).valeur, 150);
  saisirPortionInconnue(e, c2.id, 180, h(4));
  definirMenu(e, S3, 2, 'Zorbi', h(5));
  assert.equal(grammageEffectif(e, parNom(e, S3, 2, 'Zorbi')).valeur, 180);
});

test('H2 : un ancien fichier avec un grammage dans un plat retenu l\'ignore', () => {
  const doc = { application: 'sanji-entremetier', schema: 1, exporteLe: h(), etat: { plats_retenus: { p: { elements: [{ nom: 'Zorbi', categorie: 'autre', attribue: true, grammage: { valeur: 80, unite: 'g', etat: 'cuit' } }], h: h() } } } };
  assert.equal('grammage' in importer(JSON.stringify(doc)).plats_retenus.p.elements[0], false);
});

test('M4 : la portion retenue est reprise quand le rôle est le même (le rôle réglé est repris en menu 1 aussi)', () => {
  const e = etatInitial();
  definirMenu(e, S1, 2, 'Zorbi', h());
  const id = parNom(e, S1, 2, 'Zorbi').id;
  enseignerMot(e, id, 'garniture', h(1));
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
  enseignerMot(e, c.id, 'garniture', h(1));
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

test('M1 : plats saturés, le plus ancien est évincé et le nouveau retenu', () => {
  const e = etatInitial();
  for (let i = 0; i < PLATS_MAX; i += 1) e.plats_retenus[`plat${i}`] = { elements: [{ nom: 'x', categorie: 'autre', attribue: true }], menu: 2, h: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() };
  definirMenu(e, S1, 2, 'Zorbi', h());
  enseignerMot(e, parNom(e, S1, 2, 'Zorbi').id, 'garniture', h(1));
  assert.equal(Object.keys(e.plats_retenus).length, PLATS_MAX);
  assert.ok(e.plats_retenus.zorbi);
  assert.equal(e.plats_retenus.plat0, undefined);
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

test('M1 : « Retenir tel quel » dit la vraie cause (intitulé inutilisable) ; un plat déjà à jour ne lève rien', () => {
  const e = etatInitial();
  definirMenu(e, S1, 1, 'Gnocchi alla sorrentina', h());
  retenirTelQuel(e, S1, 1, h(1));
  assert.doesNotThrow(() => retenirTelQuel(e, S1, 1, h(2)), 'déjà retenu et à jour');
  e.jours[S1].menus[1].intitule = '';
  oublierPlat(e, Object.keys(e.plats_retenus)[0], h(3));
  assert.throws(() => retenirTelQuel(e, S1, 1, h(4)), /intitulé/);
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

// B5
test('B5 : le rappel de clôture ne compte pas les plats qu\'aucun geste ne peut retenir', () => {
  const e = etatInitial();
  definirMenu(e, S1, 1, 'Fusilli al ferretto', h()); // sauce implicite sans nom
  assert.equal(rappelCloture(e, '2026-10-18', '09:00'), null);
  definirMenu(e, '2026-10-13', 1, 'Gnocchi alla sorrentina', h());
  assert.equal(rappelCloture(e, '2026-10-18', '09:00').aRetenir, 1);
});

// Fiche de plat : énoncé et composition, jamais de quantité
test('plat retenu : garde l\'intitulé original et sa composition lisible en une ligne dans le rapport', () => {
  const e = etatInitial();
  definirMenu(e, S1, 1, "Fusilli al ferretto à la N'Duja", h());
  retenirTelQuel(e, S1, 1, h(1));
  const p = Object.values(e.plats_retenus)[0];
  assert.equal(p.intitule, "Fusilli al ferretto à la N'Duja");
  assert.ok(p.elements.every((x) => !('grammage' in x)), 'aucune quantité dans la fiche de plat');
  const ligne = rapportApprentissage(e).plats[0].resume;
  assert.match(ligne, /^Fusilli al ferretto à la N'Duja — /);
  assert.match(ligne, /Fusilli al ferretto · /);
  assert.match(ligne, /duja · sauce/i);
});

test('plat retenu : un ancien plat sans intitulé retombe sur le nom normalisé ; l\'import nettoie l\'intitulé', () => {
  const e = etatInitial();
  e.plats_retenus.zorbi = { elements: [{ nom: 'Zorbi', categorie: 'autre', attribue: true }], menu: 2, h: h() };
  assert.match(rapportApprentissage(e).plats[0].resume, /^zorbi — Zorbi/);
  const doc = (intitule) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, exporteLe: h(),
    etat: { plats_retenus: { p: { intitule, elements: [{ nom: 'Zorbi', categorie: 'autre', attribue: true }], h: h() } } } });
  assert.equal(importer(doc('  Plat\u0007 propre  ')).plats_retenus.p.intitule, 'Plat propre');
  assert.equal(importer(doc('x'.repeat(300))).plats_retenus.p.intitule.length, 200);
  assert.equal(importer(doc(42)).plats_retenus.p.intitule, undefined);
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
  enseignerMot(e, id, 'garniture', h(1));
  modifierComposant(e, id, { role: 'plat_principal' }, h(2));
  saisirPortionInconnue(e, id, 150, h(3));
  definirMenu(e, S3, 2, 'Zorbi, courgette sautée', h(4)); // autre intitulé : pas de reprise de plat, seulement la fiche du nom
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
