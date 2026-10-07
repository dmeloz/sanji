// Feuille de validation des portions (refonte 2, étape 6) : fermeture à tout moment (× et toucher du fond), parcours
// « une valeur à la fois » et écran « terminé ». Sous faux DOM : ce n'est pas un test dans un navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide } from './aide.js';

let dom;
let magasin;
let feuille;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  feuille = await import('../app/js/ui/feuille-validation.js');
});
after(() => dom.restaurer());

const nettoyer = () => { for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove(); };
const ouvert = () => panneauxOuverts(dom.corps)[0];
const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const parNom = (noeud, nom) => boutons(noeud).find((b) => b.attributs['aria-label'] === nom);
const valeurTest = (cle) => ({ cle, famille: cle, libelle: cle, role: 'garniture', composantIds: [],
  proposition: { min: 50, max: 70, unite: 'g', etat: 'sec' }, effet: { portions: 0 }, sources: 'x', standard: null });

test('feuille : le bouton × ferme la feuille à tout moment', () => {
  nettoyer();
  magasin.remplacer(etatVide());
  feuille.ouvrirValidation(valeurTest('riz'));
  const d = ouvert();
  const fermer = parNom(d, 'Fermer');
  assert.ok(fermer, 'bouton × nommé « Fermer »');
  fermer.click();
  assert.equal(d.open, false);
});

test('feuille : toucher du fond ferme ; toucher dans la feuille ne ferme pas', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  feuille.ouvrirValidation(valeurTest('riz'));
  const d = ouvert();
  await d.enfants[0].declencher('click');
  assert.equal(d.open, true, 'un clic dans le formulaire ne ferme pas');
  await d.declencher('click');
  assert.equal(d.open, false, 'un clic sur le fond (la cible est le dialogue) ferme');
});

test('parcours : une valeur à la fois, « 2 / 3 », puis écran « terminé » avec « Revenir à Aujourd\'hui »', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  feuille.ouvrirValidations([valeurTest('riz'), valeurTest('pates'), valeurTest('semoule')]);
  assert.match(ouvert().textContent, /1 \/ 3/);
  await parTexte(ouvert(), 'Plus tard').click();
  assert.match(ouvert().textContent, /2 \/ 3/);
  await parTexte(ouvert(), 'Plus tard').click();
  assert.match(ouvert().textContent, /3 \/ 3/);
  await parTexte(ouvert(), 'Plus tard').click();
  const fin = ouvert();
  assert.ok(fin, 'écran terminé');
  assert.match(fin.textContent, /terminé/);
  assert.match(fin.textContent, /Les 3 valeurs sont traitées/);
  assert.match(fin.textContent, /plus tard/);
  const retour = fin.tous((x) => x.balise === 'a' && x.textContent === "Revenir à Aujourd'hui")[0];
  assert.ok(retour, 'lien de retour');
  assert.equal(retour.attributs.href, '#/aujourdhui');
  retour.click();
  assert.equal(ouvert(), undefined, 'le lien ferme la feuille');
});

test('parcours : × arrête le parcours, rien d\'autre ne s\'ouvre ; aucune valeur : « terminé » fermable', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  feuille.ouvrirValidations([valeurTest('riz'), valeurTest('pates')]);
  parNom(ouvert(), 'Fermer').click();
  assert.equal(ouvert(), undefined, 'parcours interrompu');
  feuille.ouvrirValidations([]);
  const fin = ouvert();
  assert.match(fin.textContent, /Aucune valeur à valider/);
  await fin.declencher('click');
  assert.equal(ouvert(), undefined, 'toucher du fond ferme aussi l\'écran terminé');
});
