// Conservation du référentiel (standard de base) : elle AVERTIT sans bloquer ; seule la limite saisie par la propriétaire
// bloque ; le riz cuit est signalé dès une cuisson à J-2 ; le refroidissement (2 h) est dit sur « Après service ».
// Jeux TEST_ONLY, mots génériques.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { ajusterStandard } from '../app/js/domaine/actions-ajustements.js';
import { definirMenu, definirPrevision, definirRegle, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { aideRefroidissement, evaluerAvance, evaluationProduction, feuilleDuJour, repereConservation } from '../app/js/domaine/planification.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, principaleDe } from './aide.js';

let dom;
let magasin;
let vueJour;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueJour = await import('../app/js/ui/vue-jour.js');
});
after(() => dom.restaurer());

/** Le jeudi : menu 1 de tagliatelles, menu 2 de riz et carottes. */
function jeudi() {
  const e = etatVide();
  definirMenu(e, S.jeudi, 1, 'Tagliatelles', h());
  definirMenu(e, S.jeudi, 2, 'riz, carottes', h());
  definirPrevision(e, S.jeudi, 1, 10, h());
  definirPrevision(e, S.jeudi, 2, 10, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'riz', 'garniture', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  return e;
}
const composantDe = (e, nom) => Object.values(e.composants).find((c) => c.nom === nom);
const prodDe = (e, nom) => principaleDe(e, composantDe(e, nom).id);
const classes = (x) => String(x.classe ?? x.className ?? '');

test('repère : le riz cuit se garde 1 jour, avec sa provenance ; sans famille, pas de repère', () => {
  const e = jeudi();
  const r = repereConservation(composantDe(e, 'riz'));
  assert.equal(r.jours, 1);
  assert.match(r.texte, /^se garde 1 jour \(standard de base, feculents\.riz\.conservation\.cuit\)$/);
  assert.match(r.provenance, /standard de base, référentiel culinaire/);
  assert.equal(repereConservation(composantDe(e, 'carottes')).jours, 2, 'règle générale des légumes cuits');
  assert.equal(repereConservation(null), null);
  assert.equal(repereConservation({ famille: null }), null);
});

test('sans limite saisie : le repère remplace « conservation à confirmer » ; J-1 sans avertissement, J-2 averti, jamais bloqué', () => {
  const repere = repereConservation(composantDe(jeudi(), 'riz'));
  const j1 = evaluerAvance(S.mercredi, S.jeudi, null, repere);
  assert.equal(j1.conservation, 'referentiel');
  assert.deepEqual(j1.alertes, [], 'la durée le permet : aucun avertissement');
  assert.equal(j1.repere.depasse, false);
  assert.ok(j1.autorisee && j1.couvre);
  const j2 = evaluerAvance(S.mardi, S.jeudi, null, repere);
  assert.equal(j2.conservation, 'referentiel');
  assert.equal(j2.repere.depasse, true);
  assert.ok(j2.alertes.some((a) => /avertissement de conservation : se garde 1 jour \(standard de base/.test(a)));
  assert.ok(!j2.alertes.some((a) => /conservation à confirmer|hors règle/.test(a)), 'ni « à confirmer » ni « hors règle »');
  assert.ok(j2.autorisee && j2.couvre, 'J-2 : averti, mais autorisé et couvrant (règle des 2 jours)');
  assert.equal(j2.exception, false);
  // « hors règle » ne vient que de la règle des 2 jours, jamais du référentiel.
  const j3 = evaluerAvance(S.lundi, S.jeudi, null, repere);
  assert.equal(j3.autorisee, false);
  assert.ok(j3.alertes.some((a) => /hors règle/.test(a)));
  // Sans repère : comportement inchangé.
  assert.equal(evaluerAvance(S.mardi, S.jeudi, null).conservation, 'a_confirmer');
});

test('la valeur de la propriétaire prime et seule elle bloque', () => {
  const repere = repereConservation(composantDe(jeudi(), 'riz'));
  const ok = evaluerAvance(S.mardi, S.jeudi, { limiteUtilisationJours: 3 }, repere);
  assert.equal(ok.conservation, 'validee');
  assert.equal(ok.repere, undefined);
  assert.deepEqual(ok.alertes, [], 'le riz à 1 jour du référentiel ne dit plus rien : la maison a décidé 3 jours');
  const bloque = evaluerAvance(S.mardi, S.jeudi, { limiteUtilisationJours: 1 }, repere);
  assert.equal(bloque.conservation, 'depassee');
  assert.equal(bloque.couvre, false);
  assert.equal(bloque.repere, undefined);
  assert.ok(bloque.alertes.some((a) => /limite d'utilisation dépassée/.test(a)));
});

test('étape de finition : sans limite saisie, le repère avertit ; une avance d\'étape n\'est pas une conservation', () => {
  const repere = { jours: 1, texte: 'se garde 1 jour (standard de base, essai)', provenance: 'standard de base, essai' };
  const ev = evaluerAvance(S.mardi, S.jeudi, { etape: true, finition: true, avanceMaxJours: 2, limiteUtilisationJours: null }, repere);
  assert.equal(ev.conservation, 'referentiel');
  assert.ok(ev.couvre && ev.repere.depasse);
  const prep = evaluerAvance(S.mardi, S.jeudi, { etape: true, finition: false, avanceMaxJours: 2 }, repere);
  assert.equal(prep.conservation, 'sans_objet');
});

test('planification : le riz planifié à J-2 est accepté, couvrant, avec avertissement ; à J-1 sans', () => {
  const e = jeudi();
  const p = prodDe(e, 'riz');
  const res = planifier(e, p, S.mardi, 'avant_midi', h());
  assert.ok(res.alertes.some((a) => /se garde 1 jour/.test(a)));
  assert.equal(res.evaluation.couvre, true);
  assert.equal(evaluationProduction(e, p).conservation, 'referentiel');
  const res1 = planifier(e, p, S.mercredi, 'avant_midi', h());
  assert.deepEqual(res1.alertes.filter((a) => /conservation/.test(a)), []);
  // Carottes (2 jours) à J-2 : la durée le permet.
  const c = planifier(e, prodDe(e, 'carottes'), S.mardi, 'avant_midi', h());
  assert.deepEqual(c.alertes.filter((a) => /conservation/.test(a)), []);
});

test('planification : la règle maison du nom prime sur le référentiel', () => {
  const e = jeudi();
  definirRegle(e, { nom: 'riz', avanceMaxJours: 2, limiteUtilisationJours: 3 }, h());
  const res = planifier(e, prodDe(e, 'riz'), S.mardi, 'avant_midi', h());
  assert.equal(res.evaluation.conservation, 'validee');
  assert.deepEqual(res.alertes.filter((a) => /conservation/.test(a)), []);
});

test('les pâtes du menu 1 restent le jour même (aucune avance proposée)', () => {
  const { lecture, aAvancer } = feuilleDuJour(jeudi(), S.mardi);
  assert.equal(lecture.apres.some((l) => l.nom === 'Tagliatelles'), false);
  assert.equal(aAvancer.some((a) => a.nom === 'Tagliatelles'), false);
});

test('refroidissement : phrase du standard de base (2 h, de 50 à 10 °C)', () => {
  const t = aideRefroidissement();
  assert.match(t, /Refroidir vite après la cuisson : 2 h \(de 50 à 10 °C\) au plus \(standard de base, référentiel culinaire\)\.$/);
  assert.match(t, /standard de base, référentiel culinaire/);
});

test('vue Jour : le riz à J-2 porte l\'avertissement en texte et sa provenance ; à J-1 rien', () => {
  const e = jeudi();
  planifier(e, prodDe(e, 'riz'), S.mardi, 'avant_midi', h());
  magasin.remplacer(e);
  const noeud = vueJour.rendre(magasin.etat(), S.mardi);
  const avert = noeud.tous((x) => classes(x).includes('mep-conservation'));
  assert.equal(avert.length, 1);
  assert.match(avert[0].textContent, /^Attention : se garde 1 jour \(standard de base, feculents\.riz\.conservation\.cuit\), avance de 2 jours\. standard de base, référentiel culinaire/);
  const aide = noeud.tous((x) => classes(x).includes('mep-aide-froid'));
  assert.equal(aide.length, 1);
  assert.match(aide[0].textContent, /2 h \(de 50 à 10 °C\) au plus/);
  planifier(e, prodDe(e, 'riz'), S.mercredi, 'avant_midi', h());
  magasin.remplacer(e);
  assert.doesNotMatch(vueJour.rendre(magasin.etat(), S.mercredi).textContent, /Attention : se garde/);
});

// ---------------------------------------------------------------- la valeur de la propriétaire passe devant

test('repère : la valeur de la propriétaire (riz réglé à 3 jours) remplace le standard : J-2 sans avertissement, J-4 averti', () => {
  const e = jeudi();
  ajusterStandard(e, 'riz', 'conservation', 3, h());
  const r = repereConservation(composantDe(e, 'riz'), e);
  assert.equal(r.jours, 3);
  assert.equal(r.texte, 'se garde 3 jours (votre valeur)');
  const ev = (jour) => evaluerAvance(jour, S.jeudi, null, r);
  assert.deepEqual(ev(S.mardi).alertes, [], 'J-2 : plus d\'avertissement « se garde 1 jour »');
  assert.equal(ev(S.mardi).repere.depasse, false);
  assert.equal(planifier(e, prodDe(e, 'riz'), S.mardi, 'avant_midi', h()).alertes.filter((a) => /conservation/.test(a)).length, 0);
  ajusterStandard(e, 'riz', 'conservation', 1.5, h());
  const court = evaluerAvance(S.mardi, S.jeudi, null, repereConservation(composantDe(e, 'riz'), e));
  assert.ok(court.alertes.some((a) => /se garde 1,5 jours \(votre valeur\)/.test(a)));
  assert.equal(court.conservation, 'referentiel', 'avertit seulement : seule la limite saisie bloque');
  assert.equal(court.couvre, true);
});

test('repère : une valeur plus courte que le standard avertit ; la règle générale ajustée compte aussi', () => {
  const e = jeudi();
  ajusterStandard(e, 'carottes', 'conservation', 1, h());
  const r = repereConservation(composantDe(e, 'carottes'), e);
  assert.equal(r.texte, 'se garde 1 jour (votre valeur)');
  assert.equal(evaluerAvance(S.mercredi, S.jeudi, null, r).alertes.length, 0);
  assert.ok(evaluerAvance(S.mardi, S.jeudi, null, r).alertes.some((a) => /se garde 1 jour \(votre valeur\)/.test(a)));
  const f = jeudi();
  ajusterStandard(f, 'regle:feculents_legumes_cuits', 'conservation', 1, h());
  const rg = repereConservation(composantDe(f, 'carottes'), f);
  assert.equal(rg.jours, 1);
  assert.match(rg.texte, /\(votre valeur\)$/);
});

test('repère : sans état, comportement inchangé ; la limite saisie reste seule à bloquer', () => {
  const e = jeudi();
  ajusterStandard(e, 'riz', 'conservation', 3, h());
  assert.equal(repereConservation(composantDe(e, 'riz')).jours, 1);
  const r = repereConservation(composantDe(e, 'riz'), e);
  const bloque = evaluerAvance(S.mardi, S.jeudi, { limiteUtilisationJours: 1 }, r);
  assert.equal(bloque.conservation, 'depassee');
});
