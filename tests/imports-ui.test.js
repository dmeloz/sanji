// Tous les modules de app/js/ s'importent sous Node (aucun accès au navigateur au niveau supérieur du fichier).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const JS = join(RACINE, 'app', 'js');

function modules(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return modules(chemin);
    return nom.endsWith('.js') ? [chemin] : [];
  });
}
const tous = modules(JS).sort();

test('app/js/ contient les modules attendus de l\'interface', () => {
  const noms = tous.map((f) => relative(JS, f).split(sep).join('/'));
  for (const attendu of ['main.js', 'stockage.js', 'magasin.js', 'ui/routeur.js', 'ui/vue-tableau.js', 'ui/vue-menus.js', 'ui/vue-detail.js',
    'ui/vue-jour.js', 'domaine/tableau-blanc.js', 'domaine/feuille.js', 'ui/vue-composant.js', 'ui/vue-reglages.js']) {
    assert.ok(noms.includes(attendu), attendu);
  }
});

for (const fichier of tous) {
  test(`import sous Node : ${relative(JS, fichier).split(sep).join('/')}`, async () => {
    assert.equal(typeof document, 'undefined');
    const module = await import(pathToFileURL(fichier).href);
    assert.ok(Object.keys(module).length >= 0);
  });
}

test('main.js exporte demarrer() et ne la lance pas sous Node', async () => {
  const module = await import(pathToFileURL(join(JS, 'main.js')).href);
  assert.equal(typeof module.demarrer, 'function');
});

test('aucun module de l\'interface n\'utilise document, window, navigator ni indexedDB au niveau supérieur', () => {
  const motif = /\b(document|window|navigator|indexedDB|localStorage|location)\b/;
  const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  for (const fichier of tous.filter((f) => !f.includes(`${sep}domaine${sep}`))) {
    const lignes = sansCommentaires(readFileSync(fichier, 'utf8')).split('\n');
    lignes.forEach((ligne, i) => {
      // Une ligne non indentée n'est pas dans le corps d'une fonction ; seule la garde `typeof document` de main.js est permise.
      if (/^\S/.test(ligne) && motif.test(ligne) && !/typeof (document|window|navigator|indexedDB)\b/.test(ligne)
        && !/^(export )?(async )?function /.test(ligne)) {
        assert.fail(`${relative(RACINE, fichier)}:${i + 1} : ${ligne.trim()}`);
      }
    });
  }
});

test('aucun innerHTML, outerHTML ni insertAdjacentHTML dans l\'interface', () => {
  for (const fichier of tous) {
    const code = readFileSync(fichier, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    assert.equal(/\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(code), false, relative(RACINE, fichier));
  }
});

test('aucun appel réseau ni ressource distante dans app/', () => {
  const app = join(RACINE, 'app');
  const lister = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? lister(join(d, n)) : [join(d, n)]));
  for (const fichier of lister(app).filter((f) => /\.(js|html|css)$/.test(f))) {
    const texte = readFileSync(fichier, 'utf8');
    const sansSw = fichier.endsWith('sw.js') ? texte.replace(/return await fetch\(requete\);/, '') : texte;
    assert.equal(/\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b/.test(sansSw), false, relative(RACINE, fichier));
    // nouvelle-version.js (v130) : fetch injectable, seulement sur sw.js (même origine, comparaison des versions).
    if (!fichier.endsWith('nouvelle-version.js')) assert.equal(/\bfetch\s*\(/.test(sansSw), false, `${relative(RACINE, fichier)} : fetch`);
    assert.equal(/(src|href)=["']https?:\/\//.test(sansSw) || /url\(\s*["']?https?:/.test(sansSw) || /@import/.test(sansSw), false, relative(RACINE, fichier));
  }
});
