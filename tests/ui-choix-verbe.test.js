// Ligne « Verbe : … › » de la feuille d'une ligne de Production (v129), sous faux DOM. La mise en page se vérifie à l'écran.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { composantVide, etatInitial } from '../app/js/domaine/etat.js';

let dom;
let magasin;
let choix;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  choix = await import('../app/js/ui/choix-verbe.js');
});
after(() => dom.restaurer());

function etatAvec(attribue) {
  const e = etatInitial();
  e.composants.c1 = { ...composantVide('c1'), date: '2026-10-05', menu: 1, nom: 'courgettes', categorie: 'legume', famille: 'courgettes',
    role: 'garniture', attribue, valide: true, type: 'produit_simple' };
  magasin.remplacer(e);
  return magasin.etat();
}

test('élément hors poste : aucune ligne Verbe', () => {
  assert.equal(choix.ligneVerbe(etatAvec(false), 'c1'), null);
});

test('élément au poste : la ligne dit « aucun », un choix retient le verbe dans la fiche', () => {
  const ligne = choix.ligneVerbe(etatAvec(true), 'c1');
  assert.match(ligne.textContent, /Verbe : aucun/);
  ligne.click();
  const feuille = panneauxOuverts(dom.corps)[0];
  const sauter = boutons(feuille).find((b) => b.textContent === 'Sauter');
  assert.ok(sauter && boutons(feuille).some((b) => b.textContent === '✓ Aucun verbe'));
  sauter.click();
  assert.equal(magasin.etat().fiches_retenues.courgettes.verbe, 'Sauter');
  assert.match(choix.ligneVerbe(magasin.etat(), 'c1').textContent, /Verbe : Sauter/);
});

test('le verbe courant porte un préfixe « ✓ » visible, les autres non', () => {
  const e = etatAvec(true);
  e.fiches_retenues = { courgettes: { nom: 'courgettes', verbe: 'Sauter', h: '2026-10-05T08:00:00.000Z' } };
  magasin.remplacer(e);
  choix.ligneVerbe(magasin.etat(), 'c1').click();
  const feuille = panneauxOuverts(dom.corps).at(-1);
  const textes = boutons(feuille).map((b) => b.textContent);
  assert.ok(textes.includes('✓ Sauter'));
  assert.ok(textes.includes('Rôtir') && !textes.includes('✓ Rôtir'));
});
