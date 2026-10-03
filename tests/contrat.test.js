// Contrat technique : noms exportés par module, tels que l'interface les attend (conception, sections 3 à 11).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as actions from '../app/js/domaine/actions.js';
import * as allergenes from '../app/js/domaine/allergenes.js';
import * as analyse from '../app/js/domaine/analyse-menu.js';
import * as base from '../app/js/domaine/base.js';
import * as calcul from '../app/js/domaine/calcul.js';
import * as dates from '../app/js/domaine/dates.js';
import * as etat from '../app/js/domaine/etat.js';
import * as planification from '../app/js/domaine/planification.js';
import * as points from '../app/js/domaine/points.js';
import * as produits from '../app/js/domaine/produits.js';
import * as savoir from '../app/js/domaine/savoir.js';
import * as feuille from '../app/js/domaine/feuille.js';
import * as tableauBlanc from '../app/js/domaine/tableau-blanc.js';

const contient = (module, noms) => {
  for (const n of noms) assert.equal(typeof module[n], 'function', `export manquant : ${n}`);
};

test('exports du contrat', () => {
  contient(dates, ['ajouterJours', 'jourSemaine', 'lundiDe', 'joursEntre', 'estOuvert', 'aMenuDuJour', 'creneauxDuJour', 'libelleJour']);
  contient(etat, ['etatInitial', 'normaliser', 'exporter', 'importer', 'nouvelId']);
  contient(analyse, ['proposerComposants', 'categoriePropose']);
  contient(savoir, ['familleParCle', 'lireNom', 'familleDe', 'appliquerSavoir', 'grammageEffectif', 'lignesStandards']);
  assert.ok(Array.isArray(savoir.FAMILLES) && Array.isArray(savoir.GROUPES));
  contient(calcul, ['portionsMenu', 'calculerComposant', 'chercherBase']);
  contient(base, ['chercherBase']);
  contient(planification, ['etatCreneau', 'cibleProduction', 'etatTache', 'ecartProduction', 'evaluerAvance', 'regleDe',
    'suggererCreneau', 'avancesPossibles', 'chargeCreneau', 'feuilleDuJour']);
  contient(produits, ['besoinsProduits', 'suiviProduit', 'echeanceCommande']);
  contient(allergenes, ['alertesAllergenes']);
  contient(tableauBlanc, ['tableauBlanc', 'decisionsSansDoublon']);
  contient(feuille, ['analyserFeuille', 'repartirSurSemaine']);
  contient(points, ['pointsAConfirmer', 'pointsGlobaux', 'repereVentes']);
  contient(actions, ['definirMenu', 'validerTranscription', 'genererComposants', 'ajouterComposant', 'modifierComposant',
    'validerComposant', 'supprimerComposant', 'validerComposantsMenu', 'definirPrevision', 'creerFiche', 'modifierFiche',
    'annulerFiche', 'confirmerRepartition', 'ajouterAdaptation', 'definirCreneau', 'definirSemaineType', 'confirmerSemaineType',
    'definirCapacite', 'planifier', 'demarrer', 'marquerFait', 'corrigerReel', 'reporter', 'deciderEcart', 'ajouterPreparatoire',
    'supprimerProduction', 'enregistrerPesee', 'memoriser', 'reprendreMemoire', 'definirRegle', 'supprimerRegle', 'creerRecette',
    'modifierRecette', 'validerRecette', 'definirFournisseur', 'supprimerFournisseur', 'controlerProduit', 'definirAchat',
    'marquerCommande', 'saisirVentes', 'saisirApresService', 'assurerProductions', 'definirStandard', 'supprimerStandard',
    'saisirMenusSemaine']);
});

test('chaque action prend `h` en dernier argument', () => {
  const sansH = ['assurerProductions'];
  for (const [nom, fn] of Object.entries(actions)) {
    if (sansH.includes(nom)) continue;
    assert.equal(typeof fn, 'function', nom);
    assert.ok(fn.length >= 2, `${nom} : arité ${fn.length}`);
  }
});
