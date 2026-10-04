// Apprentissage : une correction répétée dans le même sens fait proposer la mise à jour du standard (décision du
// 2026-10-04, point 8). Riz en garniture : repère validé 50–70 g sec, standard de base 60 g sec. Données TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { memoriser, modifierComposant, reprendreMemoire } from '../app/js/domaine/actions.js';
import { composantVide, etatInitial, importer } from '../app/js/domaine/etat.js';
import { accepterApprentissage, ecarterApprentissage } from '../app/js/domaine/actions-apprentissage.js';
import { propositionsApprentissage } from '../app/js/domaine/apprentissage.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { tableauBlanc } from '../app/js/domaine/tableau-blanc.js';

const AUJOURDHUI = '2026-10-06';

let n = 0;
/** Un plat « riz » en garniture corrigé à la main : `valeur` en `etat` de poids, servi le `date`. */
function corriger(e, date, valeur, { etat = 'sec', famille = 'riz', role = 'garniture', statut = 'RESTAURANT_VALIDE', nom = 'riz', menu = 2 } = {}) {
  n += 1;
  const id = `c_${n}`;
  e.composants[id] = { ...composantVide(id), date, menu, nom, categorie: 'feculent', famille, role, attribue: true, valide: true,
    grammage: { valeur, unite: 'g', etat, statut, source: 'corrigé pour ce plat' } };
  return id;
}
const propositions = (e, jour = AUJOURDHUI) => propositionsApprentissage(e, jour);

test('2 corrections ne font pas une proposition', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 85);
  assert.deepEqual(propositions(e), []);
});

test('3 corrections dans le même sens : proposition = médiane arrondie, avec famille, rôle, état, valeur actuelle, dates', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  const [p, ...autres] = propositions(e);
  assert.equal(autres.length, 0);
  assert.deepEqual([p.cleFamille, p.libelle, p.role, p.etatPoids, p.unite, p.valeur, p.sens, p.nombre],
    ['riz', 'riz', 'garniture', 'sec', 'g', 86, 'plus', 3]);
  assert.deepEqual(p.dates, ['2026-10-01', '2026-10-02', '2026-10-05']);
  assert.deepEqual([p.actuelle.valeur, p.actuelle.origine, p.actuelle.etat], [60, 'standard_base', 'sec']);
  assert.match(p.actuelle.source, /standard de base/);
  assert.equal(p.texte, 'Vous corrigez souvent riz (garniture) vers 86 g : en faire votre standard ?');
  assert.equal(p.historique.length, 3);
  assert.deepEqual(etatInitial().standards, {}, 'rien n\'est appliqué');
});

test('médiane de nombre pair arrondie au gramme', () => {
  const e = etatInitial();
  for (const [j, v] of [['2026-10-01', 80], ['2026-10-02', 81], ['2026-10-03', 84], ['2026-10-04', 85]]) corriger(e, j, v);
  assert.equal(propositions(e)[0].valeur, 83); // (81 + 84) / 2 = 82,5 -> 83
});

test('sens mélangés : rien, même quand un sens atteint le seuil (3 plus + 1 moins, 3 plus + 3 moins)', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-03', 40);
  assert.deepEqual(propositions(e), []);
  const f = etatInitial();
  for (const [j, v] of [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-03', 85], ['2026-10-04', 40]]) corriger(f, j, v);
  assert.deepEqual(propositions(f), [], '3 plus et 1 moins : pas de tendance');
  for (const [j, v] of [['2026-10-04', 45], ['2026-10-05', 42]]) corriger(f, j, v);
  assert.deepEqual(propositions(f), [], '3 plus et 3 moins : pas de tendance');
  const g = etatInitial();
  for (const [j, v] of [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-03', 85]]) corriger(g, j, v);
  assert.equal(propositions(g).length, 1, 'contrôle : sans le sens contraire, la proposition existe');
});

test('une correction par plat et par jour : le même plat en menu 1 et menu 2 le même jour compte pour une', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80, { menu: 1 });
  corriger(e, '2026-10-01', 80, { menu: 2 });
  corriger(e, '2026-10-02', 90);
  assert.deepEqual(propositions(e), [], '2 corrections, pas 3');
  corriger(e, '2026-10-03', 86);
  const [p] = propositions(e);
  assert.equal(p.nombre, 3);
  assert.deepEqual(p.dates, ['2026-10-01', '2026-10-02', '2026-10-03']);
  corriger(e, '2026-10-03', 86, { nom: 'riz basmati' });
  assert.equal(propositions(e)[0].nombre, 4, 'un autre plat le même jour compte');
});

test('les corrections datées d\'un jour futur ne comptent pas (borne haute : aujourd\'hui)', () => {
  const e = etatInitial();
  corriger(e, '2026-10-05', 80);
  corriger(e, '2026-10-07', 90);
  corriger(e, '2026-10-08', 86);
  assert.deepEqual(propositions(e), [], 'au 06/10 : une seule correction a eu lieu');
  assert.equal(propositions(e, '2026-10-08').length, 1, 'au 08/10 : les trois ont eu lieu');
  corriger(e, '2026-10-06', 88);
  assert.deepEqual(propositions(e, AUJOURDHUI), [], 'au 06/10 : deux corrections seulement');
  assert.equal(propositions(e, '2026-10-08')[0].nombre, 4);
});

test('reprendreMemoire : un grammage repris de la mémoire n\'est pas une correction', () => {
  const e = etatInitial();
  const a = corriger(e, '2026-10-01', 80);
  memoriser(e, a, '2026-10-01T09:00:00.000Z');
  const b = corriger(e, '2026-10-02', 80);
  e.composants[b].grammage = { valeur: null, unite: 'g', statut: 'INCONNU', source: '', etat: 'cuit' };
  assert.equal(reprendreMemoire(e, b, '2026-10-02T09:00:00.000Z').applique, true);
  assert.equal(e.composants[b].grammage.valeur, 80, 'le grammage a bien été repris');
  corriger(e, '2026-10-03', 90);
  assert.deepEqual(propositions(e), [], 'A et C sont deux corrections ; B est une reprise');
  corriger(e, '2026-10-04', 85);
  assert.equal(propositions(e)[0].nombre, 3, 'A, C et D');
  // Une retouche du grammage repris est, elle, une correction.
  modifierComposant(e, b, { grammage: { valeur: 82 } }, '2026-10-05T09:00:00.000Z');
  assert.equal(propositions(e)[0].nombre, 4);
});

test('import : une proposition écartée doit avoir une date valide, pas dans le futur au-delà de demain, et des composants en liste', () => {
  const doc = (validations) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, etat: { validations } });
  const lire = (validations) => importer(doc(validations), '2026-10-06').validations;
  const bonne = { statut: 'ecarte', h: '2026-10-06T09:00:00.000Z', vus: ['c_1'] };
  assert.deepEqual(lire({ 'apprentissage:riz|garniture': bonne }), { 'apprentissage:riz|garniture': bonne });
  assert.deepEqual(Object.keys(lire({ 'apprentissage:riz|garniture': { ...bonne, h: '2026-10-07T09:00:00.000Z' } })), ['apprentissage:riz|garniture'], 'demain : toléré (fuseau)');
  for (const mauvaise of [
    { ...bonne, h: '2999-01-01T00:00:00.000Z' }, { ...bonne, h: '2026-10-08T00:00:00.000Z' }, { ...bonne, h: 'hier' }, { ...bonne, h: 20261006 },
    { ...bonne, h: undefined }, { ...bonne, h: '2026-13-45T00:00:00.000Z' }, { ...bonne, statut: 'autre' }, { ...bonne, vus: 'c_1' },
    { ...bonne, vus: [1, 2] }, { ...bonne, vus: -1 }, 'texte', [1], null,
  ]) {
    assert.deepEqual(lire({ 'apprentissage:riz|garniture': mauvaise }), {}, JSON.stringify(mauvaise));
  }
  assert.deepEqual(lire({ autre: { n: 1 } }), { autre: { n: 1 } }, 'les autres validations ne sont pas touchées');
});

test('état de poids différent : pas mélangé', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-03', 200, { etat: 'cuit' });
  assert.deepEqual(propositions(e), []);
  corriger(e, '2026-10-04', 85);
  assert.equal(propositions(e).length, 1, 'trois en poids sec suffisent');
  assert.equal(propositions(e)[0].etatPoids, 'sec');
});

test('hors des 30 derniers jours, égal au standard, standard de base copié ou rôle sans standard : ne compte pas', () => {
  const e = etatInitial();
  corriger(e, '2026-09-01', 80);
  corriger(e, '2026-10-02', 60);
  corriger(e, '2026-10-03', 80, { statut: 'STANDARD_BASE' });
  corriger(e, '2026-10-04', 80, { role: 'sauce' });
  corriger(e, '2026-10-05', 80);
  corriger(e, '2026-10-05', 80);
  assert.deepEqual(propositions(e), []);
});

test('proposition écartée : silence 30 jours, puis retour', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  ecarterApprentissage(e, 'riz', 'garniture', `${AUJOURDHUI}T09:00:00.000Z`);
  assert.deepEqual(propositions(e), []);
  assert.deepEqual(propositions(e, '2026-11-04'), [], 'jour 29 : toujours silence, et plus de correction récente de toute façon');
  const f = structuredClone(e);
  corriger(f, '2026-11-03', 88);
  corriger(f, '2026-11-04', 88);
  corriger(f, '2026-11-05', 88);
  assert.equal(propositions(f, '2026-11-06').length, 1, 'plus de 30 jours : la proposition revient');
});

test('proposition écartée : 3 nouvelles corrections la font revenir avant 30 jours, 2 non', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  ecarterApprentissage(e, 'riz', 'garniture', `${AUJOURDHUI}T09:00:00.000Z`);
  corriger(e, '2026-10-07', 90);
  corriger(e, '2026-10-08', 90);
  assert.deepEqual(propositions(e, '2026-10-09'), []);
  corriger(e, '2026-10-09', 90);
  assert.equal(propositions(e, '2026-10-09').length, 1);
});

test('écarter : journal lisible, standard intact, état conservé tel quel à l\'export', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  ecarterApprentissage(e, 'riz', 'garniture', `${AUJOURDHUI}T09:00:00.000Z`);
  assert.deepEqual(e.standards, {});
  const ligne = e.journal.at(-1);
  assert.equal(ligne.action, 'ecarterApprentissage');
  assert.match(ligne.detail, /riz garniture : on garde le standard à 60 g/);
  assert.equal(e.validations['apprentissage:riz|garniture'].statut, 'ecarte');
  assert.throws(() => ecarterApprentissage(e, 'riz', 'sauce', `${AUJOURDHUI}T09:00:00.000Z`), /Rôle/);
  assert.throws(() => ecarterApprentissage(e, 'riz', 'garniture', 'hier'), /Horodatage/);
});

test('accepter : le standard maison passe devant, journal lisible ; la proposition disparaît', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  const p = propositions(e)[0];
  accepterApprentissage(e, p.cleFamille, p.role, { valeur: p.valeur, unite: p.unite, etat: p.etatPoids }, `${AUJOURDHUI}T09:00:00.000Z`);
  assert.deepEqual([e.standards.riz.garniture.valeur, e.standards.riz.garniture.etat], [86, 'sec']);
  assert.match(e.journal.at(-1).detail, /riz garniture : standard maison 86 g \(sec\) \(d'après 3 corrections/);
  const neuf = { ...composantVide('n'), famille: 'riz', role: 'garniture', categorie: 'feculent' };
  assert.equal(grammageEffectif(e, neuf).origine, 'standard');
  assert.equal(grammageEffectif(e, neuf).valeur, 86);
  assert.deepEqual(propositions(e), [], 'les corrections antérieures au standard ne se rediscutent pas');
});

test('accepter avec un standard maison déjà posé : corrigerStandard ; valeur retapée respectée', () => {
  const e = etatInitial();
  e.standards.riz = { garniture: { valeur: 65, unite: 'g', etat: 'sec', h: '2026-09-01T08:00:00.000Z' } };
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  const p = propositions(e)[0];
  assert.equal(p.actuelle.origine, 'standard');
  accepterApprentissage(e, 'riz', 'garniture', { valeur: 84, unite: 'g', etat: 'sec' }, `${AUJOURDHUI}T09:00:00.000Z`);
  assert.equal(e.standards.riz.garniture.valeur, 84);
  assert.ok(e.journal.some((l) => l.action === 'corrigerStandard'));
});

test('tableau : une ligne dans « À confirmer », limite de 3 lignes respectée, aucune quantité manquante', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 80);
  corriger(e, '2026-10-02', 90);
  corriger(e, '2026-10-05', 86);
  const { aConfirmer } = tableauBlanc(e, AUJOURDHUI).bord;
  const ligne = aConfirmer.lignes.find((l) => l.genre === 'apprentissage');
  assert.ok(ligne, 'la proposition est une ligne du tableau');
  assert.equal(ligne.texte, 'Vous corrigez souvent riz (garniture) vers 86 g : en faire votre standard ?');
  assert.equal(ligne.proposition.valeur, 86);
  assert.ok(aConfirmer.lignes.length <= 3);
  assert.equal(aConfirmer.total, aConfirmer.lignes.length + aConfirmer.reste);
  assert.equal(tableauBlanc(etatInitial(), AUJOURDHUI).bord.aConfirmer.lignes.some((l) => l.genre === 'apprentissage'), false);
});
