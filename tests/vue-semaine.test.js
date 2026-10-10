// Écran Semaine (onglet 3) : depuis la v116, seulement la vue d'ensemble ; le jour est dans Production (voir semaine-vers-production.test.js). Faux DOM : ni mise en page ni navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { etatVide, h as horo } from './aide.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

let dom; let magasin; let vue; let routeur; let actions;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-semaine.js');
  routeur = await import('../app/js/ui/routeur.js');
  actions = await import('../app/js/domaine/actions.js');
});
after(() => dom.restaurer());

const texte = (n) => n.textContent;
const liens = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));

/** Un lundi à menus saisis, prévision du menu 1 seulement. */
function semaine() {
  const e = etatVide();
  actions.definirMenu(e, S.lundiSuivant, 1, 'riz, carottes', horo());
  actions.definirMenu(e, S.lundiSuivant, 2, 'courgettes, quinoa', horo());
  actions.definirPrevision(e, S.lundiSuivant, 1, 40, horo());
  return e;
}

test('titre et routage : la vue Semaine ne rend que la vue d\'ensemble', () => {
  assert.equal(vue.titre(null), 'Semaine');
  assert.equal(vue.titre(S.lundiSuivant, 'tableau'), 'Semaine');
  assert.equal(routeur.VUES.semaine, vue);
});

test('semaine globale : sans date ou /tableau, l\'ancien tableau restylé, avec le lien d\'import', () => {
  magasin.remplacer(semaine());
  for (const [param, sous] of [[null, undefined], [S.lundiSuivant, 'tableau']]) {
    const n = vue.rendre(magasin.etat(), param, sous);
    assert.equal(n.className, 'vue-semaine-globale');
    assert.match(texte(n), /Menus de la semaine/);
    assert.doesNotMatch(texte(n), /Importer les menus|Proposer un planning/, 'les actions sont dans la feuille « ⋯ »');
    assert.equal(parClasse(n, 'sa-actions')[0].attributs['aria-label'], 'Actions de la semaine');
    assert.ok(liens(n).some((l) => l.startsWith('#/production/')), 'les jours mènent à Production');
  }
});

test('le routeur envoie les anciennes adresses : détail → Production, tableau → Semaine', () => {
  assert.deepEqual(routeur.analyserHash(`#/detail/${S.lundiSuivant}`, S.samedi), { vue: 'production', param: S.lundiSuivant });
  assert.equal(routeur.analyserHash(`#/semaine/${S.lundiSuivant}/tableau`, S.samedi).sous, 'tableau');
});

test('bouton « ⋯ » : la feuille propose Importer les menus, Proposer un planning et Vue de la semaine ; l\'historique reste à côté', async () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant, 'tableau');
  const boutons = parClasse(n, 'sa-actions');
  assert.equal(boutons.length, 1);
  assert.equal(boutons[0].textContent, '⋯');
  await boutons[0].click();
  // « Réinitialiser la semaine » ne s'ajoute que pour une semaine à venir (horloge réelle) : voir tests/reinitialiser-semaine-ui.test.js.
  const feuille = dom.document.body.tous((x) => x.className.split(' ').includes('sa-action') && x.textContent !== 'Réinitialiser la semaine');
  assert.deepEqual(feuille.map((x) => x.textContent), ['Importer les menus', 'Proposer un planning', 'Vue de la semaine']);
  assert.equal(feuille[0].attributs.href, `#/import/${S.lundiSuivant}`);
  assert.equal(feuille[2].attributs.href, `#/semaine/${S.lundiSuivant}/tableau`);
  assert.deepEqual(parClasse(n, 'sa-fleche').map((a) => a.attributs['aria-label']).filter((l) => l === 'Historique des semaines'), ['Historique des semaines']);
});
