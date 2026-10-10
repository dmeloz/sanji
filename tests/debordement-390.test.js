// Pas de débordement horizontal à 390 px (v108) : le CSS donne `min-width: 0` aux blocs de texte des lignes de la carte
// Services, de « Préparer la semaine » et de la feuille de diagnostic, et garde les boutons entiers. Lecture du CSS seulement :
// la mise en page réelle se vérifie à l'écran.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brut = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const css = brut.replace(/\/\*[\s\S]*?\*\//g, '');
/** Déclarations de la dernière règle dont le sélecteur est exactement `selecteur` (ou en fait partie). */
const regles = (selecteur) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter((m) => m[1].split(',').map((x) => x.trim()).includes(selecteur)).map((m) => m[2]).join(' ');

for (const s of ['.sem-menu', '.sem-fiche', '.sa-couverts-texte', '.sem-intitule', '.prep-jour', '.prep-ligne', '.prep-ligne-texte', '.prep-saisie', '.prep-champ']) {
  test(`${s} : min-width: 0 (le texte ne pousse pas la page)`, () => assert.match(regles(s), /min-width:\s*0/));
}
test('carte Services : colonne unique minmax(0, 1fr), sinon la grille s\'élargit avec son contenu', () => {
  assert.match(regles('.sem-carte'), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
test('boutons « Saisir » et « OK » : jamais rétrécis (flex: none) ; la ligne couverts peut passer à la ligne', () => {
  assert.match(regles('.sa-couverts .btn'), /flex:\s*none/);
  assert.match(regles('.prep-saisie .btn'), /flex:\s*none/);
  assert.match(regles('.sa-couverts'), /flex-wrap:\s*wrap/);
  assert.match(regles('.actions'), /flex-wrap:\s*wrap/);
});
test('rien de nouveau en hex ni sous 15 px dans les blocs de la v108', () => {
  const bloc = brut.slice(brut.indexOf('/* Préparer la semaine (v108)'));
  assert.doesNotMatch(bloc, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(bloc, /font-size:\s*(\d|1[0-4])px/);
});
