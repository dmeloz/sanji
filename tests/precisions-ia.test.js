// Lecture hybride des menus (décision du 2026-10-07) : aperçu, lecture de la réponse, corps de requête minimal, bouton de la fiche.
// Données TEST_ONLY ; aucun réseau (fetch simulé).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { apercuEnvoi, champsApresProposition, lirePropositionCategorie } from '../app/js/harness/precisions-ia.js';
import { construireCorpsPrecision, creerFournisseurWeb } from '../app/js/ui/fournisseur-web.js';
import { etatVide, h } from './aide.js';

const FAUSSE_CLE = 'sk-ant-FAUX1234';
const reponseHttp = (statut, corps) => ({ status: statut, ok: statut < 300, json: async () => corps });
const outil = (input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'proposer_categorie', input }] });

test('apercuEnvoi : nom refusé par le filtre = null ; intitulé borné ; texte lisible', () => {
  assert.equal(apercuEnvoi({ nom: 'x'.repeat(61), menu: 1 }, 'plat'), null);
  assert.equal(apercuEnvoi({ nom: 'sans gluten, allergie de M. Test', menu: 1 }, 'plat'), null);
  const a = apercuEnvoi({ nom: 'Purée TEST_ONLY', menu: 2 }, 'y'.repeat(300));
  assert.deepEqual(Object.keys(a).sort(), ['intitule', 'menu', 'nom', 'texte']);
  assert.equal(a.intitule.length, 200);
  assert.equal(a.menu, 2);
  assert.match(a.texte, /Purée TEST_ONLY/);
});

test('lirePropositionCategorie : refuse l\'inconnu, a_preciser, la quantité ; ignore les champs en plus', () => {
  assert.equal(lirePropositionCategorie({ categorie: 'inconnue' }), null);
  assert.equal(lirePropositionCategorie({ categorie: 'a_preciser' }), null);
  assert.equal(lirePropositionCategorie(null), null);
  // Une remarque suspecte est écartée, la catégorie reste utilisable.
  assert.deepEqual(lirePropositionCategorie({ categorie: 'legume', remarque: 'compter 200 g par personne' }), { categorie: 'legume', remarque: '' });
  assert.deepEqual(lirePropositionCategorie({ categorie: 'legume', remarque: 'menu 2 l\'accompagnement' }), { categorie: 'legume', remarque: '' });
  assert.deepEqual(lirePropositionCategorie({ categorie: 'legume', remarque: 'x'.repeat(121) }), { categorie: 'legume', remarque: '' });
  assert.deepEqual(lirePropositionCategorie({ categorie: 'legume', remarque: 'pour Mme Dupont' }), { categorie: 'legume', remarque: '' });
  assert.deepEqual(lirePropositionCategorie({ categorie: 'legume', remarque: 'garniture', quantite: 5 }), { categorie: 'legume', remarque: 'garniture' });
  assert.deepEqual(lirePropositionCategorie({ categorie: 'sauce' }), { categorie: 'sauce', remarque: '' });
});

test('demanderPrecision : le corps ne contient que nom, menu, intitule ; la clé reste dans l\'en-tête', async () => {
  const appels = [];
  const fetchImpl = async (url, options) => { appels.push({ options, corps: JSON.parse(options.body) }); return reponseHttp(200, outil({ categorie: 'feculent', extra: 1 })); };
  const f = creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl });
  const retour = await f.demanderPrecision({ nom: 'Riz', menu: 1, intitule: 'Riz pilaf' });
  assert.equal(retour.categorie, 'feculent');
  assert.equal(appels[0].options.headers['x-api-key'], FAUSSE_CLE);
  assert.equal(JSON.stringify(appels[0].corps).includes(FAUSSE_CLE), false);
  assert.deepEqual(JSON.parse(appels[0].corps.messages[0].content), { nom: 'Riz', menu: 1, intitule: 'Riz pilaf' });
  assert.equal(appels[0].corps.messages.length, 1);
  const enum_ = appels[0].corps.tools[0].input_schema.properties.categorie.enum;
  assert.equal(enum_.includes('a_preciser'), false);
  const direct = construireCorpsPrecision({ nom: 'Riz', menu: 1, intitule: 'p', quantite: 4, cle: 'k' }, { modele: 'm' });
  assert.equal(direct.messages[0].content, JSON.stringify({ nom: 'Riz', menu: 1, intitule: 'p' }));
});

test('demanderPrecision : refus, HTTP 401 et réponse sans outil lèvent une erreur', async () => {
  const essai = (reponse) => creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl: async () => reponse }).demanderPrecision({ nom: 'Riz', menu: 1, intitule: '' });
  await assert.rejects(essai(reponseHttp(200, { stop_reason: 'refusal', content: [] })), /refusé/);
  await assert.rejects(essai(reponseHttp(401, { error: { type: 'authentication_error', message: 'invalid' } })), /HTTP 401/);
  await assert.rejects(essai(reponseHttp(200, { content: [{ type: 'text', text: 'bonjour' }] })), /pas rendu/);
});

// ------------------------------------------------------------------ fiche

let dom;
let magasin;
let vueComposant;
let reglages;
let fetchReel;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueComposant = await import('../app/js/ui/vue-composant.js');
  reglages = await import('../app/js/ui/assistant-reglages.js');
  fetchReel = globalThis.fetch;
});
after(() => { dom.restaurer(); globalThis.fetch = fetchReel; reglages.effacerReglagesIA(); });

const DATE = '2026-10-05';
function fiche({ cle = true, categorie = 'a_preciser' } = {}) {
  reglages.effacerReglagesIA();
  if (cle) reglages.enregistrerReglagesIA({ actif: true, cle: FAUSSE_CLE });
  const e = etatVide();
  definirMenu(e, DATE, 1, 'Pavé de TEST_ONLY, purée', h());
  const c = Object.values(e.composants)[0];
  c.categorie = categorie;
  magasin.remplacer(e);
  const appels = [];
  globalThis.fetch = async (url, options) => { appels.push(JSON.parse(options.body)); return reponseHttp(200, outil({ categorie: 'legume', remarque: 'accompagnement' })); };
  const noeud = vueComposant.rendre(magasin.etat(), c.id);
  const bouton = (libelle, racine = noeud) => boutons(racine).find((b) => b.textContent === libelle);
  return { c, appels, bouton };
}

test('fiche : pas de bouton sans clé, ni quand la catégorie est précisée', () => {
  assert.equal(fiche({ cle: false }).bouton("Demander à l'IA"), undefined);
  assert.equal(fiche({ categorie: 'legume' }).bouton("Demander à l'IA"), undefined);
});

test('fiche : l\'aperçu précède l\'envoi ; Annuler n\'envoie rien', async () => {
  const { appels, bouton } = fiche();
  await bouton("Demander à l'IA").click();
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.match(dialogue.textContent, /Sera envoyé à l'IA : .*menu 1/);
  assert.equal(appels.length, 0);
  await bouton('Annuler', dialogue).click();
  assert.equal(appels.length, 0);
});

test('fiche : Envoyer puis Accepter change la catégorie et la mémorise ; Refuser ne change rien', async () => {
  const { c, appels, bouton } = fiche();
  await bouton("Demander à l'IA").click();
  let [dialogue] = panneauxOuverts(dom.corps);
  await dialogue.enfants[0].declencher('submit');
  assert.equal(appels.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(appels[0].messages[0].content)).sort(), ['intitule', 'menu', 'nom']);
  [dialogue] = panneauxOuverts(dom.corps);
  assert.match(dialogue.textContent, /L'IA propose : .*\(à confirmer\)/);
  assert.equal(magasin.etat().composants[c.id].categorie, 'a_preciser');
  // Refuser
  await bouton('Refuser', dialogue).click();
  assert.equal(magasin.etat().composants[c.id].categorie, 'a_preciser');
  // Reprise puis Accepter
  await bouton("Demander à l'IA").click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.equal(magasin.etat().composants[c.id].categorie, 'legume');
  assert.ok(Object.values(magasin.etat().memoire).some((m) => m.categorie === 'legume'));
});

test('fiche : réponse invalide ou erreur réseau, rien n\'est modifié', async () => {
  const { c, bouton } = fiche();
  globalThis.fetch = async () => reponseHttp(200, outil({ categorie: 'a_preciser' }));
  await bouton("Demander à l'IA").click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  await bouton("Demander à l'IA").click();
  await panneauxOuverts(dom.corps)[0].enfants[0].declencher('submit');
  assert.equal(magasin.etat().composants[c.id].categorie, 'a_preciser');
  assert.match(dom.corps.textContent, /inexploitable/);
  assert.match(dom.corps.textContent, /hors ligne/);
});

test('apercuEnvoi : un intitulé qui parle d\'une personne ou d\'une allergie ne part pas, le nom part seul', () => {
  const composant = { nom: 'piperade', menu: 2 };
  for (const intitule of ['Poisson, piperade, pour Mme Dupont', 'Poisson sans gluten (allergie), piperade']) {
    const apercu = apercuEnvoi(composant, intitule);
    assert.equal(apercu.intitule, '');
    assert.ok(!apercu.texte.includes('Dupont') && !apercu.texte.toLowerCase().includes('allergie'));
  }
  assert.equal(apercuEnvoi(composant, 'Poisson, piperade').intitule, 'Poisson, piperade');
});

test('apercuEnvoi : filtre robuste (accents décomposés, sans accent, gluten), chiffres refusés dans l\'intitulé, menu validé', () => {
  const composant = { nom: 'piperade', menu: 2 };
  const bloques = ['Poisson, régime sans sel'.normalize('NFD'), 'Poisson pour celiaque', 'Pâtes sans gluten, piperade', 'Poisson sans lactose',
    'Poisson, piperade, 200 g', 'Menu à CHF 28.-'];
  for (const intitule of bloques) assert.equal(apercuEnvoi(composant, intitule).intitule, '', intitule);
  assert.equal(apercuEnvoi({ nom: 'pâtes sans gluten', menu: 1 }, 'Pâtes'), null);
  assert.equal(apercuEnvoi({ nom: 'piperade', menu: 3 }, 'Poisson'), null);
  assert.equal(apercuEnvoi(composant, 'Poisson, piperade').intitule, 'Poisson, piperade');
});

test('champsApresProposition : un légume ou un féculent va au poste, les autres catégories seulement la catégorie', () => {
  assert.deepEqual(champsApresProposition({ categorie: 'legume' }), { categorie: 'legume', attribue: true });
  assert.deepEqual(champsApresProposition({ categorie: 'feculent' }), { categorie: 'feculent', attribue: true });
  assert.deepEqual(champsApresProposition({ categorie: 'sauce' }), { categorie: 'sauce' });
});

test('fiche technique : « Demander à l\'IA » apparaît une seule fois, hors du repli « Plus de réglages »', async () => {
  const { c } = fiche();
  const vueFiche = await import('../app/js/ui/vue-fiche.js');
  const noeud = vueFiche.rendre(magasin.etat(), c.id);
  const ia = boutons(noeud).filter((b) => b.textContent === "Demander à l'IA");
  assert.equal(ia.length, 1);
  let parent = ia[0].parent ?? ia[0].parentNode;
  while (parent) { assert.notEqual(parent.id, 'fiche-reglages'); parent = parent.parent ?? parent.parentNode; }
});
