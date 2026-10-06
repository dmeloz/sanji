// Assistant IA dans l'interface (faux DOM) : réglages hors sauvegarde, rubrique Réglages, bouton et feuille « Brouillon »,
// validation du chef. Données TEST_ONLY ; la clé est une fausse clé courte ; aucun réseau (fetch simulé).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exporter } from '../app/js/domaine/etat.js';
import { fournisseurDesactive } from '../app/js/harness/fournisseur.js';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

const FAUSSE_CLE = 'sk-ant-FAUX1234';

let dom;
let magasin;
let reglages;
let assistant;
let web;
let vueReglages;
let vueProduction;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  reglages = await import('../app/js/ui/assistant-reglages.js');
  assistant = await import('../app/js/ui/assistant-planning.js');
  web = await import('../app/js/ui/fournisseur-web.js');
  vueReglages = await import('../app/js/ui/vue-reglages.js');
  vueProduction = await import('../app/js/ui/vue-production.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

const ouverts = () => panneauxOuverts(dom.corps);
const parTexte = (racine, motif) => boutons(racine).find((b) => motif.test(b.textContent));
// Le faux DOM rend les minuteries « unref » : on attend avec setImmediate.
const attendre = () => new Promise((resoudre) => setImmediate(resoudre));
const fermerTout = () => { for (const d of ouverts()) d.close(); };

function etatLundi() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  prevision(e, S.lundi, 2, 30);
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const cru = composantValide(e, S.lundi, 2, J.PRODUIT_CRU_TEST);
  return { e, pSec: principaleDe(e, sec), pCru: principaleDe(e, cru) };
}

test('réglages : valeurs par défaut sûres, activation, modèle et clé nettoyés, rien d\'inconnu accepté', () => {
  reglages.effacerReglagesIA();
  assert.deepEqual(reglages.lireReglagesIA(), { actif: false, cle: '', modele: 'claude-opus-5-5' });
  assert.equal(reglages.assistantPret(), false);
  // Une clé collée avec des caractères invisibles ou du texte autour est ramenée à la clé seule.
  const r = reglages.enregistrerReglagesIA({ cle: `\u001b[200~ ${FAUSSE_CLE}\n\u001b[201~`, actif: true, modele: 'claude-sonnet-5-5' });
  assert.deepEqual(r, { actif: true, cle: FAUSSE_CLE, modele: 'claude-sonnet-5-5' });
  assert.equal(reglages.assistantPret(), true);
  assert.throws(() => reglages.enregistrerReglagesIA({ cle: 'pas une clé' }), /ne ressemble pas à une clé/);
  assert.throws(() => reglages.enregistrerReglagesIA({ modele: 'gpt-inconnu' }), /Modèle inconnu/);
  assert.equal(reglages.lireReglagesIA().cle, FAUSSE_CLE, 'un refus ne change rien');
  assert.equal(reglages.cleMasquee(FAUSSE_CLE), 'sk-ant-…1234');
  assert.equal(reglages.cleMasquee(''), 'aucune clé');
  reglages.enregistrerReglagesIA({ cle: '   ' });
  assert.equal(reglages.lireReglagesIA().cle, '', 'une saisie vide efface la clé');
  reglages.effacerReglagesIA();
  assert.equal(reglages.lireReglagesIA().actif, false);
});

test('réglages : stockage local utilisé quand il existe, données illisibles ignorées', () => {
  const magasinLocal = new Map();
  globalThis.localStorage = {
    getItem: (c) => magasinLocal.get(c) ?? null, setItem: (c, v) => magasinLocal.set(c, v), removeItem: (c) => magasinLocal.delete(c),
  };
  try {
    reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
    assert.deepEqual([...magasinLocal.keys()], ['sanji-assistant-ia']);
    assert.equal(JSON.parse(magasinLocal.get('sanji-assistant-ia')).cle, FAUSSE_CLE);
    magasinLocal.set('sanji-assistant-ia', '{pas du json');
    assert.deepEqual(reglages.lireReglagesIA(), { actif: false, cle: '', modele: 'claude-opus-5-5' });
    magasinLocal.set('sanji-assistant-ia', JSON.stringify({ actif: true, cle: '<script>', modele: 'x' }));
    assert.deepEqual(reglages.lireReglagesIA(), { actif: true, cle: '', modele: 'claude-opus-5-5' }, 'valeurs invalides remplacées par des valeurs sûres');
    reglages.effacerReglagesIA();
    assert.equal(magasinLocal.size, 0);
  } finally {
    delete globalThis.localStorage;
  }
});

test('la clé n\'est jamais dans la sauvegarde ni dans le journal', () => {
  reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
  const { e } = etatLundi();
  magasin.remplacer(e);
  const exporte = exporter(magasin.etat(), h());
  assert.ok(!exporte.includes('FAUX1234') && !exporte.includes('sanji-assistant-ia'));
  reglages.effacerReglagesIA();
});

test('fournisseur : désactivé sans clé ou sans activation, sinon le modèle choisi ; Haiku sans « effort »', () => {
  assert.equal(reglages.fournisseurDepuisReglages({ actif: false, cle: FAUSSE_CLE, modele: 'claude-opus-5-5' }), fournisseurDesactive);
  assert.equal(reglages.fournisseurDepuisReglages({ actif: true, cle: '', modele: 'claude-opus-5-5' }), fournisseurDesactive);
  const f = reglages.fournisseurDepuisReglages({ actif: true, cle: FAUSSE_CLE, modele: 'claude-sonnet-5-5' }, { fetchImpl: async () => {} });
  assert.equal(f.nom, 'anthropic:claude-sonnet-5-5');
  assert.equal(f.disponible(), true);
  const requete = { contexte: {}, brouillonDeterministe: {} };
  assert.deepEqual(web.construireCorps(requete, { modele: 'claude-opus-5-5', maxTokens: 1, effort: 'low' }).output_config, { effort: 'low' });
  assert.ok(!('output_config' in web.construireCorps(requete, { modele: 'claude-haiku-4-5', maxTokens: 1, effort: 'low' })));
  assert.deepEqual(web.MODELES.map((m) => m.id), ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5']);
});

test('fournisseur : en-têtes d\'un appel navigateur, clé seulement dans l\'en-tête', async () => {
  const appels = [];
  const fetchImpl = async (url, options) => {
    appels.push({ url, options });
    return { status: 200, ok: true, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'rendre_brouillon', input: { type: 'planning', items: [] } }] }) };
  };
  await web.creerFournisseurWeb({ cle: FAUSSE_CLE, fetchImpl }).demander({ contexte: {}, brouillonDeterministe: {} }, {});
  assert.equal(appels[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(appels[0].options.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(appels[0].options.headers['x-api-key'], FAUSSE_CLE);
  assert.ok(!appels[0].options.body.includes('FAUX1234'));
});

test('hygiène : seul fournisseur-web.js nomme l\'API Anthropic ou lit le fetch global dans app/', () => {
  const racine = fileURLToPath(new URL('../app/', import.meta.url));
  const parcourir = (dossier) => readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? parcourir(chemin) : [chemin];
  });
  const fichiers = parcourir(racine).filter((f) => /\.(js|html|css|webmanifest)$/.test(f));
  const nomment = fichiers.filter((f) => /api\.anthropic\.com|globalThis\.fetch/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(racine.length));
  assert.deepEqual(nomment, ['js/ui/fournisseur-web.js']);
});

test('rubrique Réglages > Assistant IA : état, clé masquée, jamais la clé entière', () => {
  reglages.effacerReglagesIA();
  magasin.remplacer(etatVide());
  let page = vueReglages.rendre(magasin.etat(), 'assistant-ia');
  assert.match(page.textContent, /Assistant IA/);
  assert.match(page.textContent, /désactivé/);
  assert.match(page.textContent, /aucune clé/);
  assert.match(page.textContent, /les fiches de fonction et les allergies ne sont pas transmises/);
  assert.match(page.textContent, /clé réservée à Sanji, avec une limite de dépense basse/);
  assert.ok(parTexte(page, /^Saisir la clé$/));
  assert.equal(parTexte(page, /Effacer la clé/), undefined);
  reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
  page = vueReglages.rendre(magasin.etat(), 'assistant-ia');
  assert.match(page.textContent, /activé/);
  assert.match(page.textContent, /sk-ant-…1234/);
  assert.ok(!page.textContent.includes(FAUSSE_CLE), 'la clé entière n\'est jamais affichée');
  assert.ok(parTexte(page, /Effacer la clé/));
  const racine = vueReglages.rendre(magasin.etat(), null);
  assert.match(racine.textContent, /Assistant IA/);
  reglages.effacerReglagesIA();
});

test('rubrique Réglages : la saisie de la clé est un champ masqué et l\'enregistrement la nettoie', async () => {
  reglages.effacerReglagesIA();
  magasin.remplacer(etatVide());
  fermerTout();
  const page = vueReglages.rendre(magasin.etat(), 'assistant-ia');
  parTexte(page, /^Saisir la clé$/).click();
  const [dialogue] = ouverts();
  const champ = dialogue.tous((x) => x.balise === 'input')[0];
  assert.equal(champ.attributs.type, 'password');
  champ.value = `  ${FAUSSE_CLE}  `;
  await dialogue.querySelector('form').declencher('submit');
  assert.equal(reglages.lireReglagesIA().cle, FAUSSE_CLE);
  fermerTout();
  parTexte(page, /^Saisir la clé$/).click();
  const [autre] = ouverts();
  autre.tous((x) => x.balise === 'input')[0].value = 'pas une clé';
  await autre.querySelector('form').declencher('submit');
  assert.match(autre.textContent, /ne ressemble pas à une clé/, 'l\'erreur reste dans le panneau');
  assert.equal(reglages.lireReglagesIA().cle, FAUSSE_CLE, 'rien n\'est changé');
  fermerTout();
  reglages.effacerReglagesIA();
});

test('période : de la date (ou d\'aujourd\'hui) au samedi ; un dimanche vise la semaine suivante', () => {
  assert.deepEqual(assistant.periodeDePlanning(S.lundi, S.lundi), { dateDebut: S.lundi, dateFin: S.samedi });
  assert.deepEqual(assistant.periodeDePlanning(S.mardi, S.lundi), { dateDebut: S.mardi, dateFin: S.samedi });
  assert.deepEqual(assistant.periodeDePlanning(S.veille, S.lundi), { dateDebut: S.lundi, dateFin: S.samedi }, 'une date passée commence aujourd\'hui');
  assert.deepEqual(assistant.periodeDePlanning(S.dimanche, S.dimanche), { dateDebut: S.lundiSuivant, dateFin: '2026-10-17' });
  assert.deepEqual(assistant.periodeDePlanning(S.lundiSuivant, S.lundi), { dateDebut: S.lundiSuivant, dateFin: '2026-10-17' });
});

test('vue Production : le bouton « Proposer un planning » est présent', () => {
  magasin.remplacer(etatLundi().e);
  const page = aDate(S.lundi, () => vueProduction.rendre(magasin.etat(), S.lundi));
  assert.ok(parTexte(page, /^Proposer un planning$/));
});

test('contenu du brouillon : préparations, jour et créneau, quantité, « Rien n\'est enregistré », pourquoi', async () => {
  const { e } = etatLundi();
  const { proposerPlanningAssiste } = await import('../app/js/harness/orchestrateur.js');
  const { creerRegistre } = await import('../app/js/harness/propositions.js');
  const r = await proposerPlanningAssiste({
    etat: e, h: '2026-10-05T07:00:00', aujourdhui: S.lundi, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(),
  });
  const noeuds = assistant.contenuProposition(r.proposition, r);
  const texte = noeuds.map((n) => n.textContent ?? String(n)).join(' ');
  assert.match(texte, /calculé par Sanji/);
  assert.match(texte, /2 préparations à planifier\. Rien n'est enregistré avant votre validation/);
  assert.match(texte, /PRODUIT_SEC_TEST/);
  assert.match(texte, /PRODUIT_CRU_TEST/);
  assert.match(texte, /Pourquoi cette proposition/);
});

test('flux sans IA : proposer, rien n\'est enregistré, « Valider et planifier » planifie et trace', async () => {
  reglages.effacerReglagesIA();
  fermerTout();
  const { e, pSec, pCru } = etatLundi();
  magasin.remplacer(e);
  const promesse = aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  assert.match(ouverts()[0].textContent, /Calcul en cours/);
  assert.match(ouverts()[0].textContent, /sans IA/);
  await promesse;
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  assert.ok(brouillon, 'le brouillon est ouvert');
  assert.equal(ouverts().length, 1, 'la fenêtre d\'attente est fermée');
  assert.match(brouillon.textContent, /PRODUIT_CRU_TEST/);
  assert.equal(magasin.etat().productions[pSec].jourDecide, null, 'rien n\'est enregistré avant la validation');
  await aDate(S.lundi, () => brouillon.querySelector('form').declencher('submit'));
  for (const id of [pSec, pCru]) assert.equal(magasin.etat().productions[id].jourDecide, S.lundi);
  const actions = magasin.etat().journal.map((j) => j.action);
  assert.ok(actions.includes('harness:validee') && actions.includes('harness:appliquee') && actions.includes('planifier'));
  fermerTout();
});

test('flux : « Refuser » n\'écrit que la trace du refus', async () => {
  fermerTout();
  const { e, pSec } = etatLundi();
  magasin.remplacer(e);
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  parTexte(brouillon, /^Refuser$/).click();
  await attendre();
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  assert.ok(magasin.etat().journal.some((j) => j.action === 'harness:refusee'));
  assert.ok(!magasin.etat().journal.some((j) => j.action === 'planifier'));
  fermerTout();
});

test('flux : si l\'état change avant la validation, la proposition est refusée et rien n\'est écrit', async () => {
  fermerTout();
  const { e, pSec } = etatLundi();
  magasin.remplacer(e);
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  const { definirCreneau } = await import('../app/js/domaine/actions.js');
  magasin.agir((etat, t) => definirCreneau(etat, S.lundi, 'avant_midi', 'charge', t));
  await aDate(S.lundi, () => brouillon.querySelector('form').declencher('submit'));
  assert.equal(ouverts().length, 0, 'le brouillon périmé est fermé : pas d\'impasse avec un second clic');
  const messages = dom.document.getElementById('messages').textContent;
  assert.match(messages, /L'état a changé|n'est plus valide/);
  assert.match(messages, /Rien n'a été planifié : relancez « Proposer un planning »/);
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  // Le bouton redevient utilisable : une nouvelle proposition tient compte du créneau devenu chargé (rien n'est forcé).
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  assert.match(ouverts()[0].textContent, /Rien à planifier sur cette période/);
  assert.match(ouverts()[0].textContent, /aucun créneau libre/);
  fermerTout();
});

test('le bouton ne reste jamais bloqué : un échec d\'ouverture de la fenêtre est dit et le clic suivant fonctionne', async () => {
  fermerTout();
  const { Element } = await import('./aide-dom.js');
  magasin.remplacer(etatLundi().e);
  const original = Element.prototype.showModal;
  Element.prototype.showModal = () => { throw new Error('affichage impossible'); };
  try {
    await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  } finally {
    Element.prototype.showModal = original;
  }
  assert.match(dom.document.getElementById('messages').textContent, /Planning impossible : affichage impossible/);
  fermerTout();
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  assert.ok(ouverts().find((d) => /Brouillon de planning/.test(d.textContent)), 'le verrou a été relâché');
  fermerTout();
});

test('le brouillon rappelle la période concernée', async () => {
  fermerTout();
  magasin.remplacer(etatLundi().e);
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  assert.match(ouverts()[0].textContent, /Période : du lundi 5 octobre au samedi 10 octobre\./);
  fermerTout();
});

test('effacer la clé : un échec du stockage est dit, jamais présenté comme un succès', () => {
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ actif: true, cle: FAUSSE_CLE, modele: 'claude-opus-5-5' }),
    setItem: () => {}, removeItem: () => { throw new Error('refusé'); },
  };
  try {
    assert.throws(() => reglages.effacerReglagesIA(), /Impossible d'effacer la clé/);
  } finally {
    delete globalThis.localStorage;
    reglages.effacerReglagesIA();
  }
});

test('flux avec le modèle : la proposition affiche son origine et reste soumise à la validation', async () => {
  fermerTout();
  const { e, pSec, pCru } = etatLundi();
  magasin.remplacer(e);
  reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
  const reelle = globalThis.fetch;
  const corpsEnvoyes = [];
  globalThis.fetch = async (url, options) => {
    corpsEnvoyes.push(options.body);
    const items = [{ productionId: pSec, date: S.lundi, creneau: 'apres_midi' }, { productionId: pCru, date: S.lundi, creneau: 'avant_midi' }];
    return { status: 200, ok: true, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'rendre_brouillon', input: { type: 'planning', items, incertitudes: ['charge du matin'] } }] }) };
  };
  try {
    const promesse = aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
    assert.match(ouverts()[0].textContent, /claude-opus-5-5 est consulté/);
    await promesse;
  } finally {
    globalThis.fetch = reelle;
    reglages.effacerReglagesIA();
  }
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  assert.match(brouillon.textContent, /proposé par l'IA, recontrôlé/);
  assert.match(brouillon.textContent, /modèle : charge du matin/);
  assert.equal(corpsEnvoyes.length, 1);
  assert.ok(!/allerg|couverts|remarque/i.test(corpsEnvoyes[0]), 'aucune fiche ni allergie dans la requête');
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  await aDate(S.lundi, () => brouillon.querySelector('form').declencher('submit'));
  assert.equal(magasin.etat().productions[pSec].creneauDecide, 'apres_midi');
  fermerTout();
});

test('flux : modèle en panne ou clé refusée, le calcul répond avec un avertissement', async () => {
  fermerTout();
  const { e } = etatLundi();
  magasin.remplacer(e);
  reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
  const reelle = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  try {
    await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  } finally {
    globalThis.fetch = reelle;
    reglages.effacerReglagesIA();
  }
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  assert.ok(brouillon);
  assert.match(brouillon.textContent, /calculé par Sanji/);
  assert.match(brouillon.textContent, /HTTP 401/);
  assert.ok(!brouillon.textContent.includes(FAUSSE_CLE));
  fermerTout();
});

test('flux : rien à planifier = message clair, aucun bouton de validation', async () => {
  fermerTout();
  magasin.remplacer(etatVide());
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  const [dialogue] = ouverts();
  assert.match(dialogue.textContent, /Rien à planifier sur cette période/);
  assert.equal(parTexte(dialogue, /Valider et planifier/), undefined);
  fermerTout();
});

test('flux : fermer la fenêtre d\'attente annule la demande', async () => {
  fermerTout();
  const { e, pSec } = etatLundi();
  magasin.remplacer(e);
  reglages.enregistrerReglagesIA({ cle: FAUSSE_CLE, actif: true });
  const reelle = globalThis.fetch;
  globalThis.fetch = (url, options) => new Promise((resoudre, rejeter) => {
    options.signal.addEventListener('abort', () => rejeter(new Error('interrompu')));
  });
  try {
    const promesse = aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
    ouverts()[0].close();
    await promesse;
  } finally {
    globalThis.fetch = reelle;
    reglages.effacerReglagesIA();
  }
  assert.equal(ouverts().length, 0, 'aucun brouillon n\'est affiché après une annulation');
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
});
