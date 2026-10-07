// Feuilles « Couverts midi » et « Ventes du midi » (refonte 2) sous faux DOM : le total, la répartition calculée puis corrigée, le détail
// replié, l'enregistrement qui recalcule la production, les ventes, la case « Ventes à saisir » dès 14 h. Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { definirMenu, definirStandard, saisirVentes } from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { jourOuVide } from '../app/js/domaine/etat.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let feuille;
let accueil;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  feuille = await import('../app/js/ui/feuille-couverts.js');
  accueil = await import('../app/js/ui/vue-aujourdhui.js');
});
after(() => dom.restaurer());

/** Fige la date et l'heure locales (la classe Date est remplacée le temps de l'appel). */
function aLHeure(iso, heure, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T${heure}:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const bouton = (noeud, test) => boutons(noeud).find((b) => (typeof test === 'string' ? b.textContent === test || b.attributs['aria-label'] === test : test.test(b.textContent)));
const feuilleOuverte = () => panneauxOuverts(dom.corps)[0];
const fermerTout = () => { for (const d of panneauxOuverts(dom.corps)) d.close(); };
const soumettre = async (d) => { await d.enfants[0].declencher('submit'); };

/** Un lundi avec ses deux menus et un standard : la quantité du plat dépend du nombre de couverts. */
function lundi() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Tagliatelles', h());
  definirMenu(e, S.lundi, 2, 'riz', h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  e.reglages.semaineTypeConfirmee = true;
  return e;
}

test('Couverts midi : un total, la répartition calculée 1/3 – 2/3, étiquettes « calculé » et « provisoire », détail replié', async () => {
  magasin.remplacer(lundi());
  aLHeure(S.lundi, '10:00', () => feuille.ouvrirCouvertsMidi(S.lundi));
  const d = feuilleOuverte();
  assert.equal(d.querySelector('h2').textContent, 'Couverts midi');
  assert.match(d.textContent, /seulement aujourd'hui/);
  assert.deepEqual(classes(d, 'cv-puce').map((b) => b.textContent), ['40', '50', '60', '70', '80']);
  await bouton(d, '60').click();
  assert.equal(classes(d, 'cv-grand')[0].textContent, '60');
  assert.deepEqual(classes(d, 'cv-moyen').map((x) => x.textContent), ['20', '40']);
  assert.deepEqual(classes(d, 'cv-etiquette').map((x) => x.textContent), ['calculé', 'provisoire']);
  const detail = bouton(d, /Détail du calcul/);
  assert.equal(detail.attributs['aria-expanded'], 'false', 'replié par défaut');
  assert.equal(classes(d, 'cv-detail-corps').length, 0);
  await detail.click();
  assert.match(classes(d, 'cv-detail-corps')[0].textContent, /au départ, 1\/3 menu 1 et 2\/3 menu 2/);
  assert.match(classes(d, 'cv-detail-corps')[0].textContent, /20 .* 100 g.* = /, 'couverts × portion = quantité');
  fermerTout();
});

test('Couverts midi : « Annuler » ne change rien ; sans total, « Enregistrer » refuse', async () => {
  magasin.remplacer(lundi());
  aLHeure(S.lundi, '10:00', () => feuille.ouvrirCouvertsMidi(S.lundi));
  const d = feuilleOuverte();
  await soumettre(d);
  assert.match(d.textContent, /Saisissez le total des couverts/);
  assert.equal(jourOuVide(magasin.etat(), S.lundi).couverts, null);
  await bouton(d, 'Annuler').click();
  assert.equal(panneauxOuverts(dom.corps).length, 0);
  assert.equal(jourOuVide(magasin.etat(), S.lundi).previsions[1].portions, null);
});

test('Couverts midi : corriger la répartition (« décidé par vous »), revenir au calcul, enregistrer recalcule la production du jour', async () => {
  const e = lundi();
  magasin.remplacer(e);
  const avant = Object.values(magasin.etat().composants).find((c) => c.nom === 'Tagliatelles');
  assert.equal(calculerComposant(magasin.etat(), avant.id).quantiteTravail ?? null, null, 'sans prévision, aucune quantité');
  aLHeure(S.lundi, '10:00', () => feuille.ouvrirCouvertsMidi(S.lundi));
  const d = feuilleOuverte();
  await bouton(d, '60').click();
  await bouton(d, 'Un couvert du menu 2 vers le menu 1').click();
  assert.deepEqual(classes(d, 'cv-moyen').map((x) => x.textContent), ['21', '39']);
  assert.deepEqual(classes(d, 'cv-etiquette').map((x) => x.textContent), ['décidé par vous', 'provisoire']);
  assert.ok(bouton(d, 'Revenir au calcul'));
  await bouton(d, 'Revenir au calcul').click();
  assert.deepEqual(classes(d, 'cv-moyen').map((x) => x.textContent), ['20', '40']);
  assert.equal(bouton(d, 'Revenir au calcul'), undefined);
  await bouton(d, 'Un couvert du menu 2 vers le menu 1').click();
  await soumettre(d);
  assert.equal(panneauxOuverts(dom.corps).length, 0, 'la feuille se ferme');
  const jour = jourOuVide(magasin.etat(), S.lundi);
  assert.deepEqual([jour.previsions[1].portions, jour.previsions[2].portions], [21, 39]);
  assert.deepEqual(jour.couverts.repartition, { 1: 21, 2: 39 });
  assert.equal(calculerComposant(magasin.etat(), avant.id).quantiteTravail, 2100, '21 couverts × 100 g : la production suit');
  const message = dom.document.getElementById('messages');
  assert.match(message.textContent, /Production du jour recalculée · 60 couverts/);
});

test('Couverts midi : un autre jour que le jour actuel dit « midi », la même feuille ; les fiches de fonction sont un lien vers Semaine', async () => {
  const e = lundi();
  magasin.remplacer(e);
  aLHeure(S.lundi, '10:00', () => feuille.ouvrirCouvertsMidi(S.mardi));
  const d = feuilleOuverte();
  assert.match(d.textContent, /Mardi .* · midi/);
  assert.doesNotMatch(d.textContent, /seulement aujourd'hui/);
  fermerTout();
});

test('Ventes du midi : M1 et M2 servis, « Plus tard » ne touche à rien, « Enregistrer » saisit les ventes', async () => {
  const e = lundi();
  magasin.remplacer(e);
  aLHeure(S.lundi, '14:30', () => feuille.ouvrirVentesMidi(S.lundi));
  let d = feuilleOuverte();
  assert.equal(d.querySelector('h2').textContent, 'Ventes du midi');
  await bouton(d, 'Une vente de plus au menu 1').click();
  await bouton(d, 'Une vente de plus au menu 1').click();
  await bouton(d, 'Une vente de plus au menu 2').click();
  assert.equal(classes(d, 'cv-servi')[0].textContent, 'Total servi3');
  await bouton(d, 'Plus tard').click();
  assert.equal(jourOuVide(magasin.etat(), S.lundi).ventes[1], null, 'rien d\'enregistré');
  aLHeure(S.lundi, '14:30', () => feuille.ouvrirVentesMidi(S.lundi));
  d = feuilleOuverte();
  await bouton(d, 'Une vente de plus au menu 1').click();
  await bouton(d, 'Une vente de plus au menu 2').click();
  await bouton(d, 'Une vente de plus au menu 2').click();
  await soumettre(d);
  const v = jourOuVide(magasin.etat(), S.lundi).ventes;
  assert.deepEqual([v[1], v[2]], [1, 2]);
});

test('case « Couverts midi » : avant 14 h elle ouvre les couverts ; dès 14 h, « Ventes à saisir » ouvre les ventes ; saisies, elle dit « servis »', async () => {
  magasin.remplacer(lundi());
  const rendre = (heure) => aLHeure(S.lundi, heure, () => accueil.rendre(magasin.etat()));
  const caseDe = (page) => classes(page, 'tdb-case').find((c) => /Couverts midi/.test(c.textContent));
  const matin = caseDe(rendre('10:00'));
  assert.doesNotMatch(matin.textContent, /Ventes à saisir/);
  aLHeure(S.lundi, '10:00', () => matin.click());
  assert.equal(feuilleOuverte().querySelector('h2').textContent, 'Couverts midi');
  fermerTout();
  const apres = caseDe(rendre('14:00'));
  assert.match(apres.textContent, /Ventes à saisir/);
  assert.equal(matin.balise, 'button');
  aLHeure(S.lundi, '14:00', () => apres.click());
  assert.equal(feuilleOuverte().querySelector('h2').textContent, 'Ventes du midi');
  fermerTout();
  const e = magasin.etat();
  saisirVentes(e, S.lundi, 1, 18, h());
  saisirVentes(e, S.lundi, 2, 35, h());
  magasin.remplacer(e);
  assert.match(caseDe(rendre('15:00')).textContent, /servis M1 18 · M2 35/);
});
