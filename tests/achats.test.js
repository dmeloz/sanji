// Liste « à commander » à trois états (B-P1b, partie 2) : suggéré, noté par la propriétaire, retiré.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirAchat, definirMenu } from '../app/js/domaine/actions.js';
import { noterAchat, restaurerAchat, retirerAchat } from '../app/js/domaine/actions-achats.js';
import { besoinsProduits, suiviProduit } from '../app/js/domaine/produits.js';
import { suiviProduitVide } from '../app/js/domaine/etat.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

/** Une ligne « riz » qui repose sur une estimation (repère validé) et une ligne de produit à portion validée. */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  prevision(e, S.lundi, 1, 40);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
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

test('noter une ligne qui repose sur une estimation sans quantité tapée est refusé', () => {
  const e = monde();
  assert.equal(ligne(e, 'riz').aValider, true);
  for (const q of [undefined, null, 0, -4, Number.NaN, '40']) {
    assert.throws(() => noterAchat(e, S.lundi, 'riz', 'g', { quantite: q }, h()), /estimation/, String(q));
  }
  assert.throws(() => noterAchat(e, S.lundi, 'riz', 'g', {}, h()), /estimation/);
  assert.equal(suivi(e, 'riz').etatLigne, 'suggere');
  assert.equal(suivi(e, 'riz').quantiteAcheter, null);
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

test('noter une ligne sans estimation ne demande pas de quantité et ne remplit jamais quantiteAcheter', () => {
  const e = monde();
  assert.equal(ligne(e, 'produit_sec_test').aValider, false);
  noterAchat(e, S.lundi, 'produit_sec_test', 'g', {}, h());
  const s = suivi(e, 'produit_sec_test');
  assert.equal(s.etatLigne, 'note');
  assert.equal(s.quantiteAcheter, null);
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

test('aucune estimation n\'atteint quantiteAcheter seule', () => {
  const e = monde();
  retirerAchat(e, S.lundi, 'riz', 'g', h(1));
  restaurerAchat(e, S.lundi, 'riz', 'g', h(2));
  definirAchat(e, S.lundi, 'riz', 'g', { conditionnement: 'sac' }, h(3));
  noterAchat(e, S.lundi, 'produit_sec_test', 'g', {}, h(4));
  assert.equal(suivi(e, 'riz').quantiteAcheter, null);
  assert.equal(suivi(e, 'riz').proposeeACommander, null);
  for (const s of Object.values(e.produits)) assert.equal(s.quantiteAcheter, null);
});
