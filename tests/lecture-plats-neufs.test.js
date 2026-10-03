// Mesure de généralisation de lirePlat sur 30 cas NEUFS (CAS_NEUFS, écrits avant de lire le lecteur).
//
// Même méthode que tests/lecture-plats.test.js, dont la règle est RECOPIÉE ici (ce fichier n'exporte rien et
// l'importer relancerait ses tests). Si la règle change là-bas, la changer ici aussi.
//  (a) éléments : chaque élément attendu « au poste » est lu au poste, aucun élément inventé ;
//  (b) poste : aucun élément « hors poste » mis au poste (au menu 2, ni protéine ni sauce au poste) ;
//  (c) à confirmer : sauce, base, recette, fiche ou choix attendus sont signalés « à confirmer ».
// Correspondance tolérante : textes canoniques sans accent, mots vides et pluriels retirés, « sauce » retiré s'il reste
// un autre mot, riz = risotto, toute forme de pâtes = « pâte » ; un élément plus long que l'attendu correspond, pas l'inverse.
// Les entrées d'aConfirmer qui ne parlent pas de sauce/base/recette/fiche/choix (ex. une préparation inconnue) ne sont pas contrôlées en (c).
//
// Ce test PASSE TOUJOURS : les seuils sont en `todo` avec le score réel tant qu'ils ne sont pas atteints.

import test from 'node:test';
import assert from 'node:assert/strict';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';
import { FORMES_PATES, canonique } from '../app/js/domaine/vocabulaire-plats.js';
import { CAS_NEUFS } from './jeux/TEST_ONLY-cas-lecture-neufs.js';

const VIDES = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'nature']);
const sing = (m) => m.replace(/[sx]$/, '');
const PATES = new Set(FORMES_PATES.flatMap((f) => f.split(' ')).map(sing));
const classe = (m) => {
  const s = sing(m);
  if (s === 'riz' || s === 'risotto') return 'riz';
  if (PATES.has(s) || s === 'pate') return 'pate';
  return s;
};
const motsDe = (texte) => canonique(texte).replace(/'/g, ' ').replace(/[^a-z0-9-]+/g, ' ').trim().split(' ')
  .filter((m) => m !== '' && !VIDES.has(m));
const motsAttendus = (attendu) => {
  let mots = motsDe(attendu);
  if (mots.length > 1) mots = mots.filter((m) => m !== 'sauce');
  return mots;
};
const classesElement = (e) => new Set([e.nom, e.canonique, ...(e.alternatives ?? [])].filter(Boolean)
  .flatMap(motsDe).map(classe));

function correspond(attendu, element) {
  const classes = classesElement(element);
  const mots = motsAttendus(attendu);
  if (mots.length === 0) return false;
  if (attendu === 'sauce') return element.categorie === 'sauce';
  return mots.every((m) => classes.has(classe(m)));
}

// ---------------------------------------------------------------- mesures

const sauceImplicite = (e) => e.origine === 'implicite';

function inventes(lecture) {
  const texte = new Set(motsDe(lecture.normalise).map(classe));
  const motsLus = new Set(motsDe(canonique(lecture.original)).map(classe));
  return lecture.elements.filter((e) => {
    if (sauceImplicite(e)) {
      return e.statut !== 'a_confirmer' || e.categorie !== 'sauce' || e.candidates === undefined
        || e.candidates.some((c) => 'choisie' in c || 'selectionnee' in c || 'defaut' in c);
    }
    return motsDe(e.canonique ?? e.nom).some((m) => !texte.has(classe(m)) && !motsLus.has(classe(m)));
  });
}

function mesurer(cas) {
  const lecture = lirePlat(cas.intitule, cas.menu, {});
  const els = lecture.elements;
  const echecs = [];

  const manquants = cas.auPoste.filter((a) => !els.some((e) => e.propriete === 'poste' && correspond(a, e)));
  const faux = inventes(lecture);
  const a = manquants.length === 0 && faux.length === 0;
  if (manquants.length) echecs.push(`éléments manquants au poste : ${manquants.join(', ')}`);
  if (faux.length) echecs.push(`éléments inventés : ${faux.map((e) => e.nom).join(', ')}`);

  const mal = [
    ...cas.horsPoste.filter((h) => els.some((e) => e.propriete === 'poste' && correspond(h, e))),
    ...(cas.menu === 2 ? els.filter((e) => e.propriete === 'poste' && (e.categorie === 'proteine' || e.categorie === 'sauce'))
      .map((e) => e.nom) : []),
  ];
  const b = mal.length === 0;
  if (!b) echecs.push(`hors poste mis au poste : ${[...new Set(mal)].join(', ')}`);

  const signale = (entree) => {
    if (/choix/.test(entree)) return els.some((e) => (e.alternatives ?? []).length > 1);
    if (/sauce|base/.test(entree)) return els.some((e) => e.categorie === 'sauce' && e.statut === 'a_confirmer');
    return els.some((e) => e.statut === 'a_confirmer');
  };
  const nonSignales = cas.aConfirmer.filter((x) => /sauce|base|recette|fiche|choix/.test(x)).filter((x) => !signale(x));
  const c = nonSignales.length === 0;
  if (!c) echecs.push(`non signalé à confirmer : ${nonSignales.join(', ')}`);

  return { cas, lecture, a, b, c, ok: a && b && c, echecs, nbInventes: faux.length };
}

const resultats = CAS_NEUFS.map(mesurer);
const N = CAS_NEUFS.length;
const compte = (f) => resultats.filter(f).length;
const nbInventes = resultats.reduce((s, r) => s + r.nbInventes, 0);

const rapport = () => {
  const lignes = resultats.filter((r) => !r.ok).map((r) => `  cas ${r.cas.numero} « ${r.cas.intitule} » menu ${r.cas.menu}\n`
    + `    ${r.echecs.join(' ; ')}\n    lu : ${r.lecture.elements.map((e) => `${e.nom} [${e.propriete}/${e.statut}]`).join(' | ')}`);
  return `éléments ${compte((r) => r.a)}/${N}, poste ${compte((r) => r.b)}/${N}, à confirmer ${compte((r) => r.c)}/${N} ; `
    + `entièrement corrects ${compte((r) => r.ok)}/${N} ; éléments inventés ${nbInventes}\n${lignes.join('\n')}`;
};

test('jeu neuf : 30 cas bien formés', () => {
  assert.equal(N, 30);
  assert.equal(CAS_NEUFS.filter((c) => c.menu === 1).length, 14);
  assert.equal(CAS_NEUFS.filter((c) => c.menu === 2).length, 16);
});

const SEUIL = Math.ceil(N * 0.9);
const okTotal = compte((r) => r.ok);
test(`seuil : au moins 90 % de cas entièrement corrects (${SEUIL} sur ${N})`,
  { todo: okTotal >= SEUIL ? false : `score obtenu ${okTotal}/${N}` },
  () => { assert.ok(okTotal >= SEUIL, rapport()); });

test('seuil : zéro élément inventé',
  { todo: nbInventes === 0 ? false : `${nbInventes} élément(s) inventé(s)` },
  () => { assert.equal(nbInventes, 0, rapport()); });

test('rapport des trois dimensions sur les cas neufs (information)', () => {
  console.log(`# cas neufs : ${rapport()}`.split('\n').map((l, i) => (i === 0 ? l : `# ${l}`)).join('\n'));
  assert.ok(true);
});
