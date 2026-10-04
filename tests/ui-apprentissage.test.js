// Apprentissage sous faux DOM : la proposition est une ligne de « À confirmer » ; la toucher ouvre la feuille préremplie ;
// « En faire mon standard » et « Non, garder ». Ce n'est pas un test dans un navigateur. Données TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { composantVide } from '../app/js/domaine/etat.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide } from './aide.js';

let dom;
let magasin;
let tableau;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  tableau = await import('../app/js/ui/vue-tableau.js');
});
after(() => dom.restaurer());

const nettoyer = () => { for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove(); };
const ouvert = () => panneauxOuverts(dom.corps)[0];
const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const controleDe = (d, libelle) => {
  const etiquette = d.tous((x) => x.balise === 'label' && x.textContent === libelle)[0];
  assert.ok(etiquette, `champ « ${libelle} » introuvable`);
  return d.tous((x) => x.attributs.id === etiquette.attributs.for)[0];
};
const dateDuJour = (jour, fonction) => {
  const original = Date;
  const [a, m, j] = jour.split('-').map(Number);
  globalThis.Date = class extends original { constructor(...x) { super(...(x.length ? x : [a, m - 1, j, 9, 0, 0])); } };
  try { return fonction(); } finally { globalThis.Date = original; }
};
const ligneApprentissage = (page) => boutons(page).find((b) => /Vous corrigez souvent/.test(b.textContent));

/** Riz en garniture (standard de base 60 g sec) corrigé trois fois à 80, 90 et 86 g sec. */
function monde() {
  const e = etatVide();
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  magasin.remplacer(e);
}
const page = () => dateDuJour(S.lundi, () => tableau.rendre(magasin.etat(), null));

test('tableau : la proposition est une seule ligne de « À confirmer », sans quantité manquante', () => {
  nettoyer();
  monde();
  const p = page();
  const lignes = p.tous((x) => x.balise === 'button' && /Vous corrigez souvent/.test(x.textContent));
  assert.equal(lignes.length, 1);
  assert.match(lignes[0].textContent, /Vous corrigez souvent riz \(garniture\) vers 86 g : en faire votre standard \?/);
  assert.doesNotMatch(p.textContent, /undefined|NaN|null/);
});

test('tableau : rien à proposer, aucune ligne d\'apprentissage', () => {
  nettoyer();
  magasin.remplacer(etatVide());
  assert.equal(ligneApprentissage(page()), undefined);
});

test('toucher la ligne ouvre la feuille préremplie : valeur proposée, valeur actuelle, historique court', () => {
  nettoyer();
  monde();
  ligneApprentissage(page()).click();
  const d = ouvert();
  assert.ok(d, 'la feuille est ouverte');
  assert.equal(controleDe(d, 'Nouvelle valeur du standard').value, '86');
  assert.match(d.textContent, /Valeur actuelle : 60 g \(standard de base\)/);
  assert.match(d.textContent, /corrigé 3 fois/);
  assert.match(d.textContent, /riz, 80 g/);
  assert.ok(parTexte(d, 'Non, garder'));
  assert.doesNotMatch(d.textContent, /undefined|NaN|null/);
});

test('« En faire mon standard » : le standard maison est écrit, la ligne disparaît', async () => {
  nettoyer();
  monde();
  ligneApprentissage(page()).click();
  const d = ouvert();
  await d.enfants[0].declencher('submit');
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 86);
  assert.equal(magasin.etat().standards.riz.garniture.etat, 'sec');
  assert.equal(d.open, false);
  assert.equal(ligneApprentissage(page()), undefined);
});

test('valeur retapée : c\'est elle qui devient le standard', async () => {
  nettoyer();
  monde();
  ligneApprentissage(page()).click();
  const d = ouvert();
  controleDe(d, 'Nouvelle valeur du standard').value = '84';
  await d.enfants[0].declencher('submit');
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 84);
});

test('« Non, garder » : rien n\'est changé, la ligne se tait, l\'écart est mémorisé', async () => {
  nettoyer();
  monde();
  ligneApprentissage(page()).click();
  const d = ouvert();
  await parTexte(d, 'Non, garder').click();
  assert.deepEqual(magasin.etat().standards, {});
  assert.equal(magasin.etat().validations['apprentissage:riz|garniture'].statut, 'ecarte');
  assert.equal(d.open, false);
  assert.equal(ligneApprentissage(page()), undefined);
});
