import test from 'node:test';
import assert from 'node:assert/strict';
import { CODES, ErreurHarness } from '../app/js/harness/contrats.js';
import { appliquerProposition, decider } from '../app/js/harness/commandes.js';
import { creerHorloge, creneauPasse, exclusionDuPasse, formaterLocal, horlogeFixe, verifierBornes } from '../app/js/harness/horloge.js';
import { proposerPlanningAssiste } from '../app/js/harness/orchestrateur.js';
import { creerRegistre } from '../app/js/harness/propositions.js';
import { executerOutil } from '../app/js/harness/outils.js';
import { controlerBrouillon } from '../app/js/harness/validateur.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { executeurDe, fournisseurScripte } from './aide-harness.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

// Bornes de TEST : valeurs arbitraires, ce ne sont pas les heures du restaurant.
const BORNES_TEST = { avant_midi: '10:00', apres_midi: '16:00' };

function etatLundi() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  return { e, c, p: principaleDe(e, c) };
}

test('horloge : formats locaux, source injectable, horloge fixe', () => {
  assert.equal(formaterLocal(new Date(2026, 9, 5, 7, 8, 9)), '2026-10-05T07:08:09');
  const horloge = horlogeFixe('2026-10-05T11:30');
  assert.deepEqual([horloge.maintenant(), horloge.aujourdhui(), horloge.heure()], ['2026-10-05T11:30:00', '2026-10-05', '11:30']);
  assert.ok(Object.isFrozen(horloge));
  const defaut = creerHorloge();
  assert.match(defaut.maintenant(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  let t = 0;
  const avance = creerHorloge(() => new Date(2026, 9, 5, 8, t++));
  assert.notEqual(avance.heure(), avance.heure(), 'la source est relue à chaque appel');
});

test('bornes : validées, copiées, jamais inventées', () => {
  assert.equal(verifierBornes(null), null);
  assert.equal(verifierBornes(undefined), null);
  const b = verifierBornes({ avant_midi: '10:00' });
  assert.ok(Object.isFrozen(b));
  for (const mauvais of [[], 'x', { minuit: '10:00' }, { avant_midi: '25:00' }, { avant_midi: '9:00' }, { avant_midi: 900 }]) {
    assert.throws(() => verifierBornes(mauvais), (x) => x instanceof ErreurHarness && x.code === CODES.ENTREE_INVALIDE, JSON.stringify(mauvais));
  }
});

test('creneauPasse : jour passé, heure de fin du jour même, futur, créneau sans borne jamais exclu', () => {
  const maintenant = '2026-10-05T10:00:00';
  assert.equal(creneauPasse(BORNES_TEST, S.veille, 'avant_midi', maintenant), true, 'jour passé');
  assert.equal(creneauPasse(BORNES_TEST, S.lundi, 'avant_midi', '2026-10-05T09:59:59'), false, 'avant l\'heure de fin');
  assert.equal(creneauPasse(BORNES_TEST, S.lundi, 'avant_midi', maintenant), true, 'à l\'heure de fin');
  assert.equal(creneauPasse(BORNES_TEST, S.lundi, 'apres_midi', maintenant), false);
  assert.equal(creneauPasse(BORNES_TEST, S.mardi, 'avant_midi', maintenant), false, 'futur');
  assert.equal(creneauPasse(BORNES_TEST, S.lundi, 'avant_soir', '2026-10-05T23:00:00'), false, 'pas de borne : jamais exclu');
  assert.equal(creneauPasse(null, S.veille, 'avant_midi', maintenant), false);
  assert.equal(exclusionDuPasse(null, BORNES_TEST), null);
  assert.equal(exclusionDuPasse(horlogeFixe('2026-10-05T11:00'), null), null);
  assert.equal(exclusionDuPasse(horlogeFixe('2026-10-05T11:00'), BORNES_TEST)(S.lundi, 'avant_midi'), true);
});

test('planning : sans borne, aucun changement ; avec borne, le matin passé est écarté et l\'hypothèse disparaît', async () => {
  const { e, p } = etatLundi();
  const sans = await proposerPlanningAssiste({
    etat: e, h: h(), aujourdhui: S.lundi, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), horloge: horlogeFixe('2026-10-05T11:00'),
  });
  assert.equal(sans.proposition.items[0].creneau, 'avant_midi', 'sans borne : comportement d\'avant');
  assert.ok(sans.proposition.hypotheses.some((x) => x.includes('aucune heure de fin')));

  const avec = await proposerPlanningAssiste({
    etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), horloge: horlogeFixe('2026-10-05T11:00'), bornes: BORNES_TEST,
  });
  assert.equal(avec.proposition.items.length, 0, 'le seul créneau du jour de service est terminé : rien n\'est forcé');
  assert.ok(avec.proposition.aDecider.some((d) => d.productionId === p && /aucun créneau libre/.test(d.texte)));
  assert.ok(!avec.proposition.hypotheses.some((x) => x.includes('aucune heure de fin')));

  const tot = await proposerPlanningAssiste({
    etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), horloge: horlogeFixe('2026-10-05T07:00'), bornes: BORNES_TEST,
  });
  assert.equal(tot.proposition.items[0].creneau, 'avant_midi', 'avant l\'heure de fin : proposé');
});

test('orchestrateur : sans horloge ni valeurs, ou avec des bornes invalides, la demande est refusée proprement', async () => {
  const { e } = etatLundi();
  await assert.rejects(proposerPlanningAssiste({ etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre() }), (x) => x.code === CODES.ENTREE_INVALIDE);
  await assert.rejects(proposerPlanningAssiste({
    etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), horloge: horlogeFixe('2026-10-05T07:00'), bornes: { avant_midi: 'tard' },
  }), (x) => x.code === CODES.ENTREE_INVALIDE);
});

test('modèle : un créneau terminé est refusé par le validateur, comme dans le calcul', async () => {
  const { e, p } = etatLundi();
  const fournisseur = fournisseurScripte([{ type: 'brouillon', brouillon: { type: 'planning', items: [{ productionId: p, date: S.lundi, creneau: 'avant_midi' }] } }]);
  const r = await proposerPlanningAssiste({
    etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), horloge: horlogeFixe('2026-10-05T11:00'), bornes: BORNES_TEST, fournisseur,
  });
  assert.equal(r.mode, 'deterministe');
  assert.match(r.avertissements[0], /déjà terminé/);
  const direct = controlerBrouillon({ type: 'planning', items: [{ productionId: p, date: S.lundi, creneau: 'avant_midi' }] }, e, {
    h: h(), aujourdhui: S.lundi, exclure: exclusionDuPasse(horlogeFixe('2026-10-05T11:00'), BORNES_TEST),
  });
  assert.match(direct.erreurs[0], /déjà terminé/);
});

test('application : si l\'heure de fin passe entre la validation et l\'application, rien n\'est écrit', async () => {
  const { e, p } = etatLundi();
  const ref = { etat: e };
  const executeur = executeurDe(ref);
  const registre = creerRegistre();
  const { proposition } = await proposerPlanningAssiste({
    etat: e, dateDebut: S.lundi, dateFin: S.lundi, registre, horloge: horlogeFixe('2026-10-05T07:00'), bornes: BORNES_TEST,
  });
  decider(registre, proposition.id, { choix: 'valider' }, { executeur });
  const r = appliquerProposition(registre, proposition.id, { executeur, horloge: horlogeFixe('2026-10-05T10:30'), bornes: BORNES_TEST });
  assert.deepEqual([r.ok, r.code], [false, CODES.CONFLIT]);
  assert.match(r.message, /déjà terminé/);
  assert.equal(ref.etat.productions[p].jourDecide, null);
});

test('outils : suggerer_creneau et proposer_planning tiennent compte du créneau terminé fourni par le contexte', () => {
  const { e, p } = etatLundi();
  const exclure = exclusionDuPasse(horlogeFixe('2026-10-05T11:00'), BORNES_TEST);
  const ctx = { etat: e, aujourdhui: S.lundi, h: h(), exclure };
  assert.equal(executerOutil('suggerer_creneau', { productionId: p }, ctx).resultat, null);
  assert.equal(executerOutil('proposer_planning', { dateDebut: S.lundi, dateFin: S.lundi }, ctx).resultat.brouillon.items.length, 0);
  assert.equal(executerOutil('suggerer_creneau', { productionId: p }, { ...ctx, exclure: null }).resultat.creneau, 'avant_midi');
});
