import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterAdaptation, annulerFiche, confirmerRepartition, creerFiche, definirMenu, marquerFait, modifierComposant,
  modifierFiche, planifier, saisirVentes, deciderEcart,
} from '../app/js/domaine/actions.js';
import * as allergenes from '../app/js/domaine/allergenes.js';
import { pointsAConfirmer, repereVentes } from '../app/js/domaine/points.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe, recetteValidee } from './aide.js';

const types = (e, d) => pointsAConfirmer(e, d).map((p) => p.type);

test('allergènes : seules les fiches actives avec un texte d\'allergie, concernant les bons composants', () => {
  const e = etatVide();
  const m1 = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const m2 = composantValide(e, S.mercredi, 2, J.PRODUIT_CRU_TEST);
  composantValide(e, S.mercredi, 2, { ...J.PREPARATION_TEST, nom: 'NON_ATTRIBUE_TEST' });
  e.composants[Object.keys(e.composants).at(-1)].attribue = false;
  const fixe = creerFiche(e, { date: S.mercredi, service: 'midi', couverts: 4, mode: 'menu_fixe', menuFixe: 2, allergies: 'ALLERGIE_A_TEST', numero: 'F1' }, h());
  const libre = creerFiche(e, { date: S.mercredi, service: 'midi', couverts: 4, mode: 'choix_libre', allergies: 'ALLERGIE_B_TEST' }, h());
  const soir = creerFiche(e, { date: S.mercredi, service: 'soir', couverts: 4, allergies: 'ALLERGIE_SOIR_TEST', mode: 'hors_menu' }, h());
  creerFiche(e, { date: S.mercredi, service: 'midi', couverts: 4, mode: 'menu_fixe', menuFixe: 1, allergies: '   ' }, h());
  const annulee = creerFiche(e, { date: S.mercredi, service: 'midi', couverts: 4, mode: 'menu_fixe', menuFixe: 1, allergies: 'ALLERGIE_C_TEST' }, h());
  annulerFiche(e, annulee, h());

  const a = allergenes.alertesAllergenes(e, S.mercredi);
  assert.deepEqual(a.map((x) => x.ficheId), [fixe, libre, soir]);
  assert.deepEqual(a[0].composants.map((c) => c.composantId), [m2], 'menu fixé 2 : seulement le menu 2');
  assert.deepEqual(a[1].composants.map((c) => c.composantId).sort(), [m1, m2].sort(), 'choix libre : les deux menus, attribués seulement');
  assert.deepEqual(a[2].composants, [], 'service du soir : pas de menu du jour');
  assert.equal(a[0].numero, 'F1');
  assert.deepEqual(allergenes.alertesAllergenes(e, S.jeudi), []);
});

test('statutAllergenes : validé seulement avec base restaurant ; générique et préparation sans recette restent à confirmer', () => {
  const e = etatVide();
  const sec = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const prep = composantValide(e, S.mercredi, 1, J.PREPARATION_TEST);
  const vague = composantValide(e, S.mercredi, 1, J.COMPOSANT_VAGUE_TEST);
  const valider = { allergenes: { statut: 'valide', liste: ['ALLERGENE_TEST'] } };
  for (const id of [sec, prep, vague]) modifierComposant(e, id, valider, h());
  assert.equal(allergenes.statutAllergenes(e, e.composants[sec]).statut, 'valide');
  assert.equal(allergenes.statutAllergenes(e, e.composants[prep]).statut, 'a_confirmer');
  assert.equal(allergenes.statutAllergenes(e, e.composants[vague]).statut, 'a_confirmer');
  assert.equal(allergenes.statutAllergenes(e, composantVideTest()).statut, 'a_confirmer');
  modifierComposant(e, prep, { recetteId: recetteValidee(e, J.RECETTE_TEST) }, h());
  assert.equal(allergenes.statutAllergenes(e, e.composants[prep]).statut, 'valide');
  assert.deepEqual(Object.keys(allergenes).sort(), ['alertesAllergenes', 'obstacleValidationAllergenes', 'statutAllergenes']);
});
const composantVideTest = () => ({ type: 'produit_simple', allergenes: { statut: 'a_confirmer', liste: [] } });

test('points : base neuve = aucun point sur un jour sans menu saisi', () => {
  const e = etatVide();
  assert.deepEqual(types(e, S.lundi), []);
  assert.deepEqual(types(e, S.samedi), []);
  assert.deepEqual(types(e, S.dimanche), []);
});

test('points : plus de transcription ni de composants à valider ; composant inconnu, composant à préciser', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 1);
  prevision(e, S.lundi, 2, 1);
  definirMenu(e, S.lundi, 1, 'INTITULE_TEST', h());
  assert.deepEqual(types(e, S.lundi), ['composant_inconnu'], 'l\'intitulé vaut validation ; un seul point : à classer');
  menuValide(e, S.lundi, 1);
  assert.deepEqual(types(e, S.lundi), []);
  const id = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, type: 'a_preciser' });
  const p = pointsAConfirmer(e, S.lundi).find((x) => x.type === 'composant_a_preciser');
  assert.equal(p.composantId, id);
});

test('points : répartition provisoire ou dont la somme diffère des couverts', () => {
  const e = etatVide();
  prevision(e, S.mardi, 1, 1);
  prevision(e, S.mardi, 2, 1);
  const g = creerFiche(e, { date: S.mardi, service: 'midi', couverts: 30, mode: 'choix_libre', numero: 'G1', repartition: { 1: 10, 2: 5 } }, h());
  assert.deepEqual(types(e, S.mardi), ['repartition_provisoire', 'repartition_incoherente']);
  confirmerRepartition(e, g, { 1: 10, 2: 5 }, h());
  assert.deepEqual(types(e, S.mardi), ['repartition_incoherente'], 'confirmée mais somme ≠ couverts : toujours signalé');
  modifierFiche(e, g, { couverts: 15 }, h());
  assert.deepEqual(types(e, S.mardi), [], 'les couverts rejoignent la répartition confirmée');
  modifierFiche(e, g, { repartition: { 1: 11, 2: 4 } }, h());
  assert.deepEqual(types(e, S.mardi), ['repartition_provisoire'], 'une répartition modifiée redevient provisoire');
  confirmerRepartition(e, g, { 1: 10, 2: 5 }, h());
  assert.deepEqual(types(e, S.mardi), []);
  annulerFiche(e, g, h());
  assert.deepEqual(types(e, S.mardi), []);
});

test('points : allergènes à confirmer, avance, écart ; plus aucun point de créneau', () => {
  const e = etatVide();
  prevision(e, S.lundiSuivant, 1, 20);
  prevision(e, S.lundiSuivant, 2, 0);
  const c = composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  creerFiche(e, { date: S.lundiSuivant, service: 'midi', couverts: 2, mode: 'menu_fixe', menuFixe: 1, allergies: 'ALLERGIE_TEST' }, h());
  const prod = principaleDe(e, c);
  let pts = pointsAConfirmer(e, S.lundiSuivant);
  assert.ok(pts.some((p) => p.type === 'allergenes' && p.composantId === c), 'allergène non validé');
  modifierComposant(e, c, { allergenes: { statut: 'valide', liste: [] } }, h());
  assert.equal(types(e, S.lundiSuivant).includes('allergenes'), false);

  planifier(e, prod, S.samedi, h());
  assert.deepEqual(types(e, S.samedi), [], 'le jour de travail ne porte plus de point de créneau');
  assert.ok(types(e, S.lundiSuivant).includes('conservation'));
  planifier(e, prod, S.vendredi, h());
  pts = pointsAConfirmer(e, S.lundiSuivant);
  assert.equal(pts.some((p) => p.type === 'conservation'), false);
  assert.ok(pts.some((p) => p.type === 'avance_hors_regle'));
  planifier(e, prod, S.lundiSuivant, h());
  marquerFait(e, prod, undefined, h());
  prevision(e, S.lundiSuivant, 1, 30);
  assert.ok(types(e, S.lundiSuivant).includes('ecart'));
  deciderEcart(e, prod, 'aucune', h());
  assert.equal(types(e, S.lundiSuivant).includes('ecart'), false);
});

test('repereVentes : au plus 3, même jour de semaine, plus récentes d\'abord, avant la date', () => {
  const e = etatVide();
  assert.deepEqual(repereVentes(e, S.lundi, 1), []);
  for (const [d, v] of [['2026-09-14', 11], ['2026-09-21', 12], ['2026-09-28', 13], ['2026-09-07', 10]]) saisirVentes(e, d, 1, v, h());
  saisirVentes(e, '2026-09-29', 1, 99, h()); // un mardi : ignoré
  saisirVentes(e, '2026-09-28', 2, 77, h()); // menu 2 : ignoré
  saisirVentes(e, S.lundiSuivant, 1, 55, h()); // postérieur
  assert.deepEqual(repereVentes(e, S.lundi, 1), [
    { date: '2026-09-28', ventes: 13 }, { date: '2026-09-21', ventes: 12 }, { date: '2026-09-14', ventes: 11 }]);
  assert.deepEqual(repereVentes(e, S.lundi, 2), [{ date: '2026-09-28', ventes: 77 }]);
  // Les ventes ne modifient jamais une prévision.
  assert.equal(e.jours['2026-09-28'].previsions[1].portions, null);
});

test('ajouterAdaptation : texte obligatoire, tracée avec l\'heure', () => {
  const e = etatVide();
  const f = creerFiche(e, { date: S.mercredi, service: 'midi', couverts: 1, mode: 'hors_menu' }, h());
  assert.throws(() => ajouterAdaptation(e, f, '  ', h()), /Décrivez/);
  ajouterAdaptation(e, f, 'ADAPTATION_TEST', h(7));
  assert.deepEqual(e.fiches[f].adaptations, [{ h: h(7), texte: 'ADAPTATION_TEST' }]);
});

test('points : menu saisi sans prévision = prévision manquante pour ce menu seulement', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'INTITULE_TEST', h());
  assert.ok(types(e, S.lundi).includes('prevision_manquante'));
  assert.equal(pointsAConfirmer(e, S.lundi).filter((p) => p.type === 'prevision_manquante').length, 1);
  prevision(e, S.lundi, 1, 1);
  assert.ok(!types(e, S.lundi).includes('prevision_manquante'));
});
