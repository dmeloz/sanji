// Lot « Réglages, journal, validation, poste » (audit v56) : montrer l'exception, pas la normalité.
// Faux DOM : ni mise en page ni navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { ajusterStandard } from '../app/js/domaine/actions-ajustements.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let reglages;
let validation;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
  validation = await import('../app/js/ui/feuille-validation.js');
});
after(() => dom.restaurer());

const bouton = (n, t) => boutons(n).find((b) => b.textContent === t);
const ligneDe = (r, debut) => r.tous((x) => x.balise === 'li' && x.textContent.startsWith(debut))[0];
const messages = () => dom.corps.tous((x) => x.attributs.role === 'status').map((x) => x.textContent);

test('B2 : un gain de cuisson dit qu\'il est sans effet sur une portion en poids sec ; une perte de parage non', () => {
  magasin.remplacer(etatVide());
  const p = reglages.rendre(magasin.etat(), 'standards-base');
  const gain = ligneDe(p, 'Pâtes sèches');
  assert.ok(gain, 'ligne des pâtes sèches');
  assert.ok(gain.textContent.includes(reglages.PHRASE_GAIN_SEC));
  assert.match(reglages.PHRASE_GAIN_SEC, /Sans effet sur une portion saisie en poids sec/);
  assert.doesNotMatch(ligneDe(p, 'Carottes').textContent, /Sans effet/);
});

test('« Revenir au standard » rétablit la valeur, la ligne reste à sa place et dit « Valeur de base rétablie »', () => {
  const e = etatVide();
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  magasin.remplacer(e);
  bouton(ligneDe(reglages.rendre(magasin.etat(), 'standards-base'), 'Carottes'), 'Revenir au standard').click();
  assert.deepEqual(magasin.etat().ajustements, {});
  const page = reglages.rendre(magasin.etat(), 'standards-base');
  assert.equal(page.tous((x) => x.balise === 'details').length, 0, 'plus aucun repli');
  assert.ok(ligneDe(page, 'Carottes'), 'la ligne est toujours visible');
  assert.ok(messages().some((m) => /Valeur de base rétablie/.test(m)));
});

test('libellés : routes inchangées, titres explicites', () => {
  assert.equal(reglages.titre('standards'), 'Standards maison');
  assert.equal(reglages.titre('standards-base'), 'Standards de base');
  assert.ok(reglages.CLES_RUBRIQUES.includes('standards') && reglages.CLES_RUBRIQUES.includes('standards-base'));
});

test('journal : une valeur de base changée se lit en phrase, sans identifiant technique', () => {
  const e = etatVide();
  const gain = ajusterStandard(e, 'pates_seches', 'rendement_cuisson', 2.5, h());
  assert.ok(gain);
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  const j = e.journal.filter((x) => x.action === 'ajusterStandard');
  const phrase = reglages.phraseJournal(e, j[0]);
  assert.match(phrase.titre, /^Gain de cuisson, pâtes sèches : [\d,]+ → 2,5 \(votre valeur\)$/);
  assert.doesNotMatch(phrase.titre, /ajusterStandard|rendement_cuisson|pates_seches|\|/);
  assert.match(reglages.phraseJournal(e, j[1]).titre, /^Perte de parage, carottes : [\d,]+ → 30 % \(votre valeur\)$/);
});

test('journal : retour au standard en phrase ; entrée inconnue = texte neutre, jamais l\'identifiant', () => {
  const e = etatVide();
  ajusterStandard(e, 'carottes', 'rendement_parage', 30, h());
  const retour = { h: h(), action: 'revenirAuStandard', detail: 'rendement_parage|carottes : retour au standard de base' };
  assert.equal(reglages.phraseJournal(e, retour).titre, 'Perte de parage, carottes : valeur de base rétablie');
  const inconnue = reglages.phraseJournal(e, { h: h(), action: 'machinTruc', detail: 'x|y : z' });
  assert.equal(inconnue.titre, 'Modification enregistrée');
  assert.equal(inconnue.detail, '');
  const casse = reglages.phraseJournal(e, { h: h(), action: 'ajusterStandard', detail: 'format inattendu' });
  assert.doesNotMatch(casse.titre, /ajusterStandard/);
});

test('journal : retour d\'un gain de cuisson dit « Gain », pas « Perte » ; restauration, produits, écarts et champs en phrases', () => {
  const e = etatVide();
  const phrase = (action, detail) => reglages.phraseJournal(e, { h: h(), action, detail });
  assert.equal(phrase('revenirAuStandard', 'rendement_cuisson|pates_seches : retour au standard de base').titre,
    'Gain de cuisson, pâtes sèches : valeur de base rétablie');
  assert.equal(phrase('revenirAuStandard', 'rendement_cuisson|riz : retour au standard de base').titre.split(',')[0], 'Gain de cuisson');
  const restauree = phrase('restaurer', 'sanji-2026-10-04.json');
  assert.equal(restauree.titre, 'Sauvegarde restaurée');
  assert.match(restauree.detail, /sanji-2026-10-04\.json/);
  assert.equal(phrase('restaurer', '').detail, '');
  const achat = phrase('noterAchat', 'carottes|kg : 5 kg calculés (standard de base)');
  assert.equal(achat.detail, 'carottes (kg) : 5 kg calculés (standard de base)');
  assert.equal(phrase('controlerProduit', 'pommes_de_terre|g : a_commander').detail, 'pommes de terre (g) : à commander');
  assert.equal(phrase('retirerAchat', 'carottes|piece').detail, 'carottes (pièce)');
  assert.equal(phrase('deciderEcart', 'Sauce bolognaise : complement').detail, 'Sauce bolognaise : complément à produire');
  assert.equal(phrase('deciderEcart', 'Riz : ajustement').detail, 'Riz : écart réglé par ajustement');
  assert.equal(phrase('deciderEcart', 'Riz : aucune').detail, 'Riz : aucune production supplémentaire');
  assert.equal(phrase('modifierComposant', 'Bolets : nom, allergenes, produitNom').detail, 'Bolets : nom, allergènes, produit acheté');
  assert.equal(phrase('reprendreMemoire', 'Riz : type, etapes').detail, 'Riz : type, étapes');
  assert.equal(phrase('modifierFiche', 'F1 : menuFixe, couverts').detail, 'F1 : menu fixé, couverts');
  assert.equal(phrase('definirCreneau', '2026-10-05 avant_midi : charge').detail, '05/10/2026 avant midi : chargé');
  assert.equal(phrase('noterExport', '2026-10-04T08:00:00.000Z').detail, '');
  for (const [action, detail] of [['noterAchat', 'carottes|kg : 5 kg'], ['deciderEcart', 'X : complement'], ['modifierComposant', 'X : allergenes']]) {
    assert.doesNotMatch(`${phrase(action, detail).titre} ${phrase(action, detail).detail}`, /\||complement|allergenes|ajustement|aucune$/);
  }
});

test('journal affiché : aucun identifiant technique à l\'écran', () => {
  const e = etatVide();
  ajusterStandard(e, 'pates_seches', 'rendement_cuisson', 2.5, h());
  e.journal.push({ h: h(), action: 'inventee', detail: 'plat_principal' });
  magasin.remplacer(e);
  const t = reglages.rendre(magasin.etat(), 'donnees').textContent;
  assert.match(t, /Gain de cuisson, pâtes sèches/);
  assert.doesNotMatch(t, /ajusterStandard|inventee|plat_principal|pates_seches/);
});

function valeurTest(extra = {}) {
  return { cle: 'riz|garniture', famille: 'riz', libelle: 'riz', role: 'garniture', composantIds: [],
    proposition: { min: 50, max: 70, unite: 'g', etat: 'sec' }, effet: { portions: 0 }, sources: 'x', standard: null, ...extra };
}
const controle = (d, libelle) => {
  const et = d.tous((x) => x.balise === 'label' && x.textContent === libelle)[0];
  return d.tous((x) => x.attributs.id === et.attributs.for)[0];
};

test('feuille : champ prérempli par la valeur proposée, vide sinon ; erreur annoncée dès la saisie invalide', async () => {
  validation.ouvrirValidation(valeurTest());
  let d = panneauxOuverts(dom.corps)[0];
  assert.equal(controle(d, 'Valeur de la portion').value, '', 'jamais remplie par le milieu de la fourchette');
  const champ = controle(d, 'Valeur de la portion');
  champ.value = 'abc';
  await champ.declencher('input');
  const alerte = d.tous((x) => x.attributs.role === 'alert' && !x.hidden);
  assert.ok(alerte.length === 1 && /nombre invalide/.test(alerte[0].textContent), 'erreur dès la saisie');
  champ.value = '55';
  await champ.declencher('input');
  assert.equal(d.tous((x) => x.attributs.role === 'alert' && !x.hidden).length, 0, 'erreur effacée');
  d.close?.();
  for (const x of dom.corps.tous((y) => y.balise === 'dialog')) x.remove();

  validation.ouvrirValidation(valeurTest({ valeurProposee: 60 }));
  d = panneauxOuverts(dom.corps)[0];
  assert.equal(controle(d, 'Valeur de la portion').value, '60');
  for (const x of dom.corps.tous((y) => y.balise === 'dialog')) x.remove();

  validation.ouvrirValidation(valeurTest({ standard: { valeur: 65, unite: 'g', etat: 'sec' } }));
  d = panneauxOuverts(dom.corps)[0];
  assert.equal(controle(d, 'Valeur de la portion').value, '65', 'standard maison existant');
  assert.ok(bouton(d, 'Corriger'), '« Corriger » quand un standard existe');
  for (const x of dom.corps.tous((y) => y.balise === 'dialog')) x.remove();
});
