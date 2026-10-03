// État de test partagé : une réglette de mise en place qui montre chaque symbole (ce n'est pas un test : pas de suffixe .test.js).
// Données : jeux TEST_ONLY uniquement, noms neutres.

import { deciderEcart, definirRegle, demarrer, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe } from './aide.js';

/** Service du vendredi 2 octobre, production faite le 1er (h()) : une avance d'un jour. */
export function etatReglette() {
  const e = etatVide();
  const jour = S.veille;
  menuValide(e, jour, 1, 'INTITULE_TEST_1');
  menuValide(e, jour, 2, 'INTITULE_TEST_2');
  prevision(e, jour, 1, 40);
  prevision(e, jour, 2, 10);
  const ids = {
    pret: composantValide(e, jour, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_PRET_TEST' }),
    nonCouvert: composantValide(e, jour, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_HORS_LIMITE_TEST' }),
    enCours: composantValide(e, jour, 1, J.PRODUIT_CRU_TEST, { nom: 'ELEMENT_EN_COURS_TEST' }),
    aFaire: composantValide(e, jour, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_A_FAIRE_TEST' }),
    aDecider1: composantValide(e, jour, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_A_PLANIFIER_TEST' }),
    aPreciser: composantValide(e, jour, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_A_PRECISER_TEST', grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } }),
    ecart: composantValide(e, jour, 2, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_ECART_TEST' }),
  };
  definirRegle(e, { nom: 'ELEMENT_HORS_LIMITE_TEST', avanceMaxJours: 2, limiteUtilisationJours: 0 }, h());
  marquerFait(e, principaleDe(e, ids.pret), null, h());
  marquerFait(e, principaleDe(e, ids.nonCouvert), null, h());
  // Une avance qui ne couvre pas laisse d'abord un écart à arbitrer ; une fois « aucune production supplémentaire » décidée,
  // la tâche reste « faite » mais ne couvre pas le besoin.
  deciderEcart(e, principaleDe(e, ids.nonCouvert), 'aucune', h());
  demarrer(e, principaleDe(e, ids.enCours), h());
  planifier(e, principaleDe(e, ids.aFaire), jour, 'avant_midi', h());
  marquerFait(e, principaleDe(e, ids.ecart), null, h());
  prevision(e, jour, 2, 14); // le besoin du menu 2 change après la production : écart à arbitrer
  return { e, ids, jour };
}

