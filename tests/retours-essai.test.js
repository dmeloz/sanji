// Retours d'essai : stockage local, Réglages, Import. Données TEST_ONLY ; aucun réseau.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, figerHorloge, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom; let magasin; let essai; let reglages; let vueImport; let assistant;
const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
const attendre = () => new Promise((r) => setImmediate(r));
const texteBouton = (n, t) => boutons(n).find((b) => b.textContent === t);

let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge('2026-11-02');
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  essai = await import('../app/js/ui/retours-essai.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
  vueImport = await import('../app/js/ui/vue-import.js');
  assistant = await import('../app/js/ui/assistant-reglages.js');
});
after(() => { dom.restaurer(); rendreHorloge(); delete globalThis.localStorage; });

test('stockage : 30 entrées au plus, les plus récentes d\'abord, version notée', () => {
  globalThis.localStorage = faux();
  essai.effacerRetours();
  for (let i = 0; i < 35; i++) essai.noterRetour({ type: 'menu', lu: [`l${i}`], final: {} });
  const liste = essai.lireRetours();
  assert.equal(liste.length, 30);
  assert.deepEqual(liste[0].lu, ['l34']);
  assert.ok(liste[0].version && liste[0].h);
});

test('stockage : localStorage indisponible → repli mémoire, effacement', () => {
  globalThis.localStorage = { getItem() { throw new Error('non'); }, setItem() { throw new Error('non'); }, removeItem() { throw new Error('non'); } };
  essai.effacerRetours();
  essai.noterRetour({ type: 'fiche', lu: {}, final: {}, remarque: 'x' });
  assert.equal(essai.lireRetours().length, 1);
  essai.effacerRetours();
  assert.equal(essai.lireRetours().length, 0);
});

test('stockage : l\'état n\'est pas touché', () => {
  globalThis.localStorage = faux();
  magasin.remplacer(etatVide());
  const avant = JSON.stringify(magasin.etat());
  essai.noterRetour({ type: 'menu', lu: ['a'], final: {} });
  assert.equal(JSON.stringify(magasin.etat()), avant);
});

test('Réglages : rubrique présente, accès au centre ; le centre efface les retours après confirmation', async () => {
  globalThis.localStorage = faux();
  essai.effacerRetours();
  essai.noterRetour({ type: 'menu', lu: ['a'], final: {} });
  magasin.remplacer(etatVide());
  assert.ok(reglages.CLES_RUBRIQUES.includes('apprentissage'));
  const page = reglages.rendre(magasin.etat(), 'apprentissage');
  assert.ok(page.textContent.includes('Rien n\'est envoyé'));
  assert.ok(page.textContent.includes('Ce que Sanji a appris'));
  assert.ok(!texteBouton(page, 'Ouvrir notes et diagnostic'), 'une seule porte vers le centre : la pastille « Dev »');
  const { ouvrirCentreDev } = await import('../app/js/ui/centre-dev.js');
  const J = await import('../app/js/ui/journal-diagnostic.js');
  J.noter('erreur', { message: 'x' });
  ouvrirCentreDev();
  await texteBouton(panneauxOuverts(dom.corps).at(-1), 'Effacer le journal').click();
  assert.equal(essai.lireRetours().length, 1, 'rien n\'est effacé avant la confirmation');
  await panneauxOuverts(dom.corps).at(-1).querySelector('form').declencher('submit');
  assert.equal(essai.lireRetours().length, 0);
});

test('Import : lien de signalement caché avant lecture IA ; retour noté sans réseau', async () => {
  globalThis.localStorage = faux();
  essai.effacerRetours();
  magasin.remplacer(etatVide());
  const page = vueImport.rendre(magasin.etat(), '2026-11-02');
  const signaler = texteBouton(page, 'Signaler un problème de lecture') ?? page.tous((x) => x.balise === 'button' && x.textContent === 'Signaler un problème de lecture')[0];
  assert.equal(signaler.hidden, true);
  signaler.hidden = false;
  await signaler.click();
  const ouvert = panneauxOuverts(dom.corps).at(-1);
  ouvert.tous((x) => x.attributs.id === 'remarque-lecture')[0].value = 'accent perdu';
  await ouvert.querySelector('form').declencher('submit');
  const [retour] = essai.lireRetours();
  assert.equal(retour.type, 'menu');
  assert.equal(retour.remarque, 'accent perdu');
  void attendre; void assistant;
});

test('retours d\'essai : un retour de plus de 14 jours est purgé à la prochaine note', async () => {
  const { noterRetour, lireRetours, effacerRetours } = await import('../app/js/ui/retours-essai.js');
  effacerRetours();
  const ancien = Date.now() - 15 * 24 * 3600 * 1000;
  globalThis.localStorage.setItem('sanji-retours-essai', JSON.stringify([{ type: 'fiche', h: new Date(ancien).toISOString(), version: '1', lu: {}, final: {} }]));
  noterRetour({ type: 'menu', lu: ['a'], final: {} });
  const liste = lireRetours();
  assert.equal(liste.length, 1);
  assert.equal(liste[0].type, 'menu');
  effacerRetours();
});
