// v131 : une famille qui GAGNE à la cuisson (polenta, quinoa, semoule…) sans repère de portion validé n'a AUCUNE présélection :
// la propriétaire choisit le poids (sec, cru, cuit), sinon « OK » est refusé. Jamais « cuit » en silence.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { saisirPortionInconnue } from '../app/js/domaine/actions-preparation.js';
import { correctionDuJour } from '../app/js/domaine/actions-validation.js';
import { etatPortionTapee } from '../app/js/domaine/mise-en-place.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-13';
const MESSAGE = /Choisissez d'abord : poids sec, cru ou cuit\./;
let dom; let magasin; let vue; let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(JOUR);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-production.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const classes = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const boutonsPoids = (n) => n.tous((x) => x.balise === 'button' && /^(✓ )?Poids (sec|cru|cuit)$/.test(x.textContent));

function menuAvec(intitule, nomComposant) {
  const e = etatVide();
  definirMenu(e, JOUR, 1, intitule, h());
  definirCouvertsMidi(e, JOUR, { total: 20, repartition: { 1: 20, 2: 0 } }, h(1));
  const c = Object.values(e.composants).find((x) => x.menu === 1 && x.nom.toLowerCase() === nomComposant);
  return { e, id: c.id };
}

test('polenta, quinoa, semoule : aucune présélection (gain de cuisson, pas de repère)', () => {
  for (const [intitule, nom] of [['Polenta', 'polenta'], ['Quinoa', 'quinoa'], ['Semoule', 'semoule']]) {
    const { e, id } = menuAvec(intitule, nom);
    assert.equal(etatPortionTapee(e, id), null, nom);
  }
});

test('riz : « sec » reste présélectionné', () => {
  const e = etatVide();
  definirMenu(e, JOUR, 1, 'Risotto aux bolets', h());
  const r = Object.values(e.composants).find((c) => c.nom === 'Risotto');
  assert.equal(etatPortionTapee(e, r.id), 'sec');
});

test('l\'action refuse sans état choisi pour polenta, n\'écrit rien, accepte après choix', () => {
  const { e, id } = menuAvec('Polenta', 'polenta');
  assert.throws(() => saisirPortionInconnue(e, id, 60, h(2)), MESSAGE);
  assert.throws(() => correctionDuJour(e, id, { valeur: 60 }, h(2)), MESSAGE);
  assert.equal(e.standards?.polenta, undefined);
  saisirPortionInconnue(e, id, 60, h(3), 'sec');
  assert.equal(e.standards.polenta.plat_principal.etat, 'sec');
});

async function feuillePolenta() {
  const { e } = menuAvec('Polenta', 'polenta');
  magasin.remplacer(e);
  const noeud = vue.rendre(magasin.etat(), JOUR);
  const ligne = classes(noeud, 'mep-ligne').find((l) => /olenta/.test(classes(l, 'mep-nom')[0].textContent));
  await classes(ligne, 'prod-asaisir')[0].click();
  return panneauxOuverts(dom.corps)[0];
}

test('Production : aucun bouton enfoncé, OK refusé sans choix, accepté après choix', async () => {
  const feuille = await feuillePolenta();
  assert.deepEqual(boutonsPoids(feuille).map((b) => b.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  assert.doesNotMatch(feuille.textContent, /poids (sec|cru|cuit)\)/);
  const f = classes(feuille, 'prod-saisie')[0];
  f.querySelector('input').value = '60';
  await f.declencher('submit');
  assert.match(feuille.textContent, MESSAGE);
  assert.equal(magasin.etat().standards.polenta, undefined);
  await boutonsPoids(feuille).find((b) => b.textContent.endsWith('sec')).click();
  await f.declencher('submit');
  assert.equal(magasin.etat().standards.polenta.plat_principal.etat, 'sec');
  for (const d of panneauxOuverts(dom.corps)) d.close();
});
