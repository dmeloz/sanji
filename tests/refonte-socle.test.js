// Socle de la refonte 1 : barre d'onglets, vues-relais, tokens et polices embarquées.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { installerFauxDom } from './aide-dom.js';
import { etatVide } from './aide.js';

const lire = (chemin) => readFileSync(new URL(`../app/${chemin}`, import.meta.url), 'utf8');

let dom;
let magasin;
let relais;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  relais = {
    aujourdhui: await import('../app/js/ui/vue-aujourdhui.js'),
    production: await import('../app/js/ui/vue-production.js'),
    fiche: await import('../app/js/ui/vue-fiche.js'),
    semaine: await import('../app/js/ui/vue-semaine.js'),
    articles: await import('../app/js/ui/vue-articles.js'),
    import: await import('../app/js/ui/vue-import.js'),
    poste: await import('../app/js/ui/vue-poste.js'),
  };
});
after(() => dom.restaurer());

test('barre d\'onglets : quatre onglets fixes, dans l\'ordre, sans Réglages', () => {
  const html = lire('index.html');
  const nav = html.slice(html.indexOf('<nav id="onglets"'), html.indexOf('</nav>'));
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['#/aujourdhui', '#/production', '#/semaine', '#/articles']);
  assert.deepEqual([...nav.matchAll(/data-onglet="([^"]+)"/g)].map((m) => m[1]), ['aujourdhui', 'production', 'semaine', 'articles']);
  assert.doesNotMatch(nav, /Réglages/);
  assert.doesNotMatch(html, /id="barre"|barre-titre|barre-reglages/, 'plus de barre du haut : chaque page porte son titre');
});

test('vues-relais : chacune exporte titre et rendre', () => {
  for (const [nom, vue] of Object.entries(relais)) {
    assert.equal(typeof vue.titre, 'function', nom);
    assert.equal(typeof vue.rendre, 'function', nom);
  }
});

// Adapté pour l'écran Mode en poste (refonte 1) : sans étapes, il ramène à la fiche ; le détail est dans tests/vue-poste.test.js.
test('vue Mode en poste : sans étapes (composant inconnu), elle ramène à Production', () => {
  const liens = relais.poste.rendre(magasin.etat(), 'comp 1').tous((x) => x.balise === 'a').map((a) => a.attributs.href);
  assert.deepEqual(liens, ['#/production']);
});

test('feuille des décisions : ouvrirDecisions existe et ouvre la feuille « À décider » sans quitter la page', async () => {
  const { ouvrirDecisions } = await import('../app/js/ui/feuille-decisions.js');
  assert.equal(typeof ouvrirDecisions, 'function');
  globalThis.location = { hash: '#/stock' };
  try {
    ouvrirDecisions();
    const feuille = dom.corps.tous((x) => x.balise === 'dialog' && x.open)[0];
    assert.ok(feuille, 'la feuille est ouverte');
    assert.equal(feuille.querySelector('h2').textContent, 'À décider');
    assert.equal(globalThis.location.hash, '#/stock', 'aucune navigation');
    feuille.close();
  } finally {
    delete globalThis.location;
  }
});

test('polices : fichiers embarqués, déclarés dans le CSS et dans le cache hors ligne', () => {
  const css = lire('css/style.css');
  const sw = lire('sw.js');
  for (const f of ['IBMPlexMono-Medium.woff2', 'IBMPlexMono-SemiBold.woff2', 'LICENSE.txt']) {
    assert.ok(existsSync(new URL(`../app/polices/${f}`, import.meta.url)), f);
    assert.ok(sw.includes(`'polices/${f}'`), `${f} absent de FICHIERS`);
  }
  assert.match(css, /font-family: "Sanji Mono"; src: url\("\.\.\/polices\/IBMPlexMono-Medium\.woff2"\)/);
  assert.match(css, /--police-qte: "Sanji Mono", ui-monospace, monospace;/);
  assert.doesNotMatch(css, /https?:\/\//, 'aucune ressource en ligne');
  for (const classe of ['quantite-grande', 'tache-quantite', 'mep-qte', 'standard-valeur']) {
    assert.match(css, new RegExp(`\\.${classe} \\{[^}]*var\\(--police-qte\\)`), classe);
  }
});

test('style : aucun texte sous 15 px, mouvement réduit respecté, onglet actif aussi en graisse', () => {
  const css = lire('css/style.css');
  for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 15, `taille ${m[1]} px`);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.onglets a\[aria-current="page"\] \{ color: var\(--action\); font-weight: 600; \}/);
  assert.match(css, /--haut-onglets: 84px/);
});
