// A-P1 : le Tableau comme tableau de bord (domaine). Menus du jour et des deux jours suivants, fiches de fonction,
// « À confirmer » de 3 lignes au plus (jamais une quantité simplement manquante), production et commandes en résumé.
// Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { controlerProduit, creerFiche, definirMenu, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { tableauBlanc } from '../app/js/domaine/tableau-blanc.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe } from './aide.js';

function semaine() {
  const e = etatVide();
  for (const jour of [S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi]) {
    menuValide(e, jour, 1, 'INTITULE_TEST_1');
    menuValide(e, jour, 2, 'INTITULE_TEST_2');
    prevision(e, jour, 1, 40);
    prevision(e, jour, 2, 10);
  }
  return e;
}

test('bord : menus = aujourd\'hui et les 2 jours suivants, le reste de la semaine à part, rien n\'est perdu', () => {
  const { menus } = tableauBlanc(semaine(), S.mardi).bord;
  assert.deepEqual(menus.visibles.map((j) => j.date), [S.mardi, S.mercredi, S.jeudi]);
  assert.deepEqual(menus.reste.map((j) => j.date), [S.lundi, S.vendredi], 'les autres jours à menu restent à une touche');
  assert.equal(menus.visibles[0].estAujourdhui, true);
});

test('bord : une autre semaine commence par son premier jour ; la fin de semaine reste lisible', () => {
  const e = semaine();
  assert.deepEqual(tableauBlanc(e, S.mardi, S.lundiSuivant).bord.menus.visibles.map((j) => j.date), ['2026-10-12', '2026-10-13', '2026-10-14']);
  const vendredi = tableauBlanc(e, S.vendredi, S.lundi).bord.menus;
  assert.deepEqual(vendredi.visibles.map((j) => j.date), [S.vendredi]);
  const samedi = tableauBlanc(e, S.samedi, S.lundi).bord.menus;
  assert.equal(samedi.visibles.length, 3, 'semaine forcée passée : on repart du lundi');
});

test('bord : base vide, aucun menu : une invitation, pas de zone vide trompeuse', () => {
  const bord = tableauBlanc(etatVide(), S.lundi).bord;
  assert.equal(bord.menus.aucunMenu, true);
  assert.deepEqual(bord.fiches, []);
  assert.equal(bord.aConfirmer.lignes.length <= 3, true);
});

test('bord : fiches de fonction = horaire, numéro, couverts, mode, allergies, lien vers le détail du jour', () => {
  const e = semaine();
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.mardi, service: 'midi', horaire: '12:00', couverts: 24, mode: 'menu_fixe', menuFixe: 1, allergies: 'ALLERGIE_TEST' }, h());
  creerFiche(e, { numero: 'FICHE_TEST_2', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 8, mode: 'hors_menu' }, h());
  const { fiches } = tableauBlanc(e, S.mardi).bord;
  assert.deepEqual(fiches.map((f) => f.numero), ['FICHE_TEST_1'], 'les fiches passées de la semaine ne sont pas à venir');
  assert.deepEqual([fiches[0].horaire, fiches[0].couverts, fiches[0].mode, fiches[0].aAllergies, fiches[0].lien],
    ['12:00', 24, 'menu_fixe', true, `#/production/${S.mardi}`]);
  assert.match(fiches[0].modeTexte, /Menu fixe/);
});

test('bord : « À confirmer » ne dépasse jamais 3 lignes et ne contient jamais une quantité simplement manquante', () => {
  const e = etatVide();
  // Beaucoup de menus sans aucune quantité : une quantité inconnue n'est pas une décision.
  for (const jour of [S.lundi, S.mardi, S.mercredi]) definirMenu(e, jour, 1, 'riz, carottes', h());
  let bord = tableauBlanc(e, S.lundi).bord;
  assert.equal(bord.aConfirmer.lignes.some((l) => /quantité|portion à saisir|prévision/i.test(l.texte)), false);
  assert.equal(bord.aConfirmer.lignes.every((l) => !/portion|préciser/.test(l.texte)), true);
  // Plusieurs vraies décisions : écart, répartition provisoire, allergènes, semaine type : 3 lignes au plus.
  const s = semaine();
  creerFiche(s, { numero: 'FICHE_TEST_1', date: S.mardi, service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre', repartition: { 1: 12, 2: 5 } }, h());
  creerFiche(s, { numero: 'FICHE_TEST_2', date: S.mercredi, service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre', repartition: { 1: 12, 2: 5 } }, h());
  bord = tableauBlanc(s, S.lundi).bord;
  assert.ok(bord.aConfirmer.total >= 3, "une ligne de répartitions provisoires, une de points, la semaine type");
  assert.equal(bord.aConfirmer.lignes.length, 3, 'le reste n\'est pas perdu : il est compté, et dit sur le détail du jour');
  assert.match(bord.aConfirmer.lignes.map((l) => l.texte).join(' | '), /répartition provisoire|semaine type/i);
});

test('bord : un écart à arbitrer est une ligne de « À confirmer » qui mène à la feuille du jour', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  planifier(e, principaleDe(e, c), S.mardi, 'apres_midi', h());
  marquerFait(e, principaleDe(e, c), undefined, h(1));
  prevision(e, S.mercredi, 1, 20);
  const ligne = tableauBlanc(e, S.mardi).bord.aConfirmer.lignes.find((l) => /écart/.test(l.texte));
  assert.ok(ligne, 'écart à arbitrer');
  assert.equal(ligne.lien, `#/production/${S.mardi}`);
});

test('bord : le repli « À confirmer » compte les mêmes écarts que le bandeau (decisionsDe), même un jour fermé', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  planifier(e, principaleDe(e, c), S.mardi, 'apres_midi', h());
  marquerFait(e, principaleDe(e, c), undefined, h(1));
  prevision(e, S.mercredi, 1, 20);
  for (const jour of [S.mardi, S.dimanchePrecedent]) {
    const attendu = decisionsDe(e, jour).cartes.filter((x) => x.genre === 'ecart').length;
    assert.ok(attendu > 0, `${jour} : le bandeau voit l'écart`);
    const ligne = tableauBlanc(e, jour).bord.aConfirmer.lignes.find((l) => /écart/.test(l.texte));
    assert.ok(ligne, `${jour} : le repli aussi`);
    assert.equal(ligne.n, attendu, jour);
  }
});

test('bord : production = jauge « x/y fait » vers Jour ; une avance possible et le chiffrage restent dits calmement', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  planifier(e, p, S.mardi, 'apres_midi', h());
  let { production } = tableauBlanc(e, S.mardi).bord;
  assert.deepEqual(production.avancement, { faites: 0, total: 1 });
  assert.equal(production.lien, `#/production/${S.mardi}`);
  marquerFait(e, p, undefined, h(1));
  production = tableauBlanc(e, S.mardi).bord.production;
  assert.deepEqual(production.avancement, { faites: 1, total: 1 });
  const sansTache = tableauBlanc(etatVide(), S.mardi).bord.production;
  assert.deepEqual(sansTache.avancement, { faites: 0, total: 0 });
});

test('bord : une commande à revérifier mène à Produits', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.equal(tableauBlanc(e, S.lundi).bord.production.commande, null, 'rien à relire sans contrôle');
  controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'a_commander', 100, h());
  prevision(e, S.lundi, 1, 50);
  const commande = tableauBlanc(e, S.lundi).bord.production.commande;
  assert.ok(commande, 'le besoin a changé depuis le contrôle');
  assert.equal(commande.lien, `#/stock/achats/${S.lundi}`);
});

test('bord : chaque ancienne ligne de la note a une destination (chiffrage, sauvegarde, semaine type)', () => {
  const e = semaine();
  const bord = tableauBlanc(e, S.lundi).bord;
  assert.ok(bord.aConfirmer.lignes.some((l) => /semaine type/i.test(l.texte)) || bord.aConfirmer.total >= 3);
  const vieux = tableauBlanc(e, '2026-10-30');
  assert.ok(vieux.bord.entete.sauvegarde, 'le rappel de sauvegarde garde une place (en-tête)');
  assert.equal(vieux.bord.entete.sauvegarde.lien, '#/reglages');
  const e2 = etatVide();
  definirMenu(e2, S.lundi, 1, 'riz, carottes', h());
  prevision(e2, S.lundi, 1, 10);
  const sansPortion = tableauBlanc(e2, S.lundi).bord.production.chiffrage;
  assert.ok(sansPortion.length >= 1, 'portions à régler : dites comme information neutre');
  assert.ok(sansPortion.every((l) => l.lien.startsWith('#/')));
});

test('bord : l\'action de l\'en-tête mène à la feuille du jour', () => {
  assert.equal(tableauBlanc(semaine(), S.mardi).bord.entete.lienJour, `#/production/${S.mardi}`);
});

test('bord : « À confirmer » compte des lignes distinctes ; les « conservation à confirmer » sont regroupées en une ligne', () => {
  const e = etatVide();
  for (const jour of [S.mercredi, S.jeudi]) prevision(e, jour, 1, 10);
  const ids = [
    composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST),
    composantValide(e, S.mercredi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_SEC_BIS_TEST' }),
    composantValide(e, S.jeudi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_SEC_TER_TEST' }),
  ];
  for (const id of ids) planifier(e, principaleDe(e, id), S.mardi, 'apres_midi', h());
  const { aConfirmer } = tableauBlanc(e, S.mardi).bord;
  const conservation = aConfirmer.lignes.filter((l) => /conservation à confirmer/.test(l.texte));
  assert.equal(conservation.length, 1, 'une seule ligne pour toutes les préparations');
  assert.equal(conservation[0].texte, '3 préparations : conservation à confirmer');
  assert.equal(aConfirmer.total, aConfirmer.lignes.length + aConfirmer.reste, 'le titre compte des lignes, pas des points');
  assert.ok(aConfirmer.lignes.length <= 3);
});

test('bord : la sauce implicite d\'un plat de pâtes est marquée implicite et n\'est pas un plat du menu', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'pâtes à l\'aneth', h());
  prevision(e, S.lundi, 1, 40);
  const menu = tableauBlanc(e, S.lundi).bord.menus.visibles.find((j) => j.date === S.lundi).menus.find((m) => m.menu === 1);
  const implicites = menu.morceaux.filter((m) => m.implicite);
  assert.deepEqual(implicites.map((m) => m.texte), ['sauce à confirmer']);
  assert.ok(menu.morceaux.filter((m) => !m.implicite).length >= 1, 'ce que le chef a écrit reste distinct');
});

test('bord : une autre semaine affichée a sa propre production, jamais les chiffres d\'aujourd\'hui', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  planifier(e, principaleDe(e, composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST)), S.mardi, 'apres_midi', h());
  prevision(e, '2026-10-14', 1, 10);
  planifier(e, principaleDe(e, composantValide(e, '2026-10-14', 1, J.PRODUIT_SEC_TEST)), '2026-10-13', 'apres_midi', h());
  const courante = tableauBlanc(e, S.mardi).bord.production;
  assert.equal(courante.autreSemaine, false);
  assert.deepEqual(courante.avancement, { faites: 0, total: 1 });
  const autre = tableauBlanc(e, S.mardi, S.lundiSuivant).bord.production;
  assert.equal(autre.autreSemaine, true);
  assert.equal(autre.lundi, S.lundiSuivant);
  assert.deepEqual(autre.avancement, { faites: 0, total: 1 }, 'la tâche de la semaine affichée, pas celle d\'aujourd\'hui');
  assert.equal(autre.avances, 0);
  assert.equal(autre.lien, `#/production/${S.lundiSuivant}`);
});

test('bord : les menus d\'une autre semaine sont les trois premiers jours à menu saisi de cette semaine', () => {
  const e = etatVide();
  for (const jour of ['2026-10-14', '2026-10-15', '2026-10-16']) { menuValide(e, jour, 1, 'INTITULE_TEST_1'); prevision(e, jour, 1, 10); }
  const { menus } = tableauBlanc(e, S.mardi, S.lundiSuivant).bord;
  assert.deepEqual(menus.visibles.map((j) => j.date), ['2026-10-14', '2026-10-15', '2026-10-16'], 'les jours sans menu saisi ne prennent pas la place');
});
