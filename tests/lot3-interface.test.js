// Lot 3 — progression lisible dans Import et Préparer la semaine, sans changer les décisions métier.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom, figerHorloge } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { prevision } from './aide.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom; let restore; let magasin; let importer; let preparer; let css;
before(async () => {
  restore = figerHorloge(S.lundi);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  importer = await import('../app/js/ui/vue-import.js');
  preparer = await import('../app/js/ui/vue-preparer.js');
  css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
});
after(() => { dom.restaurer(); restore(); });
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const position = (n, c) => n.children.findIndex((x) => x.className.split(' ').includes(c));

test('Import : source, saisie des jours puis relecture sont trois étapes visibles dans cet ordre', () => {
  magasin.remplacer(etatVide());
  const page = importer.rendre(magasin.etat(), S.lundi);
  assert.deepEqual(parClasse(page, 'imp-etape').map((x) => x.className.split(' ').find((c) => /^imp-etape-/.test(c))), [
    'imp-etape-source', 'imp-etape-menus', 'imp-etape-verification',
  ]);
  const [source, menus, verification] = parClasse(page, 'imp-etape');
  assert.ok(source.tous((x) => x.attributs.id === 'feuille-texte').length);
  assert.equal(parClasse(menus, 'saisie-jour').length, 5, 'les 5 jours gardent leurs champs visibles');
  assert.ok(parClasse(verification, 'imp-lecture-jours').length);
  assert.ok(position(page, 'imp-etape-source') < position(page, 'imp-etape-menus'));
  assert.ok(position(page, 'imp-etape-menus') < position(page, 'imp-etape-verification'));
  assert.match(page.textContent, /Relire avant d’enregistrer/);
});

test('Préparer : couverts, confirmations et accès Production forment trois niveaux visibles', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'MENU_TEST', h());
  prevision(e, S.lundi, 1, 30);
  magasin.remplacer(e);
  const page = preparer.rendre(magasin.etat(), S.lundi);
  const etapes = parClasse(page, 'prep-etape');
  assert.equal(etapes.length, 3);
  assert.match(etapes[0].textContent, /1.*Couverts du midi/);
  assert.match(etapes[1].textContent, /2.*À confirmer/);
  assert.match(etapes[2].textContent, /3.*Production/);
  assert.ok(etapes[0].tous((x) => x.className.split(' ').includes('prep-valeur')).length > 0);
  assert.ok(etapes[2].tous((x) => x.textContent === 'Voir la fiche de production').length > 0);
});

test('les étapes ont un repère textuel, sans réduire les cibles tactiles ni le texte', () => {
  const start = css.indexOf('/* ===== Refonte 3 — lot 3');
  assert.ok(start >= 0);
  const bloc = css.slice(start);
  assert.match(bloc, /imp-etape-titre/);
  assert.match(bloc, /prep-etape/);
  assert.match(bloc, /min-height:\s*var\(--cible\)/);
  for (const m of bloc.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 15, m[0]);
});
