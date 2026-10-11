import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLICATION, ajouterJournal, assurerJour, etatInitial, exporter, importer, jourOuVide, normaliser, nouvelId,
  TAILLE_JOURNAL,
} from '../app/js/domaine/etat.js';
import { JEU_COMPOSANTS } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE } from './jeux/TEST_ONLY-semaine.js';
import { h } from './aide.js';

test('base neuve vide : aucun couvert, recette, production ni fournisseur', () => {
  const e = etatInitial();
  assert.equal(e.application, APPLICATION);
  assert.equal(e.schema, 1);
  for (const c of ['jours', 'fiches', 'composants', 'productions', 'regles', 'recettes', 'fournisseurs', 'memoire', 'produits']) {
    assert.deepEqual(e[c], {}, c);
  }
  assert.deepEqual(e.journal, []);
  assert.equal(e.reglages.semaineTypeConfirmee, false);
  assert.equal(e.reglages.capaciteCreneau, null);
  assert.deepEqual(Object.keys(e.reglages.semaineType), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(Object.keys(e.reglages.semaineType[1]), ['avant_midi', 'apres_midi']);
  assert.deepEqual(Object.keys(e.reglages.semaineType[6]), ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.ok(Object.values(e.reglages.semaineType).every((j) => Object.values(j).every((v) => v === 'libre')));
  assert.notEqual(etatInitial().reglages, e.reglages, 'chaque appel renvoie un objet neuf');
});

test('normaliser : minuscules, sans accents, espaces réduits', () => {
  assert.equal(normaliser('  Élément   TEST  '), 'element test');
  assert.equal(normaliser('Œuf'), 'oeuf');
  assert.equal(normaliser(null), '');
  assert.equal(normaliser('PRODUIT_SEC_TEST'), 'produit_sec_test');
});

test('nouvelId : préfixe, unicité, sans dépendre de l\'heure', () => {
  const ids = new Set(Array.from({ length: 500 }, () => nouvelId('x')));
  assert.equal(ids.size, 500);
  assert.ok([...ids].every((i) => i.startsWith('x_')));
});

test('exporter / importer : aller-retour identique', () => {
  const e = etatInitial();
  assurerJour(e, JEU_SEMAINE.lundi).previsions[1] = { portions: 7, h: h() };
  ajouterJournal(e, h(), 'test', 'détail');
  const texte = exporter(e, h(3));
  const doc = JSON.parse(texte);
  assert.equal(doc.application, APPLICATION);
  assert.equal(doc.schema, 1);
  assert.equal(doc.exporteLe, h(3));
  assert.deepEqual(importer(texte), e);
});

test('importer complète les champs absents', () => {
  const minimal = JSON.stringify({ application: APPLICATION, schema: 1, etat: {
    jours: { '2026-10-05': { date: '2026-10-05', menus: { 1: { intitule: 'INTITULE_TEST' } } } },
    fiches: { f1: { id: 'f1', date: '2026-10-05' } },
  } });
  const e = importer(minimal);
  assert.equal(e.jours['2026-10-05'].menus[1].intitule, 'INTITULE_TEST');
  assert.equal(e.jours['2026-10-05'].menus[1].transcriptionValidee, false);
  assert.deepEqual(e.jours['2026-10-05'].menus[2], { intitule: '', transcriptionValidee: false });
  assert.deepEqual(e.jours['2026-10-05'].previsions, { 1: { portions: null, h: null }, 2: { portions: null, h: null } });
  assert.equal(e.fiches.f1.statut, 'active');
  assert.deepEqual(e.fiches.f1.repartition, { 1: 0, 2: 0 });
  assert.deepEqual(e.reglages, etatInitial().reglages);
  assert.deepEqual(e.journal, []);
});

test('importer refuse un fichier TEST_ONLY, à tout niveau', () => {
  assert.throws(() => importer(JSON.stringify(JEU_COMPOSANTS)), /TEST_ONLY|jeu de test/);
  const enveloppe = (etat, extra = {}) => JSON.stringify({ application: APPLICATION, schema: 1, ...extra, etat });
  assert.throws(() => importer(enveloppe({}, { etiquette: 'TEST_ONLY' })), /TEST_ONLY/);
  assert.throws(() => importer(enveloppe({ etiquette: 'TEST_ONLY' })), /TEST_ONLY/);
  assert.throws(() => importer(enveloppe({ composants: { c1: { id: 'c1', allergenes: { liste: [{ etiquette: 'test_only' }] } } } })), /TEST_ONLY/);
  assert.throws(() => importer(enveloppe({ journal: [{ etiquette: ' TEST_ONLY ' }] })), /TEST_ONLY/);
  // Une autre étiquette n'est pas refusée.
  assert.doesNotThrow(() => importer(enveloppe({ reglages: { etiquette: 'AUTRE' } })));
});

test('importer refuse un document étranger, un schéma inconnu et un contenu corrompu', () => {
  assert.throws(() => importer('pas du json'), /illisible/);
  assert.throws(() => importer('[]'), /pas un export/);
  assert.throws(() => importer(JSON.stringify({ application: 'autre', schema: 1, etat: {} })), /pas un export/);
  assert.throws(() => importer(JSON.stringify({ application: APPLICATION, schema: 99, etat: {} })), /non prise en charge/);
  assert.throws(() => importer(JSON.stringify({ application: APPLICATION, schema: 1 })), /incomplet/);
  assert.throws(() => importer(JSON.stringify({ application: APPLICATION, schema: 1, etat: { jours: [] } })), /corrompu/);
  assert.throws(() => importer(JSON.stringify({ application: APPLICATION, schema: 1, etat: { journal: {} } })), /corrompu/);
});

test('importer ignore les clés dangereuses', () => {
  const texte = '{"application":"sanji-entremetier","schema":1,"etat":{"composants":{"__proto__":{"x":1},"c1":{"id":"c1"}}}}';
  const e = importer(texte);
  assert.deepEqual(Object.keys(e.composants), ['c1']);
  assert.equal({}.x, undefined);
});

test('journal : 2000 dernières entrées', () => {
  const e = etatInitial();
  for (let i = 0; i < TAILLE_JOURNAL + 25; i += 1) ajouterJournal(e, h(), 'a', String(i));
  assert.equal(e.journal.length, TAILLE_JOURNAL);
  assert.equal(e.journal[0].detail, '25');
});

test('jourOuVide ne crée rien ; assurerJour crée', () => {
  const e = etatInitial();
  assert.equal(jourOuVide(e, '2026-10-05').date, '2026-10-05');
  assert.deepEqual(e.jours, {});
  assurerJour(e, '2026-10-05');
  assert.deepEqual(Object.keys(e.jours), ['2026-10-05']);
});
