// Garde-fou sur le temps : une semaine passée ne s'écrase pas par erreur. Données TEST_ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { etatVide } from './aide.js';
import {
  ajouterComposant, annulerFiche, creerFiche, definirMenu, definirPrevision, marquerFait, modifierComposant, modifierFiche,
  saisirMenusSemaine, supprimerComposant, saisirVentes,
} from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { semainePassee } from '../app/js/domaine/dates.js';

const MAINTENANT = '2026-10-14T09:00:00.000Z'; // mercredi ; semaine en cours : lundi 12
const PASSE = '2026-10-06'; // mardi de la semaine du 5 (passée)
const LUNDI_PASSE = '2026-10-05';
const COURANT = '2026-10-13';
const FUTUR = '2026-10-20';
const AVANT_PASSE = '2026-10-01T08:00:00.000Z'; // l'horloge d'alors : la semaine du 5 était à venir
const MESSAGE = /Cette semaine est passée : elle ne peut plus être modifiée/;

function etatAvecSemainePassee() {
  const e = etatVide();
  definirMenu(e, PASSE, 1, 'riz, carottes', AVANT_PASSE);
  definirPrevision(e, PASSE, 1, 30, AVANT_PASSE);
  creerFiche(e, { numero: 'F1', date: PASSE, service: 'midi', couverts: 10, mode: 'choix_libre' }, AVANT_PASSE);
  return e;
}

test('semainePassee : lundi antérieur au lundi de la date du jour', () => {
  assert.equal(semainePassee(PASSE, '2026-10-14'), true);
  assert.equal(semainePassee(COURANT, '2026-10-14'), false);
  assert.equal(semainePassee('2026-10-18', '2026-10-14'), false, 'dimanche de la semaine en cours');
  assert.equal(semainePassee(FUTUR, '2026-10-14'), false);
});

test('chaque action protégée refuse une semaine passée, état intact', () => {
  const e = etatAvecSemainePassee();
  const ficheId = Object.keys(e.fiches)[0];
  const compId = Object.keys(e.composants)[0];
  const avant = JSON.stringify(e);
  const essais = {
    definirMenu: () => definirMenu(e, PASSE, 1, 'pâtes', MAINTENANT),
    saisirMenusSemaine: () => saisirMenusSemaine(e, LUNDI_PASSE, { [PASSE]: { menu1: 'pâtes' } }, MAINTENANT),
    ajouterComposant: () => ajouterComposant(e, PASSE, 1, { nom: 'courgettes' }, MAINTENANT),
    supprimerComposant: () => supprimerComposant(e, compId, MAINTENANT),
    definirPrevision: () => definirPrevision(e, PASSE, 1, 50, MAINTENANT),
    definirCouvertsMidi: () => definirCouvertsMidi(e, PASSE, { total: 60 }, MAINTENANT),
    creerFiche: () => creerFiche(e, { numero: 'F2', date: PASSE, service: 'midi', couverts: 5, mode: 'choix_libre' }, MAINTENANT),
    modifierFiche: () => modifierFiche(e, ficheId, { couverts: 12 }, MAINTENANT),
    annulerFiche: () => annulerFiche(e, ficheId, MAINTENANT),
  };
  for (const [nom, essai] of Object.entries(essais)) assert.throws(essai, MESSAGE, nom);
  assert.equal(JSON.stringify(e), avant);
});

test('déplacer une fiche vers une semaine passée est refusé aussi', () => {
  const e = etatVide();
  const id = creerFiche(e, { numero: 'F1', date: COURANT, service: 'midi', couverts: 10, mode: 'choix_libre' }, MAINTENANT);
  assert.throws(() => modifierFiche(e, id, { date: PASSE }, MAINTENANT), MESSAGE);
});

test('la semaine courante et une semaine future restent modifiables', () => {
  const e = etatVide();
  for (const date of [COURANT, FUTUR]) {
    definirMenu(e, date, 1, 'riz, carottes', MAINTENANT);
    definirPrevision(e, date, 1, 40, MAINTENANT);
    ajouterComposant(e, date, 1, { nom: 'courgettes' }, MAINTENANT);
    definirCouvertsMidi(e, date, { total: 60 }, MAINTENANT);
    creerFiche(e, { numero: 'F', date, service: 'midi', couverts: 5, mode: 'choix_libre' }, MAINTENANT);
  }
  saisirMenusSemaine(e, '2026-10-12', { [COURANT]: { menu1: 'pâtes' } }, MAINTENANT);
  assert.equal(e.jours[COURANT].menus[1].intitule, 'pâtes');
});

test('ventes, fait, corrections de portion d\'un jour passé restent acceptées', () => {
  const e = etatAvecSemainePassee();
  const comp = Object.values(e.composants)[0];
  saisirVentes(e, PASSE, 1, 28, MAINTENANT);
  modifierComposant(e, comp.id, { grammage: { valeur: 120, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'essai' } }, MAINTENANT);
  const prod = Object.values(e.productions)[0];
  marquerFait(e, prod.id, 5, MAINTENANT);
  assert.equal(e.productions[prod.id].etat, 'fait');
  assert.equal(e.composants[comp.id].grammage.valeur, 120);
});

test('importer un ancien état avec des semaines passées fonctionne', () => {
  const e = etatAvecSemainePassee();
  const copie = importer(exporter(e, MAINTENANT));
  assert.equal(copie.jours[PASSE].menus[1].intitule, 'riz, carottes');
});
