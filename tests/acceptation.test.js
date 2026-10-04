// Tests d'acceptation : un test par scénario du plan (numérotation et intitulés du plan).
// Les données viennent de tests/jeux/TEST_ONLY-*.js. Aucune valeur n'est une référence métier.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ajouterAdaptation, ajouterPreparatoire, annulerFiche, confirmerRepartition, controlerProduit, creerFiche, definirCapacite,
  definirCreneau, definirFournisseur, definirPrevision, definirRegle, definirStandard, deciderEcart, marquerCommande, marquerFait,
  memoriser, modifierComposant, modifierFiche, planifier, reprendreMemoire, saisirMenusSemaine,
} from '../app/js/domaine/actions.js';
import * as allergenes from '../app/js/domaine/allergenes.js';
import { calculerComposant, portionsMenu } from '../app/js/domaine/calcul.js';
import { creneauxDuJour, joursEntre } from '../app/js/domaine/dates.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import {
  chargeCreneau, ecartProduction, etatTache, evaluerAvance, feuilleDuJour, suggererCreneau,
} from '../app/js/domaine/planification.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { besoinsProduits, echeanceCommande, suiviProduit } from '../app/js/domaine/produits.js';
import { BASE_METIER } from '../app/js/donnees/base-metier.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { libelle } from '../app/js/domaine/statuts.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_MENUS as M, JEU_STANDARDS as ST } from './jeux/TEST_ONLY-savoir.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, menuValide, prevision, principaleDe, recetteValidee } from './aide.js';

const tachesDe = (feuille) => feuille.aFaire.flatMap((g) => g.taches);

test('1. Un produit sec et une préparation maison du même menu affichent chacun l\'unité correspondant à leur usage ; une fiche recette absente ne masque pas une tâche simple', () => {
  const etat = etatVide();
  menuValide(etat, S.lundi, 1);
  prevision(etat, S.lundi, 1, 40);
  const sec = composantValide(etat, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const prep = composantValide(etat, S.lundi, 1, J.PREPARATION_TEST); // aucune recette liée

  const cSec = calculerComposant(etat, sec);
  assert.equal(cSec.uniteTravail, 'g');
  assert.equal(cSec.libelleQuantite, 'brut à prévoir');
  assert.equal(cSec.quantiteTravail, 2000); // 40 × 100 g ÷ 2 (gain d'absorption)

  const cPrep = calculerComposant(etat, prep);
  assert.equal(cPrep.uniteTravail, 'ml');
  assert.equal(cPrep.libelleQuantite, 'quantité finie à produire');
  assert.equal(cPrep.quantiteTravail, 2000);
  // La recette absente est signalée mais la quantité et la tâche restent là.
  assert.equal(cPrep.statut, 'CALCULE');
  assert.equal(cPrep.ingredients, null);
  assert.ok(cPrep.manquants.includes('recette'));

  const idPrep = principaleDe(etat, prep);
  planifier(etat, idPrep, S.lundi, 'avant_midi', h());
  const tache = tachesDe(feuilleDuJour(etat, S.lundi)).find((t) => t.productionId === idPrep);
  assert.ok(tache, 'la tâche de la préparation sans recette figure sur la feuille');
  assert.equal(tache.cible, 2000);
  assert.equal(tache.unite, 'ml');
  assert.equal(tache.etat, 'a_faire');
});

test('2. Les besoins des menus 1 et 2 restent indépendants ; le grammage dépend du rôle du composant dans le plat', () => {
  const etat = etatVide();
  prevision(etat, S.lundi, 1, 40);
  prevision(etat, S.lundi, 2, 10);
  const principal = composantValide(etat, S.lundi, 1, J.PRODUIT_CRU_TEST, { etapes: [],
    grammage: { valeur: 200, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' } });
  const garniture = composantValide(etat, S.lundi, 2, J.PRODUIT_CRU_TEST, { role: 'garniture', etapes: [],
    grammage: { valeur: 100, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' } });
  assert.equal(calculerComposant(etat, principal).quantiteTravail, 8000); // 40 × 200
  assert.equal(calculerComposant(etat, garniture).quantiteTravail, 1000); // 10 × 100

  // Indépendance : changer la prévision du menu 2 ne touche pas le menu 1.
  const avant = copie(calculerComposant(etat, principal));
  prevision(etat, S.lundi, 2, 30);
  assert.deepEqual(calculerComposant(etat, principal), avant);
  assert.equal(calculerComposant(etat, garniture).quantiteTravail, 3000);

  // Le grammage mémorisé dépend du rôle : même nom, deux rôles, deux grammages.
  memoriser(etat, principal, h());
  memoriser(etat, garniture, h());
  const a = composantValide(etat, S.mardi, 1, { ...J.PRODUIT_CRU_TEST, role: 'plat_principal', etapes: [],
    grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  const b = composantValide(etat, S.mardi, 2, { ...J.PRODUIT_CRU_TEST, role: 'garniture', etapes: [],
    grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  assert.equal(calculerComposant(etat, a).statut, 'INCONNU'); // rien n'est repris sans demande explicite
  reprendreMemoire(etat, a, h());
  reprendreMemoire(etat, b, h());
  assert.equal(etat.composants[a].grammage.valeur, 200);
  assert.equal(etat.composants[b].grammage.valeur, 100);
});

test('3. Le brut à prévoir applique uniquement les transformations pertinentes à la forme achetée et à la méthode, sans double perte', () => {
  const etat = etatVide();
  prevision(etat, S.lundi, 1, 10);
  const base = { ...J.PRODUIT_CRU_TEST };
  // Forme achetée déjà parée : seules cuisson et portionnement s'appliquent.
  const pare = composantValide(etat, S.lundi, 1, { ...base, nom: 'PRODUIT_PARE_TEST',
    etapes: base.etapes.filter((e) => e.etape !== 'parage') });
  // Forme brute entière : les trois étapes.
  const entier = composantValide(etat, S.lundi, 1, { ...base, nom: 'PRODUIT_ENTIER_TEST' });
  // Aucune transformation : le brut est la quantité servie.
  const nu = composantValide(etat, S.lundi, 1, { ...base, nom: 'PRODUIT_NU_TEST', etapes: [] });

  const servie = 10 * 200;
  assert.equal(calculerComposant(etat, nu).brut, servie);
  assert.deepEqual(calculerComposant(etat, pare).etapes.map((e) => e.etape), ['portionnement', 'cuisson']);
  assert.ok(Math.abs(calculerComposant(etat, pare).brut - servie / 0.9 / 0.8) < 1e-9);
  assert.deepEqual(calculerComposant(etat, entier).etapes.map((e) => e.etape), ['portionnement', 'cuisson', 'parage']);
  assert.ok(Math.abs(calculerComposant(etat, entier).brut - servie / 0.9 / 0.8 / 0.5) < 1e-9);

  // Sans double perte : une même étape ne peut pas être déclarée deux fois.
  assert.throws(() => modifierComposant(etat, pare, { etapes: [
    { etape: 'cuisson', coefficient: 0.8, statut: 'RESTAURANT_VALIDE' },
    { etape: 'cuisson', coefficient: 0.9, statut: 'RESTAURANT_VALIDE' }] }, h()), /en double/);
  // Une préparation maison n'applique ni cuisson ni parage à elle-même.
  const prep = composantValide(etat, S.lundi, 1, { ...J.PREPARATION_TEST, etapes: [
    { etape: 'cuisson', coefficient: 0.5, statut: 'RESTAURANT_VALIDE' }] });
  assert.equal(calculerComposant(etat, prep).quantiteTravail, 500); // 10 × 50 ml, cuisson non appliquée
});

test('4. Un composant générique reste planifiable en portions ; sa composition et sa commande détaillée attendent validation', () => {
  const etat = etatVide();
  menuValide(etat, S.lundi, 1);
  prevision(etat, S.lundi, 1, 12);
  const id = composantValide(etat, S.lundi, 1, J.COMPOSANT_VAGUE_TEST);
  const c = calculerComposant(etat, id);
  assert.equal(c.uniteTravail, 'portion');
  assert.equal(c.quantiteTravail, 12);
  assert.equal(c.libelleQuantite, 'portions, composition à définir');
  assert.equal(c.ingredients, null);
  assert.equal(c.aValider, true);

  const prod = principaleDe(etat, id);
  assert.equal(etatTache(etat, prod), 'a_planifier');
  planifier(etat, prod, S.lundi, 'avant_midi', h());
  assert.equal(etatTache(etat, prod), 'a_faire');

  // Aucune commande détaillée : le composant est signalé à part, sans quantité inventée.
  const besoins = besoinsProduits(etat, S.lundi);
  assert.equal(besoins.lignes.length, 0);
  assert.equal(besoins.nonChiffrables.length, 1);
  assert.equal(besoins.nonChiffrables[0].composantId, id);
});

test('5. La modification ou annulation d\'une fiche retire son ancien besoin ; le choix provisoire d\'un groupe est remplacé, non ajouté, par le choix confirmé', () => {
  const etat = etatVide();
  prevision(etat, S.mardi, 1, 10);
  const fixe = creerFiche(etat, { date: S.mardi, service: 'midi', couverts: 20, mode: 'menu_fixe', menuFixe: 1, numero: 'F1' }, h());
  assert.equal(portionsMenu(etat, S.mardi, 1).total, 30);
  modifierFiche(etat, fixe, { couverts: 25 }, h());
  assert.equal(portionsMenu(etat, S.mardi, 1).total, 35, 'le besoin est remplacé (25), pas ajouté (45)');
  annulerFiche(etat, fixe, h());
  assert.equal(portionsMenu(etat, S.mardi, 1).total, 10, 'la fiche annulée ne compte plus');
  assert.equal(portionsMenu(etat, S.mardi, 2).total, 0);

  const groupe = creerFiche(etat, { date: S.mardi, service: 'midi', couverts: 30, mode: 'choix_libre', numero: 'G1',
    repartition: { 1: 18, 2: 12 } }, h());
  let p1 = portionsMenu(etat, S.mardi, 1);
  assert.equal(p1.groupesProvisoires, 18);
  assert.equal(p1.groupesConfirmes, 0);
  confirmerRepartition(etat, groupe, { 1: 10, 2: 20 }, h());
  p1 = portionsMenu(etat, S.mardi, 1);
  assert.equal(p1.groupesProvisoires, 0, 'le provisoire a disparu');
  assert.equal(p1.groupesConfirmes, 10);
  assert.equal(p1.total, 20, 'confirmé (10) remplace provisoire (18), jamais 10 + 18');
  assert.equal(portionsMenu(etat, S.mardi, 2).groupesConfirmes, 20);
});

test('6. Une hausse de prévision après production conserve la quantité réellement faite et affiche un écart à arbitrer', () => {
  const etat = etatVide();
  prevision(etat, S.lundi, 1, 40);
  const id = composantValide(etat, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  planifier(etat, prod, S.lundi, 'avant_midi', h());
  marquerFait(etat, prod, undefined, h());
  assert.equal(etat.productions[prod].quantiteReelle, 2000);
  const figee = copie(etat.productions[prod].instantane);

  prevision(etat, S.lundi, 1, 50); // hausse après production
  assert.equal(etat.productions[prod].quantiteReelle, 2000, 'le réel est conservé');
  assert.deepEqual(etat.productions[prod].instantane, figee, "l'instantané n'est pas réécrit");
  assert.equal(ecartProduction(etat, id), 500);
  assert.equal(etatTache(etat, prod), 'ecart');

  // Le chef arbitre : complément. Le réel de la production faite ne bouge toujours pas.
  const { complement } = deciderEcart(etat, prod, 'complement', h());
  assert.equal(etat.productions[prod].quantiteReelle, 2000);
  assert.equal(complement.genre, 'complement');
  assert.equal(etatTache(etat, prod), 'fait');
  planifier(etat, complement.id, S.lundi, 'avant_midi', h());
  marquerFait(etat, complement.id, undefined, h()); // cible du complément = 500
  assert.equal(etat.productions[complement.id].quantiteReelle, 500);
  assert.equal(ecartProduction(etat, id), 0);

  // Une nouvelle hausse rouvre l'écart : la décision précédente ne vaut que pour l'ancienne cible.
  prevision(etat, S.lundi, 1, 60);
  assert.equal(etatTache(etat, prod), 'ecart');
});

test('7. Une production avancée pour la semaine suivante reste liée à son service ; dimanche compte dans le temps écoulé et toute exception d\'avance nécessite la règle de préparation validée', () => {
  const etat = etatVide();
  prevision(etat, S.lundiSuivant, 1, 20);
  const id = composantValide(etat, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  planifier(etat, prod, S.samedi, 'avant_soir', h());
  assert.equal(etat.productions[prod].dateService, S.lundiSuivant, 'toujours liée à son service');
  assert.equal(etat.productions[prod].jourDecide, S.samedi);
  assert.equal(joursEntre(S.samedi, S.lundiSuivant), 2, 'le dimanche compte');

  // Exceptions : plus de deux jours calendaires.
  const regleSansLimite = { avanceMaxJours: 3, limiteUtilisationJours: null };
  const regleComplete = { avanceMaxJours: 3, limiteUtilisationJours: 3 };
  assert.equal(evaluerAvance(S.vendredi, S.lundiSuivant, null).exception, true);
  assert.equal(evaluerAvance(S.vendredi, S.lundiSuivant, null).autorisee, false);
  assert.equal(evaluerAvance(S.vendredi, S.lundiSuivant, regleSansLimite).autorisee, false);
  assert.equal(evaluerAvance(S.vendredi, S.lundiSuivant, regleComplete).autorisee, true);
  assert.equal(evaluerAvance(S.vendredi, S.lundiSuivant, { avanceMaxJours: 2, limiteUtilisationJours: 5 }).autorisee, false);
  // Jamais autorisée globalement : une règle propre à une préparation ne s'applique pas aux autres.
  definirRegle(etat, { nom: 'PREPARATION_TEST', avanceMaxJours: 3, limiteUtilisationJours: 3 }, h());
  const autre = composantValide(etat, S.mardiSuivant, 1, J.PRODUIT_CRU_TEST);
  planifier(etat, principaleDe(etat, autre), S.samedi, 'apres_midi', h());
  assert.equal(pointsAConfirmer(etat, S.mardiSuivant).some((p) => p.type === 'avance_hors_regle'), true);
});

test('8. Une allergie de groupe reste visible ; aucune compatibilité n\'est affirmée sans ingrédients restaurant validés et décision humaine pour l\'adaptation', () => {
  const etat = etatVide();
  menuValide(etat, S.mercredi, 1);
  prevision(etat, S.mercredi, 1, 5);
  const prep = composantValide(etat, S.mercredi, 1, J.PREPARATION_TEST);
  const groupe = creerFiche(etat, { date: S.mercredi, service: 'midi', couverts: 8, mode: 'choix_libre', numero: 'G2',
    repartition: { 1: 8, 2: 0 }, allergies: 'ALLERGIE_TEST' }, h());
  let alertes = allergenes.alertesAllergenes(etat, S.mercredi);
  assert.equal(alertes.length, 1);
  assert.equal(alertes[0].allergies, 'ALLERGIE_TEST');
  assert.equal(alertes[0].composants[0].statut, 'a_confirmer');

  // Même « validé » à la main, sans recette restaurant validée : toujours à confirmer.
  modifierComposant(etat, prep, { allergenes: { statut: 'valide', liste: ['ALLERGENE_TEST'] } }, h());
  alertes = allergenes.alertesAllergenes(etat, S.mercredi);
  assert.equal(alertes[0].composants[0].statut, 'a_confirmer');
  // Avec la recette validée liée : le statut peut passer à validé, sans jamais dire « compatible ».
  const recette = recetteValidee(etat, J.RECETTE_TEST);
  modifierComposant(etat, prep, { recetteId: recette }, h());
  alertes = allergenes.alertesAllergenes(etat, S.mercredi);
  assert.equal(alertes[0].composants[0].statut, 'valide');
  assert.equal(Object.keys(allergenes).some((nom) => /compatib/i.test(nom)), false);
  assert.equal(JSON.stringify(alertes).toLowerCase().includes('compatible'), false);

  // L'adaptation est une décision humaine tracée.
  assert.deepEqual(alertes[0].adaptations, []);
  ajouterAdaptation(etat, groupe, 'ADAPTATION_TEST décidée par le chef', h(5));
  assert.equal(allergenes.alertesAllergenes(etat, S.mercredi)[0].adaptations[0].texte, 'ADAPTATION_TEST décidée par le chef');
  // L'allergie de groupe reste visible tant que la fiche est active.
  assert.equal(allergenes.alertesAllergenes(etat, S.mercredi).length, 1);
});

test('9. Si un besoin change après vérification des produits, seuls les contrôles concernés repassent à vérifier ; besoin brut, disponible vérifié et commande restent séparés', () => {
  const etat = etatVide();
  prevision(etat, S.lundi, 1, 40);
  prevision(etat, S.mardi, 1, 10);
  composantValide(etat, S.lundi, 1, J.PRODUIT_SEC_TEST); // 2000 g
  composantValide(etat, S.mardi, 1, J.PRODUIT_CRU_TEST); // 10 × 200 ÷ 0,9 ÷ 0,8 ÷ 0,5 = 5556 g
  const cleSec = 'produit_sec_test';
  const cleCru = 'produit_cru_test';
  controlerProduit(etat, S.lundi, cleSec, 'g', 'suffisant', 2500, h());
  controlerProduit(etat, S.lundi, cleCru, 'g', 'a_commander', 1000, h());

  const ligne = (cle) => besoinsProduits(etat, S.lundi).lignes.find((l) => l.cle === cle);
  assert.equal(suiviProduit(etat, S.lundi, ligne(cleSec)).statutAffiche, 'suffisant');
  assert.equal(suiviProduit(etat, S.lundi, ligne(cleCru)).statutAffiche, 'a_commander');

  prevision(etat, S.lundi, 1, 50); // le besoin du produit sec change
  const sec = suiviProduit(etat, S.lundi, ligne(cleSec));
  const cru = suiviProduit(etat, S.lundi, ligne(cleCru));
  assert.equal(sec.statutAffiche, 'a_reverifier');
  assert.equal(cru.statutAffiche, 'a_commander', "le produit non touché n'est pas repassé à vérifier");
  // Trois quantités séparées, et rien n'est acheté automatiquement.
  assert.equal(sec.besoinBrut, 2500);
  assert.equal(sec.quantiteVerifiee, 2500);
  assert.equal(sec.quantiteAcheter, null);
  assert.equal(cru.proposeeACommander, 5556 - 1000);
  assert.equal(cru.quantiteAcheter, null);
  assert.notEqual(cru.besoinBrut, cru.quantiteVerifiee);
});

test('10. Un délai de commande dépassé ou inconnu est signalé ; la charge d\'un créneau n\'est pas présentée comme une durée de travail mesurée', () => {
  const etat = etatVide();
  prevision(etat, S.lundi, 1, 40);
  composantValide(etat, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const ligne = besoinsProduits(etat, S.lundi).lignes[0];
  assert.equal(ligne.premiereUtilisation, S.lundi);
  assert.equal(echeanceCommande(ligne, null, S.veille).statut, 'a_renseigner');
  const inconnu = definirFournisseur(etat, { nom: 'FOURNISSEUR_TEST' }, h());
  assert.equal(echeanceCommande(ligne, etat.fournisseurs[inconnu], S.veille).statut, 'a_renseigner');
  const f = etat.fournisseurs[definirFournisseur(etat, { nom: 'FOURNISSEUR_DELAI_TEST', delaiJours: 3 }, h())];
  assert.deepEqual(echeanceCommande(ligne, f, '2026-10-01'), { statut: 'ok', dateLimite: '2026-10-02' });
  assert.equal(echeanceCommande(ligne, f, '2026-10-02').statut, 'aujourdhui');
  assert.equal(echeanceCommande(ligne, f, '2026-10-03').statut, 'depassee');

  // La charge est exprimée en points d'échelle courte/moyenne/longue, jamais en minutes.
  const prep = composantValide(etat, S.lundi, 1, J.PREPARATION_TEST); // charge longue
  planifier(etat, principaleDe(etat, prep), S.lundi, 'avant_midi', h());
  const charge = chargeCreneau(etat, S.lundi, 'avant_midi');
  assert.equal(charge.longues, 1);
  assert.equal(charge.points, 3);
  assert.equal(charge.capacite, null);
  assert.equal(charge.surcharge, false, 'sans capacité réglée, aucune alerte de capacité');
  assert.equal(Object.keys(charge).some((k) => /minute|duree|temps|heure/i.test(k)), false);
  assert.equal(JSON.stringify(charge).toLowerCase().includes('minute'), false);
  definirCapacite(etat, 2, h());
  assert.equal(chargeCreneau(etat, S.lundi, 'avant_midi').surcharge, true);
});

test('11. En mode avion sur l\'appareil ciblé, lecture des menus enregistrés, saisie manuelle, calculs, statuts, sauvegarde et export restent possibles (part domaine)', () => {
  // Reste à vérifier dans le navigateur, sur l'appareil ciblé, en mode avion : chargement du service worker et du
  // cache, écriture IndexedDB, téléchargement du fichier d'export. Ici : le domaine est pur (aucun réseau) et
  // exporter puis importer redonne exactement le même état.
  const etat = etatVide();
  menuValide(etat, S.lundi, 1, 'INTITULE_TEST_AVION');
  prevision(etat, S.lundi, 1, 40);
  const id = composantValide(etat, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  planifier(etat, prod, S.lundi, 'avant_midi', h());
  marquerFait(etat, prod, undefined, h());
  creerFiche(etat, { date: S.lundi, service: 'midi', couverts: 5, mode: 'menu_fixe', menuFixe: 1 }, h());
  definirFournisseur(etat, { nom: 'FOURNISSEUR_TEST', delaiJours: 2 }, h());

  const texte = exporter(etat, h(9));
  const relu = importer(texte);
  assert.deepEqual(relu, etat);
  assert.equal(relu.jours[S.lundi].menus[1].intitule, 'INTITULE_TEST_AVION');
  assert.deepEqual(calculerComposant(relu, id), calculerComposant(etat, id));
  assert.equal(etatTache(relu, prod), etatTache(etat, prod));
  assert.equal(exporter(relu, h(9)), texte, 'second export identique');
});

test('12. Une production se planifie sur un créneau (avant midi, après midi, avant soir) et non sur une simple date ; lundi et mardi n\'ont pas de créneau avant soir, dimanche n\'en a aucun', () => {
  assert.deepEqual(creneauxDuJour(S.lundi), ['avant_midi', 'apres_midi']);
  assert.deepEqual(creneauxDuJour(S.mardi), ['avant_midi', 'apres_midi']);
  assert.deepEqual(creneauxDuJour(S.jeudi), ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.deepEqual(creneauxDuJour(S.samedi), ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.deepEqual(creneauxDuJour(S.dimanche), []);

  const etat = etatVide();
  prevision(etat, S.vendredi, 1, 4);
  const id = composantValide(etat, S.vendredi, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  assert.throws(() => planifier(etat, prod, S.jeudi, undefined, h()), /Créneau/i, 'une date seule ne suffit pas');
  assert.throws(() => planifier(etat, prod, S.lundi, 'avant_soir', h()), /Créneau|créneau/);
  assert.throws(() => planifier(etat, prod, S.mardi, 'avant_soir', h()), /Créneau|créneau/);
  assert.throws(() => planifier(etat, prod, S.dimanche, 'avant_midi', h()), /dimanche/i);
  planifier(etat, prod, S.jeudi, 'avant_soir', h());
  assert.equal(etat.productions[prod].jourDecide, S.jeudi);
  assert.equal(etat.productions[prod].creneauDecide, 'avant_soir');
});

test('13. Une avance du samedi pour le lundi est acceptée avec « conservation à confirmer » si la limite maison manque ; une avance de plus de deux jours sans règle validée est signalée hors règle et ne couvre pas le besoin', () => {
  const etat = etatVide();
  prevision(etat, S.lundiSuivant, 1, 20);
  prevision(etat, S.mardiSuivant, 1, 20);
  const pourLundi = composantValide(etat, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  const pourMardi = composantValide(etat, S.mardiSuivant, 1, { ...J.PRODUIT_SEC_TEST, nom: 'PRODUIT_SEC_BIS_TEST' });

  // Samedi -> lundi : 2 jours, acceptée, conservation à confirmer.
  const a = planifier(etat, principaleDe(etat, pourLundi), S.samedi, 'apres_midi', h());
  assert.equal(a.evaluation.autorisee, true);
  assert.equal(a.evaluation.couvre, true);
  assert.equal(a.evaluation.conservation, 'a_confirmer');
  assert.ok(a.alertes.includes('conservation à confirmer'));
  assert.ok(pointsAConfirmer(etat, S.lundiSuivant).some((p) => p.type === 'conservation' && p.composantId === pourLundi));

  // Samedi -> mardi, vendredi -> lundi, vendredi -> mardi : plus de deux jours, hors règle.
  for (const [jour, service] of [[S.samedi, S.mardiSuivant], [S.vendredi, S.lundiSuivant], [S.vendredi, S.mardiSuivant]]) {
    const ev = evaluerAvance(jour, service, null);
    assert.equal(ev.exception, true, `${jour} -> ${service}`);
    assert.equal(ev.autorisee, false);
    assert.equal(ev.couvre, false);
    assert.ok(ev.alertes.some((x) => x.includes('hors règle')));
  }
  const b = planifier(etat, principaleDe(etat, pourMardi), S.samedi, 'avant_midi', h()); // permis, mais signalé
  assert.equal(b.evaluation.couvre, false);
  assert.ok(pointsAConfirmer(etat, S.mardiSuivant).some((p) => p.type === 'avance_hors_regle'));
  // Fait hors règle : le besoin reste à couvrir (pas de produit fini marqué couvert).
  marquerFait(etat, principaleDe(etat, pourMardi), undefined, h());
  assert.equal(ecartProduction(etat, pourMardi), 1000); // 20 × 100 ÷ 2 : rien n'est couvert
  assert.equal(etatTache(etat, principaleDe(etat, pourMardi)), 'ecart');
  const dejaPret = feuilleDuJour(etat, S.mardiSuivant).dejaPret.find((t) => t.composantId === pourMardi);
  assert.equal(dejaPret.evaluation.couvre, false, 'affiché « non couvert »');
  // À l'inverse, l'avance de 2 jours faite et conservation à confirmer couvre le besoin.
  marquerFait(etat, principaleDe(etat, pourLundi), undefined, h());
  assert.equal(ecartProduction(etat, pourLundi), 0);
});

test('14. Un créneau signalé chargé ou indisponible par la carte n\'est jamais proposé automatiquement ; ce signalement ne crée ni portion ni recette de carte', () => {
  const etat = etatVide();
  prevision(etat, S.lundiSuivant, 1, 20);
  const id = composantValide(etat, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  assert.deepEqual(suggererCreneau(etat, prod).creneau, 'avant_midi');
  assert.equal(suggererCreneau(etat, prod).date, S.lundiSuivant);

  const avant = copie(etat);
  definirCreneau(etat, S.lundiSuivant, 'avant_midi', 'charge', h());
  definirCreneau(etat, S.samedi, 'avant_soir', 'indisponible', h());
  // Ni portion, ni recette, ni composant n'ont été créés par ces signalements.
  assert.deepEqual(etat.recettes, avant.recettes);
  assert.deepEqual(etat.composants, avant.composants);
  assert.deepEqual(portionsMenu(etat, S.lundiSuivant, 1), portionsMenu(avant, S.lundiSuivant, 1));
  assert.equal(Object.keys(etat.productions).length, Object.keys(avant.productions).length);

  const etats = ['libre', 'charge', 'indisponible'];
  for (const lundiAvantMidi of etats) for (const samedi1 of etats) for (const samedi2 of etats) for (const samedi3 of etats) {
    definirCreneau(etat, S.lundiSuivant, 'avant_midi', lundiAvantMidi, h());
    definirCreneau(etat, S.samedi, 'avant_soir', samedi1, h());
    definirCreneau(etat, S.samedi, 'apres_midi', samedi2, h());
    definirCreneau(etat, S.samedi, 'avant_midi', samedi3, h());
    const figee = copie(etat);
    const s = suggererCreneau(etat, prod);
    assert.deepEqual(etat, figee, 'la suggestion ne modifie rien : aucune planification automatique');
    if (s) {
      assert.equal(['2026-10-12', '2026-10-10'].includes(s.date), true);
      assert.equal(etat.jours[s.date].creneaux[s.creneau], 'libre');
    } else {
      assert.equal([lundiAvantMidi, samedi1, samedi2, samedi3].every((x) => x !== 'libre'), true);
    }
  }
  // Tout est chargé ou indisponible : aucune suggestion.
  definirCreneau(etat, S.lundiSuivant, 'avant_midi', 'charge', h());
  for (const c of ['avant_soir', 'apres_midi', 'avant_midi']) definirCreneau(etat, S.samedi, c, 'indisponible', h());
  assert.equal(suggererCreneau(etat, prod), null);
  // Une production décidée à la main sur un créneau chargé reste possible, avec alerte.
  const manuel = planifier(etat, prod, S.lundiSuivant, 'avant_midi', h());
  assert.ok(manuel.alertes.some((a) => a.includes('chargé')));
});

test('15. Le vendredi et le samedi, le tableau blanc montre la semaine en cours et la suivante ; une tâche du samedi pour le lundi apparaît sur les deux feuilles quotidiennes (part domaine)', () => {
  // Reste à vérifier dans le navigateur : l'affichage du tableau blanc (semaine en cours + semaine suivante les
  // vendredi et samedi, boutons semaine précédente/suivante). Le domaine fournit les dates et les feuilles.
  const etat = etatVide();
  prevision(etat, S.lundiSuivant, 1, 20);
  const id = composantValide(etat, S.lundiSuivant, 1, J.PRODUIT_SEC_TEST);
  const prod = principaleDe(etat, id);
  planifier(etat, prod, S.samedi, 'apres_midi', h());

  const samedi = feuilleDuJour(etat, S.samedi);
  const lundi = feuilleDuJour(etat, S.lundiSuivant);
  assert.ok(tachesDe(samedi).some((t) => t.productionId === prod), 'sur la feuille du samedi');
  assert.ok(lundi.attendus.some((t) => t.productionId === prod && t.jourDecide === S.samedi), 'sur la feuille du lundi : « prévu samedi »');
  assert.equal(tachesDe(samedi).find((t) => t.productionId === prod).cible, lundi.attendus.find((t) => t.productionId === prod).cible);

  marquerFait(etat, prod, undefined, h());
  assert.ok(feuilleDuJour(etat, S.samedi).dejaPret.some((t) => t.productionId === prod));
  assert.ok(feuilleDuJour(etat, S.lundiSuivant).dejaPret.some((t) => t.productionId === prod), 'prête sur la feuille du lundi');
  assert.equal(feuilleDuJour(etat, S.lundiSuivant).attendus.length, 0);
});

test('Part B du scénario 7 : une préparatoire reste un travail préparatoire et ne couvre jamais le produit fini', () => {
  const etat = etatVide();
  prevision(etat, S.mardiSuivant, 1, 20);
  const id = composantValide(etat, S.mardiSuivant, 1, J.PRODUIT_SEC_TEST);
  const prep = ajouterPreparatoire(etat, id, 'ACTION_PREPARATOIRE_TEST', h());
  assert.equal(etat.productions[prep].genre, 'preparatoire');
  planifier(etat, prep, S.samedi, 'avant_midi', h());
  marquerFait(etat, prep, null, h());
  assert.equal(ecartProduction(etat, id), 1000, 'le besoin reste entier');
});

// Le scénario 18 (le tableau blanc met en avant ce qui reste à faire selon le contexte) est pour le lot suivant.

const composantDe = (etat, date, menu, nom) => Object.values(etat.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);

test('16. La saisie des menus d\'une semaine ne demande aucune validation : les composants du poste sont attribués seuls ; une correction du chef est mémorisée et réappliquée à la saisie suivante', () => {
  const etat = etatVide();
  // Une seule saisie pour la semaine : aucune validation de transcription, aucune validation de composants.
  saisirMenusSemaine(etat, S.lundi, {
    [S.lundi]: { menu1: M.principal, menu2: M.garnitures, prevision1: 30, prevision2: 12 },
    [S.mardi]: { menu1: M.garnitures, menu2: M.inconnu, prevision1: 25, prevision2: 8 },
  }, h());
  assert.ok(Object.values(etat.composants).every((c) => c.valide), 'composants valides d\'emblée');
  assert.equal(etat.jours[S.lundi].menus[2].transcriptionValidee, true);

  // Les composants du poste sont attribués seuls : menu 1 tout ; menu 2 légumes et féculents seulement.
  assert.deepEqual(['poulet', 'carottes'].map((n) => composantDe(etat, S.lundi, 1, n).attribue), [true, true]);
  assert.deepEqual(['riz', 'carottes', 'poulet'].map((n) => composantDe(etat, S.lundi, 2, n).attribue), [true, true, false]);
  assert.ok(principaleDe(etat, composantDe(etat, S.lundi, 2, 'riz').id), 'chaque composant attribué a sa production');
  assert.equal(principaleDe(etat, composantDe(etat, S.lundi, 2, 'poulet').id), undefined);
  const aValider = (date) => pointsAConfirmer(etat, date).filter((p) => p.type === 'transcription' || p.type === 'composants');
  assert.deepEqual([aValider(S.lundi), aValider(S.mardi)], [[], []]);
  // Un composant que l'application ne sait pas classer est signalé une fois, sans rien bloquer.
  const inconnu = composantDe(etat, S.mardi, 2, 'ELEMENT_INCONNU_TEST');
  assert.deepEqual(pointsAConfirmer(etat, S.mardi).filter((p) => p.type === 'composant_inconnu').map((p) => p.composantId), [inconnu.id]);

  // Corrections du chef : le poulet du menu 2 passe au poste ; l'élément inconnu est classé légume au poste.
  modifierComposant(etat, composantDe(etat, S.lundi, 2, 'poulet').id, { attribue: true }, h());
  modifierComposant(etat, inconnu.id, { categorie: 'legume', attribue: true }, h());
  assert.deepEqual(pointsAConfirmer(etat, S.mardi).filter((p) => p.type === 'composant_inconnu'), []);
  assert.deepEqual(Object.keys(etat.memoire).sort(), ['element_inconnu_test|2', 'poulet|2'], 'seuls les noms corrigés sont mémorisés');

  // Saisie suivante : les mêmes noms reçoivent la correction, sans geste.
  saisirMenusSemaine(etat, S.lundiSuivant, {
    [S.lundiSuivant]: { menu1: M.principal, menu2: 'poulet, riz, ELEMENT_INCONNU_TEST', prevision1: 20, prevision2: 6 },
  }, h());
  const poulet = composantDe(etat, S.lundiSuivant, 2, 'poulet');
  assert.equal(poulet.attribue, true, 'attribution corrigée, réappliquée');
  assert.ok(principaleDe(etat, poulet.id));
  const nouveau = composantDe(etat, S.lundiSuivant, 2, 'ELEMENT_INCONNU_TEST');
  assert.deepEqual([nouveau.categorie, nouveau.attribue, nouveau.type], ['legume', true, 'generique'], 'catégorie corrigée, réappliquée');
  assert.deepEqual(pointsAConfirmer(etat, S.lundiSuivant).filter((p) => p.type === 'composant_inconnu'), []);
  // Un nom que le chef n'a pas corrigé garde le comportement par défaut.
  assert.equal(composantDe(etat, S.lundiSuivant, 2, 'riz').attribue, true);
  assert.equal(composantDe(etat, S.lundiSuivant, 1, 'poulet').attribue, true);
});

// Adapté B-P0 : le riz reçoit son repère validé ; l'orge reste le cas « sans donnée, rien d'inventé ».
// Adapté le 2026-10-04 (décision « Standards de base et ajustement terrain ») : un paramètre repris des standards de base
// est utilisé directement, étiqueté « standard de base » avec sa provenance ; il n'est plus « à valider ». Ce qui reste :
// rien n'est jamais rempli dans la quantité achetée par le calcul, et sans donnée, rien n'est inventé.
test('17. Un paramètre repris des standards de base est visible, étiqueté « standard de base » avec sa provenance, et la quantité achetée n\'est jamais remplie par le calcul ; sans donnée, aucune valeur n\'est inventée', () => {
  const etat = etatVide();
  saisirMenusSemaine(etat, S.lundi, { [S.lundi]: { menu2: 'riz, carottes, orge, ELEMENT_INCONNU_TEST', prevision2: 40 } }, h());
  const riz = composantDe(etat, S.lundi, 2, 'riz');
  const carottes = composantDe(etat, S.lundi, 2, 'carottes');

  // 1. Le paramètre repris des standards de base est visible dans le composant, avec sa provenance et sa source.
  // Carottes : le référentiel culinaire (12–25 % de perte, confirmé à la source) prime sur la base métier (12–15 %).
  const ligne = BASE_METIER.find((l) => l.etape === 'parage' && l.produit === 'Carottes');
  assert.equal(ligne.texte, '12–15 %', 'la base métier reste lisible, l\'écart est gardé');
  const etape = carottes.etapes[0];
  assert.deepEqual([etape.etape, etape.statut, etape.coefficient], ['parage', 'STANDARD_BASE', 0.815]);
  assert.equal(etape.source, 'référentiel culinaire : 12–25 % de perte du poids brut (legumes.parage.carotte, confirmé à la source)');
  assert.equal(libelle('PROVENANCE', etape.statut), 'standard de base');
  assert.equal(riz.etapes[0].statut, 'STANDARD_BASE');

  // 2. Le calcul s'en sert directement (« standard de base », plus « à valider ») ; la quantité achetée n'est jamais remplie.
  definirStandard(etat, 'carottes', 'garniture', ST.cruNet, h()); // portion saisie par le chef : elle passe devant
  const calc = calculerComposant(etat, carottes.id);
  assert.equal(calc.statut, 'CALCULE');
  assert.equal(calc.aValider, false, 'un standard de base n\'est pas « à valider »');
  assert.equal(calc.standardBase, true);
  assert.deepEqual(calc.dependances.map((d) => [d.parametre, d.statut]), [['grammage', 'RESTAURANT_VALIDE'], ['parage', 'STANDARD_BASE']]);
  assert.match(calc.formule, /÷ 0,815 \(parage\)/);
  const besoins = besoinsProduits(etat, S.lundi);
  const ligneCarottes = besoins.lignes.find((l) => l.cle === 'carottes');
  assert.deepEqual([ligneCarottes.aValider, ligneCarottes.standardBase], [false, true]);
  assert.ok(Math.abs(ligneCarottes.besoinBrut - 6000 / 0.815) < 1e-6);
  const suivi = suiviProduit(etat, S.lundi, ligneCarottes);
  assert.equal(suivi.estimationAValider, false);
  assert.deepEqual([suivi.quantiteAcheter, suivi.proposeeACommander, suivi.commandeLe, suivi.quantiteCommandable], [null, null, null, null],
    'rien n\'est commandé tant que la ligne n\'est pas notée');
  assert.throws(() => marquerCommande(etat, S.lundi, 'carottes', 'g', h()), /quantité réellement achetée/);
  controlerProduit(etat, S.lundi, 'carottes', 'g', 'a_commander', 100, h());
  const apres = suiviProduit(etat, S.lundi, ligneCarottes);
  assert.equal(apres.quantiteAcheter, null, 'même après un contrôle : la quantité achetée n\'est jamais remplie par le calcul');

  // 3. Sans donnée dans la base, aucune valeur n'est inventée.
  const orge = composantDe(etat, S.lundi, 2, 'orge');
  assert.deepEqual([orge.famille, orge.type, orge.etapes], ['orge', 'produit_simple', []], 'pas de ligne de cuisson dans la base : aucune étape inventée');
  const inconnu = composantDe(etat, S.lundi, 2, 'ELEMENT_INCONNU_TEST');
  assert.deepEqual([inconnu.famille, inconnu.etapes, inconnu.grammage.valeur], [null, [], null]);
  const sansValeur = [riz, orge, inconnu].map((c) => calculerComposant(etat, c.id));
  // Le riz a un repère validé (standard de base, utilisé directement) ; l'orge n'en a pas : rien d'inventé.
  assert.equal(grammageEffectif(etat, riz).origine, 'standard_base');
  assert.equal(sansValeur[0].statut, 'CALCULE');
  assert.equal(sansValeur[0].aValider, false);
  assert.equal(grammageEffectif(etat, orge), null);
  assert.ok(sansValeur[1].statut === 'INCONNU' && sansValeur[1].quantiteTravail === null && sansValeur[1].brut === null);
  assert.deepEqual(besoins.lignes.map((l) => l.cle).sort(), ['carottes', 'riz'], 'seuls les composants chiffrables figurent au besoin');
  assert.deepEqual(['aValider', 'standardBase'].map((k) => besoins.lignes.find((l) => l.cle === 'riz')[k]), [false, true]);
  assert.equal(besoins.nonChiffrables.some((x) => x.composantId === orge.id && /grammage/.test(x.raison)), true);
  assert.equal(sansValeur[2].quantiteTravail, null);
  assert.equal(sansValeur[2].statut, 'INCONNU');
});

test('18. Le tableau blanc met en avant, selon le contexte, ce qui reste à faire avant le service, ce qui peut être avancé après, ou la semaine suivante en fin de semaine', async () => {
  const { tableauBlanc } = await import('../app/js/domaine/tableau-blanc.js');
  const { definirMenu: saisir, definirRegle: regle, definirStandard: standard, planifier: placer, marquerFait: fait } = await import('../app/js/domaine/actions.js');
  const e = etatVide();
  // Jeu TEST_ONLY : mots de catégorie génériques, portions arbitraires.
  saisir(e, S.lundi, 1, 'riz et carottes', h());
  saisir(e, S.mardi, 1, 'pâtes aux courgettes', h());
  standard(e, 'riz', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  standard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.mardi, 1, 10);
  // Les pâtes du menu 1 se font le jour même, sauf exception validée : avance de 2 jours validée pour ce nom.
  regle(e, { nom: 'pâtes', avanceMaxJours: 2 }, h());
  const production = (date) => Object.values(e.productions).find((p) => p.dateService === date).id;

  // Avant le service : ce qui reste à faire, avec sa quantité, et la feuille du jour comme action.
  const avant = tableauBlanc(e, S.lundi).contexte;
  assert.equal(avant.type, 'service');
  assert.deepEqual(avant.lignes.filter((l) => l.genre === 'tache').map((l) => [l.texte, l.quantite]), [['riz et carottes', '1 000 g']]);
  assert.equal(avant.action.lien, `#/jour/${S.lundi}`);

  // Après le service : ce qui peut être avancé pour le lendemain.
  placer(e, production(S.lundi), S.lundi, 'avant_midi', h());
  fait(e, production(S.lundi), null, h());
  const apres = tableauBlanc(e, S.lundi).contexte;
  assert.equal(apres.type, 'apres_service');
  // « pâtes aux courgettes » se lit en deux éléments (pâtes, courgettes) et une sauce à confirmer : on suit la ligne des pâtes.
  assert.deepEqual(apres.lignes.filter((l) => l.genre === 'avance' && /^pâtes,/.test(l.texte)).map((l) => [l.texte, l.quantite]),
    [['pâtes, pour mardi 6 octobre', '1 000 g']]);

  // En fin de semaine : le tableau affiche la semaine suivante.
  const samedi = tableauBlanc(e, S.samediPrecedent);
  assert.equal(samedi.contexte.type, 'semaine_prochaine');
  assert.equal(samedi.lundi, S.lundi);
  assert.equal(tableauBlanc(e, S.mercredi).lundi, S.lundi, 'en semaine : la semaine en cours');
});

