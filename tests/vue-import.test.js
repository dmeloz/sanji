// Écran Import des menus de la refonte 1 (vue-import.js) sous faux DOM : saisie, lecture jour par jour, photo en aide, enregistrement.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide } from './aide.js';
import { saisirMenusSemaine } from '../app/js/domaine/actions.js';

let dom; let magasin; let vue; let routeur;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-import.js');
  routeur = await import('../app/js/ui/routeur.js');
});
after(() => dom.restaurer());

const champ = (n, id) => n.tous((x) => x.attributs.id === id)[0];
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const bouton = (n, texte) => boutons(n).find((b) => b.textContent === texte);
const liens = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const saisir = (n, id, valeur) => { champ(n, id).value = valeur; return champ(n, id).declencher('input'); };
const ligneDuJour = (n, jour) => parClasse(n, 'imp-jour').find((d) => d.textContent.startsWith(jour));

test('routage : #/import mène à cette vue ; titre, retour vers la semaine, numéro de semaine, hors ligne', () => {
  assert.equal(routeur.VUES.import, vue);
  assert.equal(vue.titre(), 'Import des menus');
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  const texte = noeud.textContent;
  assert.match(texte, /Importer les menus/);
  assert.match(texte, /Semaine \d+ · du lundi 5 octobre · hors ligne/);
  assert.ok(liens(noeud).includes(`#/semaine/${S.lundi}/tableau`), 'retour à la semaine');
  assert.ok(liens(noeud).includes(`#/import/${S.lundiSuivant}`) && liens(noeud).includes(`#/import/${S.lundiPrecedent ?? '2026-09-28'}`));
  assert.doesNotMatch(texte, /synchronis/i);
});

test('aucune lecture de photo annoncée : la photo est une aide visuelle', () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  const texte = noeud.textContent;
  assert.match(texte, /Photo du menu \(aide visuelle\)/);
  assert.match(texte, /Sanji ne lit pas la photo/);
  assert.doesNotMatch(texte, /page lue|plats trouvés|manuscrite|\d+ plats? lus?/i);
  const entree = noeud.tous((x) => x.balise === 'input' && x.attributs.type === 'file')[0];
  assert.equal(entree.attributs.accept, 'image/*');
  assert.ok(parClasse(noeud, 'cache').includes(entree));
});

test('lecture jour par jour : les intitulés saisis sont lus (menu 1 / menu 2), la lecture suit la frappe', async () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  assert.match(noeud.textContent, /Ce que Sanji a lu · vérifie/);
  assert.match(ligneDuJour(noeud, 'Lundi').textContent, /non saisi/);
  await saisir(noeud, `menu-${S.lundi}-2`, 'courgettes, quinoa');
  const lundi = ligneDuJour(noeud, 'Lundi');
  assert.match(lundi.textContent, /1 menu · lu/);
  assert.match(lundi.textContent, /Menu 2/);
  assert.match(lundi.textContent, /courgettes/);
  assert.match(lundi.textContent, /Menu 1non saisi/);
  assert.doesNotMatch(lundi.textContent, /à vérifier/);
  assert.equal(Object.keys(magasin.etat().composants).length, 0, 'rien n\'est enregistré en tapant');
});

test('lecture : une ambiguïté de lirePlat est écrite « à vérifier » en mots, le jour est déplié', async () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  await saisir(noeud, `menu-${S.lundi}-1`, 'pâtes');
  const lundi = ligneDuJour(noeud, 'Lundi');
  assert.match(lundi.textContent, /1 à vérifier/);
  assert.match(lundi.textContent, /Menu 1 · à vérifier/);
  assert.match(lundi.textContent, /sauce implicite à confirmer/);
  assert.equal(lundi.open, true, 'un jour à vérifier est déplié');
  assert.equal(parClasse(lundi, 'imp-jour-etat-doute').length, 1);
  // Un jour sans doute reste replié.
  await saisir(noeud, `menu-${S.mardi}-2`, 'courgettes');
  assert.equal(ligneDuJour(noeud, 'Mardi').open, false);
});

test('coller puis répartir remplit les champs et la lecture, sans rien enregistrer', async () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  champ(noeud, 'feuille-texte').value = 'Lundi 05 octobre\nriz et carottes\npoulet, riz, carottes';
  await bouton(noeud, 'Répartir dans la semaine').click();
  assert.equal(champ(noeud, `menu-${S.lundi}-1`).value, 'riz et carottes');
  assert.match(ligneDuJour(noeud, 'Lundi').textContent, /2 menus · lu|à vérifier/);
  assert.doesNotMatch(ligneDuJour(noeud, 'Lundi').textContent, /non saisi/);
  assert.match(noeud.textContent, /Relisez les intitulés, puis enregistrez la semaine/);
  assert.equal(Object.keys(magasin.etat().composants).length, 0);
});

test('« Enregistrer la semaine » : un menu suffit, les composants se créent seuls ; aucun mot « planifier »', async () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  assert.doesNotMatch(noeud.textContent, /planifi|valider/i);
  await saisir(noeud, `menu-${S.lundi}-2`, 'courgettes, quinoa');
  await bouton(noeud, 'Enregistrer la semaine').click();
  const e = magasin.etat();
  assert.equal(e.jours[S.lundi].menus[2].intitule, 'courgettes, quinoa');
  assert.ok(Object.keys(e.composants).length >= 2, 'composants créés seuls');
  assert.equal(location.hash, `#/semaine/${S.lundi}/tableau`);
});

test('la page ancienne vue-menus reste disponible et partage les champs', async () => {
  const menus = await import('../app/js/ui/vue-menus.js');
  const noeud = menus.rendre(etatVide(), S.lundi);
  assert.ok(champ(noeud, 'feuille-texte') && bouton(noeud, 'Enregistrer la semaine'));
});

test('style : bloc Import en fin de style.css, légendes >= 13 px, cibles >= 44 px, mouvement réduit', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const debut = css.indexOf('Import des menus (refonte 1)');
  assert.ok(debut > 0);
  const bloc = css.slice(debut);
  for (const m of bloc.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 13, m[0]);
  assert.match(bloc, /\.imp-jour-tete[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /prefers-reduced-motion/);
  assert.doesNotMatch(bloc, /gradient/);
});

// ---------------------------------------------------------------- audit v56 : page plus courte

test('semaine : deux flèches ‹ › comme l\'écran Semaine, plus de gros boutons empilés', () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  const fleches = parClasse(noeud, 'btn-fleche');
  assert.deepEqual(fleches.map((a) => a.textContent), ['‹', '›']);
  assert.deepEqual(fleches.map((a) => a.attributs['aria-label']), ['Semaine précédente', 'Semaine suivante']);
  assert.equal(fleches[1].attributs.href, `#/import/${S.lundiSuivant}`);
  assert.doesNotMatch(noeud.textContent, /‹ Semaine précédente|Semaine suivante ›/);
  assert.equal(parClasse(noeud, 'nav-periode').length, 0);
});

test('intitulés : champs d\'une ligne qui s\'agrandissent ; les cinq jours restent des lignes visibles', () => {
  magasin.remplacer(etatVide());
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  const intitule = champ(noeud, `menu-${S.lundi}-1`);
  assert.equal(intitule.attributs.rows, '1');
  assert.ok(intitule.className.split(' ').includes('champ-intitule'));
  const jours = parClasse(noeud, 'saisie-jour');
  assert.equal(jours.length, 5, 'lundi à vendredi, jeudi compris');
  assert.ok(jours.every((j) => j.balise === 'details' && j.open === true), 'jours vides : ouverts d\'emblée');
  assert.ok(jours.some((j) => j.textContent.startsWith('Jeudi')));
});

test('jours déjà remplis : repliés sur leur résumé, un jour vide reste ouvert, les champs restent atteignables', async () => {
  magasin.remplacer(etatVide());
  magasin.agir((x, t) => saisirMenusSemaine(x, S.lundi, { [S.lundi]: { menu1: 'riz et carottes', menu2: 'courgettes' } }, t));
  const noeud = vue.rendre(magasin.etat(), S.lundi);
  const lundi = parClasse(noeud, 'saisie-jour').find((j) => j.textContent.startsWith('Lundi'));
  assert.equal(lundi.open, false, 'jour rempli : replié');
  assert.match(parClasse(lundi, 'saisie-jour-extrait')[0].textContent, /Menu 1 : riz et carottes · Menu 2 : courgettes/);
  assert.ok(champ(lundi, `menu-${S.lundi}-1`), 'le champ reste dans la page (replié, pas retiré)');
  const mardi = parClasse(noeud, 'saisie-jour').find((j) => j.textContent.startsWith('Mardi'));
  assert.equal(mardi.open, true);
  assert.equal(parClasse(mardi, 'saisie-jour-extrait')[0].textContent, 'à saisir');
  await bouton(noeud, 'Enregistrer la semaine').click();
  assert.equal(magasin.etat().jours[S.lundi].menus[1].intitule, 'riz et carottes', 'enregistrer sans rien changer ne perd rien');
});

test('CSS (lot Stock et Import) : cible de 44 px sur le résumé d\'un jour, intitulé à hauteur de cible, mouvement réduit', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('/* ===== Lot Stock et Import'));
  assert.match(bloc, /\.saisie-jour-repliable > summary \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.champ-intitule \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /prefers-reduced-motion/);
});
