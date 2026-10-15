// Une perte à l'import n'est jamais silencieuse : bilan des écartés, copie brute gardée, message, plafond de portion cohérent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLE_ETAT_COURANT, CLE_AVANT_IMPORT_ECARTE, PREFIXE_COPIE, garderAvantImportEcarte } from '../app/js/sauvegarde-auto.js';
import { importerAvecBilan, importer } from '../app/js/domaine/etat.js';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { definirPortionFiche } from '../app/js/domaine/actions-fiches.js';
import { etatVide, h } from './aide.js';

const AUJOURD = '2026-10-12';
const peuple = () => JSON.parse(readFileSync(new URL('./jeux/TEST_ONLY-etat-peuple.json', import.meta.url), 'utf8'));
const premier = (o) => Object.keys(o)[0];

test('importerAvecBilan : un composant abîmé est écarté et compté, un état sain compte 0', () => {
  const sain = importerAvecBilan(JSON.stringify(peuple()), AUJOURD);
  assert.equal(sain.ecartes, 0);
  const d = peuple();
  d.etat.composants[premier(d.etat.composants)].date = 'x';
  const r = importerAvecBilan(JSON.stringify(d), AUJOURD);
  assert.equal(r.ecartes, 1);
  assert.deepEqual(r.etat, importer(JSON.stringify(d), AUJOURD));
});

test('M1 : une anomalie scalaire est corrigée, l\'entrée est gardée', () => {
  const d = peuple();
  const idJour = premier(d.etat.jours);
  d.etat.jours[idJour].menus[1].intitule = null;
  d.etat.jours[idJour].menus[2].intitule = 42;
  const idComp = premier(d.etat.composants);
  d.etat.composants[idComp].produitNom = 7;
  const r = importerAvecBilan(JSON.stringify(d), AUJOURD);
  assert.equal(r.ecartes, 0);
  assert.equal(r.etat.jours[idJour].menus[1].intitule, '');
  assert.equal(r.etat.jours[idJour].menus[2].intitule, '42');
  assert.equal(r.etat.composants[idComp].produitNom, '7');
});

test('M1 : id différent de la clé et date illisible restent rejetés', () => {
  const d = peuple();
  d.etat.composants[premier(d.etat.composants)].id = 'autre';
  d.etat.jours[premier(d.etat.jours)].date = 'x';
  assert.equal(importerAvecBilan(JSON.stringify(d), AUJOURD).ecartes, 2);
});

test('garderAvantImportEcarte garde la PREMIÈRE copie tant qu\'elle existe', async () => {
  const donnees = new Map();
  const m = { lire: async (c) => donnees.get(c) ?? null, ecrire: async (c, v) => { donnees.set(c, v); } };
  assert.equal(await garderAvantImportEcarte('un', m), true);
  assert.equal(await garderAvantImportEcarte('deux', m), false);
  assert.equal(donnees.get(CLE_AVANT_IMPORT_ECARTE), 'un');
});

// --- magasin.charger avec une IndexedDB factice ---
let donnees = new Map();
let echecEcritureSecurite = false;
const tx = (nom) => {
  const t = {};
  const m = nom === 'etat' ? donnees : new Map();
  const fin = () => setTimeout(() => t.oncomplete?.(), 0);
  t.objectStore = () => ({
    get: (k) => { fin(); return { result: m.get(k) }; },
    put: (v, k) => { if (echecEcritureSecurite && k === CLE_AVANT_IMPORT_ECARTE) throw new Error('quota'); m.set(k, v); fin(); return {}; },
    getAllKeys: () => { fin(); return { result: [...m.keys()] }; },
    delete: (k) => { m.delete(k); fin(); return {}; },
  });
  return t;
};
const fauxIDB = { open() { const r = { result: { objectStoreNames: { contains: () => true }, transaction: tx }, }; setTimeout(() => r.onsuccess?.(), 0); return r; } };
const attendre = () => new Promise((r) => setTimeout(r, 40));
async function ouvrir(brut, cas) {
  donnees = new Map(brut === null ? [] : [[CLE_ETAT_COURANT, brut]]);
  globalThis.indexedDB = fauxIDB;
  const magasin = await import(`../app/js/magasin.js?cas=${cas}`);
  const messages = [];
  magasin.surMessage((t, type) => messages.push({ t, type }));
  return { magasin, messages };
}
const brutAbime = () => { const d = peuple(); d.etat.composants[premier(d.etat.composants)].date = 'x'; return d.etat; };
const brutSain = () => peuple().etat;

test('charger : entrée écartée = copie brute gardée avant tout enregistrement + message', async () => {
  const brut = brutAbime();
  const { magasin, messages } = await ouvrir(brut, 'abime');
  try {
    await magasin.charger();
    await attendre();
    const copie = donnees.get(CLE_AVANT_IMPORT_ECARTE);
    assert.equal(typeof copie, 'string');
    assert.equal(JSON.parse(copie).etat.composants[premier(brut.composants)].date, 'x', 'contenu brut');
    assert.equal(messages.length, 1);
    assert.match(messages[0].t, /1 élément\(s\) abîmé\(s\) n'ont pas pu être relus et ont été écartés\. Une copie de l'état d'origine est gardée dans Réglages > Données\./);
    assert.ok(![...donnees.keys()].some((k) => k.startsWith(PREFIXE_COPIE) && k === CLE_AVANT_IMPORT_ECARTE));
  } finally { delete globalThis.indexedDB; }
});

test('charger : seconde ouverture identique = pas de nouveau message, première copie gardée', async () => {
  const brut = brutAbime();
  const a = await ouvrir(brut, 'abime-a');
  try {
    await a.magasin.charger();
    const premiere = donnees.get(CLE_AVANT_IMPORT_ECARTE);
    const b = await import('../app/js/magasin.js?cas=abime-b');
    const messages = [];
    b.surMessage((t) => messages.push(t));
    donnees.set(CLE_ETAT_COURANT, { ...brut, marque: 'autre' });
    await b.charger();
    assert.equal(messages.length, 0);
    assert.equal(donnees.get(CLE_AVANT_IMPORT_ECARTE), premiere);
  } finally { delete globalThis.indexedDB; }
});

test('charger : un état sain n\'écrit aucune copie ni message', async () => {
  const { magasin, messages } = await ouvrir(brutSain(), 'sain');
  try {
    await magasin.charger();
    assert.equal(donnees.has(CLE_AVANT_IMPORT_ECARTE), false);
    assert.equal(messages.length, 0);
  } finally { delete globalThis.indexedDB; }
});

test('charger : écriture de la copie impossible = signalé quand même, rien d\'écrasé', async () => {
  echecEcritureSecurite = true;
  const { magasin, messages } = await ouvrir(brutAbime(), 'echec');
  try {
    await magasin.charger();
    assert.equal(messages.length, 1);
    assert.match(messages[0].t, /écartés/);
    assert.equal(donnees.has(CLE_AVANT_IMPORT_ECARTE), false);
  } finally { echecEcritureSecurite = false; delete globalThis.indexedDB; }
});

// --- M2 : plafond de portion ---
test('M2 : modifierComposant et definirPortionFiche refusent plus de 2000 g, acceptent 2000 g', () => {
  const e = etatVide();
  definirMenu(e, '2026-10-13', 1, 'Risotto aux bolets', h());
  const c = Object.values(e.composants).find((x) => x.nom === 'Risotto');
  const grammage = (valeur, unite = 'g') => ({ valeur, unite, statut: 'RESTAURANT_VALIDE', source: '', etat: 'sec' });
  assert.throws(() => modifierComposant(e, c.id, { grammage: grammage(2001) }, h(1)), /Portion trop grande : au plus 2000 g par portion\./);
  modifierComposant(e, c.id, { grammage: grammage(2000) }, h(2));
  modifierComposant(e, c.id, { grammage: grammage(5000, 'ml') }, h(3));
  e.fiches_retenues.risotto = { nom: 'Risotto', famille: 'riz', role: 'plat_principal', categorie: 'feculent' };
  assert.throws(() => definirPortionFiche(e, 'risotto', 2001, 'sec', h(4)), /Portion trop grande : au plus 2000 g par portion\./);
  definirPortionFiche(e, 'risotto', 2000, 'sec', h(5));
});

test('M2 : l\'import ne rejette pas un ancien état au-delà du plafond', () => {
  const d = peuple();
  const id = premier(d.etat.composants);
  d.etat.composants[id].grammage = { ...d.etat.composants[id].grammage, valeur: 9000, unite: 'g' };
  const r = importerAvecBilan(JSON.stringify(d), AUJOURD);
  assert.equal(r.ecartes, 0);
  assert.equal(r.etat.composants[id].grammage.valeur, 9000);
});
