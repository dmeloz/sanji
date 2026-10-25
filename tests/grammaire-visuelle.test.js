// Garde-fous partagés de la grammaire visuelle Sanji (refonte 3, lot 1).
// Les textes d'interface gardent au moins 15 px; les couleurs et gestes existants restent la référence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const valeurPixel = (nom) => Number(css.match(new RegExp(`${nom}:\\s*(\\d+)px`))?.[1]);

test('les petites étiquettes et le texte courant respectent le minimum de 15 px', () => {
  assert.ok(valeurPixel('--t-legende') >= 15, '--t-legende doit rester lisible en cuisine');
  assert.ok(valeurPixel('--t-corps') >= 15, '--t-corps doit rester à 15 px ou plus');
  assert.match(css, /--t-1:\s*var\(--t-corps\)/, 'les styles secondaires reposent sur le corps lisible');
  assert.match(css, /\.etq\s*\{[^}]*font-size:\s*var\(--t-legende\)/, 'les états texte suivent le même minimum');
});

test('les cibles et boutons communs gardent leur taille tactile', () => {
  assert.equal(valeurPixel('--cible'), 44);
  assert.equal(valeurPixel('--haut-bouton'), 48);
  assert.match(css, /\.btn\s*\{[^}]*min-height:\s*var\(--haut-bouton\)/);
});

test('la grammaire commune conserve le thème clair, la palette validée et le mouvement réduit', () => {
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /--fond:\s*#F4EAD5/);
  assert.match(css, /--carte:\s*#FFF9EC/);
  assert.match(css, /--action:\s*#1D5AA6/);
  assert.match(css, /--exception:\s*#8A5E00/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /linear-gradient\s*\(/i);
});
