// Lot 2 — hiérarchie d'Aujourd'hui et lecture de Production.
// Les comportements métier restent ceux des domaines existants ; les vues sont exercées dans le faux DOM.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirStandard } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let aujourdhui;
let production;
let css;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  aujourdhui = await import('../app/js/ui/vue-aujourdhui.js');
  production = await import('../app/js/ui/vue-production.js');
  css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
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
  assert.ok(/\.tdb-intitule\s*\{[^}]*display:\s*block/.test(css), 'intitulé sans boîte à lignes tronquée');
});

test('Production : la date complète garde une zone dédiée à côté des flèches tactiles', () => {
  assert.ok(/\.vue-production \.prod-titre-ligne\s*\{[^}]*display:\s*grid/.test(css));
  assert.ok(/\.vue-production \.prod-date\s*\{[^}]*white-space:\s*normal/.test(css));
  assert.ok(/\.prod-fleche\s*\{[^}]*width:\s*var\(--cible\)[^}]*height:\s*var\(--cible\)/.test(css));
});

test('Production : le nom peut passer à la ligne et reste distinct de la quantité', () => {
  assert.ok(/\.vue-production \.prod-nom\s*\{[^}]*white-space:\s*normal/.test(css));
  assert.ok(/\.prod-principal\s*\{[^}]*grid-template-columns:\s*var\(--cible\)\s+minmax\(0,\s*1fr\)\s+auto\s+var\(--cible\)/.test(css));

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
