// v132 (relecture) : copies reprises, `h` du standard intact, standards de catégorie, référence introuvable, ordre des cartes,
// pluriel en virgule, portion hors repère (information seulement).

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard, memoriser, modifierComposant } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { cleDeNom, reprendreFiche } from '../app/js/domaine/fiches-retenues.js';
import { corrigerEtatPoidsLieux, definirEtatPoidsPortion, expliquerQuantite } from '../app/js/domaine/poids-portion.js';
import { gestesRapides } from '../app/js/ui/geste-rapide.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-15';
const SEMAINE_SUIVANTE = '2026-10-22';
const NOM = 'Risotto à la milanaise et écaille de parmesan';
const cartes = (e) => decisionsDe(e, JOUR).cartes.filter((c) => c.type === 'etat_poids_portion');
const plats = (e) => Object.values(e.composants).filter((x) => x.famille === 'riz');

function risotto(date = JOUR, e = etatVide(), couverts = 20) {
  definirMenu(e, date, 1, NOM, h());
  definirCouvertsMidi(e, date, { total: couverts, repartition: { 1: couverts, 2: 0 } }, h(1));
  return e;
}
function avecFicheCuite() {
  const e = risotto();
  const c = plats(e)[0];
  modifierComposant(e, c.id, { grammage: { valeur: 30, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } }, h(2));
  memoriser(e, c.id, h(3));
  return { e, c };
}
const semaineSuivante = (e) => {
  risotto(SEMAINE_SUIVANTE, e);
  const c = plats(e).find((x) => x.date === SEMAINE_SUIVANTE);
  reprendreFiche(e, c);
  return c;
};
const jourSuivant = (e) => decisionsDe(e, SEMAINE_SUIVANTE).cartes.filter((c) => c.type === 'etat_poids_portion');

test('(1) « Oui, c\'est du cuit » sur la fiche puis reprise la semaine suivante : aucune nouvelle carte', () => {
  const { e } = avecFicheCuite();
  assert.equal(cartes(e).length, 1);
  gestesRapides(e, cartes(e)[0])[0].agir(e, h(4));
  const c2 = semaineSuivante(e);
  assert.equal(c2.grammage.repris, true);
  assert.equal(cartes(e).length, 0);
  assert.equal(jourSuivant(e).length, 0);
});

test('(1) corriger la fiche en sec puis reprendre : le plat repris est sec ; une copie déjà reprise suit', () => {
  const { e } = avecFicheCuite();
  const avant = semaineSuivante(e);
  assert.equal(avant.grammage.etat, 'cuit');
  const lieu = cartes(e)[0].lieux.find((l) => l.type === 'fiche');
  corrigerEtatPoidsLieux(e, [lieu], 'sec', h(4));
  assert.equal(e.composants[avant.id].grammage.etat, 'sec');
  const e2 = avecFicheCuite().e;
  corrigerEtatPoidsLieux(e2, [{ type: 'fiche', cle: cleDeNom(NOM) }], 'sec', h(4));
  assert.equal(semaineSuivante(e2).grammage.etat, 'sec');
});

test('(1) un plat repris dont l\'origine est introuvable garde sa carte', () => {
  const e = risotto();
  const c = plats(e)[0];
  c.grammage = { valeur: 30, unite: 'g', etat: 'cuit', statut: 'SAISI_SERVICE', source: 'fiche retenue du nom', repris: true };
  assert.equal(cartes(e).length, 1);
  assert.deepEqual(cartes(e)[0].lieux, [{ type: 'plat', composantId: c.id }]);
});

test('(2) « Non, c\'est du sec » sur un standard maison garde `h` et tout autre champ', () => {
  const e = risotto();
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'cuit' }, h(3));
  e.standards.riz.plat_principal.note = 'x';
  const carte = cartes(e).find((c) => c.lieux.some((l) => l.type === 'standard'));
  gestesRapides(e, carte)[1].agir(e, h(8));
  assert.equal(e.standards.riz.plat_principal.etat, 'sec');
  assert.equal(e.standards.riz.plat_principal.h, h(3));
  assert.equal(e.standards.riz.plat_principal.note, 'x');
  assert.equal(e.standards.riz.plat_principal.valeur, 60);
});

test('(3) un standard de catégorie « cuit » pour des familles à repère sec : carte et geste', () => {
  const e = risotto();
  e.standards['groupe:cereales'] = { plat_principal: { valeur: 60, unite: 'g', etat: 'cuit', h: h(3) } };
  const carte = cartes(e).find((c) => c.lieux.some((l) => l.cleFamille === 'groupe:cereales'));
  assert.ok(carte, 'carte du standard de catégorie');
  assert.match(carte.texte, /standard de la catégorie/);
  gestesRapides(e, carte)[1].agir(e, h(4));
  assert.equal(e.standards['groupe:cereales'].plat_principal.etat, 'sec');
  assert.equal(e.standards['groupe:cereales'].plat_principal.h, h(3));
  assert.equal(cartes(e).filter((c) => c.lieux.some((l) => l.cleFamille === 'groupe:cereales')).length, 0);
});

// Garde défensive (`cle` null => `lieu` null) : inatteignable par l'état, `lireMemoire` et `cleMemoireReelle` lisent les mêmes clés.
test('(4) référence trouvée : le lieu porte une clé réelle (jamais cle:null)', () => {
  const { e } = avecFicheCuite();
  e.fiches_retenues = {};
  const e2 = risotto(SEMAINE_SUIVANTE, e);
  const c = plats(e2).find((x) => x.date === SEMAINE_SUIVANTE);
  const x = expliquerQuantite(e2, c.id);
  assert.equal(x.origine, 'référence de ce nom');
  assert.equal(x.lieu.type, 'reference');
  assert.ok(x.lieu.cle);
});

test('(5) « Corriger le poids » d\'un plat repris vise l\'origine ; la copie la suit', () => {
  const { e } = avecFicheCuite();
  const c2 = semaineSuivante(e);
  const x = expliquerQuantite(e, c2.id);
  assert.deepEqual(x.lieu, { type: 'fiche', cle: cleDeNom(NOM) });
  definirEtatPoidsPortion(e, x.lieu, 'sec', h(5));
  assert.equal(e.fiches_retenues[cleDeNom(NOM)].grammage.etat, 'sec');
  assert.equal(e.composants[c2.id].grammage.etat, 'sec');
  assert.equal(Math.round(calculerComposant(e, c2.id).quantiteTravail), 600);
});

test('(7) le nombre de portions s\'écrit avec la virgule : « 12,5 portions »', () => {
  const e = risotto(JOUR, etatVide(), 25);
  e.jours[JOUR].previsions[1].portions = 12.5;
  const c = plats(e)[0];
  modifierComposant(e, c.id, { grammage: { valeur: 60, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'x' } }, h(3));
  const x = expliquerQuantite(e, c.id);
  assert.match(x.texte ?? '', /^12,5 portions/);
});

test('(8a) « état du poids à confirmer » passe avant sauces, semaine type et le reste', () => {
  const e = risotto();
  const c = plats(e)[0];
  modifierComposant(e, c.id, { grammage: { valeur: 30, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'x' } }, h(2));
  const { cartes: toutes } = decisionsDe(e, JOUR);
  assert.equal(toutes[0].type, 'etat_poids_portion');
});

test('(8b) portion hors repère : simple note, quel que soit l\'état du poids', () => {
  const e = risotto();
  const c = plats(e)[0];
  const poser = (valeur, etat) => modifierComposant(e, c.id, { grammage: { valeur, unite: 'g', etat, statut: 'RESTAURANT_VALIDE', source: 'x' } }, h(2));
  poser(30, 'sec');
  let x = expliquerQuantite(e, c.id);
  assert.equal(x.suspect, false);
  assert.match(x.avertissement, /^Attention : 30 g est en dessous du repère de cette famille \(50–70 g\)\. Vérifiez la portion\.$/);
  poser(100, 'sec');
  x = expliquerQuantite(e, c.id);
  assert.match(x.avertissement, /100 g est au-dessus du repère/);
  poser(60, 'sec');
  assert.equal(expliquerQuantite(e, c.id).avertissement, null);
  assert.equal(cartes(e).length, 0);
});
