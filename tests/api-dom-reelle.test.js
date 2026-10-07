// L'application tourne dans un vrai navigateur : elle ne doit jamais lire une propriété propre au faux DOM des tests
// (tests/aide-dom.js : `enfants`, `tous`, `declencher`). Les tests sous faux DOM ne voient pas cette erreur, un vrai navigateur la lève.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const racine = new URL('../app/js/', import.meta.url).pathname;
const fichiers = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  return statSync(chemin).isDirectory() ? fichiers(chemin) : chemin.endsWith('.js') ? [chemin] : [];
});

test('app/js : aucun usage des propriétés propres au faux DOM (.enfants, .tous(, .declencher()', () => {
  const fautifs = [];
  for (const f of fichiers(racine)) {
    const lignes = readFileSync(f, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // commentaires
      if (/\.enfants\b|\.tous\(|\.declencher\(/.test(l.replace(/\.\.\.enfants/g, ''))) fautifs.push(`${f.slice(racine.length)}:${i + 1}`);
    });
  }
  assert.deepEqual(fautifs, []);
});
