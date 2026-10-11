import test from 'node:test';
import assert from 'node:assert/strict';
import { modifierComposant } from '../app/js/domaine/actions.js';
import { besoinsProduits } from '../app/js/domaine/produits.js';
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
test('besoinsProduits : une valeur inconnue reste « à valider »', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'INCONNU' }] });
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  assert.deepEqual([ligne.aValider, ligne.standardBase], [true, false]);
});

test('besoinsProduits : un standard de base donne une ligne calculée, marquée « standard de base »', () => {
  const e = monde();
  composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'STANDARD_BASE' }] });
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  assert.deepEqual([ligne.aValider, ligne.standardBase], [false, true]);
});

test('semaine à cheval sur deux mois : besoins par semaine', () => {
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
});
