// Lot « Aujourd'hui, Semaine, fiche de fonction, hors ligne, sombre » (audit UI v56 : montrer l'exception, pas la normalité).
// Faux DOM : ni mise en page ni tactile réels (à vérifier à l'écran à 390 px, clair et sombre). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { creerFiche, definirMenu, definirPrevision } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom; let magasin; let aujourdhuiVue; let semaineVue; let detailVue; let fiches; let horsligne; let reglages;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  aujourdhuiVue = await import('../app/js/ui/vue-aujourdhui.js');
  semaineVue = await import('../app/js/ui/vue-semaine.js');
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
const calme = (e) => { e.reglages.semaineTypeConfirmee = true; return e; };
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
  assert.match(reglages.rendre(e, null).textContent, /Fonctionne hors ligne/, 'Réglages garde l\'état (pied)');
  // Ici le navigateur de test n'a pas de service worker : c'est un vrai problème, dit tel quel.
  await horsligne.preparerHorsLigne();
  assert.ok(horsligne.problemeHorsLigne(), 'problème détecté');
  const au = rendreAu(S.mercredi, e);
  assert.equal(classes(au, 'au-hors-ligne').length, 1);
  assert.match(classes(au, 'au-hors-ligne')[0].textContent, /hors ligne pas encore prêt/);
  assert.doesNotMatch(au.textContent, /hors ligne prêt/);
  magasin.remplacer(e);
  assert.match(aDate(S.mercredi, () => semaineVue.rendre(magasin.etat(), S.mercredi)).textContent, /ouvert lun → sam · hors ligne pas encore prêt/);
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
const jourSemaine = (e) => { magasin.remplacer(e); return semaineVue.rendre(magasin.etat(), S.lundiSuivant); };
const interrupteurs = (n) => n.tous((x) => x.balise === 'input' && x.attributs.role === 'switch');

test('Semaine : « Attribution au poste » repliée quand tout est au poste, dépliée dès qu\'il en manque, avec « hors poste » écrit', () => {
  const e = semaineAvecComposants();
  for (const c of Object.values(e.composants)) c.attribue = true;
  let n = jourSemaine(e);
  let reglesPoste = classes(n, 'sem-poste');
  assert.ok(reglesPoste.length >= 1);
  assert.ok(reglesPoste.every((d) => d.open === false), 'tout est au poste : replié');
  assert.match(reglesPoste[0].textContent, /Attribution au poste : (\d+) sur \1/);
  assert.doesNotMatch(classes(n, 'sem-carte')[0].textContent, /au poste(?! :)/, 'plus de « au poste » répété à côté de chaque interrupteur');
  assert.doesNotMatch(classes(n, 'sem-carte')[0].textContent, /hors poste/);

  const poulet = Object.values(e.composants).find((c) => c.nom === 'poulet');
  poulet.attribue = false;
  n = jourSemaine(e);
  reglesPoste = classes(n, 'sem-poste');
  const ouvert = reglesPoste.filter((d) => d.open);
  assert.equal(ouvert.length, 1, 'seul le menu où il en manque est déplié');
  assert.match(ouvert[0].textContent, /poulet/);
  assert.match(ouvert[0].textContent, /hors poste/);
  assert.equal(classes(ouvert[0], 'interrupteur-etat').filter((x) => x.textContent === 'hors poste').length, 1);
});

test('Semaine : le nom accessible de l\'interrupteur porte l\'état et le suit', async () => {
  const e = semaineAvecComposants();
  for (const c of Object.values(e.composants)) c.attribue = true;
  const poulet = Object.values(e.composants).find((c) => c.nom === 'poulet');
  const n = jourSemaine(e);
  const sw = interrupteurs(n).find((i) => i.attributs.id === `sem-poste-${poulet.id}`);
  assert.equal(sw.attributs['aria-label'], 'poulet, au poste');
  sw.checked = false;
  await sw.declencher('change');
  assert.equal(sw.attributs['aria-label'], 'poulet, hors poste');
  const etiquette = sw.parent.tous((x) => x.className === 'interrupteur-etat')[0];
  assert.equal(etiquette.textContent, 'hors poste');
  sw.checked = true;
  await sw.declencher('change');
  assert.equal(sw.attributs['aria-label'], 'poulet, au poste');
  assert.equal(etiquette.textContent, '');
});

test('Semaine : l\'attribution n\'est pas répétée dans « Tout le détail du jour » (les interrupteurs sont dans Services)', () => {
  const e = semaineAvecComposants();
  Object.values(e.composants).find((c) => c.nom === 'poulet').attribue = false;
  const n = jourSemaine(e);
  const detail = n.tous((x) => x.attributs.id === 'detail-jour')[0];
  assert.equal(interrupteurs(detail).length, 0);
  assert.ok(interrupteurs(n).length >= 3, 'ils restent dans Services');
  assert.ok(detail.tous((x) => x.balise === 'button').some((b) => b.textContent === 'Modifier'), 'Modifier (avec « Attribué au poste ») reste dans le détail');
  assert.match(detail.textContent, /hors poste/, 'ce qui est hors poste reste dit');
  // Hors de l'écran Semaine (détail autonome), les interrupteurs et leur libellé restent.
  const autonome = detailVue.rendre(magasin.etat(), S.lundiSuivant);
  assert.ok(interrupteurs(autonome).length >= 3);
  assert.match(autonome.textContent, /au poste/);
});

test('Semaine : plus d\'aide permanente sur la carte, légende explicite, liens du tableau à 44 px, interrupteur à 44 px', () => {
  const n = jourSemaine(semaineAvecComposants());
  const carte = classes(n, 'sem-carte')[0].textContent;
  assert.match(carte, /Carte/);
  assert.doesNotMatch(carte, /aucune quantité calculée/);
  assert.match(n.tous((x) => x.attributs.id === 'detail-jour')[0].textContent, /aucune quantité n'en est calculée/, 'dite une fois, dans le repli du détail');
  const cle = classes(n, 'sem-cle')[0].textContent;
  assert.match(cle, /hors règle : avance non autorisée/);
  assert.match(cle, /jour off : aucun créneau de travail/);
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
  const buffet = panneau.tous((x) => x.balise === 'details' && /buffet-couvert/.test(x.className))[0];
  assert.ok(buffet, 'buffet dans la fiche');
  assert.match(buffet.textContent, /Pour 8 couverts/);
  assert.match(buffet.textContent, /Provenance : standard de base/);
  assert.doesNotMatch(buffet.textContent, /organisation\.banquet|hygiene\.|\.buffet-/, 'aucun identifiant technique');
});

test('fiche de fonction à menu fixe : pas de buffet, et la fiche dit « sans objet en menu fixe »', () => {
  const e = mercrediAvecFiche('menu_fixe');
  magasin.remplacer(e);
  const f = Object.values(e.fiches)[0];
  const jour = detailVue.rendre(e, S.mercredi);
  assert.equal(jour.tous((x) => x.balise === 'details' && /buffet-couvert/.test(x.className)).length, 0, 'rien dans la carte du détail');
  fiches.ouvrirFiche(f.id);
  const panneau = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  assert.equal(panneau.tous((x) => /buffet-couvert/.test(x.className)).length, 0);
  assert.match(panneau.textContent, /sans objet en menu fixe/);
  assert.equal(fiches.buffetDeLaFiche({ ...f, statut: 'annulee' }), null);
});

// ---------------------------------------------------------------- 6. dimanche

test('Aujourd\'hui, dimanche : « Prochaine production : lundi 12 » est un lien vers la Production de ce jour', () => {
  const p = rendreAu(S.dimanche, calme(etatVide()));
  const maintenant = classes(p, 'au-maintenant')[0];
  assert.match(maintenant.textContent, /Fermé aujourd'hui · Prochaine production : lundi 12/);
  const liens = maintenant.tous((x) => x.balise === 'a');
  assert.equal(liens.length, 1);
  assert.equal(liens[0].attributs.href, `#/production/${S.lundiSuivant}`);
  assert.equal(liens[0].textContent, 'lundi 12');
  assert.match(blocLot, /\.au-lien-prochaine \{[^}]*min-height: var\(--cible\)/);
});

// ---------------------------------------------------------------- 5. sombre

const jetons = (bloc) => Object.fromEntries([...bloc.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('sombre : « Maintenant » et la carte quantité de la fiche sont des surfaces foncées surélevées, texte clair, contraste d\'au moins 4,5:1', () => {
  const debutSombre = css.indexOf('@media (prefers-color-scheme: dark)');
  const sombre = { ...jetons(css.slice(css.indexOf(':root {'), debutSombre)), ...jetons(css.slice(debutSombre, css.indexOf('*, *::before', debutSombre))) };
  const media = blocLot.slice(blocLot.indexOf('@media (prefers-color-scheme: dark) {\n'));
  assert.match(media, /\.au-maintenant \{[^}]*background: var\(--carte-2\)[^}]*color: var\(--texte\)/);
  assert.match(media, /\.fiche-quantite \{[^}]*background: var\(--carte-2\)[^}]*color: var\(--texte\)/);
  assert.match(media, /\.au-btn-clair \{[^}]*background: var\(--action\)[^}]*color: var\(--sur-action\)/);
  // Les paires réellement posées : texte, texte moyen, accent et ambre sur la surface surélevée ; bouton plein ; contour des cases.
  const paires = [['texte', 'carte-2'], ['texte-moyen', 'carte-2'], ['action', 'carte-2'], ['exception', 'exception-fond'], ['sur-action', 'action'],
    ['texte-doux', 'carte'], ['texte-doux', 'fond']];
  for (const [t, f] of paires) assert.ok(contraste(sombre[t], sombre[f]) >= 4.5, `${t} sur ${f} = ${contraste(sombre[t], sombre[f]).toFixed(2)}`);
  // --contour-case = --texte-doux (aucune couleur écrite en dur dans ce bloc).
  assert.match(blocLot, /--contour-case: var\(--texte-doux\)/);
  assert.doesNotMatch(blocLot, /#[0-9a-fA-F]{3,6}\b/);
  assert.match(media, /\.case input \{[^}]*outline: 1px solid var\(--contour-case\)/);
});

test('CSS du lot : en fin de fichier, dans un bloc commenté, sans texte sous 13 px ni animation', () => {
  assert.ok(debutLot > 0 && blocLot.length > 0, 'bloc du lot présent');
  assert.doesNotMatch(blocLot, /font-size: ?(1[0-2]|[0-9])px/);
  assert.doesNotMatch(blocLot, /transition|animation/);
});
