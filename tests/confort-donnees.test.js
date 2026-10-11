// Marge de sécurité sur la seule quantité proposée à commander, rappel de sauvegarde, moyenne des ventes.
// Reprises de Kōzō validées le 2026-10-03. Jeux TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMargeSecurite, noterExport, saisirVentes } from '../app/js/domaine/actions.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { moyenneVentes, repereVentes } from '../app/js/domaine/points.js';
import { besoinsProduits, suiviProduit } from '../app/js/domaine/produits.js';
import { tableauBlanc } from '../app/js/domaine/tableau-blanc.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, poserControleProduit, prevision } from './aide.js';

function etatAvecBesoin() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  return e;
}

test('marge de sécurité : validée entre 0 et 50, vide par défaut, conservée par un export', () => {
  const e = etatVide();
  assert.equal(e.reglages.margeSecurite, null);
  assert.equal(definirMargeSecurite(e, 10, h()), 10);
  assert.equal(e.reglages.margeSecurite, 10);
  for (const mauvais of [-1, 51, 2.5, 'dix', Number.NaN]) {
    assert.throws(() => definirMargeSecurite(e, mauvais, h()), /Marge/, String(mauvais));
  }
  assert.equal(e.reglages.margeSecurite, 10, 'un refus ne change rien');
  assert.equal(importer(JSON.parse(JSON.stringify(exporter(e)))).reglages.margeSecurite, 10);
  definirMargeSecurite(e, null, h());
  assert.equal(e.reglages.margeSecurite, null);
});

test('marge de sécurité : majore la seule quantité proposée à commander, jamais le besoin ni la quantité à acheter', () => {
  const e = etatAvecBesoin();
  const ligne = besoinsProduits(e, S.lundi).lignes[0];
  assert.equal(ligne.besoinBrut, 500);
  poserControleProduit(e, S.lundi, ligne.cle, ligne.unite, 'a_commander', 100);
  assert.equal(suiviProduit(e, S.lundi, ligne).proposeeACommander, 400, 'sans marge');
  definirMargeSecurite(e, 10, h());
  const avec = suiviProduit(e, S.lundi, ligne);
  assert.equal(avec.proposeeACommander, 450, '500 + 10 % - 100');
  assert.equal(avec.margePourcent, 10);
  assert.equal(avec.besoinBrut, 500, 'le besoin brut n\'est pas majoré');
  assert.equal(avec.quantiteAcheter, null, 'la quantité à acheter n\'est jamais remplie seule');
  assert.equal(besoinsProduits(e, S.lundi).lignes[0].besoinBrut, 500);
  const sansVerif = suiviProduit(etatAvecBesoin(), S.lundi, ligne);
  assert.equal(sansVerif.proposeeACommander, null, 'rien n\'est proposé avant une vérification chiffrée');
});

test('sauvegarde : le rappel n\'apparaît qu\'après une semaine sans export, et disparaît à l\'export', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const rappel = (aujourdhui) => tableauBlanc(e, aujourdhui).bord.entete.sauvegarde;
  assert.equal(rappel(S.lundi), null, 'données toutes neuves : pas de rappel');
  const tard = rappel('2026-10-20');
  assert.ok(tard, 'jamais exportée et données anciennes : rappel');
  assert.match(tard.texte, /Sauvegarde à faire/);
  assert.equal(tard.lien, '#/reglages');
  noterExport(e, '2026-10-19T08:00:00');
  assert.equal(e.reglages.dernierExport, '2026-10-19T08:00:00');
  assert.equal(rappel('2026-10-20'), null);
  const dixJoursApres = rappel('2026-10-30');
  assert.match(dixJoursApres.detail, /dernier export il y a 11 jours/);
  assert.equal(importer(JSON.parse(JSON.stringify(exporter(e)))).reglages.dernierExport, '2026-10-19T08:00:00');
});

test('ventes : la moyenne des repères est un repère arrondi, jamais une prévision', () => {
  const e = etatVide();
  assert.equal(moyenneVentes(repereVentes(e, S.mercredi, 1)), null, 'aucune vente : pas de moyenne');
  for (const [date, v] of [['2026-09-16', 30], ['2026-09-23', 41], ['2026-09-30', 36]]) saisirVentes(e, date, 1, v, h());
  const repere = repereVentes(e, S.mercredi, 1);
  assert.equal(repere.length, 3);
  assert.equal(moyenneVentes(repere), 36, '(30 + 41 + 36) / 3 = 35,67 arrondi');
  assert.equal(e.jours[S.mercredi]?.previsions?.[1]?.portions ?? null, null, 'aucune prévision n\'est modifiée');
});
