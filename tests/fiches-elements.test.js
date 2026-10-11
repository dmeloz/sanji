// v118 : la fiche retenue est celle d'un ÉLÉMENT (carbonara, risotto, côtes de bette à la crème), jamais d'un plat entier.
// Domaine : migration des anciens plats retenus, rubriques, tri, recherche, clôture par élément, gestes de la petite fiche.
// Éléments génériques ; aucune donnée de restaurant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { definirPortionFiche, oublierFiche, reclasserFiche, renommerFiche, retenirElement,
  retenirElementsDeLaSemaine } from '../app/js/domaine/actions-fiches.js';
import { enseignerMot } from '../app/js/domaine/actions-mots.js';
import { elementsDeLaSemaine, rappelCloture } from '../app/js/domaine/cloture.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { fichesParRubrique, rubriqueDeFiche } from '../app/js/domaine/fiches-elements.js';
import { choixMotDe } from '../app/js/domaine/mots-retenus.js';
import { retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { enseignerAuPoste, h } from './aide.js';

const LUNDI = '2026-10-12';
const parNom = (e, date, menu, nom) => Object.values(e.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);
const doc = (etat) => JSON.stringify({ application: 'sanji-entremetier', schema: 1, exporteLe: h(), etat });

// ------------------------------------------------------------- unité = élément : plus aucun plat retenu

test('plus aucun plat retenu : ni écrit, ni exporté, ni repris', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Fusilli al ferretto', h());
  modifierComposant(e, parNom(e, LUNDI, 1, 'sauce à confirmer').id, { nom: 'tomate' }, h(1));
  assert.equal(e.plats_retenus, undefined);
  assert.ok(e.fiches_retenues.tomate, 'la sauce nommée est un élément comme un autre');
  assert.equal(e.fiches_retenues.tomate.nom, 'tomate');
  assert.doesNotMatch(exporter(e, h(2)), /plats_retenus/);
  definirMenu(e, '2026-11-02', 1, 'Fusilli al ferretto', h(3));
  assert.ok(parNom(e, '2026-11-02', 1, 'sauce à confirmer'), 'la sauce implicite reste à confirmer : aucun plat n\'est repris');
  assert.ok(!Object.values(e.composants).some((c) => c.reprise));
});

test('la fiche garde le nom d\'affichage et la famille', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 2, 'Boulgour, courgette sautée', h());
  enseignerAuPoste(e, parNom(e, LUNDI, 2, 'Boulgour').id, 'garniture', h(1));
  assert.equal(e.fiches_retenues.boulgour.nom, 'Boulgour');
  assert.equal(e.fiches_retenues.boulgour.famille, 'boulgour');
  retenirFiche(e, '  Côtes   de bette ', { categorie: 'legume' }, h(2));
  assert.equal(e.fiches_retenues['cotes de bette'].nom, 'Côtes de bette');
  const relu = importer(doc({ fiches_retenues: { a: { categorie: 'autre', nom: 'Bon\u0007  nom', famille: 'riz' }, b: { categorie: 'autre', nom: 'x'.repeat(61), famille: '__proto__' } } }));
  assert.deepEqual([relu.fiches_retenues.a.nom, relu.fiches_retenues.a.famille], ['Bon nom', 'riz']);
  assert.deepEqual([relu.fiches_retenues.b.nom, relu.fiches_retenues.b.famille], [undefined, undefined], 'nom trop long et famille invalide écartés');
});

// ------------------------------------------------------------- migration

test('import : un ancien plats_retenus devient des fiches d\'éléments, sans perte ni écrasement, puis n\'est plus lu', () => {
  const plats = { 'fusilli al ferretto': { intitule: 'Fusilli al ferretto', menu: 1, h: h(3), elements: [
    { nom: 'Fusilli al ferretto', categorie: 'feculent', role: 'plat_principal', attribue: true },
    { nom: 'tomate', categorie: 'sauce', role: 'sauce', attribue: true },
    { nom: 'à voir', categorie: 'a_preciser', attribue: true }] },
  zorbi: { menu: 2, h: h(4), elements: [{ nom: 'Zorbi', categorie: 'autre', role: 'garniture', attribue: false }, { nom: 'Déjà', categorie: 'legume', attribue: true }] } };
  const deja = { deja: { categorie: 'autre', role: 'garniture', nom: 'Déjà', h: h(1) } };
  const relu = importer(doc({ plats_retenus: plats, fiches_retenues: deja }));
  assert.deepEqual(Object.keys(relu.fiches_retenues).sort(), ['deja', 'fusilli al ferretto', 'tomate', 'zorbi']);
  assert.equal(relu.fiches_retenues.deja.categorie, 'autre', 'une fiche existante n\'est jamais écrasée');
  assert.equal(relu.fiches_retenues.tomate.categorie, 'sauce');
  assert.equal(relu.fiches_retenues['fusilli al ferretto'].nom, 'Fusilli al ferretto');
  assert.equal(relu.fiches_retenues.zorbi.attribue, undefined, 'hors poste : la fiche garde sa catégorie mais plus d\'attribution');
  assert.equal(relu.memoire['zorbi|2'].attribue, false, '… mais la décision est gardée dans la mémoire d\'attribution');
  assert.equal(relu.fiches_retenues.tomate.attribue, undefined, 'le menu 1 est entièrement au poste : rien à retenir');
  assert.equal(relu.plats_retenus, undefined);
  assert.doesNotMatch(exporter(relu, h(5)), /plats_retenus/);
});

test('import : une ancienne fiche hors poste quitte fiches_retenues, sa décision passe dans memoire sans écraser une décision existante', () => {
  const fiches = { zorbi: { nom: 'Zorbi', categorie: 'autre', role: 'garniture', attribue: false, h: h() }, boulgour: { nom: 'Boulgour', categorie: 'feculent', attribue: false, h: h() }, riz: { nom: 'Riz', categorie: 'feculent', attribue: true, h: h() } };
  const memoire = { 'boulgour|2': { nom: 'Boulgour', attribue: false, categorie: 'feculent' } };
  const relu = importer(doc({ fiches_retenues: fiches, memoire }));
  assert.deepEqual(Object.keys(relu.fiches_retenues).sort(), ['boulgour', 'riz', 'zorbi']);
  assert.equal(relu.fiches_retenues.zorbi.attribue, undefined);
  assert.equal(relu.memoire['zorbi|2'].attribue, false);
  assert.equal(relu.memoire['zorbi|2'].categorie, 'autre');
  assert.equal(relu.memoire['boulgour|2'].attribue, false);
});

test('import : plats_retenus invalide ou absent ne casse rien', () => {
  assert.deepEqual(importer(doc({})).fiches_retenues, {});
  assert.deepEqual(importer(doc({ plats_retenus: 3 })).fiches_retenues, {});
  assert.deepEqual(importer(doc({ plats_retenus: { __proto__x: { elements: 'non' }, p: { elements: [null, { nom: 3 }] } } })).fiches_retenues, {});
});

// ------------------------------------------------------------- rubriques

test('rubriqueDeFiche : carbonara, risotto, côtes de bette, boulgour selon le rôle, produit', () => {
  assert.equal(rubriqueDeFiche({ categorie: 'sauce', role: 'sauce' }), 'sauces');
  assert.equal(rubriqueDeFiche({ categorie: 'feculent', role: 'plat_principal' }), 'feculents');
  assert.equal(rubriqueDeFiche({ categorie: 'legume', role: 'garniture' }), 'garnitures');
  assert.equal(rubriqueDeFiche({ categorie: 'feculent', role: 'garniture', famille: 'boulgour' }), 'feculents');
  assert.equal(rubriqueDeFiche({ categorie: 'autre', role: 'garniture', famille: 'boulgour' }), 'garnitures', 'le choix « garniture » de la propriétaire passe devant');
  assert.equal(rubriqueDeFiche({ categorie: 'autre' }), 'produits');
  assert.equal(rubriqueDeFiche({ categorie: 'proteine', role: 'composant_recette' }), 'produits');
  assert.equal(rubriqueDeFiche({ role: 'herbe' }), 'produits');
  assert.equal(rubriqueDeFiche({ role: 'plat_principal' }), 'autres');
  assert.equal(rubriqueDeFiche({}, 'polenta'), 'feculents', 'sans catégorie, le lexique décide');
  assert.equal(rubriqueDeFiche({}, 'zorbi'), 'autres');
});

// ------------------------------------------------------------- tri, recherche, onglets

function etatDeFiches() {
  const e = etatInitial();
  const f = (nom, champs) => retenirFiche(e, nom, champs, h(1));
  f('Spaghetti carbonara', { categorie: 'sauce', role: 'sauce' });
  f('Risotto', { categorie: 'feculent', role: 'plat_principal', grammage: { valeur: 80, unite: 'g', etat: 'sec' } });
  f('Côtes de bette à la crème', { categorie: 'legume', role: 'garniture' });
  f('Épinards', { categorie: 'legume', role: 'garniture' });
  f('Écrasé', { categorie: 'legume', role: 'garniture' });
  f('Zorbi', { categorie: 'autre' });
  f('Boulgour', { categorie: 'feculent', role: 'garniture' });
  return e;
}
const noms = (r) => r.rubriques.flatMap((x) => x.fiches.map((y) => y.nom));

test('page : rubriques fixes toujours présentes, dans l\'ordre, avec leur nombre', () => {
  const r = fichesParRubrique(etatDeFiches());
  assert.deepEqual(r.rubriques.map((x) => x.cle), ['feculents', 'sauces', 'garnitures', 'produits', 'autres']);
  assert.deepEqual(r.rubriques.map((x) => x.titre), ['Pâtes et féculents', 'Sauces', 'Légumes et garnitures', 'Produits', 'Autres']);
  assert.deepEqual(r.rubriques.map((x) => x.fiches.length), [2, 1, 3, 1, 0]);
  assert.equal(r.total, 7);
});

test('un élément hors poste ne crée aucune fiche, sa décision reste dans memoire ; une fiche existante disparaît', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 2, 'Boulgour', h());
  const id = parNom(e, LUNDI, 2, 'Boulgour').id;
  modifierComposant(e, id, { attribue: false }, h(1));
  assert.equal(e.fiches_retenues.boulgour, undefined);
  modifierComposant(e, id, { attribue: true }, h(1));
  assert.ok(e.fiches_retenues.boulgour, 'remis au poste : la fiche naît');
  modifierComposant(e, id, { attribue: false }, h(2));
  assert.equal(e.fiches_retenues.boulgour.attribue, undefined, 'la fiche partagée reste, sans attribution');
  assert.equal(e.memoire['boulgour|2'].attribue, false, 'la décision est écrite avant de renoncer à la fiche');
  enseignerMot(e, id, 'garniture', h(3));
  assert.equal(e.fiches_retenues.boulgour.attribue, undefined);
  assert.equal(e.memoire['boulgour|2'].attribue, false);
  retenirFiche(e, 'Zorbi', { categorie: 'autre', attribue: false }, h(4));
  assert.equal(e.fiches_retenues.zorbi, undefined);
  assert.deepEqual(noms(fichesParRubrique(e)), ['Boulgour'], 'la fiche partagée reste visible (au poste par défaut)');
});

test('page : tri alphabétique français (accents ignorés au classement) et recherche sans casse ni accents', () => {
  const e = etatDeFiches();
  const garnitures = fichesParRubrique(e).rubriques.find((x) => x.cle === 'garnitures');
  assert.deepEqual(garnitures.fiches.map((x) => x.nom), ['Côtes de bette à la crème', 'Écrasé', 'Épinards']);
  assert.deepEqual(noms(fichesParRubrique(e, { recherche: 'EPINARD' })), ['Épinards']);
  assert.deepEqual(noms(fichesParRubrique(e, { recherche: 'ecras' })), ['Écrasé']);
  assert.equal(noms(fichesParRubrique(e, { recherche: '  ' })).length, 7);
  assert.deepEqual(fichesParRubrique(e, { recherche: 'zzz' }).rubriques.map((x) => x.fiches.length), [0, 0, 0, 0, 0]);
});

test('page : résumé court « 80 g sec » ou « portion à saisir »', () => {
  const r = fichesParRubrique(etatDeFiches());
  const tous = r.rubriques.flatMap((x) => x.fiches);
  assert.equal(tous.find((x) => x.nom === 'Risotto').resume, '80 g sec');
  assert.equal(tous.find((x) => x.nom === 'Épinards').resume, 'portion à saisir');
  assert.equal(tous.find((x) => x.nom === 'Épinards').aSaisir, true);
  assert.equal(tous.find((x) => x.nom === 'Spaghetti carbonara').aSaisir, false, 'une sauce n\'a pas de portion à saisir');
});

test('page : une fiche sans nom retenu s\'affiche sous sa clé', () => {
  const e = etatInitial();
  e.fiches_retenues.zorbi = { categorie: 'autre', h: h() };
  assert.deepEqual(noms(fichesParRubrique(e)), ['zorbi']);
});

// ------------------------------------------------------------- clôture par élément

test('clôture : les éléments de la semaine sans fiche, groupés par plat ; la sauce implicite et le mot à préciser sont à part', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Gnocchi alla sorrentina', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  definirMenu(e, '2026-10-14', 2, 'Côtes de bette à la crème', h());
  const s = elementsDeLaSemaine(e, LUNDI);
  const tous = s.plats.flatMap((p) => p.elements);
  const ligne = (nom) => tous.find((x) => x.nom === nom);
  assert.equal(ligne('Gnocchi').choix, 'forme_pates');
  assert.equal(ligne('sorrentina').choix, 'sauce');
  assert.equal(ligne('sorrentina').propose, true, 'proposée par la lecture, jamais décidée');
  assert.equal(ligne('sauce à confirmer').bloque, true);
  assert.equal(ligne('Côtes de bette').retenu, false);
  assert.equal(ligne('crème'), undefined, 'hors poste : pas dans la clôture');
  assert.deepEqual(s.plats.map((p) => p.intitule), ['Gnocchi alla sorrentina', 'Fusilli al ferretto', 'Côtes de bette à la crème']);
  assert.equal(s.aRetenir, 4);
  assert.equal(s.bloques, 1);
});

test('clôture : « Retenir les N éléments nommés » écrit une fiche par élément, jamais la sauce implicite', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Gnocchi alla sorrentina', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  const r = retenirElementsDeLaSemaine(e, LUNDI, h(1));
  assert.equal(r.retenus, 3);
  assert.deepEqual(Object.keys(e.fiches_retenues).sort(), ['fusilli al ferretto', 'gnocchi', 'sorrentina']);
  assert.equal(e.fiches_retenues.sorrentina.categorie, 'sauce');
  assert.ok(parNom(e, '2026-10-13', 1, 'sauce à confirmer'), 'rien n\'est inventé');
  assert.equal(e.plats_retenus, undefined);
  assert.equal(retenirElementsDeLaSemaine(e, LUNDI, h(2)).retenus, 0);
  assert.equal(elementsDeLaSemaine(e, LUNDI).aRetenir, 0);
});

test('clôture : retenirElement refuse la sauce implicite ; un élément déjà classé est retenu tel quel', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Spaghetti carbonara', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  retenirElement(e, parNom(e, LUNDI, 1, 'carbonara').id, h(1));
  assert.equal(e.fiches_retenues.carbonara.categorie, 'sauce');
  assert.equal(e.fiches_retenues.carbonara.nom, 'carbonara');
  const avant = structuredClone(e);
  assert.throws(() => retenirElement(e, parNom(e, '2026-10-13', 1, 'sauce à confirmer').id, h(2)), /sauce/);
  assert.deepEqual(e, avant);
});

test('clôture : le rappel (samedi dès 18:00, dimanche) compte les éléments à retenir', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Gnocchi alla sorrentina', h());
  assert.equal(rappelCloture(e, '2026-10-14', '20:00'), null, 'mercredi');
  assert.equal(rappelCloture(e, '2026-10-17', '17:59'), null);
  assert.equal(rappelCloture(e, '2026-10-17', null), null);
  assert.deepEqual(rappelCloture(e, '2026-10-17', '18:00'), { lundi: LUNDI, aRetenir: 2, retenus: 0 });
  retenirElementsDeLaSemaine(e, LUNDI, h(1));
  assert.equal(rappelCloture(e, '2026-10-18', '09:00'), null, 'tout est retenu');
});

test('clôture : un élément que rien ne peut retenir sans la propriétaire ne fait pas durer le rappel', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 1, 'Fusilli al ferretto', h());
  retenirElementsDeLaSemaine(e, LUNDI, h(1)); // Fusilli retenu ; reste la sauce sans nom
  assert.equal(rappelCloture(e, '2026-10-18', '09:00'), null);
});

// ------------------------------------------------------------- une fiche s'écrit aussi quand la propriétaire valide

test('valider un élément au poste (catégorie ou attribution) écrit sa fiche ; l\'import n\'écrit rien', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 2, 'Boulgour', h());
  assert.deepEqual(e.fiches_retenues, {}, 'rien à l\'import');
  modifierComposant(e, parNom(e, LUNDI, 2, 'Boulgour').id, { attribue: false }, h(1));
  modifierComposant(e, parNom(e, LUNDI, 2, 'Boulgour').id, { attribue: true }, h(2));
  assert.equal(e.fiches_retenues.boulgour.nom, 'Boulgour');
});

// ------------------------------------------------------------- la petite fiche

test('petite fiche : renommer une fiche sans élément crée l\'alias et déplace la fiche', () => {
  const e = etatInitial();
  retenirFiche(e, 'Boulghour', { categorie: 'feculent', role: 'garniture' }, h());
  const r = renommerFiche(e, 'boulghour', 'Boulgour', h(1));
  assert.equal(r.retenue, true);
  assert.equal(e.fiches_retenues.boulghour, undefined);
  assert.equal(e.fiches_retenues.boulgour.nom, 'Boulgour');
  assert.deepEqual(e.noms.boulghour, { nom: 'Boulgour', h: h(1) });
  definirMenu(e, '2026-11-02', 2, 'Boulghour', h(2));
  assert.ok(parNom(e, '2026-11-02', 2, 'Boulgour'), 'la nouvelle orthographe est reprise à l\'import suivant');
});

test('petite fiche : renommer une fiche qui a des éléments à venir les corrige aussi (corrigerNom)', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 2, 'Boulghour', h());
  enseignerAuPoste(e, parNom(e, LUNDI, 2, 'Boulghour').id, 'garniture', h(1));
  renommerFiche(e, 'boulghour', 'Boulgour', h(2));
  assert.ok(parNom(e, LUNDI, 2, 'Boulgour'));
  assert.ok(e.fiches_retenues.boulgour && !e.fiches_retenues.boulghour);
});

test('petite fiche : renommer refuse un nom vide, trop long ou inconnu, sans rien changer', () => {
  const e = etatInitial();
  retenirFiche(e, 'Zorbi', { categorie: 'autre' }, h());
  const avant = structuredClone(e);
  for (const mauvais of ['', '  ', 'x'.repeat(61), '__proto__']) assert.throws(() => renommerFiche(e, 'zorbi', mauvais, h(1)), undefined, mauvais);
  assert.throws(() => renommerFiche(e, 'inconnu', 'Autre', h(1)));
  assert.deepEqual(e, avant);
});

test('petite fiche : changer de catégorie (les 4 choix)', () => {
  const e = etatInitial();
  retenirFiche(e, 'Zorbi', { categorie: 'autre', role: 'garniture', grammage: { valeur: 80, unite: 'g', etat: 'cuit' } }, h());
  reclasserFiche(e, 'zorbi', 'sauce', h(1));
  assert.equal(e.fiches_retenues.zorbi.categorie, 'sauce');
  assert.equal(e.fiches_retenues.zorbi.role, 'sauce');
  reclasserFiche(e, 'zorbi', 'forme_pates', h(2));
  assert.equal(e.fiches_retenues.zorbi.categorie, 'feculent');
  assert.equal(e.fiches_retenues.zorbi.role, undefined, 'le rôle « sauce » ne suit pas');
  assert.equal(e.fiches_retenues.zorbi.grammage, undefined, 'pas de portion sans rôle');
  reclasserFiche(e, 'zorbi', 'produit', h(3));
  assert.equal(e.fiches_retenues.zorbi.categorie, 'autre');
  assert.equal(choixMotDe(e.fiches_retenues.zorbi), 'produit');
  retenirFiche(e, 'Zorbi', { categorie: 'autre', role: 'garniture' }, h(3));
  reclasserFiche(e, 'zorbi', 'produit', h(3));
  assert.equal(choixMotDe(e.fiches_retenues.zorbi), 'produit', 'un produit choisi n\'est plus relu « garniture »');
  assert.throws(() => reclasserFiche(e, 'zorbi', 'nimporte', h(4)));
});

test('petite fiche : la portion tapée est retenue, reprise à la création d\'un élément du même nom', () => {
  const e = etatInitial();
  retenirFiche(e, 'Zorbi', { categorie: 'autre', role: 'garniture' }, h());
  definirPortionFiche(e, 'zorbi', 85, 'cuit', h(1));
  assert.deepEqual(e.fiches_retenues.zorbi.grammage, { valeur: 85, unite: 'g', etat: 'cuit' });
  definirMenu(e, '2026-11-02', 2, 'Zorbi', h(2));
  assert.equal(parNom(e, '2026-11-02', 2, 'Zorbi').grammage.valeur, 85);
  assert.throws(() => definirPortionFiche(e, 'zorbi', 0, 'cuit', h(3)));
  assert.throws(() => definirPortionFiche(e, 'zorbi', 80, 'nimporte', h(3)));
});

test('petite fiche : une famille connue reçoit aussi un standard maison ; sans rôle, la portion est refusée', () => {
  const e = etatInitial();
  retenirFiche(e, 'Boulgour', { categorie: 'feculent', role: 'garniture', famille: 'boulgour' }, h());
  definirPortionFiche(e, 'boulgour', 70, 'cuit', h(1));
  assert.equal(e.standards.boulgour.garniture.valeur, 70);
  retenirFiche(e, 'Zorbi', { categorie: 'autre' }, h(2));
  assert.throws(() => definirPortionFiche(e, 'zorbi', 70, 'cuit', h(3)), /fonction/);
});

test('petite fiche : oublier retire la fiche et l\'orthographe, pas les éléments', () => {
  const e = etatInitial();
  definirMenu(e, LUNDI, 2, 'Boulghour', h());
  enseignerAuPoste(e, parNom(e, LUNDI, 2, 'Boulghour').id, 'garniture', h(1));
  oublierFiche(e, 'boulghour', h(2));
  assert.deepEqual(e.fiches_retenues, {});
  assert.ok(parNom(e, LUNDI, 2, 'Boulghour'));
});
