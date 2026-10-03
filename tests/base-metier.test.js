import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extraireBase, genererFichier, lireCoefficients, lirePortion } from '../outils/extraire-base-metier.mjs';
import { BASE_METIER, PORTIONS_BASE, PROVENANCE_BASE, VERSION_BASE } from '../app/js/donnees/base-metier.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(RACINE, 'base-officielle-production-stock-hygiene.md');
const SCRIPT = join(RACINE, 'outils/extraire-base-metier.mjs');

test('lireCoefficients : coefficient = sortie / entrée', () => {
  assert.deepEqual(lireCoefficients('15–20 %'), { coefMin: 0.8, coefMax: 0.85 });
  assert.deepEqual(lireCoefficients('~33 %'), { coefMin: 0.67, coefMax: 0.67 });
  assert.deepEqual(lireCoefficients('**gain ×2,5–3**'), { coefMin: 2.5, coefMax: 3 });
  assert.deepEqual(lireCoefficients('gain ×3'), { coefMin: 3, coefMax: 3 });
  assert.deepEqual(lireCoefficients('60–65 % de perte'), { coefMin: 0.35, coefMax: 0.4 });
  assert.deepEqual(lireCoefficients('5-10 %'), { coefMin: 0.9, coefMax: 0.95 });
  assert.deepEqual(lireCoefficients('12 %'), { coefMin: 0.88, coefMax: 0.88 });
  assert.deepEqual(lireCoefficients('~30 %'), { coefMin: 0.7, coefMax: 0.7 });
});

test('lireCoefficients : l\'illisible est refusé, jamais deviné', () => {
  for (const t of ['—', '', 'variable', '20–15 %', '100 %', '150 %', '10 % à 20 %', 'gain', 'gain ×0', 'environ 20 %', '15–20']) {
    assert.equal(lireCoefficients(t), null, `« ${t} »`);
  }
});

const MD = `**Version 9.9 — essai**

### 11.1 Parage
| Catégorie | Produit | Perte | Notes |
| --- | --- | --- | --- |
| CAT_A | PRODUIT_A_TEST | 10–20 % | note a |
| CAT_A | PRODUIT_B_TEST | ~50 % | — |
| CAT_A | PRODUIT_ILLISIBLE_TEST | variable | — |

### 11.2 Cuisson
| Catégorie | Produit / méthode | Perte | Notes |
| --- | --- | --- | --- |
| CAT_B | METHODE_A_TEST | **gain ×2–2,5** | gain |
| CAT_B | METHODE_B_TEST | 5 % | |
| CAT_B | LIGNE_COURTE_TEST | 5 % |

### 11.3 Portionnement
| Catégorie | Geste | Perte | Notes |
| --- | --- | --- | --- |
| CAT_C | GESTE_TEST | 2–4 % | n |
`;

test('extraireBase : lit les trois tables, ignore et compte les lignes illisibles', () => {
  const r = extraireBase(MD);
  assert.equal(r.version, '9.9');
  assert.deepEqual(r.comptes, { parage: { lues: 2, ignorees: 1 }, cuisson: { lues: 2, ignorees: 1 }, portionnement: { lues: 1, ignorees: 0 } });
  assert.equal(r.illisibles.length, 2);
  assert.deepEqual(r.lignes[0], { etape: 'parage', categorie: 'CAT_A', produit: 'PRODUIT_A_TEST', texte: '10–20 %', coefMin: 0.8, coefMax: 0.9, note: 'note a' });
  assert.equal(r.lignes[1].note, '', 'le tiret de la source n\'est pas une note');
  assert.deepEqual(r.lignes[2], { etape: 'cuisson', categorie: 'CAT_B', produit: 'METHODE_A_TEST', texte: 'gain ×2–2,5', coefMin: 2, coefMax: 2.5, note: 'gain' });
  assert.equal(r.lignes[4].produit, 'CAT_C — GESTE_TEST');
});

test('extraireBase : table introuvable signalée', () => {
  const r = extraireBase('rien');
  assert.equal(r.lignes.length, 0);
  assert.equal(r.version, null);
  assert.equal(r.illisibles.length, 3);
});

test('base réelle : nombre de lignes par table, aucune ligne illisible', () => {
  const r = extraireBase(readFileSync(SOURCE, 'utf8'));
  assert.deepEqual(r.comptes, { parage: { lues: 92, ignorees: 0 }, cuisson: { lues: 29, ignorees: 0 }, portionnement: { lues: 12, ignorees: 0 } });
  assert.deepEqual(r.illisibles, []);
  assert.equal(r.version, '5.5');
});

test('base embarquée : à jour par rapport à la source, bornes cohérentes', () => {
  const r = extraireBase(readFileSync(SOURCE, 'utf8'));
  assert.equal(readFileSync(join(RACINE, 'app/js/donnees/base-metier.js'), 'utf8'), genererFichier(r, 'base-officielle-production-stock-hygiene.md'),
    'relancer « npm run base »');
  assert.equal(BASE_METIER.length, 133);
  assert.equal(VERSION_BASE, '5.5');
  assert.equal(PROVENANCE_BASE, 'BASE_METIER_ESTIMATION');
  for (const l of BASE_METIER) {
    assert.ok(['parage', 'cuisson', 'portionnement'].includes(l.etape));
    assert.ok(l.coefMin > 0 && l.coefMin <= l.coefMax, l.produit);
    if (l.etape !== 'cuisson') assert.ok(l.coefMax < 1, `${l.produit} : parage et portionnement ne font que perdre`);
    assert.ok(l.categorie && l.produit && l.texte);
  }
  const riz = BASE_METIER.find((l) => l.etape === 'cuisson' && l.produit === 'Riz');
  assert.deepEqual([riz.coefMin, riz.coefMax], [2.5, 3]);
  const romanesco = BASE_METIER.find((l) => l.produit === 'Chou romanesco');
  assert.deepEqual([romanesco.coefMin, romanesco.coefMax], [0.7, 0.7]);
});

test('fichier généré : en-tête « généré, ne pas éditer » et rappel des estimations génériques', () => {
  const src = readFileSync(join(RACINE, 'app/js/donnees/base-metier.js'), 'utf8');
  assert.match(src.split('\n').slice(0, 12).join('\n'), /GÉNÉRÉ — NE PAS ÉDITER/);
  assert.match(src.split('\n').slice(0, 12).join('\n'), /ESTIMATIONS GÉNÉRIQUES/);
  assert.match(src.split('\n').slice(0, 12).join('\n'), /BASE_METIER_ESTIMATION/);
  assert.equal(/^import\s/m.test(src), false);
});

test('script : écrit le fichier et avertit pour une ligne illisible', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'sanji-base-'));
  const source = join(dossier, 'source.md');
  const sortie = join(dossier, 'sortie', 'base.js');
  mkdirSync(join(dossier, 'sortie'));
  writeFileSync(source, MD, 'utf8');
  const r = spawnSync(process.execPath, [SCRIPT, source, sortie], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /parage : 2 ligne\(s\) lue\(s\), 1 ignorée\(s\)/);
  assert.match(r.stdout, /Total : 5 ligne\(s\)/);
  assert.match(r.stderr, /2 ligne\(s\) illisible\(s\) ignorée\(s\)/);
  assert.match(r.stderr, /PRODUIT_ILLISIBLE_TEST/);
  const contenu = readFileSync(sortie, 'utf8');
  assert.match(contenu, /PRODUIT_A_TEST/);
  assert.equal(contenu.includes('PRODUIT_ILLISIBLE_TEST'), false);
});

// ---------------------------------------------------------------- repères de portion (section 11.4, facultative)

test('lirePortion : « 100–120 g » ou « 60 g », l\'illisible est refusé, jamais deviné', () => {
  assert.deepEqual(lirePortion('100–120 g'), { min: 100, max: 120, unite: 'g', texte: '100–120 g' });
  assert.deepEqual(lirePortion('60 g'), { min: 60, max: 60, unite: 'g', texte: '60 g' });
  assert.deepEqual(lirePortion('**100-120 g**'), { min: 100, max: 120, unite: 'g', texte: '100-120 g' });
  assert.deepEqual(lirePortion('0,5 pièce'), { min: 0.5, max: 0.5, unite: 'piece', texte: '0,5 pièce' });
  assert.deepEqual(lirePortion('2–3 pièces'), { min: 2, max: 3, unite: 'piece', texte: '2–3 pièces' });
  assert.deepEqual(lirePortion('~150 ml'), { min: 150, max: 150, unite: 'ml', texte: '~150 ml' });
  assert.deepEqual(lirePortion('80 g'), { min: 80, max: 80, unite: 'g', texte: '80 g' }, 'espace insécable fine');
  for (const t of ['', '—', '120–100 g', '0 g', '100 kg', '100', 'g', '100 à 120 g', '100–120', 'environ 100 g', '100 g – 120 g', 'x g']) {
    assert.equal(lirePortion(t), null, `« ${t} »`);
  }
});

const MD_PORTIONS = `**Version 9.9 — essai**

### 11.1 Parage
| Catégorie | Produit | Perte | Notes |
| --- | --- | --- | --- |
| CAT_A | PRODUIT_A_TEST | 10–20 % | note a |

### 11.2 Cuisson
| Catégorie | Produit / méthode | Perte | Notes |
| --- | --- | --- | --- |
| CAT_B | METHODE_A_TEST | **gain ×2–2,5** | gain |

### 11.3 Portionnement
| Catégorie | Geste | Perte | Notes |
| --- | --- | --- | --- |
| CAT_C | GESTE_TEST | 2–4 % | n |

### 11.4 Repères de portion (essai)

Texte libre avant le tableau.

| Notes | Portion | État | Produit | Sources | Rôle | Catégorie |
| --- | --- | --- | --- | --- | --- | --- |
| note riz | **100–120 g** | sec | FAMILLE_A_TEST | SOURCE_A_TEST | garniture | CAT_X |
| — | 60 g | cru net | GROUPE_B_TEST | — | plat principal | CAT_X |
| sans portion | — | cuit | PRODUIT_SANS_PORTION_TEST | | garniture | CAT_X |
| sans rôle | 50 g | cuit | PRODUIT_SANS_ROLE_TEST | | | CAT_X |
| rôle inconnu | 50 g | cuit | PRODUIT_ROLE_INCONNU_TEST | | dessert | CAT_X |
| sans état | 50 g | | PRODUIT_SANS_ETAT_TEST | | garniture | CAT_X |
| état ambigu | 50 g | cru | PRODUIT_ETAT_AMBIGU_TEST | | garniture | CAT_X |
| sans produit | 50 g | sec | — | | garniture | CAT_X |
| ligne courte | 50 g |
| — | **0,5 pièce** | cuit | PRODUIT_PIECE_TEST | | autre | CAT_X |

### 11.5 Autre section
| Produit | Rôle | État | Portion |
| --- | --- | --- | --- |
| PRODUIT_AUTRE_SECTION_TEST | garniture | sec | 10 g |
`;

test('extraireBase : lit la table 11.4 par titres de colonnes, ignore et compte les lignes incomplètes, ne devine rien', () => {
  const r = extraireBase(MD_PORTIONS);
  assert.deepEqual(r.portions, [
    { produit: 'FAMILLE_A_TEST', role: 'garniture', etat: 'sec', min: 100, max: 120, unite: 'g', texte: '100–120 g', sources: 'SOURCE_A_TEST', note: 'note riz' },
    { produit: 'GROUPE_B_TEST', role: 'plat_principal', etat: 'cru_net', min: 60, max: 60, unite: 'g', texte: '60 g', sources: '', note: '' },
    { produit: 'PRODUIT_PIECE_TEST', role: 'autre', etat: 'cuit', min: 0.5, max: 0.5, unite: 'piece', texte: '0,5 pièce', sources: '', note: '' },
  ]);
  assert.deepEqual(r.comptesPortions, { presente: true, lues: 3, ignorees: 7 });
  const ignorees = r.illisibles.filter((x) => x.section === '11.4').map((x) => x.ligne);
  assert.equal(ignorees.length, 7);
  for (const nom of ['SANS_PORTION', 'SANS_ROLE', 'ROLE_INCONNU', 'SANS_ETAT', 'ETAT_AMBIGU']) {
    assert.ok(ignorees.some((l) => l.includes(`PRODUIT_${nom}_TEST`)), nom);
  }
  assert.ok(ignorees.some((l) => l.includes('ligne courte')));
  assert.equal(r.portions.some((x) => /AUTRE_SECTION/.test(x.produit)), false, 'une table d\'une autre section n\'est pas lue');
  // Les trois tables de la base ne sont pas touchées, ni leurs comptes.
  assert.deepEqual(r.comptes, { parage: { lues: 1, ignorees: 0 }, cuisson: { lues: 1, ignorees: 0 }, portionnement: { lues: 1, ignorees: 0 } });
  assert.equal(r.lignes.length, 3);
  assert.equal(r.illisibles.length, 7, 'seules les lignes de la 11.4 sont signalées ici');
});

test('extraireBase : section 11.4 absente = PORTIONS_BASE vide, sans avertissement ; table manquante ou colonne obligatoire absente signalées', () => {
  const absente = extraireBase(MD_PORTIONS.slice(0, MD_PORTIONS.indexOf('### 11.4')));
  assert.deepEqual(absente.portions, []);
  assert.deepEqual(absente.comptesPortions, { presente: false, lues: 0, ignorees: 0 });
  assert.equal(absente.illisibles.length, 0, 'la section est facultative : aucun avertissement');
  const sansTable = extraireBase('### 11.4 Repères de portion\n\nTexte seulement.\n\n### 11.5 Suite\n| a | b |\n| - | - |\n| 1 | 2 |\n');
  assert.deepEqual(sansTable.portions, []);
  assert.deepEqual(sansTable.illisibles.filter((x) => x.section === '11.4'), [{ section: '11.4', ligne: '(table introuvable)' }]);
  const sansEtat = extraireBase('### 11.4 Repères de portion\n| Produit | Rôle | Portion |\n| - | - | - |\n| PRODUIT_TEST | garniture | 60 g |\n');
  assert.deepEqual(sansEtat.portions, [], 'sans colonne État, rien n\'est deviné');
  assert.match(sansEtat.illisibles.find((x) => x.section === '11.4').ligne, /colonne\(s\) obligatoire\(s\) introuvable\(s\) : etat/);
  assert.deepEqual(sansEtat.comptesPortions, { presente: true, lues: 0, ignorees: 1 });
  // Titre en minuscules et « Reperes » sans accent acceptés ; un autre numéro de section n'est pas lu.
  const tolerant = extraireBase('### 11.4 reperes de portion\n| produit | role | etat | portion |\n| - | - | - | - |\n| PRODUIT_TEST | Garniture | SEC | 60 g |\n');
  assert.deepEqual(tolerant.portions.map((x) => [x.produit, x.role, x.etat]), [['PRODUIT_TEST', 'garniture', 'sec']]);
  assert.deepEqual(extraireBase('### 11.6 Repères de portion\n| Produit | Rôle | État | Portion |\n| - | - | - | - |\n| X | garniture | sec | 60 g |\n').portions, []);
});

test('base réelle : la section 11.4 n\'existe pas aujourd\'hui, PORTIONS_BASE embarqué = extraction de la source', () => {
  const r = extraireBase(readFileSync(SOURCE, 'utf8'));
  assert.deepEqual(PORTIONS_BASE, r.portions, 'relancer « npm run base »');
  if (!r.comptesPortions.presente) assert.deepEqual(PORTIONS_BASE, [], 'section absente : liste vide');
  assert.equal(Array.isArray(PORTIONS_BASE), true);
  assert.equal(r.illisibles.some((x) => x.section === '11.4'), false);
  // Le fichier généré porte l'export en plus de BASE_METIER.
  const src = readFileSync(join(RACINE, 'app/js/donnees/base-metier.js'), 'utf8');
  assert.match(src, /^export const PORTIONS_BASE = \[/m);
  assert.match(src, /^export const BASE_METIER = \[/m);
});

test('script : écrit PORTIONS_BASE depuis un fichier Markdown temporaire, avertit pour une ligne incomplète', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'sanji-portions-'));
  const source = join(dossier, 'source.md');
  const sortie = join(dossier, 'sortie', 'base.js');
  mkdirSync(join(dossier, 'sortie'));
  writeFileSync(source, MD_PORTIONS, 'utf8');
  const r = spawnSync(process.execPath, [SCRIPT, source, sortie], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /repères de portion \(11\.4\) : 3 ligne\(s\) lue\(s\), 7 ignorée\(s\)/);
  assert.match(r.stdout, /Total : 3 ligne\(s\)/);
  assert.match(r.stderr, /7 ligne\(s\) illisible\(s\) ignorée\(s\)/);
  assert.match(r.stderr, /\[11\.4\].*PRODUIT_SANS_PORTION_TEST/);
  const contenu = readFileSync(sortie, 'utf8');
  assert.equal(contenu.includes('PRODUIT_SANS_PORTION_TEST'), false);
  const module = await import(`${pathToFileURL(sortie).href}?essai=portions`);
  assert.deepEqual(module.PORTIONS_BASE.map((x) => x.produit), ['FAMILLE_A_TEST', 'GROUPE_B_TEST', 'PRODUIT_PIECE_TEST']);
  assert.equal(module.BASE_METIER.length, 3);
  assert.equal(module.PORTIONS_BASE[0].max, 120);
  // Sans la section : PORTIONS_BASE existe et est vide.
  const sans = join(dossier, 'sans.md');
  const sortieSans = join(dossier, 'sortie', 'sans.js');
  writeFileSync(sans, MD_PORTIONS.slice(0, MD_PORTIONS.indexOf('### 11.4')), 'utf8');
  const r2 = spawnSync(process.execPath, [SCRIPT, sans, sortieSans], { encoding: 'utf8' });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /section 11\.4 absente \(facultative\), PORTIONS_BASE vide/);
  assert.equal(r2.stderr.includes('illisible'), false);
  const vide = await import(`${pathToFileURL(sortieSans).href}?essai=vide`);
  assert.deepEqual(vide.PORTIONS_BASE, []);
  assert.equal(vide.BASE_METIER.length, 3);
});

test('genererFichier : PORTIONS_BASE vide par défaut, sans import, en-tête conservé', () => {
  const texte = genererFichier({ lignes: [], version: '1' }, 'source.md');
  assert.match(texte, /export const PORTIONS_BASE = \[\];/);
  assert.equal(/^import\s/m.test(texte), false);
  assert.match(texte.split('\n').slice(0, 12).join('\n'), /GÉNÉRÉ — NE PAS ÉDITER/);
  assert.match(texte.split('\n').slice(0, 12).join('\n'), /ESTIMATIONS GÉNÉRIQUES/);
});
