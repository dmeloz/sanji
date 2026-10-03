// État du poids (sec, cru net, cuit) et standards maison : le calcul part du bon état sans jamais convertir deux fois ;
// les standards se définissent et se suppriment, passent avant la base, ne bougent que par ces actions et survivent
// à un export suivi d'un import. Les nombres viennent des jeux TEST_ONLY : aucun n'est une référence métier.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_METIER, PORTIONS_BASE } from '../app/js/donnees/base-metier.js';
import {
  definirMenu, definirStandard, marquerFait, modifierComposant, supprimerStandard,
} from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { APPLICATION, exporter, importer } from '../app/js/domaine/etat.js';
import { cibleProduction, etatTache } from '../app/js/domaine/planification.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_REPERES as R, JEU_MENUS as M, JEU_STANDARDS as ST } from './jeux/TEST_ONLY-savoir.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';

const parNom = (etat, date, nom) => Object.values(etat.composants).find((c) => c.date === date && c.nom === nom);
const portion = (valeur, etat) => ({ valeur, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat });
const presque = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
const milieu = (etape, produit) => {
  const l = BASE_METIER.find((x) => x.etape === etape && x.produit === produit);
  return (l.coefMin + l.coefMax) / 2;
};
// Ces tests supposent qu'aucun repère de portion n'est embarqué (section 11.4 absente de la source aujourd'hui).
const SANS_REPERES = PORTIONS_BASE.length === 0 ? false : 'PORTIONS_BASE n\'est plus vide : la source a une section 11.4';

// ---------------------------------------------------------------- état du poids

test('état du poids : une même portion donnée en sec n\'applique pas le gain de cuisson, donnée en cuit l\'applique', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: portion(100, 'sec') });
  const cuit = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_CUIT_TEST' }, { grammage: portion(100, 'cuit') });

  const s = calculerComposant(e, sec);
  assert.equal(s.statut, 'CALCULE');
  assert.equal(s.quantiteServie, 4000);
  assert.equal(s.quantiteTravail, 4000, 'déjà la quantité d\'avant cuisson : rien à remonter');
  assert.equal(s.brut, 4000);
  assert.deepEqual(s.etapes.map((x) => [x.etape, x.appliquee, x.quantiteAvant]), [['cuisson', false, null]]);
  assert.equal(s.quantiteCuiteEstimee, 8000, 'quantité × coefficient de cuisson, à titre d\'information');
  assert.match(s.formule, /portion exprimée en poids sec : le gain de cuisson n'est pas appliqué/);
  assert.match(s.formule, /quantité cuite estimée 8 000 g, à titre d'information seulement/);
  assert.deepEqual(s.dependances.map((d) => d.parametre), ['grammage'], 'une étape non appliquée n\'est pas une dépendance');

  const c = calculerComposant(e, cuit);
  assert.equal(c.quantiteTravail, 2000, '4 000 g cuits ÷ 2 (gain de cuisson)');
  assert.deepEqual(c.etapes.map((x) => [x.etape, x.appliquee, x.quantiteAvant]), [['cuisson', true, 2000]]);
  assert.equal(c.quantiteCuiteEstimee, null);
  assert.equal(c.formule, '40 portions × 100 g = 4 000 g servis ; ÷ 2,00 (cuisson, gain) = 2 000 g bruts');
  assert.deepEqual(c.dependances.map((d) => d.parametre), ['grammage', 'cuisson']);
});

test('état du poids : cru net n\'applique que le parage, ni portionnement ni cuisson', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const cru = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { grammage: portion(200, 'cru_net') });
  const c = calculerComposant(e, cru);
  assert.equal(c.quantiteServie, 8000);
  assert.deepEqual(c.etapes.map((x) => [x.etape, x.appliquee]), [['portionnement', false], ['cuisson', false], ['parage', true]]);
  assert.deepEqual(c.etapes.map((x) => x.quantiteAvant), [null, null, 16000]);
  assert.equal(c.brut, 16000, '8 000 g cru net ÷ 0,5 (parage) : seul le parage mène au brut');
  assert.equal(c.quantiteCuiteEstimee, 6400, '8 000 × 0,8 (cuisson), à titre d\'information seulement');
  assert.deepEqual(c.dependances.map((d) => d.parametre), ['grammage', 'parage']);
  assert.match(c.formule, /\(poids cru net\) ; ÷ 0,50 \(parage\) = 16 000 g bruts/);
  assert.match(c.formule, /portion exprimée en poids cru net : la perte de portionnement n'est pas appliquée ; la perte de cuisson n'est pas appliquée/);
  // Le même plat en cuit remonte toute la chaîne.
  modifierComposant(e, cru, { grammage: { etat: 'cuit' } }, h());
  const cuit = calculerComposant(e, cru);
  presque(cuit.brut, 8000 / 0.9 / 0.8 / 0.5);
  assert.deepEqual(cuit.etapes.map((x) => x.appliquee), [true, true, true]);
  assert.equal(cuit.quantiteCuiteEstimee, null);
});

test('état du poids : aucune double conversion, la même quantité physique donne le même brut dans chaque état', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  // Produit sec : 200 g cuits ≡ 100 g secs (gain de cuisson 2).
  const cuit = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: portion(200, 'cuit') });
  const sec = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_SEC_BIS_TEST' }, { grammage: portion(100, 'sec') });
  assert.equal(calculerComposant(e, cuit).brut, 4000);
  assert.equal(calculerComposant(e, sec).brut, 4000);
  // Produit cru : 144 g cuits (÷ 0,9 ÷ 0,8) ≡ 200 g cru net ; le brut vient du seul parage dans les deux cas.
  const cru = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST, { grammage: portion(200, 'cru_net') });
  const cuitCru = composantValide(e, S.lundi, 1, { ...J.PRODUIT_CRU_TEST, nom: 'PRODUIT_CRU_BIS_TEST' }, { grammage: portion(144, 'cuit') });
  presque(calculerComposant(e, cru).brut, 16000);
  presque(calculerComposant(e, cuitCru).brut, 16000);
  // Seule la quantité cuite estimée dépend de l'état, jamais le brut.
  assert.equal(calculerComposant(e, cuit).quantiteCuiteEstimee, null);
  assert.equal(calculerComposant(e, sec).quantiteCuiteEstimee, 8000);
});

test('état du poids : une préparation maison est toujours « cuit », quantité finie par portion', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const portionnement = { etape: 'portionnement', coefficient: 0.5, statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' };
  const cuisson = { etape: 'cuisson', coefficient: 2, statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' };
  const prep = composantValide(e, S.lundi, 1, J.PREPARATION_TEST, {
    grammage: { ...J.PREPARATION_TEST.grammage, etat: 'sec' }, etapes: [portionnement, cuisson],
  });
  const c = calculerComposant(e, prep);
  assert.deepEqual(c.etapes.map((x) => [x.etape, x.appliquee]), [['portionnement', true]], 'seul le portionnement concerne une préparation');
  assert.equal(c.quantiteTravail, 4000, '40 × 50 ml ÷ 0,5 : l\'état « sec » saisi n\'y change rien');
  assert.equal(c.quantiteCuiteEstimee, null);
  assert.equal(c.libelleQuantite, 'quantité finie à produire');
  assert.equal(grammageEffectif(e, e.composants[prep]).etat, 'cuit');
});

test('état du poids : une étape non appliquée ne rend pas le calcul « à valider » ni « à mesurer »', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const estimee = [{ etape: 'cuisson', coefficient: 2, statut: 'BASE_METIER_ESTIMATION', source: 'TEST_ONLY' }];
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: portion(100, 'sec'), etapes: estimee });
  const cuit = composantValide(e, S.lundi, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_CUIT_TEST' }, { grammage: portion(100, 'cuit'), etapes: estimee });
  const s = calculerComposant(e, sec);
  assert.deepEqual([s.aValider, s.aMesurer], [false, false], 'la cuisson estimée n\'entre pas dans la quantité');
  assert.equal(s.quantiteCuiteEstimee, 8000, 'mais l\'information reste donnée');
  const c = calculerComposant(e, cuit);
  assert.deepEqual([c.aValider, c.aMesurer], [true, true], 'appliquée : estimation à valider, écart ≥ 0,15 à mesurer');
  // Une portion estimée reste « à valider », quel que soit l'état.
  modifierComposant(e, sec, { grammage: { statut: 'BASE_METIER_ESTIMATION' } }, h());
  assert.equal(calculerComposant(e, sec).aValider, true);
});

test('état du poids : sans état connu une portion se lit « cuit » ; l\'état est validé et conservé', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const id = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.equal(e.composants[id].grammage.etat, 'cuit', 'valeur par défaut d\'un composant');
  // Donnée enregistrée avant l'état du poids : le champ manque, le sens reste « quantité servie ».
  delete e.composants[id].grammage.etat;
  assert.equal(calculerComposant(e, id).quantiteTravail, 2000);
  assert.equal(grammageEffectif(e, e.composants[id]).etat, 'cuit');
  // importer complète le champ.
  const relu = importer(exporter(e, h()));
  assert.equal(relu.composants[id].grammage.etat, 'cuit');
  // modifierComposant valide l'état et le conserve quand on ne touche qu'à la valeur.
  assert.throws(() => modifierComposant(e, id, { grammage: { etat: 'cru' } }, h()), /État du poids/);
  modifierComposant(e, id, { grammage: { etat: 'sec' } }, h());
  modifierComposant(e, id, { grammage: { valeur: 90 } }, h());
  assert.deepEqual([e.composants[id].grammage.valeur, e.composants[id].grammage.etat], [90, 'sec']);
});

// ---------------------------------------------------------------- standards maison

test('definirStandard : enregistre portion, unité, état du poids et horodatage, remplace, une ligne de journal', () => {
  const e = etatVide();
  const s = definirStandard(e, 'riz', 'garniture', ST.sec, h(3));
  assert.deepEqual(s, { valeur: 100, unite: 'g', etat: 'sec', h: h(3) });
  assert.deepEqual(e.standards, { riz: { garniture: { valeur: 100, unite: 'g', etat: 'sec', h: h(3) } } });
  assert.deepEqual(e.journal.map((x) => [x.h, x.action]), [[h(3), 'definirStandard']]);
  definirStandard(e, 'riz', 'garniture', ST.cuit, h(4));
  assert.deepEqual(e.standards.riz.garniture, { valeur: 100, unite: 'g', etat: 'cuit', h: h(4) }, 'remplace, ne duplique pas');
  definirStandard(e, 'riz', 'plat_principal', ST.cruNet, h(5));
  definirStandard(e, 'carottes', 'garniture', ST.cruNet, h(6));
  assert.deepEqual(Object.keys(e.standards).sort(), ['carottes', 'riz']);
  assert.deepEqual(Object.keys(e.standards.riz).sort(), ['garniture', 'plat_principal']);
  assert.equal(JSON.stringify(e.standards).includes('TEST_ONLY'), false, 'aucune étiquette de jeu de test dans l\'état');
  // Une portion décimale et d\'autres unités sont acceptées.
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 0.5, unite: 'piece', etat: 'cuit' }, h(7));
  assert.equal(e.standards.carottes.plat_principal.valeur, 0.5);
});

test('definirStandard : refuse les saisies invalides, sans rien modifier', () => {
  const e = etatVide();
  definirStandard(e, 'riz', 'garniture', ST.sec, h(1));
  const avant = copie(e);
  const valide = { valeur: 100, unite: 'g', etat: 'sec' };
  const refus = (args, motif) => assert.throws(() => definirStandard(e, ...args, h()), motif, JSON.stringify(args));
  refus(['inconnue', 'garniture', valide], /Famille de produits inconnue/);
  refus(['constructor', 'garniture', valide], /Famille de produits inconnue/);
  refus([undefined, 'garniture', valide], /Famille de produits inconnue/);
  refus(['riz', 'inconnu', valide], /Rôle/);
  refus(['riz', undefined, valide], /Rôle/);
  for (const valeur of [0, -1, NaN, Infinity, '100', null, undefined]) refus(['riz', 'garniture', { ...valide, valeur }], /strictement positif/);
  for (const unite of ['kg', 'G', undefined, null]) refus(['riz', 'garniture', { ...valide, unite }], /Unité/);
  for (const etat of ['cru', 'SEC', 'cuite', undefined, null]) refus(['riz', 'garniture', { ...valide, etat }], /État du poids/);
  for (const saisie of [null, undefined, 'texte', 100]) refus(['riz', 'garniture', saisie], /Standard invalide/);
  assert.throws(() => definirStandard(e, 'riz', 'garniture', valide), /Horodatage/);
  assert.throws(() => definirStandard(e, 'riz', 'garniture', valide, 'hier'), /Horodatage/);
  assert.deepEqual(e, avant, 'un refus ne modifie rien, pas même le journal');
});

test('supprimerStandard : supprime, refuse une famille ou un rôle inconnu, sans effet si rien à supprimer', () => {
  const e = etatVide();
  definirStandard(e, 'riz', 'garniture', ST.sec, h(1));
  definirStandard(e, 'riz', 'plat_principal', ST.cuit, h(2));
  definirStandard(e, 'carottes', 'garniture', ST.cruNet, h(3));
  assert.equal(supprimerStandard(e, 'riz', 'garniture', h(4)), true);
  assert.deepEqual(Object.keys(e.standards.riz), ['plat_principal'], 'l\'autre rôle de la famille reste');
  assert.equal(supprimerStandard(e, 'riz', 'plat_principal', h(5)), true);
  assert.deepEqual(Object.keys(e.standards), ['carottes'], 'une famille sans standard disparaît de l\'état');
  assert.deepEqual(e.journal.map((x) => x.action), ['definirStandard', 'definirStandard', 'definirStandard', 'supprimerStandard', 'supprimerStandard']);
  const avant = copie(e);
  assert.equal(supprimerStandard(e, 'riz', 'garniture', h(6)), false, 'rien à supprimer : sans effet');
  assert.deepEqual(e, avant, 'et sans ligne de journal');
  assert.throws(() => supprimerStandard(e, 'inconnue', 'garniture', h()), /Famille de produits inconnue/);
  assert.throws(() => supprimerStandard(e, 'riz', 'inconnu', h()), /Rôle/);
  assert.throws(() => supprimerStandard(e, 'riz', 'garniture'), /Horodatage/);
  assert.deepEqual(e, avant);
  supprimerStandard(etatVide(), 'riz', 'garniture', h()); // base neuve : pas d'erreur
  const ancien = etatVide();
  delete ancien.standards; // état d'avant les standards
  assert.equal(supprimerStandard(ancien, 'riz', 'garniture', h()), false);
});

test('le standard donne la portion d\'un plat de sa famille ; sans standard ni base, aucune quantité n\'est inventée', { skip: SANS_REPERES }, () => {
  const e = etatVide();
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.lundi, 2, M.unSeul, h());
  const riz = parNom(e, S.lundi, 'riz');
  let c = calculerComposant(e, riz.id);
  assert.deepEqual([c.statut, c.quantiteTravail, c.brut, c.quantiteServie], ['INCONNU', null, null, null]);
  assert.ok(c.manquants.includes('grammage'));
  assert.equal(grammageEffectif(e, riz), null);
  assert.equal(etatTache(e, principaleDe(e, riz.id)), 'a_preciser');
  // Standard en poids sec : la portion est celle d'avant cuisson, le gain estimé de la base n'est pas appliqué.
  definirStandard(e, 'riz', 'garniture', ST.sec, h());
  c = calculerComposant(e, riz.id);
  assert.equal(c.statut, 'CALCULE');
  assert.equal(c.quantiteTravail, 4000);
  assert.equal(c.aValider, false, 'portion du chef, étape estimée non appliquée');
  assert.deepEqual([c.dependances[0].origine, c.dependances[0].etat, c.dependances[0].statut], ['standard', 'sec', 'RESTAURANT_VALIDE']);
  presque(c.quantiteCuiteEstimee, 4000 * milieu('cuisson', 'Riz'));
  // Le même standard en poids cuit remonte la cuisson, estimée : à valider.
  definirStandard(e, 'riz', 'garniture', ST.cuit, h());
  c = calculerComposant(e, riz.id);
  presque(c.quantiteTravail, 4000 / milieu('cuisson', 'Riz'));
  assert.equal(c.aValider, true);
  // Supprimer le standard : on retombe sur « aucune portion », pas sur une valeur par défaut.
  supprimerStandard(e, 'riz', 'garniture', h());
  assert.equal(calculerComposant(e, riz.id).statut, 'INCONNU');
  // Le standard est par famille et par rôle : un autre rôle ou une autre famille n'en profite pas.
  definirStandard(e, 'riz', 'plat_principal', ST.sec, h());
  definirStandard(e, 'carottes', 'garniture', ST.sec, h());
  assert.equal(calculerComposant(e, riz.id).statut, 'INCONNU');
});

test('le standard passe avant le repère de la base, par famille et par rôle', () => {
  const e = etatVide();
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.lundi, 2, M.garnituresSansPoulet, h());
  const riz = parNom(e, S.lundi, 'riz');
  const carottes = parNom(e, S.lundi, 'carottes');
  const reperes = [R.groupeCereales, R.groupeLegumes];
  assert.equal(grammageEffectif(e, riz, reperes).origine, 'base');
  definirStandard(e, 'riz', 'garniture', { valeur: 33, unite: 'g', etat: 'cuit' }, h());
  assert.deepEqual([grammageEffectif(e, riz, reperes).origine, grammageEffectif(e, riz, reperes).valeur], ['standard', 33]);
  assert.equal(grammageEffectif(e, carottes, reperes).origine, 'base', 'le standard du riz ne sert pas aux carottes');
  definirStandard(e, 'riz', 'plat_principal', { valeur: 44, unite: 'g', etat: 'cuit' }, h());
  assert.equal(grammageEffectif(e, riz, reperes).valeur, 33, 'le standard d\'un autre rôle ne sert pas au rôle garniture');
});

test('une correction sur un plat ne change ni le standard ni les autres plats, et n\'est pas mémorisée d\'office', () => {
  const e = etatVide();
  for (const d of [S.lundi, S.mardi]) {
    prevision(e, d, 2, 40);
    definirMenu(e, d, 2, M.unSeul, h());
  }
  definirStandard(e, 'riz', 'garniture', ST.sec, h());
  const lundi = parNom(e, S.lundi, 'riz');
  const mardi = parNom(e, S.mardi, 'riz');
  const standards = copie(e.standards);
  const memoire = copie(e.memoire);
  const etapesMardi = copie(mardi.etapes);

  modifierComposant(e, lundi.id, { grammage: portion(120, 'sec') }, h());
  assert.deepEqual(e.standards, standards, 'le standard n\'est pas touché');
  assert.deepEqual(e.memoire, memoire, 'rien n\'est mémorisé d\'office');
  assert.equal(calculerComposant(e, lundi.id).quantiteTravail, 4800, '40 × 120 g (correction du plat)');
  assert.equal(calculerComposant(e, mardi.id).quantiteTravail, 4000, 'l\'autre plat garde le standard');
  assert.deepEqual([grammageEffectif(e, lundi).origine, grammageEffectif(e, mardi).origine], ['plat', 'standard']);

  // Même chose pour une correction de type ou d'étape : elle reste sur ce plat.
  modifierComposant(e, lundi.id, { type: 'preparation_maison', etapes: [{ etape: 'portionnement', coefficient: 0.5, statut: 'SAISI_SERVICE', source: 'TEST_ONLY' }] }, h());
  modifierComposant(e, lundi.id, { type: 'produit_simple' }, h());
  assert.deepEqual(e.standards, standards);
  assert.deepEqual(e.memoire, memoire);
  assert.deepEqual(mardi.etapes, etapesMardi);
  assert.equal(calculerComposant(e, mardi.id).quantiteTravail, 4000);

  // Retirer la correction : le plat retombe sur le standard.
  modifierComposant(e, lundi.id, { grammage: { valeur: null, statut: 'INCONNU', source: '' } }, h());
  assert.equal(grammageEffectif(e, lundi).origine, 'standard');
  assert.equal(calculerComposant(e, lundi.id).quantiteTravail, 4000);
});

test('changer un standard recalcule les plats non corrigés et non faits, sans toucher à une production faite', () => {
  const e = etatVide();
  const jours = [S.lundi, S.mardi, S.mercredi, S.jeudi];
  for (const d of jours) {
    prevision(e, d, 2, 40);
    definirMenu(e, d, 2, M.unSeul, h());
  }
  definirStandard(e, 'riz', 'garniture', ST.sec, h(1));
  const [libre, corrige, fait, enCours] = jours.map((d) => parNom(e, d, 'riz'));
  modifierComposant(e, corrige.id, { grammage: portion(120, 'sec') }, h(2));
  const prodFaite = principaleDe(e, fait.id);
  marquerFait(e, prodFaite, undefined, h(3));
  const p = e.productions[prodFaite];
  assert.equal(p.quantiteReelle, 4000);
  assert.deepEqual([p.instantane.composant.grammage.origine, p.instantane.composant.grammage.valeur, p.instantane.composant.grammage.etat,
    p.instantane.composant.grammage.statut, p.instantane.composant.grammage.source],
  ['standard', 100, 'sec', 'RESTAURANT_VALIDE', 'standard maison'], 'l\'instantané garde la portion effective utilisée');
  assert.equal(p.instantane.cible, 4000);
  const prodEnCours = principaleDe(e, enCours.id);
  const avant = copie({ reel: p.quantiteReelle, instantane: p.instantane, hFait: p.hFait, cibleDemarrage: e.productions[prodEnCours].cibleAuDemarrage });
  assert.equal(cibleProduction(e, principaleDe(e, libre.id)), 4000);

  definirStandard(e, 'riz', 'garniture', { valeur: 150, unite: 'g', etat: 'sec' }, h(4));
  assert.equal(cibleProduction(e, principaleDe(e, libre.id)), 6000, 'plat non corrigé et non fait : recalculé');
  assert.equal(cibleProduction(e, principaleDe(e, corrige.id)), 4800, 'plat corrigé : inchangé');
  assert.equal(cibleProduction(e, principaleDe(e, enCours.id)), 6000);
  // Production faite : quantité réelle et instantané ne bougent pas ; l'écart est à arbitrer.
  assert.deepEqual({ reel: p.quantiteReelle, instantane: p.instantane, hFait: p.hFait, cibleDemarrage: e.productions[prodEnCours].cibleAuDemarrage }, avant);
  assert.equal(etatTache(e, prodFaite), 'ecart');
  // Supprimer le standard : les plats non corrigés n'ont plus de portion, le plat corrigé et la production faite restent.
  supprimerStandard(e, 'riz', 'garniture', h(5));
  assert.equal(calculerComposant(e, corrige.id).quantiteTravail, 4800);
  assert.deepEqual({ reel: p.quantiteReelle, instantane: p.instantane, hFait: p.hFait, cibleDemarrage: e.productions[prodEnCours].cibleAuDemarrage }, avant);
  if (SANS_REPERES === false) assert.equal(calculerComposant(e, libre.id).statut, 'INCONNU');
});

test('les standards survivent à exporter puis importer, et le calcul qui en dépend redonne le même résultat', () => {
  const e = etatVide();
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.lundi, 2, M.garnituresSansPoulet, h());
  definirStandard(e, 'riz', 'garniture', ST.sec, h(1));
  definirStandard(e, 'carottes', 'garniture', ST.cruNet, h(2));
  definirStandard(e, 'riz', 'plat_principal', ST.cuit, h(3));
  const calculs = Object.values(e.composants).map((c) => [c.id, copie(calculerComposant(e, c.id))]);
  assert.equal(calculs.length, 2);
  assert.ok(calculs.every(([, c]) => c.statut === 'CALCULE'), 'le calcul dépend bien des standards');
  assert.equal(calculs.find(([id]) => id === parNom(e, S.lundi, 'riz').id)[1].quantiteTravail, 4000);

  const texte = exporter(e, h(9));
  assert.deepEqual(JSON.parse(texte).etat.standards, e.standards, 'les standards font partie de l\'état exporté');
  const relu = importer(texte);
  assert.deepEqual(relu.standards, e.standards);
  assert.deepEqual(relu, e);
  for (const [id, calc] of calculs) assert.deepEqual(calculerComposant(relu, id), calc, 'même calcul après restauration');
  assert.equal(exporter(relu, h(9)), texte, 'second export identique');
  // Contrôle négatif : sans les standards restaurés, le calcul change (le test ne passe donc pas à vide).
  const doc = JSON.parse(texte);
  delete doc.etat.standards;
  const sans = importer(JSON.stringify(doc));
  assert.deepEqual(sans.standards, {});
  if (SANS_REPERES === false) assert.equal(calculerComposant(sans, parNom(e, S.lundi, 'riz').id).statut, 'INCONNU');
});

test('importer complète et protège les standards', () => {
  const enveloppe = (etat) => JSON.stringify({ application: APPLICATION, schema: 1, etat });
  // Un export d'avant les standards : base vide.
  assert.deepEqual(importer(enveloppe({})).standards, {});
  // Champs absents complétés : l'état du poids se lit « cuit », l'horodatage est vide.
  const e = importer(enveloppe({ standards: { riz: { garniture: { valeur: 100, unite: 'g' } } } }));
  assert.deepEqual(e.standards, { riz: { garniture: { valeur: 100, unite: 'g', etat: 'cuit', h: null } } });
  // Clés dangereuses et entrées qui ne sont pas des objets : ignorées.
  const dangereux = '{"application":"sanji-entremetier","schema":1,"etat":{"standards":{"__proto__":{"garniture":{"valeur":1}},'
    + '"constructor":{"x":{"valeur":1}},"riz":{"__proto__":{"valeur":1},"garniture":{"valeur":100,"unite":"g","etat":"sec"},"plat_principal":7},"carottes":5}}}';
  const d = importer(dangereux);
  assert.deepEqual(Object.keys(d.standards), ['riz']);
  assert.deepEqual(Object.keys(d.standards.riz), ['garniture']);
  assert.equal({}.valeur, undefined);
  assert.throws(() => importer(enveloppe({ standards: [] })), /standards/);
  assert.throws(() => importer(enveloppe({ standards: 'texte' })), /corrompu/);
  // Un standard aberrant est conservé tel quel mais jamais utilisé pour calculer.
  const aberrant = importer(enveloppe({ standards: { riz: { garniture: { valeur: -3, unite: 'g', etat: 'sec' } } } }));
  assert.equal(grammageEffectif(aberrant, { nom: 'riz', famille: 'riz', role: 'garniture', grammage: {} }, []), null);
});
