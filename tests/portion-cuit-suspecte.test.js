// v131 : un standard maison tapé avant le correctif est enregistré « cuit » à tort pour un riz (repère validé : sec). Carte « À confirmer »
// (genre point, jamais appliquée seule) avec deux gestes ; la correction ne change QUE l'état du poids.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirStandard } from '../app/js/domaine/actions.js';
import { confirmerPortionCuite, corrigerEtatPoids } from '../app/js/domaine/actions-validation.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { gestesRapides } from '../app/js/ui/geste-rapide.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-13';
const PORTION = 60;
const cartesEtat = (e) => decisionsDe(e, JOUR).cartes.filter((c) => c.type === 'etat_poids_portion');
const avecRizCuit = () => {
  const e = etatVide();
  definirStandard(e, 'riz', 'plat_principal', { valeur: PORTION, unite: 'g', etat: 'cuit' }, h());
  return e;
};

test('un riz maison en poids cuit alors que le repère validé est sec : une carte « À confirmer » qui dit les deux états', () => {
  const cartes = cartesEtat(avecRizCuit());
  assert.equal(cartes.length, 1);
  assert.equal(cartes[0].genre, 'point');
  assert.match(cartes[0].texte, /Votre standard de riz \(60 g\) est enregistré en poids cuit : le repère de riz est en poids sec \(50–70 g\)\. C'est bien du cuit \?/);
});

test('aucune carte : standard déjà sec, ou sans standard, ou famille sans repère sec', () => {
  const sec = etatVide();
  definirStandard(sec, 'riz', 'plat_principal', { valeur: PORTION, unite: 'g', etat: 'sec' }, h());
  assert.equal(cartesEtat(sec).length, 0);
  assert.equal(cartesEtat(etatVide()).length, 0);
});

test('« Oui, c\'est du cuit » : le standard est intact et la carte se tait', () => {
  const e = avecRizCuit();
  const avant = structuredClone(e.standards);
  const [oui] = gestesRapides(e, cartesEtat(e)[0]);
  assert.match(oui.texte, /^Oui, c'est du cuit/);
  oui.agir(e, h(2));
  assert.deepEqual(e.standards, avant);
  assert.equal(cartesEtat(e).length, 0);
});

test('« Non, c\'est du sec : corriger » : seul l\'état du poids change (valeur et unité inchangées)', () => {
  const e = avecRizCuit();
  const non = gestesRapides(e, cartesEtat(e)[0])[1];
  assert.match(non.texte, /^Non, c'est du sec/);
  non.agir(e, h(2));
  const s = e.standards.riz.plat_principal;
  assert.deepEqual([s.valeur, s.unite, s.etat], [PORTION, 'g', 'sec']);
  assert.equal(cartesEtat(e).length, 0);
});

test('corrigerEtatPoids refuse un état inconnu et l\'absence de standard', () => {
  const e = avecRizCuit();
  assert.throws(() => corrigerEtatPoids(e, 'riz', 'plat_principal', 'tiede', h(2)));
  assert.throws(() => corrigerEtatPoids(etatVide(), 'riz', 'plat_principal', 'sec', h(2)));
  assert.throws(() => confirmerPortionCuite(etatVide(), 'riz', 'plat_principal', h(2)));
});
