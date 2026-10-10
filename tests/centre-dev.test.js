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

test('marquer une note réglée rafraîchit la feuille : elle passe au groupe « Réglées » (comptée, « Voir »)', async () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  magasin.remplacer(etatVide());
  N.ajouterNote({ type: 'gene', texte: 'A_REGLER', ecran: 'X' });
  centre.ouvrirCentreDev();
  const f = dernier();
  await parTexte(f, 'Réglée').click();
  assert.equal(N.lireNotes()[0].etat, 'reglee');
  assert.equal(parTexte(f, 'Réglée'), undefined);
  assert.match(f.textContent, /Aucune nouvelle note\./);
  assert.match(f.textContent, /1 réglée/);
  assert.equal(f.textContent.includes('A_REGLER'), false, 'la note réglée n\'est plus détaillée dans la feuille');
});

const noteAvec = (o) => ({ id: o.id, type: 'bug', categorie: 'bug_gene', texte: o.texte ?? o.id, ecran: 'X', version: '112', h: new Date().toISOString(), gestes: [], ...o });

test('la feuille a trois groupes dans l\'ordre, sans liste à dérouler ; « Voir » ouvre une feuille de lecture (Réglée / Rouvrir)', async () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  magasin.remplacer(etatVide());
  globalThis.localStorage.setItem('sanji-notes-dev', JSON.stringify([noteAvec({ id: 'n', etat: 'nouvelle', texte: 'TXT_NOUVELLE' }),
    noteAvec({ id: 't', etat: 'transmise', texte: 'TXT_TRANSMISE' }), noteAvec({ id: 'r', etat: 'reglee', texte: 'TXT_REGLEE' })]));
  centre.ouvrirCentreDev();
  const f = dernier();
  const t = f.textContent;
  assert.ok(t.indexOf('Nouvelles') < t.indexOf('Transmises') && t.indexOf('Transmises') < t.indexOf('Réglées'));
  assert.match(t, /TXT_NOUVELLE/);
  assert.equal(t.includes('TXT_TRANSMISE') || t.includes('TXT_REGLEE'), false);
  assert.match(t, /1 transmise/);
  assert.match(t, /1 réglée/);
  assert.match(t, /Une note envoyée passe à « transmise » : elle ne repart plus\. Rouvrez-la si le problème est toujours là\./);
  assert.equal(f.tous((x) => x.balise === 'details').length, 0);
  assert.ok(parTexte(f, 'Supprimer'));
  const voir = boutons(f).filter((b) => b.textContent === 'Voir');
  assert.equal(voir.length, 2);
  await voir[0].click();
  const lecture = dernier();
  assert.match(lecture.textContent, /TXT_TRANSMISE/);
  assert.ok(parTexte(lecture, 'Réglée') && parTexte(lecture, 'Rouvrir'));
  await parTexte(lecture, 'Réglée').click();
  assert.equal(N.notesParEtat('reglee').length, 2);
  assert.match(lecture.textContent, /Aucune note\./, 'la feuille de lecture se redessine');
  assert.match(f.textContent, /2 réglées/, 'la feuille dessous aussi');
  await boutons(f).find((b) => b.textContent === 'Voir').click();
  const lectureReglees = dernier();
  assert.equal(parTexte(lectureReglees, 'Réglée'), undefined, 'une réglée ne se propose que de rouvrir');
  await boutons(lectureReglees).find((b) => b.textContent === 'Rouvrir').click();
  assert.equal(N.notesParEtat('nouvelle').length, 2);
  assert.match(f.textContent, /TXT_(TRANSMISE|REGLEE)/, 'la note rouverte revient dans les nouvelles');
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
    assert.equal(N.lireNotes()[0].etat, 'nouvelle', 'partage annulé : la note reste nouvelle');
    annule = false;
    await parTexte(f, 'Partager le fichier').click();
    assert.equal(zone.textContent, 'Envoyé ✓');
    assert.equal(zone.tous((x) => x.balise === 'svg').length, 1, 'avec une icône');
    assert.match(f.textContent, /Prochain envoi : 0 événement et 0 note nouvelle\./);
    assert.deepEqual(lireRepere().notesEnvoyees, [N.lireNotes()[0].id]);
    assert.equal(N.lireNotes()[0].etat, 'transmise', 'le lot envoyé passe à transmise');
    assert.match(f.textContent, /1 transmise/);
    assert.match(await partages[0][0].text(), /Depuis le dernier envoi|NOTE_ENVOI/, 'le premier envoi contient la note');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
  }
});

test('le repère d\'envoi vit hors de l\'état, se cumule et un second fichier ne redonne plus du tout la note transmise (seulement le compte)', async () => {
  globalThis.localStorage = faux(); J.effacerJournal(); N.effacerNotes();
  magasin.remplacer(etatVide());
  const { marquerEnvoi, effacerRepere } = await import('../app/js/ui/dernier-envoi.js');
  effacerRepere();
  N.ajouterNote({ type: 'idee', texte: 'VUE_DEJA', ecran: 'X' });
  const dejaEnvoyees = N.lireNotes().map((n) => n.id);
  marquerEnvoi({ h: new Date(Date.now() - 1000).toISOString(), notes: dejaEnvoyees });
  N.marquerTransmises(dejaEnvoyees); // un envoi réel fait les deux
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
    assert.match(t, /1 notes déjà transmises : non répétées\./);
    assert.equal(t.includes('VUE_DEJA'), false, 'la note déjà transmise n\'apparaît plus, même en ligne courte');
    assert.equal(N.notesParEtat('transmise').length, 2, 'NEUVE passe à transmise après ce partage');
    // rouvrir : la note repart
    const vue = N.lireNotes().find((n) => n.texte === 'VUE_DEJA');
    N.definirEtatNote(vue.id, 'nouvelle');
    await parTexte(f, 'Partager le fichier').click();
    assert.match(await fichier.text(), /VUE_DEJA/, 'rouverte : elle repart dans le prochain fichier');
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
    assert.equal(N.lireNotes()[0].etat, 'nouvelle', 'téléchargement de repli : la note reste nouvelle');
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
    assert.equal(textes.find((n) => n.texte === 'DANS_LE_FICHIER').etat, 'transmise');
    assert.equal(textes.find((n) => n.texte === 'ARRIVEE_PENDANT_LE_PARTAGE').etat, 'nouvelle', 'créée pendant le partage : jamais transmise');
  } finally {
    globalThis.URL.createObjectURL = urlOriginale;
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    effacerRepere();
  }
});

test('migration : une note `ouverte` se lit nouvelle, ou transmise si son id est dans le repère d\'envoi ; rien n\'est perdu', async () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  const { marquerEnvoi, effacerRepere } = await import('../app/js/ui/dernier-envoi.js');
  effacerRepere();
  globalThis.localStorage.setItem('sanji-notes-dev', JSON.stringify([noteAvec({ id: 'a', etat: 'ouverte' }), noteAvec({ id: 'b', etat: 'ouverte' }), noteAvec({ id: 'c', etat: 'reglee' })]));
  marquerEnvoi({ h: new Date().toISOString(), notes: ['b', 'c'] });
  const etats = Object.fromEntries(N.lireNotes().map((n) => [n.id, n.etat]));
  assert.deepEqual(etats, { a: 'nouvelle', b: 'transmise', c: 'reglee' });
  effacerRepere();
});

test('compteurs : « Prochain envoi », carte et résumé de Réglages ne comptent que les notes nouvelles ; la pastille Dev n\'a pas de compteur', async () => {
  globalThis.localStorage = faux(); N.effacerNotes(); J.effacerJournal();
  magasin.remplacer(etatVide());
  globalThis.localStorage.setItem('sanji-notes-dev', JSON.stringify([noteAvec({ id: 'n', etat: 'nouvelle' }), noteAvec({ id: 't', etat: 'transmise' }), noteAvec({ id: 'r', etat: 'reglee' })]));
  centre.ouvrirCentreDev();
  assert.match(dernier().textContent, /Prochain envoi : \d+ événements? et 1 note nouvelle\./);
  const { resumeApprentissage } = await import('../app/js/ui/section-apprentissage.js');
  assert.match(resumeApprentissage(magasin.etat()), /1 note nouvelle$/);
  assert.match(reglages.rendre(magasin.etat(), 'apprentissage').textContent, /1 note nouvelle · \d+ événements? noté/);
  N.installerPastilleDev();
  assert.equal(dom.corps.tous((e) => e.attributs.id === 'pastille-dev')[0].textContent, 'Dev');
});

test('les états des notes vivent hors de l\'état : l\'export de l\'état ne les contient pas', () => {
  globalThis.localStorage = faux(); N.effacerNotes();
  magasin.remplacer(etatVide());
  const avant = JSON.stringify(magasin.etat());
  N.ajouterNote({ type: 'bug', texte: 'HORS_ETAT_TRANSMISE', ecran: 'X' });
  N.marquerTransmises(N.lireNotes().map((n) => n.id));
  assert.equal(N.lireNotes()[0].etat, 'transmise');
  assert.equal(JSON.stringify(magasin.etat()), avant);
  assert.equal(avant.includes('HORS_ETAT_TRANSMISE'), false);
});
