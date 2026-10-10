// États vides de la refonte 2 (G1 à G5) et poignée des feuilles montantes, sous faux DOM. Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, prevision } from './aide.js';
import { analyserFeuille } from '../app/js/domaine/feuille.js';

let dom;
let magasin;
let vues;
let elements;
let panneau;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  elements = await import('../app/js/ui/elements.js');
  panneau = await import('../app/js/ui/panneau.js');
  vues = {
    jour: await import('../app/js/ui/vue-production.js'),
    detail: await import('../app/js/ui/vue-detail.js'),
    articles: await import('../app/js/ui/vue-articles.js'),
    menus: await import('../app/js/ui/vue-menus.js'),
    fiche: await import('../app/js/ui/vue-fiche.js'),
  };
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const liens = (noeud) => noeud.tous((x) => x.balise === 'a').map((a) => [a.textContent, a.attributs.href]);
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));

test('etatVide : titre, phrase, boutons avec leur href, principal en bleu', () => {
  const n = elements.etatVide({ titre: 'TITRE_TEST', texte: 'PHRASE_TEST', actions: [
    { libelle: 'Un', href: '#/un', principal: true }, { libelle: 'Deux', href: '#/deux' }] });
  assert.match(n.textContent, /TITRE_TEST/);
  assert.match(n.textContent, /PHRASE_TEST/);
  assert.deepEqual(liens(n), [['Un', '#/un'], ['Deux', '#/deux']]);
  assert.deepEqual(n.tous((x) => x.balise === 'a').map((a) => a.className), ['btn btn-principal', 'btn']);
});

test('G1 : production sans tâche, deux boutons vers la semaine et l\'import', () => {
  magasin.remplacer(etatVide());
  const p = vues.jour.rendre(magasin.etat(), S.jeudi);
  assert.match(p.textContent, /Rien à produire ce jour/);
  assert.match(p.textContent, /Pas de menu ce jour-là, ou tout a déjà été avancé\./);
  const attendus = [['Voir la semaine', `#/semaine/${S.lundi}/tableau`], ['Importer les menus', `#/import/${S.lundi}`]];
  for (const l of attendus) assert.ok(liens(p).some(([t, href]) => t === l[0] && href === l[1]), l[0]);
});

test('G1 : absent quand des tâches existent (« Tout est fait. » ou liste)', () => {
  const e = etatVide();
  prevision(e, S.jeudi, 1, 10);
  composantValide(e, S.jeudi, 1, J.PRODUIT_SEC_TEST);
  magasin.remplacer(e);
  const p = vues.jour.rendre(magasin.etat(), S.jeudi);
  assert.doesNotMatch(p.textContent, /Rien à produire/);
});

test('G2 : jour sans menu, étiquette, titre, bouton d\'import ; jamais le samedi (aucun menu à importer)', () => {
  magasin.remplacer(etatVide());
  const mer = vues.detail.rendre(magasin.etat(), S.mercredi);
  assert.match(mer.textContent, /menu à importer/);
  assert.match(mer.textContent, /Pas encore de menu pour ce jour/);
  assert.match(mer.textContent, /Sans menu, Sanji ne calcule rien pour mercredi : aucune quantité n'est inventée\./);
  assert.ok(liens(mer).some(([t, href]) => t === 'Importer les menus de la semaine' && href === `#/import/${S.lundi}`));
  assert.doesNotMatch(mer.textContent, /le samedi n'est jamais présumé/);
  assert.doesNotMatch(vues.detail.rendre(magasin.etat(), S.samedi).textContent, /Pas encore de menu pour ce jour/);
});

test('G2 : absent quand le jour a un menu', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  // un intitulé saisi suffit : on le pose par l'action du domaine
  return import('../app/js/domaine/actions.js').then(({ definirMenu }) => {
    definirMenu(e, S.mercredi, 1, 'INTITULE_TEST', '2026-10-01T08:00:00.000Z');
    magasin.remplacer(e);
    assert.doesNotMatch(vues.detail.rendre(magasin.etat(), S.mercredi).textContent, /Pas encore de menu pour ce jour/);
  });
});

test('G3 : articles, état vide seulement sans aucun jour ; sinon lignes simples', () => {
  vues.articles.oublierVue();
  magasin.remplacer(etatVide());
  const p = aDate(S.lundi, () => vues.articles.rendre(magasin.etat()));
  assert.match(p.textContent, /Aucun article pour l'instant/);
  assert.match(p.textContent, /La liste se remplit dès que les menus de la semaine sont importés\./);
  assert.ok(liens(p).some(([t, href]) => t === 'Importer les menus' && href === `#/import/${S.lundi}`));
  assert.equal(classes(p, 'etat-vide').length, 1);
  const e = etatVide();
  prevision(e, S.mardi, 1, 10);
  composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST);
  magasin.remplacer(e);
  const dim = aDate(S.lundi, () => vues.articles.rendre(magasin.etat()));
  assert.equal(classes(dim, 'etat-vide').length, 0, 'jamais l\'état vide quand des jours existent');
});

test('G4 : lignes non comprises citées, état par jour, deux boutons ; analyserFeuille les rend', () => {
  const a = analyserFeuille('Menu du marché\nlundi 5 octobre\nSoupe\nPoulet\n+ note au stylo\n19.-');
  assert.deepEqual(a.nonComprises, ['+ note au stylo'], 'ni prix ni titre');
  assert.ok(a.ignorees.includes('19.-'));
  magasin.remplacer(etatVide());
  const racine = vues.menus.rendre(magasin.etat(), S.lundi);
  const par = (id) => racine.tous((x) => x.attributs.id === id)[0];
  par('feuille-texte').value = 'lundi 5 octobre\nSoupe\nPoulet\n+ note au stylo\n= autre reste';
  racine.tous((x) => x.balise === 'button' && x.textContent === 'Répartir dans la semaine')[0].click();
  const zone = par('feuille-retour').textContent;
  assert.match(zone, /Ce que Sanji a lu/);
  assert.match(zone, /2 lignes non comprises/);
  assert.match(zone, /« \+ note au stylo »/);
  assert.match(zone, /Rien n'est deviné : ces lignes ne sont pas enregistrées\./);
  assert.match(zone, /Lundi : 2 menus · lu/);
  assert.match(zone, /Mardi : non saisi/);
  assert.match(zone, /Corriger le texte/);
  assert.match(zone, /Enregistrer le lu/);
});

test('G4 : pas de zone quand tout est compris', () => {
  magasin.remplacer(etatVide());
  const racine = vues.menus.rendre(magasin.etat(), S.lundi);
  const par = (id) => racine.tous((x) => x.attributs.id === id)[0];
  par('feuille-texte').value = 'lundi 5 octobre\nSoupe\nPoulet';
  racine.tous((x) => x.balise === 'button' && x.textContent === 'Répartir dans la semaine')[0].click();
  assert.doesNotMatch(par('feuille-retour').textContent, /non comprise/);
});

test('G5 : préparation sans recette, bloc et bouton ; rien quand la recette existe', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const id = composantValide(e, S.mercredi, 1, J.PREPARATION_TEST);
  magasin.remplacer(e);
  const f = vues.fiche.rendre(magasin.etat(), id);
  assert.match(f.textContent, /Recette\s*non saisie/);
  assert.match(f.textContent, /Étapes\s*aucune/);
  assert.match(f.textContent, /Les quantités viennent des couverts et des standards ; elles restent justes sans recette\. Le mode en poste apparaîtra avec les étapes\./);
  const ajout = f.tous((x) => x.balise === 'button' && x.textContent === 'Ajouter la recette')[0];
  assert.ok(ajout);
  ajout.click();
  assert.ok(panneauxOuverts(dom.corps).length > 0, 'ouvre l\'édition du composant');
  for (const d of panneauxOuverts(dom.corps)) d.close();
  // avec une recette liée
  const e2 = etatVide();
  prevision(e2, S.mercredi, 1, 10);
  return Promise.all([import('./aide.js'), import('../app/js/domaine/actions.js')]).then(([aide, actions]) => {
    const r = aide.recetteValidee(e2, J.RECETTE_TEST);
    const id2 = composantValide(e2, S.mercredi, 1, J.PREPARATION_TEST, { recetteId: r });
    actions.modifierComposant(e2, id2, { recetteId: r }, '2026-10-01T08:00:00.000Z');
    magasin.remplacer(e2);
    assert.doesNotMatch(vues.fiche.rendre(magasin.etat(), id2).textContent, /non saisie|Ajouter la recette/);
  });
});

test('poignée : chaque panneau en reçoit une, aria-hidden, et les actions restent dans le formulaire en bas', () => {
  const d = panneau.panneau({ titre: 'POIGNEE_TEST', corps: [] });
  const poignees = classes(d, 'panneau-poignee');
  assert.equal(poignees.length, 1);
  assert.equal(poignees[0].attributs['aria-hidden'], 'true');
  const form = d.querySelector('form');
  assert.equal(form.enfants[0], poignees[0], 'la poignée est en haut');
  assert.equal(form.enfants.at(-1).className, 'panneau-actions', 'les actions restent en bas');
  d.close();
});

test('CSS ajouté : ni hexadécimal ni police sous 15 px', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const blocs = [
    css.slice(css.indexOf('/* Poignée de la feuille montante'), css.indexOf('.panneau-titre {')),
    css.slice(css.indexOf('/* ===== États vides (refonte 2')),
  ];
  for (const b of blocs) {
    assert.ok(b.length > 100);
    assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(b, /gradient|shadow/);
    for (const m of b.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 15, m[0]);
  }
  assert.match(blocs[0], /@media \(max-width: 600px\)[\s\S]*border-radius: var\(--rayon\) var\(--rayon\) 0 0/);
});
