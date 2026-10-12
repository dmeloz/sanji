// Lecture de la photo de la feuille par l'IA (décision du 2026-10-07) : réponse, corps de requête, fournisseur, photo en base64, UI.
// Données TEST_ONLY ; aucun réseau (fetch simulé).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { etatVide } from './aide.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { lireLignesFeuille } from '../app/js/harness/lecture-photo-ia.js';
import { construireCorpsPhoto, creerFournisseurWeb } from '../app/js/ui/fournisseur-web.js';

const FAUSSE_CLE = 'sk-ant-FAUX1234';
const reponseHttp = (statut, corps) => ({ status: statut, ok: statut < 300, json: async () => corps });
const outil = (input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'rendre_feuille', input }] });
const attendre = () => new Promise((r) => setImmediate(r));

test('lireLignesFeuille : nettoie, borne, écarte et compte les lignes illisibles', () => {
  // Arrange
  const reponse = { lignes: ['  Lundi \t 05   octobre\u0000 ', '', '[illisible]', '???', 'x'.repeat(200), 'Illisible'], illisibles: 2, extra: 1 };
  // Act
  const lu = lireLignesFeuille(reponse);
  // Assert
  assert.deepEqual(lu.lignes, ['Lundi 05 octobre', 'x'.repeat(160)]);
  assert.equal(lu.illisibles, 5);
});

test('lireLignesFeuille : illisibles borné à 50 ; refus hors cadre (type, 81 lignes, aucune ligne)', () => {
  assert.equal(lireLignesFeuille({ lignes: ['a'], illisibles: 500 }).illisibles, 50);
  assert.equal(lireLignesFeuille({ lignes: Array(80).fill('a') }).lignes.length, 80);
  for (const mauvais of [null, 'texte', {}, { lignes: 'a' }, { lignes: [1] }, { lignes: Array(81).fill('a') }, { lignes: [] },
    { lignes: ['  '] }, { lignes: ['a'], illisibles: -1 }, { lignes: ['a'], illisibles: 1.5 }, { lignes: ['a'], illisibles: '2' }]) {
    assert.equal(lireLignesFeuille(mauvais), null, JSON.stringify(mauvais));
  }
});

test('construireCorpsPhoto : seulement l\'image et la phrase fixe, tool_choice, jamais la clé', () => {
  const corps = construireCorpsPhoto({ media_type: 'image/jpeg', base64: 'QUJD' }, { modele: 'm' });
  assert.deepEqual(corps.messages[0].content.map((b) => b.type), ['image', 'text']);
  assert.deepEqual(corps.messages[0].content[0].source, { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' });
  assert.equal(corps.messages.length, 1);
  assert.deepEqual(corps.tool_choice, { type: 'tool', name: 'rendre_feuille' });
  assert.equal(corps.max_tokens, 4000);
  assert.equal(JSON.stringify(corps).includes('sk-ant'), false);
});

test('demanderLecturePhoto : valide ; clé en en-tête seulement ; refus, HTTP 401 et réponse sans outil lèvent', async () => {
  const appels = [];
  const fetchImpl = async (url, options) => { appels.push(options); return reponseHttp(200, outil({ lignes: ['Lundi'] })); };
  const f = creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl });
  const retour = await f.demanderLecturePhoto({ media_type: 'image/jpeg', base64: 'QUJD' });
  assert.deepEqual(retour, { lignes: ['Lundi'] });
  assert.equal(appels[0].headers['x-api-key'], FAUSSE_CLE);
  assert.equal(appels[0].body.includes(FAUSSE_CLE), false);
  const essai = (reponse) => creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl: async () => reponse }).demanderLecturePhoto({ media_type: 'image/jpeg', base64: '' });
  await assert.rejects(essai(reponseHttp(200, { stop_reason: 'refusal', content: [] })), /refusé/);
  await assert.rejects(essai(reponseHttp(401, { error: { type: 'authentication_error', message: 'invalid' } })), /HTTP 401/);
  await assert.rejects(essai(reponseHttp(200, { content: [{ type: 'text', text: 'bonjour' }] })), /pas rendu/);
});

// ------------------------------------------------------------------ photo et UI

let imageReelle; let creerReel;
let dom; let magasin; let vue; let reglages; let photo; let stockage; let fetchReel;
const OCTETS = new Uint8Array([1, 2, 3, 250, 255, 0, 65]);
const LUNDI_SANS_PHOTO = '2026-11-02';

let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(S.lundi);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-import.js');
  reglages = await import('../app/js/ui/assistant-reglages.js');
  photo = await import('../app/js/ui/photo.js');
  stockage = await import('../app/js/stockage.js');
  fetchReel = globalThis.fetch;
  // Le faux DOM n'a ni image ni canvas : la réduction du scan est simulée, le reste (enregistrement, aperçu, base64) est réel.
  imageReelle = globalThis.Image;
  creerReel = globalThis.document.createElement;
  globalThis.Image = class { set src(v) { this.naturalWidth = 10; this.naturalHeight = 10; queueMicrotask(() => this.onload()); } };
  globalThis.document.createElement = (balise) => (balise === 'canvas'
    ? { getContext: () => ({ drawImage() {} }), toBlob: (cb) => cb(new Blob([OCTETS], { type: 'image/jpeg' })) } : creerReel.call(globalThis.document, balise));
  await stockage.enregistrerPhoto(S.lundi, new Blob([OCTETS], { type: 'image/jpeg' }));
});
after(() => { globalThis.Image = imageReelle; globalThis.document.createElement = creerReel; dom.restaurer(); rendreHorloge(); globalThis.fetch = fetchReel; reglages.effacerReglagesIA(); });

const champ = (n, id) => n.tous((x) => x.attributs.id === id)[0];
const bouton = (n, texte) => boutons(n).find((b) => b.textContent === texte);

async function page({ cle = true, lundi = S.lundi, reponse = outil({ lignes: ['Lundi 5 octobre', 'riz et carottes', 'poulet, riz, carottes', '[illisible]'] }) } = {}) {
  for (const reste of panneauxOuverts(dom.corps)) reste.close(); // un panneau resté ouvert sur erreur ne doit pas fausser l'essai suivant
  reglages.effacerReglagesIA();
  if (cle) reglages.enregistrerReglagesIA({ actif: true, cle: FAUSSE_CLE });
  magasin.remplacer(etatVide());
  const appels = [];
  globalThis.fetch = async (url, options) => { appels.push(JSON.parse(options.body)); return typeof reponse === 'function' ? reponse() : reponseHttp(200, reponse); };
  const noeud = vue.rendre(magasin.etat(), lundi);
  await attendre();
  return { noeud, appels };
}

test('photoEnBase64 : octets exacts en base64 JPEG ; null sans photo', async () => {
  const lu = await photo.photoEnBase64(S.lundi);
  assert.equal(lu.media_type, 'image/jpeg');
  assert.deepEqual([...Buffer.from(lu.base64, 'base64')], [...OCTETS]);
  assert.equal(await photo.photoEnBase64(LUNDI_SANS_PHOTO), null);
});

test('UI : pas de bouton sans clé ni sans photo ; l\'aide « ne lit pas la photo » reste sans assistant', async () => {
  const sansCle = await page({ cle: false });
  assert.equal(bouton(sansCle.noeud, 'Lire la photo avec l\'IA'), undefined);
  assert.match(sansCle.noeud.textContent, /Sanji ne lit pas la photo/);
  const sansPhoto = await page({ lundi: LUNDI_SANS_PHOTO });
  assert.equal(bouton(sansPhoto.noeud, 'Lire la photo avec l\'IA').hidden, true);
  const prete = await page();
  assert.equal(bouton(prete.noeud, 'Lire la photo avec l\'IA').hidden, false);
  assert.match(prete.noeud.textContent, /peut être lue par l'IA/);
});

test('UI : aperçu avant tout envoi ; Annuler n\'envoie rien', async () => {
  const { noeud, appels } = await page();
  await bouton(noeud, 'Lire la photo avec l\'IA').click();
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.ok(dialogue.tous((x) => x.balise === 'img').length === 1);
  assert.match(dialogue.textContent, /va être envoyée à l'IA pour transcrire le texte imprimé.*Rien d'autre ne part/);
  assert.equal(appels.length, 0);
  await bouton(dialogue, 'Annuler').click();
  assert.equal(appels.length, 0);
});

test('UI : la réponse remplit le champ, répartit les jours, dit les illisibles, n\'enregistre rien', async () => {
  const { noeud, appels } = await page();
  await bouton(noeud, 'Lire la photo avec l\'IA').click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0].messages[0].content.map((b) => b.type), ['image', 'text']);
  assert.match(champ(noeud, 'feuille-texte').value, /^Lundi 5 octobre\nriz et carottes/);
  assert.equal(champ(noeud, `menu-${S.lundi}-1`).value, 'riz et carottes');
  assert.match(dom.corps.textContent, /L'IA a lu 3 lignes\..*1 ligne illisible : complétez à la main/);
  assert.equal(Object.keys(magasin.etat().composants).length, 0);
});

test('UI : réponse invalide ou erreur réseau, rien n\'est modifié', async () => {
  const { noeud } = await page({ reponse: outil({ lignes: 'pas un tableau' }) });
  await bouton(noeud, 'Lire la photo avec l\'IA').click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.match(dom.corps.textContent, /inexploitable/);
  assert.equal(champ(noeud, 'feuille-texte').value, '');
  const echec = await page({ reponse: () => { throw new Error('hors ligne'); } });
  await bouton(echec.noeud, 'Lire la photo avec l\'IA').click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.match(dom.corps.textContent, /hors ligne/);
  assert.equal(champ(echec.noeud, 'feuille-texte').value, '');
});

test('UI : panneau fermé pendant l\'attente, la réponse est ignorée', async () => {
  let liberer;
  const { noeud } = await page({ reponse: () => new Promise((r) => { liberer = () => r(reponseHttp(200, outil({ lignes: ['Lundi 5 octobre', 'riz'] }))); }) });
  await bouton(noeud, 'Lire la photo avec l\'IA').click();
  const [dialogue] = panneauxOuverts(dom.corps);
  const envoi = dialogue.enfants[0].declencher('submit');
  await attendre();
  dialogue.close();
  liberer();
  await envoi;
  assert.equal(champ(noeud, 'feuille-texte').value, '');
});

test('UI : sur erreur, le panneau reste ouvert pour réessayer ; un double clic n\'ouvre qu\'un aperçu', async () => {
  const { noeud } = await page({ reponse: () => { throw new Error('hors ligne'); } });
  const lire = bouton(noeud, 'Lire la photo avec l\'IA');
  await Promise.all([lire.click(), lire.click()]);
  assert.equal(panneauxOuverts(dom.corps).length, 1);
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  const [reste] = panneauxOuverts(dom.corps);
  assert.ok(reste, 'le panneau reste ouvert');
  assert.match(reste.textContent, /L'IA n'a pas répondu : hors ligne/);
  assert.ok(bouton(reste, 'Envoyer'), 'Envoyer reste disponible');
});

test('UI : un texte déjà collé remplacé par la lecture de la photo est dit', async () => {
  const { noeud } = await page();
  champ(noeud, 'feuille-texte').value = 'Lundi 5 octobre\nriz\npoulet';
  await bouton(noeud, 'Lire la photo avec l\'IA').click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.match(dom.corps.textContent, /Le texte collé précédemment a été remplacé/);
});

test('lireLignesFeuille : un « [illisible] » au milieu d\'une ligne est retiré du texte et compté', () => {
  const r = lireLignesFeuille({ lignes: ['[illisible]ortecce à la bolognaise 19.-', 'Penne au pesto [illisible] 19.-'] });
  assert.deepEqual(r, { lignes: ['ortecce à la bolognaise 19.-', 'Penne au pesto 19.-'], illisibles: 2 });
});

test('un modèle qui refuse tool_choice forcé (HTTP 400) : le même appel est retenté une fois en « auto », sans changer le reste', async () => {
  // Arrange
  const corps = [];
  const fetchImpl = async (_url, init) => {
    const envoye = JSON.parse(init.body);
    corps.push(envoye);
    if (envoye.tool_choice.type === 'tool') {
      return reponseHttp(400, { error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } });
    }
    return reponseHttp(200, outil({ lignes: ['Lundi 05 octobre'] }));
  };
  const fournisseur = creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl });
  // Act
  const rendu = await fournisseur.demanderLecturePhoto({ media_type: 'image/jpeg', base64: 'AAAA' });
  // Assert
  assert.equal(corps.length, 2);
  assert.deepEqual(corps[1].tool_choice, { type: 'auto' });
  assert.deepEqual({ ...corps[1], tool_choice: corps[0].tool_choice }, corps[0]);
  assert.deepEqual(rendu.lignes, ['Lundi 05 octobre']);
});

test('une autre erreur 400 n\'est pas retentée', async () => {
  // Arrange
  let appels = 0;
  const fetchImpl = async () => { appels += 1; return reponseHttp(400, { error: { type: 'invalid_request_error', message: 'image trop grande' } }); };
  const fournisseur = creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl });
  // Act / Assert
  await assert.rejects(() => fournisseur.demanderLecturePhoto({ media_type: 'image/jpeg', base64: 'AAAA' }), /image trop grande/);
  assert.equal(appels, 1);
});

test('lireLignesFeuille : nouveau format, aplati par jour, en-tête ignoré, illisibles additionnés', () => {
  // Arrange
  const reponse = { entete: ['Menu du marché', '(À midi uniquement)'], illisibles: 1, jours: [
    { jour: 'Lundi 12 octobre', plats: ['riz 21.-', ' poulet [illisible] 21.-'], illisibles: 2 },
    { jour: 'Mardi 13 octobre', plats: ['pâtes', 'poisson'] }] };
  // Act
  const lu = lireLignesFeuille(reponse);
  // Assert
  assert.deepEqual(lu.lignes, ['Lundi 12 octobre', 'riz 21.-', 'poulet 21.-', 'Mardi 13 octobre', 'pâtes', 'poisson']);
  assert.equal(lu.illisibles, 4);
});

test('lireLignesFeuille : nouveau format, bornes et refus', () => {
  const jour = (n) => ({ jour: 'Lundi', plats: Array(n).fill('a') });
  assert.equal(lireLignesFeuille({ jours: [jour(79)] }).lignes.length, 80);
  for (const mauvais of [{ jours: [jour(80)] }, { jours: 'x' }, { jours: [{ jour: 1, plats: [] }] }, { jours: [{ jour: 'L', plats: [2] }] },
    { jours: [{ jour: 'L', plats: ['a'], illisibles: -1 }] }, { jours: [jour(1)], entete: 'x' }, { jours: [] }]) {
    assert.equal(lireLignesFeuille(mauvais), null, JSON.stringify(mauvais));
  }
  assert.deepEqual(lireLignesFeuille({ lignes: ['a'] }), { lignes: ['a'], illisibles: 0 }, 'ancien format toujours lu');
});

test('construireCorpsPhoto : schéma par jour, image + phrase fixe seulement', () => {
  const corps = construireCorpsPhoto({ media_type: 'image/jpeg', base64: 'QUJD' }, { modele: 'm' });
  const schema = corps.tools[0].input_schema;
  assert.deepEqual(Object.keys(schema.properties), ['entete', 'jours', 'illisibles']);
  assert.deepEqual(schema.properties.jours.items.required, ['jour', 'plats']);
  assert.deepEqual(Object.keys(corps).sort(), ['max_tokens', 'messages', 'model', 'system', 'tool_choice', 'tools']);
  assert.deepEqual(corps.messages[0].content.map((b) => b.type), ['image', 'text']);
  assert.equal(corps.messages[0].content[1].text, 'Transcris le texte imprimé de cette feuille de menus, plats rangés par jour.');
});

const entreeScan = (n) => n.tous((x) => x.attributs.id === 'scanner-feuille')[0];
const REPONSE_JOURS = outil({ entete: ['Menu du marché'], jours: [{ jour: 'Lundi 2 novembre', plats: ['riz et carottes 21.-', 'poulet, riz 21.-'] }] });

test('UI : « Scanner la feuille » avec assistant prêt ; sinon la ligne d\'activation et son lien', async () => {
  const prete = await page();
  assert.match(prete.noeud.textContent, /Scanner la feuille/);
  assert.ok(entreeScan(prete.noeud));
  const sans = await page({ cle: false });
  assert.equal(entreeScan(sans.noeud), undefined);
  assert.match(sans.noeud.textContent, /Pour scanner la feuille, activez l'assistant IA dans Réglages\./);
  assert.ok(sans.noeud.tous((x) => x.balise === 'a' && x.attributs.href === '#/reglages/assistant-ia').length === 1);
});

test('UI : scanner ouvre l\'aperçu, rien ne part sans « Envoyer », puis les jours sont remplis', async () => {
  const { noeud, appels } = await page({ lundi: LUNDI_SANS_PHOTO, reponse: REPONSE_JOURS });
  await entreeScan(noeud).declencher('change', { target: { files: [new Blob([OCTETS], { type: 'image/jpeg' })], value: 'x' } });
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.ok(dialogue, `aperçu ouvert : ${dom.corps.textContent.slice(-300)}`);
  assert.ok(bouton(dialogue, 'Envoyer'));
  assert.equal(appels.length, 0, 'aucun envoi avant le clic');
  await dialogue.enfants[0].declencher('submit');
  assert.equal(appels.length, 1);
  assert.match(champ(noeud, 'feuille-texte').value, /^Lundi 2 novembre\nriz et carottes/);
  assert.equal(champ(noeud, 'menu-2026-11-02-1').value, 'riz et carottes');
  assert.equal(Object.keys(magasin.etat().composants).length, 0);
});
