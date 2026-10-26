// Interface d'une semaine passée : lecture seule, dite en toutes lettres. Données TEST_ONLY.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, figerHorloge, installerFauxDom } from './aide-dom.js';
import { etatVide, h } from './aide.js';
import { definirMenu, creerFiche, definirPrevision } from '../app/js/domaine/actions.js';
import { detailDuJour } from './aide-detail.js';

const AUJOURD = '2026-10-14'; // mercredi ; semaine en cours : lundi 12
const LUNDI_PASSE = '2026-10-05';
const PASSE = '2026-10-06';
const COURANT = '2026-10-13';
const ANTERIEUR = "2026-10-01T08:00:00.000Z";
const LIBELLES_ECRITURE = ['Enregistrer la semaine', 'Modifier', 'Supprimer', 'Ajouter un composant', "Modifier l'intitulé", "Saisir l'intitulé", 'Nouvelle fiche', 'Annuler la fiche'];

let vueTableau; let feuilleCouverts; let dom; let magasin; let vueImport; let vueDetail; let feuilleServices; let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(AUJOURD);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueImport = await import('../app/js/ui/vue-import.js');
  vueDetail = await import('../app/js/ui/vue-detail.js');
  vueTableau = await import('../app/js/ui/vue-tableau.js');
  feuilleCouverts = await import('../app/js/ui/feuille-couverts.js');
  feuilleServices = await import('../app/js/ui/feuille-services.js');
});
after(() => { dom.restaurer(); rendreHorloge(); });

const libellesDe = (n) => boutons(n).map((b) => b.textContent);

function etatDeuxSemaines() {
  const e = etatVide();
  for (const date of [PASSE, COURANT]) {
    definirMenu(e, date, 1, 'riz, carottes', ANTERIEUR);
  }
  creerFiche(e, { numero: 'F0', date: PASSE, service: 'midi', couverts: 8, mode: 'choix_libre' }, ANTERIEUR);
  creerFiche(e, { numero: 'F1', date: COURANT, service: 'midi', couverts: 10, mode: 'choix_libre' }, ANTERIEUR);
  return e;
}

test('Import d\'une semaine passée : « lecture seule », sans Enregistrer ; la semaine courante garde Enregistrer', () => {
  magasin.remplacer(etatDeuxSemaines());
  const passee = vueImport.rendre(magasin.etat(), LUNDI_PASSE);
  assert.match(passee.textContent, /Semaine passée : lecture seule/);
  assert.ok(!libellesDe(passee).includes('Enregistrer la semaine'));
  const courante = vueImport.rendre(magasin.etat(), '2026-10-12');
  assert.doesNotMatch(courante.textContent, /lecture seule/);
  assert.ok(libellesDe(courante).includes('Enregistrer la semaine'));
});

test('Détail d\'un jour passé : le texte dit « lecture seule », aucun bouton d\'écriture ; jour courant inchangé', () => {
  const e = etatDeuxSemaines();
  magasin.remplacer(e);
  const passe = detailDuJour(vueDetail, magasin.etat(), PASSE);
  assert.match(passe.textContent, /Semaine passée : lecture seule/);
  for (const l of LIBELLES_ECRITURE) assert.ok(!libellesDe(passe).includes(l), l);
  const courant = detailDuJour(vueDetail, magasin.etat(), COURANT);
  assert.doesNotMatch(courant.textContent, /lecture seule/);
  assert.ok(libellesDe(courant).includes('Ajouter un composant'));
  assert.ok(libellesDe(courant).includes('Nouvelle fiche'));
});

test('Feuille Services d\'un jour passé : pas de Nouvelle fiche, la raison est écrite', () => {
  magasin.remplacer(etatDeuxSemaines());
  feuilleServices.ouvrirServices(PASSE);
  const ouverte = dom.corps.tous((x) => x.balise === 'dialog' && x.open)[0];
  assert.match(ouverte.textContent, /Semaine passée : lecture seule/);
  assert.ok(!libellesDe(ouverte).includes('Nouvelle fiche'));
  ouverte.close();
});

test('Tableau : le nombre de couverts d\'un jour passé est du texte sans bouton ; un jour courant garde son bouton', () => {
  const e = etatDeuxSemaines();
  definirPrevision(e, PASSE, 1, 20, ANTERIEUR);
  definirPrevision(e, COURANT, 1, 30, ANTERIEUR);
  magasin.remplacer(e);
  const nombres = (lundi) => vueTableau.rendre(magasin.etat(), lundi).tous((x) => x.className.split(' ').includes('tb-couverts'));
  const passes = nombres(LUNDI_PASSE);
  assert.deepEqual(passes.map((x) => x.textContent), ['20']);
  assert.ok(passes.every((x) => x.balise !== 'button'));
  const courants = nombres('2026-10-12');
  assert.deepEqual(courants.map((x) => x.textContent), ['30']);
  assert.ok(courants.every((x) => x.balise === 'button'));
});

test('Ventes du midi d\'un jour passé : pas de « Modifier les couverts », les ventes restent saisissables ; jour courant inchangé', () => {
  magasin.remplacer(etatDeuxSemaines());
  feuilleCouverts.ouvrirVentesMidi(PASSE);
  const passe = dom.corps.tous((x) => x.balise === 'dialog' && x.open)[0];
  assert.ok(!libellesDe(passe).includes('Modifier les couverts'));
  assert.ok(libellesDe(passe).includes('+'));
  passe.close();
  feuilleCouverts.ouvrirVentesMidi(COURANT);
  const courant = dom.corps.tous((x) => x.balise === 'dialog' && x.open)[0];
  assert.ok(libellesDe(courant).includes('Modifier les couverts'));
  courant.close();
});

test('Tableau : sans prévision, « couverts à saisir » est un bouton cette semaine et du simple texte sur une semaine passée', () => {
  magasin.remplacer(etatDeuxSemaines());
  const mentions = (lundi) => vueTableau.rendre(magasin.etat(), lundi).tous((x) => x.className.split(' ').includes('bord-jour-couverts') && /à saisir/.test(x.textContent));
  const passees = mentions(LUNDI_PASSE);
  assert.ok(passees.length > 0);
  assert.ok(passees.every((x) => x.balise !== 'button' && x.balise !== 'a'));
  const courantes = mentions('2026-10-12');
  assert.ok(courantes.length > 0);
  assert.ok(courantes.every((x) => x.balise === 'button'));
});
