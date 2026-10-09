// Centre « Notes et diagnostic » : feuille unique pour le fichier partagé, les notes et l'effacement. Données TEST_ONLY ; aucun réseau.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);
let dom; let centre; let N; let J; let essai; let magasin; let reglages;

before(async () => {
  dom = installerFauxDom();
  globalThis.localStorage = faux();
  centre = await import('../app/js/ui/centre-dev.js');
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
  for (const t of ['Partager le fichier', 'Copier le diagnostic', 'Effacer le journal']) assert.ok(parTexte(f, t), t);
  assert.match(f.textContent, /Notes et diagnostic/);
  assert.match(f.textContent, /Un seul geste : tout part dans le même fichier/);
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
