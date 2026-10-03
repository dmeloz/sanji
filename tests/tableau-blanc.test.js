// Tableau blanc : données de l'accueil et note du contexte. Jeux TEST_ONLY, mots de catégorie génériques.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creerFiche, definirMenu, definirRegle, definirStandard, demarrer, marquerFait, planifier,
} from '../app/js/domaine/actions.js';
import { decisionsSansDoublon, tableauBlanc } from '../app/js/domaine/tableau-blanc.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision, principaleDe } from './aide.js';
import { etatReglette } from './aide-tableau.js';

const composantNomme = (e, date, nom) => Object.values(e.composants).find((c) => c.date === date && c.nom === nom).id;
const textes = (contexte) => contexte.lignes.map((l) => l.texte);
/** Fait une tâche le jour même de son service (planifiée avant midi) : l'horodatage de test est antérieur. */
function faireLeJourMeme(e, date, nom) {
  const production = principaleDe(e, composantNomme(e, date, nom));
  planifier(e, production, date, 'avant_midi', h());
  marquerFait(e, production, null, h());
}

/** Semaine du 5 octobre : menus du lundi et du mardi, sans portion ni prévision. */
function semaineSaisie() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz et carottes', h());
  definirMenu(e, S.lundi, 2, 'poulet, riz, carottes', h());
  definirMenu(e, S.mardi, 1, 'pâtes aux courgettes', h());
  definirMenu(e, S.mardi, 2, 'poisson, quinoa, poireaux', h());
  return e;
}

/** La même semaine, avec les standards maison et les prévisions : tout est chiffrable. */
function semaineChiffree() {
  const e = semaineSaisie();
  for (const [famille, role, etat] of [['riz', 'plat_principal', 'sec'], ['riz', 'garniture', 'sec'], ['carottes', 'garniture', 'cru_net'],
    ['pates_seches', 'plat_principal', 'sec'], ['quinoa', 'garniture', 'sec'], ['poireaux', 'garniture', 'cru_net']]) {
    definirStandard(e, famille, role, { valeur: 100, unite: 'g', etat }, h());
  }
  for (const jour of [S.lundi, S.mardi]) { prevision(e, jour, 1, 10); prevision(e, jour, 2, 20); }
  return e;
}

test('base vide : contexte « vide » du lundi au jeudi, « semaine prochaine » du vendredi au dimanche', () => {
  for (const jour of [S.lundi, S.mardi, S.mercredi, S.jeudi]) {
    const tb = tableauBlanc(etatVide(), jour);
    assert.equal(tb.contexte.type, 'vide', jour);
    assert.equal(tb.lundi, S.lundi);
    assert.deepEqual(tb.contexte.action, { libelle: 'Saisir les menus de la semaine', lien: `#/menus/${S.lundi}` });
  }
  for (const jour of [S.vendredi, S.samedi, S.dimanche]) {
    const tb = tableauBlanc(etatVide(), jour);
    assert.equal(tb.contexte.type, 'semaine_prochaine', jour);
    assert.equal(tb.lundi, S.lundiSuivant, `${jour} : la semaine affichée est la suivante`);
    assert.equal(tb.estSemaineCourante, false);
    assert.deepEqual(tb.contexte.action, { libelle: 'Saisir les menus de la semaine', lien: `#/menus/${S.lundiSuivant}` });
  }
  assert.equal(tableauBlanc(etatVide(), S.dimanche).contexte.titre, "Fermé aujourd'hui");
});

test('six jours du lundi au samedi, aujourd\'hui marqué et déplié, navigation de semaine', () => {
  const tb = tableauBlanc(etatVide(), S.mercredi);
  assert.deepEqual(tb.jours.map((j) => j.date), [S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi, S.samedi]);
  assert.deepEqual(tb.jours.filter((j) => j.estAujourdhui).map((j) => j.date), [S.mercredi]);
  assert.deepEqual(tb.jours.filter((j) => j.deplie).map((j) => j.date), [S.mercredi]);
  assert.equal(tb.jours[5].aMenu, false, 'pas de menu du jour le samedi');
  assert.equal(tb.semainePrecedente, '2026-09-28');
  assert.equal(tb.semaineSuivante, S.lundiSuivant);
  const force = tableauBlanc(etatVide(), S.mercredi, '2026-10-14');
  assert.equal(force.lundi, S.lundiSuivant, 'la semaine forcée est ramenée au lundi');
  assert.equal(force.contexte.type, 'vide', 'le contexte reste celui d\'aujourd\'hui');
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
  prevision(e, S.lundi, 1, 40);
  creerFiche(e, { numero: 'FICHE_TEST', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 12, mode: 'choix_libre',
    repartition: { 1: 8, 2: 4 }, allergies: 'ALLERGIE_TEST' }, h());
  lundi = tableauBlanc(e, S.lundi).jours[0];
  assert.deepEqual(lundi.menus.map((m) => [m.couverts, m.provisoires]), [[48, true], [4, true]]);
  assert.deepEqual(lundi.groupes.map((g) => [g.numero, g.couverts, g.aAllergies]), [['FICHE_TEST', 12, true]]);
});

test('besoins : portions à régler, éléments inconnus et prévisions sont dits une fois, avec l\'action qui les règle', () => {
  const e = semaineSaisie();
  definirMenu(e, S.mercredi, 1, 'ELEMENT_INCONNU_TEST', h());
  const tb = tableauBlanc(e, S.mercredi);
  assert.equal(tb.contexte.type, 'service');
  const lignes = textes(tb.contexte);
  assert.ok(lignes.includes('6 portions à régler dans les standards maison'), lignes.join(' | '));
  assert.ok(lignes.includes('1 élément du menu à préciser'));
  // Les points déjà dits dans la note ne sont pas comptés jour par jour.
  assert.equal(tb.jours[0].nbPoints, 0);
  // Aucune quantité n'est inventée : la tâche existe, sans chiffre.
  assert.ok(tb.jours[0].miseEnPlace.every((t) => t.quantite === null && t.symbole === 'a_faire'));
  // Jeudi, sans tâche du jour : l'action principale suit le besoin le plus bloquant.
  const jeudi = tableauBlanc(e, S.jeudi).contexte;
  assert.equal(jeudi.type, 'apres_service');
  assert.deepEqual(jeudi.action, { libelle: 'Régler les standards maison', lien: '#/reglages' });
  // Une fois les standards réglés, il reste les prévisions.
  for (const [famille, role, etat] of [['riz', 'plat_principal', 'sec'], ['riz', 'garniture', 'sec'], ['carottes', 'garniture', 'cru_net'],
    ['pates_seches', 'plat_principal', 'sec'], ['quinoa', 'garniture', 'sec'], ['poireaux', 'garniture', 'cru_net']]) {
    definirStandard(e, famille, role, { valeur: 100, unite: 'g', etat }, h());
  }
  const apres = tableauBlanc(e, S.jeudi).contexte;
  assert.ok(!textes(apres).some((t) => /portions? à régler/.test(t)));
  assert.ok(textes(apres).includes('Prévisions à saisir pour 3 jours'));
  assert.deepEqual(apres.action, { libelle: 'Saisir les prévisions', lien: `#/menus/${S.lundi}` });
});

test('contexte « service » : ce qui reste à faire avant le service, avec la quantité ; puis « après le service »', () => {
  const e = semaineChiffree();
  let tb = tableauBlanc(e, S.lundi);
  assert.equal(tb.contexte.type, 'service');
  assert.equal(tb.contexte.titre, 'Avant le service de midi');
  const taches = tb.contexte.lignes.filter((l) => l.genre === 'tache');
  assert.deepEqual(taches.map((l) => [l.texte, l.quantite, l.symbole]),
    [['riz et carottes', '1 000 g', 'a_faire'], ['riz', '2 000 g', 'a_faire'], ['carottes', '2 312 g', 'a_faire']]);
  assert.deepEqual(tb.contexte.action, { libelle: 'Ouvrir la feuille du jour', lien: `#/jour/${S.lundi}` });
  // Une tâche démarrée puis toutes faites : le contexte bascule sur l'après-service.
  demarrer(e, principaleDe(e, composantNomme(e, S.lundi, 'riz')), h());
  assert.equal(tableauBlanc(e, S.lundi).jours[0].miseEnPlace.find((t) => t.nom === 'riz').symbole, 'en_cours');
  for (const nom of ['riz et carottes', 'riz', 'carottes']) faireLeJourMeme(e, S.lundi, nom);
  tb = tableauBlanc(e, S.lundi);
  assert.equal(tb.contexte.type, 'apres_service');
  assert.equal(tb.contexte.titre, 'Après le service');
  assert.deepEqual(tb.jours[0].compte, { a_decider: 0, a_faire: 0, en_cours: 0, non_couvert: 0, pret: 3, total: 3 });
  // Mardi sans tâche du jour à faire : rappel de la revue de mi-semaine.
  for (const nom of ['pâtes aux courgettes', 'quinoa', 'poireaux']) faireLeJourMeme(e, S.mardi, nom);
  assert.ok(textes(tableauBlanc(e, S.mardi).contexte).some((t) => /Revue de mi-semaine/.test(t)));
});

test('avances : seules les avances autorisées et chiffrées sont proposées, les autres sont résumées sans alarme', () => {
  const e = semaineChiffree();
  // Samedi : lundi est à 2 jours (autorisé), mardi à 3 jours (exception, sans règle).
  let c = tableauBlanc(e, S.samediPrecedent).contexte;
  assert.equal(c.type, 'semaine_prochaine');
  const avances = c.lignes.filter((l) => l.genre === 'avance');
  assert.equal(avances.length, 3, 'les trois préparations du lundi');
  assert.ok(avances.every((l) => /pour lundi 5 octobre/.test(l.texte) && l.symbole === 'a_faire' && l.quantite));
  assert.ok(avances.every((l) => l.detail === "2 jours d'avance, conservation à confirmer"));
  assert.ok(textes(c).includes("3 préparations pourraient être avancées dès aujourd'hui avec une règle de préparation validée."));
  // Avec une règle validée pour une préparation du mardi, elle devient une avance proposée.
  definirRegle(e, { nom: 'quinoa', avanceMaxJours: 3, limiteUtilisationJours: 3 }, h());
  c = tableauBlanc(e, S.samediPrecedent).contexte;
  assert.ok(c.lignes.some((l) => l.genre === 'avance' && /^quinoa, pour mardi 6 octobre/.test(l.texte)));
  // Vendredi : lundi est à 3 jours, rien n'est autorisé sans règle, et rien n'est marqué en rouge.
  const vendredi = tableauBlanc(e, S.veille).contexte;
  assert.equal(vendredi.lignes.filter((l) => l.genre === 'avance').length, 0);
  assert.ok(vendredi.lignes.every((l) => l.symbole !== 'a_decider'), 'aucune alerte : les besoins sont des cases à cocher');
  // Dimanche : fermé, aucune avance proposée.
  assert.equal(tableauBlanc(e, S.dimanchePrecedent).contexte.lignes.filter((l) => l.genre === 'avance').length, 0);
});

test('un vendredi avec des tâches à faire reste sur la semaine en cours ; chaque symbole est distingué', () => {
  const { e, jour } = etatReglette(); // service du vendredi 2 octobre
  const tb = tableauBlanc(e, jour);
  assert.equal(tb.contexte.type, 'service');
  assert.equal(tb.lundi, '2026-09-28');
  const vendredi = tb.jours[4];
  assert.equal(vendredi.deplie, true);
  const parNom = Object.fromEntries(vendredi.miseEnPlace.map((t) => [t.nom, t.symbole]));
  assert.equal(parNom.ELEMENT_PRET_TEST, 'pret');
  assert.equal(parNom.ELEMENT_HORS_LIMITE_TEST, 'non_couvert');
  assert.equal(parNom.ELEMENT_EN_COURS_TEST, 'en_cours');
  assert.equal(parNom.ELEMENT_A_FAIRE_TEST, 'a_faire');
  assert.equal(parNom.ELEMENT_A_PLANIFIER_TEST, 'a_faire', 'une tâche pas encore planifiée n\'est pas une décision');
  assert.equal(parNom.ELEMENT_A_PRECISER_TEST, 'a_faire', 'une tâche sans quantité n\'est pas une décision');
  assert.equal(parNom.ELEMENT_ECART_TEST, 'a_decider', 'seul un écart demande un arbitrage');
  assert.ok(textes(tb.contexte).concat(`${tb.contexte.autres}`).length > 0);
  // Tri : ce qui demande une action d'abord, ce qui est prêt à la fin.
  const ordre = vendredi.miseEnPlace.map((t) => t.symbole);
  assert.equal(ordre[0], 'a_decider');
  assert.equal(ordre[ordre.length - 1], 'pret');
});

test('la note ne dépasse pas six lignes et dit combien il en reste', () => {
  const { e, jour } = etatReglette();
  const c = tableauBlanc(e, jour).contexte;
  assert.ok(c.lignes.length <= 6);
  assert.ok(c.autres >= 1);
});

test('decisionsSansDoublon : une tâche seulement « à planifier » déjà proposée en avance n\'est pas répétée', () => {
  const feuille = {
    aAvancer: [{ productionId: 'p1' }],
    decisions: [{ productionId: 'p1', motif: 'a_planifier' }, { productionId: 'p1', motif: 'ecart' }, { productionId: 'p2', motif: 'a_planifier' }],
  };
  assert.deepEqual(decisionsSansDoublon(feuille).map((d) => [d.productionId, d.motif]), [['p1', 'ecart'], ['p2', 'a_planifier']]);
});

test('une tâche planifiée la veille reste visible sur le tableau du jour de service', () => {
  const e = semaineChiffree();
  planifier(e, principaleDe(e, composantNomme(e, S.lundi, 'carottes')), S.samediPrecedent, 'apres_midi', h());
  const lundi = tableauBlanc(e, S.lundi).jours[0];
  assert.equal(lundi.miseEnPlace.find((t) => t.nom === 'carottes').planifiee, true);
  assert.equal(lundi.miseEnPlace.find((t) => t.nom === 'riz').planifiee, false);
});

test('une garniture générique sans chiffre n\'est pas une question posée au chef', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'poulet, tomates', h()); // légume sans famille connue : générique, portions seulement
  const lundi = tableauBlanc(e, S.lundi).jours[0];
  assert.equal(Object.values(e.composants).find((c) => c.nom === 'tomates').type, 'generique');
  assert.equal(lundi.nbPoints, 0);
  assert.deepEqual(lundi.miseEnPlace.map((t) => [t.nom, t.symbole]), [['tomates', 'a_faire']]);
});
