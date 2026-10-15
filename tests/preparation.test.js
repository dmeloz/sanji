// « Préparer la semaine » (décision du 2026-10-09) : données de l'écran et « Tout valider avec les standards ».

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { saisirPortionInconnue, validerToutAvecStandards } from '../app/js/domaine/actions-preparation.js';
import { corrigerStandard } from '../app/js/domaine/actions-validation.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { preparationSemaine } from '../app/js/domaine/preparation.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

const SANS_PORTION = { valeur: null, unite: 'g', statut: 'INCONNU', source: '' };

/** Lundi : menu 2 « riz » (standard de base) ; mardi : un plat sans portion ni standard (INCONNU). */
function monde({ inconnu = true } = {}) {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  if (inconnu) {
    definirMenu(e, S.mardi, 1, 'INTITULE_TEST', h());
    composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { grammage: SANS_PORTION });
  }
  return e;
}

test('preparationSemaine : seuls les jours avec un menu (lundi à vendredi) ; un jour sans menu est absent', () => {
  const e = monde();
  const p = preparationSemaine(e, S.lundi, S.lundi);
  assert.deepEqual(p.jours.map((j) => j.date), [S.lundi, S.mardi]);
  assert.deepEqual(p.jours[0].couverts.auChoix, [40, 50, 60, 70, 80]);
  assert.equal(p.jours[0].couverts.total, 40, 'le total vient des prévisions');
  assert.equal(p.jours[1].couverts.total, null);
});

test('preparationSemaine : une ligne avec standard (valeur du standard) et une ligne INCONNU sans chiffre', () => {
  const p = preparationSemaine(monde(), S.lundi, S.lundi);
  const [standard, inconnu] = p.aConfirmer;
  assert.equal(standard.estInconnu, false);
  assert.deepEqual(standard.cible, { type: 'standard', famille: 'riz', role: 'garniture' });
  assert.equal(standard.valeurStandard, 60);
  assert.equal(standard.unite, 'g');
  assert.equal(standard.etatPoids, 'sec');
  assert.equal(inconnu.estInconnu, true);
  assert.equal(inconnu.valeurStandard, null);
  assert.equal(inconnu.cible.type, 'composant');
  assert.equal(p.restantInconnu, 1);
});

test('preparationSemaine : premier jour de service jamais avant aujourd\'hui, sinon le premier de la semaine ; aFaire compte couverts et valeurs', () => {
  const e = monde();
  assert.equal(preparationSemaine(e, S.lundi, S.lundi).premierJour, S.lundi);
  assert.equal(preparationSemaine(e, S.lundi, S.mardi).premierJour, S.mardi);
  assert.equal(preparationSemaine(e, S.lundi, S.lundiSuivant).premierJour, S.lundi, 'semaine passée : le premier jour');
  assert.equal(preparationSemaine(etatVide(), S.lundi, S.lundi).premierJour, null);
  assert.equal(preparationSemaine(e, S.lundi, S.lundi).aFaire, 3, 'mardi sans couverts + 2 lignes à confirmer');
});

test('validerToutAvecStandards : valide les lignes à standard en une écriture, ne touche pas aux INCONNU, compte juste', () => {
  const e = monde();
  const journal = e.journal.length;
  const r = validerToutAvecStandards(e, S.lundi, h(5));
  assert.deepEqual(r, { validees: 1, restantInconnu: 1 });
  assert.deepEqual(e.standards.riz.garniture, { valeur: 60, unite: 'g', etat: 'sec', h: h(5) });
  const inconnu = Object.values(e.composants).find((c) => c.nom === 'PRODUIT_SEC_TEST');
  assert.equal(grammageEffectif(e, inconnu), null, 'une valeur INCONNU reste à saisir');
  assert.ok(e.journal.length > journal);
  assert.equal(preparationSemaine(e, S.lundi, S.lundi).aConfirmer.filter((l) => !l.estInconnu).length, 0);
});

test('validerToutAvecStandards : idempotent (un second appel ne valide plus rien et ne réécrit rien)', () => {
  const e = monde();
  validerToutAvecStandards(e, S.lundi, h(5));
  const avant = structuredClone(e);
  const r = validerToutAvecStandards(e, S.lundi, h(9));
  assert.deepEqual(r, { validees: 0, restantInconnu: 1 });
  assert.deepEqual(e.standards, avant.standards);
});

test('validerToutAvecStandards : la valeur de la propriétaire passe toujours devant', () => {
  const e = monde({ inconnu: false });
  corrigerStandard(e, 'riz', 'garniture', { valeur: 55 }, h(3));
  const r = validerToutAvecStandards(e, S.lundi, h(5));
  assert.deepEqual(r, { validees: 0, restantInconnu: 0 });
  assert.equal(e.standards.riz.garniture.valeur, 55);
});

test('validerToutAvecStandards : sans standard à valider, rien ne bloque (zéro validée)', () => {
  const r = validerToutAvecStandards(etatVide(), S.lundi, h(5));
  assert.deepEqual(r, { validees: 0, restantInconnu: 0 });
});

test('couverts : un total posé écrit les prévisions des deux menus (la ligne de la page les relit)', () => {
  const e = monde();
  definirCouvertsMidi(e, S.mardi, { total: 60 }, h(2));
  assert.equal(preparationSemaine(e, S.lundi, S.lundi).jours[1].couverts.total, 60);
});

/** Semaine avec un plat de famille connue mais sans repère (polenta) et, la semaine suivante, le même plat. */
function polenta() {
  const e = etatVide();
  for (const lundi of [S.lundi, S.lundiSuivant]) {
    definirMenu(e, lundi, 1, 'polenta', h());
    prevision(e, lundi, 1, 20, h());
  }
  const ids = Object.values(e.composants).filter((c) => c.nom === 'polenta').map((c) => c.id);
  return { e, ids };
}

test('INCONNU avec famille connue : la valeur tapée devient le standard maison et la semaine suivante la reprend sans saisie', () => {
  const { e, ids } = polenta();
  const ligne = preparationSemaine(e, S.lundi, S.lundi).aConfirmer.find((l) => l.estInconnu);
  assert.equal(ligne.cible.famille, 'polenta');
  assert.equal(ligne.valeurStandard, null, 'aucun chiffre proposé');
  assert.deepEqual(saisirPortionInconnue(e, ligne.cible.composantId, 150, h(4), 'sec'), { portee: 'standard' });
  assert.equal(e.standards.polenta.plat_principal.valeur, 150);
  assert.equal(preparationSemaine(e, S.lundiSuivant, S.lundiSuivant).restantInconnu, 0, 'semaine suivante : rien à retaper');
  assert.equal(grammageEffectif(e, e.composants[ids[1]]).valeur, 150);
});

test('INCONNU sans famille : portion de ce plat seulement (aucun standard), mémorisée par nom', () => {
  const e = monde();
  const c = Object.values(e.composants).find((x) => x.nom === 'PRODUIT_SEC_TEST');
  assert.equal(preparationSemaine(e, S.lundi, S.lundi).aConfirmer.find((l) => l.cible.composantId === c.id).cible.famille, null);
  assert.deepEqual(saisirPortionInconnue(e, c.id, 90, h(4)), { portee: 'plat' });
  assert.equal(e.composants[c.id].grammage.valeur, 90);
  assert.deepEqual(e.standards ?? {}, {});
  assert.equal(Object.values(e.memoire).find((m) => m.nom === 'PRODUIT_SEC_TEST').parRole.garniture.grammage.valeur, 90);
});

test('la valeur de la propriétaire passe devant ; « Tout valider » ne touche jamais un INCONNU', () => {
  const { e, ids } = polenta();
  const r = validerToutAvecStandards(e, S.lundi, h(3));
  assert.deepEqual(r, { validees: 0, restantInconnu: 1 });
  assert.equal(grammageEffectif(e, e.composants[ids[0]]), null);
  saisirPortionInconnue(e, ids[0], 150, h(4), 'sec');
  saisirPortionInconnue(e, ids[1], 180, h(5), 'sec'); // la semaine suivante a déjà sa valeur : une nouvelle saisie la remplace, jamais l'inverse
  assert.equal(e.standards.polenta.plat_principal.valeur, 180);
});
