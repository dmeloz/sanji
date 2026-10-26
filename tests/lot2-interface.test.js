// Lot 2 — hiérarchie d'Aujourd'hui et lecture de Production.
// Les comportements métier restent ceux des domaines existants ; les vues sont exercées dans le faux DOM.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirStandard } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let aujourdhui;
let production;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  aujourdhui = await import('../app/js/ui/vue-aujourdhui.js');
  production = await import('../app/js/ui/vue-production.js');
});

after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const pageAujourdhui = (date = S.mercredi, etat = etatVide()) => aDate(date, () => {
  magasin.remplacer(etat);
  return aujourdhui.rendre(magasin.etat());
});

test('Aujourd’hui : la prochaine action est le premier bloc après le titre', () => {
  const page = pageAujourdhui();
  const directs = page.children.map((x) => x.className.split(' ').filter(Boolean));
  assert.ok(directs[0].includes('au-tete'));
  assert.ok(directs[1].includes('prochaine'));
  assert.ok(directs[1].includes('prochaine-vide'));
});

test('Aujourd’hui : les jours proches restent des lignes accessibles avec date et contenu séparés', () => {
  const e = etatVide();
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  definirMenu(e, S.jeudi, 2, 'Riz et carottes', h());
  const page = pageAujourdhui(S.mercredi, e);
  const liste = classes(page, 'tdb-jours')[0];
  assert.ok(liste, 'liste des jours proches visible');
  assert.ok(liste.children.length >= 2);
  for (const ligne of liste.children) {
    assert.equal(ligne.balise, 'a', 'la ligne ouvre la Production ou l’Import du jour');
    assert.ok(classes(ligne, 'tdb-jour-date').length === 1, 'date isolée pour le balayage');
    assert.ok(classes(ligne, 'tdb-jour-contenu').length === 1, 'menus ou état vide dans une colonne dédiée');
  }
});

test('Production : la date complète garde une zone dédiée à côté des flèches tactiles', () => {
  const page = aDate(S.lundi, () => {
    magasin.remplacer(etatVide());
    return production.rendre(magasin.etat(), S.lundi);
  });
  const [ligneTitre] = classes(page, 'prod-titre-ligne');
  assert.ok(ligneTitre, 'ligne de titre présente');
  assert.equal(classes(ligneTitre, 'prod-date').length, 1, 'date dans sa zone dédiée');
  assert.equal(classes(ligneTitre, 'prod-fleche').length, 2, 'deux flèches de jour');
});

test('Production : le nom peut passer à la ligne et reste distinct de la quantité', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Tagliatelles aux légumes du soleil', h());
  definirPrevision(e, S.lundi, 1, 10, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  const page = aDate(S.lundi, () => {
    magasin.remplacer(e);
    return production.rendre(magasin.etat(), S.lundi);
  });
  const ligne = classes(page, 'mep-ligne').find((x) => classes(x, 'prod-nom').length > 0);
  assert.ok(ligne);
  assert.ok(classes(ligne, 'case-fait').length === 1, 'case de pointage conservée');
  assert.ok(classes(ligne, 'mep-qte').length === 1, 'quantité distincte et visible');
});
