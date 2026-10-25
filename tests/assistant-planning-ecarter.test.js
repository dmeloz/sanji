// Brouillon de planning : le geste « Écarter » / « Rétablir » par ligne (faux DOM). Données TEST_ONLY ; aucun réseau.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let assistant;
let reglages;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  reglages = await import('../app/js/ui/assistant-reglages.js');
  assistant = await import('../app/js/ui/assistant-planning.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

const ouverts = () => panneauxOuverts(dom.corps);
const boutonsDe = (racine) => Array.from(racine.querySelectorAll('button'));
const parNom = (racine, nom) => boutonsDe(racine).find((b) => b.getAttribute('aria-label') === nom);
const valider = (racine) => boutonsDe(racine).find((b) => b.getAttribute('type') === 'submit');

async function ouvrirBrouillon() {
  reglages.effacerReglagesIA();
  for (const d of ouverts()) d.close();
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  prevision(e, S.lundi, 2, 30);
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const cru = composantValide(e, S.lundi, 2, J.PRODUIT_CRU_TEST);
  magasin.remplacer(e);
  await aDate(S.lundi, () => assistant.ouvrirAssistantPlanning({ date: S.lundi }));
  const brouillon = ouverts().find((d) => /Brouillon de planning/.test(d.textContent));
  assert.ok(brouillon, 'le brouillon est ouvert');
  return { brouillon, pSec: principaleDe(e, sec), pCru: principaleDe(e, cru) };
}

test('écarter une ligne : dite en texte, compteur à jour, rétablir la remet', async () => {
  const { brouillon } = await ouvrirBrouillon();
  assert.match(brouillon.textContent, /2 préparations à planifier/);
  const ecarter = parNom(brouillon, 'Écarter : PRODUIT_CRU_TEST');
  assert.ok(ecarter, 'bouton nommé « Écarter : <préparation> »');
  await ecarter.click();
  assert.match(brouillon.textContent, /PRODUIT_CRU_TEST · écartée/);
  assert.match(brouillon.textContent, /1 préparation à planifier \(1 écartée\)/);
  assert.ok(boutonsDe(brouillon).some((b) => b.getAttribute('aria-label') === 'Rétablir : PRODUIT_CRU_TEST' && b.textContent === 'Rétablir'));
  await parNom(brouillon, 'Rétablir : PRODUIT_CRU_TEST').click();
  assert.match(brouillon.textContent, /2 préparations à planifier\. Rien/);
  assert.doesNotMatch(brouillon.textContent, /écartée/);
  brouillon.close();
});

test('« Valider et planifier » n\'applique que les lignes non écartées', async () => {
  const { brouillon, pSec, pCru } = await ouvrirBrouillon();
  await parNom(brouillon, 'Écarter : PRODUIT_CRU_TEST').click();
  await aDate(S.lundi, () => brouillon.querySelector('form').declencher('submit'));
  assert.equal(magasin.etat().productions[pSec].jourDecide, S.lundi);
  assert.equal(magasin.etat().productions[pCru].jourDecide, null, 'la ligne écartée n\'est pas planifiée');
  for (const d of ouverts()) d.close();
});

test('tout écarter désactive « Valider et planifier » ; en rétablir une le réactive', async () => {
  const { brouillon, pSec, pCru } = await ouvrirBrouillon();
  await parNom(brouillon, 'Écarter : PRODUIT_CRU_TEST').click();
  assert.equal(valider(brouillon).disabled, false);
  await parNom(brouillon, 'Écarter : PRODUIT_SEC_TEST').click();
  assert.equal(valider(brouillon).disabled, true);
  await brouillon.querySelector('form').declencher('submit');
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  assert.equal(magasin.etat().productions[pCru].jourDecide, null);
  await parNom(brouillon, 'Rétablir : PRODUIT_SEC_TEST').click();
  assert.equal(valider(brouillon).disabled, false);
  brouillon.close();
});
