// v132 : une portion enregistrée « cuit » alors que le repère validé de la famille est « sec » est signalée où qu'elle soit stockée
// (standard maison, correction du plat, référence du nom, fiche retenue), sans jamais être corrigée seule. Cas réel du chef :
// « Risotto à la milanaise… », menu 1, 20 portions, 30 g « cuit » validé restaurant = 240 g bruts au lieu de 600 g.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard, memoriser, modifierComposant } from '../app/js/domaine/actions.js';
import { correctionDuJour } from '../app/js/domaine/actions-validation.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { cleMemoire, exporter, importer, memoireVide } from '../app/js/domaine/etat.js';
import { cleDeNom } from '../app/js/domaine/fiches-retenues.js';
import { corrigerEtatPoidsLieux, definirEtatPoidsPortion } from '../app/js/domaine/poids-portion.js';
import { gestesRapides } from '../app/js/ui/geste-rapide.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-15';
const NOM = 'Risotto à la milanaise et écaille de parmesan';
const PORTION = { valeur: 30, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' };
const cartes = (e) => decisionsDe(e, JOUR).cartes.filter((c) => c.type === 'etat_poids_portion');
const aller = (e) => importer(exporter(e, h(9)));

function risotto({ avecPortion = true, date = JOUR } = {}) {
  const e = etatVide();
  definirMenu(e, date, 1, NOM, h());
  definirCouvertsMidi(e, date, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  const c = Object.values(e.composants).find((x) => x.famille === 'riz');
  if (avecPortion) modifierComposant(e, c.id, { grammage: { ...PORTION, etat: 'cuit' } }, h(2));
  return { e, c };
}
const quantite = (e, id) => Math.round(calculerComposant(e, id).quantiteTravail);

test('cas réel : 20 portions × 30 g cuit = 240 g, une carte qui dit où, quoi, et que 30 g est sous le repère', () => {
  const { e, c } = risotto();
  assert.equal(quantite(e, c.id), 240);
  const liste = cartes(e);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].genre, 'point');
  assert.equal(liste[0].composantId, c.id);
  assert.match(liste[0].texte, /Votre portion de Risotto à la milanaise et écaille de parmesan \(30 g\), tapée sur ce plat, est enregistrée en poids cuit/);
  assert.match(liste[0].texte, /le repère de riz est en poids sec \(50–70 g\)/);
  assert.match(liste[0].texte, /30 g est en dessous du repère/);
  assert.match(liste[0].texte, /C'est bien du cuit \?$/);
});

test('« Non, c\'est du sec : corriger » : 30 g sec = 600 g, rien d\'autre ne change, puis la valeur reste modifiable', () => {
  const { e, c } = risotto();
  const [, non] = gestesRapides(e, cartes(e)[0]);
  assert.match(non.texte, /^Non, c'est du sec/);
  non.agir(e, h(3));
  assert.deepEqual({ ...e.composants[c.id].grammage }, { valeur: 30, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat', etat: 'sec' });
  assert.equal(quantite(e, c.id), 600);
  assert.equal(cartes(e).length, 0);
  correctionDuJour(e, c.id, { valeur: 60, etat: 'sec' }, h(4));
  assert.equal(quantite(e, c.id), 1200);
});

test('« Oui, c\'est du cuit » sur le plat : portion intacte, carte tue, confirmation conservée après export/import', () => {
  const { e, c } = risotto();
  const [oui] = gestesRapides(e, cartes(e)[0]);
  oui.agir(e, h(3));
  assert.equal(e.composants[c.id].grammage.etat, 'cuit');
  assert.equal(e.validations[`etat_poids:plat:${c.id}`].statut, 'cuit_confirme');
  assert.equal(cartes(e).length, 0);
  assert.equal(cartes(aller(e)).length, 0);
});

test('une confirmation ne vaut que pour la valeur confirmée : une autre valeur en cuit redonne une carte', () => {
  const { e, c } = risotto();
  gestesRapides(e, cartes(e)[0])[0].agir(e, h(3));
  modifierComposant(e, c.id, { grammage: { valeur: 40 } }, h(4));
  assert.equal(cartes(e).length, 1);
});

test('référence du nom seule (etat.memoire) : une carte, correction au bon endroit', () => {
  const { e, c } = risotto({ avecPortion: false });
  const m = memoireVide();
  Object.assign(m, { nom: NOM, attribue: true, categorie: 'feculent' });
  m.parRole.plat_principal = { grammage: { ...PORTION, etat: 'cuit' } };
  e.memoire[cleMemoire(NOM, 1)] = m;
  const liste = cartes(e);
  assert.equal(liste.length, 1);
  assert.match(liste[0].texte, /mémorisée comme référence de ce nom/);
  gestesRapides(e, liste[0])[1].agir(e, h(3));
  assert.equal(e.memoire[cleMemoire(NOM, 1)].parRole.plat_principal.grammage.etat, 'sec');
  assert.equal(e.memoire[cleMemoire(NOM, 1)].parRole.plat_principal.grammage.valeur, 30);
  assert.equal(c.grammage.valeur, null);
  assert.equal(cartes(e).length, 0);
});

test('référence du nom : « Oui » mémorisé par une clé propre à cet endroit, aller-retour compris', () => {
  const { e } = risotto({ avecPortion: false });
  const m = memoireVide();
  Object.assign(m, { nom: NOM, attribue: true, categorie: 'feculent' });
  m.parRole.plat_principal = { grammage: { ...PORTION, etat: 'cuit' } };
  e.memoire[cleMemoire(NOM, 1)] = m;
  gestesRapides(e, cartes(e)[0])[0].agir(e, h(3));
  assert.ok(Object.keys(e.validations).some((k) => k.startsWith('etat_poids:reference:')));
  assert.equal(cartes(aller(e)).length, 0);
});

test('fiche retenue seule : une carte, « Non » ne change que l\'état, « Oui » survit à l\'aller-retour', () => {
  const { e } = risotto({ avecPortion: false });
  const cle = cleDeNom(NOM);
  e.fiches_retenues[cle] = { nom: NOM, role: 'plat_principal', famille: 'riz', grammage: { valeur: 30, unite: 'g', etat: 'cuit' }, h: h(1) };
  const liste = cartes(e);
  assert.equal(liste.length, 1);
  assert.match(liste[0].texte, /retenue dans la fiche de ce nom/);
  gestesRapides(e, liste[0])[0].agir(e, h(3));
  assert.ok(e.validations[`etat_poids:fiche:${cle}`]);
  assert.equal(cartes(aller(e)).length, 0);
  const { e: e2 } = risotto({ avecPortion: false });
  e2.fiches_retenues[cle] = { nom: NOM, role: 'plat_principal', famille: 'riz', grammage: { valeur: 30, unite: 'g', etat: 'cuit' }, h: h(1) };
  gestesRapides(e2, cartes(e2)[0])[1].agir(e2, h(3));
  assert.deepEqual(e2.fiches_retenues[cle].grammage, { valeur: 30, unite: 'g', etat: 'sec' });
  assert.equal(e2.fiches_retenues[cle].h, h(1));
});

test('plat + référence + fiche de même valeur (« mémoriser ») : UNE carte, les trois endroits corrigés ensemble', () => {
  const { e, c } = risotto();
  memoriser(e, c.id, h(3));
  const liste = cartes(e);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].lieux.length, 3);
  gestesRapides(e, liste[0])[1].agir(e, h(4));
  assert.equal(e.composants[c.id].grammage.etat, 'sec');
  assert.equal(e.memoire[cleMemoire(NOM, 1)].parRole.plat_principal.grammage.etat, 'sec');
  assert.equal(e.fiches_retenues[cleDeNom(NOM)].grammage.etat, 'sec');
  assert.equal(cartes(e).length, 0);
});

test('copie reprise d\'une fiche : pas de carte à part, corrigée avec sa source, drapeau « repris » conservé', () => {
  const { e, c } = risotto({ avecPortion: false });
  e.fiches_retenues[cleDeNom(NOM)] = { nom: NOM, role: 'plat_principal', famille: 'riz', grammage: { valeur: 30, unite: 'g', etat: 'cuit' }, h: h(1) };
  c.grammage = { valeur: 30, unite: 'g', etat: 'cuit', statut: 'SAISI_SERVICE', source: 'fiche retenue du nom', repris: true };
  assert.equal(cartes(e).length, 1);
  gestesRapides(e, cartes(e)[0])[1].agir(e, h(3));
  assert.equal(c.grammage.etat, 'sec');
  assert.equal(c.grammage.repris, true);
  assert.equal(quantite(e, c.id), 600);
});

test('standard maison (v131) et plat de valeurs différentes : deux cartes, une par portion', () => {
  const { e } = risotto();
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'cuit' }, h(3));
  const liste = cartes(e);
  assert.equal(liste.length, 2);
  assert.ok(liste.some((c) => /Votre standard de riz \(60 g\)/.test(c.texte)));
});

test('une portion de la semaine passée n\'a pas de carte, mais se corrige quand même', () => {
  const { e, c } = risotto({ date: '2026-10-05' });
  assert.equal(cartes(e).length, 0);
  corrigerEtatPoidsLieux(e, [{ type: 'plat', composantId: c.id }], 'sec', h(3));
  assert.equal(e.composants[c.id].grammage.etat, 'sec');
});

test('aucune carte : déjà sec, préparation maison, famille inconnue', () => {
  const { e, c } = risotto();
  definirEtatPoidsPortion(e, { type: 'plat', composantId: c.id }, 'sec', h(3));
  assert.equal(cartes(e).length, 0);
  const prep = risotto();
  modifierComposant(prep.e, prep.c.id, { type: 'preparation_maison' }, h(3));
  assert.equal(cartes(prep.e).length, 0);
  const sans = risotto();
  sans.c.famille = null;
  assert.equal(cartes(sans.e).length, 0);
});

test('une action refuse un endroit qui n\'existe plus ou un état inconnu', () => {
  const { e, c } = risotto();
  assert.throws(() => definirEtatPoidsPortion(e, { type: 'plat', composantId: c.id }, 'tiede', h(3)));
  assert.throws(() => definirEtatPoidsPortion(e, { type: 'plat', composantId: 'inconnu' }, 'sec', h(3)));
  assert.throws(() => definirEtatPoidsPortion(e, { type: 'fiche', cle: 'rien' }, 'sec', h(3)));
});
