// v131 : l'état du poids d'une portion tapée est CHOISI par la propriétaire (Poids sec / cru / cuit), présélectionné d'après le
// repère de la famille, jamais deviné en silence. Faux DOM : la mise en page à 390 px se vérifie à l'écran.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-13';
let dom;
let magasin;
let vue;
let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(JOUR);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const boutonsPoids = (noeud) => noeud.tous((x) => x.balise === 'button' && /^(✓ )?Poids (sec|cru|cuit)$/.test(x.textContent));

function risotto() {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto aux bolets', h());
  definirMenu(e, JOUR, 2, 'Filet de bar, riz, brocoli', h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  magasin.remplacer(e);
  return Object.values(magasin.etat().composants).find((c) => c.menu === 1 && c.nom === 'Risotto').id;
}

async function ouvrirFeuille(id) {
  const noeud = vue.rendre(magasin.etat(), JOUR);
  const ligne = classes(noeud, 'mep-ligne').find((l) => classes(l, 'mep-nom')[0].textContent === 'Risotto');
  await classes(ligne, 'prod-asaisir')[0].click();
  return panneauxOuverts(dom.corps)[0];
}

test('feuille « g par portion » : trois boutons Poids sec / cru / cuit, « sec » présélectionné pour le riz, libellé qui le dit', async () => {
  const id = risotto();
  const feuille = await ouvrirFeuille(id);
  const boutons = boutonsPoids(feuille);
  assert.equal(boutons.length, 3);
  assert.deepEqual(boutons.map((b) => b.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.match(feuille.textContent, /g par portion \(poids sec\)/);
  for (const d of panneauxOuverts(dom.corps)) d.close();
});

test('choisir « Poids cuit » : le libellé change et la portion est enregistrée en cuit (pas deviné)', async () => {
  const id = risotto();
  const feuille = await ouvrirFeuille(id);
  await boutonsPoids(feuille).find((b) => b.textContent.endsWith('cuit')).click();
  assert.match(feuille.textContent, /g par portion \(poids cuit\)/);
  const formulaire = classes(feuille, 'prod-saisie')[0];
  formulaire.querySelector('input').value = '200';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().standards.riz.plat_principal.etat, 'cuit');
  for (const d of panneauxOuverts(dom.corps)) d.close();
});

test('sans toucher au choix : la portion est enregistrée avec l\'état présélectionné (sec)', async () => {
  const id = risotto();
  const feuille = await ouvrirFeuille(id);
  const formulaire = classes(feuille, 'prod-saisie')[0];
  formulaire.querySelector('input').value = '90';
  await formulaire.declencher('submit');
  assert.equal(magasin.etat().standards.riz.plat_principal.etat, 'sec');
  for (const d of panneauxOuverts(dom.corps)) d.close();
});
