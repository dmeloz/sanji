// Compositeur de mélanges en parts (reprise de Kōzō) : « 2 parts de carottes, 1 part de courgettes » devient une recette
// maison non validée, proportionnelle ; le chef la valide comme n'importe quelle recette. Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouterComposant, composerMelange, modifierComposant, validerRecette } from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision } from './aide.js';

function composantMelange() {
  const e = etatVide();
  prevision(e, S.lundi, 2, 10);
  const id = ajouterComposant(e, S.lundi, 2, { nom: 'légumes du jour', categorie: 'legume', attribue: true }, h());
  return { e, id };
}

test('mélange : crée une recette en parts, la lie au composant et ne la valide pas', () => {
  const { e, id } = composantMelange();
  assert.equal(e.composants[id].type, 'generique');
  const recetteId = composerMelange(e, id, [{ nom: 'carottes', parts: 2 }, { nom: 'courgettes', parts: 1 }], h());
  const r = e.recettes[recetteId];
  assert.equal(r.valide, false, 'le chef valide');
  assert.deepEqual(r.ingredients.map((i) => [i.nom, i.quantite]), [['carottes', 2], ['courgettes', 1]]);
  assert.deepEqual(r.rendement, { valeur: 3, unite: 'g' });
  assert.equal(e.composants[id].recetteId, recetteId);
  assert.equal(e.composants[id].type, 'preparation_maison');
  assert.ok(e.journal.some((j) => j.action === 'composerMelange'));
});

test('mélange : refus clairs, rien n\'est modifié', () => {
  const { e, id } = composantMelange();
  const avant = structuredClone(e);
  for (const mauvais of [[], [{ nom: 'carottes', parts: 2 }], [{ nom: 'carottes', parts: 0 }, { nom: 'courgettes', parts: 1 }],
    [{ nom: '', parts: 1 }, { nom: 'courgettes', parts: 1 }], [{ nom: 'a', parts: 1 }, { nom: 'b', parts: -2 }]]) {
    assert.throws(() => composerMelange(e, id, mauvais, h()), /mélange|part|nom/i, JSON.stringify(mauvais));
  }
  assert.throws(() => composerMelange(e, 'inconnu', [{ nom: 'a', parts: 1 }, { nom: 'b', parts: 1 }], h()), /introuvable/i);
  assert.deepEqual(e, avant);
});

test('mélange : une fois validée et la portion saisie, les ingrédients sont proportionnels aux parts', () => {
  const { e, id } = composantMelange();
  const recetteId = composerMelange(e, id, [{ nom: 'carottes', parts: 2 }, { nom: 'courgettes', parts: 1 }], h());
  validerRecette(e, recetteId, h());
  modifierComposant(e, id, { grammage: { valeur: 100, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat: 'cuit' } }, h());
  const calc = calculerComposant(e, id);
  assert.equal(calc.statut, 'CALCULE');
  assert.equal(calc.quantiteTravail, 1000);
  const [carottes, courgettes] = calc.ingredients;
  assert.ok(Math.abs(carottes.quantite - 2000 / 3) < 1e-6 && Math.abs(courgettes.quantite - 1000 / 3) < 1e-6);
  assert.equal(carottes.quantite / courgettes.quantite, 2, 'deux parts pour une');
});
