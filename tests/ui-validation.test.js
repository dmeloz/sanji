// Feuille de validation sous faux DOM : ouverture depuis le plat et depuis Réglages,
// un geste principal, deux secondaires, Annuler en lien, états en texte. Ce n'est pas un test dans un navigateur (mise en page, tactile, IndexedDB).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts, ficheAvecReglages } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision } from './aide.js';

let dom;
let magasin;
let vues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vues = {
    fiche: await import('../app/js/ui/vue-fiche.js'),
    reglages: await import('../app/js/ui/vue-reglages.js'),
  };
});
after(() => dom.restaurer());
/** La fiche et sa feuille « Plus de réglages » (les gestes avancés n'y sont plus déroulés). */
const fiche = (etat, id) => ficheAvecReglages(dom.corps, vues.fiche.rendre(etat, id));

const nettoyer = () => { for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove(); };
const ouvert = () => panneauxOuverts(dom.corps)[0];
const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const controleDe = (d, libelle) => {
  const etiquette = d.tous((x) => x.balise === 'label' && x.textContent === libelle)[0];
  assert.ok(etiquette, `champ « ${libelle} » introuvable`);
  return d.tous((x) => x.attributs.id === etiquette.attributs.for)[0];
};
const alertes = (d) => d.tous((x) => x.attributs.role === 'alert' && !x.hidden).map((x) => x.textContent);

/** Menu 2 « riz » au poste : portion venue du repère validé (fourchette 50–70 g sec). */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  const riz = Object.values(e.composants).find((c) => c.famille === 'riz');
  magasin.remplacer(e);
  return riz.id;
}
const dateDuJour = (jour, fonction) => {
  const original = Date;
  const [a, m, j] = jour.split('-').map(Number);
  globalThis.Date = class extends original { constructor(...x) { super(...(x.length ? x : [a, m - 1, j, 9, 0, 0])); } };
  try { return fonction(); } finally { globalThis.Date = original; }
};

test('feuille : s\'ouvre depuis le plat, montre la fourchette, l\'état du poids, l\'effet, et un geste principal, deux secondaires, Annuler en lien', () => {
  nettoyer();
  const id = monde();
  const page = fiche(magasin.etat(), id);
  assert.ok(parTexte(page, 'Valider la portion'));
  dateDuJour(S.lundi, () => parTexte(page, 'Valider la portion').click());
  const d = ouvert();
  assert.ok(d, 'la feuille est ouverte');
  const texte = d.textContent;
  assert.match(texte, /50–70 g/);
  assert.match(texte, /poids sec/);
  assert.match(texte, /40 portions/);
  assert.match(texte, /Sources/);
  assert.doesNotMatch(texte, /undefined|NaN|null/);
  // Adapté (audit v56) : un geste principal, deux secondaires, Annuler en lien ; « Corriger » seulement quand un standard existe.
  for (const g of ['Valider comme standard maison', 'Seulement cette fois', 'Plus tard', 'Annuler']) {
    assert.ok(parTexte(d, g), `geste « ${g} »`);
  }
  assert.equal(parTexte(d, 'Corriger'), undefined, 'pas de standard maison à corriger');
  assert.match(parTexte(d, 'Annuler').className, /btn-lien/);
});

test('feuille depuis le plat : sans valeur tapée, « Valider » est refusé et rien n\'est écrit', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /valeur/i);
  assert.deepEqual(magasin.etat().standards, {});
  assert.equal(d.open, true);
});

test('feuille depuis le plat : valider crée le standard avec la valeur tapée', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  controleDe(d, 'Valeur de la portion').value = '55';
  await d.enfants[0].declencher('submit');
  assert.deepEqual(alertes(d), []);
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 55);
  assert.equal(d.open, false);
  assert.equal(parTexte(fiche(magasin.etat(), id), 'Valider la portion'), undefined, 'plus une estimation');
});

test('feuille : une valeur hors fourchette demande une confirmation explicite', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  controleDe(d, 'Valeur de la portion').value = '90';
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /hors de la fourchette/);
  controleDe(d, 'Cette valeur est hors de la fourchette : je la confirme').checked = true;
  await d.enfants[0].declencher('submit');
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 90);
});

test('feuille depuis le plat : « Seulement cette fois » corrige le plat, jamais le standard', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  controleDe(d, 'Valeur de la portion').value = '52';
  await parTexte(d, 'Seulement cette fois').click();
  assert.equal(magasin.etat().composants[id].grammage.valeur, 52);
  assert.equal(magasin.etat().composants[id].grammage.statut, 'SAISI_SERVICE');
  assert.deepEqual(magasin.etat().standards, {});
});

test('feuille depuis le plat : « Plus tard » masque la valeur sans rien changer', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  await parTexte(d, 'Plus tard').click();
  assert.equal(magasin.etat().validations['riz|garniture'].statut, 'plus_tard');
  assert.equal(magasin.etat().composants[id].grammage.valeur, null);
  assert.deepEqual(magasin.etat().standards, {});
  assert.equal(d.open, false);
});

test('« Plus tard » masque vraiment la valeur le même jour (valeursAValider et feuille), elle revient le lendemain', async () => {
  nettoyer();
  const id = monde();
  const { valeursAValider } = await import('../app/js/domaine/validation.js');
  const cles = (jour) => valeursAValider(magasin.etat(), jour).map((v) => v.cle);
  const feuilleOuverte = () => ouvert() !== undefined;
  assert.deepEqual(cles(S.lundi), ['riz|garniture'], 'avant : la valeur est proposée');
  dateDuJour(S.lundi, () => parTexte(fiche(magasin.etat(), id), 'Valider la portion').click());
  assert.equal(feuilleOuverte(), true, 'avant : la feuille propose la valeur');
  await dateDuJour(S.lundi, () => parTexte(ouvert(), 'Plus tard').click());
  assert.match(magasin.etat().validations['riz|garniture'].h, /^2026-10-0[45]/, 'masquée à la date du clic simulé');
  assert.equal(feuilleOuverte(), false, 'la feuille se ferme : elle ne propose plus la valeur');
  assert.deepEqual(cles(S.lundi), [], 'le même jour : valeursAValider ne la propose plus');
  // Le lendemain du report, la valeur revient (report daté de la veille du jour regardé).
  magasin.agir((e) => { e.validations['riz|garniture'].h = `${S.samediPrecedent}T09:00:00.000Z`; });
  assert.deepEqual(cles(S.lundi), ['riz|garniture'], 'le lendemain : elle revient');
  assert.equal(magasin.etat().composants[id].grammage.valeur, null, 'rien n\'a changé dans le plat');
});

test('feuille depuis Réglages : « Valider la proposition », puis « Corriger » remplace le standard', async () => {
  nettoyer();
  monde();
  const page = vues.reglages.rendre(magasin.etat(), 'standards');
  const geste = boutons(page).find((b) => b.attributs['aria-label'] === 'Valider la proposition : riz, en garniture');
  assert.ok(geste, 'geste sur la ligne du riz en garniture');
  assert.ok(boutons(page).find((b) => b.attributs['aria-label'] === 'Régler le standard : riz, en garniture'), 'le geste « Régler » reste');
  dateDuJour(S.lundi, () => geste.click());
  let d = ouvert();
  assert.match(d.textContent, /50–70 g/);
  assert.match(d.textContent, /40 portions/);
  controleDe(d, 'Valeur de la portion').value = '60';
  await d.enfants[0].declencher('submit');
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 60);
  // Second passage : le standard est montré, valider ne l'écrase pas, corriger le remplace.
  nettoyer();
  dateDuJour(S.lundi, () => boutons(vues.reglages.rendre(magasin.etat(), 'standards'))
    .find((b) => b.attributs['aria-label'] === 'Valider la proposition : riz, en garniture').click());
  d = ouvert();
  assert.match(d.textContent, /Standard maison déjà validé : 60 g/);
  controleDe(d, 'Valeur de la portion').value = '65';
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /déjà validé/);
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 60);
  await parTexte(d, 'Corriger').click();
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 65);
});

test('feuille depuis Réglages : « Seulement cette fois » et « Plus tard » fonctionnent aussi', async () => {
  nettoyer();
  const id = monde();
  const ouvrir = () => dateDuJour(S.lundi, () => boutons(vues.reglages.rendre(magasin.etat(), 'standards'))
    .find((b) => b.attributs['aria-label'] === 'Valider la proposition : riz, en garniture').click());
  ouvrir();
  let d = ouvert();
  controleDe(d, 'Valeur de la portion').value = '51';
  await parTexte(d, 'Seulement cette fois').click();
  assert.equal(magasin.etat().composants[id].grammage.valeur, 51);
  assert.deepEqual(magasin.etat().standards, {});
  nettoyer();
  ouvrir();
  d = ouvert();
  await parTexte(d, 'Plus tard').click();
  assert.equal(magasin.etat().validations['riz|garniture'].statut, 'plus_tard');
});
