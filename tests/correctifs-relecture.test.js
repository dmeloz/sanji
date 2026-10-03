// Défauts trouvés par la relecture indépendante, rejoués ici (jeu de test : aucun nom de plat du restaurant n'entre dans app/).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assurerProductions, definirMenu, definirRegle, marquerFait, memoriser, modifierComposant, planifier, reprendreMemoire,
} from '../app/js/domaine/actions.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

const parNom = (etat, date, menu, nom) => Object.values(etat.composants).find((c) => c.date === date && c.menu === menu && c.nom.toLowerCase() === nom.toLowerCase());

// ---------------------------------------------------------------- 1. mémoire par menu

test('mémoire : une référence mémorisée en menu 1 ne contamine pas le menu 2 (protéine jamais attribuée par erreur)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Poulet rôti, carottes', h());
  const poulet1 = parNom(e, S.lundi, 1, 'Poulet rôti');
  assert.ok(poulet1, 'le poulet est lu au menu 1');
  memoriser(e, poulet1.id, h(1));
  assert.ok(e.memoire['poulet roti|1'], 'écrit sous la clé nom|menu');
  assert.equal(e.memoire['poulet roti'], undefined, 'plus de clé nom seule');
  definirMenu(e, S.mardi, 2, 'Poulet rôti, carottes', h(2));
  assert.equal(parNom(e, S.mardi, 2, 'Poulet rôti').attribue, false, 'une protéine du menu 2 n\'est pas mise au poste');
});

test('mémoire : une référence maison (grammage) mémorisée en menu 2 est reprise en menu 2, pas en menu 1', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'Riz', h());
  const riz2 = parNom(e, S.lundi, 2, 'Riz');
  modifierComposant(e, riz2.id, { role: 'garniture', grammage: { valeur: 111, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'cuit' } }, h(1));
  memoriser(e, riz2.id, h(2));
  assert.ok(e.memoire['riz|2']);
  definirMenu(e, S.mardi, 2, 'Riz', h(3));
  definirMenu(e, S.mardi, 1, 'Riz', h(4));
  const r2 = parNom(e, S.mardi, 2, 'Riz');
  const r1 = parNom(e, S.mardi, 1, 'Riz');
  modifierComposant(e, r2.id, { role: 'garniture' }, h(5));
  modifierComposant(e, r1.id, { role: 'garniture' }, h(5));
  assert.equal(grammageEffectif(e, e.composants[r2.id]).valeur, 111, 'repris par grammageEffectif en menu 2');
  assert.notEqual(grammageEffectif(e, e.composants[r1.id])?.valeur, 111, 'pas en menu 1');
  assert.ok(reprendreMemoire(e, r2.id, h(6)).champs.includes('grammage'));
  assert.deepEqual(reprendreMemoire(e, r1.id, h(7)), { applique: false, champs: [] });
});

test('mémoire : une entrée nom|menu issue de l\'attribution n\'empêche pas de reprendre le grammage mémorisé', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'Riz', h());
  const riz = parNom(e, S.lundi, 2, 'Riz');
  modifierComposant(e, riz.id, { role: 'garniture', grammage: { valeur: 90, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'cuit' } }, h(1));
  modifierComposant(e, riz.id, { attribue: false }, h(2)); // écrit nom|menu
  memoriser(e, riz.id, h(3));
  definirMenu(e, S.mardi, 2, 'Riz', h(4));
  const autre = parNom(e, S.mardi, 2, 'Riz');
  modifierComposant(e, autre.id, { role: 'garniture' }, h(5));
  assert.ok(reprendreMemoire(e, autre.id, h(6)).champs.includes('grammage'));
});

test('mémoire : repli sur l\'ancienne clé nom, sauf une protéine attribuée au poste en menu 2', () => {
  const e = etatVide();
  e.memoire.poulet = { nom: 'poulet', attribue: true, type: 'a_preciser', categorie: 'proteine', charge: null, parRole: {}, etapes: {} };
  definirMenu(e, S.lundi, 2, 'Poulet, carottes', h());
  assert.equal(parNom(e, S.lundi, 2, 'Poulet').attribue, false);
  definirMenu(e, S.lundi, 1, 'Poulet, carottes', h());
  assert.equal(parNom(e, S.lundi, 1, 'Poulet').attribue, true);
  assert.equal(typeof pointsAConfirmer(e, S.lundi).length, 'number');
});

// ---------------------------------------------------------------- 6. lectures corrigées : export puis import

test('lectures : le format liste et le format objet survivent à un export puis un import', () => {
  const e = etatVide();
  const liste = [{ nom: 'penne', categorie: 'feculent', propriete: 'poste', statut: 'reconnu' }];
  const objet = { elements: [{ nom: 'riz', categorie: 'feculent', propriete: 'poste', statut: 'reconnu' }], ambiguites: [{ type: 'choix', texte: 'riz' }] };
  e.lectures['penne zorglub|1'] = liste;
  e.lectures['riz zorglub|1'] = objet;
  const apres = importer(exporter(e, h()));
  assert.deepEqual(apres.lectures['penne zorglub|1'], liste);
  assert.deepEqual(apres.lectures['riz zorglub|1'], objet);
  assert.deepEqual(importer(exporter(apres, h())).lectures, e.lectures, 'stable au second passage');
  // Une valeur d'un autre format est écartée ; une clé dangereuse ne passe pas.
  const doc = JSON.parse(exporter(e, h()));
  doc.etat.lectures['texte|1'] = 'pas une lecture';
  doc.etat.lectures['__proto__'] = liste;
  doc.etat.lectures['sale|1'] = [{ nom: 'x', constructor: 1 }];
  const sale = importer(JSON.stringify(doc));
  assert.equal(Object.hasOwn(sale.lectures, 'texte|1'), false);
  assert.equal(Object.hasOwn(sale.lectures, '__proto__'), false);
  assert.deepEqual(sale.lectures['sale|1'], [{ nom: 'x' }]);
});

// ---------------------------------------------------------------- 4. sauce confirmée conservée

function penneConfirmee() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  const implicite = parNom(e, S.lundi, 1, 'sauce à confirmer');
  assert.ok(implicite, 'la sauce implicite est proposée « à confirmer »');
  modifierComposant(e, implicite.id, { nom: 'sauce tomate' }, h(1));
  return { e, id: implicite.id };
}

test('sauce : une sauce implicite confirmée (renommée) survit à une modification de l\'intitulé sans sauce écrite', () => {
  const { e, id } = penneConfirmee();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes et basilic', h(2));
  assert.equal(e.composants[id]?.nom, 'sauce tomate', 'la sauce confirmée est conservée');
  assert.equal(parNom(e, S.lundi, 1, 'sauce à confirmer'), undefined, 'aucune nouvelle sauce à confirmer');
  assert.equal(Object.values(e.composants).filter((c) => c.menu === 1 && c.categorie === 'sauce').length, 1);
});

test('sauce : avec une sauce écrite, l\'ancienne sauce confirmée est retirée et le journal le dit', () => {
  const { e, id } = penneConfirmee();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes, sauce pesto', h(2));
  assert.equal(e.composants[id], undefined);
  const derniere = e.journal.filter((j) => j.action === 'definirMenu').at(-1).detail;
  assert.match(derniere, /sauce tomate/);
  assert.match(derniere, /sauce confirmée/);
});

// ---------------------------------------------------------------- 3. feuille Jour : pas de doublon

test('feuille Jour : une tâche planifiée aujourd\'hui à quantité inconnue n\'est classée qu\'une fois', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  planifier(e, principaleDe(e, c), S.lundi, 'avant_midi', h());
  const { lecture } = feuilleDuJour(e, S.lundi);
  const lignes = [...lecture.service1, ...lecture.service2, ...lecture.autres, ...lecture.apres].filter((l) => l.productionId === principaleDe(e, c));
  assert.equal(lignes.length, 1, 'une seule ligne');
  assert.equal(lignes[0].source, 'decidee');
});

// ---------------------------------------------------------------- 2. étapes : ni plat passé ni plat fini

test('étapes : aucune étape fantôme pour un plat dont la finition est faite ou dont le service est passé', () => {
  const e = etatVide();
  const passe = composantValide(e, S.lundiChevauchement, 1, J.PRODUIT_SEC_TEST, { nom: 'purée de carottes' });
  const fini = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'purée de carottes' });
  const aVenir = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'purée de carottes' });
  marquerFait(e, principaleDe(e, passe), 100, '2026-09-28T10:00:00.000Z');
  marquerFait(e, principaleDe(e, fini), 100, '2026-10-04T09:00:00.000Z');
  const etapes = [{ libelle: 'Cuire', avanceMaxJours: 2 }, { libelle: 'Mixer', avanceMaxJours: 0 }];
  definirRegle(e, { nom: 'purée de carottes', etapes }, '2026-10-04T09:30:00.000Z');
  const etapesDe = (id) => Object.values(e.productions).filter((p) => p.composantId === id && p.genre === 'preparatoire');
  assert.equal(etapesDe(passe).length, 0, 'service passé : aucune étape');
  assert.equal(etapesDe(fini).length, 0, 'finition faite : aucune étape');
  assert.equal(etapesDe(aVenir).length, 1, 'plat à venir : l\'étape est créée');
  // Paramètre explicite pour les tests : le plat du lundi 5 est « passé » le mardi 6.
  const e3 = etatVide();
  const c3 = composantValide(e3, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'purée de carottes' });
  definirRegle(e3, { nom: 'purée de carottes', etapes }, h());
  assert.equal(Object.values(e3.productions).filter((p) => p.composantId === c3 && p.genre === 'preparatoire').length, 1);
  const e4 = etatVide();
  const c4 = composantValide(e4, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'purée de carottes' });
  e4.regles.r = { ...Object.values(e3.regles)[0] };
  assurerProductions(e4, null, S.mardi);
  assert.equal(Object.values(e4.productions).filter((p) => p.composantId === c4 && p.genre === 'preparatoire').length, 0);
});
