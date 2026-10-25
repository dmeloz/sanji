// Tableau blanc : données du tableau de la semaine (semaine par défaut, jours, besoins). Jeux TEST_ONLY, mots de catégorie génériques.

import test from 'node:test';
import assert from 'node:assert/strict';
import { creerFiche, definirMenu, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { tableauBlanc } from '../app/js/domaine/tableau-blanc.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { etatReglette } from './aide-tableau.js';

const textes = (lignes) => lignes.map((l) => l.texte);

/** Semaine du 5 octobre : menus du lundi et du mardi, sans portion ni prévision. */
function semaineSaisie() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz et carottes', h());
  definirMenu(e, S.lundi, 2, 'poulet, riz, carottes', h());
  definirMenu(e, S.mardi, 1, 'polenta', h());
  definirMenu(e, S.mardi, 2, 'poisson, quinoa, poireaux', h());
  return e;
}

test('base vide : semaine par défaut = la semaine en cours du lundi au jeudi, la suivante du vendredi au dimanche', () => {
  for (const jour of [S.lundi, S.mardi, S.mercredi, S.jeudi]) {
    const tb = tableauBlanc(etatVide(), jour);
    assert.equal(tb.bord.entete.aucunMenuCetteSemaine, true, jour);
    assert.equal(tb.lundi, S.lundi);
    assert.equal(tb.estSemaineCourante, true);
  }
  for (const jour of [S.vendredi, S.samedi, S.dimanche]) {
    const tb = tableauBlanc(etatVide(), jour);
    assert.equal(tb.bord.entete.aucunMenuCetteSemaine, false, jour);
    assert.equal(tb.lundi, S.lundiSuivant, `${jour} : la semaine affichée est la suivante`);
    assert.equal(tb.estSemaineCourante, false);
  }
});

test('six jours du lundi au samedi, aujourd\'hui marqué, navigation de semaine', () => {
  const tb = tableauBlanc(etatVide(), S.mercredi);
  assert.deepEqual(tb.jours.map((j) => j.date), [S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi, S.samedi]);
  assert.deepEqual(tb.jours.filter((j) => j.estAujourdhui).map((j) => j.date), [S.mercredi]);
  assert.equal(tb.jours[5].aMenu, false, 'pas de menu du jour le samedi');
  assert.equal(tb.semainePrecedente, '2026-09-28');
  assert.equal(tb.semaineSuivante, S.lundiSuivant);
  const force = tableauBlanc(etatVide(), S.mercredi, '2026-10-14');
  assert.equal(force.lundi, S.lundiSuivant, 'la semaine forcée est ramenée au lundi');
  assert.equal(force.bord.entete.aucunMenuCetteSemaine, true, 'ce constat reste celui d\'aujourd\'hui');
});

test('morceaux : ce qui est au poste et ce qui ne l\'est pas, dans l\'ordre de l\'intitulé', () => {
  const tb = tableauBlanc(semaineSaisie(), S.lundi);
  const lundi = tb.jours[0];
  assert.deepEqual(lundi.menus[0].morceaux.map((m) => [m.texte, m.auPoste]), [['riz et carottes', true]]);
  assert.deepEqual(lundi.menus[1].morceaux.map((m) => [m.texte, m.auPoste]), [['poulet', false], ['riz', true], ['carottes', true]]);
  assert.ok(lundi.menus[1].morceaux.every((m) => typeof m.composantId === 'string'));
  assert.deepEqual(tb.jours[2].menus.map((m) => m.saisi), [false, false], 'mercredi : rien de saisi');
});

test('couverts : aucun chiffre sans prévision ni groupe, prévision à saisir signalée, groupes provisoires', () => {
  const e = semaineSaisie();
  let lundi = tableauBlanc(e, S.lundi).jours[0];
  assert.deepEqual(lundi.menus.map((m) => [m.couverts, m.previsionASaisir]), [[null, true], [null, true]]);
  assert.equal(lundi.nbFiches, 0);
  prevision(e, S.lundi, 1, 40);
  creerFiche(e, { numero: 'FICHE_TEST', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 12, mode: 'choix_libre',
    repartition: { 1: 8, 2: 4 }, allergies: 'ALLERGIE_TEST' }, h());
  lundi = tableauBlanc(e, S.lundi).jours[0];
  assert.deepEqual(lundi.menus.map((m) => [m.couverts, m.provisoires]), [[48, true], [4, true]]);
  assert.equal(lundi.nbFiches, 1);
  const fiches = tableauBlanc(e, S.lundi).bord.fiches;
  assert.deepEqual(fiches.map((g) => [g.numero, g.couverts, g.aAllergies]), [['FICHE_TEST', 12, true]]);
});

// Adapté B-P0 : les repères validés couvrent maintenant « riz en garniture » et « pâtes en plat principal » : ces deux
// portions ne sont plus « à régler » (6 -> 4). Le reste du test est inchangé.
test('besoins : portions à régler, éléments inconnus et prévisions sont dits une fois (chiffrage du bord)', () => {
  const e = semaineSaisie();
  definirMenu(e, S.mercredi, 1, 'ELEMENT_INCONNU_TEST', h());
  const tb = tableauBlanc(e, S.mercredi);
  assert.equal(tb.bord.entete.aucunMenuCetteSemaine, false);
  const lignes = textes(tb.bord.production.chiffrage);
  // Fusion B-P0 + B-P1a : le riz et les pâtes ont un repère validé, la polenta (qui a remplacé les pâtes ici) n'en a pas.
  assert.ok(lignes.includes('5 portions à régler dans les standards maison'), lignes.join(' | '));
  assert.ok(lignes.includes('1 élément du menu à préciser'));
  // Une fois les standards réglés, il reste les prévisions.
  for (const [famille, role, etat] of [['riz', 'plat_principal', 'sec'], ['riz', 'garniture', 'sec'], ['carottes', 'garniture', 'cru_net'],
    ['polenta', 'plat_principal', 'sec'], ['quinoa', 'garniture', 'sec'], ['poireaux', 'garniture', 'cru_net']]) {
    definirStandard(e, famille, role, { valeur: 100, unite: 'g', etat }, h());
  }
  const apres = textes(tableauBlanc(e, S.jeudi).bord.production.chiffrage);
  assert.ok(!apres.some((t) => /portions? à régler/.test(t)));
  assert.ok(apres.includes('Prévisions à saisir pour 3 jours'));
});

test('un vendredi avec des tâches à faire reste sur la semaine en cours', () => {
  const { e, jour } = etatReglette(); // service du vendredi 2 octobre
  const tb = tableauBlanc(e, jour);
  assert.equal(tb.lundi, '2026-09-28');
  assert.equal(tb.estSemaineCourante, true);
});

test('une garniture générique sans chiffre n\'est pas une question posée au chef', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'poulet, tomates', h()); // légume sans famille connue : générique, portions seulement
  const tb = tableauBlanc(e, S.lundi);
  assert.equal(Object.values(e.composants).find((c) => c.nom === 'tomates').type, 'generique');
  assert.deepEqual(tb.bord.aConfirmer.lignes.filter((l) => l.genre !== 'global'), []);
  assert.ok(!textes(tb.bord.production.chiffrage).some((t) => /préciser/.test(t)));
});

test('signes du jour : hors règle et à confirmer, seulement quand il y a quelque chose à signaler ; plus de « jour off »', () => {
  const e = etatVide();
  // Lundi : menu saisi sans prévision = un point à confirmer.
  definirMenu(e, S.lundi, 1, 'riz', h());
  // Mardi : avance de 3 jours (lundi pour jeudi), sans règle : hors règle le jour décidé (lundi).
  prevision(e, S.jeudi, 1, 20);
  const id = composantValide(e, S.jeudi, 1, J.PRODUIT_SEC_TEST);
  planifier(e, principaleDe(e, id), S.lundi, h());
  const jours = Object.fromEntries(tableauBlanc(e, S.lundi).jours.map((j) => [j.date, j]));
  assert.equal(jours[S.lundi].horsRegle, true);
  assert.equal(jours[S.lundi].aConfirmer, true);
  assert.equal(jours[S.mardi].horsRegle, false);
  assert.equal(jours[S.mardi].aConfirmer, false);
  assert.ok(Object.values(jours).every((j) => !('jourOff' in j)), 'plus de « jour off selon la semaine type »');
});
