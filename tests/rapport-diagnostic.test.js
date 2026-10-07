// Rapport de diagnostic (domaine pur). Données TEST_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nettoyer, resumeEtat, texteDiagnostic } from '../app/js/domaine/rapport-diagnostic.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { etatVide, h } from './aide.js';

const CLE = `sk-${'ant'}-api03-TEST_ONLY_abc-123`;

test('nettoyer masque la clé, borne et refuse objets et tableaux', () => {
  assert.equal(nettoyer(`x ${CLE} y`).includes('sk-ant'), false);
  assert.equal(nettoyer('a'.repeat(500)).length, 200);
  assert.equal(nettoyer('a'.repeat(500), 40).length, 40);
  assert.equal(nettoyer({ a: 1 }), undefined);
  assert.equal(nettoyer([1]), undefined);
  assert.equal(nettoyer(NaN), undefined);
  assert.equal(nettoyer(3), 3);
  assert.equal(nettoyer(true), true);
});

test('resumeEtat : nombres seulement, sans détail du journal d\'état, état intact', () => {
  const e = etatVide();
  definirMenu(e, '2026-10-05', 1, 'SECRET_PLAT_TEST', h());
  e.journal.push({ h: h(1), action: 'definirMenu', detail: 'SECRET_DETAIL_TEST' });
  e.memoire['nom|1'] = { categorie: 'feculent' };
  const avant = JSON.stringify(e);
  const r = resumeEtat(e);
  assert.equal(r.joursAvecMenu, 1);
  assert.equal(r.semainesAvecMenus, 1);
  assert.equal(r.motsRetenus, 1);
  assert.ok(r.composants >= 1);
  assert.equal(JSON.stringify(r).includes('SECRET'), false);
  assert.ok(r.dernieresActions.length <= 20);
  assert.equal(JSON.stringify(e), avant);
});

test('texteDiagnostic : phrase, synthèse, erreurs, aucune clé ni objet', () => {
  const evenements = [
    { h: h(0), type: 'clic', libelle: 'Enregistrer' },
    { h: h(1), type: 'erreur', message: `boom ${CLE}`, fichier: 'a.js:3' },
    { h: h(2), type: 'ia', outil: 'rendre_feuille', ok: false, statut: 401, ms: 12, objet: { a: 'SECRET_TEST' } },
    { h: h(3), type: 'ia', outil: 'rendre_fiche', ok: true, statut: 200, ms: 40 },
  ];
  const t = texteDiagnostic({ environnement: { version: '9', agent: 'x'.repeat(300) }, resume: resumeEtat(etatVide()), evenements, aujourdhui: '2026-10-07' });
  assert.match(t, /^Diagnostic Sanji/);
  assert.match(t, /Ce fichier ne contient jamais votre clé\. Il peut contenir le texte lu par l'IA et des photos/);
  assert.match(t, /Erreurs : 1/);
  assert.match(t, /Appels IA réussis : 1 \(statuts : 200\)/);
  assert.match(t, /Appels IA échoués : 1 \(statuts : 401\)/);
  assert.equal(t.includes('sk-ant'), false);
  assert.equal(t.includes('SECRET_TEST'), false);
  assert.ok(t.indexOf('ERREURS') < t.indexOf('ÉVÉNEMENTS'));
  assert.ok(t.indexOf('Enregistrer') > t.indexOf('ÉVÉNEMENTS'));
  assert.equal(/x{121}/.test(t), false);
});

test('texteDiagnostic : 150 événements au plus, le plus récent d\'abord', () => {
  const evenements = Array.from({ length: 200 }, (_, i) => ({ h: h(i), type: 'navigation', route: `#/r${i}` }));
  const t = texteDiagnostic({ evenements });
  assert.ok(t.indexOf('#/r199') < t.indexOf('#/r198'));
  assert.equal(t.includes('#/r49 '), false);
  assert.equal(t.includes('route=#/r50'), true);
});

test('texteDiagnostic : le contenu lu par l\'IA est gardé (clé masquée), les photos jointes sont comptées, le motif est dit', () => {
  const contenu = JSON.stringify([{ lignes: ['LU_PAR_IA_TEST', CLE] }]);
  const evenements = [{ h: h(0), type: 'ia', outil: 'rendre_feuille', ok: true, statut: 200, ms: 5, contenu }];
  const t = texteDiagnostic({ evenements, photosJointes: 2, photosEnMemoire: 3 });
  assert.match(t, /CONTENU LU PAR L'IA/);
  assert.match(t, /LU_PAR_IA_TEST/);
  assert.equal(t.includes('sk-ant'), false, 'la clé est masquée même dans le contenu');
  assert.match(t, /Photos jointes : 2 \(gardées en mémoire jusqu'à la fermeture de l'application\) ; 1 photo\(s\) en mémoire non jointes \(partage de fichiers multiples indisponible\)/);
  assert.match(texteDiagnostic({ evenements, photosEnMemoire: 1, motifPhotos: 'copie de texte' }), /1 photo\(s\) en mémoire non jointes \(copie de texte\)/);
  assert.match(texteDiagnostic({ evenements: [] }), /CONTENU LU PAR L'IA[^\n]*\naucun/);
  // Le contenu n'est pas répété (ni tronqué à 200 caractères) dans les lignes d'événements.
  assert.equal(t.split('LU_PAR_IA_TEST').length - 1, 1);
});
