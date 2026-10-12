// Production minimaliste (retours d'essai du 2026-10-09) : quantités en g / kg, « à saisir » en un toucher, en-tête d'une ligne,
// changement de jour au glissement et par flèches, liste de mise en place par menu sans liste à dérouler.
// Faux DOM : ni mise en page ni tactile réel (à vérifier à l'écran à 390 px). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { definirMenu, definirPrevision, definirRegle, definirStandard, marquerFait, annulerFait, planifier } from '../app/js/domaine/actions.js';
import { etatTache } from '../app/js/domaine/planification.js';
import { jourApresGeste, jourOuvertVoisin } from '../app/js/domaine/dates.js';
import { aSaisirPortion, quantiteEnPoids, raisonNonChiffree, verbeDe } from '../app/js/domaine/mise-en-place.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let vue;
let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(S.lundi);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

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

const fermerFeuilles = () => { for (const d of panneauxOuverts(dom.corps)) d.close(); };

test('ligne sans portion : étiquette « à chiffrer » (icône + mot), un toucher ouvre la feuille qui dit la raison, « OK » enregistre et la quantité sort en kg', async () => {
  const { e, c } = platSansPortion();
  const noeud = page(e);
  const ligne = ligneDe(noeud, 'GENERIQUE_TEST');
  const bouton = classes(ligne, 'prod-asaisir')[0];
  assert.ok(bouton, 'bouton « à chiffrer »');
  assert.match(bouton.textContent, /à chiffrer/);
  assert.ok(bouton.tous((x) => x.balise === 'svg').length >= 1, 'icône avec le mot : jamais la couleur seule');
  assert.equal(classes(ligne, 'mep-qte').length, 0, 'pas de quantité inventée');
  await bouton.click();
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /Il manque la portion de GENERIQUE_TEST/, 'la raison est dite');
  const formulaire = classes(feuille, 'prod-saisie')[0];
  formulaire.querySelector('input').value = '80';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().composants[c].grammage.valeur, 80, 'la portion tapée est enregistrée');
  fermerFeuilles();
  const apres = ligneDe(vue.rendre(magasin.etat(), S.lundi), 'GENERIQUE_TEST');
  assert.equal(texte(classes(apres, 'mep-qte')[0]), '2 kg', '25 × 80 g = 2 000 g');
  assert.equal(classes(apres, 'prod-asaisir').length, 0, 'plus « à chiffrer »');
});

test('ligne sans portion : chaque saisie invalide dit son message DANS la feuille, qui reste ouverte, sans rien changer ; la valeur valide la ferme', async () => {
  const { e, c } = platSansPortion();
  await classes(ligneDe(page(e), 'GENERIQUE_TEST'), 'prod-asaisir')[0].click();
  const feuille = panneauxOuverts(dom.corps)[0];
  const formulaire = classes(feuille, 'prod-saisie')[0];
  const alerte = () => feuille.tous((x) => x.attributs.role === 'alert' && !x.hidden)[0]?.textContent ?? '';
  const cas = [['', /Tapez une portion en g, par exemple 120/], ['abc', /n'est pas un nombre/], ['1e3', /n'est pas un nombre/],
    ['0', /supérieure à 0/], ['-5', /supérieure à 0/], ['2001', /ne peut pas dépasser 2000/]];
  for (const [saisie, attendu] of cas) {
    formulaire.querySelector('input').value = saisie;
    await formulaire.declencher('submit');
    assert.match(alerte(), attendu, `« ${saisie} »`);
    assert.equal(feuille.open, true, 'la feuille reste ouverte');
    assert.equal(magasin.etat().composants[c].grammage.valeur, null, 'rien n\'est enregistré');
  }
  formulaire.querySelector('input').value = '120';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().composants[c].grammage.valeur, 120);
  assert.equal(feuille.open, false, 'la valeur valide ferme la feuille');
  fermerFeuilles();
});

// ------------------------------------------------------------------ « à chiffrer » : la raison, la feuille, « fait » sans quantité

/** Menu 1 du lundi : un plat à famille connue, standard réglé, mais AUCUNE prévision (couverts manquants). */
function lundiSansCouverts() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 85, unite: 'g', etat: 'sec' }, h());
  return e;
}
const ligneBrute = (e, nom) => {
  const c = Object.values(e.composants).find((x) => x.nom === nom);
  return { composantId: c.id, genre: 'principale', cible: null, unite: 'g' };
};

test('raisonNonChiffree : couverts manquants, portion manquante, autre cause, ou null quand la ligne est chiffrée', () => {
  const couverts = lundiSansCouverts();
  const r = raisonNonChiffree(couverts, ligneBrute(couverts, 'riz'));
  assert.equal(r.type, 'couverts');
  assert.equal(r.date, S.lundi);
  assert.match(r.texte, /couverts du/);
  const { e, c } = platSansPortion();
  assert.deepEqual(raisonNonChiffree(e, { composantId: c, genre: 'principale', cible: null, unite: 'g' }).type, 'portion');
  assert.equal(raisonNonChiffree(e, { composantId: c, genre: 'principale', cible: 2000, unite: 'g' }), null, 'déjà chiffrée');
  assert.equal(raisonNonChiffree(e, { composantId: c, genre: 'preparatoire', cible: null, unite: null }), null);
  assert.equal(raisonNonChiffree(e, { composantId: 'inconnu', genre: 'principale', cible: null }), null);
  const sauce = etatVide();
  definirMenu(sauce, S.lundi, 1, 'riz', h());
  const id = Object.values(sauce.composants)[0].id;
  sauce.composants[id].type = 'a_preciser';
  assert.equal(raisonNonChiffree(sauce, { composantId: id, genre: 'principale', cible: null }).type, 'autre');
});

test('couverts manquants : la ligne dit « à chiffrer », la feuille propose 40 à 80, un toucher chiffre la ligne en kg', async () => {
  const e = lundiSansCouverts();
  const ligne = ligneDe(page(e), 'riz');
  const bouton = classes(ligne, 'prod-asaisir')[0];
  assert.match(bouton.textContent, /à chiffrer/);
  await bouton.click();
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /Il manque les couverts du/);
  const puces = classes(feuille, 'prep-valeur');
  assert.deepEqual(puces.map((b) => b.textContent), ['40', '50', '60', '70', '80']);
  await puces.find((b) => b.textContent === '60').click();
  fermerFeuilles();
  const apres = ligneDe(vue.rendre(magasin.etat(), S.lundi), 'riz');
  assert.ok(classes(apres, 'mep-qte').length === 1, 'la ligne se chiffre aussitôt');
  assert.equal(classes(apres, 'prod-asaisir').length, 0);
});

test('une prévision existe pour l\'autre menu : pas de puces de couverts (elles l\'écraseraient), un seul bouton « Saisir la prévision »', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirMenu(e, S.lundi, 2, 'quinoa', h());
  definirPrevision(e, S.lundi, 1, 30, h());
  const r = raisonNonChiffree(e, ligneBrute(e, 'quinoa'));
  assert.equal(r.type, 'prevision');
  assert.match(r.texte, /il manque la prévision du menu 2 du/);
  await classes(ligneDe(page(e), 'quinoa'), 'prod-asaisir')[0].click();
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.equal(classes(feuille, 'prep-valeur').length, 0, 'aucune puce de couverts');
  const liens = feuille.tous((x) => x.balise === 'a');
  assert.deepEqual(liens.map((x) => x.textContent), ['Saisir la prévision']);
  assert.match(liens[0].attributs.href, /^#\/import\//);
  assert.equal(magasin.etat().jours[S.lundi].previsions[1].portions, 30, 'le 30 est intact');
  fermerFeuilles();
});

test('cause autre : un seul bouton « Préciser » vers la fiche', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirPrevision(e, S.lundi, 1, 10, h());
  const c = Object.values(e.composants)[0];
  c.type = 'a_preciser';
  await classes(ligneDe(page(e), c.nom), 'prod-asaisir')[0].click();
  const feuille = panneauxOuverts(dom.corps)[0];
  const liens = feuille.tous((x) => x.balise === 'a');
  assert.equal(liens.length, 1);
  assert.equal(liens[0].textContent, 'Préciser');
  assert.match(liens[0].attributs.href, /^#\/fiche\//);
  fermerFeuilles();
});

test('« fait » ne dépend pas de la quantité : une case sur chaque ligne ; cocher sans quantité n\'invente aucun chiffre et se défait', async () => {
  const e = lundiSansCouverts();
  const noeud = page(e);
  const lignes = classes(noeud, 'mep-ligne');
  assert.ok(lignes.length > 0);
  for (const l of lignes) assert.equal(classes(l, 'case-fait').length, 1, 'une case de pointage par ligne');
  assert.equal(classes(noeud, 'case-fait-vide').length, 0, 'plus de tiret à la place de la case');
  const ligne = ligneDe(noeud, 'riz');
  const idProd = Object.values(e.productions).find((p) => p.genre === 'principale').id;
  await classes(ligne, 'case-fait')[0].click();
  const p = magasin.etat().productions[idProd];
  assert.equal(p.etat, 'fait');
  assert.equal(p.quantiteReelle, null, 'aucun chiffre inventé');
  const faite = ligneDe(vue.rendre(magasin.etat(), S.lundi), 'riz');
  assert.equal(classes(faite, 'case-fait')[0].attributs['aria-checked'], 'true');
  assert.equal(classes(faite, 'prod-asaisir').length, 0, 'une ligne faite ne demande plus rien');
  assert.equal(classes(faite, 'mep-qte').length, 0);
  // Les couverts arrivent après : le « fait » sans quantité ne devient pas un écart à arbitrer.
  definirPrevision(magasin.etat(), S.lundi, 1, 20, h(1));
  assert.equal(etatTache(magasin.etat(), idProd), 'fait');
  await classes(faite, 'case-fait')[0].click();
  assert.equal(magasin.etat().productions[idProd].etat === 'fait', false, 'se défait');
});

test('marquerFait sans quantité : refuse par défaut, accepte avec sansQuantite (réel null), annulerFait le remet', () => {
  const e = lundiSansCouverts();
  const id = Object.values(e.productions).find((p) => p.genre === 'principale').id;
  assert.throws(() => marquerFait(e, id, undefined, h()), /cible est inconnue/);
  marquerFait(e, id, undefined, h(), { sansQuantite: true });
  assert.equal(e.productions[id].quantiteReelle, null);
  annulerFait(e, id, h(1));
  assert.equal(e.productions[id].etat === 'fait', false);
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

test('jourApresGeste : un geste de plus de 700 ms n\'est pas un feuilletage', () => {
  assert.equal(jourApresGeste(S.lundi, -120, 10, undefined, 400), S.mardi);
  assert.equal(jourApresGeste(S.lundi, -120, 10, undefined, 701), null);
});

test('la page ignore un glissement qui commence sur un champ, une zone de texte, une liste ou un bouton (saisie en cours)', async () => {
  const noeud = page(lundiFusilli());
  globalThis.location.hash = '';
  for (const balise of ['input', 'textarea', 'select', 'button']) {
    const cible = { closest: (sel) => (sel.split(', ').includes(balise) ? {} : null) };
    noeud.declencher('touchstart', { target: cible, touches: [{ clientX: 300, clientY: 100 }] });
    await noeud.declencher('touchend', { changedTouches: [{ clientX: 180, clientY: 110 }] });
    assert.equal(globalThis.location.hash, '', balise);
  }
  noeud.declencher('touchstart', { target: { closest: () => null }, touches: [{ clientX: 300, clientY: 100 }] });
  await noeud.declencher('touchend', { changedTouches: [{ clientX: 180, clientY: 110 }] });
  assert.equal(globalThis.location.hash, `#/production/${S.mardi}`, 'ailleurs : le geste fonctionne');
});
