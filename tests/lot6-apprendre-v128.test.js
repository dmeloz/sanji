// Lot 6 (v128) : lignes parasites apprises (`etat.lignes_ignorees`), mots proposés depuis une note Dev, modes de préparation appris.
// Rien d'appris n'est appliqué sans un geste de la propriétaire. Données génériques, aucune donnée de restaurant.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, figerHorloge, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';
import { etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { analyserFeuille, repartirSurSemaine } from '../app/js/domaine/feuille.js';
import { LIGNES_MAX, cleLigne, lignesIgnoreesValides } from '../app/js/domaine/lignes-ignorees.js';
import { ignorerLigne, oublierLigne, enseignerMot } from '../app/js/domaine/actions-mots.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';
import { CATEGORIES_MOT, motsValides } from '../app/js/domaine/mots-retenus.js';
import { motsDansNote } from '../app/js/domaine/notes-dev.js';

const H = '2026-10-12T10:00:00.000Z';
const aller = (etat) => importer(exporter(etat, H));
const FEUILLE = ['Menu du marché', 'Lundi 5 octobre', 'Soupe du jour', 'Pâtes au beurre', 'Riz pilaf', 'Merci de votre visite chez nous'].join('\n');
const FEUILLE_3 = ['Lundi 5 octobre', 'Soupe du jour', 'Pâtes au beurre', 'Offre spéciale du chef'].join('\n');

// ------------------------------------------------------------- P14 : lignes apprises

test('etatInitial porte lignes_ignorees ; un ancien état sans le champ s\'importe sans erreur', () => {
  assert.deepEqual(etatInitial().lignes_ignorees, {});
  const doc = JSON.parse(exporter(etatInitial(), H));
  delete doc.etat.lignes_ignorees;
  assert.deepEqual(importer(JSON.stringify(doc)).lignes_ignorees, {});
});

test('ignorerLigne : écrit la ligne normalisée, aller-retour exporter/importer, oublierLigne la retire', () => {
  const etat = etatInitial();
  ignorerLigne(etat, '  Offre  Spéciale du Chef ', H);
  assert.deepEqual(Object.keys(etat.lignes_ignorees), ['offre speciale du chef']);
  assert.equal(etat.lignes_ignorees['offre speciale du chef'].ligne, 'Offre Spéciale du Chef');
  const relu = aller(etat);
  assert.deepEqual(relu.lignes_ignorees, etat.lignes_ignorees);
  oublierLigne(relu, 'Offre spéciale du chef', H);
  assert.deepEqual(relu.lignes_ignorees, {});
  assert.throws(() => oublierLigne(relu, 'inconnue', H), /pas écartée/);
  assert.throws(() => ignorerLigne(etat, '   ', H), /vide|trop/i);
  assert.throws(() => ignorerLigne(etat, 'x'.repeat(200), H), /trop/i);
});

test('lignes_ignorees : plafond (la plus ancienne est évincée) et validation à l\'import', () => {
  const etat = etatInitial();
  for (let i = 0; i < LIGNES_MAX + 5; i += 1) {
    ignorerLigne(etat, `ligne parasite ${i}`, new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString());
  }
  assert.equal(Object.keys(etat.lignes_ignorees).length, LIGNES_MAX);
  assert.ok(!('ligne parasite 0' in etat.lignes_ignorees), 'la plus ancienne est partie');
  assert.ok(`ligne parasite ${LIGNES_MAX + 4}` in etat.lignes_ignorees);
  // À l'import : surplus écarté (les plus récentes gardées), entrées invalides et clés interdites écartées.
  const brut = {};
  for (let i = 0; i < LIGNES_MAX + 20; i += 1) brut[`ligne ${i}`] = { ligne: `Ligne ${i}`, h: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString() };
  assert.equal(Object.keys(lignesIgnoreesValides(brut)).length, LIGNES_MAX);
  assert.ok(`ligne ${LIGNES_MAX + 19}` in lignesIgnoreesValides(brut));
  const doc = JSON.parse(exporter(etatInitial(), H));
  doc.etat.lignes_ignorees = JSON.parse(`{"__proto__":{"ligne":"x","h":"${H}"},"constructor":{"ligne":"x","h":null},"Pas Normalisé":{"ligne":"x","h":null},`
    + `"bon":{"ligne":"Bon","h":"${H}"},"vide":"texte","mauvais":{"ligne":5,"h":"pas une date"},"":{"ligne":"x"},"${'a'.repeat(200)}":{"ligne":"x"}}`);
  const relu = importer(JSON.stringify(doc)).lignes_ignorees;
  assert.deepEqual(Object.keys(relu).sort(), ['bon', 'mauvais']);
  assert.equal(relu.mauvais.h, null);
  assert.equal(relu.mauvais.ligne, 'mauvais', 'sans libellé valide, la clé sert de libellé');
  assert.equal(Object.getPrototypeOf(relu), Object.prototype);
  doc.etat.lignes_ignorees = [];
  assert.throws(() => importer(JSON.stringify(doc)), /lignes_ignorees/);
  assert.equal(cleLigne('constructor'), '');
});

test('analyserFeuille : une ligne apprise est écartée (listée dans ignorees et apprises), le jour est réparti', () => {
  const sans = analyserFeuille(FEUILLE_3);
  assert.equal(sans.aVerifier.length, 1, 'trois lignes : jour à vérifier');
  const etat = etatInitial();
  ignorerLigne(etat, 'Offre spéciale du chef', H);
  const avec = analyserFeuille(FEUILLE_3, etat.lignes_ignorees);
  assert.equal(avec.aVerifier.length, 0);
  assert.deepEqual(avec.apprises, ['Offre spéciale du chef']);
  assert.ok(avec.ignorees.includes('Offre spéciale du chef'));
  assert.equal(avec.jours[0].menu1, 'Soupe du jour');
  assert.equal(avec.jours[0].menu2, 'Pâtes au beurre');
  assert.deepEqual(sans.apprises, []);
  // Une autre ligne reste un plat : jamais d'effet de bord sur les autres.
  assert.equal(analyserFeuille(FEUILLE, etat.lignes_ignorees).lignes.length, 3);
  // Un état sans la collection (ancien) ou une valeur absurde ne casse rien.
  assert.equal(analyserFeuille(FEUILLE_3, null).aVerifier.length, 1);
});

// --- interface (faux DOM)
let dom; let magasin; let vueImport; let reglages; let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge('2026-10-05');
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueImport = await import('../app/js/ui/vue-import.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const champ = (n, id) => n.tous((x) => x.attributs.id === id)[0];
const bouton = (n, texte) => boutons(n).find((b) => b.textContent === texte);
const LUNDI = '2026-10-05';

test('Import : « Pas un plat, l\'ignorer à l\'avenir » sur une ligne d\'un jour à vérifier ; la ligne reste visible « écartée » avec « Remettre »', async () => {
  magasin.remplacer(etatVide());
  let noeud = vueImport.rendre(magasin.etat(), LUNDI);
  champ(noeud, 'feuille-texte').value = FEUILLE_3;
  bouton(noeud, 'Répartir dans la semaine').declencher('click');
  const geste = boutons(champ(noeud, 'feuille-retour')).find((b) => b.attributs['aria-label'] === 'Pas un plat, l\'ignorer à l\'avenir : Offre spéciale du chef');
  assert.ok(geste, 'geste présent sur la ligne du jour à vérifier');
  assert.equal(geste.textContent, 'Pas un plat, l\'ignorer à l\'avenir');
  assert.deepEqual(magasin.etat().lignes_ignorees, {}, 'rien n\'est appris avant le geste');
  geste.declencher('click');
  assert.deepEqual(magasin.etat().lignes_ignorees, {}, 'rien avant la confirmation');
  const confirmation = panneauxOuverts(dom.corps).at(-1);
  assert.match(confirmation.textContent, /Cette ligne sera écartée pour toutes les semaines\. Vous pourrez la remettre ou l'oublier dans Réglages > Apprentissage\./);
  await confirmation.querySelector('form').declencher('submit'); // « Oui »
  assert.deepEqual(Object.keys(magasin.etat().lignes_ignorees), ['offre speciale du chef']);
  // La vue est redessinée par le routeur : on la refait ; le texte repris est réparti à nouveau.
  noeud = vueImport.rendre(magasin.etat(), LUNDI);
  champ(noeud, 'feuille-texte').value = FEUILLE_3;
  bouton(noeud, 'Répartir dans la semaine').declencher('click');
  const retour = champ(noeud, 'feuille-retour');
  assert.match(retour.textContent, /Offre spéciale du chef/);
  assert.match(retour.textContent, /écartée/);
  assert.match(retour.textContent, /1 ligne écartée apprise : voir ci-dessous/);
  assert.equal(champ(noeud, `menu-${LUNDI}-1`).value, 'Soupe du jour');
  assert.equal(champ(noeud, `menu-${LUNDI}-2`).value, 'Pâtes au beurre');
  const remettre = boutons(retour).find((b) => b.textContent === 'Remettre');
  assert.ok(remettre, 'Remettre');
  remettre.declencher('click');
  assert.deepEqual(magasin.etat().lignes_ignorees, {}, 'oubliée');
});

const FEUILLE_2_JOURS = ['Mardi 6 octobre', 'Potage', 'Rösti', 'Jeudi 8 octobre', 'Soupe du jour', 'Pâtes au beurre', 'Offre spéciale du chef'].join('\n');

test('Import : « Pas un plat » garde un intitulé corrigé à la main et une portion tapée (la saisie gagne sur la répartition)', async () => {
  magasin.remplacer(etatVide());
  let noeud = vueImport.rendre(magasin.etat(), LUNDI);
  champ(noeud, 'feuille-texte').value = FEUILLE_2_JOURS;
  bouton(noeud, 'Répartir dans la semaine').declencher('click');
  champ(noeud, 'menu-2026-10-06-1').value = 'Potage corrigé à la main';
  champ(noeud, 'prevision-2026-10-06-1').value = '42';
  boutons(champ(noeud, 'feuille-retour')).find((b) => b.attributs['aria-label'] === 'Pas un plat, l\'ignorer à l\'avenir : Offre spéciale du chef').declencher('click');
  await panneauxOuverts(dom.corps).at(-1).querySelector('form').declencher('submit');
  noeud = vueImport.rendre(magasin.etat(), LUNDI); // reprise du texte et des valeurs saisies
  assert.equal(champ(noeud, 'menu-2026-10-06-1').value, 'Potage corrigé à la main');
  assert.equal(champ(noeud, 'prevision-2026-10-06-1').value, '42');
  assert.equal(champ(noeud, 'menu-2026-10-08-1').value, 'Soupe du jour', 'le jour réparti est rempli');
});

test('Réglages > Apprentissage : les lignes écartées sont listées, « Oublier » les retire', () => {
  const etat = etatVide();
  ignorerLigne(etat, 'Offre spéciale du chef', H);
  magasin.remplacer(etat);
  const page = reglages.rendre(magasin.etat(), 'apprentissage');
  assert.match(page.textContent, /Offre spéciale du chef/);
  const oublier = boutons(page).find((b) => b.attributs['aria-label'] === 'Oublier la ligne écartée : Offre spéciale du chef');
  assert.ok(oublier);
  oublier.declencher('click');
  assert.deepEqual(magasin.etat().lignes_ignorees, {});
});

// ------------------------------------------------------------- P15 : notes Dev

test('motsDansNote : « X = sauce », « X c\'est une sauce », « X est une sauce » ; catégories existantes seulement', () => {
  assert.deepEqual(motsDansNote('nduja = sauce'), [{ mot: 'nduja', categorie: 'sauce' }]);
  assert.deepEqual(motsDansNote("La nduja c'est une sauce"), [{ mot: 'nduja', categorie: 'sauce' }]);
  assert.deepEqual(motsDansNote('orecchiette est une forme de pâtes'), [{ mot: 'orecchiette', categorie: 'forme_pates' }]);
  assert.deepEqual(motsDansNote('orecchiette = pâtes'), [{ mot: 'orecchiette', categorie: 'forme_pates' }]);
  assert.deepEqual(motsDansNote('gremolata = garniture\nsumac = produit'), [{ mot: 'gremolata', categorie: 'garniture' }, { mot: 'sumac', categorie: 'produit' }]);
  assert.deepEqual(motsDansNote('Le bouton ne répond pas'), []);
  assert.deepEqual(motsDansNote('x = voiture'), []);
  assert.deepEqual(motsDansNote('à la = sauce'), [], 'un mot de liaison seul n\'est pas un mot');
  assert.deepEqual(motsDansNote(null), []);
  for (const vide of ['ca', 'ça', 'ce', 'cela', "c'", 'il', 'elle', 'ceci']) assert.deepEqual(motsDansNote(`${vide} = sauce`), [], vide);
  assert.deepEqual(motsDansNote('Note : nduja = sauce'), [], 'un X contenant « : » est une phrase');
});

test('Note Dev : après l\'enregistrement, « Retenir « nduja » comme sauce ? » ; Oui retient, rien sans geste', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const N = await import('../app/js/ui/notes-dev.js');
  magasin.remplacer(etatVide());
  N.ouvrirFeuilleNote({ ecran: 'Import', gestes: [] });
  const feuille = panneauxOuverts(dom.corps).at(-1);
  champ(feuille, 'note-dev-texte').value = 'nduja = sauce';
  await feuille.querySelector('form').declencher('submit');
  assert.deepEqual(magasin.etat().mots, {}, 'jamais automatique');
  const proposition = panneauxOuverts(dom.corps).at(-1);
  assert.match(proposition.textContent, /Retenir « nduja » comme sauce \?/);
  const non = boutons(proposition).find((b) => b.textContent === 'Non');
  assert.ok(non);
  await proposition.querySelector('form').declencher('submit'); // « Oui »
  assert.equal(magasin.etat().mots.nduja.categorie, 'sauce');
  delete globalThis.localStorage;
});

// ------------------------------------------------------------- P11 : modes appris

test('mode : classement autorisé, aller-retour exporter/importer, mot invalide écarté', () => {
  assert.equal(CATEGORIES_MOT.mode, 'Mode de préparation');
  const etat = etatInitial();
  etat.mots.fermiere = { categorie: 'mode', h: H };
  assert.deepEqual(aller(etat).mots, etat.mots);
  assert.deepEqual(aller(etat).mots.fermiere, { categorie: 'mode', h: H });
  assert.deepEqual(motsValides({ x: { categorie: 'modes' }, y: { categorie: 'mode', h: null } }), { y: { categorie: 'mode', h: null } });
  const doc = JSON.parse(exporter(etatInitial(), H));
  delete doc.etat.mots;
  assert.deepEqual(importer(JSON.stringify(doc)).mots, {}, 'ancien état sans mots');
});

test('un mode appris est lu comme les modes fixes : garniture « à confirmer », composition vide, jamais décidée', () => {
  const lecture = lirePlat('Escalope, fermière', 1, { mots: { 'fermiere': { categorie: 'mode', h: H } } });
  const e = lecture.elements.find((x) => x.nom.includes('fermière'));
  assert.ok(e, 'élément du mode');
  assert.equal(e.statut, 'a_confirmer');
  assert.equal(e.propriete, 'a_confirmer');
  assert.deepEqual(e.composition, []);
  assert.equal(e.origine, 'mot_retenu');
});

test('enseignerMot(« mode ») : classe en garniture, retient le mot ; l\'ancien code (4 classements) ne casse pas sur le fichier', () => {
  let etat = etatInitial();
  definirMenu(etat, '2026-10-12', 1, 'Escalope, fermière', H);
  const c = Object.values(etat.composants).find((x) => /fermi/.test(x.nom));
  assert.ok(c);
  const r = enseignerMot(etat, c.id, 'mode', H);
  assert.equal(etat.mots[r.mot].categorie, 'mode');
  etat = aller(etat);
  assert.equal(etat.mots[r.mot].categorie, 'mode');
});

test('enseigner-mot : le geste propose les cinq classements dont « Mode de préparation » ; la fiche d\'élément garde les quatre', async () => {
  const { blocEnseigner } = await import('../app/js/ui/enseigner-mot.js');
  const bloc = blocEnseigner({ id: 'c1', nom: 'fermière', categorie: 'a_preciser', menu: 1 });
  assert.equal(boutons(bloc).length, 5);
  assert.ok(boutons(bloc).some((b) => /Mode de préparation/.test(b.textContent)));
  const { blocFicheElement } = await import('../app/js/ui/enseigner-mot.js');
  const fiche = blocFicheElement({ id: 'c2', nom: 'crème', categorie: 'sauce', role: 'sauce', attribue: true }, null, () => {});
  assert.equal(boutons(fiche).filter((b) => /Mode de préparation/.test(b.textContent)).length, 0);
});
