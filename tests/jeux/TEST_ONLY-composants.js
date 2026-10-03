// JEU DE TEST — TEST_ONLY. Noms neutres et nombres arbitraires choisis pour vérifier l'arithmétique.
// AUCUNE de ces valeurs n'est un grammage ou un coefficient de référence ; aucune ne doit devenir une valeur par défaut.
// Ne jamais importer ce fichier depuis app/ ni dans des données réelles.

const SAISIE = 'RESTAURANT_VALIDE';
const SOURCE = 'TEST_ONLY';

export const JEU_COMPOSANTS = Object.freeze({
  etiquette: 'TEST_ONLY',
  PRODUIT_SEC_TEST: {
    nom: 'PRODUIT_SEC_TEST', type: 'produit_simple', categorie: 'feculent', role: 'garniture', charge: 'courte',
    grammage: { valeur: 100, unite: 'g', statut: SAISIE, source: SOURCE },
    etapes: [{ etape: 'cuisson', coefficient: 2, statut: SAISIE, source: SOURCE }],
  },
  PRODUIT_CRU_TEST: {
    nom: 'PRODUIT_CRU_TEST', type: 'produit_simple', categorie: 'proteine', role: 'plat_principal', charge: 'moyenne',
    grammage: { valeur: 200, unite: 'g', statut: SAISIE, source: SOURCE },
    etapes: [
      { etape: 'portionnement', coefficient: 0.9, statut: SAISIE, source: SOURCE },
      { etape: 'cuisson', coefficient: 0.8, statut: SAISIE, source: SOURCE },
      { etape: 'parage', coefficient: 0.5, statut: SAISIE, source: SOURCE },
    ],
  },
  PREPARATION_TEST: {
    nom: 'PREPARATION_TEST', type: 'preparation_maison', categorie: 'sauce', role: 'sauce', charge: 'longue',
    grammage: { valeur: 50, unite: 'ml', statut: SAISIE, source: SOURCE },
    etapes: [],
  },
  COMPOSANT_VAGUE_TEST: {
    nom: 'COMPOSANT_VAGUE_TEST', type: 'generique', categorie: 'autre', role: null, charge: null,
    grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' },
    etapes: [],
  },
  RECETTE_TEST: {
    nom: 'RECETTE_TEST',
    rendement: { valeur: 1000, unite: 'ml' },
    ingredients: [
      { nom: 'INGREDIENT_A_TEST', quantite: 500, unite: 'ml' },
      { nom: 'INGREDIENT_B_TEST', quantite: 100, unite: 'g' },
    ],
  },
});
