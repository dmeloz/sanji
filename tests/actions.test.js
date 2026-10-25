import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { etatInitial } from '../app/js/domaine/etat.js';
import { cibleProduction } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, menuValide, prevision, principaleDe, recetteValidee } from './aide.js';

const produits = (e, id) => Object.values(e.productions).filter((p) => p.composantId === id);

test('chaque action exige un horodatage ISO en dernier argument', () => {
  const e = etatVide();
  assert.throws(() => A.definirMenu(e, S.lundi, 1, 'INTITULE_TEST'), /Horodatage/);
  assert.throws(() => A.definirMenu(e, S.lundi, 1, 'INTITULE_TEST', 'hier'), /Horodatage/);
  assert.throws(() => A.noterExport(e), /Horodatage/);
  assert.deepEqual(e, etatInitial(), 'un refus ne modifie rien');
});

test('menus : l\'intitulé enregistré vaut transcription validée, sans validation manuelle ; pas de menu samedi/dimanche', () => {
  const e = etatVide();
  A.definirMenu(e, S.lundi, 1, 'INTITULE_TEST', h());
  assert.deepEqual(e.jours[S.lundi].menus[1], { intitule: 'INTITULE_TEST', transcriptionValidee: true });
  const composants = copie(e.composants);
  A.definirMenu(e, S.lundi, 1, 'INTITULE_TEST', h()); // identique : rien ne change
  assert.deepEqual(e.composants, composants);
  A.definirMenu(e, S.lundi, 1, 'INTITULE_TEST_2', h()); // modifié : plus rien à revalider
  assert.deepEqual(e.jours[S.lundi].menus[1], { intitule: 'INTITULE_TEST_2', transcriptionValidee: true });
  A.definirMenu(e, S.lundi, 1, '', h()); // intitulé effacé : rien n'est validé, plus de composant
  assert.deepEqual(e.jours[S.lundi].menus[1], { intitule: '', transcriptionValidee: false });
  assert.deepEqual(e.composants, {});
  assert.throws(() => A.definirMenu(e, S.samedi, 1, 'x', h()), /Pas de menu du jour/);
  assert.throws(() => A.definirMenu(e, S.dimanche, 2, 'x', h()), /Pas de menu du jour/);
  assert.throws(() => A.definirMenu(e, S.lundi, 3, 'x', h()), /menu doit être 1 ou 2/);
});

test('definirMenu : composants créés valides d\'emblée, un composant supprimé à la main est recréé par un intitulé modifié', () => {
  const e = etatVide();
  A.definirMenu(e, S.lundi, 2, 'riz, carottes, poulet', h());
  const [riz, carottes, poulet] = ['riz', 'carottes', 'poulet'].map((n) => Object.values(e.composants).find((c) => c.nom === n));
  assert.deepEqual([riz, carottes, poulet].map((c) => [c.nom, c.attribue, c.valide]),
    [['riz', true, true], ['carottes', true, true], ['poulet', false, true]]);
  assert.equal(Object.keys(e.productions).length, 2, 'seuls les attribués reçoivent une production');
  // Les autres sont gardés tels quels, rien n'est dupliqué.
  A.supprimerComposant(e, carottes.id, h());
  A.definirMenu(e, S.lundi, 2, 'riz, carottes, poulet,', h());
  assert.equal(Object.keys(e.composants).length, 3);
  assert.deepEqual(Object.values(e.composants).map((c) => c.nom).sort(), ['carottes', 'poulet', 'riz']);
  assert.equal(e.composants[riz.id], riz);
  assert.equal(e.composants[poulet.id], poulet);
});

test('mémoire : l\'exception mémorisée influence la proposition suivante', () => {
  const e = etatVide();
  A.definirMenu(e, S.lundi, 2, 'poulet', h());
  const [c] = Object.keys(e.composants);
  assert.equal(e.composants[c].attribue, false);
  A.modifierComposant(e, c, { attribue: true }, h());
  A.memoriser(e, c, h());
  A.definirMenu(e, S.mardi, 2, 'poulet', h());
  const d = Object.values(e.composants).find((x) => x.date === S.mardi).id;
  assert.equal(e.composants[d].attribue, true, 'mémorisé : attribué malgré le menu 2');
});

test('ajouterComposant : attribution par défaut selon le menu, nom obligatoire', () => {
  const e = etatVide();
  const a = A.ajouterComposant(e, S.lundi, 2, { nom: ' ELEMENT_TEST ', categorie: 'proteine' }, h());
  const b = A.ajouterComposant(e, S.lundi, 2, { nom: 'LEGUME_TEST', categorie: 'legume' }, h());
  const c = A.ajouterComposant(e, S.lundi, 1, { nom: 'PROTEINE_TEST', categorie: 'proteine' }, h());
  assert.deepEqual([e.composants[a].attribue, e.composants[b].attribue, e.composants[c].attribue], [false, true, true]);
  assert.equal(e.composants[a].nom, 'ELEMENT_TEST');
  assert.throws(() => A.ajouterComposant(e, S.lundi, 1, { nom: ' ' }, h()), /nom/);
  assert.throws(() => A.ajouterComposant(e, S.lundi, 1, { nom: 'x', categorie: 'inconnue' }, h()), /Catégorie/);
});

test('modifierComposant : validations (coefficient nul ou négatif, étape en double, gain, grammage, champs)', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  const avant = copie(e.composants[c]);
  const etape = (x) => ({ etapes: [{ etape: 'cuisson', coefficient: 0.5, statut: 'RESTAURANT_VALIDE', ...x }] });
  assert.throws(() => A.modifierComposant(e, c, etape({ coefficient: 0 }), h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, etape({ coefficient: -0.5 }), h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, etape({ coefficient: NaN }), h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, etape({ coefficient: '0.5' }), h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, { etapes: [...etape({}).etapes, ...etape({ coefficient: 0.6 }).etapes] }, h()), /en double/);
  assert.throws(() => A.modifierComposant(e, c, { etapes: [{ etape: 'parage', coefficient: 1.2, statut: 'RESTAURANT_VALIDE' }] }, h()), /ne peut pas dépasser 1/);
  assert.throws(() => A.modifierComposant(e, c, { etapes: [{ etape: 'fumage', coefficient: 0.5 }] }, h()), /inconnue/);
  assert.throws(() => A.modifierComposant(e, c, etape({ statut: 'CALCULE' }), h()), /Provenance/);
  assert.throws(() => A.modifierComposant(e, c, { grammage: { valeur: 0 } }, h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, { grammage: { valeur: -3 } }, h()), /strictement positif/);
  assert.throws(() => A.modifierComposant(e, c, { grammage: { unite: 'kg' } }, h()), /Unité/);
  assert.throws(() => A.modifierComposant(e, c, { valide: false }, h()), /non modifiable/);
  assert.throws(() => A.modifierComposant(e, c, { type: 'plat' }, h()), /Type/);
  assert.throws(() => A.modifierComposant(e, c, { recetteId: 'inconnue' }, h()), /introuvable/);
  assert.throws(() => A.modifierComposant(e, 'inconnu', { nom: 'x' }, h()), /introuvable/);
  assert.deepEqual(e.composants[c], avant, 'aucun refus ne modifie le composant');
  // Gain d'absorption accepté sur la cuisson ; statut par défaut prudent.
  A.modifierComposant(e, c, { etapes: [{ etape: 'cuisson', coefficient: 2.5 }] }, h());
  assert.equal(e.composants[c].etapes[0].statut, 'INCONNU');
  assert.equal(calculerComposant(e, c).aValider, true);
});

test('assurerProductions : exactement une principale par composant attribué et validé, idempotent', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.equal(produits(e, c).length, 1);
  assert.equal(produits(e, c)[0].genre, 'principale');
  const avant = copie(e.productions);
  A.assurerProductions(e);
  A.assurerProductions(e);
  assert.deepEqual(e.productions, avant);
  // Un composant ajouté à la main est valide d'emblée et a sa production ; une donnée héritée non valide n'en a pas.
  const nv = A.ajouterComposant(e, S.lundi, 1, { nom: 'NON_VALIDE_TEST' }, h());
  assert.equal(e.composants[nv].valide, true);
  assert.equal(produits(e, nv).length, 1, 'ajouté à la main : pris en compte sans autre geste');
  e.composants[nv].valide = false;
  A.assurerProductions(e);
  assert.equal(produits(e, nv).length, 0, 'non validé (donnée héritée) : pas de production');
  A.modifierComposant(e, c, { attribue: false }, h());
  assert.equal(produits(e, c).length, 0, 'non attribué : plus de production non faite');
  A.modifierComposant(e, c, { attribue: true }, h());
  assert.equal(produits(e, c).length, 1, 'ré-attribué : une nouvelle principale');
});

test('assurerProductions : les productions faites survivent à la désattribution et à la suppression du composant', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  A.marquerFait(e, p, 400, h());
  const fait = copie(e.productions[p]);
  A.modifierComposant(e, c, { attribue: false }, h());
  assert.deepEqual(e.productions[p], fait);
  A.supprimerComposant(e, c, h());
  assert.deepEqual(e.productions[p], fait);
  assert.equal(e.composants[c], undefined);
  assert.throws(() => A.supprimerComposant(e, c, h()), /introuvable/);
  // Une production non faite disparaît avec son composant.
  const d = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST);
  const q = principaleDe(e, d);
  A.supprimerComposant(e, d, h());
  assert.equal(e.productions[q], undefined);
});

test('fiches : version, historique, refus, annulation', () => {
  const e = etatVide();
  assert.throws(() => A.creerFiche(e, { service: 'midi', couverts: 1 }, h()), /Date invalide/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, service: 'brunch', couverts: 1 }, h()), /service/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, couverts: -1 }, h()), /couverts/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, couverts: 1.5 }, h()), /couverts/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, couverts: 1, mode: 'menu_fixe' }, h()), /menu 1 ou 2/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, couverts: 1, mode: 'hors_menu', repartition: { 1: -2 } }, h()), /Répartition/);
  assert.throws(() => A.creerFiche(e, { date: S.lundi, couverts: 1, statut: 'annulee' }, h()), /non modifiable/);
  assert.deepEqual(e.fiches, {});
  const f = A.creerFiche(e, { date: S.lundi, service: 'midi', couverts: 5, mode: 'menu_fixe', menuFixe: 1, remarques: 'REMARQUE_TEST' }, h());
  assert.deepEqual([e.fiches[f].version, e.fiches[f].historique.length, e.fiches[f].statutRepartition], [1, 1, 'provisoire']);
  A.modifierFiche(e, f, { couverts: 5 }, h());
  assert.equal(e.fiches[f].version, 1, 'aucun changement : pas de nouvelle version');
  A.modifierFiche(e, f, { couverts: 6, horaire: 'HORAIRE_TEST' }, h(2));
  assert.equal(e.fiches[f].version, 2);
  assert.deepEqual(e.fiches[f].historique[1], { version: 2, h: h(2), resume: 'modifiée : horaire, couverts' });
  A.annulerFiche(e, f, h(3));
  assert.deepEqual([e.fiches[f].statut, e.fiches[f].version], ['annulee', 3]);
  A.annulerFiche(e, f, h(4));
  assert.equal(e.fiches[f].version, 3, 'annuler deux fois : idempotent');
  assert.throws(() => A.modifierFiche(e, f, { couverts: 9 }, h()), /annulée/);
  assert.throws(() => A.confirmerRepartition(e, f, { 1: 1, 2: 1 }, h()), /annulée/);
  const g = A.creerFiche(e, { date: S.lundi, couverts: 4, mode: 'menu_fixe', menuFixe: 2 }, h());
  assert.throws(() => A.confirmerRepartition(e, g, { 1: 2, 2: 2 }, h()), /choix libre/);
});

test('marquerFait : cible par défaut, quantité obligatoire si inconnue, instantané figé, corrigerReel', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  menuValide(e, S.lundi, 1);
  const prep = composantValide(e, S.lundi, 1, J.PREPARATION_TEST);
  const recette = recetteValidee(e, J.RECETTE_TEST);
  A.modifierComposant(e, prep, { recetteId: recette }, h());
  const p = principaleDe(e, prep);
  assert.equal(cibleProduction(e, p), 2000);
  assert.throws(() => A.marquerFait(e, p, -1, h()), /positif/);
  A.marquerFait(e, p, undefined, h(1));
  const prod = e.productions[p];
  assert.deepEqual([prod.etat, prod.quantiteReelle, prod.unite, prod.hFait, prod.cibleAuDemarrage], ['fait', 2000, 'ml', h(1), 2000]);
  assert.equal(prod.instantane.recette.version, 1);
  assert.equal(prod.instantane.composant.recetteVersion, 1);
  assert.equal(prod.instantane.portions, 40);
  assert.match(prod.instantane.formule, /40 portions/);
  assert.throws(() => A.marquerFait(e, p, 5, h()), /corrigerReel/);
  const figee = copie(prod.instantane);
  A.corrigerReel(e, p, 1950, h(2));
  assert.equal(prod.quantiteReelle, 1950);
  assert.deepEqual(prod.instantane, figee);
  assert.throws(() => A.corrigerReel(e, p, NaN, h()), /positif/);

  // Nouvelle version de recette : la production faite n'est pas réécrite.
  A.modifierRecette(e, recette, { ingredients: [{ nom: 'INGREDIENT_A_TEST', quantite: 900, unite: 'ml' }] }, h(3));
  assert.deepEqual(e.productions[p].instantane, figee);
  assert.equal(e.productions[p].quantiteReelle, 1950);
  assert.equal(e.recettes[recette].version, 2);

  // Cible inconnue : la quantité est obligatoire.
  const inconnu = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  assert.throws(() => A.marquerFait(e, principaleDe(e, inconnu), undefined, h()), /cible est inconnue/);
  assert.throws(() => A.corrigerReel(e, principaleDe(e, inconnu), 5, h()), /pas faite/);
});

test('invariant : ni prévision, ni fiche, ni recette, ni composant ne touchent quantiteReelle ni instantane', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PREPARATION_TEST);
  const r = recetteValidee(e, J.RECETTE_TEST);
  A.modifierComposant(e, c, { recetteId: r }, h());
  const p = principaleDe(e, c);
  A.marquerFait(e, p, 1234, h());
  const f = A.creerFiche(e, { date: S.lundi, service: 'midi', couverts: 8, mode: 'menu_fixe', menuFixe: 1 }, h());
  const photo = () => copie({ reel: e.productions[p].quantiteReelle, inst: e.productions[p].instantane, fait: e.productions[p].hFait });
  const avant = photo();
  A.definirPrevision(e, S.lundi, 1, 99, h());
  A.modifierFiche(e, f, { couverts: 50 }, h());
  A.annulerFiche(e, f, h());
  A.modifierRecette(e, r, { rendement: { valeur: 500 } }, h());
  A.validerRecette(e, r, h());
  A.modifierComposant(e, c, { grammage: { valeur: 77, statut: 'SAISI_SERVICE' }, nom: 'RENOMME_TEST', charge: 'courte' }, h());
  A.enregistrerPesee(e, c, 'portionnement', 100, 90, h());
  A.reprendreMemoire(e, c, h());
  A.memoriser(e, c, h());
  A.saisirApresService(e, c, { surplus: 1, rebut: 2 }, h());
  A.saisirVentes(e, S.lundi, 1, 12, h());
  A.definirMargeSecurite(e, 10, h());
  assert.deepEqual(photo(), avant);
});

test('deciderEcart : complément seulement s\'il manque quelque chose, jamais en double', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  assert.throws(() => A.deciderEcart(e, p, 'complement', h()), /une fois la production faite/);
  assert.throws(() => A.deciderEcart(e, p, 'peut-etre', h()), /inconnue/);
  A.planifier(e, p, S.lundi, h());
  A.marquerFait(e, p, 2000, h());
  assert.throws(() => A.deciderEcart(e, p, 'complement', h()), /Aucun complément/);
  A.definirPrevision(e, S.lundi, 1, 50, h());
  const a = A.deciderEcart(e, p, 'complement', h());
  const b = A.deciderEcart(e, p, 'complement', h());
  assert.equal(a.complement.id, b.complement.id);
  assert.equal(Object.values(e.productions).filter((x) => x.genre === 'complement').length, 1);
  assert.deepEqual(a.decision, { type: 'complement', cible: 2500, h: h() });
});

test('supprimerProduction : ni la principale ni une production faite', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 4);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  assert.throws(() => A.supprimerProduction(e, p, h()), /principale/);
  const prep = A.ajouterPreparatoire(e, c, 'ACTION_PREPARATOIRE_TEST', h());
  assert.throws(() => A.ajouterPreparatoire(e, c, ' ', h()), /Décrivez/);
  A.marquerFait(e, prep, null, h());
  assert.throws(() => A.supprimerProduction(e, prep, h()), /déjà faite/);
  const prep2 = A.ajouterPreparatoire(e, c, 'AUTRE_ACTION_TEST', h());
  A.supprimerProduction(e, prep2, h());
  assert.equal(e.productions[prep2], undefined);
});

test('enregistrerPesee : coefficient mesuré, validé restaurant, source datée', () => {
  const e = etatVide();
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  A.enregistrerPesee(e, c, 'parage', 1000, 750, '2026-10-03T09:00:00Z');
  const etape = e.composants[c].etapes.find((x) => x.etape === 'parage');
  assert.deepEqual(etape, { etape: 'parage', coefficient: 0.75, statut: 'RESTAURANT_VALIDE', source: 'pesée du 2026-10-03' });
  assert.equal(e.composants[c].etapes.filter((x) => x.etape === 'parage').length, 1, 'remplace, ne double pas');
  A.enregistrerPesee(e, c, 'cuisson', 1000, 2400, h());
  assert.equal(e.composants[c].etapes.find((x) => x.etape === 'cuisson').coefficient, 2.4, 'gain d\'absorption');
  assert.throws(() => A.enregistrerPesee(e, c, 'cuisson', 0, 10, h()), /Pesée invalide/);
  assert.throws(() => A.enregistrerPesee(e, c, 'cuisson', 10, 0, h()), /Pesée invalide/);
  assert.throws(() => A.enregistrerPesee(e, c, 'parage', 10, 20, h()), /ne peut pas dépasser 1/);
});

test('mémoire : mémoriser exige un composant validé ; reprendre est explicite', () => {
  const e = etatVide();
  const brouillon = A.ajouterComposant(e, S.lundi, 1, { nom: 'ELEMENT_TEST' }, h());
  e.composants[brouillon].valide = false; // donnée héritée de l'ancien parcours
  assert.throws(() => A.memoriser(e, brouillon, h()), /validé/);
  assert.deepEqual(A.reprendreMemoire(e, brouillon, h()), { applique: false, champs: [] });
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  A.memoriser(e, c, h());
  const m = e.memoire['produit_cru_test|1'];
  assert.equal(m.parRole.plat_principal.grammage.valeur, 200);
  assert.deepEqual(Object.keys(m.etapes).sort(), ['cuisson', 'parage', 'portionnement']);
  const d = A.ajouterComposant(e, S.mardi, 1, { nom: 'Produit_Cru_Test' }, h());
  A.modifierComposant(e, d, { role: 'garniture' }, h());
  const r = A.reprendreMemoire(e, d, h());
  assert.equal(r.champs.includes('grammage'), false, 'rôle différent : grammage non repris');
  assert.equal(e.composants[d].etapes.length, 3);
  // Un paramètre inconnu n'est pas mémorisé comme une valeur.
  const x = composantValide(e, S.mardi, 2, { ...J.PRODUIT_SEC_TEST, nom: 'SANS_VALEUR_TEST', grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' }, etapes: [{ etape: 'cuisson', coefficient: 2, statut: 'INCONNU' }] });
  A.memoriser(e, x, h());
  assert.deepEqual(e.memoire['sans_valeur_test|2'].parRole, {});
  assert.deepEqual(e.memoire['sans_valeur_test|2'].etapes, {});
});

test('règles : clé = nom normalisé, unique, valideLe seulement avec une limite', () => {
  const e = etatVide();
  const a = A.definirRegle(e, { nom: 'Préparation TEST', avanceMaxJours: 3, limiteUtilisationJours: 4 }, h(1));
  assert.equal(e.regles[a].cle, 'preparation test');
  assert.equal(e.regles[a].valideLe, h(1));
  const b = A.definirRegle(e, { nom: 'preparation  test', avanceMaxJours: 2, limiteUtilisationJours: null }, h(2));
  assert.equal(b, a, 'même clé : mise à jour, pas de doublon');
  assert.equal(e.regles[a].valideLe, null);
  assert.throws(() => A.definirRegle(e, { nom: '' }, h()), /nom/);
  assert.throws(() => A.definirRegle(e, { nom: 'x', avanceMaxJours: -1 }, h()), /Avance/);
  assert.throws(() => A.definirRegle(e, { nom: 'x', limiteUtilisationJours: 1.5 }, h()), /Limite/);
  assert.throws(() => A.definirRegle(e, { nom: '__proto__' }, h()), /interdite/);
  A.supprimerRegle(e, a, h());
  assert.deepEqual(e.regles, {});
  assert.throws(() => A.supprimerRegle(e, a, h()), /introuvable/);
});

test('recettes : version, historique, revalidation obligatoire', () => {
  const e = etatVide();
  const r = A.creerRecette(e, J.RECETTE_TEST, h());
  assert.deepEqual([e.recettes[r].version, e.recettes[r].valide], [1, false]);
  assert.throws(() => A.creerRecette(e, { nom: '' }, h()), /nom/);
  assert.throws(() => A.creerRecette(e, { nom: 'x', rendement: { valeur: 0 } }, h()), /rendement/);
  assert.throws(() => A.creerRecette(e, { nom: 'x', ingredients: [{ nom: 'y', quantite: -1 }] }, h()), /positif/);
  assert.throws(() => A.creerRecette(e, { nom: 'x', ingredients: [{ nom: ' ' }] }, h()), /nom/);
  A.validerRecette(e, r, h());
  A.modifierRecette(e, r, { nom: 'RECETTE_V2_TEST' }, h(5));
  assert.deepEqual([e.recettes[r].version, e.recettes[r].valide], [2, false], 'nouvelle version = à revalider');
  assert.equal(e.recettes[r].historique.find((x) => x.resume === 'version remplacée').nom, 'RECETTE_TEST');
  const vide = A.creerRecette(e, { nom: 'SANS_RENDEMENT_TEST', ingredients: [{ nom: 'I', quantite: 1, unite: 'g' }] }, h());
  assert.throws(() => A.validerRecette(e, vide, h()), /rendement/);
  const sansQuantite = A.creerRecette(e, { nom: 'SANS_QUANTITE_TEST', rendement: { valeur: 1, unite: 'g' }, ingredients: [{ nom: 'I' }] }, h());
  assert.throws(() => A.validerRecette(e, sansQuantite, h()), /quantité/);
  assert.throws(() => A.modifierRecette(e, 'inconnue', {}, h()), /introuvable/);
});

test('fournisseurs : délai entier ou vide', () => {
  const e = etatVide();
  const f = A.definirFournisseur(e, { nom: 'FOURNISSEUR_TEST', delaiJours: 2, heureLimite: '10:00' }, h());
  assert.equal(e.fournisseurs[f].heureLimite, '10:00');
  assert.equal(A.definirFournisseur(e, { id: f, nom: 'RENOMME_TEST', delaiJours: null }, h()), f);
  assert.equal(e.fournisseurs[f].delaiJours, null);
  assert.throws(() => A.definirFournisseur(e, { nom: 'x', delaiJours: -1 }, h()), /Délai/);
  assert.throws(() => A.definirFournisseur(e, { nom: ' ' }, h()), /nom/);
  assert.throws(() => A.supprimerFournisseur(e, 'inconnu', h()), /introuvable/);
});

test('prévision, ventes, après service : validations', () => {
  const e = etatVide();
  assert.throws(() => A.definirPrevision(e, S.lundi, 1, -1, h()), /Prévision/);
  assert.throws(() => A.definirPrevision(e, S.lundi, 1, 2.5, h()), /Prévision/);
  assert.throws(() => A.definirPrevision(e, S.lundi, 1, undefined, h()), /Prévision/);
  assert.throws(() => A.definirPrevision(e, S.samedi, 1, 3, h()), /Pas de menu du jour/);
  A.definirPrevision(e, S.lundi, 1, 3, h(1));
  assert.deepEqual(e.jours[S.lundi].previsions[1], { portions: 3, h: h(1) });
  A.definirPrevision(e, S.lundi, 1, null, h(2));
  assert.deepEqual(e.jours[S.lundi].previsions[1], { portions: null, h: h(2) });
  A.saisirVentes(e, S.lundi, 2, 7, h(3));
  assert.deepEqual([e.jours[S.lundi].ventes[2], e.jours[S.lundi].ventes.h], [7, h(3)]);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.throws(() => A.saisirApresService(e, c, { surplus: -1 }, h()), /positif/);
  A.saisirApresService(e, c, { surplus: 3, note: 'NOTE_TEST' }, h());
  assert.deepEqual(e.composants[c].apresService, { surplus: 3, rebut: null, note: 'NOTE_TEST' });
});

test('journal : une ligne par action réussie, aucune pour un refus', () => {
  const e = etatVide();
  A.definirMargeSecurite(e, 4, h(1));
  assert.deepEqual(e.journal.map((x) => [x.h, x.action]), [[h(1), 'definirMargeSecurite']]);
  assert.throws(() => A.definirMargeSecurite(e, -2, h(2)));
  assert.equal(e.journal.length, 1);
  A.noterExport(e, h(3));
  A.definirMargeSecurite(e, null, h(4));
  assert.equal(e.reglages.dernierExport, h(3));
  assert.equal(e.reglages.margeSecurite, null);
  assert.equal(e.journal.length, 3);
});
