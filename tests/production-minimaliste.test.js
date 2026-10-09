// Production minimaliste (retours d'essai du 2026-10-09) : quantités en g / kg, « à saisir » en un toucher, en-tête d'une ligne,
// changement de jour au glissement et par flèches, liste de mise en place par menu sans liste à dérouler.
// Faux DOM : ni mise en page ni tactile réel (à vérifier à l'écran à 390 px). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirRegle, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { jourApresGeste, jourOuvertVoisin } from '../app/js/domaine/dates.js';
import { aSaisirPortion, quantiteEnPoids, verbeDe } from '../app/js/domaine/mise-en-place.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
});
after(() => dom.restaurer());

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const page = (etat, date = S.lundi) => { magasin.remplacer(etat); return vue.rendre(magasin.etat(), date); };
const bloc = (noeud, titre) => classes(noeud, 'jour-bloc').find((b) => b.querySelector('h2').textContent === titre);
const texte = (noeud) => noeud.textContent.replace(/[  ]/g, ' ');
const ligneDe = (noeud, nom) => classes(noeud, 'mep-ligne').find((l) => classes(l, 'mep-nom')[0].textContent === nom);

/** Lundi : fusilli (menu 1, 20 portions de 60 g) ; quinoa (menu 2, 10 portions de 250 g). */
function lundiFusilli() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'fusilli', h());
  definirMenu(e, S.lundi, 2, 'quinoa', h());
  definirPrevision(e, S.lundi, 1, 20, h());
  definirPrevision(e, S.lundi, 2, 10, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'quinoa', 'garniture', { valeur: 250, unite: 'g', etat: 'sec' }, h());
  return e;
}

// ------------------------------------------------------------------ quantités en g / kg

test('quantiteEnPoids : « 850 g » sous 1000 g, « 1,2 kg » dès 1000 g (virgule, une décimale), jamais « portion » pour un poids', () => {
  assert.equal(quantiteEnPoids(850, 'g'), '850 g');
  assert.equal(quantiteEnPoids(1200, 'g'), '1,2 kg');
  assert.equal(quantiteEnPoids(4500, 'g'), '4,5 kg');
  assert.equal(quantiteEnPoids(2526, 'g'), '2,5 kg');
  assert.equal(quantiteEnPoids(1000, 'g'), '1 kg');
  assert.equal(quantiteEnPoids(999.6, 'g'), '1 kg', 'arrondi avant le seuil : jamais « 1000 g »');
  assert.equal(quantiteEnPoids(null, 'g'), null, 'inconnu : rien d\'inventé');
  assert.equal(quantiteEnPoids(3, 'piece'), '3 pièces');
});

test('ligne : 20 portions de 60 g = « Cuire fusilli … 1,2 kg » ; jamais le mot « portion » sur la ligne', () => {
  const e = lundiFusilli();
  const noeud = page(e);
  const fusilli = ligneDe(noeud, 'fusilli');
  assert.match(texte(fusilli), /Cuire\s*fusilli/);
  assert.equal(texte(classes(fusilli, 'mep-qte')[0]), '1,2 kg');
  const quinoa = ligneDe(noeud, 'quinoa');
  assert.match(texte(quinoa), /Cuire\s*quinoa/);
  assert.equal(texte(classes(quinoa, 'mep-qte')[0]), '2,5 kg');
  assert.doesNotMatch(texte(noeud), /\d\s*portions?/, 'aucune quantité en portions');
});

test('ligne : 10 portions de 85 g = « 850 g »', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirPrevision(e, S.lundi, 1, 10, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 85, unite: 'g', etat: 'sec' }, h());
  assert.equal(texte(classes(ligneDe(page(e), 'riz'), 'mep-qte')[0]), '850 g');
});

// ------------------------------------------------------------------ « à saisir » en un toucher

/** Un plat générique sans portion connue (aucun standard ne s'applique) : 25 portions prévues. */
function platSansPortion() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 25);
  const c = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, type: 'generique' }, { nom: 'GENERIQUE_TEST', type: 'generique' });
  e.composants[c].type = 'generique';
  e.composants[c].grammage.valeur = null;
  planifier(e, principaleDe(e, c), S.lundi, 'avant_midi', h());
  return { e, c };
}

test('aSaisirPortion : vrai seulement quand la portion manque (pas d\'herbe, pas de prévision absente, pas de portion connue)', () => {
  const { e, c } = platSansPortion();
  assert.equal(aSaisirPortion(e, c), true);
  e.composants[c].grammage.valeur = 80;
  assert.equal(aSaisirPortion(e, c), false, 'portion connue');
  assert.equal(aSaisirPortion(e, 'inconnu'), false);
});

test('ligne sans portion : étiquette « à saisir » (icône + mot), un toucher ouvre un champ, « OK » enregistre et la quantité sort en kg', async () => {
  const { e, c } = platSansPortion();
  const noeud = page(e);
  const ligne = ligneDe(noeud, 'GENERIQUE_TEST');
  const asaisir = classes(ligne, 'prod-asaisir')[0];
  assert.ok(asaisir, 'bouton « à saisir »');
  assert.match(asaisir.textContent, /à saisir/);
  assert.ok(asaisir.tous((x) => x.balise === 'svg').length >= 1, 'icône avec le mot : jamais la couleur seule');
  assert.equal(classes(ligne, 'mep-qte').length, 0, 'pas de quantité inventée');
  const formulaire = classes(ligne, 'prod-saisie')[0];
  assert.equal(formulaire.hidden, true, 'champ caché avant le toucher');
  await asaisir.click();
  assert.equal(formulaire.hidden, false, 'un toucher : le champ est là');
  const champ = formulaire.querySelector('input');
  champ.value = '80';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().composants[c].grammage.valeur, 80, 'la portion tapée est enregistrée');
  const apres = ligneDe(vue.rendre(magasin.etat(), S.lundi), 'GENERIQUE_TEST');
  assert.equal(texte(classes(apres, 'mep-qte')[0]), '2 kg', '25 × 80 g = 2 000 g');
});

test('ligne sans portion : une saisie invalide ne change rien', async () => {
  const { e, c } = platSansPortion();
  const ligne = ligneDe(page(e), 'GENERIQUE_TEST');
  const formulaire = classes(ligne, 'prod-saisie')[0];
  formulaire.querySelector('input').value = 'abc';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().composants[c].grammage.valeur, null);
});

// ------------------------------------------------------------------ verbe

test('verbeDe : « Cuire » pour un féculent de base ; rien quand le nom dit déjà l\'action, sans famille ou préparation maison', () => {
  assert.equal(verbeDe({ nom: 'fusilli', categorie: 'feculent', famille: 'pates_seches', type: 'produit_simple' }), 'Cuire');
  assert.equal(verbeDe({ nom: 'courgette sautée', categorie: 'legume', famille: 'courgettes', type: 'produit_simple' }), null);
  assert.equal(verbeDe({ nom: 'chou', categorie: 'legume', famille: null, type: 'generique' }), null, 'jamais de verbe inventé');
  assert.equal(verbeDe({ nom: 'riz', categorie: 'feculent', famille: 'riz', type: 'preparation_maison' }), null);
  assert.equal(verbeDe(null), null);
});

// ------------------------------------------------------------------ en-tête, menus, lignes, aucun repli

test('en-tête : « Production » + date en une ligne ; ni sélecteur Aujourd\'hui / Demain, ni puce « à décider », ni compte', () => {
  const noeud = page(lundiFusilli());
  const tete = classes(noeud, 'prod-tete')[0];
  assert.match(tete.textContent, /^Production\s*Lundi 5 octobre/);
  assert.doesNotMatch(texte(noeud), /Aujourd'hui|Demain|à décider/);
  assert.equal(classes(noeud, 'prod-segment').length + classes(noeud, 'prod-compte').length + classes(noeud, 'prod-adecider').length, 0);
});

test('flèches ‹ › : jour précédent et suivant, le dimanche est sauté', () => {
  const fleches = (date) => classes(page(lundiFusilli(), date), 'prod-fleche').map((a) => [a.textContent, a.attributs.href]);
  assert.deepEqual(fleches(S.lundi), [['‹', `#/production/${S.samediPrecedent}`], ['›', `#/production/${S.mardi}`]]);
  assert.equal(jourOuvertVoisin(S.samediPrecedent, 1), S.lundi);
});

test('menus en petit : « M1 · … » et « M2 · … », une ligne chacun', () => {
  const lignes = classes(page(lundiFusilli()), 'mj-ligne').map((l) => l.textContent);
  assert.deepEqual(lignes, ['M1 · fusilli', 'M2 · quinoa']);
});

test('liste de mise en place : bloc M1 puis M2, une ligne par plat (case, verbe + produit, quantité), aucun details ni repli', () => {
  const noeud = page(lundiFusilli());
  assert.deepEqual(classes(noeud, 'jour-bloc').map((b) => b.querySelector('h2').textContent), ['M1', 'M2']);
  assert.equal(classes(bloc(noeud, 'M1'), 'mep-ligne').length, 2, 'fusilli et la sauce à confirmer (dite « à préciser », sans quantité inventée)');
  assert.equal(noeud.tous((x) => x.balise === 'details' || x.className.split(' ').includes('repliable')).length, 0, 'aucune liste à dérouler');
  const ligne = ligneDe(noeud, 'fusilli');
  assert.equal(classes(ligne, 'case-fait').length, 1, 'case de pointage');
  assert.equal(classes(ligne, 'mep-meta').length, 0, 'aucun sous-titre par défaut');
  assert.equal(classes(ligne, 'prod-nom')[0].attributs.href, `#/fiche/${encodeURIComponent(Object.values(magasin.etat().composants).find((c) => c.nom === 'fusilli').id)}`);
});

test('« Après service » : section toujours visible quand des avances existent ; les résumés sont des boutons qui ouvrent une feuille', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirPrevision(e, S.lundi, 1, 20, h());
  definirRegle(e, { nom: 'riz', avanceMaxJours: 4 }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  const noeud = page(e, S.samediPrecedent);
  const apres = bloc(noeud, 'Après service');
  assert.ok(apres, 'avance visible, pas repliée');
  assert.match(texte(apres), /Cuire\s*riz.*Pour lun\. 5.*1,4 kg/);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0);
  assert.ok(classes(noeud, 'prod-resume').every((b) => b.balise === 'button'));
});

// ------------------------------------------------------------------ glissement

test('jourApresGeste : gauche = jour suivant, droite = précédent, vertical dominant ou trop court = rien, dimanche sauté', () => {
  assert.equal(jourApresGeste(S.lundi, -120, 10), S.mardi, 'glisser vers la gauche : jour suivant');
  assert.equal(jourApresGeste(S.mardi, 120, 10), S.lundi, 'glisser vers la droite : jour précédent');
  assert.equal(jourApresGeste(S.lundi, -120, 200), null, 'geste plutôt vertical : on défile, rien ne change');
  assert.equal(jourApresGeste(S.lundi, -40, 0), null, 'sous le seuil de 60 px');
  assert.equal(jourApresGeste(S.lundi, -70, 0, 100), null, 'seuil réglable');
  assert.equal(jourApresGeste(S.samediPrecedent, -100, 0), S.lundi, 'après le samedi : le lundi (dimanche fermé)');
  assert.equal(jourApresGeste(S.lundi, 100, 0), S.samediPrecedent, 'avant le lundi : le samedi');
});

test('la page branche le glissement : un geste vers la gauche ouvre le jour suivant', async () => {
  const noeud = page(lundiFusilli());
  noeud.declencher('touchstart', { touches: [{ clientX: 300, clientY: 100 }] });
  await noeud.declencher('touchend', { changedTouches: [{ clientX: 180, clientY: 110 }] });
  assert.equal(globalThis.location.hash, `#/production/${S.mardi}`);
  globalThis.location.hash = '';
  noeud.declencher('touchstart', { touches: [{ clientX: 300, clientY: 100 }] });
  await noeud.declencher('touchend', { changedTouches: [{ clientX: 290, clientY: 400 }] });
  assert.equal(globalThis.location.hash, '', 'geste vertical : rien');
});
