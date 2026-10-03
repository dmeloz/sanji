// Geste « Choisir la sauce » de la fiche d'un composant sauce « à confirmer » (faux DOM, pas un navigateur).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { SAUCES } from '../app/js/domaine/vocabulaire-plats.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let vueComposant;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueComposant = await import('../app/js/ui/vue-composant.js');
});
after(() => dom.restaurer());

const sauceDe = (e) => Object.values(e.composants).find((c) => c.categorie === 'sauce');

function ouvrirPanneau(id) {
  const noeud = vueComposant.rendre(magasin.etat(), id);
  return { noeud, bouton: boutons(noeud).find((b) => b.textContent === 'Choisir la sauce') };
}

test('Choisir la sauce : aucune sauce présélectionnée, la liste vient du vocabulaire, valider renomme', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  const id = sauceDe(e).id;
  magasin.remplacer(e);
  const { bouton } = ouvrirPanneau(id);
  assert.ok(bouton, 'le geste est proposé sur une sauce « à confirmer »');
  await bouton.click();
  const [dialogue] = panneauxOuverts(dom.corps);
  const radios = dialogue.tous((x) => x.balise === 'input' && x.attributs.type === 'radio');
  assert.equal(radios.length, SAUCES.length, 'toutes les sauces du vocabulaire sont proposées');
  assert.equal(radios.some((r) => r.checked), false, 'aucune présélection');
  for (const s of SAUCES) assert.match(dialogue.textContent, new RegExp(s.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // Valider sans rien choisir : refusé, rien ne change.
  await dialogue.enfants[0].declencher('submit');
  assert.match(dialogue.textContent, /Choisissez une sauce/);
  assert.equal(magasin.etat().composants[id].nom, 'sauce à confirmer');
  // Choix dans la liste.
  const cible = SAUCES.find((s) => s.cle === 'tomate');
  radios[SAUCES.indexOf(cible)].checked = true;
  await dialogue.enfants[0].declencher('submit');
  assert.equal(magasin.etat().composants[id].nom, cible.nom);
  if (dialogue.open) dialogue.close();
});

test('Choisir la sauce : la saisie libre renomme aussi ; le geste disparaît une fois la sauce confirmée', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  const id = sauceDe(e).id;
  magasin.remplacer(e);
  await ouvrirPanneau(id).bouton.click();
  const [dialogue] = panneauxOuverts(dom.corps);
  const texte = dialogue.tous((x) => x.balise === 'input' && x.attributs.type === 'text')[0];
  texte.value = 'sauce maison';
  await dialogue.enfants[0].declencher('submit');
  assert.equal(magasin.etat().composants[id].nom, 'sauce maison');
  assert.equal(ouvrirPanneau(id).bouton, undefined);
  if (dialogue.open) dialogue.close();
});
