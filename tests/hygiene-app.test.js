// Garde-fous du dossier app/ : indépendance, pureté du domaine, aucune donnée de test ni de restaurant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const APP = join(RACINE, 'app');
const EXTENSIONS_TEXTE = /\.(js|mjs|html|css|webmanifest|json|svg|txt|md)$/;

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}
const tous = fichiers(APP);
const texte = (f) => readFileSync(f, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('app/ contient du code (le test ne passe pas à vide)', () => {
  assert.ok(tous.some((f) => f.endsWith(join('domaine', 'actions.js'))));
  assert.ok(tous.some((f) => f.endsWith(join('donnees', 'base-metier.js'))));
});

test('aucun fichier sous app/ ne contient « tests/ »', () => {
  for (const f of tous.filter((x) => EXTENSIONS_TEXTE.test(x))) {
    assert.equal(texte(f).includes('tests/'), false, relative(RACINE, f));
  }
});

test('aucun fichier sous app/ n\'importe un chemin hors de app/', () => {
  const motifs = [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimportScripts\s*\(\s*['"]([^'"]+)['"]/g, /\bnew URL\(\s*['"]([^'"]+)['"]/g];
  for (const f of tous.filter((x) => /\.(js|mjs)$/.test(x))) {
    for (const motif of motifs) {
      for (const m of texte(f).matchAll(motif)) {
        const cible = m[1];
        assert.equal(/^(https?:)?\/\//.test(cible), false, `${relative(RACINE, f)} : URL externe ${cible}`);
        const abs = cible.startsWith('/') ? resolve(APP, `.${cible}`) : resolve(dirname(f), cible);
        assert.ok(abs === APP || abs.startsWith(APP + sep), `${relative(RACINE, f)} importe hors de app/ : ${cible}`);
      }
    }
  }
});

test('le domaine reste pur : ni DOM, ni stockage, ni réseau, ni heure courante', () => {
  const interdits = [/\bwindow\b/, /\bdocument\b/, /\bindexedDB\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bnavigator\b/,
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bDate\.now\b/, /\bnew Date\(\s*\)/, /\bperformance\.now\b/, /\bprocess\b/, /\brequire\s*\(/,
    /\bimport\s+[^;]*['"]node:/];
  const domaine = tous.filter((f) => f.includes(`${sep}domaine${sep}`));
  assert.equal(domaine.length >= 10, true);
  for (const f of domaine) {
    const code = sansCommentaires(texte(f));
    for (const motif of interdits) assert.equal(motif.test(code), false, `${relative(RACINE, f)} : ${motif}`);
  }
});

test('le domaine ne dépend que de lui-même et de la base générée', () => {
  for (const f of tous.filter((x) => x.includes(`${sep}domaine${sep}`))) {
    for (const m of texte(f).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
      const cible = resolve(dirname(f), m[1]);
      const dansDomaine = cible.startsWith(join(APP, 'js', 'domaine') + sep);
      const base = [join(APP, "js", "donnees", "base-metier.js"), join(APP, "js", "donnees", "savoir-metier.js")].includes(cible);
      assert.ok(dansDomaine || base, `${relative(RACINE, f)} -> ${m[1]}`);
    }
  }
});

test('app/ ne contient ni jeu de test ni valeur de test', () => {
  for (const f of tous.filter((x) => EXTENSIONS_TEXTE.test(x) && !x.endsWith(join('domaine', 'etat.js')))) {
    const t = texte(f);
    assert.equal(t.includes('TEST_ONLY'), false, `${relative(RACINE, f)} : TEST_ONLY`);
    assert.equal(/_TEST\b/.test(t), false, `${relative(RACINE, f)} : nom de jeu de test`);
  }
  // etat.js ne cite TEST_ONLY que pour le refuser à l'import.
  assert.equal((texte(join(APP, 'js/domaine/etat.js')).match(/TEST_ONLY/g) ?? []).length >= 1, true);
});

test('les modules du domaine n\'embarquent aucun grammage, coefficient ni quantité par défaut', () => {
  const sans = tous.filter((x) => x.includes(`${sep}domaine${sep}`) && !x.endsWith('analyse-menu.js'));
  for (const f of sans) {
    const code = sansCommentaires(texte(f));
    assert.equal(/\b(grammage|coefficient)\s*[:=]\s*[1-9]/.test(code), false, relative(RACINE, f));
  }
});

test('les jeux de test portent l\'étiquette TEST_ONLY et ne sont pas dans app/', async () => {
  const dossier = join(RACINE, 'tests', 'jeux');
  const jeux = readdirSync(dossier).filter((n) => /^TEST_ONLY-.*\.js$/.test(n));
  assert.ok(jeux.length >= 2);
  for (const nom of jeux) {
    const module = await import(join(dossier, nom));
    const exports = Object.values(module);
    assert.ok(exports.length > 0 && exports.every((x) => x.etiquette === 'TEST_ONLY'), `${nom} : etiquette TEST_ONLY manquante`);
  }
  assert.equal(readdirSync(dossier).every((n) => n.startsWith('TEST_ONLY-')), true, 'tout fichier de tests/jeux est un jeu TEST_ONLY');
  assert.equal(tous.some((f) => f.includes('TEST_ONLY-')), false);
});
