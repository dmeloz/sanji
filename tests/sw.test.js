// Le service worker met en cache exactement les fichiers de app/ (hors sw.js) ; sa version suit celle de l'application.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const APP = join(RACINE, 'app');
const SW = readFileSync(join(APP, 'sw.js'), 'utf8');

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

/** Fichiers présents sous app/, chemins relatifs avec « / », hors sw.js et hors fichiers cachés (.DS_Store…). */
const presents = fichiers(APP)
  .map((f) => relative(APP, f).split(sep).join('/'))
  .filter((f) => f !== 'sw.js' && !f.split('/').some((p) => p.startsWith('.')))
  .sort();

function listeFichiers() {
  const m = /const FICHIERS = \[([\s\S]*?)\];/.exec(SW);
  assert.ok(m, 'sw.js doit contenir « const FICHIERS = [ … ] »');
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

test('FICHIERS contient exactement tous les fichiers de app/ (sauf sw.js), sans doublon', () => {
  const liste = listeFichiers();
  assert.equal(new Set(liste).size, liste.length, 'doublon dans FICHIERS');
  assert.deepEqual([...liste].sort(), presents);
});

test('FICHIERS ne contient ni sw.js ni chemin absolu ou distant', () => {
  for (const f of listeFichiers()) {
    assert.notEqual(f, 'sw.js');
    assert.equal(/^(\/|https?:|\.\.)/.test(f), false, f);
  }
});

test('la version du cache de sw.js égale VERSION_APP (incrémenter les deux ensemble)', async () => {
  const m = /const VERSION = '([^']+)'/.exec(SW);
  assert.ok(m, 'sw.js doit déclarer const VERSION = \'…\'');
  const { VERSION_APP } = await import('../app/js/version.js');
  assert.equal(m[1], VERSION_APP);
  assert.match(SW, /const NOM_CACHE = `sanji-v\$\{VERSION\}`/);
});

test('sw.js : cache d\'abord, repli de navigation sur index.html, nettoyage des anciens caches', () => {
  assert.match(SW, /cache\.match\(requete/);
  assert.match(SW, /mode === 'navigate'/);
  assert.match(SW, /PAGE_ACCUEIL = 'index\.html'/);
  assert.match(SW, /caches\.delete/);
  assert.match(SW, /skipWaiting/);
});
