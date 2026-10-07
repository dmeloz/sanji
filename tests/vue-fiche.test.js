// Fiche technique (refonte 1) : contenu affiché, « Mode en poste » seulement avec 2 étapes, « Fait », repli « Plus de réglages ».
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { creerFiche, definirRegle, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe, recetteValidee } from './aide.js';

let dom;
let magasin;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-fiche.js');
});
after(() => dom.restaurer());

const liens = (racine) => racine.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const libellesBoutons = (racine) => boutons(racine).map((b) => b.textContent);

function scenario(etapes = []) {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  if (etapes.length) definirRegle(e, { nom: 'carottes', etapes }, h());
  magasin.remplacer(e);
  return { e: magasin.etat(), c };
}

test('fiche : retour Production, nom, étiquette Brut, quantité du jour en police quantité', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  assert.ok(liens(racine).includes(`#/production/${S.lundi}`));
  assert.match(racine.textContent, /Production/);
  assert.match(racine.textContent, /carottes/);
  assert.match(racine.textContent, /Brut/);
  assert.match(racine.textContent, /À produire (aujourd'hui )?· pour /);
  const grande = racine.tous((x) => x.className.includes('fiche-qte-grande'))[0];
  assert.ok(grande, 'quantité en grand');
  assert.equal(calculerComposant(e, c).statut, 'CALCULE');
  assert.match(grande.textContent, /\d/);
});

test('fiche : répartition par menu et par fiche de fonction avec sa certitude', () => {
  const { e, c } = scenario();
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e, { numero: 'FICHE_TEST_2', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'choix_libre', repartition: { 1: 5, 2: 5 } }, h());
  const calc = calculerComposant(e, c);
  const lignes = vue.repartition(e.composants[c], calc);
  assert.deepEqual(lignes.map((l) => [l.libelle, l.certitude, l.portions]),
    [['Menu 1', 'estimée', 40], ['Fiche FICHE_TEST_1', 'confirmée', 10], ['Fiche FICHE_TEST_2', 'provisoire', 5]]);
  assert.ok(Math.abs(lignes.reduce((s, l) => s + l.part, 0) - calc.quantiteTravail) < 1e-6, 'les parts font la quantité du jour');
  const texte = vue.rendre(e, c).textContent;
  assert.match(texte, /Menu 1/);
  assert.match(texte, /FICHE_TEST_2/);
  assert.match(texte, /provisoire/);
  assert.doesNotMatch(texte, /\b(midi|soir)\b/i, 'pas de couverts midi / soir');
});

test('fiche : calcul et provenance dits en toutes lettres, jamais « en stock »', () => {
  const { e, c } = scenario();
  const texte = vue.rendre(e, c).textContent;
  assert.match(texte, /Calcul et provenance/);
  assert.match(texte, /calculé/);
  assert.match(texte, /Calcul : /);
  assert.doesNotMatch(texte, /en stock/i);
});

test('fiche : une quantité absente n\'est ni une décision ni une alerte', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' }); // aucune prévision
  magasin.remplacer(e);
  const racine = vue.rendre(magasin.etat(), c);
  assert.match(racine.textContent, /quantité inconnue/);
  assert.equal(racine.tous((x) => x.attributs.role === 'alert').length, 0);
});

test('fiche : étiquette Recette et ingrédients recalculés pour une préparation maison', () => {
  const e0 = etatVide();
  const r = recetteValidee(e0, J.RECETTE_TEST);
  prevision(e0, S.lundi, 1, 40);
  const c = composantValide(e0, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, type: 'preparation_maison', recetteId: r,
    grammage: { valeur: 50, unite: 'ml', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' } }, { nom: 'sauce maison' });
  magasin.remplacer(e0);
  const e = magasin.etat();
  const racine = vue.rendre(e, c);
  assert.match(racine.textContent, /Recette\b/);
  assert.match(racine.textContent, /Ingrédients recalculés/);
  assert.ok(calculerComposant(e, c).ingredients, 'le calcul fournit les ingrédients');
  assert.match(racine.textContent, /INGREDIENT_A_TEST/);
});

test('fiche : un produit brut n\'a pas de bloc d\'ingrédients', () => {
  const { e, c } = scenario();
  assert.doesNotMatch(vue.rendre(e, c).textContent, /Ingrédients recalculés/);
});

test('fiche : étapes de la règle avec leur état ; mode en poste seulement à partir de 2 étapes', () => {
  const sans = scenario();
  assert.match(vue.rendre(sans.e, sans.c).textContent, /Aucune étape/);
  assert.ok(!liens(vue.rendre(sans.e, sans.c)).some((l) => l.startsWith('#/poste')));

  const une = scenario([{ libelle: 'Couper', avanceMaxJours: 1 }]);
  assert.ok(!liens(vue.rendre(une.e, une.c)).some((l) => l.startsWith('#/poste')), 'une seule étape : pas de mode en poste');

  const deux = scenario([{ libelle: 'Couper', avanceMaxJours: 2 }, { libelle: 'Finir', avanceMaxJours: 0 }]);
  const racine = vue.rendre(deux.e, deux.c);
  assert.match(racine.textContent, /Couper/);
  assert.match(racine.textContent, /Finir/);
  assert.match(racine.textContent, /Mode en poste/);
  assert.ok(liens(racine).includes(`#/poste/${deux.c}`));
});

test('fiche : pastille « à mesurer », détail des portions et mentions « déjà avancé / prévu » (repris de l\'ancienne vue)', () => {
  const e0 = etatVide();
  prevision(e0, S.lundi, 1, 40);
  const c0 = composantValide(e0, S.lundi, 1, J.PRODUIT_CRU_TEST, { nom: 'carottes', etapes: [{ etape: 'parage', coefficient: 0.8, statut: 'STANDARD_BASE', source: 'ESTIMATION_TEST' }] });
  creerFiche(e0, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e0, { numero: 'FICHE_TEST_2', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 10, mode: 'choix_libre', repartition: { 1: 5, 2: 5 } }, h());
  definirRegle(e0, { nom: 'carottes', etapes: [{ libelle: 'Couper', avanceMaxJours: 3 }, { libelle: 'Blanchir', avanceMaxJours: 1 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  const couper = Object.values(e0.productions).find((p) => p.composantId === c0 && p.etapeCle === 'couper');
  const blanchir = Object.values(e0.productions).find((p) => p.composantId === c0 && p.etapeCle === 'blanchir');
  planifier(e0, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e0, couper.id, null, '2026-10-03T08:00:00.000Z');
  planifier(e0, blanchir.id, S.samediPrecedent, 'apres_midi', h());
  magasin.remplacer(e0);
  const e = magasin.etat();
  const calc = calculerComposant(e, c0);
  assert.equal(calc.aMesurer, true);
  const racine = vue.rendre(e, c0);
  const texte = racine.textContent;
  assert.match(texte, /à mesurer/);
  const p = calc.portions;
  assert.match(texte, new RegExp(`hors groupes ${p.prevision} ; groupes confirmés ${p.groupesConfirmes} ; groupes provisoires ${p.groupesProvisoires}`));
  assert.match(texte, /déjà avancé/);
  assert.match(texte, /prévu/);
  const etapes = racine.tous((x) => x.className.includes('fiche-etapes'))[0];
  assert.match(etapes.textContent, /Couper[\s\S]*déjà avancé sam\. 3/);
  assert.match(etapes.textContent, /Blanchir[\s\S]*prévu sam\. 3/);
  assert.doesNotMatch(etapes.textContent.split('Blanchir')[0], /prévu/);
});

test('fiche : sans standard de base à mesurer, pas de pastille « à mesurer »', () => {
  const { e, c } = scenario();
  assert.equal(calculerComposant(e, c).aMesurer, false);
  assert.doesNotMatch(vue.rendre(e, c).textContent, /à mesurer/);
});

test('fiche : allergènes « à confirmer » tant que non validés', () => {
  const { e, c } = scenario();
  assert.match(vue.rendre(e, c).textContent, /Allergènes[\s\S]*à confirmer/);
});

test('fiche : bloc Repères métier (replié) pour une famille qui en a', () => {
  const e0 = etatVide();
  prevision(e0, S.lundi, 1, 40);
  const c = composantValide(e0, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'riz' });
  magasin.remplacer(e0);
  assert.equal(magasin.etat().composants[c].famille, 'riz');
  const racine = vue.rendre(magasin.etat(), c);
  const bloc = racine.tous((x) => x.attributs.id === 'reperes-metier')[0];
  assert.ok(bloc, 'repères métier présents');
  assert.equal(bloc.open, false);
});

test('fiche : « Fait » marque la production principale puis propose « Corriger le réel » et « Annuler le fait »', () => {
  const { e, c } = scenario();
  const prod = principaleDe(e, c);
  assert.ok(prod);
  const zone = (r) => r.tous((x) => x.className === 'fiche-actions')[0];
  const fait = boutons(zone(vue.rendre(e, c))).find((b) => b.textContent === 'Fait');
  assert.ok(fait, 'bouton Fait');
  fait.click();
  assert.equal(magasin.etat().productions[prod].etat, 'fait');
  const apres = vue.rendre(magasin.etat(), c);
  assert.ok(libellesBoutons(zone(apres)).includes('Corriger le réel'));
  assert.ok(libellesBoutons(zone(apres)).includes('Annuler le fait'));
  assert.ok(!libellesBoutons(zone(apres)).includes('Fait'));
  boutons(zone(apres)).find((b) => b.textContent === 'Annuler le fait').click();
  assert.notEqual(magasin.etat().productions[prod].etat, 'fait');
});

test('fiche : « Plus de réglages » garde les gestes avancés de l\'ancienne vue composant', () => {
  const { e, c } = scenario();
  const racine = vue.rendre(e, c);
  const repli = racine.tous((x) => x.balise === 'details' && x.attributs.id === 'fiche-reglages')[0];
  assert.ok(repli, 'repli présent');
  assert.equal(repli.open, false, 'fermé par défaut');
  assert.match(repli.querySelector('summary').textContent, /Plus de réglages/);
  const dans = libellesBoutons(repli);
  for (const attendu of ['Modifier', 'Composer un mélange', 'Supprimer', 'Ajouter une étape', 'Enregistrer une pesée',
    'Mémoriser comme référence maison', 'Renseigner les allergènes', 'Saisir après service', 'Corriger pour ce plat seulement']) {
    assert.ok(dans.includes(attendu), `« ${attendu} » accessible`);
  }
  assert.ok(liens(repli).includes('#/reglages/standards'), 'standard maison');
});

test('fiche : composant introuvable', () => {
  magasin.remplacer(etatVide());
  const racine = vue.rendre(magasin.etat(), 'absent');
  assert.match(racine.textContent, /introuvable/);
  assert.ok(liens(racine).includes('#/production'));
});

test('fiche : le titre de l\'onglet', () => assert.equal(vue.titre(), 'Fiche technique'));

test('fiche : « Brut à prévoir » toujours visible ; sans parage connu, « inconnu · forme achetée à préciser », sans alerte', () => {
  const { e, c } = scenario();
  const calc = calculerComposant(e, c);
  const racine = vue.rendre(e, c);
  const ligne = racine.tous((x) => x.className.split(' ').includes('fiche-brut'))[0];
  assert.ok(ligne, 'la ligne est là');
  assert.match(ligne.textContent, /Brut à prévoir/);
  if (calc.etapes.some((x) => x.etape === 'parage' && x.appliquee) || /brut à prévoir/.test(calc.libelleQuantite)) assert.match(ligne.textContent, /\d/);
  else assert.match(ligne.textContent, /inconnu · forme achetée à préciser/);
  assert.equal(ligne.tous((x) => x.attributs?.role === 'alert').length, 0, 'aucune alerte');
});

test('fiche : la carte du haut et la ligne « Brut à prévoir » ne se contredisent jamais (produit simple : même quantité, jamais « inconnu »)', () => {
  const { e, c } = scenario();
  const calc = calculerComposant(e, c);
  assert.match(calc.libelleQuantite, /brut à prévoir/);
  const racine = vue.rendre(e, c);
  const ligne = racine.tous((x) => x.className.split(' ').includes('fiche-brut'))[0];
  assert.doesNotMatch(ligne.textContent, /inconnu/);
  assert.match(ligne.textContent.replace(/[  \s]/g, ''), new RegExp(String(Math.round(calc.brut))), 'la même quantité que la carte du haut');
});
