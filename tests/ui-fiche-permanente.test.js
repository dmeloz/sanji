// Fiche permanente sous faux DOM : « Corriger le nom », sauce reprise « à reconfirmer » avec « OK », feuille de clôture.
// Ce n'est pas un test dans un navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatInitial } from '../app/js/domaine/etat.js';
import { h } from './aide.js';

let dom;
let magasin;
let vueFiche;
let cloture;
let apprentissage;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueFiche = await import('../app/js/ui/vue-fiche.js');
  cloture = await import('../app/js/ui/feuille-cloture.js');
  apprentissage = await import('../app/js/ui/section-apprentissage.js');
});
after(() => dom.restaurer());

const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);

function etatAvecReprise() {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Fusilli al ferretto', h());
  modifierComposant(e, Object.values(e.composants).find((c) => c.nom === 'sauce à confirmer').id, { nom: 'tomate' }, h(1));
  definirMenu(e, '2026-11-02', 1, 'Fusilli al ferretto', h(2));
  return e;
}

test('fiche : « Corriger le nom » et « Enregistrer » sont là ; une sauce reprise dit « reprise · à reconfirmer » avec « OK »', () => {
  const e = etatAvecReprise();
  magasin.remplacer(e);
  const sauce = Object.values(magasin.etat().composants).find((c) => c.reprise);
  const page = vueFiche.rendre(magasin.etat(), sauce.id);
  assert.match(page.textContent, /Corriger le nom/);
  assert.match(page.textContent, /reprise · à reconfirmer/);
  assert.ok(parTexte(page, 'Enregistrer'));
  parTexte(page, 'OK').click();
  assert.equal(Object.values(magasin.etat().composants).find((c) => c.id === sauce.id).reprise, undefined);
  assert.doesNotMatch(vueFiche.rendre(magasin.etat(), sauce.id).textContent, /reprise · à reconfirmer/);
});

test('feuille de clôture : « Retenir tel quel » pour un plat nommé, rien pour une sauce à nommer', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Gnocchi alla sorrentina', h());
  definirMenu(e, '2026-10-13', 1, 'Fusilli al ferretto', h());
  magasin.remplacer(e);
  cloture.ouvrirCloture('2026-10-12');
  const feuille = panneauxOuverts(dom.corps)[0];
  assert.match(feuille.textContent, /0 plat déjà retenu|0 plats déjà retenus/);
  assert.equal(boutons(feuille).filter((b) => b.textContent === 'Retenir tel quel').length, 1, 'un seul plat est retenable');
  assert.match(feuille.textContent, /Rien n'est inventé/);
  assert.ok(!boutons(feuille).some((b) => /tout retenir/i.test(b.textContent)));
  parTexte(feuille, 'Retenir tel quel').click();
  assert.equal(Object.keys(magasin.etat().plats_retenus).length, 1);
});

test('Réglages : fiches et plats retenus sont listés avec « Oublier »', () => {
  const e = etatAvecReprise();
  e.fiches_retenues.zorbi = { categorie: 'autre', role: 'garniture', grammage: { valeur: 80, unite: 'g', etat: 'cuit' }, h: h() };
  magasin.remplacer(e);
  const sections = apprentissage.sectionsApprentissage(magasin.etat());
  const texte = sections.map((s) => s?.textContent ?? '').join(' ');
  assert.match(texte, /zorbi · garniture · 80 g cuit/);
  assert.match(texte, /Plats retenus/);
  assert.ok(sections.some((s) => s && boutons(s).some((b) => b.textContent === 'Oublier')));
});

test('fiche : une sauce « à confirmer » sans nom n\'offre pas « Corriger le nom »', () => {
  const e = etatInitial();
  definirMenu(e, '2026-10-12', 1, 'Fusilli al ferretto', h());
  magasin.remplacer(e);
  const sauce = Object.values(magasin.etat().composants).find((c) => c.nom === 'sauce à confirmer');
  assert.doesNotMatch(vueFiche.rendre(magasin.etat(), sauce.id).textContent, /Corriger le nom/);
});
