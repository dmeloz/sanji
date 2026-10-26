// Écriture ratée : nouvel essai automatique (3 s, 10 s, 30 s puis 30 s), au retour dans l'app, jamais sur données illisibles.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { CLE_ETAT_COURANT } from '../app/js/sauvegarde-auto.js';
import { etatInitial, exporter } from '../app/js/domaine/etat.js';

let donnees;
let echec;
let ecritures;
let tentatives;
const tx = (nom) => {
  const t = {};
  const m = nom === 'etat' ? donnees : new Map();
  const fin = () => queueMicrotask(() => t.oncomplete?.());
  t.objectStore = () => ({
    get: (k) => { fin(); return { result: m.get(k) }; },
    put: (v, k) => {
      if (k === CLE_ETAT_COURANT) tentatives += 1;
      if (echec && k === CLE_ETAT_COURANT) throw new Error('quota');
      if (k === CLE_ETAT_COURANT) ecritures += 1;
      m.set(k, v); fin(); return {};
    },
    getAllKeys: () => { fin(); return { result: [...m.keys()] }; },
    delete: (k) => { m.delete(k); fin(); return {}; },
  });
  return t;
};
const fauxIDB = { open() { const r = { result: { objectStoreNames: { contains: () => true }, transaction: tx } }; queueMicrotask(() => r.onsuccess?.()); return r; } };
const vider = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

async function ouvrir(cas, brut = null) {
  donnees = new Map(brut === null ? [] : [[CLE_ETAT_COURANT, brut]]);
  echec = false; ecritures = 0; tentatives = 0;
  globalThis.indexedDB = fauxIDB;
  mock.timers.enable({ apis: ['setTimeout'] });
  const magasin = await import(`../app/js/magasin.js?cas=${cas}`);
  await magasin.charger();
  return magasin;
}
const fermer = () => { mock.timers.reset(); delete globalThis.indexedDB; delete globalThis.document; delete globalThis.addEventListener; };
const modifier = (magasin) => magasin.agir((e, h) => { e.reglages.margeSecurite = (e.reglages.margeSecurite ?? 0) + 1; });

test('échec puis succès après 3 s : état enregistré, bandeau levé (redessiner)', async () => {
  const magasin = await ouvrir('essai-ok');
  try {
    let dessins = 0;
    magasin.abonner(() => { dessins += 1; });
    echec = true;
    modifier(magasin); await vider();
    assert.equal(magasin.statutStockage().enregistre, false);
    echec = false;
    mock.timers.tick(2999); await vider();
    assert.equal(magasin.statutStockage().enregistre, false);
    const avant = dessins;
    mock.timers.tick(1); await vider();
    assert.equal(magasin.statutStockage().enregistre, true);
    assert.equal(ecritures, 1);
    assert.ok(dessins > avant, 'redessiné');
    mock.timers.tick(100000); await vider();
    assert.equal(ecritures, 1, 'plus de minuteur');
  } finally { fermer(); }
});

test('échecs répétés : 3 s, 10 s, 30 s, 30 s, un seul minuteur', async () => {
  const magasin = await ouvrir('essai-delais');
  try {
    echec = true;
    modifier(magasin); await vider();
    modifier(magasin); await vider(); // une seconde écriture ratée ne double pas le minuteur
    assert.equal(tentatives, 2);
    let attendu = 2;
    for (const delai of [3000, 10000, 30000, 30000]) {
      mock.timers.tick(delai - 1); await vider();
      assert.equal(tentatives, attendu, `pas d'essai avant ${delai} ms`);
      mock.timers.tick(1); await vider();
      attendu += 1;
      assert.equal(tentatives, attendu, `un seul essai à ${delai} ms`);
    }
    echec = false;
    mock.timers.tick(30000); await vider();
    assert.equal(magasin.statutStockage().enregistre, true);
    assert.equal(ecritures, 1);
  } finally { fermer(); }
});

test('succès : le délai repart de 3 s', async () => {
  const magasin = await ouvrir('essai-reset');
  try {
    echec = true;
    modifier(magasin); await vider();
    mock.timers.tick(3000); await vider(); // 2e échec, prochain délai 10 s
    echec = false;
    modifier(magasin); await vider(); // succès par action : minuteur annulé
    assert.equal(magasin.statutStockage().enregistre, true);
    const n = ecritures;
    mock.timers.tick(60000); await vider();
    assert.equal(ecritures, n, 'minuteur annulé');
    echec = true;
    modifier(magasin); await vider();
    echec = false;
    mock.timers.tick(3000); await vider();
    assert.equal(magasin.statutStockage().enregistre, true, 'délai de nouveau 3 s');
  } finally { fermer(); }
});

test('retour visible ou pageshow : nouvel essai immédiat si la dernière écriture a échoué', async () => {
  const ecouteurs = {};
  globalThis.addEventListener = (n, f) => { ecouteurs[n] = f; };
  globalThis.document = { visibilityState: 'visible', addEventListener: (n, f) => { ecouteurs[n] = f; } };
  const magasin = await ouvrir('essai-visible');
  try {
    assert.equal(typeof ecouteurs.visibilitychange, 'function');
    echec = true;
    modifier(magasin); await vider();
    echec = false;
    ecouteurs.visibilitychange(); await vider();
    assert.equal(magasin.statutStockage().enregistre, true);
    assert.equal(ecritures, 1);
    assert.equal(typeof ecouteurs.pageshow, 'function');
    ecouteurs.pageshow(); await vider();
    assert.equal(ecritures, 1, 'rien à retenter quand tout est enregistré');
  } finally { fermer(); }
});

test('données illisibles : aucun essai programmé', async () => {
  const magasin = await ouvrir('essai-illisible', { composants: 5 });
  try {
    assert.equal(magasin.statutStockage().illisible, true);
    modifier(magasin); await vider();
    mock.timers.tick(100000); await vider();
    assert.equal(ecritures, 0);
    assert.equal(magasin.statutStockage().enregistre, false);
  } finally { fermer(); }
});
