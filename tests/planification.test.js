import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterPreparatoire, definirCapacite, definirCreneau, definirRegle, definirSemaineType, demarrer, deciderEcart,
  marquerFait, planifier, reporter, corrigerReel, modifierComposant,
} from '../app/js/domaine/actions.js';
import {
  avancesPossibles, chargeCreneau, cibleProduction, ecartProduction, etatCreneau, etatTache, evaluerAvance,
  feuilleDuJour, regleDe, suggererCreneau,
} from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';

function unePrincipale(date = S.lundi, def = J.PRODUIT_SEC_TEST, portions = 40) {
  const e = etatVide();
  prevision(e, date, 1, portions);
  const c = composantValide(e, date, 1, def);
  return { e, c, p: principaleDe(e, c) };
}

test('etatCreneau : valeur du jour, sinon semaine type ; créneau inexistant indisponible', () => {
  const e = etatVide();
  assert.equal(etatCreneau(e, S.samedi, 'avant_soir'), 'libre');
  definirSemaineType(e, 6, 'avant_soir', 'charge', h());
  assert.equal(etatCreneau(e, S.samedi, 'avant_soir'), 'charge');
  definirCreneau(e, S.samedi, 'avant_soir', 'libre', h());
  assert.equal(etatCreneau(e, S.samedi, 'avant_soir'), 'libre', 'le jour prime');
  definirCreneau(e, S.samedi, 'avant_soir', null, h());
  assert.equal(etatCreneau(e, S.samedi, 'avant_soir'), 'charge', 'null = retour à la semaine type');
  assert.equal(etatCreneau(e, S.lundi, 'avant_soir'), 'indisponible');
  assert.equal(etatCreneau(e, S.dimanche, 'avant_midi'), 'indisponible');
  assert.throws(() => definirCreneau(e, S.lundi, 'avant_soir', 'charge', h()), /n'existe pas/);
  assert.throws(() => definirSemaineType(e, 2, 'avant_soir', 'charge', h()), /n'existe pas/);
  assert.throws(() => definirSemaineType(e, 7, 'avant_midi', 'charge', h()), /1 \(lundi\)/);
  assert.throws(() => definirCreneau(e, S.samedi, 'avant_soir', 'occupe', h()), /inconnue/);
});

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
  planifier(e, p, S.lundi, 'avant_midi', h());
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
  planifier(e, p, S.lundi, 'avant_midi', h());
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
  planifier(e, p, S.lundi, 'avant_midi', h());
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
  planifier(e, p, S.lundi, 'avant_midi', h());
  marquerFait(e, p, 1999, h());
  const avant = copie({ reel: e.productions[p].quantiteReelle, inst: e.productions[p].instantane, h: e.productions[p].hFait });
  modifierComposant(e, c, { grammage: { valeur: 500, statut: 'RESTAURANT_VALIDE' }, nom: 'PRODUIT_RENOMME_TEST' }, h(5));
  assert.deepEqual({ reel: e.productions[p].quantiteReelle, inst: e.productions[p].instantane, h: e.productions[p].hFait }, avant);
});

test('chargeCreneau : points, non estimées, capacité facultative, alertes sans minutes', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const ids = [J.PRODUIT_SEC_TEST, J.PRODUIT_CRU_TEST, J.PREPARATION_TEST, J.COMPOSANT_VAGUE_TEST]
    .map((d) => principaleDe(e, composantValide(e, S.mercredi, 1, d)));
  for (const id of ids) planifier(e, id, S.mardi, 'apres_midi', h());
  let c = chargeCreneau(e, S.mardi, 'apres_midi');
  assert.deepEqual([c.courtes, c.moyennes, c.longues, c.nonEstimees, c.points], [1, 1, 1, 1, 6]);
  assert.equal(c.capacite, null);
  assert.equal(c.surcharge, false);
  definirCapacite(e, 5, h());
  c = chargeCreneau(e, S.mardi, 'apres_midi');
  assert.equal(c.surcharge, true);
  assert.ok(c.alertes.some((a) => a.includes('capacité')));
  assert.equal(chargeCreneau(e, S.mardi, 'avant_midi').points, 0);
  // Une production faite ne pèse plus sur le créneau.
  marquerFait(e, ids[2], undefined, h());
  assert.equal(chargeCreneau(e, S.mardi, 'apres_midi').longues, 0);
  // Alerte si une production est décidée sur un créneau chargé ou indisponible.
  definirCreneau(e, S.mardi, 'apres_midi', 'indisponible', h());
  assert.ok(chargeCreneau(e, S.mardi, 'apres_midi').alertes.some((a) => a.includes('indisponible')));
  assert.equal(JSON.stringify(chargeCreneau(e, S.mardi, 'apres_midi')).toLowerCase().includes('minute'), false);
  assert.throws(() => definirCapacite(e, 0, h()), /supérieur ou égal à 1/);
  definirCapacite(e, null, h());
  assert.equal(chargeCreneau(e, S.mardi, 'apres_midi').surcharge, false);
});

test('suggererCreneau : service avant midi, remonte, tient compte de la capacité, jamais dimanche', () => {
  const { e, p } = unePrincipale(S.lundiSuivant);
  assert.deepEqual([suggererCreneau(e, p).date, suggererCreneau(e, p).creneau], [S.lundiSuivant, 'avant_midi']);
  definirCreneau(e, S.lundiSuivant, 'avant_midi', 'charge', h());
  const s = suggererCreneau(e, p);
  assert.deepEqual([s.date, s.creneau], [S.samedi, 'avant_soir'], 'le dimanche est sauté');
  assert.equal(s.evaluation.jours, 2);
  assert.equal(s.evaluation.conservation, 'a_confirmer');
  // Capacité : le créneau déjà plein est écarté.
  definirCapacite(e, 1, h());
  const autre = composantValide(e, S.lundiSuivant, 1, { ...J.PRODUIT_CRU_TEST, nom: 'AUTRE_TEST' }); // charge moyenne = 2 points
  void autre;
  assert.equal(suggererCreneau(e, p).creneau, 'avant_soir'); // 1 point (courte) ≤ capacité 1
  planifier(e, principaleDe(e, composantValide(e, S.lundiSuivant, 1, { ...J.PRODUIT_SEC_TEST, nom: 'BIS_TEST' })), S.samedi, 'avant_soir', h());
  const s2 = suggererCreneau(e, p);
  assert.deepEqual([s2.date, s2.creneau], [S.samedi, 'apres_midi']);
  // Production faite : plus de suggestion.
  marquerFait(e, p, 1, h());
  assert.equal(suggererCreneau(e, p), null);
});

test('suggererCreneau : une règle plus permissive allonge la fenêtre, jamais sans limite validée', () => {
  const { e, p } = unePrincipale(S.mardiSuivant);
  definirCreneau(e, S.mardiSuivant, 'avant_midi', 'charge', h());
  definirCreneau(e, S.lundiSuivant, 'apres_midi', 'indisponible', h());
  definirCreneau(e, S.lundiSuivant, 'avant_midi', 'indisponible', h());
  for (const c of ['avant_soir', 'apres_midi', 'avant_midi']) definirCreneau(e, S.samedi, c, 'charge', h());
  assert.equal(suggererCreneau(e, p), null, 'samedi pour mardi = 3 jours, hors fenêtre');
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', avanceMaxJours: 3, limiteUtilisationJours: 3 }, h());
  assert.equal(suggererCreneau(e, p), null, 'samedi chargé');
  definirCreneau(e, S.samedi, 'apres_midi', 'libre', h());
  const s = suggererCreneau(e, p);
  assert.deepEqual([s.date, s.creneau, s.evaluation.autorisee], [S.samedi, 'apres_midi', true]);
  // Limite d'utilisation trop courte : l'avance ne couvre pas, pas de suggestion.
  definirRegle(e, { nom: 'PRODUIT_SEC_TEST', avanceMaxJours: 3, limiteUtilisationJours: 1 }, h());
  assert.equal(suggererCreneau(e, p), null);
});

test('planifier / reporter : refus (dimanche, créneau, après le service, déjà fait) et remise à planifier', () => {
  const { e, p } = unePrincipale(S.mardi);
  assert.throws(() => planifier(e, p, S.dimanche, 'avant_midi', h()), /dimanche/i);
  assert.throws(() => planifier(e, p, S.mercredi, 'avant_midi', h()), /après son service/);
  assert.throws(() => planifier(e, p, 'n importe quoi', 'avant_midi', h()), /Date invalide/);
  const r = planifier(e, p, S.lundi, 'apres_midi', h());
  assert.equal(r.evaluation.jours, 1);
  reporter(e, p, S.mardi, 'avant_midi', h());
  assert.equal(e.productions[p].jourDecide, S.mardi);
  reporter(e, p, null, null, h());
  assert.equal(etatTache(e, p), 'a_planifier');
  marquerFait(e, p, 10, h());
  assert.throws(() => reporter(e, p, S.mardi, 'avant_midi', h()), /déjà faite/);
});

test('avancesPossibles : 4 jours, pas décidées pour un autre jour, premier créneau libre après service', () => {
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
  assert.equal(r[0].creneau, 'apres_midi');
  definirCreneau(e, S.samedi, 'apres_midi', 'charge', h());
  assert.equal(avancesPossibles(e, S.samedi)[0].creneau, 'avant_soir');
  definirCreneau(e, S.samedi, 'avant_soir', 'indisponible', h());
  assert.equal(avancesPossibles(e, S.samedi)[0].creneau, null);
  // Décidée pour un autre jour : exclue.
  planifier(e, principaleDe(e, a), S.samedi, 'avant_midi', h());
  assert.equal(avancesPossibles(e, S.samedi).length, 2, 'décidée pour ce jour : encore listée');
  reporter(e, principaleDe(e, a), S.lundiSuivant, 'avant_midi', h());
  assert.deepEqual(avancesPossibles(e, S.samedi).map((x) => x.composantId), [b]);
  // Dimanche : aucun créneau, mais l'évaluation compte le dimanche comme jour de conservation.
  assert.equal(avancesPossibles(e, S.dimanche)[0].creneau, null);
});

test('feuilleDuJour : rubriques, créneaux, décisions, revue de mi-semaine', () => {
  const e = etatVide();
  assert.deepEqual(feuilleDuJour(e, S.mardi), {
    aFaire: [{ creneau: 'avant_midi', etatCreneau: 'libre', charge: chargeCreneau(e, S.mardi, 'avant_midi'), taches: [] },
      { creneau: 'apres_midi', etatCreneau: 'libre', charge: chargeCreneau(e, S.mardi, 'apres_midi'), taches: [] }],
    dejaPret: [], decisions: [], aAvancer: [], attendus: [], revueMiSemaine: true,
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
  planifier(e, p, S.mardi, 'apres_midi', h());
  f = feuilleDuJour(e, S.mardi);
  assert.equal(f.decisions.length, 0);
  assert.equal(f.aAvancer.length, 0, 'déjà dans « à faire aujourd\'hui »');
  assert.deepEqual(f.aFaire[1].taches.map((t) => [t.productionId, t.cible, t.unite, t.dateService]), [[p, 1000 / 2, 'g', S.mercredi]]);
  marquerFait(e, p, undefined, h());
  f = feuilleDuJour(e, S.mardi);
  assert.equal(f.aFaire.flatMap((g) => g.taches).length, 0);
  assert.equal(f.dejaPret[0].evaluation.jours, 1);
  assert.equal(feuilleDuJour(e, S.jeudi).dejaPret.length, 0, 'service passé : plus « déjà prêt »');
  // Un écart sur une production faite est une décision à prendre.
  prevision(e, S.mercredi, 1, 20);
  assert.deepEqual(feuilleDuJour(e, S.mardi).decisions.map((d) => d.motif), ['ecart']);
});

test('feuilleDuJour : tâche sans créneau valide regroupée à part ; composant supprimé ignoré', () => {
  const { e, p } = unePrincipale(S.lundi);
  planifier(e, p, S.lundi, 'avant_midi', h());
  e.productions[p].creneauDecide = null; // donnée importée incomplète
  const g = feuilleDuJour(e, S.lundi).aFaire.find((x) => x.creneau === null);
  assert.equal(g.taches.length, 1);
  delete e.composants[e.productions[p].composantId];
  assert.doesNotThrow(() => feuilleDuJour(e, S.lundi));
});

test('attribution : une modification de composant retire les productions non faites', () => {
  const { e, c, p } = unePrincipale();
  modifierComposant(e, c, { attribue: false }, h());
  assert.equal(e.productions[p], undefined);
});
