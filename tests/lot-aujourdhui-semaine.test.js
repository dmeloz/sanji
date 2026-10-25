// Lot « Aujourd'hui, Semaine, fiche de fonction, hors ligne, sombre » (audit UI v56 : montrer l'exception, pas la normalité).
// Faux DOM : ni mise en page ni tactile réels (à vérifier à l'écran à 390 px, clair et sombre). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { creerFiche, definirMenu, definirPrevision } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';
import { detailDuJour } from './aide-detail.js';

let dom; let magasin; let aujourdhuiVue; let productionVue; let services; let detailVue; let fiches; let horsligne; let reglages;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  aujourdhuiVue = await import('../app/js/ui/vue-aujourdhui.js');
  productionVue = await import('../app/js/ui/vue-production.js');
  services = await import('../app/js/ui/feuille-services.js');
  detailVue = await import('../app/js/ui/vue-detail.js');
  fiches = await import('../app/js/ui/fiches.js');
  horsligne = await import('../app/js/ui/horsligne.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const classes = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const calme = (e) => e;
const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const debutLot = css.indexOf("/* ---- Lot « Aujourd'hui, Semaine, fiche de fonction");
// Le bloc du lot s'arrête au bloc commenté suivant (d'autres lots ajoutent les leurs après lui).
const finLot = css.slice(debutLot + 10).search(/\/\* (-{4}|={5}) /);
const blocLot = css.slice(debutLot, finLot < 0 ? undefined : debutLot + 10 + finLot);

/** Mercredi : menu 1 saisi (composants créés seuls, allergènes non validés), fiche de fonction avec une allergie. */
function mercrediAvecFiche(mode = 'menu_fixe') {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  definirPrevision(e, S.mercredi, 1, 10, h());
  creerFiche(e, { numero: 'F1', date: S.mercredi, service: 'midi', horaire: '12:00', couverts: 8, mode, menuFixe: mode === 'menu_fixe' ? 1 : null,
    allergies: 'gluten', ...(mode === 'choix_libre' ? { repartition: { 1: 8, 2: 0 } } : {}) }, h());
  return e;
}
const rendreAu = (iso, e) => aDate(iso, () => { magasin.remplacer(e); return aujourdhuiVue.rendre(magasin.etat()); });

// ---------------------------------------------------------------- 1. allergènes

test('Aujourd\'hui : la certitude est celle de la répartition, et « allergènes à confirmer » reste dit tant qu\'ils ne sont pas validés', () => {
  const e = mercrediAvecFiche();
  const carte = classes(rendreAu(S.mercredi, e), 'au-fiche')[0];
  const t = carte.textContent;
  assert.match(t, /allergies : gluten/);
  assert.match(t, /répartition confirmée/);
  assert.doesNotMatch(t, /gluten · confirmée/, 'jamais « confirmée » collé aux allergies');
  assert.match(t, /allergènes à confirmer/);
  assert.equal(classes(carte, 'pastille-ambre').length, 1, 'pastille ambre, avec le mot écrit');
  assert.match(carte.attributs['aria-label'], /allergènes à confirmer/);
});

test('Aujourd\'hui : la pastille disparaît quand la liste des allergènes des composants est validée, l\'allergie du groupe reste écrite', () => {
  const e = mercrediAvecFiche();
  for (const c of Object.values(e.composants)) { c.type = 'produit_brut'; c.allergenes = { statut: 'valide', liste: ['gluten'] }; }
  const t = classes(rendreAu(S.mercredi, e), 'au-fiche')[0].textContent;
  assert.doesNotMatch(t, /allergènes à confirmer/);
  assert.match(t, /allergies : gluten/);
});

test('Aujourd\'hui : choix libre provisoire, la répartition est dite provisoire (pas les allergènes)', () => {
  const t = classes(rendreAu(S.mercredi, mercrediAvecFiche('choix_libre')), 'au-fiche')[0].textContent;
  assert.match(t, /répartition provisoire/);
});

// ---------------------------------------------------------------- 2. hors ligne

test('horsligne.js : une seule fonction, null quand tout est normal (prêt ou vérification en cours), un texte sinon', () => {
  const { problemeHorsLigne } = horsligne;
  assert.equal(problemeHorsLigne({ pret: true, attente: false, raison: '' }), null);
  assert.equal(problemeHorsLigne({ pret: false, attente: true, raison: 'vérification en cours' }), null);
  assert.equal(problemeHorsLigne({ pret: false, attente: false, raison: 'les fichiers ne sont pas encore en cache' }),
    'hors ligne pas encore prêt : les fichiers ne sont pas encore en cache');
  assert.equal(problemeHorsLigne({ pret: false, attente: false, raison: '' }), 'hors ligne pas encore prêt');
  // Le libellé complet reste disponible pour Réglages.
  assert.equal(horsligne.libelleHorsLigne({ pret: true, attente: false, raison: '' }), 'hors ligne prêt');
});

test('les écrans ne montrent rien quand tout est normal, et le problème en toutes lettres sinon (Aujourd\'hui, Semaine, Réglages)', async () => {
  const e = mercrediAvecFiche();
  assert.doesNotMatch(rendreAu(S.mercredi, e).textContent, /hors ligne/);
  assert.match(reglages.rendre(e, null).textContent, /Vérification en cours/, 'Réglages garde l\'état (pied), neutre pendant l\'attente');
  // Ici le navigateur de test n'a pas de service worker : c'est un vrai problème, dit tel quel.
  await horsligne.preparerHorsLigne();
  assert.ok(horsligne.problemeHorsLigne(), 'problème détecté');
  const au = rendreAu(S.mercredi, e);
  assert.equal(classes(au, 'au-hors-ligne').length, 1);
  assert.match(classes(au, 'au-hors-ligne')[0].textContent, /hors ligne pas encore prêt/);
  assert.doesNotMatch(au.textContent, /hors ligne prêt/);
  magasin.remplacer(e);
  assert.match(aDate(S.mercredi, () => productionVue.rendre(magasin.etat(), S.mercredi)).textContent, /hors ligne pas encore prêt/);
  const pied = classes(reglages.rendre(e, null), 'reglages-pied')[0];
  assert.match(pied.textContent, /Hors ligne pas encore prêt/);
  assert.doesNotMatch(pied.textContent, /Fonctionne hors ligne/);
});

// ---------------------------------------------------------------- 3. Semaine

function semaineAvecComposants() {
  const e = calme(etatVide());
  definirMenu(e, S.lundiSuivant, 1, 'riz, carottes', h());
  definirMenu(e, S.lundiSuivant, 2, 'poulet, courgettes', h());
  return e;
}
/** v116 : l'attribution se règle dans la feuille « Services du jour » de Production (ancienne carte Services de la page de jour). */
const feuilleServices = (e, date = S.lundiSuivant) => {
  magasin.remplacer(e);
  services.ouvrirServices(date);
  return dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
};
const interrupteurs = (n) => n.tous((x) => x.balise === 'input' && x.attributs.role === 'switch');

test('Services du jour : l\'attribution est à plat (aucun repli), « au poste » ou « hors poste » est écrit à côté de chaque interrupteur', () => {
  const e = semaineAvecComposants();
  for (const c of Object.values(e.composants)) c.attribue = true;
  let f = feuilleServices(e);
  assert.equal(f.tous((x) => x.balise === 'details').length, 0);
  const etiquettes = classes(f, 'interrupteur-etat');
  assert.ok(etiquettes.length >= 1);
  assert.ok(etiquettes.every((x) => x.textContent === 'au poste'));
  assert.doesNotMatch(f.textContent, /hors poste/);
  f.close();

  Object.values(e.composants).find((c) => c.nom === 'poulet').attribue = false;
  f = feuilleServices(e);
  assert.equal(classes(f, 'interrupteur-etat').filter((x) => x.textContent === 'hors poste').length, 1);
  f.close();
});

test('Services du jour : le nom accessible de l\'interrupteur porte l\'état et le suit', async () => {
  const e = semaineAvecComposants();
  for (const c of Object.values(e.composants)) c.attribue = true;
  const poulet = Object.values(e.composants).find((c) => c.nom === 'poulet');
  const f = feuilleServices(e);
  const sw = interrupteurs(f).find((i) => i.attributs.id === `sem-poste-${poulet.id}`);
  assert.equal(sw.attributs['aria-label'], 'poulet, au poste');
  sw.checked = false;
  await sw.declencher('change');
  assert.equal(sw.attributs['aria-label'], 'poulet, hors poste');
  const etiquette = sw.parent.tous((x) => x.className === 'interrupteur-etat')[0];
  assert.equal(etiquette.textContent, 'hors poste');
  sw.checked = true;
  await sw.declencher('change');
  assert.equal(sw.attributs['aria-label'], 'poulet, au poste');
  assert.equal(etiquette.textContent, 'au poste');
  f.close();
});

test('Détail du jour (feuille) : garde ses interrupteurs et ses libellés, avec d\'autres identifiants que Services', () => {
  const e = semaineAvecComposants();
  Object.values(e.composants).find((c) => c.nom === 'poulet').attribue = false;
  magasin.remplacer(e);
  services.ouvrirDetailDuJour(S.lundiSuivant);
  const detail = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  assert.ok(interrupteurs(detail).length >= 3);
  assert.ok(interrupteurs(detail).every((i) => !i.attributs.id.startsWith('sem-poste-')));
  assert.match(detail.textContent, /hors poste/);
  assert.match(detail.textContent, /aucune quantité n'en est calculée/);
  detail.close();
});

test('Services du jour : liens du tableau à 44 px, interrupteur à 44 px', () => {
  assert.match(blocLot, /\.bord-plat \{[^}]*min-height: var\(--cible\)/);
  assert.match(blocLot, /\.interrupteur-entree \{[^}]*height: 44px/);
});

// ---------------------------------------------------------------- 4. fiche de fonction

test('fiche de fonction : le buffet par couvert est visible dans la fiche (feuille F1), sans identifiant technique', () => {
  const e = mercrediAvecFiche('choix_libre');
  magasin.remplacer(e);
  const f = Object.values(e.fiches)[0];
  fiches.ouvrirFiche(f.id);
  const panneau = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  const ligne = panneau.tous((x) => x.balise === 'button' && /buffet-couvert/.test(x.className))[0];
  assert.ok(ligne, 'ligne « Buffet » dans la fiche, sans repli');
  ligne.click();
  const buffet = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  assert.match(buffet.textContent, /Pour 8 couverts/);
  assert.match(buffet.textContent, /Provenance : standard de base/);
  assert.doesNotMatch(buffet.textContent, /organisation\.banquet|hygiene\.|\.buffet-/, 'aucun identifiant technique');
});

test('fiche de fonction à menu fixe : pas de buffet, et la fiche dit « sans objet en menu fixe »', () => {
  const e = mercrediAvecFiche('menu_fixe');
  magasin.remplacer(e);
  const f = Object.values(e.fiches)[0];
  const jour = detailDuJour(detailVue, e, S.mercredi);
  assert.equal(jour.tous((x) => /buffet-couvert/.test(x.className)).length, 0, 'rien dans la carte du détail');
  fiches.ouvrirFiche(f.id);
  const panneau = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  assert.equal(panneau.tous((x) => /buffet-couvert/.test(x.className)).length, 0);
  assert.match(panneau.textContent, /sans objet en menu fixe/);
  assert.equal(fiches.buffetDeLaFiche({ ...f, statut: 'annulee' }), null);
});

// ---------------------------------------------------------------- 6. dimanche

test('Aujourd\'hui, dimanche : « Prochaine production : lundi 12 » est un lien vers la Production de ce jour', () => {
  const p = rendreAu(S.dimanche, calme(etatVide()));
  const maintenant = classes(p, 'prochaine')[0];
  assert.match(maintenant.textContent, /Fermé aujourd'hui · Prochaine production : lundi 12/);
  const liens = maintenant.tous((x) => x.balise === 'a');
  assert.equal(liens.length, 1);
  assert.equal(liens[0].attributs.href, `#/production/${S.lundiSuivant}`);
  assert.equal(liens[0].textContent, 'lundi 12');
  assert.match(blocLot, /\.au-lien-prochaine \{[^}]*min-height: var\(--cible\)/);
});

test('CSS du lot : en fin de fichier, dans un bloc commenté, sans texte sous 13 px ni animation', () => {
  assert.ok(debutLot > 0 && blocLot.length > 0, 'bloc du lot présent');
  assert.doesNotMatch(blocLot, /font-size: ?(1[0-2]|[0-9])px/);
  assert.doesNotMatch(blocLot, /transition|animation/);
});
