// Gestes d'un toucher (v123) : `ui/geste-rapide.js` donne, pour une carte de décision, le geste sûr qui appelle l'action
// existante. Aucun geste sur allergènes, écart, avance hors règle, sauce. Faux DOM : tailles et tactile à vérifier à l'écran. Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { creerFiche, definirMenu, definirPrevision, definirStandard, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { composantVide } from '../app/js/domaine/etat.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { aujourdhuiDe } from '../app/js/domaine/tableau-blanc.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let geste;
let vue;
let feuille;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  geste = await import('../app/js/ui/geste-rapide.js');
  vue = await import('../app/js/ui/vue-aujourdhui.js');
  feuille = await import('../app/js/ui/feuille-decisions.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const calme = (e) => e;
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const parTexte = (noeud, re) => boutons(noeud).find((b) => re.test(b.textContent));
const cartes = (e, date = S.lundi) => decisionsDe(e, date).cartes;
const ids = (e, date) => cartes(e, date).map((c) => c.id);

function avecValeur() {
  const e = calme(etatVide());
  definirMenu(e, S.lundi, 2, 'riz', h());
  definirPrevision(e, S.lundi, 2, 10, h());
  return e;
}
function avecRepartition() {
  const e = calme(etatVide());
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  return e;
}
function avecApprentissage() {
  const e = calme(etatVide());
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  return e;
}
function avecInconnu() {
  const e = calme(etatVide());
  definirMenu(e, S.mardi, 2, 'ELEMENT_INCONNU_TEST', h());
  return e;
}
function avecEcart() {
  const e = calme(etatVide());
  definirMenu(e, S.lundi, 1, 'carottes', h());
  definirPrevision(e, S.lundi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, h());
  marquerFait(e, p.id, 1000, h());
  return e;
}
function avecAvanceHorsRegle() {
  const e = calme(etatVide());
  definirMenu(e, S.vendredi, 1, 'carottes', h());
  definirPrevision(e, S.vendredi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, h());
  return e;
}
function avecSauce() {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 1, 'Penne aux courgettes', h());
  return e;
}

/** Fait le geste `texte` d'une carte par le magasin, comme le toucher, et dit si la carte a disparu. */
function toucher(e, date, genre, re, type) {
  magasin.remplacer(e);
  const carte = cartes(magasin.etat(), date).find((c) => c.genre === genre && (!type || c.type === type));
  assert.ok(carte, `carte ${genre} présente`);
  const g = geste.gestesRapides(magasin.etat(), carte).find((x) => re.test(x.texte));
  assert.ok(g, `geste ${re} présent`);
  const r = aDate(date, () => magasin.agir(g.agir));
  assert.ok(r.ok, r.erreur);
  return { carte, apres: cartes(magasin.etat(), date) };
}

test('valeur : « Garder X g » porte la valeur EXACTE enregistrée (milieu), jamais une fourchette ; la carte disparaît', () => {
  const e = avecValeur();
  const carte = cartes(e).find((c) => c.genre === 'valeur');
  assert.ok(carte);
  const { min, max } = carte.valeur.proposition;
  const milieu = (min + max) / 2;
  const [g] = geste.gestesRapides(e, carte);
  assert.match(g.texte, /^Garder /);
  assert.doesNotMatch(g.texte, /–/, 'jamais une fourchette');
  assert.ok(g.texte.includes(String(milieu).replace('.', ',')), `${g.texte} contient ${milieu}`);
  const { apres } = toucher(e, S.lundi, 'valeur', /^Garder /);
  assert.equal(magasin.etat().standards[carte.valeur.famille][carte.valeur.role].valeur, milieu);
  assert.ok(!apres.some((c) => c.id === carte.id));
});

test('apprentissage : « Oui » accepte la proposition, « Non » l\'écarte ; la carte disparaît', () => {
  const e = avecApprentissage();
  const carte = cartes(e).find((c) => c.genre === 'apprentissage');
  assert.deepEqual(geste.gestesRapides(e, carte).map((g) => g.texte), ['Oui', 'Non']);
  const oui = toucher(e, S.lundi, 'apprentissage', /^Oui$/);
  assert.equal(magasin.etat().standards.riz.garniture.valeur, oui.carte.proposition.valeur);
  assert.ok(!oui.apres.some((c) => c.id === oui.carte.id));
  const non = toucher(avecApprentissage(), S.lundi, 'apprentissage', /^Non$/);
  assert.ok(!non.apres.some((c) => c.id === non.carte.id));
  assert.equal(magasin.etat().standards.riz?.garniture, undefined, 'rien n\'est appliqué');
});

test('apprentissage « première valeur » (actuelle null) : « Oui » pose le standard', () => {
  const e = calme(etatVide());
  ['a', 'b'].forEach((x, i) => {
    e.composants[`p${i}`] = { ...composantVide(`p${i}`), date: `2026-10-0${i + 1}`, menu: 1, nom: `polenta ${x}`, categorie: 'feculent', famille: 'polenta',
      role: 'garniture', attribue: true, valide: true, grammage: { valeur: 150, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  const carte = cartes(e).find((c) => c.genre === 'apprentissage');
  assert.equal(carte.proposition.premiereValeur, true);
  assert.equal(carte.proposition.actuelle, null);
  toucher(e, S.lundi, 'apprentissage', /^Oui$/);
  assert.equal(magasin.etat().standards.polenta.garniture.valeur, 150);
});

test('répartition provisoire : « Confirmer telle quelle » garde la répartition et la confirme', () => {
  const e = avecRepartition();
  const { carte, apres } = toucher(e, S.mercredi, 'repartition', /^Confirmer telle quelle$/);
  const f = magasin.etat().fiches[carte.ficheId];
  assert.deepEqual([f.repartition[1], f.repartition[2], f.statutRepartition], [4, 2, 'confirmee']);
  assert.ok(!apres.some((c) => c.id === carte.id));
});

test('répartition incohérente (somme != couverts) : aucun geste ; cohérente : le titre dit les deux parts', () => {
  const e = avecRepartition();
  const carte = cartes(e, S.mercredi).find((c) => c.genre === 'repartition');
  const titre = geste.titreCarte(carte, e);
  assert.match(titre, /Menu 1 : 4/);
  assert.match(titre, /Menu 2 : 2/);
  e.fiches[carte.ficheId].couverts = 7;
  assert.deepEqual(geste.gestesRapides(e, carte), []);
  assert.deepEqual(geste.gestesRapides(e, { type: 'repartition_provisoire', ficheId: carte.ficheId }), []);
});

test('feuille « À décider » : la carte de répartition écrit les parts en clair', () => {
  magasin.remplacer(avecRepartition());
  aDate(S.mercredi, () => feuille.ouvrirDecisions());
  const [d] = panneauxOuverts(dom.corps);
  const c = classes(d, 'dec-carte').find((x) => x.dataset.genre === 'repartition');
  assert.match(c.textContent, /Menu 1 : 4 · Menu 2 : 2/);
  d.close();
});

test('valeur : le libellé du geste dit l\'état du poids quand il est connu', () => {
  const e = avecValeur();
  const carte = cartes(e).find((c) => c.genre === 'valeur');
  assert.match(geste.gestesRapides(e, carte)[0].texte, / (cuit|sec|cru net)$/, 'état du poids présent');
  const c2 = { ...carte, valeur: { ...carte.valeur, proposition: { ...carte.valeur.proposition, etat: 'cuit' } } };
  assert.match(geste.gestesRapides(e, c2)[0].texte, /^Garder .+ cuit$/);
  const c3 = { ...carte, valeur: { ...carte.valeur, proposition: { ...carte.valeur.proposition, etat: 'cru_net' } } };
  assert.match(geste.gestesRapides(e, c3)[0].texte, /^Garder .+ cru net$/);
});

test('accueil : la sauce à confirmer nomme son plat', () => {
  const e = avecSauce();
  const carte = cartes(e, S.mercredi).find((c) => c.genre === 'sauce');
  assert.match(geste.titreCarte(carte, e), /Penne aux courgettes/);
});

test('composant à classer : « Au poste » et « Hors poste » classent, la carte disparaît (même quand c\'est déjà au poste)', () => {
  for (const [re, attendu] of [[/^Au poste$/, true], [/^Hors poste$/, false]]) {
    const e = avecInconnu();
    const { carte, apres } = toucher(e, S.mardi, 'point', re, 'composant_inconnu');
    assert.equal(magasin.etat().composants[carte.composantId].attribue, attendu);
    assert.ok(!apres.some((c) => c.id === carte.id), String(re));
  }
});

test('aucun geste rapide sur allergènes, écart, avance hors règle, sauce, ni sur un point ordinaire', () => {
  const cas = [
    [avecEcart(), 'ecart'], [avecAvanceHorsRegle(), 'avance_hors_regle'], [avecSauce(), 'sauce'],
  ];
  for (const [e, genre] of cas) {
    const carte = cartes(e, S.lundi).find((c) => c.genre === genre);
    assert.ok(carte, genre);
    assert.deepEqual(geste.gestesRapides(e, carte), [], genre);
  }
  for (const type of ['allergenes', 'conservation', 'repartition_incoherente']) {
    assert.deepEqual(geste.gestesRapides(etatVide(), { id: `point:${type}`, genre: 'point', type, texte: type, composantId: 'x', ficheId: null, date: S.lundi }), [], type);
  }
});

test('accueil : le total et les lignes viennent de la même source (decisionsDe), trois lignes au plus', () => {
  const e = avecApprentissage();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  definirMenu(e, S.mardi, 2, 'ELEMENT_INCONNU_TEST', h());
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  magasin.remplacer(e);
  const p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  const section = classes(p, 'tdb-confirmer')[0];
  const attendu = aDate(S.lundi, () => decisionsDe(e, S.lundi));
  assert.match(section.textContent, new RegExp(`À confirmer · ${attendu.total}`));
  const lignes = classes(section, 'au-ligne');
  assert.equal(lignes.length, Math.min(3, attendu.total));
  assert.ok(attendu.total > 3);
  lignes.forEach((l, i) => assert.match(l.textContent, new RegExp(geste.titreCarte(attendu.cartes[i], e).slice(0, 12))));
});

test('accueil : un toucher sur « Garder X g » valide la valeur et la ligne disparaît', () => {
  magasin.remplacer(avecValeur());
  const p = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  const section = classes(p, 'tdb-confirmer')[0];
  const b = parTexte(section, /^Garder /);
  assert.ok(b, 'bouton « Garder »');
  aDate(S.lundi, () => b.click());
  assert.ok(magasin.etat().standards.riz);
  const apres = aDate(S.lundi, () => vue.rendre(magasin.etat()));
  assert.equal(classes(apres, 'tdb-confirmer').length, 0);
});

test('accueil : une carte sans geste rapide (sauce) n\'a qu\'un bouton qui ouvre la feuille', () => {
  magasin.remplacer(avecSauce());
  const p = aDate(S.mercredi, () => vue.rendre(magasin.etat()));
  const section = classes(p, 'tdb-confirmer')[0];
  const ligne = classes(section, 'au-ligne').find((l) => /Sauce du .*Penne.* à confirmer/.test(l.textContent));
  assert.ok(ligne);
  assert.equal(parTexte(ligne, /^Garder|^Oui|^Confirmer/), undefined);
  aDate(S.mercredi, () => boutons(ligne)[0].click());
  assert.ok(panneauxOuverts(dom.corps).length >= 1);
  panneauxOuverts(dom.corps).forEach((d) => d.close());
});

test('feuille « À décider » : « Oui » d\'une proposition l\'applique sans ouvrir de dialogue ; l\'écart garde « Décider »', () => {
  magasin.remplacer(avecApprentissage());
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const [d] = panneauxOuverts(dom.corps);
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'apprentissage');
  aDate(S.lundi, () => parTexte(carte, /^Oui$/).click());
  assert.equal(panneauxOuverts(dom.corps).length, 1, 'aucun dialogue de plus');
  assert.ok(magasin.etat().standards.riz.garniture);
  assert.equal(classes(d, 'dec-carte').filter((c) => c.dataset.genre === 'apprentissage').length, 0);
  d.close();
  magasin.remplacer(avecEcart());
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const ecart = classes(panneauxOuverts(dom.corps)[0], 'dec-carte').find((c) => c.dataset.genre === 'ecart');
  assert.ok(parTexte(ecart, /^Décider$/));
  assert.equal(parTexte(ecart, /^Garder|^Oui|^Confirmer|^Au poste/), undefined);
  panneauxOuverts(dom.corps)[0].close();
});

test('détail du jour : les points « répartition provisoire » et « à classer » portent leur geste', async () => {
  const { sectionsDuJour } = await import('../app/js/ui/vue-detail.js');
  const e = avecRepartition();
  magasin.remplacer(e);
  const noeuds = aDate(S.mercredi, () => sectionsDuJour(magasin.etat(), S.mercredi));
  const points = noeuds.find((n) => n.attributs?.id === 'points');
  assert.ok(parTexte(points, /^Confirmer telle quelle$/));
  aDate(S.mercredi, () => parTexte(points, /^Confirmer telle quelle$/).click());
  assert.equal(magasin.etat().fiches[Object.keys(magasin.etat().fiches)[0]].statutRepartition, 'confirmee');
});

test('feuille de style : cibles de 44 px et texte de 15 px pour les gestes rapides', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.match(/\.geste-rapide\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(bloc, /min-height:\s*44px/);
  assert.match(bloc, /font-size:\s*(1[5-9]|[2-9]\d)px|font-size:\s*[1-9](\.\d+)?rem/);
});
