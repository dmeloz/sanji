// Lecture d'une fiche de fonction par l'IA, mode essai (décision du 2026-10-07) : réponse, corps de requête, fournisseur, UI.
// Données TEST_ONLY synthétiques ; aucun réseau (fetch simulé).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';
import { lireChampsFiche } from '../app/js/harness/lecture-fiche-ia.js';
import { construireCorpsFiche, creerFournisseurWeb } from '../app/js/ui/fournisseur-web.js';
import { detailDuJour } from './aide-detail.js';

const FAUSSE_CLE = 'sk-ant-FAUX1234';
const DATE = '2026-11-04';
const reponseHttp = (statut, corps) => ({ status: statut, ok: statut < 300, json: async () => corps });
const outil = (input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'rendre_fiche', input }] });
const attendre = () => new Promise((r) => setImmediate(r));
const FICHE_LUE = { numero: 'TEST-12', date: '2026-11-06', service: 'soir', horaire: '19h30', couverts: 42, allergies: 'TEST_ONLY arachides', remarques: 'sans alcool' };

test('lireChampsFiche : champs valides gardés, texte nettoyé et borné', () => {
  // Arrange
  const reponse = { ...FICHE_LUE, numero: ' TEST\u0000  12 ', remarques: 'x'.repeat(600), illisibles: 2 };
  // Act
  const lu = lireChampsFiche(reponse);
  // Assert
  assert.equal(lu.champs.numero, 'TEST 12');
  assert.equal(lu.champs.remarques.length, 500);
  assert.equal(lu.champs.couverts, 42);
  assert.equal(lu.illisibles, 2);
  assert.deepEqual(lu.ecartes, []);
});

test('lireChampsFiche : date, service, couverts invalides écartés, comptés dans les doutes', () => {
  const lu = lireChampsFiche({ numero: 'A', date: '2026-02-30', service: 'brunch', couverts: 501, illisibles: 99 });
  assert.deepEqual(lu.champs, { numero: 'A' });
  assert.deepEqual(lu.ecartes, ['date', 'service', 'couverts', 'illisibles']);
  assert.equal(lu.illisibles, 3);
  assert.equal(lireChampsFiche({ couverts: 1.5, date: '2026-1-1' }), null);
});

test('lireChampsFiche : menuFixe, repartition, mode et champs inconnus sont ignorés ; sans champ valide, null', () => {
  const lu = lireChampsFiche({ numero: 'A', menuFixe: 1, repartition: { 1: 3 }, mode: 'menu_fixe', autre: 'x' });
  assert.deepEqual(lu.champs, { numero: 'A' });
  for (const mauvais of [null, 'texte', [], {}, { menuFixe: 1 }, { numero: '  ' }, { numero: 5 }, { illisibles: 2 }]) {
    assert.equal(lireChampsFiche(mauvais), null, JSON.stringify(mauvais));
  }
});

test('construireCorpsFiche : seulement l\'image et la phrase fixe, tool_choice, jamais la clé', () => {
  const corps = construireCorpsFiche({ media_type: 'image/jpeg', base64: 'QUJD' }, { modele: 'm' });
  assert.deepEqual(corps.messages[0].content.map((b) => b.type), ['image', 'text']);
  assert.equal(corps.messages.length, 1);
  assert.deepEqual(corps.tool_choice, { type: 'tool', name: 'rendre_fiche' });
  assert.equal(corps.max_tokens, 2000);
  assert.deepEqual(Object.keys(corps.tools[0].input_schema.properties).sort(),
    ['allergies', 'couverts', 'date', 'horaire', 'illisibles', 'numero', 'remarques', 'service']);
  assert.equal(JSON.stringify(corps).includes('sk-ant'), false);
});

test('demanderLectureFiche : valide ; refus, HTTP 401 et réponse sans outil lèvent', async () => {
  const appels = [];
  const fetchImpl = async (url, options) => { appels.push(options); return reponseHttp(200, outil({ numero: 'A' })); };
  const retour = await creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl }).demanderLectureFiche({ media_type: 'image/jpeg', base64: 'QUJD' });
  assert.deepEqual(retour, { numero: 'A' });
  assert.equal(appels[0].body.includes(FAUSSE_CLE), false);
  const essai = (reponse) => creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl: async () => reponse }).demanderLectureFiche({ media_type: 'image/jpeg', base64: '' });
  await assert.rejects(essai(reponseHttp(200, { stop_reason: 'refusal', content: [] })), /refusé/);
  await assert.rejects(essai(reponseHttp(401, { error: { type: 'authentication_error', message: 'invalid' } })), /HTTP 401/);
  await assert.rejects(essai(reponseHttp(200, { content: [{ type: 'text', text: 'bonjour' }] })), /pas rendu/);
});

// ------------------------------------------------------------------ UI

let dom; let magasin; let vue; let reglages; let stockage; let fetchReel; let imageReelle;
const OCTETS = new Uint8Array([1, 2, 3, 250, 255, 0, 65]);

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-detail.js');
  reglages = await import('../app/js/ui/assistant-reglages.js');
  stockage = await import('../app/js/stockage.js');
  fetchReel = globalThis.fetch;
  imageReelle = globalThis.Image;
  // Le faux DOM n'a ni image ni canvas : la réduction est simulée, le reste (base64, aperçu) est réel.
  globalThis.Image = class { set src(v) { this.naturalWidth = 10; this.naturalHeight = 10; queueMicrotask(() => this.onload()); } };
  const base = globalThis.document.createElement;
  globalThis.document.createElement = (balise) => (balise === 'canvas'
    ? { getContext: () => ({ drawImage() {} }), toBlob: (cb) => cb(new Blob([OCTETS], { type: 'image/jpeg' })) } : base(balise));
});
after(() => {
  globalThis.Image = imageReelle;
  dom.restaurer(); globalThis.fetch = fetchReel; reglages.effacerReglagesIA();
});

const bouton = (n, texte) => boutons(n).find((b) => b.textContent === texte);
const entree = (n) => n.tous((x) => x.balise === 'input' && x.attributs.type === 'file' && x.attributs.capture === 'environment')[0];
const controles = (n) => n.tous((x) => ['input', 'select', 'textarea'].includes(x.balise));

async function page({ cle = true, reponse = outil(FICHE_LUE) } = {}) {
  for (const reste of panneauxOuverts(dom.corps)) reste.close();
  reglages.effacerReglagesIA();
  if (cle) reglages.enregistrerReglagesIA({ actif: true, cle: FAUSSE_CLE });
  magasin.remplacer(etatVide());
  const appels = [];
  globalThis.fetch = async (url, options) => { appels.push(JSON.parse(options.body)); return typeof reponse === 'function' ? reponse() : reponseHttp(200, reponse); };
  const noeud = detailDuJour(vue, magasin.etat(), DATE);
  await attendre();
  return { noeud, appels };
}
const choisirPhoto = async (noeud) => { await entree(noeud).declencher('change', { target: { files: [new Blob([OCTETS])], value: 'x' } }); };

test('UI : pas de bouton sans clé ; « Nouvelle fiche » reste', async () => {
  const sans = await page({ cle: false });
  assert.equal(entree(sans.noeud), undefined);
  assert.match(sans.noeud.textContent, /Nouvelle fiche/);
  const prete = await page();
  assert.match(prete.noeud.textContent, /Lire une fiche avec l'IA \(essai\)/);
});

test('UI : aperçu et avertissement avant tout envoi ; Annuler n\'envoie rien', async () => {
  const { noeud, appels } = await page();
  await choisirPhoto(noeud);
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.equal(dialogue.tous((x) => x.balise === 'img').length, 1);
  assert.match(dialogue.textContent, /noms et des allergies ; elle part à l'IA/);
  assert.equal(appels.length, 0);
  await bouton(dialogue, 'Annuler').click();
  assert.equal(appels.length, 0);
  assert.equal(panneauxOuverts(dom.corps).length, 0);
});

test('UI : la réponse préremplit le formulaire de création, n\'enregistre rien, ne garde aucune photo', async () => {
  const { noeud, appels } = await page({ reponse: outil({ ...FICHE_LUE, menuFixe: 2, mode: 'choix_libre', repartition: { 1: 40, 2: 2 } }) });
  await choisirPhoto(noeud);
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0].messages[0].content.map((b) => b.type), ['image', 'text']);
  const formulaire = panneauxOuverts(dom.corps).find((p) => /Nouvelle fiche de fonction/.test(p.textContent));
  assert.ok(formulaire);
  assert.match(formulaire.textContent, /Lu par l'IA \(essai\) : relisez chaque champ/);
  assert.match(formulaire.textContent, /Allergies : texte à confirmer, jamais interprété/);
  const valeurs = controles(formulaire).map((c) => c.value);
  for (const attendu of ['TEST-12', '2026-11-06', '19h30', '42', 'TEST_ONLY arachides', 'sans alcool']) assert.ok(valeurs.includes(attendu), attendu);
  const [, , service, , , mode, menuFixe] = controles(formulaire);
  assert.deepEqual([service.value, mode.value, menuFixe.value], ['1', '0', '0'], 'soir lu ; mode et menu restent à choisir, jamais proposés par l\'IA');
  assert.equal(Object.keys(magasin.etat().fiches).length, 0);
  assert.equal(await stockage.lirePhoto(DATE), null);
});

test('UI : sans choix de menu de la propriétaire, rien n\'est créé ; avec son choix, la fiche l\'est (menuFixe de l\'IA ignoré)', async () => {
  const { noeud } = await page({ reponse: outil({ ...FICHE_LUE, menuFixe: 2 }) });
  await choisirPhoto(noeud);
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  const formulaire = panneauxOuverts(dom.corps).find((p) => /Nouvelle fiche de fonction/.test(p.textContent));
  await formulaire.enfants[0].declencher('submit');
  assert.match(formulaire.textContent, /menu 1 ou 2/);
  assert.equal(Object.keys(magasin.etat().fiches).length, 0);
  controles(formulaire)[6].value = '2'; // « Menu 2 », choisi par la propriétaire
  await formulaire.enfants[0].declencher('submit');
  const [fiche] = Object.values(magasin.etat().fiches);
  assert.equal(fiche.numero, 'TEST-12');
  assert.equal(fiche.couverts, 42);
  assert.equal(fiche.mode, 'menu_fixe');
  assert.equal(fiche.menuFixe, 2);
});

test('dialogFiche : sans prefill, formulaire inchangé ; avec prefill et surEnregistre, rappel après enregistrement', async () => {
  const { dialogFiche } = await import('../app/js/ui/fiches.js');
  await page();
  dialogFiche(null, DATE);
  const nu = panneauxOuverts(dom.corps)[0];
  assert.equal(/Lu par l'IA/.test(nu.textContent), false);
  assert.equal(controles(nu).find((c) => c.value === DATE) !== undefined, true);
  nu.close();
  const recus = [];
  dialogFiche(null, DATE, { numero: 'TEST-7', couverts: 5 }, { surEnregistre: (c) => recus.push(c) });
  const rempli = panneauxOuverts(dom.corps)[0];
  controles(rempli)[6].value = '1';
  await rempli.enfants[0].declencher('submit');
  assert.equal(recus.length, 1);
  assert.equal(recus[0].numero, 'TEST-7');
});

test('UI : réponse inexploitable ou erreur, le panneau reste ouvert pour réessayer', async () => {
  const { noeud } = await page({ reponse: outil({ menuFixe: 1 }) });
  await choisirPhoto(noeud);
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  const [reste] = panneauxOuverts(dom.corps);
  assert.match(reste.textContent, /inexploitable/);
  assert.ok(bouton(reste, 'Envoyer'));
  const echec = await page({ reponse: () => { throw new Error('hors ligne'); } });
  await choisirPhoto(echec.noeud);
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.match(panneauxOuverts(dom.corps)[0].textContent, /L'IA n'a pas répondu : hors ligne/);
  assert.equal(Object.keys(magasin.etat().fiches).length, 0);
});

test('UI : panneau fermé pendant l\'attente, la réponse est ignorée', async () => {
  let liberer;
  const { noeud } = await page({ reponse: () => new Promise((r) => { liberer = () => r(reponseHttp(200, outil(FICHE_LUE))); }) });
  await choisirPhoto(noeud);
  const [dialogue] = panneauxOuverts(dom.corps);
  const envoi = dialogue.enfants[0].declencher('submit');
  await attendre();
  dialogue.close();
  liberer();
  await envoi;
  assert.equal(panneauxOuverts(dom.corps).length, 0);
});

test('dialogFiche prérempli : les allergies non lues et les passages illisibles sont toujours signalés', async () => {
  const { dialogFiche } = await import('../app/js/ui/fiches.js');
  for (const reste of panneauxOuverts(dom.corps)) reste.close();
  dialogFiche(null, DATE, { numero: 'TEST_ONLY-9', couverts: 12 }, { doutes: 2 });
  const [panneau] = panneauxOuverts(dom.corps);
  assert.match(panneau.textContent, /Allergies : rien n'a été lu, vérifiez la fiche papier/);
  assert.match(panneau.textContent, /2 passages illisibles ou refusés : complétez à la main/);
  panneau.close();
  dialogFiche(null, DATE, { numero: 'TEST_ONLY-9', allergies: 'TEST_ONLY sans noix' });
  assert.match(panneauxOuverts(dom.corps)[0].textContent, /Allergies : texte à confirmer, jamais interprété/);
});
