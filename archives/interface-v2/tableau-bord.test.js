// Tableau de bord : la fonction pure `tableauDeBord(etat, aujourdhui)` et la règle partagée `decisionsSansDoublon`.
// Jeux de test TEST_ONLY uniquement, aux noms neutres.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterPreparatoire, controlerProduit, creerFiche, definirAchat, definirCreneau, definirFournisseur,
  deciderEcart, planifier, annulerFiche, confirmerSemaineType,
} from '../app/js/domaine/actions.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { decisionsSansDoublon, tableauDeBord } from '../app/js/domaine/tableau-bord.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe } from './aide.js';
import { etatReglette } from './aide-tableau.js';

const ZERO = { a_decider: 0, a_faire: 0, en_cours: 0, non_couvert: 0, pret: 0, total: 0 };
const symboles = (tb) => tb.miseEnPlace.taches.map((t) => t.symbole);
const parNom = (tb, nom) => tb.miseEnPlace.taches.find((t) => t.nom === nom);

test('base vide : un lundi, tout est vide et rien ne plante', () => {
  const tb = tableauDeBord(etatVide(), S.lundi);
  assert.equal(tb.date, S.lundi);
  assert.equal(tb.ferme, false);
  assert.equal(tb.jourService, S.lundi);
  assert.equal(tb.aMenu, true);
  assert.equal(tb.menus.length, 2);
  for (const m of tb.menus) {
    assert.equal(m.saisi, false);
    assert.equal(m.intitule, '');
    assert.equal(m.portions.total, 0);
    assert.equal(m.portions.previsionManquante, true);
  }
  assert.deepEqual(tb.miseEnPlace, { taches: [], compte: ZERO });
  assert.deepEqual(tb.creneaux.map((c) => c.creneau), ['avant_midi', 'apres_midi']);
  for (const c of tb.creneaux) {
    assert.equal(c.etatCreneau, 'libre');
    assert.equal(c.nbTaches, 0);
    assert.equal(c.charge.points, 0);
  }
  assert.deepEqual([tb.decisions, tb.aAvancer, tb.attendus, tb.fiches], [[], [], [], []]);
  assert.deepEqual(tb.commandes, {
    total: 0, aVerifier: 0, aReverifier: 0, aCommander: 0, suffisant: 0,
    echeanceDepassee: 0, echeanceAujourdhui: 0, delaiARenseigner: 0, nonChiffrables: 0,
  });
  assert.equal(tb.semaines.length, 1);
  assert.equal(tb.semaines[0].lundi, S.lundi);
  assert.equal(tb.semaines[0].jours.length, 7);
  assert.deepEqual(tb.pointsGlobaux.map((p) => p.type), ['semaine_type']);
  assert.deepEqual(tableauDeBord(etatVide(), S.lundi), tb, 'même entrée, même sortie (fonction pure)');
});

test('le point global disparaît une fois la semaine type confirmée', () => {
  const e = etatVide();
  confirmerSemaineType(e, h());
  assert.deepEqual(tableauDeBord(e, S.lundi).pointsGlobaux, []);
});

test('dimanche : fermé, le jour de service est le lundi, aucun créneau', () => {
  const e = etatVide();
  menuValide(e, S.lundi, 1, 'INTITULE_TEST_1');
  prevision(e, S.lundi, 1, 40);
  const tb = tableauDeBord(e, S.dimanchePrecedent);
  assert.equal(tb.ferme, true);
  assert.equal(tb.date, S.dimanchePrecedent);
  assert.equal(tb.jourService, S.lundi);
  assert.equal(tb.aMenu, true);
  assert.deepEqual(tb.creneaux, []);
  assert.equal(tb.menus[0].saisi, true);
  assert.equal(tb.menus[0].intitule, 'INTITULE_TEST_1');
  assert.equal(tb.menus[0].portions.total, 40);
  assert.equal(tb.menus[1].saisi, false);
  assert.equal(tb.semaines.length, 1, 'le dimanche n\'ouvre pas la semaine suivante');
  const jours = tb.semaines[0].jours;
  assert.equal(jours[6].date, S.dimanchePrecedent);
  assert.equal(jours[6].ouvert, false);
  assert.equal(jours[6].estAujourdhui, true);
});

test('dimanche : les commandes et la mise en place portent sur la semaine du lundi à venir', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const tb = tableauDeBord(e, S.dimanchePrecedent);
  assert.equal(tb.commandes.total, 1);
  assert.deepEqual(tb.miseEnPlace.taches.map((t) => t.composantId), [id]);
});

test('samedi : pas de menu du jour, aucun menu listé, trois créneaux, deux semaines', () => {
  const tb = tableauDeBord(etatVide(), S.samediPrecedent);
  assert.equal(tb.ferme, false);
  assert.equal(tb.jourService, S.samediPrecedent);
  assert.equal(tb.aMenu, false);
  assert.deepEqual(tb.menus, []);
  assert.deepEqual(tb.creneaux.map((c) => c.creneau), ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.equal(tb.semaines.length, 2);
});

test('vendredi : la semaine en cours et la suivante, chacune de sept jours', () => {
  const e = etatVide();
  menuValide(e, S.lundiSuivant, 1, 'INTITULE_TEST_1');
  menuValide(e, S.lundiSuivant, 2, 'INTITULE_TEST_2');
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundiSuivant, service: 'midi', couverts: 5, mode: 'menu_fixe', menuFixe: 1 }, h());
  const tb = tableauDeBord(e, S.vendredi);
  assert.equal(tb.semaines.length, 2);
  assert.deepEqual(tb.semaines.map((s) => s.lundi), [S.lundi, S.lundiSuivant]);
  for (const s of tb.semaines) assert.equal(s.jours.length, 7);
  assert.equal(tb.semaines[0].jours.filter((j) => j.estAujourdhui).length, 1);
  assert.equal(tb.semaines[0].jours[4].date, S.vendredi);
  assert.equal(tb.semaines[0].jours[4].estAujourdhui, true);
  assert.equal(tb.semaines[1].jours.some((j) => j.estAujourdhui), false);
  const lundiSuivant = tb.semaines[1].jours[0];
  assert.equal(lundiSuivant.menusSaisis, 2);
  assert.equal(lundiSuivant.nbFiches, 1);
  assert.ok(lundiSuivant.nbPoints > 0, 'prévisions manquantes : points à confirmer');
  assert.equal(tb.semaines[1].jours[6].ouvert, false);
  // Les autres jours de la semaine en cours : ni semaine suivante le lundi ni le mercredi.
  assert.equal(tableauDeBord(e, S.lundi).semaines.length, 1);
  assert.equal(tableauDeBord(e, S.mercredi).semaines.length, 1);
});

test('réglette : chaque symbole, dont non_couvert, avec le tri à décider, à faire, en cours, non couvert, prêt', () => {
  const { e, ids, jour } = etatReglette();
  const avantDecision = () => {
    const copie = structuredClone(e);
    copie.productions[principaleDe(copie, ids.nonCouvert)].decisionEcart = null;
    return copie;
  };
  const tb = tableauDeBord(e, jour);
  const tache = (nom) => parNom(tb, nom);
  assert.equal(tache('ELEMENT_PRET_TEST').symbole, 'pret');
  assert.equal(tache('ELEMENT_PRET_TEST').etat, 'fait');
  assert.equal(tableauDeBord(avantDecision(), jour).miseEnPlace.taches.find((t) => t.nom === 'ELEMENT_HORS_LIMITE_TEST').symbole, 'a_decider', 'avant la décision : écart à arbitrer');
  assert.equal(tache('ELEMENT_HORS_LIMITE_TEST').symbole, 'non_couvert');
  assert.equal(tache('ELEMENT_HORS_LIMITE_TEST').etat, 'fait');
  assert.equal(tache('ELEMENT_EN_COURS_TEST').symbole, 'en_cours');
  assert.equal(tache('ELEMENT_A_FAIRE_TEST').symbole, 'a_faire');
  assert.equal(tache('ELEMENT_A_PLANIFIER_TEST').symbole, 'a_decider');
  assert.equal(tache('ELEMENT_A_PLANIFIER_TEST').etat, 'a_planifier');
  assert.equal(tache('ELEMENT_A_PRECISER_TEST').symbole, 'a_decider');
  assert.equal(tache('ELEMENT_A_PRECISER_TEST').etat, 'a_preciser');
  assert.equal(tache('ELEMENT_ECART_TEST').symbole, 'a_decider');
  assert.equal(tache('ELEMENT_ECART_TEST').etat, 'ecart');
  assert.deepEqual(tb.miseEnPlace.compte, { a_decider: 3, a_faire: 1, en_cours: 1, non_couvert: 1, pret: 1, total: 7 });
  assert.deepEqual(symboles(tb), ['a_decider', 'a_decider', 'a_decider', 'a_faire', 'en_cours', 'non_couvert', 'pret']);
  for (const t of tb.miseEnPlace.taches) {
    assert.deepEqual(Object.keys(t), ['productionId', 'composantId', 'nom', 'genre', 'etat', 'symbole']);
    assert.equal(t.genre, 'principale');
  }
});

test('réglette : tri stable, un complément compte, une préparatoire et un autre jour sont exclus', () => {
  const { e, ids, jour } = etatReglette();
  const avant = tableauDeBord(e, jour).miseEnPlace.taches.filter((t) => t.symbole === 'a_decider').map((t) => t.nom);
  assert.deepEqual(avant, [...avant].sort((a, b) => avant.indexOf(a) - avant.indexOf(b)));
  const ordreProductions = Object.values(e.productions).filter((p) => p.dateService === jour && avant.includes(e.composants[p.composantId].nom))
    .map((p) => e.composants[p.composantId].nom);
  assert.deepEqual(avant, ordreProductions, 'à rang égal, l\'ordre des productions est conservé');

  deciderEcart(e, principaleDe(e, ids.ecart), 'complement', h());
  ajouterPreparatoire(e, ids.aFaire, 'ACTION_TEST', h());
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_AUTRE_JOUR_TEST' });
  const tb = tableauDeBord(e, jour);
  assert.equal(tb.miseEnPlace.compte.total, 8, 'le complément est ajouté, rien d\'autre');
  assert.equal(tb.miseEnPlace.taches.filter((t) => t.genre === 'complement').length, 1);
  assert.equal(tb.miseEnPlace.taches.some((t) => t.nom === 'ELEMENT_AUTRE_JOUR_TEST'), false);
  assert.equal(tb.miseEnPlace.taches.some((t) => t.genre === 'preparatoire'), false);
  const complement = tb.miseEnPlace.taches.find((t) => t.genre === 'complement');
  assert.equal(complement.nom, 'ELEMENT_ECART_TEST');
  assert.equal(complement.symbole, 'a_decider', 'complément non planifié');
});

test('créneaux : état, charge en points et nombre de tâches, issus de chargeCreneau', () => {
  const { e, ids, jour } = etatReglette();
  definirCreneau(e, jour, 'apres_midi', 'charge', h());
  planifier(e, principaleDe(e, ids.aDecider1), jour, 'avant_midi', h()); // courte : 1 point
  planifier(e, principaleDe(e, ids.enCours), jour, 'avant_midi', h()); // moyenne : 2 points
  const tb = tableauDeBord(e, jour);
  assert.deepEqual(tb.creneaux.map((c) => c.creneau), ['avant_midi', 'apres_midi', 'avant_soir']);
  const matin = tb.creneaux[0];
  assert.equal(matin.etatCreneau, 'libre');
  assert.equal(matin.charge.points, 1 + 2 + 1, 'à faire, à planifier devenue décidée et en cours : 1 + 1 + 2');
  assert.equal(matin.nbTaches, 3);
  assert.equal(tb.creneaux[1].etatCreneau, 'charge');
  assert.equal(tb.creneaux[1].nbTaches, 0);
});

test('à décider et à avancer : aucun doublon, et les autres motifs restent', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const planifiable = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_A_PLANIFIER_TEST' });
  const imprecis = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_A_PRECISER_TEST', grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  const brute = feuilleDuJour(e, S.veille);
  const motifsBruts = brute.decisions.map((d) => `${d.composantId === planifiable ? 'planifiable' : 'imprecis'}:${d.motif}`).sort();
  assert.deepEqual(motifsBruts, ['imprecis:a_preciser', 'planifiable:a_planifier'], 'sans la règle, la tâche à planifier est en double');
  assert.ok(brute.aAvancer.some((a) => a.composantId === planifiable), 'la tâche à planifier est aussi proposée à avancer');

  const tb = tableauDeBord(e, S.veille);
  assert.deepEqual(tb.decisions.map((d) => d.composantId), [imprecis]);
  assert.equal(tb.decisions[0].motif, 'a_preciser');
  assert.ok(tb.aAvancer.some((a) => a.composantId === planifiable));
  const ids = new Set(tb.aAvancer.map((a) => a.productionId));
  assert.equal(tb.decisions.some((d) => d.motif === 'a_planifier' && ids.has(d.productionId)), false);
  assert.deepEqual(decisionsSansDoublon(brute), tb.decisions, 'même règle que la feuille du jour');
});

test('attendus : une tâche décidée un jour antérieur apparaît le jour de service', () => {
  const { e, ids } = etatReglette();
  planifier(e, principaleDe(e, ids.aDecider1), S.veille, 'avant_midi', h());
  // Le lundi 5 : une tâche décidée la veille ouvrée (samedi 3) pour un service du lundi.
  prevision(e, S.lundi, 1, 30);
  const lundi = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_ATTENDU_TEST' });
  planifier(e, principaleDe(e, lundi), S.samediPrecedent, 'apres_midi', h());
  const tb = tableauDeBord(e, S.lundi);
  assert.deepEqual(tb.attendus.map((a) => a.composantId), [lundi]);
});

test('fiches : seulement les fiches actives du jour de service, avec le drapeau d\'allergie', () => {
  const e = etatVide();
  const a = creerFiche(e, { numero: 'FICHE_TEST_2', date: S.lundi, service: 'soir', horaire: '19:30', couverts: 8, mode: 'hors_menu' }, h());
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre', repartition: { 1: 10, 2: 10 }, allergies: 'ALLERGIE_TEST' }, h());
  const annulee = creerFiche(e, { numero: 'FICHE_TEST_3', date: S.lundi, service: 'midi', couverts: 3, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e, { numero: 'FICHE_TEST_4', date: S.mardi, service: 'midi', couverts: 3, mode: 'menu_fixe', menuFixe: 1 }, h());
  annulerFiche(e, annulee, h());
  const tb = tableauDeBord(e, S.lundi);
  assert.deepEqual(tb.fiches.map((f) => f.numero), ['FICHE_TEST_1', 'FICHE_TEST_2'], 'triées par horaire');
  assert.deepEqual(tb.fiches[0], { id: tb.fiches[0].id, numero: 'FICHE_TEST_1', service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre', aAllergies: true });
  assert.equal(tb.fiches[1].id, a);
  assert.equal(tb.fiches[1].aAllergies, false);
  assert.equal(tb.menus[0].portions.groupesProvisoires, 10, 'les portions de groupe passent par portionsMenu');
});

test('commandes : compteurs par statut affiché et échéances, seulement pour les lignes à traiter', () => {
  const e = etatVide();
  const lundi = S.lundi;
  prevision(e, lundi, 1, 40);
  prevision(e, lundi, 2, 10);
  const f1 = definirFournisseur(e, { nom: 'FOURNISSEUR_TEST_1', delaiJours: 1 }, h()); // limite le 4 : aujourd'hui
  const f3 = definirFournisseur(e, { nom: 'FOURNISSEUR_TEST_3', delaiJours: 3 }, h()); // limite le 2 : dépassée
  const produit = (menu, nom) => composantValide(e, lundi, menu, J.PRODUIT_SEC_TEST, { nom });
  produit(1, 'PRODUIT_A_TEST'); produit(1, 'PRODUIT_B_TEST'); produit(1, 'PRODUIT_C_TEST'); produit(1, 'PRODUIT_D_TEST');
  produit(2, 'PRODUIT_E_TEST');
  composantValide(e, lundi, 2, J.COMPOSANT_VAGUE_TEST);
  controlerProduit(e, lundi, 'produit_e_test', 'g', 'a_commander', 10, h());
  prevision(e, lundi, 2, 14); // le besoin de E change après le contrôle : à revérifier
  controlerProduit(e, lundi, 'produit_a_test', 'g', 'a_commander', 10, h());
  controlerProduit(e, lundi, 'produit_b_test', 'g', 'a_commander', 10, h());
  controlerProduit(e, lundi, 'produit_d_test', 'g', 'suffisant', 1000000, h());
  definirAchat(e, lundi, 'produit_a_test', 'g', { fournisseurId: f1 }, h());
  definirAchat(e, lundi, 'produit_b_test', 'g', { fournisseurId: f3 }, h());
  definirAchat(e, lundi, 'produit_d_test', 'g', { fournisseurId: f3 }, h());

  const tb = tableauDeBord(e, S.dimanchePrecedent);
  assert.deepEqual(tb.commandes, {
    total: 5, aVerifier: 1, aReverifier: 1, aCommander: 2, suffisant: 1,
    echeanceDepassee: 1, echeanceAujourdhui: 1, delaiARenseigner: 2, nonChiffrables: 1,
  });
  // La veille de la limite du premier fournisseur : plus rien n'est dépassé ni à commander aujourd'hui.
  const plusTot = tableauDeBord(e, '2026-10-01');
  assert.equal(plusTot.commandes.echeanceDepassee, 0);
  assert.equal(plusTot.commandes.echeanceAujourdhui, 0);
  // La ligne « suffisante » ne compte jamais d'échéance.
  assert.equal(tb.commandes.echeanceDepassee + tb.commandes.echeanceAujourdhui + tb.commandes.delaiARenseigner, 4);
});

test('semaine : points à confirmer, menus saisis et fiches par jour', () => {
  const e = etatVide();
  menuValide(e, S.mardi, 1, 'INTITULE_TEST_1'); // prévision manquante : un point
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.mardi, service: 'midi', couverts: 4, mode: 'menu_fixe', menuFixe: 1 }, h());
  const mardi = tableauDeBord(e, S.lundi).semaines[0].jours[1];
  assert.equal(mardi.date, S.mardi);
  assert.equal(mardi.menusSaisis, 1);
  assert.equal(mardi.nbFiches, 1);
  assert.ok(mardi.nbPoints >= 1);
  assert.equal(tableauDeBord(e, S.lundi).semaines[0].jours[0].estAujourdhui, true);
  assert.deepEqual(tableauDeBord(e, S.lundi).semaines[0].jours.map((j) => j.ouvert), [true, true, true, true, true, true, false]);
});
