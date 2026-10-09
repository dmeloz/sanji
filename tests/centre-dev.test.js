// Centre « Notes et diagnostic » : feuille unique pour le fichier partagé, les notes et l'effacement. Données TEST_ONLY ; aucun réseau.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);
let lireRepere; let dom; let centre; let N; let J; let essai; let magasin; let reglages;

before(async () => {
  dom = installerFauxDom();
  globalThis.localStorage = faux();
  centre = await import('../app/js/ui/centre-dev.js');
  ({ lireRepere } = await import('../app/js/ui/dernier-envoi.js'));
  N = await import('../app/js/ui/notes-dev.js');
  J = await import('../app/js/ui/journal-diagnostic.js');
  essai = await import('../app/js/ui/retours-essai.js');
  magasin = await import('../app/js/magasin.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => { dom.restaurer(); delete globalThis.localStorage; });

const dernier = () => panneauxOuverts(dom.corps).at(-1);

test('le centre réunit envoi, liste des notes et effacement du journal', () => {
  globalThis.localStorage = faux(); N.effacerNotes(); J.effacerJournal();
  magasin.remplacer(etatVide());
  J.noter('erreur', { message: 'boom' });
  N.ajouterNote({ type: 'idee', texte: 'NOTE_CENTRE', ecran: 'Semaine' });
  centre.ouvrirCentreDev();
  const f = dernier();
  for (const t of ['Partager le fichier', 'Effacer le journal']) assert.ok(parTexte(f, t), t);
  assert.equal(parTexte(f, 'Copier le diagnostic'), undefined, 'plus de bouton Copier');
  assert.match(f.textContent, /Prochain envoi : 1 événement et 1 note nouvelle\./);
  assert.match(f.textContent, /Notes et diagnostic/);
  assert.match(f.textContent, /Un seul geste : ce qui est nouveau depuis le dernier envoi part dans le même fichier/);
  assert.match(f.textContent, /NOTE_CENTRE/);
});

test('la feuille de saisie propose « Notes et fichier à partager », qui ouvre le centre', async () => {
  globalThis.localStorage = faux();
  const avant = panneauxOuverts(dom.corps).length;
  N.ouvrirFeuilleNote({ ecran: 'Test', gestes: [] });
  const saisie = dernier();
  await parTexte(saisie, 'Notes et fichier à partager').click();
  const f = dernier();
  assert.ok(panneauxOuverts(dom.corps).length > avant);
  assert.ok(parTexte(f, 'Partager le fichier'));
});

test('Réglages > Apprentissage : une seule carte Notes et diagnostic, plus les trois anciennes', async () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  magasin.remplacer(etatVide());
  const page = reglages.rendre(magasin.etat(), 'apprentissage');
  const t = page.textContent;
  assert.ok(t.includes('Notes et diagnostic'));
  assert.ok(t.includes('Pastille « Dev » sur chaque écran'));
  for (const ancien of ['Retours d\'essai', 'Notes de test', 'Journal de diagnostic']) assert.equal(t.includes(ancien), false, ancien);
  assert.equal(parTexte(page, 'Copier le rapport'), undefined);
  await parTexte(page, 'Ouvrir notes et diagnostic').click();
  assert.ok(parTexte(dernier(), 'Partager le fichier'));
});

test('effacer le journal depuis le centre efface aussi les retours d\'essai', async () => {
  globalThis.localStorage = faux(); N.effacerNotes(); J.effacerJournal(); essai.effacerRetours();
  magasin.remplacer(etatVide());
  essai.noterRetour({ type: 'menu', lu: ['a'], final: {} });
  N.ajouterNote({ type: 'bug', texte: 'RESTE', ecran: 'X' });
  centre.ouvrirCentreDev();
  await parTexte(dernier(), 'Effacer le journal').click();
  const conf = dernier();
  assert.match(conf.textContent, /retours d'essai gardés sur cet appareil seront supprimés/);
  assert.equal(essai.lireRetours().length, 1, 'rien avant la confirmation');
  await conf.querySelector('form').declencher('submit');
  assert.equal(essai.lireRetours().length, 0);
  assert.equal(N.lireNotes().length, 1, 'les notes ne changent pas');
});

test('marquer une note réglée rafraîchit la feuille', async () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  magasin.remplacer(etatVide());
  N.ajouterNote({ type: 'gene', texte: 'A_REGLER', ecran: 'X' });
  centre.ouvrirCentreDev();
  const f = dernier();
  await parTexte(f, 'Réglée').click();
  assert.equal(N.lireNotes()[0].etat, 'reglee');
  assert.ok(parTexte(f, 'Rouvrir'), 'la feuille montre le nouvel état');
  assert.equal(parTexte(f, 'Réglée'), undefined);
});

test('« Envoyé ✓ » apparaît DANS la feuille après un partage réussi, la ligne « Prochain envoi » repart de zéro, un partage annulé ne marque rien', async () => {
  globalThis.localStorage = faux(); J.effacerJournal(); N.effacerNotes();
  magasin.remplacer(etatVide());
  N.ajouterNote({ type: 'idee', texte: 'NOTE_ENVOI', ecran: 'X' });
  let annule = true;
  const partages = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, userAgent: 'test', canShare: () => true,
    share: async (d) => { if (annule) throw new DOMException('annulé', 'AbortError'); partages.push(d.files); } } });
  try {
    centre.ouvrirCentreDev();
    const f = dernier();
    const zone = f.tous((x) => x.attributs.role === 'status' && x.className.includes('envoi-statut'))[0];
    assert.ok(zone, 'zone role="status" dans la feuille');
    assert.match(parTexte(f, 'Partager le fichier').className, /btn-principal/);
    await parTexte(f, 'Partager le fichier').click();
    assert.equal(zone.textContent, '', 'partage annulé : pas de confirmation');
    assert.equal(lireRepere(), null, 'partage annulé : rien marqué');
    annule = false;
    await parTexte(f, 'Partager le fichier').click();
    assert.equal(zone.textContent, 'Envoyé ✓');
    assert.equal(zone.tous((x) => x.balise === 'svg').length, 1, 'avec une icône');
    assert.match(f.textContent, /Prochain envoi : 0 événement et 0 note nouvelle\./);
    assert.deepEqual(lireRepere().notesEnvoyees, [N.lireNotes()[0].id]);
    assert.match(await partages[0][0].text(), /Depuis le dernier envoi|NOTE_ENVOI/, 'le premier envoi contient la note');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
  }
});

test('le repère d\'envoi vit hors de l\'état, se cumule et un second fichier ne redonne pas la note déjà vue', async () => {
  globalThis.localStorage = faux(); J.effacerJournal(); N.effacerNotes();
  magasin.remplacer(etatVide());
  const { marquerEnvoi, effacerRepere } = await import('../app/js/ui/dernier-envoi.js');
  effacerRepere();
  N.ajouterNote({ type: 'idee', texte: 'VUE_DEJA', ecran: 'X' });
  marquerEnvoi({ h: new Date(Date.now() - 1000).toISOString(), notes: N.lireNotes().map((n) => n.id) });
  assert.ok(globalThis.localStorage.getItem('sanji-dernier-envoi'));
  assert.equal(JSON.stringify(magasin.etat()).includes('sanji-dernier-envoi'), false);
  let fichier = null;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share: async (d) => { fichier = d.files[0]; } } });
  try {
    N.ajouterNote({ type: 'bug', texte: 'NEUVE', ecran: 'Y' });
    centre.ouvrirCentreDev();
    const f = dernier();
    assert.match(f.textContent, /Prochain envoi : \d+ événements? et 1 note nouvelle\./);
    await parTexte(f, 'Partager le fichier').click();
    const t = await fichier.text();
    assert.match(t, /Depuis le dernier envoi \(.*\) : \d+ événements, 1 notes nouvelles/);
    assert.match(t, /NEUVE/);
    assert.match(t, /1 notes déjà transmises, toujours ouvertes :\n {2}- VUE_DEJA/);
    assert.equal(t.split('VUE_DEJA').length - 1, 1, 'la note déjà vue n\'apparaît qu\'une fois, en ligne courte');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    effacerRepere();
  }
});

test('sans partage natif : « Fichier téléchargé », le repère n\'avance pas ; une note créée pendant le partage n\'est pas marquée envoyée', async () => {
  globalThis.localStorage = faux(); J.effacerJournal(); N.effacerNotes();
  magasin.remplacer(etatVide());
  const { effacerRepere } = await import('../app/js/ui/dernier-envoi.js');
  effacerRepere();
  N.ajouterNote({ type: 'idee', texte: 'DANS_LE_FICHIER', ecran: 'X' });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const urlOriginale = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = () => 'blob:test';
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    centre.ouvrirCentreDev();
    const f = dernier();
    await parTexte(f, 'Partager le fichier').click();
    assert.match(f.textContent, /Fichier téléchargé/);
    assert.doesNotMatch(f.textContent, /Envoyé ✓/);
    assert.equal(lireRepere(), null, 'rien n\'est parti : pas de repère');
    assert.match(f.textContent, /Prochain envoi : \d+ événements? et 1 note nouvelle\./);

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share: async () => {
      N.ajouterNote({ type: 'bug', texte: 'ARRIVEE_PENDANT_LE_PARTAGE', ecran: 'Y' });
    } } });
    await parTexte(f, 'Partager le fichier').click();
    assert.match(f.textContent, /Envoyé ✓/);
    const textes = N.lireNotes();
    const envoyees = lireRepere().notesEnvoyees;
    assert.equal(envoyees.length, 1);
    assert.equal(textes.find((n) => n.id === envoyees[0]).texte, 'DANS_LE_FICHIER');
  } finally {
    globalThis.URL.createObjectURL = urlOriginale;
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    effacerRepere();
  }
});
