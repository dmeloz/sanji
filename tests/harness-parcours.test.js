// Premier parcours vertical : menus validés → composants du poste → calcul → proposition de planning → contrôles →
// brouillon → validation du chef → enregistrement contrôlé. Données TEST_ONLY uniquement.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirRegle, planifier } from '../app/js/domaine/actions.js';
import { suggererJour } from '../app/js/domaine/planification.js';
import { CODES, ErreurHarness, ORIGINES, STATUTS_PROPOSITION } from '../app/js/harness/contrats.js';
import { appliquerProposition, decider } from '../app/js/harness/commandes.js';
import { fournisseurDesactive } from '../app/js/harness/fournisseur.js';
import { MAX_ITERATIONS, proposerPlanningAssiste } from '../app/js/harness/orchestrateur.js';
import { creerRegistre, empreinteEtat } from '../app/js/harness/propositions.js';
import { expliquer } from '../app/js/harness/trace.js';
import { controlerBrouillon } from '../app/js/harness/validateur.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { ATTENTE, executeurDe, fournisseurScripte } from './aide-harness.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';

const AUJOURDHUI = S.veille;
const INCONNU = { valeur: null, unite: 'g', statut: 'INCONNU', source: '' };

/** Lundi : un féculent (menu 1, garniture) et une protéine (menu 2). */
function lundi() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  prevision(e, S.lundi, 2, 30);
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const cru = composantValide(e, S.lundi, 2, J.PRODUIT_CRU_TEST);
  return { e, sec, cru, pSec: principaleDe(e, sec), pCru: principaleDe(e, cru) };
}

function demande(ref, registre, extra = {}) {
  return { etat: ref.etat, h: h(50), aujourdhui: AUJOURDHUI, dateDebut: S.lundi, dateFin: S.lundi, registre, ...extra };
}

const brouillon = (items, plus = {}) => ({ type: 'brouillon', brouillon: { type: 'planning', items, ...plus } });

test('sans modèle : un brouillon déterministe, expliqué, sans aucune écriture dans l\'état', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const avant = copie(e);
  const { proposition, mode, avertissements } = await proposerPlanningAssiste(demande(ref, creerRegistre()));
  assert.equal(mode, 'deterministe');
  assert.deepEqual(avertissements, []);
  assert.deepEqual(ref.etat, avant, 'proposer ne modifie rien');
  assert.equal(proposition.statut, STATUTS_PROPOSITION.BROUILLON);
  assert.equal(proposition.origine, ORIGINES.DETERMINISTE);
  assert.deepEqual(proposition.items.map((i) => i.productionId).sort(), [pSec, pCru].sort());
  for (const i of proposition.items) {
    assert.equal(i.date, S.lundi);
    assert.equal(i.creneau, undefined, 'plus de créneau (v134)');
    assert.equal(i.quantite.statut, 'CALCULE');
    assert.ok(i.quantite.libelle);
    assert.equal(i.exigeConfirmation, false);
  }
  assert.ok(proposition.sources.length >= 3 && Array.isArray(proposition.hypotheses));
  assert.ok(!JSON.stringify(proposition).toLowerCase().includes('créneau'), 'plus aucune mention de créneau');
  assert.ok(proposition.controles.every((c) => c.ok));
  assert.ok(expliquer(proposition).some((l) => l.startsWith('Origine : calcul déterministe')));
});

test('validation puis enregistrement : seule la décision du chef planifie, tout est tracé dans le journal', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));

  assert.equal(ref.etat.productions[pSec].jourDecide, null, 'avant validation : rien n\'est planifié');
  assert.equal(appliquerProposition(registre, proposition.id, { executeur }).code, CODES.STATUT_INCOMPATIBLE, 'non validée : refus');
  assert.equal(ref.etat.productions[pSec].jourDecide, null);

  const validee = decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  assert.equal(validee.statut, STATUTS_PROPOSITION.VALIDEE);
  assert.equal(validee.decision.par, 'chef');
  assert.equal(ref.etat.productions[pSec].jourDecide, null, 'valider ne planifie pas encore');

  const r = appliquerProposition(registre, proposition.id, { executeur });
  assert.equal(r.ok, true);
  assert.deepEqual([...r.appliques].sort(), [pSec, pCru].sort());
  for (const id of [pSec, pCru]) assert.equal(ref.etat.productions[id].jourDecide, S.lundi);
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.APPLIQUEE);
  const actions = ref.etat.journal.map((x) => x.action);
  assert.ok(actions.includes('harness:validee') && actions.includes('harness:appliquee') && actions.includes('planifier'));
  assert.ok(ref.etat.journal.find((x) => x.action === 'harness:validee').detail.startsWith('correction_humaine|'));

  const encore = appliquerProposition(registre, proposition.id, { executeur });
  assert.deepEqual([encore.ok, encore.code], [false, CODES.STATUT_INCOMPATIBLE], 'double exécution refusée');
});

test('refus du chef : la proposition ne peut plus être appliquée ni validée, l\'état reste intact', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'refuser', raison: 'autre organisation' }, { executeur });
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.REFUSEE);
  assert.equal(appliquerProposition(registre, proposition.id, { executeur }).ok, false);
  assert.throws(() => decider(registre, proposition.id, { choix: 'valider' }, { executeur }), (x) => x.code === CODES.STATUT_INCOMPATIBLE);
  assert.throws(() => decider(registre, 'prop-absente', { choix: 'valider' }, { executeur }), ErreurHarness);
  assert.throws(() => decider(registre, proposition.id, { choix: 'autre' }, { executeur }), ErreurHarness);
  assert.equal(ref.etat.productions[pSec].jourDecide, null);
  const trace = ref.etat.journal.find((x) => x.action === 'harness:refusee');
  assert.ok(trace);
  assert.ok(!trace.detail.includes('autre organisation'), 'le texte libre du chef n\'entre pas dans le journal');
  assert.equal(registre.lire(proposition.id).decision.raison, 'autre organisation', 'la raison reste dans la proposition en mémoire');
});

test('decider : décision absente ou choix inconnu refusés avec un code exact, erreurs du registre non maquillées', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  assert.throws(() => decider(registre, proposition.id, null, { executeur }), (x) => x.code === CODES.ENTREE_INVALIDE);
  assert.throws(() => decider(registre, 'prop-absente', { choix: 'valider' }, { executeur }), (x) => x.code === CODES.PROPOSITION_INCONNUE);
  assert.throws(() => decider(registre, proposition.id, { choix: 'valider', itemsConfirmes: ['x'] }, { executeur }), (x) => x.code === CODES.REFERENCE_INCONNUE);
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.BROUILLON, 'un échec ne change pas le statut');
});

test('application : les contrôles sont rejoués sur l\'état courant (jour devenu passé, catégorie changée)', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  const avant = copie(ref.etat);
  const r = appliquerProposition(registre, proposition.id, { executeur, aujourdhui: S.mardi });
  assert.deepEqual([r.ok, r.code], [false, CODES.CONFLIT]);
  assert.match(r.message, /plus valide : .*déjà passé/);
  assert.deepEqual(ref.etat, avant);
  assert.equal(ref.etat.productions[pSec].jourDecide, null);
});

test('registre : un refus ne peut pas être « marqué » validé ni appliqué ; transitions limitées', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'refuser' }, { executeur });
  assert.throws(() => registre.marquer(proposition.id, STATUTS_PROPOSITION.VALIDEE), (x) => x.code === CODES.STATUT_INCOMPATIBLE);
  assert.throws(() => registre.marquer(proposition.id, STATUTS_PROPOSITION.APPLIQUEE), (x) => x.code === CODES.STATUT_INCOMPATIBLE);
  const autre = (await proposerPlanningAssiste(demande(ref, registre))).proposition;
  registre.marquer(autre.id, STATUTS_PROPOSITION.PERIMEE);
  assert.equal(registre.lire(autre.id).statut, STATUTS_PROPOSITION.PERIMEE);
  assert.equal(appliquerProposition(registre, autre.id, { executeur }).ok, false);
});

test('modèle : un item hors de la période demandée ou hors du poste est refusé', async () => {
  const c = lundi();
  prevision(c.e, S.mardi, 1, 10);
  const mardi = composantValide(c.e, S.mardi, 1, J.PRODUIT_SEC_TEST);
  const hors = composantValide(c.e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'HORS_POSTE_TEST' });
  c.e.composants[hors].attribue = false;
  const ref = { etat: c.e };
  for (const productionId of [principaleDe(c.e, mardi)]) {
    const r = await proposerPlanningAssiste(demande(ref, creerRegistre(), {
      fournisseur: fournisseurScripte([brouillon([{ productionId, date: S.lundi }])]),
    }));
    assert.equal(r.mode, 'deterministe');
    assert.match(r.avertissements[0], /hors période|après le service/);
  }
});

test('un fournisseur dont disponible() lève, ou dont la réponse porte une fonction, ne fait jamais échouer la demande', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const casse = { nom: 'casse', disponible() { throw new Error('boum'); }, demander: async () => brouillon([]) };
  const a = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: casse }));
  assert.equal(a.mode, 'deterministe');
  const avecFonction = fournisseurScripte([{ type: 'brouillon', brouillon: { type: 'planning', items: [], f() {} } }]);
  const b = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: avecFonction }));
  assert.equal(b.mode, 'deterministe');
  assert.equal(b.avertissements.length, 1);
  const delaiNul = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: fournisseurScripte([brouillon([])]), delaiMs: NaN }));
  assert.equal(delaiNul.mode, 'modele', 'un délai invalide retombe sur le délai par défaut');
});

test('contexte : le texte libre d\'un refus n\'est jamais renvoyé au modèle', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'refuser', raison: 'RAISON_TEST_SECRETE' }, { executeur });
  const fournisseur = fournisseurScripte([brouillon([])]);
  await proposerPlanningAssiste(demande(ref, registre, { fournisseur }));
  const envoye = JSON.stringify(fournisseur.requetes[0]);
  assert.ok(envoye.includes('harness:refusee'));
  assert.ok(!envoye.includes('RAISON_TEST_SECRETE'));
});

test('une avance à conservation non validée n\'est jamais exposée comme « couvre »', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 20);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const { executerOutil } = await import('../app/js/harness/outils.js');
  const p = principaleDe(e, c);
  const ctx = { etat: e, aujourdhui: AUJOURDHUI, h: h() };
  const suggestion = executerOutil('suggerer_jour', { productionId: p }, ctx).resultat;
  assert.deepEqual(Object.keys(suggestion).sort(), ['date', 'evaluation']);
  assert.equal(suggestion.date, S.mercredi, 'sans contrainte, le jour du service');
  assert.equal(executerOutil('evaluer_avance', { productionId: p, date: S.mardi }, ctx).resultat.couvre, false);
  const controle = controlerBrouillon({ type: 'planning', items: [{ productionId: p, date: S.mardi }] }, e, { h: h(), aujourdhui: AUJOURDHUI });
  assert.deepEqual(controle.erreurs, []);
  assert.equal(controle.items[0].evaluation.conservation, 'a_confirmer');
  assert.equal(controle.items[0].evaluation.couvre, false);
});

test('conflit : si l\'état change entre le brouillon et l\'application, rien n\'est écrit et le brouillon est périmé', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  executeur((etat, t) => planifier(etat, pSec, S.lundi, t));
  const avant = copie(ref.etat);
  const r = appliquerProposition(registre, proposition.id, { executeur });
  assert.deepEqual([r.ok, r.code], [false, CODES.CONFLIT]);
  assert.deepEqual(ref.etat, avant, 'aucune écriture partielle');
  assert.equal(ref.etat.productions[pSec].jourDecide, S.lundi, 'décidée à la main entre-temps, intacte');
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.CONFLIT);
  const neuve = await proposerPlanningAssiste(demande(ref, registre));
  assert.ok(!neuve.proposition.items.some((i) => i.productionId === pSec), 'le recalcul ne reprend pas une production déjà décidée');
});

test('empreinte : stable sans changement, sensible au jour décidé (de la production ou d\'une autre, ce jour-là) et aux composants du périmètre', () => {
  const { e, pSec, pCru } = lundi();
  const perimetre = { productionIds: [pSec], dates: [S.lundi] };
  const a = empreinteEtat(e, perimetre);
  assert.equal(empreinteEtat(copie(e), perimetre), a);
  const autre = copie(e);
  planifier(autre, pSec, S.lundi, h());
  assert.notEqual(empreinteEtat(autre, perimetre), a, 'jourDecide de la production');
  const voisine = copie(e);
  planifier(voisine, pCru, S.lundi, h());
  assert.notEqual(empreinteEtat(voisine, perimetre), a, 'une autre production décidée un jour du périmètre');
  const modifie = copie(e);
  modifie.composants[modifie.productions[pSec].composantId].grammage.valeur = 999;
  assert.notEqual(empreinteEtat(modifie, perimetre), a);
  assert.equal(empreinteEtat(e, { productionIds: ['absente'], dates: [] }).length, 8);
});

test('conservation non validée : avertissement léger (décision du 2026-10-06), jamais « couverte », sans confirmation à donner', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 20);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const fournisseur = fournisseurScripte([brouillon([{ productionId: principaleDe(e, c), date: S.mardi }])]);
  const { proposition, mode } = await proposerPlanningAssiste(demande(ref, registre, { dateDebut: S.mercredi, dateFin: S.mercredi, fournisseur }));
  assert.equal(mode, 'modele');
  assert.equal(proposition.items.length, 1);
  const item = proposition.items[0];
  assert.equal(item.date, S.mardi);
  assert.equal(item.evaluation.conservation, 'a_confirmer');
  assert.equal(item.evaluation.couvre, false, 'jamais présenté comme couvert');
  assert.equal(item.exigeConfirmation, false, 'aucune confirmation exigée');
  assert.match(item.motifs[0], /^Avertissement : conservation non validée.*couvert/);
  assert.ok(proposition.incertitudes.some((x) => x.includes('conservation non validée (avertissement)')));

  decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  assert.equal(appliquerProposition(registre, proposition.id, { executeur }).ok, true, 'validé par le chef puis appliqué directement');
  assert.equal(ref.etat.productions[principaleDe(ref.etat, c)].jourDecide, S.mardi);
});

test('mécanisme de confirmation par item (disponible pour de futures commandes) : sans confirmation, rien n\'est appliqué', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const item = {
    id: 'item-manuel', productionId: pSec, composantId: e.productions[pSec].composantId, nom: 'MANUEL_TEST', dateService: S.lundi,
    date: S.lundi, exigeConfirmation: true, motifs: [],
    commande: { outil: 'planifier_production', entrees: { productionId: pSec, date: S.lundi } },
  };
  const creer = () => registre.creer({ origine: ORIGINES.DETERMINISTE, items: [item], aDecider: [], controles: [] }, ref.etat, h());
  const sans = creer();
  decider(registre, sans.id, { choix: 'valider' }, { executeur });
  const r = appliquerProposition(registre, sans.id, { executeur });
  assert.deepEqual([r.ok, r.code], [false, CODES.PRECONDITION]);
  assert.equal(ref.etat.productions[pSec].jourDecide, null);
  const avec = creer();
  assert.throws(() => registre.valider(avec.id, h(), { itemsConfirmes: ['inconnu'] }), (x) => x.code === CODES.REFERENCE_INCONNUE);
  decider(registre, avec.id, { choix: 'valider', itemsConfirmes: ['item-manuel'] }, { executeur });
  assert.equal(appliquerProposition(registre, avec.id, { executeur }).ok, true);
  assert.equal(ref.etat.productions[pSec].jourDecide, S.lundi);
});

test('confirmer un item qui n\'en exige pas, ou retirer un item : contrôlé', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  assert.throws(() => registre.valider(proposition.id, h(), { itemsConfirmes: [proposition.items[0].id] }), (x) => x.code === CODES.PRECONDITION);
  decider(registre, proposition.id, { choix: 'valider', itemsRetires: [`item-${pCru}`] }, { executeur });
  const r = appliquerProposition(registre, proposition.id, { executeur });
  assert.deepEqual(r.appliques, [pSec]);
  assert.equal(ref.etat.productions[pCru].jourDecide, null, 'l\'item retiré par le chef n\'est pas planifié');
});

test('manque de donnée : quantité inconnue va dans « À décider », jamais devinée ; la base du menu 1 reste au jour même', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 20);
  prevision(e, S.mercredi, 2, 20);
  const inconnue = composantValide(e, S.mercredi, 2, J.PRODUIT_SEC_TEST, { grammage: INCONNU });
  const base = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'BASE_TEST', role: 'plat_principal' });
  const normal = composantValide(e, S.mercredi, 2, J.PRODUIT_CRU_TEST);
  const ref = { etat: e };
  const { proposition } = await proposerPlanningAssiste(demande(ref, creerRegistre(), { dateDebut: S.mercredi, dateFin: S.mercredi }));
  assert.deepEqual(proposition.aDecider.map((d) => d.composantId), [inconnue]);
  assert.deepEqual(proposition.items.map((i) => i.composantId).sort(), [base, normal].sort());
  assert.ok(proposition.items.every((i) => i.date === S.mercredi), 'sans contrainte, le jour du service');
});

test('aucun jour compatible (service déjà passé pour « aujourd\'hui ») : « À décider » avec le texte du jour, jamais deviné', async () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 20);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const { proposition } = await proposerPlanningAssiste(demande({ etat: e }, creerRegistre(), { aujourdhui: S.mardi }));
  assert.deepEqual(proposition.items, []);
  assert.equal(proposition.aDecider[0].composantId, c);
  assert.match(proposition.aDecider[0].texte, /aucun jour compatible avec les règles/);
});

test('modèle scripté : outils lus puis brouillon valide accepté, quantités et contrôles refaits par le calcul', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const fournisseur = fournisseurScripte([
    { type: 'appel_outil', outil: 'lire_menus', entrees: { date: S.lundi } },
    brouillon([{ productionId: pSec, date: S.samediPrecedent }], { hypotheses: ['service chargé le matin'], incertitudes: ['durée non mesurée'] }),
  ]);
  const { proposition, mode, avertissements } = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur }));
  assert.equal(mode, 'modele');
  assert.equal(proposition.origine, ORIGINES.MODELE);
  assert.deepEqual(avertissements, []);
  assert.equal(proposition.items[0].date, S.samediPrecedent);
  assert.ok(proposition.items[0].quantite.libelle, 'la quantité vient du domaine');
  assert.ok(proposition.hypotheses.includes('modèle : service chargé le matin'));
  assert.ok(proposition.incertitudes.includes('modèle : durée non mesurée'));
  assert.ok(proposition.aDecider.some((d) => d.genre === 'non_traitee' && d.productionId === pCru), 'ce que le modèle omet reste à décider');
  assert.equal(fournisseur.requetes[1].historique[0].outil, 'lire_menus');
  assert.ok(fournisseur.requetes[0].outils.every((o) => o.nom !== 'planifier_production'));
  assert.ok(!JSON.stringify(fournisseur.requetes[0]).includes('allergies'));
});

test('modèle : son texte libre est borné (5 éléments de 200 caractères) et préfixé', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const longues = Array.from({ length: 9 }, (_, i) => `${i}${'x'.repeat(500)}`);
  const f = fournisseurScripte([brouillon(
    [{ productionId: pSec, date: S.lundi }, { productionId: pCru, date: S.lundi }],
    { hypotheses: longues, incertitudes: longues },
  )]);
  const { proposition } = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: f }));
  const duModele = (liste) => liste.filter((x) => x.startsWith('modèle : '));
  assert.equal(duModele(proposition.hypotheses).length, 5);
  assert.equal(duModele(proposition.incertitudes).length, 5);
  for (const x of [...duModele(proposition.hypotheses), ...duModele(proposition.incertitudes)]) assert.ok(x.length <= 'modèle : '.length + 200);
});

test('validateur : une clé de prototype n\'est jamais une production', () => {
  const { e } = lundi();
  for (const cle of ['constructor', '__proto__', 'toString']) {
    const r = controlerBrouillon({ type: 'planning', items: [{ productionId: cle, date: S.lundi }] }, e, { h: h(), aujourdhui: AUJOURDHUI });
    assert.match(r.erreurs[0], /production inconnue/, cle);
  }
});

test('decider : la trace est écrite avant le registre ; un refus du registre n\'écrit rien dans le journal', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'refuser' }, { executeur });
  const avant = ref.etat.journal.length;
  assert.throws(() => decider(registre, proposition.id, { choix: 'valider' }, { executeur }), (x) => x.code === CODES.STATUT_INCOMPATIBLE);
  assert.equal(ref.etat.journal.length, avant, 'aucune ligne de journal pour une validation refusée');
});

const REFUS = [
  ['production inconnue', (c) => [{ productionId: 'prod-fantome', date: S.lundi }], /inconnue/],
  ['champ inconnu', (c) => [{ productionId: c.pSec, date: S.lundi, commande: 'planifier' }], /champ inconnu/],
  ['créneau (v134 : le schéma fermé le refuse)', (c) => [{ productionId: c.pSec, date: S.lundi, creneau: 'avant_midi' }], /creneau : champ inconnu/],
  ['jour déjà passé', (c) => [{ productionId: c.pSec, date: '2026-10-01' }], /déjà passé/],
  ['dimanche', (c) => [{ productionId: c.pSec, date: S.dimanchePrecedent }], /non travaillé/],
  ['après le service', (c) => [{ productionId: c.pSec, date: S.mardi }], /après le service/],
  ['avance hors règle (plus de deux jours, sans règle validée)', (c) => [{ productionId: c.pSec, date: S.veille }], /non autorisée|passé|non travaillé/],
  ['quantité annoncée fausse', (c) => [{ productionId: c.pSec, date: S.lundi, quantite: { libelle: '999 kg' } }], /différente du calcul/],
  ['production en double', (c) => [{ productionId: c.pSec, date: S.lundi }, { productionId: c.pSec, date: S.samediPrecedent }], /en double/],
  ['date invalide', (c) => [{ productionId: c.pSec, date: '2026-02-30' }], /date attendu/],
];

for (const [nom, items, motif] of REFUS) {
  test(`modèle refusé (${nom}) : repli sur le calcul déterministe, avertissement, état intact`, async () => {
    const c = lundi();
    const ref = { etat: c.e };
    const avant = copie(c.e);
    const { proposition, mode, avertissements } = await proposerPlanningAssiste(
      demande(ref, creerRegistre(), { fournisseur: fournisseurScripte([brouillon(items(c))]) }),
    );
    assert.equal(mode, 'deterministe');
    assert.equal(proposition.origine, ORIGINES.DETERMINISTE);
    assert.equal(avertissements.length, 1);
    assert.match(avertissements[0], motif);
    assert.deepEqual(ref.etat, avant);
  });
}

test('base du menu 1 : le modèle ne peut pas l\'avancer sans règle d\'avance validée', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 20);
  const base = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'BASE_TEST', role: 'plat_principal' });
  const controle = controlerBrouillon({ type: 'planning', items: [{ productionId: principaleDe(e, base), date: S.mardi }] }, e, { h: h(), aujourdhui: AUJOURDHUI });
  assert.ok(controle.erreurs.some((x) => x.includes('jour même')));
});

test('modèle qui réclame une action réservée au chef : refus tracé dans l\'historique, puis brouillon accepté', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const avant = copie(e);
  const fournisseur = fournisseurScripte([
    { type: 'appel_outil', outil: 'definirRegle', entrees: { nom: 'x', avanceMaxJours: 5 } },
    { type: 'appel_outil', outil: 'planifier_production', entrees: { productionId: pSec, date: S.lundi } },
    { type: 'appel_outil', outil: 'lire_menus', entrees: { date: 'pas une date' } },
    brouillon([{ productionId: pSec, date: S.lundi }]),
  ]);
  const r = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur, maxIterations: 6 }));
  assert.equal(r.mode, 'modele');
  const historique = fournisseur.requetes[3].historique;
  assert.match(historique[0].erreur, /réservée au chef/);
  assert.match(historique[1].erreur, /ne peut venir ni du modèle/);
  assert.match(historique[2].erreur, /date attendu/);
  assert.deepEqual(ref.etat, avant);
});

test('boucles : appel répété, trop d\'échanges sans brouillon et état intact', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const repete = fournisseurScripte([{ type: 'appel_outil', outil: 'lire_menus', entrees: { date: S.lundi } }]);
  const a = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: repete }));
  assert.equal(a.mode, 'deterministe');
  assert.match(a.avertissements[0], /répète le même appel/);
  assert.equal(repete.requetes.length, 2);

  let n = 0;
  const infini = fournisseurScripte([() => ({ type: 'appel_outil', outil: 'lire_menus', entrees: { date: `2026-10-0${(n++ % 9) + 1}` } })]);
  const b = await proposerPlanningAssiste(demande(ref, creerRegistre(), { fournisseur: infini }));
  assert.equal(b.mode, 'deterministe');
  assert.equal(infini.requetes.length, MAX_ITERATIONS);
  assert.match(b.avertissements[0], /n'a pas rendu de brouillon/);
});

test('modèle absent, désactivé, en panne, trop lent, annulé ou incohérent : le calcul déterministe répond toujours', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const avant = copie(e);
  const cas = [
    ['désactivé', { fournisseur: fournisseurDesactive }, false],
    ['absent', { fournisseur: undefined }, false],
    ['indisponible', { fournisseur: fournisseurScripte([brouillon([])], { disponible: false }) }, false],
    ['en panne', { fournisseur: fournisseurScripte([new Error('panne réseau')]) }, true],
    ['trop lent', { fournisseur: fournisseurScripte([ATTENTE]), delaiMs: 20 }, true],
    ['annulé', { fournisseur: fournisseurScripte([brouillon([])]), signal: AbortSignal.abort() }, true],
    ['réponse incohérente', { fournisseur: fournisseurScripte([{ nimporte: 'quoi' }]) }, true],
    ['fournisseur invalide', { fournisseur: { nom: 'cassé' } }, false],
  ];
  for (const [nom, extra, avertit] of cas) {
    const r = await proposerPlanningAssiste(demande(ref, creerRegistre(), extra));
    assert.equal(r.mode, 'deterministe', nom);
    assert.equal(r.avertissements.length > 0, avertit, nom);
    assert.ok(r.proposition.items.some((i) => i.productionId === pSec), nom);
    assert.deepEqual(ref.etat, avant, nom);
  }
});

test('la proposition rendue est une copie : la modifier ne change ni le registre ni l\'état', async () => {
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  proposition.statut = STATUTS_PROPOSITION.VALIDEE;
  proposition.items.length = 0;
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.BROUILLON);
  assert.equal(registre.lire(proposition.id).items.length, 2);
  assert.equal(appliquerProposition(registre, proposition.id, { executeur }).ok, false);
  assert.throws(() => registre.marquer(proposition.id, 'inventé'), ErreurHarness);
});

test('avec le vrai magasin : agir copie, applique et remplace l\'état seulement après validation du chef', async () => {
  const magasin = await import('../app/js/magasin.js');
  const { e, pSec } = lundi();
  magasin.remplacer(e);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste({
    etat: magasin.etat(), h: magasin.maintenant(), aujourdhui: AUJOURDHUI, dateDebut: S.lundi, dateFin: S.lundi, registre,
  });
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  decider(registre, proposition.id, { choix: 'valider' }, { executeur: magasin.agir });
  assert.equal(magasin.etat().productions[pSec].jourDecide, null);
  const r = appliquerProposition(registre, proposition.id, { executeur: magasin.agir });
  assert.equal(r.ok, true);
  assert.equal(magasin.etat().productions[pSec].jourDecide, S.lundi);
  assert.ok(magasin.etat().journal.some((x) => x.action === 'harness:appliquee'));
});

test('domaine : suggererJour sans « depuis » donne le jour du service, avec « depuis » il écarte le passé', () => {
  const { e, pSec } = lundi();
  const sans = suggererJour(e, pSec);
  assert.deepEqual(Object.keys(sans).sort(), ['date', 'evaluation']);
  assert.equal(sans.date, S.lundi);
  assert.equal(suggererJour(e, pSec, S.lundi).date, S.lundi);
  assert.equal(suggererJour(e, pSec, S.mardi), null);
});

/** Composant à trois étapes (règle validée) : deux préparatoires et la finition, toutes à planifier. */
function etapes() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ETAPES_TEST' });
  definirRegle(e, { nom: 'ETAPES_TEST', etapes: [
    { libelle: 'Couper', avanceMaxJours: 3 }, { libelle: 'Blanchir', avanceMaxJours: 3 }, { libelle: 'Finir', avanceMaxJours: 0 },
  ] }, h());
  const prod = (cle) => Object.values(e.productions).find((p) => p.composantId === c && p.etapeCle === cle);
  return { e, c, couper: prod('couper'), blanchir: prod('blanchir'), finir: Object.values(e.productions).find((p) => p.composantId === c && p.genre === 'principale') };
}

test('decider avec « jours » : le chef corrige le jour d\'une ligne du brouillon ; la commande suit et jourDecide prend la nouvelle date', async () => {
  const { e, pSec, pCru } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  const avantDecision = copie(ref.etat);
  const validee = decider(registre, proposition.id, { choix: 'valider', jours: { [`item-${pSec}`]: S.samediPrecedent } }, { executeur, aujourdhui: AUJOURDHUI });
  const corrige = validee.items.find((i) => i.productionId === pSec);
  assert.equal(corrige.date, S.samediPrecedent);
  assert.equal(corrige.commande.entrees.date, S.samediPrecedent, 'la commande suit la correction');
  assert.equal(corrige.evaluation.jours, 2, 'l\'évaluation est recalculée pour le nouveau jour');
  assert.equal(validee.items.find((i) => i.productionId === pCru).date, S.lundi, 'les autres lignes ne bougent pas');
  assert.deepEqual(validee.decision.jours, { [`item-${pSec}`]: S.samediPrecedent });
  assert.equal(ref.etat.productions[pSec].jourDecide, null, 'valider ne planifie pas encore');
  assert.deepEqual(ref.etat.productions, avantDecision.productions);
  const r = appliquerProposition(registre, proposition.id, { executeur });
  assert.equal(r.ok, true);
  assert.equal(ref.etat.productions[pSec].jourDecide, S.samediPrecedent);
  assert.equal(ref.etat.productions[pCru].jourDecide, S.lundi);
});

test('decider avec « jours » : dimanche, après le service, date invalide, item inconnu refusés en nommant la préparation ; rien n\'est modifié', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  const avant = copie(ref.etat);
  const refus = (jours, motif) => {
    assert.throws(() => decider(registre, proposition.id, { choix: 'valider', jours }, { executeur }), (x) => x instanceof ErreurHarness && motif.test(x.message), String(motif));
  };
  refus({ [`item-${pSec}`]: S.dimanchePrecedent }, /PRODUIT_SEC_TEST : .*non travaillé/);
  refus({ [`item-${pSec}`]: S.mardi }, /PRODUIT_SEC_TEST : .*après le service/);
  refus({ [`item-${pSec}`]: S.veille }, /PRODUIT_SEC_TEST : .*(non autorisée|hors règle)/);
  refus({ [`item-${pSec}`]: '2026-02-30' }, /PRODUIT_SEC_TEST : date invalide/);
  refus({ 'item-fantome': S.lundi }, /Item inconnu/);
  assert.throws(() => decider(registre, proposition.id, { choix: 'valider', jours: ['x'] }, { executeur }), (x) => x.code === CODES.ENTREE_INVALIDE);
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.BROUILLON, 'toujours un brouillon');
  assert.equal(registre.lire(proposition.id).items.find((i) => i.productionId === pSec).date, S.lundi, 'la date d\'origine est gardée');
  assert.deepEqual(ref.etat, avant, 'ni journal ni production touchés');
});

test('decider avec « jours » : une étape hors ordre est refusée en nommant la préparation et l\'étape', async () => {
  const { e, couper, blanchir, finir } = etapes();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  assert.equal(proposition.items.length, 3, 'les trois étapes sont dans le brouillon');
  // « Blanchir » avancé au samedi alors que « Couper » reste au lundi : l'ordre des étapes est rompu (l'avance seule serait permise).
  assert.throws(
    () => decider(registre, proposition.id, { choix: 'valider', jours: { [`item-${blanchir.id}`]: S.samediPrecedent } }, { executeur }),
    (x) => x instanceof ErreurHarness && /ETAPES_TEST : .*ne peut pas se faire (avant|après) l'étape .*(Couper|Blanchir)/.test(x.message),
  );
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.BROUILLON);
  // Avancer « Couper » seul respecte l'ordre : accepté, puis appliqué.
  decider(registre, proposition.id, { choix: 'valider', jours: { [`item-${couper.id}`]: S.samediPrecedent } }, { executeur });
  assert.equal(appliquerProposition(registre, proposition.id, { executeur }).ok, true);
  assert.equal(ref.etat.productions[couper.id].jourDecide, S.samediPrecedent);
  assert.equal(ref.etat.productions[blanchir.id].jourDecide, S.lundi);
  assert.equal(ref.etat.productions[finir.id].jourDecide, S.lundi);
});

test('export puis import : les traces du harness survivent à la sauvegarde sans nouveau format', async () => {
  const { exporter, importer } = await import('../app/js/domaine/etat.js');
  const { e } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  appliquerProposition(registre, proposition.id, { executeur });
  const restaure = importer(exporter(ref.etat, h()), S.lundi);
  assert.ok(restaure.journal.some((x) => x.action === 'harness:appliquee'));
  assert.equal(restaure.schema, ref.etat.schema);
});

test('orchestrateur : sans les valeurs h et aujourdhui, la demande est refusée proprement', async () => {
  const { e } = lundi();
  await assert.rejects(proposerPlanningAssiste({ etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre() }), (x) => x.code === CODES.ENTREE_INVALIDE);
});

test('decider avec « jours » : une ligne écartée ne peut pas être corrigée (refus clair, rien n\'est modifié)', async () => {
  const { e, pSec } = lundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste(demande(ref, registre));
  const avant = copie(ref.etat);
  assert.throws(
    () => decider(registre, proposition.id, { choix: 'valider', itemsRetires: [`item-${pSec}`], jours: { [`item-${pSec}`]: S.samediPrecedent } }, { executeur }),
    (x) => x instanceof ErreurHarness && x.code === CODES.ENTREE_INVALIDE && /PRODUIT_SEC_TEST : ligne écartée/.test(x.message),
  );
  assert.equal(registre.lire(proposition.id).statut, STATUTS_PROPOSITION.BROUILLON, 'toujours un brouillon');
  assert.deepEqual(ref.etat, avant, 'ni journal ni production touchés');
});
