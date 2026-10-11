// Lot « Production, Fiche, choix de la sauce » de l'audit UI/UX v56 : montrer l'exception, pas la normalité.
// Faux DOM (querySelector n'y cherche que par balise) : ni mise en page ni navigateur, à vérifier à l'écran à 390 px.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import {
  creerFiche, definirMenu, definirPrevision, definirRegle, definirStandard, planifier, marquerFait,
} from '../app/js/domaine/actions.js';
import { SAUCES } from '../app/js/domaine/vocabulaire-plats.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let vueProduction;
let vueJour;
let vueFiche;
let vueComposant;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueProduction = await import('../app/js/ui/vue-production.js');
  vueJour = await import('../app/js/ui/vue-jour.js');
  vueFiche = await import('../app/js/ui/vue-fiche.js');
  vueComposant = await import('../app/js/ui/vue-composant.js');
});
after(() => dom.restaurer());

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const production = (etat, date = S.lundi) => { magasin.remplacer(etat); return vueProduction.rendre(magasin.etat(), date); };
const ligneDe = (noeud, nom) => classes(noeud, 'mep-ligne').find((l) => classes(l, 'mep-nom')[0]?.textContent === nom);
const blocDe = (noeud, debut) => classes(noeud, 'jour-bloc').find((b) => b.querySelector('h2').textContent.startsWith(debut));
/** Le texte vu sans les panneaux d'actions repliés (hidden). */
function texteVisible(noeud) {
  if (noeud.hidden) return '';
  return noeud.enfants.map((e) => (e.enfants && e.balise ? texteVisible(e) : e.textContent)).join('');
}

/** Lundi 5 : un élément au menu 1, une sauce à confirmer, une avance planifiée, une avance seulement proposée. */
function lundi({ type = 'produit_simple' } = {}) {
  const e = etatVide();
  for (const d of [S.lundi, S.mardi, S.mercredi]) { prevision(e, d, 1, 10); prevision(e, d, 2, 10); }
  definirMenu(e, S.lundi, 1, 'penne aux courgettes', h());
  const m1 = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M1_TEST' });
  const mardi = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_MARDI_TEST' });
  composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_MERCREDI_TEST' });
  planifier(e, principaleDe(e, m1), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, mardi), S.lundi, 'apres_midi', h());
  e.composants[m1].type = type;
  e.composants[mardi].type = type;
  return { e, m1, mardi };
}

// ------------------------------------------------------------------ 1. bruit sur chaque ligne

test('ligne : « menu 1 » n\'est pas répété sous une ligne du groupe Menu 1, ni la destination après le service (elle se lit dans la fiche)', () => {
  const { e } = lundi({ type: 'preparation_maison' });
  const noeud = production(e);
  const dansMenu1 = blocDe(noeud, 'M1');
  for (const l of classes(dansMenu1, 'mep-ligne')) assert.doesNotMatch(texteVisible(l), /menu 1/i, 'le titre du groupe le dit déjà');
  const apres = ligneDe(noeud, 'ELEMENT_MARDI_TEST');
  assert.doesNotMatch(texteVisible(apres), /menu 1/i, 'la destination n\'est plus dite sur la ligne');
  assert.match(texteVisible(apres), /Pour mar\. 6/, 'l\'avance dit pour quel jour');
});

test('ligne : plus d\'étiquette « Brut » ni « Recette », plus de chevron : le nom est le lien vers la fiche', () => {
  const brut = production(lundi().e);
  assert.doesNotMatch(texteVisible(brut), /Brut/);
  const recette = production(lundi({ type: 'preparation_maison' }).e);
  assert.equal(classes(recette, 'prod-etiquette').length, 0, 'l\'étiquette Recette n\'est plus sur la ligne');
  assert.doesNotMatch(texteVisible(ligneDe(recette, 'ELEMENT_M1_TEST')), /Recette/);
  for (const noeud of [brut, recette]) assert.equal(classes(noeud, 'prod-chevron').length, 0, 'plus de chevron');
});

test('ligne : plus de « Actions ▸ » sous chaque ligne ; un bouton « ⋯ » de nom « Actions : <plat> » ouvre les actions ; le nom ouvre la fiche', async () => {
  const { e, m1 } = lundi();
  const noeud = production(e);
  assert.equal(noeud.tous((x) => x.balise === 'details' && x.querySelector('summary')?.textContent === 'Actions').length, 0);
  const ligne = ligneDe(noeud, 'ELEMENT_M1_TEST');
  const plus = boutons(ligne).find((b) => b.attributs['aria-label'] === 'Actions : ELEMENT_M1_TEST');
  assert.ok(plus, 'bouton ⋯ accessible');
  assert.equal(plus.textContent, '⋯');
  assert.equal(plus.attributs['aria-expanded'], 'false');
  const panneau = classes(ligne, 'prod-actions')[0];
  assert.equal(panneau.hidden, true, 'replié au départ');
  assert.ok(boutons(panneau).some((b) => b.textContent === 'Démarrer'), 'les gestes existants sont rangés ici');
  await plus.click();
  assert.equal(panneau.hidden, false);
  assert.equal(plus.attributs['aria-expanded'], 'true');
  await plus.click();
  assert.equal(panneau.hidden, true);
  // Le nom est un lien vers la fiche (maquette refonte 2) : il n'ouvre plus les actions.
  const nom = classes(ligne, 'prod-nom')[0];
  assert.equal(nom.balise, 'a');
  assert.equal(nom.attributs.href, `#/fiche/${encodeURIComponent(m1)}`);
});

test('ligne : « ⋯ » occupe sa propre colonne, la même à chaque ligne (aligné quelle que soit la longueur du nom)', () => {
  const { e, m1, mardi } = lundi();
  e.composants[m1].nom = 'A';
  e.composants[mardi].nom = 'Un nom de produit beaucoup plus long que l\'autre pour la ligne';
  const noeud = production(e);
  const lignes = classes(noeud, 'prod-ligne');
  assert.ok(lignes.length >= 3);
  for (const l of lignes) {
    const enfants = classes(l, 'prod-principal')[0].enfants.filter((x) => x.balise);
    assert.equal(enfants.length, 4, 'case, corps, quantité, « ⋯ » (ou son emplacement vide)');
    assert.match(enfants[3].className, /prod-plus/, 'la 4e colonne est celle de « ⋯ »');
    assert.equal(classes(enfants[1], 'prod-plus').length, 0, '« ⋯ » ne suit plus le nom dans la colonne du corps');
  }
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.prod-principal \{[^}]*grid-template-columns: var\(--cible\) minmax\(0, 1fr\) auto var\(--cible\);/);
});

test('ligne : une proposition à planifier montre « Planifier » directement, et seulement « Pour mer. 7 » en mention', () => {
  const noeud = production(lundi().e);
  const ligne = ligneDe(noeud, 'ELEMENT_MERCREDI_TEST');
  const panneau = classes(ligne, 'prod-actions')[0];
  const directs = boutons(ligne).filter((b) => !panneau.tous((x) => x === b).length && b.textContent === 'Planifier');
  assert.equal(directs.length, 1, '« Planifier » est sur la ligne, pas derrière ⋯');
  const meta = texteVisible(ligne);
  assert.match(meta, /Pour mer\. 7/);
  assert.doesNotMatch(meta, /à planifier/, 'la mention est dans le titre du groupe');
});

test('avances : « Après service » est une section toujours visible (aucun repli), chaque avance dit « Pour mar. 6 »', () => {
  const noeud = production(lundi().e);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0, 'aucune liste à dérouler');
  const apres = blocDe(noeud, 'Après service');
  assert.ok(apres, 'section « Après service » visible');
  assert.match(apres.textContent, /Pour mar\. 6/);
  assert.equal(classes(noeud, 'prod-avances').length, 0);
});

test('ligne : la provenance ne se dit plus sur la ligne (elle reste dans la fiche), même au standard de base', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirPrevision(e, S.lundi, 1, 10, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  assert.doesNotMatch(texteVisible(ligneDe(production(e), 'riz')), /provenance : /);
  // Sans standard maison : la portion vient du standard de base, et la ligne le dit.
  const b = etatVide();
  prevision(b, S.lundi, 1, 10);
  const grammageBase = { valeur: 50, unite: 'ml', statut: 'STANDARD_BASE', source: 'TEST_ONLY' };
  const prepBase = composantValide(b, S.lundi, 1, { ...J.PREPARATION_TEST, grammage: grammageBase }, { nom: 'PREP_BASE_TEST' });
  assert.doesNotMatch(texteVisible(ligneDe(production(b), 'PREP_BASE_TEST')), /provenance/, 'dite dans la fiche, plus sur la ligne');
});

test('page : la phrase de refroidissement tient en une ligne courte ; plus de « Rien d\'obligatoire » ni d\'écran allumé sur la page', () => {
  const noeud = production(lundi().e);
  const aide = classes(noeud, 'mep-aide-froid')[0];
  assert.ok(aide, 'la phrase est gardée');
  assert.ok(aide.textContent.length <= 60, `courte : « ${aide.textContent} »`);
  assert.match(aide.textContent, /2 h/);
  assert.doesNotMatch(aide.textContent, /°C|référentiel/);
  const jourSource = readFileSync(new URL('../app/js/ui/vue-jour.js', import.meta.url), 'utf8');
  assert.doesNotMatch(jourSource, /L'écran reste allumé/);
});

test('page : plus de ligne-résumé « Pas encore chiffré » ; la ligne non chiffrée est dans sa liste, « à chiffrer »', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  const noeud = production(e);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0, 'aucune liste à dérouler');
  assert.equal(classes(noeud, 'prod-resume').filter((b) => /Pas encore chiffré/.test(b.textContent)).length, 0);
  assert.doesNotMatch(noeud.textContent, /Pas encore chiffré|Rien d'obligatoire/);
  assert.ok(classes(blocDe(noeud, 'M1'), 'prod-asaisir').length >= 1, 'dans la liste du menu 1');
});

// ------------------------------------------------------------------ 2. décision affichée une fois

test('décision : plus aucune puce « N à décider » sur Production (les décisions se disent sur Aujourd\'hui)', () => {
  const noeud = production(lundi().e);
  assert.equal(classes(noeud, 'jour-decisions').length, 0, 'plus de bloc « À confirmer » en haut');
  assert.equal(classes(noeud, 'jour-centre').length, 0, 'plus de repli « À confirmer » en bas');
  assert.doesNotMatch(noeud.textContent, /À confirmer \(\d+\)|Voir À confirmer|à décider/);
  assert.equal(classes(noeud, 'prod-adecider').length, 0);
});

// ------------------------------------------------------------------ 3. hors règle, déjà prêt, en-tête

/** Samedi 3 : deux avances hors règle (mardi, mercredi) et une dans la règle (lundi). */
function horsRegle() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  definirMenu(e, S.mardi, 1, 'carottes', h());
  definirMenu(e, S.mercredi, 1, 'quinoa', h());
  for (const jour of [S.lundi, S.mardi, S.mercredi]) definirPrevision(e, jour, 1, 20, h());
  for (const nom of ['riz', 'quinoa']) definirRegle(e, { nom, avanceMaxJours: 4 }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirStandard(e, 'quinoa', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  return e;
}

test('hors règle : les avances hors règle sont les premières lignes d\'« Après service », étiquette et cause sur la ligne', () => {
  const noeud = production(horsRegle(), S.samediPrecedent);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0);
  const apres = blocDe(noeud, 'Après service');
  const lignes = classes(apres, 'mep-ligne');
  assert.ok(/hors règle/.test(lignes[0].textContent) && /hors règle/.test(lignes[1].textContent), 'en tête');
  assert.match(apres.textContent, /plus de deux jours d'avance/);
  assert.equal(lignes.filter((l) => /hors règle/.test(l.textContent)).length, 2);
});

test('« Déjà prêt pour plus tard » : une ligne tappable avec son compte, la liste s\'ouvre en feuille', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_PRET_TEST' });
  planifier(e, principaleDe(e, c), S.samediPrecedent, 'apres_midi', h());
  marquerFait(e, principaleDe(e, c), undefined, h(1));
  const noeud = production(e, S.lundi);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0);
  const ligne = classes(noeud, 'prod-resume').find((b) => /^Déjà prêt pour plus tard/.test(b.textContent));
  assert.ok(ligne, 'la ligne existe');
  assert.match(ligne.textContent, /: 1/);
  assert.doesNotMatch(noeud.textContent, /ELEMENT_PRET_TEST/, 'le détail n\'est pas déroulé sur la page');
  await ligne.click();
  assert.match(panneauxOuverts(dom.corps)[0].textContent, /ELEMENT_PRET_TEST/);
  for (const d of panneauxOuverts(dom.corps)) d.close();
});

test('en-tête : « Production » et la date, aucun « x/n » ni jauge (le compte s\'est retiré de la page)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  const noeud = production(e);
  assert.ok(classes(noeud, 'mep-ligne').length >= 2);
  assert.equal(classes(noeud, 'prod-compte').length, 0);
  assert.equal(classes(noeud, 'prod-jauge').length, 0);
});

// ------------------------------------------------------------------ 5. fiche

function fiche(etat, id) { magasin.remplacer(etat); return vueFiche.rendre(magasin.etat(), id); }

test('fiche : « attribué au poste » ne s\'écrit pas ; « non attribué » (ambre) s\'écrit', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  let racine = fiche(e, c);
  assert.doesNotMatch(racine.textContent, /attribué au poste|non attribué/);
  e.composants[c].attribue = false;
  racine = fiche(e, c);
  assert.match(racine.textContent, /non attribué/);
  assert.ok(classes(racine, 'pastille-ambre').some((p) => p.textContent === 'non attribué'));
});

test('fiche : « Brut » est neutre, comme dans Production', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  const racine = fiche(e, c);
  const brut = classes(racine, 'pastille').find((p) => p.textContent === 'Brut');
  assert.ok(brut);
  assert.ok(brut.className.includes('pastille-gris'));
  assert.ok(!brut.className.includes('pastille-vert'));
});

test('fiche : le détail des portions n\'énumère pas les groupes à 0', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  let texte = fiche(e, c).textContent;
  assert.match(texte, /Portions : 40 portions \(hors groupes 40\)/);
  assert.doesNotMatch(texte, /groupes confirmés 0|groupes provisoires 0/);
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'menu_fixe', menuFixe: 1 }, h());
  texte = fiche(e, c).textContent;
  assert.match(texte, /groupes confirmés 10/);
  assert.doesNotMatch(texte, /groupes provisoires 0/);
});

test('fiche : la barre de répartition n\'existe qu\'à partir de 2 destinations', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  assert.equal(classes(fiche(e, c), 'fiche-jauge').length, 0, 'une seule destination : pas de barre');
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'menu_fixe', menuFixe: 1 }, h());
  assert.equal(classes(fiche(e, c), 'fiche-jauge').length, 2, 'deux destinations : une barre chacune');
});

test('fiche, bug B3 : « 25 portions » n\'est pas écrit deux fois', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 25);
  const c = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, type: 'generique' }, { nom: 'GENERIQUE_TEST', type: 'generique' });
  e.composants[c].type = 'generique';
  e.composants[c].grammage.valeur = null; // sans portion connue : seules les portions se comptent
  const racine = fiche(e, c);
  const grande = classes(racine, 'fiche-qte-grande')[0].textContent;
  assert.doesNotMatch(grande, /portions?\s+portions?/i);
  assert.doesNotMatch(racine.textContent, /\d\s+portions?\s+portions?/);
  assert.match(grande, /composition à définir/, 'le reste de la précision est gardé');
});

test('composant (page complète) : « 25 portions » n\'est pas écrit deux fois non plus', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 25);
  const c = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, type: 'generique' }, { nom: 'GENERIQUE_TEST', type: 'generique' });
  e.composants[c].type = 'generique';
  e.composants[c].grammage.valeur = null; // sans portion connue : seules les portions se comptent
  magasin.remplacer(e);
  const texte = vueFiche.rendre(magasin.etat(), c).textContent;
  assert.doesNotMatch(texte, /portions?\s+portions?/i);
  assert.match(texte, /composition à définir/);
});

// ------------------------------------------------------------------ 6. choisir la sauce

function sauceDe(e) { return Object.values(e.composants).find((c) => c.categorie === 'sauce'); }

test('choisir la sauce : le titre dit le plat, le jour et le menu', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  const sauce = sauceDe(e);
  magasin.remplacer(e);
  vueComposant.dialogChoisirSauce(magasin.etat().composants[sauce.id]);
  const [dialogue] = panneauxOuverts(dom.corps);
  const titre = dialogue.tous((x) => /^h[1-3]$/.test(x.balise))[0].textContent;
  assert.match(titre, /Penne aux courgettes/);
  assert.match(titre, /lundi 5 octobre/);
  assert.match(titre, /menu 1/);
  dialogue.close();
});

test('choisir la sauce : les sauces du plat d\'abord, « Autres sauces » repliées, aucune présélection', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  const sauce = sauceDe(e);
  magasin.remplacer(e);
  vueComposant.dialogChoisirSauce(magasin.etat().composants[sauce.id]);
  const [dialogue] = panneauxOuverts(dom.corps);
  const radios = dialogue.tous((x) => x.balise === 'input' && x.attributs.type === 'radio');
  assert.equal(radios.length, SAUCES.length, 'toutes les sauces restent accessibles');
  assert.equal(radios.some((r) => r.checked), false, 'aucune présélection, jamais la crème');
  const autres = dialogue.tous((x) => x.balise === 'details').find((d) => /Autres sauces/.test(d.querySelector('summary').textContent));
  assert.ok(autres, '« Autres sauces » est un repli');
  assert.equal(autres.open, false);
  const dansAutres = autres.tous((x) => x.balise === 'input' && x.attributs.type === 'radio').length;
  assert.ok(dansAutres > 0 && dansAutres < SAUCES.length);
  const habituelles = radios.slice(0, radios.length - dansAutres);
  assert.ok(habituelles.length >= 3);
  // Pour des pâtes : la tomate est parmi les habituelles, le safran (du risotto) est dans « Autres sauces ».
  assert.match(dialogue.textContent, /sauce tomate/);
  assert.match(autres.textContent, /sauce safran/);
  assert.doesNotMatch(autres.textContent, /sauce tomate/);
  assert.equal(new Set(radios.map((r) => r.attributs.name)).size, 1, 'un seul choix possible dans les deux listes');
  assert.ok(dialogue.tous((x) => x.balise === 'input' && x.attributs.type === 'text').length === 1, 'saisie libre conservée');
  dialogue.close();
});

test('choisir la sauce : pour un risotto, le safran est habituel et la tomate est dans « Autres sauces »', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Risotto aux champignons', h());
  const sauce = sauceDe(e);
  assert.ok(sauce, 'un risotto au menu 1 propose une sauce à confirmer');
  assert.equal(sauce.categorie, 'sauce');
  magasin.remplacer(e);
  vueComposant.dialogChoisirSauce(magasin.etat().composants[sauce.id]);
  const [dialogue] = panneauxOuverts(dom.corps);
  const autres = dialogue.tous((x) => x.balise === 'details').find((d) => /Autres sauces/.test(d.querySelector('summary').textContent));
  assert.doesNotMatch(autres.textContent, /sauce safran/);
  assert.match(autres.textContent, /sauce tomate/);
  dialogue.close();
});

test('choisir la sauce : pour un plat au poisson ou au saumon, les sauces de poisson d\'abord, avant pesto et arrabbiata, sans présélection', () => {
  for (const plat of ['Penne au saumon', 'Risotto, filet de cabillaud', 'Tagliatelles et poisson du jour']) {
    const e = etatVide();
    definirMenu(e, S.lundi, 1, plat, h());
    const sauce = sauceDe(e);
    assert.ok(sauce, `${plat} : une sauce à confirmer`);
    magasin.remplacer(e);
    vueComposant.dialogChoisirSauce(magasin.etat().composants[sauce.id]);
    const [dialogue] = panneauxOuverts(dom.corps);
    const noms = dialogue.tous((x) => x.balise === 'label' && x.className === 'case').map((l) => l.textContent);
    assert.equal(noms.length, SAUCES.length, 'toutes les sauces restent accessibles');
    for (const nom of ['crème et fond de poisson', 'beurre blanc', 'sauce à la crème']) {
      assert.ok(noms.indexOf(nom) >= 0 && noms.indexOf(nom) < noms.indexOf('pesto'), `${plat} : « ${nom} » avant le pesto`);
      assert.ok(noms.indexOf(nom) < noms.indexOf('sauce arrabbiata'), `${plat} : « ${nom} » avant l'arrabbiata`);
    }
    assert.equal(noms[0], 'crème et fond de poisson', 'la première proposition est une sauce de poisson');
    assert.equal(dialogue.tous((x) => x.balise === 'input' && x.attributs.type === 'radio').some((r) => r.checked), false);
    dialogue.close();
  }
  // Un plat sans poisson garde l'ordre des pâtes : la tomate d'abord.
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  magasin.remplacer(e);
  vueComposant.dialogChoisirSauce(magasin.etat().composants[sauceDe(e).id]);
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.equal(dialogue.tous((x) => x.balise === 'label' && x.className === 'case')[0].textContent, 'sauce tomate');
  dialogue.close();
});

test('style : le bloc du lot est en fin de feuille, cibles de 44 px, mouvement réduit', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const i = css.indexOf('Lot Production');
  assert.ok(i > 0, 'bloc commenté au nom du lot');
  const bloc = css.slice(i);
  assert.match(bloc, /\.prod-plus[^{]*\{[^}]*min-width:\s*var\(--cible\)[^}]*min-height:\s*var\(--cible\)|\.prod-plus[^{]*\{[^}]*min-height:\s*var\(--cible\)[^}]*min-width:\s*var\(--cible\)/);
  assert.match(bloc, /\.prod-nom[^{]*\{[^}]*min-height:\s*var\(--cible\)/);
});
