import test from 'node:test';
import assert from 'node:assert/strict';
import * as st from '../app/js/domaine/statuts.js';

test('énumérations fermées conformes à la conception', () => {
  assert.deepEqual(Object.values(st.PROVENANCE), ['RESTAURANT_VALIDE', 'BASE_METIER_ESTIMATION', 'SAISI_SERVICE', 'CALCULE', 'INCONNU']);
  assert.deepEqual(Object.values(st.CERTITUDE), ['estimee', 'provisoire', 'confirmee']);
  assert.deepEqual(Object.values(st.ETAT_TACHE), ['a_preciser', 'a_planifier', 'a_faire', 'en_cours', 'fait', 'ecart']);
  assert.deepEqual(Object.values(st.CRENEAU), ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.deepEqual(Object.values(st.ETAT_CRENEAU), ['libre', 'charge', 'indisponible']);
  assert.deepEqual(Object.values(st.CHARGE), ['courte', 'moyenne', 'longue']);
  assert.deepEqual(Object.values(st.TYPE_COMPOSANT), ['produit_simple', 'preparation_maison', 'generique', 'a_preciser']);
  assert.deepEqual(Object.values(st.CATEGORIE), ['legume', 'feculent', 'proteine', 'sauce', 'autre', 'a_preciser']);
  assert.deepEqual(Object.values(st.ROLE), ['plat_principal', 'garniture', 'sauce', 'autre', 'composant_recette', 'herbe']);
  assert.deepEqual(Object.values(st.ETAPE), ['portionnement', 'cuisson', 'parage']);
  assert.deepEqual(Object.values(st.UNITE), ['g', 'ml', 'piece']);
  assert.deepEqual(Object.values(st.VERIF), ['a_verifier', 'suffisant', 'a_commander']);
  assert.deepEqual(st.POINTS_CHARGE, { courte: 1, moyenne: 2, longue: 3 });
});

test('clé = valeur et énumérations gelées', () => {
  for (const nom of ['PROVENANCE', 'CERTITUDE', 'ETAT_TACHE', 'CRENEAU', 'ETAT_CRENEAU', 'CHARGE']) {
    assert.ok(Object.isFrozen(st[nom]));
    for (const [k, v] of Object.entries(st[nom])) assert.equal(k, v);
  }
});

test('libellés accentués', () => {
  assert.equal(st.libelle('PROVENANCE', 'RESTAURANT_VALIDE'), 'validé restaurant');
  assert.equal(st.libelle('PROVENANCE', 'BASE_METIER_ESTIMATION'), 'estimation base métier');
  assert.equal(st.libelle('PROVENANCE', 'SAISI_SERVICE'), 'saisi au service');
  assert.equal(st.libelle('PROVENANCE', 'CALCULE'), 'calculé');
  assert.equal(st.libelle('PROVENANCE', 'INCONNU'), 'inconnu');
  assert.equal(st.libelle('ETAT_TACHE', 'ecart'), 'écart à arbitrer');
  assert.equal(st.libelle('CRENEAU', 'avant_soir'), 'avant le service du soir');
  assert.equal(st.libelle('VERIF', 'a_reverifier'), 'à revérifier');
  assert.equal(st.libelle('ETAT_TACHE', 'inconnu_du_vocabulaire'), 'inconnu_du_vocabulaire');
  assert.equal(st.LIBELLE_ESTIMATION_A_VALIDER, 'estimation à valider');
});
