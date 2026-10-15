// v132 : « Comment c'est calculé » en toutes lettres, à partir des vraies valeurs (source unique : le domaine).

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard, modifierComposant } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { expliquerQuantite } from '../app/js/domaine/poids-portion.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-15';
function risotto() {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto à la milanaise et écaille de parmesan', h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  const c = Object.values(e.composants).find((x) => x.famille === 'riz');
  return { e, c };
}
const corrige = (e, c, etat) => modifierComposant(e, c.id, { grammage: { valeur: 30, unite: 'g', etat, statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } }, h(2));

test('cas réel : 20 portions × 30 g cuit ÷ 2,5 = 240 g, avec l\'origine, l\'alerte et le geste', () => {
  const { e, c } = risotto();
  corrige(e, c, 'cuit');
  const x = expliquerQuantite(e, c.id);
  assert.equal(x.texte, '20 portions × 30 g (poids cuit, corrigé sur ce plat) ÷ 2,5 (gain de cuisson) = 240 g');
  assert.equal(x.etatPoids, 'cuit');
  assert.equal(x.suspect, true);
  assert.match(x.avertissement, /Attention : le repère de cette famille est en poids sec \(50–70 g\)/);
  assert.match(x.avertissement, /30 g est en dessous/);
  assert.deepEqual(x.lieu, { type: 'plat', composantId: c.id });
});

test('même portion en poids sec : pas de division, plus d\'alerte « cuit » (seule la note hors repère reste)', () => {
  const { e, c } = risotto();
  corrige(e, c, 'sec');
  const x = expliquerQuantite(e, c.id);
  assert.equal(x.texte, '20 portions × 30 g (poids sec, corrigé sur ce plat) = 600 g');
  assert.equal(x.suspect, false);
  assert.match(x.avertissement, /^Attention : 30 g est en dessous du repère de cette famille \(50–70 g\)\. Vérifiez la portion\.$/);
});

test('origine « votre standard de riz »', () => {
  const { e, c } = risotto();
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h(2));
  const x = expliquerQuantite(e, c.id);
  assert.equal(x.texte, '20 portions × 60 g (poids sec, votre standard de riz) = 1,2 kg');
  assert.deepEqual(x.lieu, { type: 'standard', cleFamille: 'riz', role: 'plat_principal' });
});

test('quantité inconnue : rien à expliquer', () => {
  const { e, c } = risotto();
  const x = expliquerQuantite(e, c.id);
  assert.equal(x.texte, null);
  assert.equal(x.lieu, null);
});

test('portion du repère de base : origine dite, aucun geste (pas d\'endroit à corriger)', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 2, 'Filet de bar, riz, brocoli', h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 10, 2: 10 } }, h(1));
  const c = Object.values(e.composants).find((x) => x.famille === 'riz');
  const x = expliquerQuantite(e, c.id);
  assert.match(x.texte, /^10 portions × 60 g \(poids sec, repère de base\)/);
  assert.equal(x.lieu, null);
});
