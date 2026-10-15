// v132 : « Comment c'est calculé » dans la feuille « ⋯ » d'une ligne de Production et dans la fiche, et le geste « Corriger le poids ».
// Faux DOM : la mise en page à 390 px se vérifie à l'écran.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { definirMenu, modifierComposant } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-15';
const TEXTE = '20 portions × 30 g (poids cuit, corrigé sur ce plat) ÷ 2,5 (gain de cuisson) = 240 g';
let dom;
let magasin;
let production;
let fiche;
let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(JOUR);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  production = await import('../app/js/ui/vue-production.js');
  fiche = await import('../app/js/ui/vue-fiche.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const boutonTexte = (noeud, re) => noeud.tous((x) => x.balise === 'button' && re.test(x.textContent))[0];
const fermerTout = () => { for (const d of panneauxOuverts(dom.corps)) d.close(); };

function risotto() {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto à la milanaise et écaille de parmesan', h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  const c = Object.values(e.composants).find((x) => x.famille === 'riz');
  modifierComposant(e, c.id, { grammage: { valeur: 30, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } }, h(2));
  magasin.remplacer(e);
  return c.id;
}

test('feuille « ⋯ » : la quantité en toutes lettres, l\'alerte, puis « Corriger le poids » applique sec à la bonne source (600 g)', async () => {
  const id = risotto();
  const page = production.rendre(magasin.etat(), JOUR);
  await classes(page, 'prod-plus')[0].click();
  const feuille = panneauxOuverts(dom.corps).at(-1);
  assert.ok(feuille.textContent.includes(TEXTE), feuille.textContent);
  assert.match(feuille.textContent, /Attention : le repère de cette famille est en poids sec \(50–70 g\)/);
  await boutonTexte(feuille, /^Corriger le poids : sec \/ cru \/ cuit$/).click();
  const correction = panneauxOuverts(dom.corps).at(-1);
  await boutonTexte(correction, /^Poids sec$/).click();
  await boutonTexte(correction, /^Appliquer/).click();
  assert.equal(magasin.etat().composants[id].grammage.etat, 'sec');
  assert.equal(magasin.etat().composants[id].grammage.valeur, 30);
  assert.equal(Math.round(calculerComposant(magasin.etat(), id).quantiteTravail), 600);
  fermerTout();
});

test('fiche : le bloc « Calcul et provenance » porte la même phrase et le même geste', () => {
  const id = risotto();
  const page = fiche.rendre(magasin.etat(), id);
  assert.ok(page.textContent.includes(TEXTE));
  assert.ok(boutonTexte(page, /^Corriger le poids/));
});

test('« Modifier » un élément sans portion : l\'état du poids est présélectionné d\'après le repère (riz : sec), jamais « cuit » par défaut', async () => {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto à la milanaise et écaille de parmesan', h());
  magasin.remplacer(e);
  const c = Object.values(magasin.etat().composants).find((x) => x.famille === 'riz');
  const { dialogModifier } = await import('../app/js/ui/vue-composant.js');
  dialogModifier(magasin.etat().composants[c.id]);
  const feuille = panneauxOuverts(dom.corps).at(-1);
  const etiquette = feuille.tous((x) => x.balise === 'label' && x.textContent === 'État du poids du grammage')[0];
  assert.ok(etiquette, 'champ « État du poids du grammage » introuvable');
  const liste = feuille.tous((x) => x.attributs.id === etiquette.attributs.for)[0];
  assert.equal(liste.enfants[Number(liste.value)].textContent, 'sec');
  fermerTout();
});
