import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterPreparatoire, definirRegle, demarrer, deciderEcart,
  marquerFait, planifier, reporter, corrigerReel, modifierComposant,
} from '../app/js/domaine/actions.js';
import {
  avancesPossibles, cibleProduction, ecartProduction, etatTache, evaluerAvance,
  feuilleDuJour, regleDe, suggererJour,
} from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { ajouterJours } from '../app/js/domaine/dates.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';

function unePrincipale(date = S.lundi, def = J.PRODUIT_SEC_TEST, portions = 40) {
  const e = etatVide();
  prevision(e, date, 1, portions);
  const c = composantValide(e, date, 1, def);
  return { e, c, p: principaleDe(e, c) };
}

test('evaluerAvance : 0, 1, 2 jours et conservation', () => {
  assert.deepEqual(evaluerAvance(S.lundi, S.lundi, null), { jours: 0, exception: false, autorisee: true, conservation: 'sans_objet', couvre: true, alertes: [] });
  const un = evaluerAvance(S.lundi, S.mardi, null);
  assert.equal(un.autorisee, true);
  assert.equal(un.conservation, 'a_confirmer');
  assert.equal(un.couvre, true);
  assert.ok(un.alertes.includes('conservation à confirmer'));
  assert.equal(evaluerAvance(S.lundi, S.mardi, { limiteUtilisationJours: 1 }).conservation, 'validee');
  const depassee = evaluerAvance(S.lundi, S.mercredi, { limiteUtilisationJours: 1 });
  assert.equal(depassee.conservation, 'depassee');
  assert.equal(depassee.couvre, false);
  assert.equal(depassee.autorisee, true);
  assert.equal(evaluerAvance(S.lundi, S.mercredi, { limiteUtilisationJours: 2 }).couvre, true);
});

test('evaluerAvance : négatif, dimanche, date inconnue', () => {
  const apres = evaluerAvance(S.mardi, S.lundi, null);
  assert.equal(apres.autorisee, false);
  assert.equal(apres.couvre, false);
  const dim = evaluerAvance(S.dimanche, S.lundiSuivant, null);
  assert.equal(dim.autorisee, false);
  assert.ok(dim.alertes.some((a) => a.includes('dimanche')));
  assert.equal(evaluerAvance(null, S.lundi, null).autorisee, false);
});

test('evaluerAvance : plus de deux jours = exception, règle propre à la préparation requise', () => {
  const ev = evaluerAvance(S.samedi, S.mardiSuivant, null); // 3 jours
  assert.equal(ev.jours, 3);
  assert.equal(ev.exception, true);
  assert.equal(ev.autorisee, false);
  assert.equal(ev.couvre, false);
  assert.ok(ev.alertes.some((a) => a.includes('hors règle')));
  assert.equal(evaluerAvance(S.samedi, S.mardiSuivant, { avanceMaxJours: 3, limiteUtilisationJours: 3 }).autorisee, true);
  assert.equal(evaluerAvance(S.samedi, S.mardiSuivant, { avanceMaxJours: 3, limiteUtilisationJours: 2 }).autorisee, false);
  assert.equal(evaluerAvance(S.samedi, S.mardiSuivant, { avanceMaxJours: 2, limiteUtilisationJours: 9 }).autorisee, false);
  assert.equal(evaluerAvance(S.samedi, S.mardiSuivant, { avanceMaxJours: null, limiteUtilisationJours: 9 }).autorisee, false);
});

test('regleDe : par nom normalisé', () => {
  const { e, c } = unePrincipale();
  assert.equal(regleDe(e, e.composants[c]), null);
  const id = definirRegle(e, { nom: 'produit_SEC_test', avanceMaxJours: 3, limiteUtilisationJours: 4 }, h());
  assert.equal(regleDe(e, e.composants[c]).id, id);
  assert.equal(regleDe(e, null), null);
});

test('cibleProduction : principale, complément, préparatoire', () => {
  const { e, c, p } = unePrincipale();
  assert.equal(cibleProduction(e, p), 2000);
  const prep = ajouterPreparatoire(e, c, 'ACTION_PREPARATOIRE_TEST', h());
  assert.equal(cibleProduction(e, prep), null);
  planifier(e, p, S.lundi, h());
  marquerFait(e, p, 1500, h()); // réel inférieur à la cible
  prevision(e, S.lundi, 1, 40);
  assert.equal(ecartProduction(e, c), 500);
  const { complement } = deciderEcart(e, p, 'complement', h());
  assert.equal(cibleProduction(e, complement.id), 500);
  corrigerReel(e, p, 2500, h());
  assert.equal(ecartProduction(e, c), -500, 'surplus : écart négatif');
  assert.equal(cibleProduction(e, complement.id), 0);
});

test('etatTache : a_preciser, a_planifier, a_faire, en_cours, fait', () => {
  const { e, c, p } = unePrincipale();
  assert.equal(etatTache(e, p), 'a_planifier');
  planifier(e, p, S.lundi, h());
  assert.equal(etatTache(e, p), 'a_faire');
  demarrer(e, p, h());
  assert.equal(etatTache(e, p), 'en_cours');
  marquerFait(e, p, undefined, h());
  assert.equal(etatTache(e, p), 'fait');
  assert.throws(() => etatTache(e, 'inexistant'), /introuvable/);

  const inconnu = etatVide();
  const idInconnu = composantValide(inconnu, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  assert.equal(etatTache(inconnu, principaleDe(inconnu, idInconnu)), 'a_preciser');
  void c;
});

test('etatTache : écart si la cible change pendant la production, éteint par une décision valable pour la cible actuelle', () => {
  const { e, c, p } = unePrincipale();
  planifier(e, p, S.lundi, h());
  demarrer(e, p, h());
  assert.equal(e.productions[p].cibleAuDemarrage, 2000);
  prevision(e, S.lundi, 1, 60);
  assert.equal(etatTache(e, p), 'ecart');
  deciderEcart(e, p, 'ajustement', h());
  assert.equal(etatTache(e, p), 'en_cours');
  prevision(e, S.lundi, 1, 70);
  assert.equal(etatTache(e, p), 'ecart', 'la décision ne vaut que pour la cible décidée');
  void c;
});

test('etatTache : une modification de recette ou de composant ne touche ni le réel ni l\'instantané', () => {
  const { e, c, p } = unePrincipale();
  planifier(e, p, S.lundi, h());
  marquerFait(e, p, 1999, h());
  const avant = copie({ reel: e.productions[p].quantiteReelle, inst: e.productions[p].instantane, h: e.productions[p].hFait });
  modifierComposant(e, c, { grammage: { valeur: 500, statut: 'RESTAURANT_VALIDE' }, nom: 'PRODUIT_RENOMME_TEST' }, h(5));
  assert.deepEqual({ reel: e.productions[p].quantiteReelle, inst: e.productions[p].instantane, h: e.productions[p].hFait }, avant);
});

test('suggererJour : le jour du service, sans créneau ; « depuis » écarte le passé ; rien une fois faite', () => {
  const { e, p } = unePrincipale(S.lundiSuivant);
  const s = suggererJour(e, p);
  assert.deepEqual(Object.keys(s).sort(), ['date', 'evaluation']);
  assert.equal(s.date, S.lundiSuivant);
  assert.deepEqual([s.evaluation.jours, s.evaluation.autorisee, s.evaluation.couvre], [0, true, true]);
  assert.equal(suggererJour(e, p, S.lundiSuivant).date, S.lundiSuivant);
  assert.equal(suggererJour(e, p, ajouterJours(S.lundiSuivant, 1)), null, 'service passé : aucune date');
  // Production faite : plus de suggestion.
  marquerFait(e, p, 1, h());
  assert.equal(suggererJour(e, p), null);
});

test('suggererJour : la suggestion ne modifie rien et ne tient compte d\'aucun créneau', () => {
  const { e, p } = unePrincipale(S.mardiSuivant);
  const figee = copie(e);
  assert.equal(suggererJour(e, p).date, S.mardiSuivant);
  assert.deepEqual(e, figee);
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', avanceMaxJours: 3, limiteUtilisationJours: 1 }, h());
  assert.equal(suggererJour(e, p).date, S.mardiSuivant, 'le jour du service couvre toujours');
});

test('planifier / reporter : une date seule suffit ; refus (dimanche, après le service, déjà fait) et remise à planifier', () => {
  const { e, p } = unePrincipale(S.mardi);
  assert.throws(() => planifier(e, p, S.dimanche, h()), /dimanche/i);
  assert.throws(() => planifier(e, p, S.mercredi, h()), /après son service/);
  assert.throws(() => planifier(e, p, 'n importe quoi', h()), /Date invalide/);
  const r = planifier(e, p, S.lundi, h());
  assert.equal(r.evaluation.jours, 1);
  assert.ok(!r.alertes.some((a) => /créneau|capacité|chargé/.test(a)), 'aucune alerte de créneau ni de charge');
  assert.equal(e.productions[p].jourDecide, S.lundi);
  assert.equal('creneauDecide' in e.productions[p], false);
  assert.match(e.journal.at(-1).detail, / -> 2026-\d{2}-\d{2}$/, 'journal : la date seule');
  reporter(e, p, S.mardi, h());
  assert.equal(e.productions[p].jourDecide, S.mardi);
  reporter(e, p, null, h());
  assert.equal(e.productions[p].jourDecide, null);
  assert.equal(etatTache(e, p), 'a_planifier');
  marquerFait(e, p, 10, h());
  assert.throws(() => reporter(e, p, S.mardi, h()), /déjà faite/);
});

test('avancesPossibles : 4 jours, pas décidées pour un autre jour, sans créneau', () => {
  const e = etatVide();
  prevision(e, S.lundiSuivant, 1, 10);
  prevision(e, S.mardiSuivant, 1, 10);
  prevision(e, S.mercredi, 1, 10);
  const a = composantValide(e, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  const b = composantValide(e, S.mardiSuivant, 1, { ...J.PRODUIT_SEC_TEST, nom: 'B_TEST' });
  composantValide(e, '2026-10-16', 1, { ...J.PRODUIT_SEC_TEST, nom: 'LOIN_TEST' }); // plus de 4 jours
  const r = avancesPossibles(e, S.samedi);
  assert.deepEqual(r.map((x) => x.composantId), [a, b]);
  assert.equal(r[0].evaluation.jours, 2);
  assert.equal(r[0].evaluation.autorisee, true);
  assert.equal(r[1].evaluation.exception, true);
  assert.equal('creneau' in r[0], false);
  // Décidée pour un autre jour : exclue.
  planifier(e, principaleDe(e, a), S.samedi, h());
  assert.equal(avancesPossibles(e, S.samedi).length, 2, 'décidée pour ce jour : encore listée');
  reporter(e, principaleDe(e, a), S.lundiSuivant, h());
  assert.deepEqual(avancesPossibles(e, S.samedi).map((x) => x.composantId), [b]);
  // Dimanche : l'évaluation compte le dimanche comme jour de conservation (b : service mardi suivant, 2 jours).
  assert.deepEqual(avancesPossibles(e, S.dimanche).map((x) => [x.composantId, x.evaluation.jours]), [[b, 2]]);
});

test('feuilleDuJour : rubriques, décisions, revue de mi-semaine', () => {
  const e = etatVide();
  const { lecture, ...ancienneFeuille } = feuilleDuJour(e, S.mardi);
  assert.deepEqual(Object.keys(lecture).sort(), ['apres', 'autres', 'couverts', 'decisions', 'fiches', 'menus', 'pretsPlusTard', 'service1', 'service2'],
    'l\'ordre de lecture A-P1 s\'ajoute aux rubriques, il ne les remplace pas');
  assert.deepEqual(ancienneFeuille, {
    aFaire: [], dejaPret: [], decisions: [], quantitesManquantes: [], aAvancer: [], lots: [], attendus: [], avancement: { faites: 0, total: 0 }, revueMiSemaine: true,
  });
  assert.equal(feuilleDuJour(e, S.lundi).revueMiSemaine, false);
  assert.deepEqual(feuilleDuJour(e, S.dimanche).aFaire, []);

  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  // Non planifiée : une décision à prendre.
  let f = feuilleDuJour(e, S.mardi);
  assert.deepEqual(f.decisions.map((d) => [d.productionId, d.motif]), [[p, 'a_planifier']]);
  assert.equal(f.aAvancer.length, 1, 'avançable : le service est demain');
  planifier(e, p, S.mardi, h());
  f = feuilleDuJour(e, S.mardi);
  assert.equal(f.decisions.length, 0);
  assert.equal(f.aAvancer.length, 0, 'déjà dans « à faire aujourd\'hui »');
  assert.deepEqual(f.aFaire.map((t) => [t.productionId, t.cible, t.unite, t.dateService]), [[p, 1000 / 2, 'g', S.mercredi]]);
  assert.equal('creneauDecide' in f.aFaire[0], false);
  marquerFait(e, p, undefined, h());
  f = feuilleDuJour(e, S.mardi);
  assert.equal(f.aFaire.length, 0);
  assert.equal(f.dejaPret[0].evaluation.jours, 1);
  assert.equal(feuilleDuJour(e, S.jeudi).dejaPret.length, 0, 'service passé : plus « déjà prêt »');
  // Un écart sur une production faite est une décision à prendre.
  prevision(e, S.mercredi, 1, 20);
  assert.deepEqual(feuilleDuJour(e, S.mardi).decisions.map((d) => d.motif), ['ecart']);
});

test('feuilleDuJour : composant supprimé ignoré', () => {
  const { e, p } = unePrincipale(S.lundi);
  planifier(e, p, S.lundi, h());
  assert.equal(feuilleDuJour(e, S.lundi).aFaire.length, 1);
  delete e.composants[e.productions[p].composantId];
  assert.doesNotThrow(() => feuilleDuJour(e, S.lundi));
});

test('attribution : une modification de composant retire les productions non faites', () => {
  const { e, c, p } = unePrincipale();
  modifierComposant(e, c, { attribue: false }, h());
  assert.equal(e.productions[p], undefined);
});
