// Historique des semaines : domaine (ordre, semaine vide, ventes, total, état intact) et vue sous faux DOM (lecture seule). Jeux TEST_ONLY.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { assurerJour } from '../app/js/domaine/etat.js';
import { historiqueSemaines } from '../app/js/domaine/historique.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { copie, etatVide } from './aide.js';

const SEMAINE_PRECEDENTE = '2026-09-28';
const SEMAINE_ANCIENNE = '2026-09-21';
const AUJOURD = S.mercredi; // semaine du 2026-10-05

function jour(etat, date, m1, m2, ventes = [null, null]) {
  const j = assurerJour(etat, date);
  j.menus[1].intitule = m1;
  j.menus[2].intitule = m2;
  j.ventes = { 1: ventes[0], 2: ventes[1], h: null };
}

function etatJeu() {
  const e = etatVide();
  jour(e, SEMAINE_ANCIENNE, 'PLAT_A', 'PLAT_B', [10, 20]);
  jour(e, SEMAINE_PRECEDENTE, 'PLAT_C', 'PLAT_D', [12, 18]);
  jour(e, '2026-09-29', 'PLAT_E', 'PLAT_F', [5, null]);
  jour(e, S.lundi, 'PLAT_G', 'PLAT_H', [1, 1]); // semaine en cours : jamais listée
  assurerJour(e, '2026-09-14'); // semaine sans aucun menu
  return e;
}

test('historiqueSemaines : plus récente d\'abord, semaine courante et semaine sans menu absentes', () => {
  const r = historiqueSemaines(etatJeu(), AUJOURD);
  assert.deepEqual(r.map((s) => s.lundi), [SEMAINE_PRECEDENTE, SEMAINE_ANCIENNE]);
});

test('historiqueSemaines : total servi, ventes saisies ou à compléter, jours sans menu', () => {
  const [recente, ancienne] = historiqueSemaines(etatJeu(), AUJOURD);
  assert.equal(recente.totalServi, 35);
  assert.equal(recente.ventesSaisies, false);
  assert.equal(recente.jours.length, 2);
  assert.equal(recente.joursSansMenu, 3);
  assert.equal(ancienne.totalServi, 30);
  assert.equal(ancienne.ventesSaisies, true);
  assert.equal(ancienne.jours[0].menu1, 'PLAT_A');
});

test('historiqueSemaines : ne modifie jamais l\'état', () => {
  const e = etatJeu();
  const avant = copie(e);
  historiqueSemaines(e, AUJOURD);
  assert.deepEqual(e, avant);
});

test('historiqueSemaines : état sans semaine passée, liste vide', () => {
  assert.deepEqual(historiqueSemaines(etatVide(), AUJOURD), []);
});

let dom; let magasin; let routeur; let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vue = await import('../app/js/ui/vue-historique.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const page = (etat) => aDate(AUJOURD, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat()); });

test('routeur : #/historique mène à la vue, onglet Semaine', () => {
  assert.equal(routeur.VUES.historique, vue);
  assert.deepEqual(routeur.analyserHash('#/historique', AUJOURD), { vue: 'historique', param: null });
  assert.equal(routeur.ONGLET_DE_VUE.historique, 'semaine');
});

test('vue : une ligne par semaine (aucun repli) ; sa feuille montre les jours et menus, sans champ de saisie', () => {
  const p = page(etatJeu());
  assert.match(p.textContent, /Semaine du lundi 28 septembre/);
  assert.match(p.textContent, /ventes à compléter/);
  assert.doesNotMatch(p.textContent, /PLAT_C/, 'les jours ne sont pas déroulés dans la page');
  assert.equal(p.tous((x) => x.balise === 'details').length, 0);
  assert.equal(p.tous((x) => ['input', 'textarea', 'select'].includes(x.balise)).length, 0);
  const lignes = boutons(p);
  assert.equal(lignes.length, 2, 'une ligne tappable par semaine');
  lignes[0].click();
  const [feuille] = panneauxOuverts(dom.corps);
  assert.match(feuille.textContent, /PLAT_C/);
  assert.equal(feuille.tous((x) => ['input', 'textarea', 'select'].includes(x.balise)).length, 0);
  feuille.close();
});

test('vue : état vide', () => {
  assert.match(page(etatVide()).textContent, /Aucune semaine passée/);
});
