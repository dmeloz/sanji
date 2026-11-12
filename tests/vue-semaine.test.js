// Écran Semaine (refonte, étape 5) : deux volets, Jours (la vue d'ensemble) et Achats ; le jour est dans Production (voir semaine-vers-production.test.js). Faux DOM : ni mise en page ni navigateur.

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

test('volets : Jours et Achats, le volet affiché est dit par aria-current ; la période est en petit au-dessus du titre', () => {
  magasin.remplacer(semaine());
  const jours = vue.rendre(magasin.etat(), S.lundiSuivant, 'tableau');
  assert.deepEqual(parClasse(jours, 'smn-volet').map((a) => [a.textContent, a.attributs.href, a.attributs['aria-current'] ?? null]),
    [['Jours', `#/semaine/${S.lundiSuivant}/tableau`, 'page'], ['Achats', '#/semaine/achats', null]]);
  assert.match(parClasse(jours, 'smn-periode')[0].textContent, /^du \d+( \S+)? au \d+ \S+$/);
  assert.equal(parClasse(jours, 'smn-titre')[0].textContent, 'Semaine');
  assert.deepEqual(parClasse(jours, 'smn-fleche').map((a) => a.attributs['aria-label']), ['Semaine précédente', 'Semaine suivante']);
  const achats = vue.rendre(magasin.etat(), null, 'achats');
  assert.equal(vue.titre(null, 'achats'), 'Achats');
  assert.deepEqual(parClasse(achats, 'smn-volet').map((a) => a.attributs['aria-current'] ?? null), [null, 'page']);
  assert.equal(parClasse(achats, 'vue-articles-integre').length, 1, 'la liste des articles est dans le volet');
  assert.equal(achats.tous((x) => x.balise === 'h1').length, 1, 'un seul titre de page');
  assert.deepEqual(routeur.analyserHash('#/semaine/achats', S.samedi), { vue: 'semaine', param: null, sous: 'achats' });
});

test('préparation de la semaine : menus, couverts du midi et portions, chacun avec son état en mots ; rien sur une semaine passée', () => {
  const futur = '2099-01-05'; // un lundi à venir quelle que soit l'horloge
  const e = etatVide();
  actions.definirMenu(e, futur, 1, 'riz, carottes', horo());
  magasin.remplacer(e);
  const n = vue.rendre(magasin.etat(), futur, 'tableau');
  const lignes = parClasse(n, 'smn-prep-ligne').map((l) => [parClasse(l, 'smn-prep-libelle')[0].textContent, parClasse(l, 'smn-prep-etat')[0].textContent]);
  assert.deepEqual(lignes.map((l) => l[0]), ['Menus', 'Couverts du midi', 'Portions']);
  assert.equal(lignes[0][1], '1 jour');
  assert.equal(lignes[1][1], '1 jour à saisir');
  assert.equal(parClasse(n, 'smn-prep-action')[0].attributs.href, `#/preparer/${futur}`);
  assert.equal(parClasse(vue.rendre(magasin.etat(), '2020-01-06', 'tableau'), 'smn-prep').length, 0, 'semaine passée : lecture seule');
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
