// Actions : elles modifient l'état reçu, ajoutent une ligne au journal et rétablissent les invariants.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.
// Invariant : aucune action (hors marquerFait et corrigerReel) ne touche à `quantiteReelle` ni à `instantane`.
// Depuis l'étape 3 de la refonte, ce fichier n'est plus qu'une façade : le code vit dans les modules `actions-*.js` ci-dessous.

export {
  assurerProductions, terminer, verifierSemaineModifiable,
} from './actions-socle.js';
export {
  ajouterComposant, confirmerAttribution, definirMenu, modifierComposant, saisirMenusSemaine, supprimerComposant,
} from './actions-menus.js';
export {
  ajouterAdaptation, annulerFiche, confirmerRepartition, creerFiche, definirPrevision, modifierFiche, saisirApresService, saisirVentes,
} from './actions-services.js';
export {
  ajouterPreparatoire, annulerFait, corrigerReel, deciderEcart, demarrer, enregistrerPesee, marquerFait, planifier, reporter, supprimerProduction,
} from './actions-productions.js';
export {
  definirStandard, memoriser, reprendreMemoire, supprimerStandard,
} from './actions-standards.js';
export {
  composerMelange, creerRecette, definirFournisseur, definirMargeSecurite, definirRegle, modifierRecette, noterExport, supprimerFournisseur, supprimerRegle, validerRecette,
} from './actions-regles.js';
