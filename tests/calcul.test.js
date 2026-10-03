import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annulerFiche, creerFiche, definirPrevision, modifierComposant, modifierFiche,
} from '../app/js/domaine/actions.js';
import {
  arrondirQuantite, calculerComposant, chercherBase, formaterQuantite, portionsMenu,
} from '../app/js/domaine/calcul.js';
import { chercherBase as chercherBaseDirect } from '../app/js/domaine/base.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, recetteValidee } from './aide.js';

const fiche = (etat, champs) => creerFiche(etat, { date: S.mardi, service: 'midi', couverts: 10, mode: 'menu_fixe', menuFixe: 1, ...champs }, h());

test('portionsMenu : base neuve, prévision manquante signalée, jamais inventée', () => {
  const p = portionsMenu(etatVide(), S.lundi, 1);
  assert.deepEqual(p, { total: 0, prevision: 0, previsionManquante: true, groupesConfirmes: 0, groupesProvisoires: 0, details: [] });
  const e = etatVide();
  prevision(e, S.lundi, 1, 0); // 0 saisi explicitement n'est pas « manquant »
  assert.equal(portionsMenu(e, S.lundi, 1).previsionManquante, undefined);
});

test('portionsMenu : seules les fiches actives du midi, un jour à menu, hors « hors_menu » comptent', () => {
  const e = etatVide();
  fiche(e, {});
  fiche(e, { service: 'soir', couverts: 99 });
  fiche(e, { mode: 'hors_menu', menuFixe: null, couverts: 77 });
  fiche(e, { date: S.samedi, couverts: 55 });
  const annulee = fiche(e, { couverts: 33 });
  annulerFiche(e, annulee, h());
  const p = portionsMenu(e, S.mardi, 1);
  assert.equal(p.total, 10);
  assert.equal(p.groupesConfirmes, 10);
  assert.deepEqual(p.details.map((d) => [d.source, d.portions, d.certitude]), [['fiche', 10, 'confirmee']]);
  assert.equal(portionsMenu(e, S.samedi, 1).total, 0);
});

test('portionsMenu : répartition dont la somme diffère des couverts → on compte ce qui est réparti, rien de plus', () => {
  const e = etatVide();
  fiche(e, { mode: 'choix_libre', menuFixe: null, couverts: 30, repartition: { 1: 10, 2: 5 } });
  assert.equal(portionsMenu(e, S.mardi, 1).total, 10);
  assert.equal(portionsMenu(e, S.mardi, 2).total, 5);
  assert.equal(portionsMenu(e, S.mardi, 1).groupesProvisoires, 10);
});

test('portionsMenu : la certitude suit la source (estimée, provisoire, confirmée)', () => {
  const e = etatVide();
  prevision(e, S.mardi, 1, 4);
  fiche(e, { couverts: 6 });
  const g = fiche(e, { mode: 'choix_libre', menuFixe: null, couverts: 8, repartition: { 1: 3, 2: 5 } });
  const p = portionsMenu(e, S.mardi, 1);
  assert.deepEqual(p.details.map((d) => d.certitude), ['estimee', 'confirmee', 'provisoire']);
  assert.equal(p.total, 13);
  modifierFiche(e, g, { repartition: { 1: 4, 2: 4 } }, h());
  assert.equal(portionsMenu(e, S.mardi, 1).groupesProvisoires, 4);
});

test('chaîne de calcul et formule lisible', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  modifierComposant(e, id, { grammage: { valeur: 150, statut: 'RESTAURANT_VALIDE' }, etapes: [
    { etape: 'parage', coefficient: 0.5, statut: 'RESTAURANT_VALIDE' },
    { etape: 'portionnement', coefficient: 0.95, statut: 'RESTAURANT_VALIDE' },
    { etape: 'cuisson', coefficient: 2.5, statut: 'RESTAURANT_VALIDE' }] }, h());
  const c = calculerComposant(e, id);
  assert.equal(c.statut, 'CALCULE');
  assert.equal(c.quantiteServie, 6000);
  // L'ordre est toujours portionnement → cuisson → parage, quel que soit l'ordre de saisie.
  assert.deepEqual(c.etapes.map((x) => x.etape), ['portionnement', 'cuisson', 'parage']);
  assert.equal(Math.round(c.etapes[0].quantiteAvant), 6316);
  assert.equal(Math.round(c.etapes[1].quantiteAvant), 2526);
  assert.equal(Math.round(c.brut), 5053);
  assert.equal(c.formule, '40 portions × 150 g = 6 000 g servis ; ÷ 0,95 (portionnement) = 6 316 g ; ÷ 2,50 (cuisson, gain) = 2 526 g ; ÷ 0,50 (parage) = 5 053 g bruts');
  assert.deepEqual(c.dependances.map((d) => d.parametre), ['grammage', 'portionnement', 'cuisson', 'parage']);
  assert.equal(c.aValider, false);
  assert.equal(c.aMesurer, false);
});

test('gain d\'absorption : coefficient > 1, le brut est inférieur au servi', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { etapes: [{ etape: 'cuisson', coefficient: 2.5, statut: 'RESTAURANT_VALIDE' }] });
  const c = calculerComposant(e, id);
  assert.equal(c.quantiteServie, 1000);
  assert.equal(c.brut, 400);
  assert.match(c.formule, /÷ 2,50 \(cuisson, gain\) = 400 g bruts/);
});

test('statuts de provenance : aValider et aMesurer', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const etape = (coefficient, statut) => [{ etape: 'parage', coefficient, statut, source: 'ESTIMATION_TEST' }];
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: etape(0.8, 'BASE_METIER_ESTIMATION') });
  let c = calculerComposant(e, id);
  assert.equal(c.aValider, true, 'estimation non validée');
  assert.equal(c.aMesurer, true, '|1 − 0,80| = 0,20 ≥ 0,15');
  modifierComposant(e, id, { etapes: etape(0.85, 'BASE_METIER_ESTIMATION') }, h());
  assert.equal(calculerComposant(e, id).aMesurer, true, 'seuil inclus (0,15)');
  modifierComposant(e, id, { etapes: etape(0.9, 'BASE_METIER_ESTIMATION') }, h());
  assert.equal(calculerComposant(e, id).aMesurer, false);
  modifierComposant(e, id, { etapes: etape(0.5, 'RESTAURANT_VALIDE') }, h());
  c = calculerComposant(e, id);
  assert.equal(c.aMesurer, false, 'seule une estimation est à mesurer');
  assert.equal(c.aValider, false);
  modifierComposant(e, id, { etapes: etape(0.5, 'INCONNU') }, h());
  assert.equal(calculerComposant(e, id).aValider, true);
  modifierComposant(e, id, { etapes: [], grammage: { statut: 'BASE_METIER_ESTIMATION' } }, h());
  assert.equal(calculerComposant(e, id).aValider, true, 'grammage estimé');
  // Gain d'absorption estimé de 15 % ou plus : à mesurer aussi.
  modifierComposant(e, id, { grammage: { statut: 'RESTAURANT_VALIDE' },
    etapes: [{ etape: 'cuisson', coefficient: 1.15, statut: 'BASE_METIER_ESTIMATION' }] }, h());
  assert.equal(calculerComposant(e, id).aMesurer, true);
});

test('valeurs manquantes : INCONNU, aucune quantité inventée', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const sansGrammage = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  const c = calculerComposant(e, sansGrammage);
  assert.equal(c.statut, 'INCONNU');
  assert.equal(c.quantiteTravail, null);
  assert.equal(c.brut, null);
  assert.ok(c.manquants.includes('grammage'));
  assert.match(c.formule, /inconnue/);
  const aPreciser = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'COMPOSANT_FLOU_TEST', type: 'a_preciser' });
  assert.equal(calculerComposant(e, aPreciser).statut, 'INCONNU');
  assert.ok(calculerComposant(e, aPreciser).manquants.includes('type de composant'));
  // Prévision jamais saisie : aucune quantité (et pas « 0 ») ; avec des groupes, on calcule mais on le signale.
  const e2 = etatVide();
  const id = composantValide(e2, S.mardi, 1, J.PRODUIT_SEC_TEST);
  assert.equal(calculerComposant(e2, id).statut, 'INCONNU');
  assert.ok(calculerComposant(e2, id).manquants.includes('prévision hors groupes'));
  fiche(e2, { couverts: 10 });
  const avecGroupe = calculerComposant(e2, id);
  assert.equal(avecGroupe.statut, 'CALCULE');
  assert.equal(avecGroupe.quantiteTravail, 500);
  assert.ok(avecGroupe.manquants.includes('prévision hors groupes'));
  assert.throws(() => calculerComposant(e2, 'inexistant'), /introuvable/);
});

test('données corrompues (étape en double, coefficient invalide) : INCONNU, pas de double perte', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  e.composants[id].etapes.push({ etape: 'cuisson', coefficient: 0.7, statut: 'RESTAURANT_VALIDE', source: '' });
  let c = calculerComposant(e, id);
  assert.equal(c.statut, 'INCONNU');
  assert.ok(c.manquants.includes('étape en double (cuisson)'));
  e.composants[id].etapes = [{ etape: 'cuisson', coefficient: 0, statut: 'RESTAURANT_VALIDE', source: '' }];
  c = calculerComposant(e, id);
  assert.equal(c.statut, 'INCONNU');
  e.composants[id].etapes = [{ etape: 'cuisson', coefficient: -1, statut: 'RESTAURANT_VALIDE', source: '' }];
  assert.equal(calculerComposant(e, id).statut, 'INCONNU');
});

test('préparation maison : recette validée → ingrédients ; non validée ou absente → null et « recette » manquante', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const id = composantValide(e, S.lundi, 1, J.PREPARATION_TEST);
  assert.equal(calculerComposant(e, id).ingredients, null);
  const recette = recetteValidee(e, J.RECETTE_TEST);
  modifierComposant(e, id, { recetteId: recette }, h());
  const c = calculerComposant(e, id);
  assert.equal(c.quantiteTravail, 2000);
  assert.deepEqual(c.ingredients, [
    { nom: 'INGREDIENT_A_TEST', quantite: 1000, unite: 'ml' },
    { nom: 'INGREDIENT_B_TEST', quantite: 200, unite: 'g' }]);
  assert.equal(c.aValider, false);
  assert.ok(c.dependances.some((d) => d.parametre === 'recette' && d.statut === 'RESTAURANT_VALIDE'));
  // Une recette non validée n'alimente aucun ingrédient et reste « à valider ».
  e.recettes[recette].valide = false;
  const c2 = calculerComposant(e, id);
  assert.equal(c2.ingredients, null);
  assert.ok(c2.manquants.includes('recette'));
  assert.equal(c2.aValider, true);
  // Rendement dans une autre unité que le grammage : pas de conversion devinée.
  e.recettes[recette].valide = true;
  e.recettes[recette].rendement.unite = 'g';
  assert.equal(calculerComposant(e, id).ingredients, null);
});

test('générique : portions, jamais de grammage ni d\'ingrédients', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 12);
  const c = calculerComposant(e, composantValide(e, S.lundi, 1, J.COMPOSANT_VAGUE_TEST));
  assert.equal(c.quantiteTravail, 12);
  assert.equal(c.uniteTravail, 'portion');
  assert.equal(c.quantiteServie, null);
  assert.equal(c.formule, '12 portions, composition à définir');
  const e2 = etatVide();
  assert.equal(calculerComposant(e2, composantValide(e2, S.lundi, 1, J.COMPOSANT_VAGUE_TEST)).statut, 'INCONNU');
});

test('pièces : arrondi à la pièce supérieure ; g et ml à l\'unité', () => {
  assert.equal(arrondirQuantite(12.0000000001, 'piece'), 12);
  assert.equal(arrondirQuantite(12.2, 'piece'), 13);
  assert.equal(arrondirQuantite(2526.3, 'g'), 2526);
  assert.equal(arrondirQuantite(2526.5, 'ml'), 2527);
  assert.equal(arrondirQuantite(-0.0001, 'piece'), 0);
  assert.equal(Object.is(arrondirQuantite(-0.2, 'g'), 0), true);
  assert.equal(formaterQuantite(13, 'piece'), '13 pièces');
  assert.equal(formaterQuantite(1, 'piece'), '1 pièce');
  assert.equal(formaterQuantite(6000, 'g'), '6 000 g');
  assert.equal(formaterQuantite(40, 'portion'), '40 portions');
  const e = etatVide();
  prevision(e, S.lundi, 1, 5);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: 1.5, unite: 'piece', statut: 'RESTAURANT_VALIDE', source: '' }, etapes: [] });
  const c = calculerComposant(e, id);
  assert.equal(c.quantiteTravail, 7.5);
  assert.equal(c.formule, '5 portions × 1,5 pièce = 8 pièces à prévoir (aucune étape de perte ou de gain)');
});

test('chercherBase : proposition explicite, normalisée, jamais de remplissage', () => {
  assert.equal(chercherBase, chercherBaseDirect);
  const r = chercherBase('POMMES DE TERRE');
  assert.ok(r.length >= 1);
  assert.ok(r.every((l) => l.produit.toLowerCase().includes('pommes de terre')));
  assert.ok(chercherBase('echalote').some((l) => l.produit === 'Échalotes'), 'sans accent');
  assert.ok(chercherBase('riz', 'cuisson').every((l) => l.etape === 'cuisson'));
  assert.equal(chercherBase('riz', 'parage').length, 0);
  assert.deepEqual(chercherBase('', 'parage'), []);
  assert.deepEqual(chercherBase('introuvable_test'), []);
  const e = etatVide();
  const avant = JSON.stringify(e);
  chercherBase('riz');
  assert.equal(JSON.stringify(e), avant);
});

test('une prévision modifiée ne change que le calcul, jamais la structure', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const a = calculerComposant(e, id).quantiteTravail;
  definirPrevision(e, S.lundi, 1, 20, h());
  assert.equal(calculerComposant(e, id).quantiteTravail, a * 2);
});
