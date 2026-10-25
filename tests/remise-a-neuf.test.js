// Remise à neuf : logique pure (sans DOM), avec un faux magasin et des effacements injectés.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLE_AVANT_REMISE_A_NEUF, CLE_AVANT_REMISE_PRECEDENTE, CLE_AVANT_RESTAURATION, CLE_ETAT_COURANT, PREFIXE_COPIE, listerCopies, lireAvantRemiseANeuf } from '../app/js/sauvegarde-auto.js';
import { etatInitial, exporter, importer, jourVide } from '../app/js/domaine/etat.js';
import { estVide, repartirANeuf } from '../app/js/remise-a-neuf.js';

const H = '2026-10-16T10:00:00';

function fauxMagasin({ echec = false, perd = false } = {}) {
  const donnees = new Map([[CLE_ETAT_COURANT, { principal: true }], [`${PREFIXE_COPIE}2026-10-14`, 'x'], [`${PREFIXE_COPIE}2026-10-15`, 'y'], [CLE_AVANT_RESTAURATION, 'z']]);
  return {
    donnees,
    lister: async () => [...donnees.keys()],
    lire: async (cle) => donnees.get(cle) ?? null,
    ecrire: async (cle, valeur) => { if (echec) throw new Error('quota'); if (!perd) donnees.set(cle, valeur); },
    supprimer: async (cle) => { donnees.delete(cle); },
  };
}

const etatPlein = () => { const e = etatInitial(); e.jours['2026-10-12'] = jourVide('2026-10-12'); return e; };

function montage({ etat = etatPlein(), magasin = fauxMagasin(), effacements } = {}) {
  const journal = [];
  const sortie = { journal, remplaces: [] };
  const options = {
    etat: () => etat, maintenant: () => H, magasin,
    remplacer: (e, detail) => { journal.push('remplacer'); sortie.remplaces.push({ e, detail }); },
    viderPhotos: async () => { journal.push('photos'); },
    effacements: effacements ?? [{ nom: 'notes', effacer: () => { journal.push('notes'); } }],
  };
  return { ...sortie, options, magasin, etat };
}

test('l\'état remplacé est l\'état initial, journalisé « remise à neuf »', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  assert.equal(m.remplaces.length, 1);
  assert.deepEqual(m.remplaces[0].e, etatInitial());
  assert.match(m.remplaces[0].detail, /remise à neuf/);
});

test('la copie de sécurité contient l\'ancien état et se restaure exactement', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  const texte = await lireAvantRemiseANeuf(m.magasin);
  assert.deepEqual(importer(texte, '2026-10-16'), importer(exporter(m.etat, H), '2026-10-16'));
  assert.ok(importer(texte, '2026-10-16').jours['2026-10-12']);
});

test('copie impossible : tout est annulé, rien n\'est effacé ni remplacé', async () => {
  const m = montage({ magasin: fauxMagasin({ echec: true }) });
  await assert.rejects(() => repartirANeuf(m.options), /Impossible de garder une copie de sécurité : rien n'a été effacé/);
  assert.deepEqual(m.journal, []);
  assert.equal(m.remplaces.length, 0);
  assert.equal((await listerCopies(m.magasin)).length, 2);
  assert.equal(m.magasin.donnees.get(CLE_AVANT_RESTAURATION), 'z');
});

test('copie qui ne se relit pas à l\'identique : annulé aussi', async () => {
  const m = montage({ magasin: fauxMagasin({ perd: true }) });
  await assert.rejects(() => repartirANeuf(m.options), /rien n'a été effacé/);
  assert.equal(m.remplaces.length, 0);
});

test('les 7 copies partent ; « avant-restauration », les copies de remise à neuf et l\'état courant restent', async () => {
  const m = montage();
  m.magasin.donnees.set(CLE_AVANT_REMISE_PRECEDENTE, 'ancienne');
  await repartirANeuf(m.options);
  assert.deepEqual(await listerCopies(m.magasin), []);
  assert.equal(m.magasin.donnees.get(CLE_AVANT_RESTAURATION), 'z');
  assert.equal(m.magasin.donnees.has(CLE_AVANT_REMISE_PRECEDENTE), true);
  assert.equal(typeof m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF), 'string');
  assert.deepEqual(m.magasin.donnees.get(CLE_ETAT_COURANT), { principal: true });
});

test('ordre : copie de sécurité, puis effacements, puis état remplacé en dernier', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  assert.deepEqual(m.journal, ['photos', 'notes', 'remplacer']);
  assert.equal(typeof m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF), 'string');
});

test('un effacement secondaire qui échoue est signalé, la remise à neuf continue', async () => {
  const m = montage({ effacements: [{ nom: 'les notes de test', effacer: () => { throw new Error('x'); } }, { nom: 'le journal', effacer: () => {} }] });
  const r = await repartirANeuf(m.options);
  assert.equal(m.remplaces.length, 1);
  assert.equal(r.avertissements.length, 1);
  assert.match(r.avertissements[0], /les notes de test/);
});

test('jamais une copie non vide remplacée par un état vide (deuxième remise à neuf de suite)', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  const premiere = m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF);
  const second = montage({ etat: etatInitial(), magasin: m.magasin });
  const r = await repartirANeuf(second.options);
  assert.equal(m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF), premiere);
  assert.equal(second.remplaces.length, 1);
  assert.equal(r.copieGardee, false);
});

test('un état vide sans copie existante : la copie est écrite quand même', async () => {
  const m = montage({ etat: etatInitial() });
  await repartirANeuf(m.options);
  assert.equal(typeof m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF), 'string');
});

test('estVide : journal et dernier export ne comptent pas, une donnée si', () => {
  const e = etatInitial();
  e.journal.push({ h: H, action: 'restaurer', detail: '' });
  e.reglages.dernierExport = H;
  assert.equal(estVide(e), true);
  assert.equal(estVide(etatPlein()), false);
});

test('estVide : un réglage modifié ne compte pas, une donnée métier si', () => {
  const e = etatInitial();
  e.reglages.margeSecurite = 3;
  assert.equal(estVide(e), true);
  const f = etatInitial();
  f.mots.x = { categorie: 'sauce', h: H };
  assert.equal(estVide(f), false);
});

const cleSource = (m) => m.magasin.donnees.get(CLE_AVANT_REMISE_A_NEUF);
const nbJours = (texte) => Object.keys(importer(texte, '2026-10-16').jours).length;

test('remise, réglage modifié, 2e remise : la copie d\'origine survit', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  const origine = cleSource(m);
  const presque = etatInitial();
  presque.reglages.margeSecurite = 3;
  await repartirANeuf(montage({ etat: presque, magasin: m.magasin }).options);
  assert.equal(cleSource(m), origine);
});

test('remise, saisie, remise : les deux générations restent', async () => {
  const m = montage();
  await repartirANeuf(m.options);
  const premiere = cleSource(m);
  const e2 = etatInitial();
  e2.jours['2026-10-13'] = jourVide('2026-10-13');
  e2.jours['2026-10-14'] = jourVide('2026-10-14');
  await repartirANeuf(montage({ etat: e2, magasin: m.magasin }).options);
  assert.equal(nbJours(cleSource(m)), 2);
  assert.equal(m.magasin.donnees.get(CLE_AVANT_REMISE_PRECEDENTE), premiere);
});

test('deux remises de suite sans rien : une seule copie utile', async () => {
  const m = montage({ etat: etatInitial() });
  await repartirANeuf(m.options);
  await repartirANeuf(montage({ etat: etatInitial(), magasin: m.magasin }).options);
  assert.equal(m.magasin.donnees.has(CLE_AVANT_REMISE_PRECEDENTE), false);
});

test('une copie existante vide ne va pas dans « précédente »', async () => {
  const m = montage({ etat: etatInitial() });
  await repartirANeuf(m.options);
  await repartirANeuf(montage({ magasin: m.magasin }).options);
  assert.equal(nbJours(cleSource(m)), 1);
  assert.equal(m.magasin.donnees.has(CLE_AVANT_REMISE_PRECEDENTE), false);
});

test('copie existante illisible et état vide : rien n\'est réécrit', async () => {
  const m = montage({ etat: etatInitial() });
  let ecritures = 0;
  const lire = m.magasin.lire;
  m.magasin.lire = async (cle) => { if (cle === CLE_AVANT_REMISE_A_NEUF) throw new Error('illisible'); return lire(cle); };
  const ecrire = m.magasin.ecrire;
  m.magasin.ecrire = async (...a) => { ecritures++; return ecrire(...a); };
  const r = await repartirANeuf(m.options);
  assert.equal(ecritures, 0);
  assert.equal(r.copieGardee, false);
});

test('copie relue identique mais que importer refuse : rien n\'est effacé', async () => {
  const m = montage({ etat: { ...etatPlein(), application: 'autre-chose' } });
  await assert.rejects(() => repartirANeuf(m.options), /rien n'a été effacé/);
  assert.equal(m.remplaces.length, 0);
  assert.deepEqual(m.journal, []);
});

test('l\'état initial s\'exporte et se réimporte', () => {
  assert.deepEqual(importer(exporter(etatInitial(), H), '2026-10-16'), importer(exporter(etatInitial(), H), '2026-10-16'));
  assert.doesNotThrow(() => importer(exporter(etatInitial(), H), '2026-10-16'));
});
