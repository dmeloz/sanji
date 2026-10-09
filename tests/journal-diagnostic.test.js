// Journal de diagnostic : stockage, écouteurs, appels IA, section de Réglages. Données TEST_ONLY ; aucun réseau réel.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

const CLE = `sk-${'ant'}-api03-TEST_ONLY_abc-123`;
const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
let dom; let J; let fw; let section; let ecouteurs; let docEcouteurs;

before(async () => {
  dom = installerFauxDom();
  ecouteurs = {}; docEcouteurs = {};
  globalThis.window.addEventListener = (t, f) => { (ecouteurs[t] ??= []).push(f); };
  globalThis.document.addEventListener = (t, f, c) => { (docEcouteurs[t] ??= []).push({ f, c }); };
  J = await import('../app/js/ui/journal-diagnostic.js');
  fw = await import('../app/js/ui/fournisseur-web.js');
  section = await import('../app/js/ui/section-diagnostic.js');
});
after(() => { dom.restaurer(); delete globalThis.localStorage; });

test('noter : nettoie, borne, refuse objets, masque la clé, ne touche pas h/type', () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  J.noter('clic', { libelle: 'L'.repeat(100), message: `m ${CLE}`, o: { a: 1 }, t: [1], n: 4, b: true, h: 'pirate', type: 'pirate' });
  const [e] = J.lireEvenements();
  assert.equal(e.libelle.length, 40);
  assert.equal(e.message.includes('sk-ant'), false);
  assert.equal('o' in e, false);
  assert.equal('t' in e, false);
  assert.equal(e.n, 4);
  assert.equal(e.type, 'clic');
  assert.notEqual(e.h, 'pirate');
});

test('anneau de 300 événements', () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  for (let i = 0; i < 305; i++) J.noter('navigation', { route: `#/${i}` });
  const l = J.lireEvenements();
  assert.equal(l.length, 300);
  assert.equal(l[299].route, '#/304');
});

test('purge des événements de plus de 14 jours', () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  const vieux = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();
  globalThis.localStorage.setItem('sanji-journal-diagnostic', JSON.stringify([{ h: vieux, type: 'clic' }]));
  J.noter('clic', { libelle: 'récent' });
  assert.equal(J.lireEvenements().length, 1);
});

test('repli mémoire sans localStorage utilisable', () => {
  globalThis.localStorage = { getItem() { throw new Error('non'); }, setItem() { throw new Error('non'); }, removeItem() { throw new Error('non'); } };
  J.effacerJournal();
  J.noter('clic', { libelle: 'a' });
  assert.equal(J.lireEvenements().length, 1);
  J.effacerJournal();
  assert.equal(J.lireEvenements().length, 0);
});

test('installerJournal : idempotent, capture erreur, rejet, clic de bouton, jamais un champ', () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  J.installerJournal();
  J.installerJournal();
  assert.equal(ecouteurs.error.length, 1);
  assert.equal(docEcouteurs.click.length, 1);
  assert.equal(docEcouteurs.click[0].c, true);
  assert.equal(J.lireEvenements().filter((e) => e.type === 'demarrage').length, 1);
  ecouteurs.error[0]({ message: `x ${CLE}`, filename: 'https://h/app/js/ui/a.js?v=2', lineno: 7, error: { stack: 'E\n at https://h/app/js/b.js:1\n at c\n at d\n at e' } });
  ecouteurs.unhandledrejection[0]({ reason: new Error('rejet') });
  const bouton = { textContent: '  Enregistrer la semaine ', closest: () => bouton };
  const champ = { textContent: 'SECRET_SAISIE_TEST', value: 'SECRET_SAISIE_TEST', closest: () => null };
  docEcouteurs.click[0].f({ target: bouton });
  docEcouteurs.click[0].f({ target: champ });
  const l = J.lireEvenements();
  const erreur = l.find((e) => e.type === 'erreur');
  assert.equal(erreur.fichier, 'a.js:7');
  assert.equal(erreur.pile.split(' | ').length, 3);
  assert.equal(JSON.stringify(l).includes('sk-ant'), false);
  assert.equal(JSON.stringify(l).includes('SECRET'), false);
  assert.equal(l.filter((e) => e.type === 'erreur').length, 2);
  assert.equal(l.find((e) => e.type === 'clic').libelle, 'Enregistrer la semaine');
  assert.equal(l.filter((e) => e.type === 'clic').length, 1);
});

const reponse = (status, corps) => ({ status, ok: status < 400, json: async () => corps });

test('envoyer : note ia avec le contenu rendu, sans requête, image ni clé (succès, 401, échec réseau)', async () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  const ok = fw.creerFournisseurWeb({ cle: CLE, fetchImpl: async () => reponse(200, { content: [{ type: 'tool_use', name: 'rendre_feuille', input: { lignes: ['LU_PAR_IA_TEST', ['sk-', 'ant-FAUSSE_DANS_LE_CONTENU'].join('')] } }] }) });
  await ok.demanderLecturePhoto({ media_type: 'image/jpeg', base64: 'SECRET_IMAGE_TEST' });
  const refus = fw.creerFournisseurWeb({ cle: CLE, fetchImpl: async () => reponse(401, { error: { type: 'auth', message: 'no' } }) });
  await assert.rejects(refus.demanderPrecision({ nom: 'SECRET_NOM_TEST', menu: 1, intitule: 'x' }), /HTTP 401/);
  const panne = fw.creerFournisseurWeb({ cle: CLE, fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(panne.demanderLectureFiche({ media_type: 'image/jpeg', base64: 'x' }), /offline/);
  const ia = J.lireEvenements().filter((e) => e.type === 'ia');
  assert.deepEqual(ia.map((e) => [e.outil, e.ok, e.statut]), [['rendre_feuille', true, 200], ['proposer_categorie', false, 401], ['rendre_fiche', false, 'reseau']]);
  assert.ok(ia.every((e) => typeof e.ms === 'number'));
  // Règle du 2026-10-07 : ce que l'IA a RENDU est gardé (borné), jamais la requête, l'image ni la clé.
  assert.match(ia[0].contenu, /LU_PAR_IA_TEST/);
  assert.match(ia[0].contenu, /\[clé masquée\]/);
  const brut = JSON.stringify(J.lireEvenements());
  for (const interdit of ['sk-ant', 'SECRET']) assert.equal(brut.includes(interdit), false);
});

test('photos de diagnostic : gardées durablement, 5 au plus, trop grosses ignorées, jamais dans le journal, effacées avec lui', async () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  const blob = (taille) => new Blob(['x'.repeat(taille)], { type: 'image/jpeg' });
  for (let i = 0; i < 7; i += 1) {
    await J.garderPhotoPourDiagnostic(i % 2 ? 'fiche' : 'feuille', blob(1000 + i));
    await new Promise((r) => { setTimeout(r, 2).ref?.(); }); // des heures distinctes, donc des clés distinctes
  }
  await J.garderPhotoPourDiagnostic('feuille', blob(900 * 1024));
  await J.garderPhotoPourDiagnostic('feuille', null);
  const gardees = await J.photosGardees();
  assert.deepEqual(gardees.map((p) => p.blob.size), [1002, 1003, 1004, 1005, 1006]);
  assert.deepEqual(gardees.map((p) => p.type), ['feuille', 'fiche', 'feuille', 'fiche', 'feuille']);
  J.noter('ia', { outil: 'rendre_feuille', ok: true });
  assert.equal(JSON.stringify(J.lireEvenements()).includes('image/jpeg'), false, 'aucune photo dans le journal');
  assert.ok(JSON.parse(globalThis.localStorage.getItem('sanji-photos-diagnostic')).length === 5, 'le registre des photos est gardé');
  J.effacerJournal();
  await new Promise((r) => { setTimeout(r, 20).ref?.(); });
  assert.equal((await J.photosGardees()).length, 0);
});

const texteDe = (n) => n.tous(() => true).map((e) => e.texte ?? '').join('') + n.textContent;
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);

test('section : bouton unique d\'envoi, effacement avec confirmation, indicateur', async () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  assert.equal(section.indicateurErreurs(), null);
  J.noter('erreur', { message: 'boom' });
  assert.match(section.indicateurErreurs().textContent, /1 erreur à me transmettre/);
  const s = section.sectionDiagnostic(etatVide());
  assert.match(texteDe(s), /Rien n'est envoyé/);
  for (const t of ['Partager le fichier', 'Effacer le journal']) assert.ok(parTexte(s, t), t);
  assert.equal(parTexte(s, 'Copier le diagnostic'), undefined);
  assert.equal(s.tous((e) => e.balise === 'textarea').length, 0, 'plus de repli textarea');
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  await parTexte(s, 'Effacer le journal').click();
  const d = panneauxOuverts(dom.corps)[0];
  assert.equal(J.lireEvenements().length, 1);
  await parTexte(d, 'Effacer').declencher('click').catch(() => {});
  await d.querySelector('form').declencher('submit');
  assert.equal(J.lireEvenements().length, 0);
  delete globalThis.navigator;
});

test('partage : le texte part avec les photos si l\'appareil accepte plusieurs fichiers, sinon le texte seul le dit', async () => {
  globalThis.localStorage = faux();
  J.effacerJournal();
  await J.garderPhotoPourDiagnostic('feuille', new Blob(['x'.repeat(2000)], { type: 'image/jpeg' }));
  await new Promise((r) => { setTimeout(r, 2).ref?.(); });
  await J.garderPhotoPourDiagnostic('fiche', new Blob(['y'.repeat(2000)], { type: 'image/jpeg' }));
  const partages = [];
  const regler = (accepteMultiples) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    canShare: ({ files }) => accepteMultiples || files.length === 1,
    share: async (donnees) => { partages.push(donnees.files); },
  } });
  const s = section.sectionDiagnostic(etatVide());
  regler(true);
  await parTexte(s, 'Partager le fichier').click();
  assert.deepEqual(partages[0].map((f) => f.name.replace(/\d{4}-\d{2}-\d{2}/, 'DATE')), ['sanji-diagnostic-DATE.txt', 'photo-feuille-1.jpg', 'photo-fiche-2.jpg']);
  assert.match(await partages[0][0].text(), /Photos jointes : 2/);
  regler(false);
  (await import('../app/js/ui/dernier-envoi.js')).effacerRepere(); // le second envoi ne redonne les photos que sans repère
  await parTexte(s, 'Partager le fichier').click();
  assert.equal(partages[1].length, 1);
  assert.match(await partages[1][0].text(), /Photos jointes : 0[^\n]*2 photo\(s\) gardées non jointes/);
  J.effacerJournal();
});

test('journal : écriture regroupée (pas un setItem par événement), relecture en mémoire, annulation notée « annule »', async () => {
  const stock = faux();
  let ecritures = 0;
  const setItem = stock.setItem;
  stock.setItem = (k, v) => { ecritures += 1; return setItem(k, v); };
  globalThis.localStorage = stock;
  J.effacerJournal();
  for (let i = 0; i < 20; i += 1) J.noter('clic', { libelle: `bouton ${i}` });
  assert.equal(ecritures, 0, 'aucune écriture synchrone à chaque événement');
  assert.equal(J.lireEvenements().length, 20, 'relu en mémoire, sans relire le stockage');
  await new Promise((r) => { setTimeout(r, 1200).ref?.(); }); // le faux DOM détache les minuteurs : on rattache celui-ci
  assert.equal(ecritures, 1, 'une seule écriture regroupée');
  assert.equal(JSON.parse(stock.m.get('sanji-journal-diagnostic')).length, 20);
  J.effacerJournal();
  const coupe = fw.creerFournisseurWeb({ cle: CLE, fetchImpl: async () => { throw Object.assign(new Error('abort'), { name: 'AbortError' }); } });
  await assert.rejects(coupe.demanderLectureFiche({ media_type: 'image/jpeg', base64: 'x' }));
  assert.equal(J.lireEvenements().filter((e) => e.type === 'ia')[0].statut, 'annule');
  J.effacerJournal();
});
