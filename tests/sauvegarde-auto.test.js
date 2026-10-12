// Copie de sécurité automatique : logique pure avec un faux magasin (l'IndexedDB réel se vérifie dans un navigateur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLE_ETAT_COURANT, CLE_AVANT_RESTAURATION, PREFIXE_COPIE, COPIES_CONSERVEES, copieDuJour, listerCopies, lireCopie, garderAvantRestauration, lireAvantRestauration } from '../app/js/sauvegarde-auto.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';

function fauxMagasin({ echec = false } = {}) {
  const donnees = new Map([[CLE_ETAT_COURANT, { principal: true }]]);
  return {
    donnees,
    lister: async () => [...donnees.keys()],
    lire: async (cle) => donnees.get(cle) ?? null,
    ecrire: async (cle, valeur) => { if (echec) throw new Error('quota'); donnees.set(cle, valeur); },
    supprimer: async (cle) => { donnees.delete(cle); },
  };
}
const jour = (n) => `2026-10-${String(n).padStart(2, '0')}`;
const texte = (marque = 'a') => exporter({ ...etatInitial(), marque }, `${jour(1)}T10:00:00`);

test('au plus une copie par jour calendaire', async () => {
  const m = fauxMagasin();
  assert.equal(await copieDuJour(texte(), jour(1), m), true);
  assert.equal(await copieDuJour(texte('b'), jour(1), m), false);
  assert.deepEqual(await listerCopies(m), [jour(1)]);
  assert.equal(await lireCopie(jour(1), m), texte(), 'la première copie du jour est gardée');
});

test('la 8e copie retire la plus ancienne', async () => {
  const m = fauxMagasin();
  for (let n = 1; n <= COPIES_CONSERVEES + 1; n++) await copieDuJour(texte(), jour(n), m);
  const dates = await listerCopies(m);
  assert.equal(dates.length, COPIES_CONSERVEES);
  assert.equal(dates[0], jour(COPIES_CONSERVEES + 1), 'les plus récentes d\'abord');
  assert.ok(!dates.includes(jour(1)));
});

test('un échec d\'écriture est ignoré et ne touche pas à l\'état courant', async () => {
  const m = fauxMagasin({ echec: true });
  assert.equal(await copieDuJour(texte(), jour(1), m), false);
  assert.deepEqual(m.donnees.get(CLE_ETAT_COURANT), { principal: true });
});

test('la logique de copie n\'écrase ni ne supprime jamais l\'état courant', async () => {
  const m = fauxMagasin();
  for (let n = 1; n <= 12; n++) await copieDuJour(texte(), jour(n), m);
  assert.deepEqual(m.donnees.get(CLE_ETAT_COURANT), { principal: true });
  assert.ok([...m.donnees.keys()].filter((c) => c !== CLE_ETAT_COURANT).every((c) => c.startsWith(PREFIXE_COPIE)));
});

test('listerCopies ignore l\'état courant et les clés étrangères', async () => {
  const m = fauxMagasin();
  m.donnees.set('autre', 1);
  m.donnees.set(`${PREFIXE_COPIE}pas-une-date`, 'x');
  await copieDuJour(texte(), jour(3), m);
  assert.deepEqual(await listerCopies(m), [jour(3)]);
});

test('la copie restaure exactement l\'état', async () => {
  const m = fauxMagasin();
  const t = texte('exact');
  await copieDuJour(t, jour(2), m);
  assert.deepEqual(importer(await lireCopie(jour(2), m), jour(2)), importer(t, jour(2)));
});

test('lireCopie : copie absente ou corrompue = erreur claire, rien ne casse', async () => {
  const m = fauxMagasin();
  await assert.rejects(() => lireCopie(jour(5), m), /introuvable/);
  m.donnees.set(`${PREFIXE_COPIE}${jour(6)}`, '{pas du json');
  const brut = await lireCopie(jour(6), m);
  assert.throws(() => importer(brut, jour(6)), /illisible/);
});

test('clés voisines d\'une copie : ignorées par listerCopies et jamais supprimées', async () => {
  const m = fauxMagasin();
  const voisines = [`${PREFIXE_COPIE}2026-10-01x`, 'xcopie|2026-10-01', `${PREFIXE_COPIE}2026-1-1`, CLE_AVANT_RESTAURATION];
  for (const c of voisines) m.donnees.set(c, 'v');
  for (let n = 1; n <= COPIES_CONSERVEES + 3; n++) await copieDuJour(texte(), jour(n), m);
  assert.equal((await listerCopies(m)).length, COPIES_CONSERVEES);
  for (const c of voisines) assert.equal(m.donnees.get(c), 'v', `${c} intacte`);
});

test('« avant-restauration » : une seule clé, remplacée, hors des 7 copies', async () => {
  const m = fauxMagasin();
  await garderAvantRestauration('premier', m);
  await garderAvantRestauration('second', m);
  assert.equal(await lireAvantRestauration(m), 'second');
  assert.deepEqual(await listerCopies(m), []);
  assert.equal([...m.donnees.keys()].filter((c) => c.includes('avant')).length, 1);
  for (let n = 1; n <= COPIES_CONSERVEES + 2; n++) await copieDuJour(texte(), jour(n), m);
  assert.equal(await lireAvantRestauration(m), 'second', 'le nettoyage ne la supprime pas');
  assert.equal(await lireAvantRestauration(fauxMagasin()), null);
});

test('écriture d\'« avant-restauration » échouée : erreur claire, restauration annulée', async () => {
  const m = fauxMagasin({ echec: true });
  await assert.rejects(() => garderAvantRestauration(texte(), m), /Impossible de garder l'état actuel, restauration annulée/);
  assert.equal(await lireAvantRestauration(m), null);
});

test('restaurer « avant-restauration » ramène l\'état d\'avant', async () => {
  const m = fauxMagasin();
  const avant = texte('avant');
  await garderAvantRestauration(avant, m);
  assert.deepEqual(importer(await lireAvantRestauration(m), jour(2)), importer(avant, jour(2)));
});

// --- magasin.js : déclenchement de la copie (IndexedDB factice global ; stockage.js garde sa connexion, d'où une base partagée) ---
let donneesCourantes = new Map();
const faussesTransaction = (nom) => {
  const tx = {};
  const m = nom === 'etat' ? donneesCourantes : new Map();
  const fin = () => setTimeout(() => tx.oncomplete?.(), 0);
  tx.objectStore = () => ({
    get: (k) => { fin(); return { result: m.get(k) }; },
    put: (v, k) => { m.set(k, v); fin(); return {}; },
    getAllKeys: () => { fin(); return { result: [...m.keys()] }; },
    delete: (k) => { m.delete(k); fin(); return {}; },
  });
  return tx;
};
const fauxIndexedDB = { open() { const r = { result: { objectStoreNames: { contains: () => true }, transaction: faussesTransaction } }; setTimeout(() => r.onsuccess?.(), 0); return r; } };
const attendre = () => new Promise((r) => setTimeout(r, 40));
const copies = () => [...donneesCourantes.keys()].filter((c) => c.startsWith(PREFIXE_COPIE));
async function avecBase(contenuPrincipal, avecIndexedDB, cas, fonction) {
  donneesCourantes = new Map([[CLE_ETAT_COURANT, contenuPrincipal]]);
  if (avecIndexedDB) globalThis.indexedDB = fauxIndexedDB;
  try { await fonction(await import(`../app/js/magasin.js?cas=${cas}`)); } finally { delete globalThis.indexedDB; }
}

test('magasin : une copie à l\'ouverture, une seule tentative par jour et par session', () => avecBase(etatInitial(), true, 'jour', async (magasin) => {
  await magasin.charger();
  await attendre();
  assert.equal(copies().length, 1);
  donneesCourantes.delete(copies()[0]);
  magasin.agir((e) => { e.marque = 'x'; });
  await attendre();
  assert.deepEqual(copies(), [], 'pas de seconde tentative le même jour');
}));

test('magasin : pas de copie si l\'état est illisible', () => avecBase({ ...etatInitial(), schema: 999 }, true, 'illisible', async (magasin) => {
  await magasin.charger();
  assert.equal(magasin.statutStockage().illisible, true);
  magasin.agir((e) => { e.marque = 'x'; });
  await attendre();
  assert.deepEqual(copies(), []);
}));

test('magasin : pas de copie si le stockage n\'est pas utilisable', () => avecBase(etatInitial(), false, 'inutilisable', async (magasin) => {
  await magasin.charger();
  assert.equal(magasin.statutStockage().utilisable, false);
  magasin.agir((e) => { e.marque = 'x'; });
  await attendre();
  assert.deepEqual(copies(), []);
}));
