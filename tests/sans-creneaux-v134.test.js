// v134 : plus de créneaux horaires. La planification repose sur la date seule ; un ancien export perd ses champs créneau
// à l'import (migration), rien d'autre. Jeux TEST_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ajouterPreparatoire, definirRegle, planifier } from '../app/js/domaine/actions.js';
import { etatInitial, exporter, importer, importerAvecBilan } from '../app/js/domaine/etat.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

const AUJOURD = '2026-10-12';
const lire = (nom) => readFileSync(new URL(`./jeux/${nom}`, import.meta.url), 'utf8');
const compte = (texte, mot) => texte.split(mot).length - 1;

test('migration v134 : un export v133 perd ses cinq emplacements de créneau, garde tout le reste', () => {
  const texte = lire('TEST_ONLY-etat-avec-creneaux-v133.json');
  const ancien = JSON.parse(texte).etat;
  assert.ok(ancien.reglages.semaineType && ancien.reglages.semaineTypeConfirmee === true && ancien.reglages.capaciteCreneau === 4, 'le jeu v133 porte bien les réglages de créneau');
  assert.equal(ancien.jours['2026-10-05'].creneaux.avant_midi, 'charge');
  assert.deepEqual([ancien.productions.prod_tfmja.jourDecide, ancien.productions.prod_tfmja.creneauDecide], ['2026-10-05', 'apres_midi']);

  const bilan = importerAvecBilan(texte, AUJOURD);
  const e = bilan.etat;
  assert.equal(bilan.ecartes, 0, 'aucune entrée écartée');
  assert.deepEqual(bilan.migrations, ['v134 : créneaux horaires retirés'], 'le bilan signale la migration');
  assert.deepEqual(e.reglages, { margeSecurite: null, dernierExport: null });
  assert.ok(Object.values(e.jours).every((j) => !('creneaux' in j)));
  assert.ok(Object.values(e.productions).every((p) => !('creneauDecide' in p)));
  assert.equal(e.productions.prod_tfmja.jourDecide, '2026-10-05', 'jourDecide intact');
  assert.equal(Object.keys(e.productions).length, Object.keys(ancien.productions).length);
  assert.equal(Object.keys(e.jours).length, Object.keys(ancien.jours).length);
  assert.equal(Object.keys(e.composants).length, Object.keys(ancien.composants).length);
  assert.equal(compte(exporter(e, 'h'), 'creneau'), 0, 'un nouvel export ne contient plus le mot');
  assert.deepEqual(importer(exporter(e, 'h'), AUJOURD), e, 'aller-retour stable après migration');
});

test('migration v134 : un export déjà sans créneau ne signale aucune migration', () => {
  const bilan = importerAvecBilan(lire('TEST_ONLY-etat-peuple.json'), AUJOURD);
  assert.deepEqual(bilan.migrations, []);
  assert.deepEqual(importerAvecBilan(exporter(etatInitial(), 'h')).migrations, []);
});

test('état neuf : ni créneaux dans un jour, ni creneauDecide dans une production', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.equal('creneaux' in e.jours[S.lundi], false);
  assert.equal('creneauDecide' in e.productions[principaleDe(e, c)], false);
});

test('lecture du jour sans créneau : rôle, place dans l\'intitulé, nom puis ordre des étapes ; « après » par date de service', () => {
  const e2 = etatVide();
  prevision(e2, S.lundi, 1, 10);
  prevision(e2, S.mardi, 1, 10);
  prevision(e2, S.mercredi, 1, 10);
  const b = composantValide(e2, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'B_TEST' });
  const a = composantValide(e2, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'A_TEST' });
  const mercredi = composantValide(e2, S.mercredi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'MERCREDI_TEST' });
  const mardi = composantValide(e2, S.mardi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'MARDI_TEST' });
  for (const id of [b, a, mercredi, mardi]) planifier(e2, principaleDe(e2, id), S.lundi, h());
  const prep = ajouterPreparatoire(e2, a, 'PREP_TEST', h());
  planifier(e2, prep, S.lundi, h());
  const { lecture, aFaire } = feuilleDuJour(e2, S.lundi);
  assert.equal(aFaire.length, 5, 'une liste à plat : toutes les tâches décidées ce jour');
  assert.ok(aFaire.every((t) => !('creneauDecide' in t) && !('creneau' in t)));
  assert.deepEqual(lecture.service1.map((l) => l.nom), ['A_TEST', 'B_TEST'], 'même rôle, même place : ordre des noms');
  assert.deepEqual(lecture.autres.map((l) => l.productionId), [prep]);
  assert.deepEqual(lecture.apres.map((l) => l.nom), ['MARDI_TEST', 'MERCREDI_TEST'], 'après service : par date de service');
  for (const l of [...lecture.service1, ...lecture.autres, ...lecture.apres]) {
    assert.equal('creneau' in l, false, 'une ligne de lecture ne porte plus de créneau');
    assert.ok(['decidee', 'faite', 'attendue', 'a_planifier', 'a_preciser', 'suggestion'].includes(l.source));
  }
});

test('étapes d\'une même préparation : même nom, ordre de la règle', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ETAPES_TEST' });
  definirRegle(e, { nom: 'ETAPES_TEST', etapes: [{ libelle: 'Couper', avanceMaxJours: 3 }, { libelle: 'Blanchir', avanceMaxJours: 2 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  const etapes = Object.values(e.productions).filter((p) => p.composantId === c && p.genre === 'preparatoire').sort((x, y) => y.ordre - x.ordre);
  for (const p of etapes) planifier(e, p.id, S.lundi, h()); // planifiées dans l'ordre inverse : la lecture les remet dans l'ordre
  const { lecture } = feuilleDuJour(e, S.lundi);
  assert.deepEqual(lecture.apres.filter((l) => l.source === 'decidee').map((l) => l.ordre), [0, 1], 'étapes dans l\'ordre de la règle');
});
