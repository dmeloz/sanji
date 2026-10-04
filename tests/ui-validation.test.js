// Feuille de validation et liste « à commander » sous faux DOM : ouverture depuis le plat et depuis Réglages,
// quatre gestes, états en texte. Ce n'est pas un test dans un navigateur (mise en page, tactile, IndexedDB).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { noterAchat } from '../app/js/domaine/actions-achats.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

let dom;
let magasin;
let vues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vues = {
    composant: await import('../app/js/ui/vue-composant.js'),
    produits: await import('../app/js/ui/vue-produits.js'),
    reglages: await import('../app/js/ui/vue-reglages.js'),
  };
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

test('feuille : s\'ouvre depuis le plat, montre la fourchette, l\'état du poids, l\'effet, et quatre gestes', () => {
  nettoyer();
  const id = monde();
  const page = vues.composant.rendre(magasin.etat(), id);
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
  for (const g of ['Valider comme standard maison', 'Corriger', 'Seulement cette fois', 'Plus tard']) {
    assert.ok(parTexte(d, g), `geste « ${g} »`);
  }
});

test('feuille depuis le plat : sans valeur tapée, « Valider » est refusé et rien n\'est écrit', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /valeur/i);
  assert.deepEqual(magasin.etat().standards, {});
  assert.equal(d.open, true);
});

test('feuille depuis le plat : valider crée le standard avec la valeur tapée', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
  const d = ouvert();
  controleDe(d, 'Valeur de la portion').value = '55';
  await d.enfants[0].declencher('submit');
  assert.deepEqual(alertes(d), []);
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 55);
  assert.equal(d.open, false);
  assert.equal(parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion'), undefined, 'plus une estimation');
});

test('feuille : une valeur hors fourchette demande une confirmation explicite', async () => {
  nettoyer();
  const id = monde();
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
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
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
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
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
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
  dateDuJour(S.lundi, () => parTexte(vues.composant.rendre(magasin.etat(), id), 'Valider la portion').click());
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

// ---------------------------------------------------------------- liste « à commander »

function mondeProduits() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  magasin.remplacer(e);
}

/** Texte d'état de la ligne compacte (visible sans déplier). */
const etatsCompacts = (n) => n.tous((x) => x.className.includes('produit-etat-texte')).map((x) => x.textContent).join('|');

test('produits : l\'état de chaque ligne est écrit en texte, avec « Noter à commander » et « Retirer »', () => {
  nettoyer();
  mondeProduits();
  const page = vues.produits.rendre(magasin.etat(), S.lundi);
  assert.match(etatsCompacts(page), /^suggéré$/, 'l\'état est écrit dans la ligne compacte');
  assert.ok(page.tous((x) => x.balise === 'details' && x.className.includes('produit-compact')).length > 0, 'une ligne dépliable par produit');
  const resume = page.tous((x) => x.balise === 'summary' && x.className.includes('produit-resume'))[0];
  assert.match(resume.textContent, /standard de base/, 'pastille courte dans la ligne repliée (adapté le 2026-10-04)');
  assert.doesNotMatch(resume.textContent, /Noter à commander|Fournisseur/, 'les détails et gestes sont dans le dépliant');
  assert.ok(parTexte(page, 'Noter à commander'));
  assert.ok(parTexte(page, 'Retirer'));
  assert.ok(parTexte(page, 'Contrôler') && parTexte(page, 'Achat'), 'le reste est gardé');
  assert.match(page.textContent, /Marquer commandé/, 'inactif tant qu\'aucune quantité n\'est saisie');
  assert.doesNotMatch(page.textContent, /Retirées|à relire/);
});

// Adapté le 2026-10-04 (décision « Standards de base ») : le refus sans quantité tapée vaut pour une valeur inconnue ;
// une ligne sur standards de base se note sans quantité, pour la quantité calculée marquée « standard de base ».
test('produits : noter une valeur inconnue sans quantité est refusé, avec une quantité tapée c\'est noté', async () => {
  nettoyer();
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  composantValide(e, S.lundi, 1, { ...J.PRODUIT_CRU_TEST, nom: 'PRODUIT_INCONNU_TEST' },
    { etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'INCONNU', source: 'TEST_ONLY' }] });
  magasin.remplacer(e);
  parTexte(vues.produits.rendre(magasin.etat(), S.lundi), 'Noter à commander').click();
  const d = ouvert();
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /inconnue/);
  assert.equal(magasin.etat().produits[`${S.lundi}|produit_inconnu_test|g`], undefined);
  controleDe(d, 'Quantité à commander (g)').value = '2400';
  await d.enfants[0].declencher('submit');
  const suivi = magasin.etat().produits[`${S.lundi}|produit_inconnu_test|g`];
  assert.equal(suivi.etatLigne, 'note');
  assert.equal(suivi.quantiteAcheter, 2400);
  assert.match(etatsCompacts(vues.produits.rendre(magasin.etat(), S.lundi)), /^noté$/);
});

test('produits : une ligne sur standards de base se note sans quantité tapée, quantité calculée marquée « standard de base »', async () => {
  nettoyer();
  mondeProduits();
  parTexte(vues.produits.rendre(magasin.etat(), S.lundi), 'Noter à commander').click();
  const d = ouvert();
  assert.match(d.textContent, /calculée sur les standards de base \(2 400 g\)/);
  await d.enfants[0].declencher('submit');
  assert.deepEqual(alertes(d), []);
  const suivi = magasin.etat().produits[`${S.lundi}|riz|g`];
  assert.deepEqual([suivi.etatLigne, suivi.quantiteAcheter], ['note', null], 'noter est la confirmation ; rien n\'est écrit dans la quantité achetée');
  const page = vues.produits.rendre(magasin.etat(), S.lundi);
  assert.match(etatsCompacts(page), /^noté$/);
  assert.match(page.textContent, /À acheter2 400 g \(calculée, standard de base\)/);
});

test('produits : retirer range la ligne dans « Retirées », « Remettre » la rend ; « à relire » si le besoin change', () => {
  nettoyer();
  mondeProduits();
  magasin.agir((e, t) => noterAchat(e, S.lundi, 'riz', 'g', { quantite: 2400 }, t));
  parTexte(vues.produits.rendre(magasin.etat(), S.lundi), 'Retirer').click();
  let page = vues.produits.rendre(magasin.etat(), S.lundi);
  const bloc = page.tous((x) => x.balise === 'details' && x.className.includes('lignes-retirees'))[0];
  assert.ok(bloc, 'bloc replié « Retirées »');
  assert.equal(bloc.open, false);
  assert.match(bloc.querySelector('summary').textContent, /Retirées \(1\)/);
  assert.match(etatsCompacts(bloc), /^retiré$/);
  assert.ok(parTexte(bloc, 'Remettre'), 'une ligne retirée montre « Remettre »');
  assert.ok(!parTexte(bloc, 'Marquer commandé'), 'une ligne retirée n\'a pas le geste « Marquer commandé »');
  parTexte(bloc, 'Remettre').click();
  page = vues.produits.rendre(magasin.etat(), S.lundi);
  assert.equal(page.tous((x) => x.balise === 'details' && x.className.includes('lignes-retirees')).length, 0);
  assert.match(etatsCompacts(page), /^noté$/);
  assert.doesNotMatch(page.textContent, /à relire/);
  magasin.agir((e, t) => prevision(e, S.lundi, 2, 80));
  const relire = vues.produits.rendre(magasin.etat(), S.lundi);
  assert.match(etatsCompacts(relire), /^noté · à relire$/);
  assert.equal(magasin.etat().produits[`${S.lundi}|riz|g`].quantiteAcheter, 2400, 'la quantité notée n\'a pas bougé');
});
