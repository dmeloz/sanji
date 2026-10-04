import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controlerProduit, definirAchat, definirFournisseur, marquerCommande, modifierComposant, supprimerFournisseur,
} from '../app/js/domaine/actions.js';
import { besoinsProduits, cleSuivi, echeanceCommande, suiviProduit } from '../app/js/domaine/produits.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, recetteValidee } from './aide.js';

const monde = () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  prevision(e, S.mardi, 1, 10);
  return e;
};

test('besoinsProduits : base neuve vide', () => {
  assert.deepEqual(besoinsProduits(etatVide(), S.lundi), { lignes: [], nonChiffrables: [] });
});

test('besoinsProduits : agrégation par produit normalisé et unité, première utilisation', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST); // 2000 g
  composantValide(e, S.mardi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'produit_sec_TEST' }); // 500 g, même produit
  const { lignes } = besoinsProduits(e, S.lundi);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].cle, 'produit_sec_test');
  assert.equal(lignes[0].unite, 'g');
  assert.equal(lignes[0].besoinBrut, 2500);
  assert.equal(lignes[0].premiereUtilisation, S.lundi);
  assert.deepEqual(lignes[0].contributions.map((c) => [c.date, c.quantite]), [[S.lundi, 2000], [S.mardi, 500]]);
  assert.equal(lignes[0].aValider, false);
  // Une autre semaine n'est pas comptée ; la même quantité n'est pas comptée dans une autre unité.
  assert.equal(besoinsProduits(e, S.lundiSuivant).lignes.length, 0);
  composantValide(e, S.mardi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'AUTRE_NOM_TEST', grammage: { valeur: 3, unite: 'piece', statut: 'RESTAURANT_VALIDE', source: '' }, etapes: [] });
  assert.equal(besoinsProduits(e, S.lundi).lignes.length, 2);
});

test('besoinsProduits : produitNom prime ; composants non attribués ou non validés ignorés', () => {
  const e = monde();
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  modifierComposant(e, c, { produitNom: 'PRODUIT_ACHETE_TEST' }, h());
  assert.equal(besoinsProduits(e, S.lundi).lignes[0].cle, 'produit_achete_test');
  modifierComposant(e, c, { attribue: false }, h());
  assert.equal(besoinsProduits(e, S.lundi).lignes.length, 0);
  assert.equal(besoinsProduits(e, S.lundi).nonChiffrables.length, 0);
});

test('besoinsProduits : préparation avec recette validée → ingrédients ; sinon non chiffrable', () => {
  const e = monde();
  const prep = composantValide(e, S.lundi, 1, J.PREPARATION_TEST);
  let r = besoinsProduits(e, S.lundi);
  assert.equal(r.lignes.length, 0);
  assert.match(r.nonChiffrables[0].raison, /sans recette validée/);
  modifierComposant(e, prep, { recetteId: recetteValidee(e, J.RECETTE_TEST) }, h());
  r = besoinsProduits(e, S.lundi);
  assert.deepEqual(r.lignes.map((l) => [l.cle, l.unite, l.besoinBrut]), [['ingredient_a_test', 'ml', 1000], ['ingredient_b_test', 'g', 200]]);
  assert.equal(r.nonChiffrables.length, 0);
});

// Adapté le 2026-10-04 (décision « Standards de base ») : l'intention de sécurité est gardée pour ce qui est inconnu.
test('besoinsProduits : une valeur inconnue reste « à valider », jamais une commande automatique', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'INCONNU' }] });
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  assert.deepEqual([ligne.aValider, ligne.standardBase], [true, false]);
  const s = suiviProduit(e, S.lundi, ligne);
  assert.equal(s.estimationAValider, true);
  assert.equal(s.quantiteAcheter, null);
  assert.equal(s.proposeeACommander, null, 'rien à proposer avant une vérification chiffrée');
  assert.deepEqual([s.quantiteCalculee, s.quantiteCommandable], [null, null], 'aucune quantité calculée commandable');
  assert.equal(s.statutAffiche, 'a_verifier');
});

test('besoinsProduits : un standard de base donne une ligne calculée, marquée « standard de base », majorée de la marge', () => {
  const e = monde();
  e.reglages.margeSecurite = 10;
  composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'STANDARD_BASE' }] });
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  assert.deepEqual([ligne.aValider, ligne.standardBase], [false, true]);
  const s = suiviProduit(e, S.lundi, ligne);
  assert.equal(s.quantiteAcheter, null, 'la quantité achetée n\'est jamais remplie par le calcul');
  assert.equal(s.quantiteCalculee, Math.round(ligne.besoinBrut * 1.1), 'besoin majoré de la marge');
  assert.equal(s.quantiteCommandable, null, 'commandable seulement une fois notée');
  assert.equal(s.standardBase, true);
});

test('suiviProduit : à vérifier, suffisant, à commander, à revérifier ; trois quantités distinctes', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const ligne = () => besoinsProduits(e, S.lundi).lignes[0];
  assert.equal(suiviProduit(e, S.lundi, ligne()).statutAffiche, 'a_verifier');
  assert.throws(() => controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'suffisant', null, h()), /quantité vérifiée/);
  assert.throws(() => controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'suffisant', 1999, h()), /inférieure au besoin/);
  assert.throws(() => controlerProduit(e, S.lundi, 'inconnu_test', 'g', 'a_commander', 5, h()), /pas de besoin/);
  assert.throws(() => controlerProduit(e, S.mardi, 'produit_sec_test', 'g', 'a_commander', 5, h()), /pas un lundi/);
  assert.throws(() => controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'peut-etre', 5, h()), /inconnue/);
  assert.deepEqual(Object.keys(e.produits), [], 'un refus ne laisse aucune trace');
  controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'a_commander', 500, h());
  let s = suiviProduit(e, S.lundi, ligne());
  assert.deepEqual([s.statutAffiche, s.besoinBrut, s.quantiteVerifiee, s.proposeeACommander, s.quantiteAcheter], ['a_commander', 2000, 500, 1500, null]);
  controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'suffisant', 2000, h());
  s = suiviProduit(e, S.lundi, ligne());
  assert.equal(s.statutAffiche, 'suffisant');
  assert.equal(s.proposeeACommander, 0);
  prevision(e, S.lundi, 1, 41); // besoin 2050
  assert.equal(suiviProduit(e, S.lundi, ligne()).statutAffiche, 'a_reverifier');
  prevision(e, S.lundi, 1, 40); // besoin revenu à 2000 : plus de revérification
  assert.equal(suiviProduit(e, S.lundi, ligne()).statutAffiche, 'suffisant');
  controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'a_verifier', null, h());
  assert.equal(suiviProduit(e, S.lundi, ligne()).statutAffiche, 'a_verifier');
});

test('achat et commande : saisie manuelle uniquement', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  const f = definirFournisseur(e, { nom: 'FOURNISSEUR_TEST', delaiJours: 2 }, h());
  assert.throws(() => marquerCommande(e, S.lundi, ligne.cle, ligne.unite, h()), /quantité réellement achetée/);
  definirAchat(e, S.lundi, ligne.cle, ligne.unite, { quantiteAcheter: 2100, conditionnement: 'CONDITIONNEMENT_TEST', fournisseurId: f }, h());
  marquerCommande(e, S.lundi, ligne.cle, ligne.unite, h(3));
  const s = suiviProduit(e, S.lundi, ligne);
  assert.deepEqual([s.quantiteAcheter, s.conditionnement, s.fournisseurId, s.commandeLe], [2100, 'CONDITIONNEMENT_TEST', f, h(3)]);
  assert.throws(() => definirAchat(e, S.lundi, ligne.cle, ligne.unite, { fournisseurId: 'inconnu' }, h()), /introuvable/);
  assert.throws(() => definirAchat(e, S.lundi, ligne.cle, ligne.unite, { quantiteAcheter: -1 }, h()), /positif/);
  assert.ok(Object.hasOwn(e.produits, cleSuivi(S.lundi, ligne.cle, ligne.unite)));
  supprimerFournisseur(e, f, h());
  assert.equal(suiviProduit(e, S.lundi, ligne).fournisseurId, null);
});

test('echeanceCommande : à renseigner, ok, aujourd\'hui, dépassée', () => {
  const ligne = { premiereUtilisation: S.lundi };
  assert.deepEqual(echeanceCommande(ligne, null, S.veille), { statut: 'a_renseigner', dateLimite: null });
  assert.equal(echeanceCommande(ligne, { delaiJours: null }, S.veille).statut, 'a_renseigner');
  assert.deepEqual(echeanceCommande(ligne, { delaiJours: 0 }, S.dimanchePrecedent), { statut: 'ok', dateLimite: S.lundi });
  assert.equal(echeanceCommande(ligne, { delaiJours: 0 }, S.lundi).statut, 'aujourdhui');
  assert.equal(echeanceCommande(ligne, { delaiJours: 0 }, S.mardi).statut, 'depassee');
  // Le dimanche compte dans le délai fournisseur (jours calendaires).
  assert.equal(echeanceCommande(ligne, { delaiJours: 2 }, S.dimanchePrecedent).dateLimite, S.samediPrecedent);
  assert.equal(echeanceCommande(ligne, { delaiJours: 2 }, S.dimanchePrecedent).statut, 'depassee');
});

test('semaine à cheval sur deux mois : besoins, contrôle et échéance', () => {
  const e = etatVide();
  prevision(e, S.lundiChevauchement, 1, 10);
  prevision(e, '2026-10-01', 1, 10);
  composantValide(e, S.lundiChevauchement, 1, J.PRODUIT_SEC_TEST);
  composantValide(e, '2026-10-01', 1, J.PRODUIT_SEC_TEST);
  const { lignes } = besoinsProduits(e, S.lundiChevauchement);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].besoinBrut, 1000);
  assert.deepEqual(lignes[0].contributions.map((c) => c.date), ['2026-09-28', '2026-10-01']);
  assert.equal(besoinsProduits(e, S.lundi).lignes.length, 0);
  assert.equal(echeanceCommande(lignes[0], { delaiJours: 1 }, '2026-09-27').dateLimite, '2026-09-27');
  controlerProduit(e, S.lundiChevauchement, lignes[0].cle, 'g', 'suffisant', 1000, h());
  assert.equal(suiviProduit(e, S.lundiChevauchement, lignes[0]).statutAffiche, 'suffisant');
});
