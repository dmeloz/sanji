// Liste « à commander » à trois états (B-P1b, partie 2) : suggéré, noté par la propriétaire, retiré.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirAchat, definirMenu, marquerCommande, modifierComposant } from '../app/js/domaine/actions.js';
import { noterAchat, restaurerAchat, retirerAchat } from '../app/js/domaine/actions-achats.js';
import { besoinsProduits, suiviProduit } from '../app/js/domaine/produits.js';
import { suiviProduitVide } from '../app/js/domaine/etat.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

/**
 * Une ligne « riz » calculée sur les standards de base (repère validé, rendement du référentiel), une ligne de produit
 * à portion validée et une ligne qui dépend d'une valeur de provenance inconnue.
 */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  prevision(e, S.lundi, 1, 40);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  composantValide(e, S.lundi, 1, { ...J.PRODUIT_CRU_TEST, nom: 'PRODUIT_INCONNU_TEST' },
    { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'INCONNU', source: 'TEST_ONLY' }] });
  return e;
}
const ligne = (e, cle) => besoinsProduits(e, S.lundi).lignes.find((l) => l.cle === cle);
const suivi = (e, cle) => suiviProduit(e, S.lundi, ligne(e, cle));

test('suiviProduitVide : état « suggéré » par défaut, historique vide', () => {
  const v = suiviProduitVide();
  assert.equal(v.etatLigne, 'suggere');
  assert.equal(v.besoinAuNote, null);
  assert.deepEqual(v.historique, []);
  const s = suivi(monde(), 'riz');
  assert.equal(s.etatLigne, 'suggere');
  assert.equal(s.aRelire, false);
  assert.equal(s.quantiteAcheter, null);
});

test('un ancien suivi (sans les nouveaux champs) se lit « suggéré »', () => {
  const e = monde();
  e.produits[`${S.lundi}|riz|g`] = { statut: 'suffisant', quantiteVerifiee: 5, besoinAuControle: 1, quantiteAcheter: null, conditionnement: '', fournisseurId: null, commandeLe: null };
  const s = suivi(e, 'riz');
  assert.equal(s.etatLigne, 'suggere');
  assert.deepEqual(s.historique, []);
});

// Adapté le 2026-10-04 (décision « Standards de base et ajustement terrain ») : le refus sans quantité tapée vaut pour
// une valeur INCONNUE ; une ligne calculée sur les standards de base se note sans quantité tapée (voir le test suivant).
test('noter une ligne qui repose sur une valeur inconnue sans quantité tapée est refusé', () => {
  const e = monde();
  assert.equal(ligne(e, 'produit_inconnu_test').aValider, true);
  for (const q of [undefined, null, 0, -4, Number.NaN, '40']) {
    assert.throws(() => noterAchat(e, S.lundi, 'produit_inconnu_test', 'g', { quantite: q }, h()), /inconnue/, String(q));
  }
  assert.throws(() => noterAchat(e, S.lundi, 'produit_inconnu_test', 'g', {}, h()), /inconnue/);
  const s = suivi(e, 'produit_inconnu_test');
  assert.deepEqual([s.etatLigne, s.quantiteAcheter, s.quantiteCalculee, s.quantiteCommandable], ['suggere', null, null, null]);
  noterAchat(e, S.lundi, 'produit_inconnu_test', 'g', { quantite: 900 }, h());
  assert.deepEqual(['quantiteCommandable', 'origineQuantite'].map((k) => suivi(e, 'produit_inconnu_test')[k]), [900, 'tapee']);
});

test('noter une ligne calculée sur les standards de base sans quantité tapée : commandable, marge comprise, « standard de base »', () => {
  const e = monde();
  e.reglages.margeSecurite = 10;
  const l = ligne(e, 'riz');
  assert.deepEqual([l.aValider, l.standardBase], [false, true]);
  assert.equal(suivi(e, 'riz').quantiteCommandable, null, 'rien n\'est commandable avant le geste « noter »');
  for (const q of [0, -4, Number.NaN, '40']) {
    assert.throws(() => noterAchat(e, S.lundi, 'riz', 'g', { quantite: q }, h()), /strictement positif/, String(q));
  }
  noterAchat(e, S.lundi, 'riz', 'g', {}, h());
  const s = suivi(e, 'riz');
  const attendu = Math.round(l.besoinBrut * 1.1);
  assert.deepEqual([s.etatLigne, s.quantiteAcheter, s.quantiteCommandable, s.origineQuantite, s.standardBase],
    ['note', null, attendu, 'standard_base', true], 'la quantité achetée reste vide ; la quantité commandable est calculée');
  assert.deepEqual([s.historique[0].quantite, s.historique[0].calculee, s.historique[0].standardBase], [null, attendu, true]);
  assert.match(e.journal.at(-1).detail ?? JSON.stringify(e.journal.at(-1)), /standard de base/);
  // La valeur de la propriétaire passe devant : une quantité tapée remplace la quantité calculée.
  noterAchat(e, S.lundi, 'riz', 'g', { quantite: 3000 }, h(1));
  assert.deepEqual(['quantiteAcheter', 'quantiteCommandable', 'origineQuantite'].map((k) => suivi(e, 'riz')[k]), [3000, 3000, 'tapee']);
});

test('noter avec une quantité tapée : état « noté », besoin mémorisé, quantité = celle du chef', () => {
  const e = monde();
  noterAchat(e, S.lundi, 'riz', 'g', { quantite: 2500 }, h());
  const s = suivi(e, 'riz');
  assert.equal(s.etatLigne, 'note');
  assert.equal(s.quantiteAcheter, 2500);
  assert.equal(s.besoinAuNote, ligne(e, 'riz').besoinBrut);
  assert.equal(s.aRelire, false);
  assert.equal(s.historique.length, 1);
  assert.equal(s.historique[0].action, 'note');
  assert.equal(e.journal.at(-1).action, 'noterAchat');
});

test('noter une ligne sans valeur inconnue ne demande pas de quantité et ne remplit jamais quantiteAcheter', () => {
  const e = monde();
  assert.deepEqual([ligne(e, 'produit_sec_test').aValider, ligne(e, 'produit_sec_test').standardBase], [false, false]);
  noterAchat(e, S.lundi, 'produit_sec_test', 'g', {}, h());
  const s = suivi(e, 'produit_sec_test');
  assert.equal(s.etatLigne, 'note');
  assert.equal(s.quantiteAcheter, null);
  assert.deepEqual([s.quantiteCommandable, s.origineQuantite], [ligne(e, 'produit_sec_test').besoinBrut, 'calculee'], 'sans marge réglée');
  assert.throws(() => noterAchat(e, S.lundi, 'absent', 'g', {}, h()), /besoin/);
});

test('retirer puis restaurer : la ligne reste dans l\'historique et revient dans son état d\'avant', () => {
  const e = monde();
  noterAchat(e, S.lundi, 'riz', 'g', { quantite: 2500 }, h(1));
  retirerAchat(e, S.lundi, 'riz', 'g', h(2));
  let s = suivi(e, 'riz');
  assert.equal(s.etatLigne, 'retire');
  assert.equal(s.quantiteAcheter, 2500, 'rien n\'est effacé');
  assert.deepEqual(s.historique.map((x) => x.action), ['note', 'retire']);
  restaurerAchat(e, S.lundi, 'riz', 'g', h(3));
  s = suivi(e, 'riz');
  assert.equal(s.etatLigne, 'note');
  assert.deepEqual(s.historique.map((x) => x.action), ['note', 'retire', 'restaure']);
  assert.throws(() => restaurerAchat(e, S.lundi, 'riz', 'g', h(4)), /retirée/);
  retirerAchat(e, S.lundi, 'produit_sec_test', 'g', h(5));
  restaurerAchat(e, S.lundi, 'produit_sec_test', 'g', h(6));
  assert.equal(suivi(e, 'produit_sec_test').etatLigne, 'suggere');
  assert.deepEqual(e.journal.slice(-2).map((j) => j.action), ['retirerAchat', 'restaurerAchat']);
});

test('un changement de besoin passe la ligne notée à « à relire » sans toucher à sa quantité', () => {
  const e = monde();
  noterAchat(e, S.lundi, 'riz', 'g', { quantite: 2500 }, h());
  assert.equal(suivi(e, 'riz').aRelire, false);
  prevision(e, S.lundi, 2, 80);
  const s = suivi(e, 'riz');
  assert.equal(s.etatLigne, 'note');
  assert.equal(s.aRelire, true);
  assert.equal(s.quantiteAcheter, 2500, 'la quantité du chef n\'est jamais réécrite');
  // Une ligne retirée n'est jamais « à relire » ; remise, elle l'est de nouveau.
  retirerAchat(e, S.lundi, 'riz', 'g', h(1));
  assert.equal(suivi(e, 'riz').aRelire, false);
  restaurerAchat(e, S.lundi, 'riz', 'g', h(2));
  assert.equal(suivi(e, 'riz').aRelire, true);
  // Noter de nouveau, avec une quantité tapée, mémorise le besoin du moment.
  noterAchat(e, S.lundi, 'riz', 'g', { quantite: 5000 }, h(3));
  assert.equal(suivi(e, 'riz').aRelire, false);
});

test('aucune quantité calculée n\'atteint quantiteAcheter seule', () => {
  const e = monde();
  retirerAchat(e, S.lundi, 'riz', 'g', h(1));
  restaurerAchat(e, S.lundi, 'riz', 'g', h(2));
  definirAchat(e, S.lundi, 'riz', 'g', { conditionnement: 'sac' }, h(3));
  noterAchat(e, S.lundi, 'produit_sec_test', 'g', {}, h(4));
  assert.equal(suivi(e, 'riz').quantiteAcheter, null);
  assert.equal(suivi(e, 'riz').proposeeACommander, null);
  for (const s of Object.values(e.produits)) assert.equal(s.quantiteAcheter, null);
});

test('une ligne notée sans quantité tapée garde la quantité du moment du geste « noter »', () => {
  const e = monde();
  e.reglages.margeSecurite = 10;
  noterAchat(e, S.lundi, 'riz', 'g', {}, h());
  const noteeA = suivi(e, 'riz').quantiteCommandable;
  assert.equal(noteeA, Math.round(ligne(e, 'riz').besoinBrut * 1.1));
  assert.equal(e.produits[`${S.lundi}|riz|g`].quantiteNotee, noteeA, 'mémorisée au geste');
  assert.equal(suivi(e, 'riz').aRelire, false);
  // Le besoin change : la quantité commandable ne bouge pas, la ligne est à relire.
  prevision(e, S.lundi, 2, 80);
  let s = suivi(e, 'riz');
  assert.equal(s.quantiteCommandable, noteeA, 'la quantité notée n\'est pas recalculée');
  assert.equal(s.quantiteCalculee > noteeA, true, 'le calcul, lui, a bougé');
  assert.deepEqual([s.aRelire, s.raisonARelire, s.origineQuantite, s.quantiteAcheter], [true, 'besoin', 'standard_base', null]);
  // Noter de nouveau mémorise la nouvelle quantité.
  noterAchat(e, S.lundi, 'riz', 'g', {}, h(1));
  s = suivi(e, 'riz');
  assert.deepEqual([s.aRelire, s.quantiteCommandable], [false, s.quantiteCalculee]);
  // Même besoin, mais la quantité recalculée change (marge) : à relire, et le message le dit.
  e.reglages.margeSecurite = 30;
  s = suivi(e, 'riz');
  assert.deepEqual([s.aRelire, s.raisonARelire], [true, 'quantite']);
  assert.notEqual(s.quantiteCalculee, s.quantiteCommandable);
});

test('« Marquer commandé » : une ligne notée sur standard de base utilise la quantité notée, sans remplir quantiteAcheter', () => {
  const e = monde();
  assert.throws(() => marquerCommande(e, S.lundi, 'riz', 'g', h()), /quantité réellement achetée/, 'non notée : exigeant');
  noterAchat(e, S.lundi, 'riz', 'g', {}, h(1));
  const q = suivi(e, 'riz').quantiteCommandable;
  marquerCommande(e, S.lundi, 'riz', 'g', h(2));
  const s = suivi(e, 'riz');
  assert.deepEqual([s.commandeLe, s.quantiteAcheter, s.quantiteCommandable], [h(2), null, q]);
  assert.match(e.journal.at(-1).detail, /standard de base/);
  assert.match(e.journal.at(-1).detail, new RegExp(String(q)));
});

test('« Marquer commandé » : une ligne INCONNU reste exigeante, même si elle a été notée sur une valeur connue', () => {
  const e = monde();
  assert.throws(() => marquerCommande(e, S.lundi, 'produit_inconnu_test', 'g', h()), /quantité réellement achetée/);
  noterAchat(e, S.lundi, 'produit_inconnu_test', 'g', { quantite: 900 }, h(1));
  marquerCommande(e, S.lundi, 'produit_inconnu_test', 'g', h(2));
  assert.equal(suivi(e, 'produit_inconnu_test').commandeLe, h(2), 'quantité tapée : accepté');
  // Noté sans quantité sur des valeurs connues, puis une valeur devient inconnue : plus commandable sans quantité tapée.
  const f = monde();
  const c = Object.values(f.composants).find((x) => x.nom === 'PRODUIT_SEC_TEST');
  noterAchat(f, S.lundi, 'produit_sec_test', 'g', {}, h(1));
  modifierComposant(f, c.id, { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'INCONNU', source: 'TEST_ONLY' }] }, h(2));
  assert.equal(ligne(f, 'produit_sec_test').aValider, true);
  assert.equal(suivi(f, 'produit_sec_test').quantiteCommandable, null);
  assert.throws(() => marquerCommande(f, S.lundi, 'produit_sec_test', 'g', h(3)), /quantité réellement achetée/);
});
