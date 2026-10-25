// Page Jour moins invasive (décision du 2026-10-03) : une quantité inconnue n'est pas une décision.
// Jeux TEST_ONLY, mots de catégorie génériques.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirRegle, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision } from './aide.js';

/** Un samedi, le menu de la semaine suivante vient d'être enregistré, sans aucune quantité. */
function menuSansQuantites() {
  const e = etatVide();
  definirMenu(e, S.lundiSuivant, 1, 'poulet, riz, carottes', h());
  definirMenu(e, S.lundiSuivant, 2, 'courgettes', h());
  return e;
}

test('jour : sans aucune quantité, rien n\'est une décision ni une avance, tout est dans une seule liste', () => {
  const f = feuilleDuJour(menuSansQuantites(), S.samedi);
  assert.deepEqual(f.decisions, [], 'une quantité inconnue n\'est pas une décision');
  assert.deepEqual(f.aAvancer, [], 'aucune avance proposée tant que la quantité est inconnue');
  assert.deepEqual(f.quantitesManquantes.map((q) => q.nom).sort(), ['carottes', 'courgettes', 'poulet', 'riz']);
  assert.ok(f.quantitesManquantes.every((q) => q.dateService === S.lundiSuivant));
});

test('jour : les quantités saisies plus tard font passer chaque élément de la liste aux avances, et la baisse recalcule', () => {
  const e = menuSansQuantites();
  // Le riz du menu 1 se fait le jour même, sauf exception validée (ici : avance de 2 jours).
  definirRegle(e, { nom: 'riz', avanceMaxJours: 2 }, h());
  for (const famille of ['riz', 'carottes']) definirStandard(e, famille, 'plat_principal', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  assert.equal(feuilleDuJour(e, S.samedi).quantitesManquantes.length, 4, 'portions réglées mais prévision absente : toujours inconnu');
  prevision(e, S.lundiSuivant, 1, 10);
  let f = feuilleDuJour(e, S.samedi);
  assert.deepEqual(f.quantitesManquantes.map((q) => q.nom).sort(), ['courgettes'], 'reste la courgette : menu 2, sans prévision');
  assert.deepEqual(f.aAvancer.map((a) => a.nom).sort(), ['carottes', 'poulet', 'riz'], 'le poulet, générique, se compte en portions dès que la prévision existe');
  const riz = f.aAvancer.find((a) => a.nom === 'riz');
  assert.equal(riz.cible, 1000);
  // Le lendemain, le chef réduit la prévision : la cible suit sans autre geste.
  prevision(e, S.lundiSuivant, 1, 6);
  f = feuilleDuJour(e, S.samedi);
  assert.equal(f.aAvancer.find((a) => a.nom === 'riz').cible, 600);
});

test('jour : un élément planifié ou déjà décidé n\'est pas dans la liste des quantités manquantes', () => {
  const e = menuSansQuantites();
  definirRegle(e, { nom: 'riz', avanceMaxJours: 2 }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  prevision(e, S.lundiSuivant, 1, 10);
  const riz = feuilleDuJour(e, S.samedi).aAvancer.find((a) => a.nom === 'riz');
  planifier(e, riz.productionId, S.samedi, h());
  const f = feuilleDuJour(e, S.samedi);
  assert.equal(f.quantitesManquantes.some((q) => q.nom === 'riz'), false);
  assert.equal(f.aAvancer.some((a) => a.nom === 'riz'), false);
});
