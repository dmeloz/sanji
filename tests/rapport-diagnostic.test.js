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
  assert.match(t, /Ce fichier ne contient jamais votre clé\. Il contient le texte lu par l'IA, les retours d'essai et des photos/);
  assert.equal(t.includes('relisez'), false, 'aucune consigne à la propriétaire');
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
  assert.match(t, /Photos jointes : 2 \(les 5 dernières, gardées 14 jours sur l'appareil\) ; 1 photo\(s\) gardées non jointes \(partage de fichiers multiples indisponible\)/);
  assert.match(texteDiagnostic({ evenements, photosEnMemoire: 1, motifPhotos: 'copie de texte' }), /1 photo\(s\) gardées non jointes \(copie de texte\)/);
  assert.match(texteDiagnostic({ evenements: [] }), /CONTENU LU PAR L'IA[^\n]*\naucun/);
  // Le contenu n'est pas répété (ni tronqué à 200 caractères) dans les lignes d'événements.
  assert.equal(t.split('LU_PAR_IA_TEST').length - 1, 1);
});

test('texteDiagnostic : les retours d\'essai sont inclus dans le même fichier', () => {
  const t = texteDiagnostic({ evenements: [], retoursTexte: 'Rapport d\'essai Sanji\nRetours : 1' });
  assert.match(t, /RETOURS D'ESSAI[^\n]*\nRapport d'essai Sanji\nRetours : 1/);
  assert.equal(texteDiagnostic({ evenements: [] }).includes('RETOURS D\'ESSAI'), false);
});

// ---- « Depuis le dernier envoi » (v110)
import { clePhoto, notesPourEnvoi, nouveautes } from '../app/js/domaine/rapport-diagnostic.js';

const REPERE = { h: h(10), notesEnvoyees: ['n1'], photosEnvoyees: ['diag|P1|feuille'] };

test('texteDiagnostic avec repère : seulement le nouveau, en-tête chiffré, état en chiffres sans la liste des actions', () => {
  const evenements = [
    { h: h(5), type: 'ia', outil: 'rendre_feuille', ok: true, statut: 200, contenu: 'VIEUX_CONTENU_IA' },
    { h: h(20), type: 'ia', outil: 'rendre_feuille', ok: true, statut: 200, contenu: 'NOUVEAU_CONTENU_IA' },
    { h: h(21), type: 'clic', libelle: 'Nouveau clic' },
  ];
  const resume = { ...resumeEtat(etatVide()), dernieresActions: [{ h: h(1), action: 'ACTION_VUE' }] };
  const t = texteDiagnostic({ evenements, resume, repere: REPERE, notesNouvelles: 2 });
  assert.match(t, /Depuis le dernier envoi \(2026-10-01 08:10:00\) : 2 événements, 2 notes nouvelles/);
  assert.match(t, /Données à lire|Ce fichier ne contient jamais votre clé/);
  assert.equal(t.includes('VIEUX_CONTENU_IA'), false);
  assert.match(t, /NOUVEAU_CONTENU_IA/);
  assert.equal(t.includes('ACTION_VUE'), false);
  assert.equal(texteDiagnostic({ evenements, resume }).includes('ACTION_VUE'), true, 'sans repère : comme avant');
  assert.equal(texteDiagnostic({ evenements }).includes('Depuis le dernier envoi'), false);
});

test('texteDiagnostic avec repère : 60 lignes au plus, navigations consécutives identiques regroupées « ×N »', () => {
  const nav = Array.from({ length: 5 }, (_, i) => ({ h: h(20 + i), type: 'navigation', route: '#/semaine' }));
  const autres = Array.from({ length: 100 }, (_, i) => ({ h: h(30 + i), type: 'clic', libelle: `b${i}` }));
  const t = texteDiagnostic({ evenements: [...nav, ...autres], repere: REPERE });
  assert.match(t, /lignes pour 105 événements/);
  assert.equal(t.split('\n').filter((l) => l.includes(' · clic · ')).length, 60);
  const regroupe = texteDiagnostic({ evenements: nav, repere: REPERE });
  assert.match(regroupe, /route=#\/semaine ×5/);
  assert.equal(regroupe.split('\n').filter((l) => l.includes('navigation')).length, 1);
});

test('nouveautes et notesPourEnvoi : notes déjà transmises sur une ligne tronquée à 60, nouvelles en détail, photos et retours filtrés', () => {
  const notes = [
    { id: 'n1', type: 'bug', categorie: 'bug_gene', texte: `ANCIENNE ${'x'.repeat(100)}`, ecran: 'A', etat: 'ouverte', h: h(1) },
    { id: 'n0', type: 'bug', categorie: 'bug_gene', texte: 'REGLEE_ANCIENNE', ecran: 'A', etat: 'reglee', h: h(1) },
    { id: 'n2', type: 'idee', categorie: 'idee_remarque', texte: 'NOUVELLE_NOTE', ecran: 'B', etat: 'ouverte', h: h(15) },
  ];
  const photos = [{ h: 'P1', type: 'feuille' }, { h: 'P2', type: 'fiche' }];
  const retours = [{ h: h(1), type: 'menu' }, { h: h(30), type: 'menu' }];
  const nv = nouveautes({ notes, photos, retours }, { ...REPERE, notesEnvoyees: ['n1', 'n0'] });
  assert.deepEqual(nv.notes.map((n) => n.id), ['n2']);
  assert.deepEqual(nv.photos.map(clePhoto), ['diag|P2|fiche']);
  assert.equal(nv.retours.length, 1);
  const texte = notesPourEnvoi(nv, { version: '110', date: 'd' });
  assert.match(texte, /NOUVELLE_NOTE/);
  assert.match(texte, /1 notes déjà transmises, toujours ouvertes :\n {2}- ANCIENNE x+…$/);
  assert.equal(texte.includes('REGLEE_ANCIENNE'), false);
  assert.equal(nouveautes({ notes, photos, retours }, null).notes.length, 3, 'premier envoi : tout');
});
