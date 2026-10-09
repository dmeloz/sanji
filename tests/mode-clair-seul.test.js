// v100 : le mode sombre est désactivé (décision de la propriétaire, 2026-10-07). L'application reste en clair, quel que soit le réglage de l'appareil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (chemin) => readFileSync(new URL(`../app/${chemin}`, import.meta.url), 'utf8');

test('le CSS ne suit plus le réglage sombre de l\'appareil et déclare le thème clair', () => {
  const css = lire('css/style.css');
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /:root \{\s*color-scheme: light;/);
});

test('la page n\'annonce que le thème clair (color-scheme et theme-color)', () => {
  const html = lire('index.html');
  assert.match(html, /<meta name="color-scheme" content="light">/);
  assert.doesNotMatch(html, /prefers-color-scheme:\s*dark/);
});
