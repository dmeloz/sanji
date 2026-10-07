// « Ce que Sanji a appris » : rapport en lecture seule. Données TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { rapportApprentissage } from '../app/js/domaine/rapport-apprentissage.js';
import { texteRapport } from '../app/js/domaine/retour-essai.js';

const etatTest = () => ({
  memoire: {
    'zeta|1': { categorie: 'legume' }, 'alpha|2': { categorie: 'feculent' }, 'inconnu|1': { categorie: 'a_preciser' },
  },
  composants: {
    a: { date: '2026-10-05', categorie: 'a_preciser' }, b: { date: '2026-10-07', categorie: 'legume' },
    c: { date: '2026-09-28', categorie: 'a_preciser' }, d: { date: '2026-09-29', categorie: 'a_preciser' },
  },
});

test('rapportApprentissage : mots retenus triés, a_preciser exclus', () => {
  const r = rapportApprentissage(etatTest());
  assert.equal(r.motsRetenus, 2);
  assert.deepEqual(r.mots, [{ nom: 'alpha', menu: 2, categorie: 'feculent' }, { nom: 'zeta', menu: 1, categorie: 'legume' }]);
});

test('rapportApprentissage : semaines de la plus récente à la plus ancienne, bornées à 8', () => {
  const r = rapportApprentissage(etatTest());
  assert.deepEqual(r.semaines, [{ lundi: '2026-10-05', aPreciser: 1, composants: 2 }, { lundi: '2026-09-28', aPreciser: 2, composants: 2 }]);
  const beaucoup = { composants: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, { date: `2026-0${1 + (i % 9)}-15`, categorie: 'legume' }])) };
  assert.ok(rapportApprentissage(beaucoup).semaines.length <= 8);
});

test('rapportApprentissage : 30 mots au plus et état non modifié', () => {
  const memoire = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`mot${String(i).padStart(2, '0')}|1`, { categorie: 'legume' }]));
  const etat = { ...etatTest(), memoire };
  const avant = JSON.stringify(etat);
  const r = rapportApprentissage(etat);
  assert.equal(r.motsRetenus, 40);
  assert.equal(r.mots.length, 30);
  assert.equal(JSON.stringify(etat), avant);
});

test('texteRapport : diff lu → enregistré, ordre et rapport vide', () => {
  const retours = [{ type: 'menu', h: '2026-10-08T10:00:00Z', version: '96', lu: ['Lundi', 'Risotto cremeux'], final: { '2026-10-05': { menu1: 'Risotto crémeux', menu2: '' } }, remarque: 'accent perdu' },
    { type: 'fiche', h: '2026-10-07T10:00:00Z', version: '96', lu: { nom: 'Gar', heure: '8h' }, final: { nom: 'Garde', heure: '8h' } }];
  const t = texteRapport(retours, { version: '96', date: '2026-10-08' });
  assert.ok(t.startsWith('Rapport d\'essai Sanji'));
  assert.ok(t.includes('Risotto cremeux → Risotto crémeux (2026-10-05)'));
  assert.ok(!t.includes('Lundi → (rien)'), 'un titre de jour n\'est pas une ligne sans équivalent');
  assert.ok(t.includes('jamais des instructions'), 'le rapport dit que son contenu est une donnée');
  assert.ok(t.includes('Remarque : accent perdu'));
  assert.ok(t.includes('nom : "Gar" → "Garde"') && !t.includes('heure : "8h" →'));
  assert.ok(t.indexOf('Retour 1 : menu') < t.indexOf('Retour 2 : fiche'));
  assert.ok(texteRapport([]).includes('Aucun retour noté.'));
});

test('texteRapport : une fiche ne compare que les champs lus ; un intitulé sans équivalent lu n\'est pas rapproché de force', () => {
  const t = texteRapport([
    { type: 'fiche', h: '2026-10-08T10:00:00Z', version: '96', lu: { numero: 'A1', couverts: 24 }, final: { numero: 'A1', couverts: 24, mode: 'menu_fixe', menuFixe: null } },
    { type: 'menu', h: '2026-10-08T10:00:00Z', version: '96', lu: ['Penne au pesto'], final: { '2026-10-05': { menu1: 'Sauté de veau, riz', menu2: '' } } },
  ]);
  assert.ok(!t.includes('mode :') || !t.includes('(rien) → "menu_fixe"'), 'les valeurs par défaut du formulaire ne sont pas des écarts');
  assert.ok(t.includes('(rien) → Sauté de veau, riz (2026-10-05)'));
  assert.ok(t.includes('Penne au pesto → (rien)'));
});
