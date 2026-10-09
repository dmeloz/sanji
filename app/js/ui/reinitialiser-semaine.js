// « Réinitialiser la semaine » (semaines à venir seulement) : confirmation, une écriture, puis retour sur l'import, prête à re-scanner.

import { reinitialiserSemaine, semaineReinitialisable } from '../domaine/actions-semaine.js';
import { libelleJour } from '../domaine/dates.js';
import { agirStrict, aujourdhui } from '../magasin.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';

export const peutReinitialiser = (lundi) => semaineReinitialisable(lundi, aujourdhui());

export function demanderReinitialisation(lundi, apres = () => {}) {
  confirmer({
    titre: `Réinitialiser la semaine du ${libelleJour(lundi)} ?`,
    texte: 'Les menus, couverts, préparations (même déjà faites) et fiches de fonction de cette semaine seront supprimés. Les allergies saisies sur ces fiches sont perdues. Vos standards et ce que Sanji a appris ne changent pas.',
    libelleOk: 'Réinitialiser', danger: true,
    action: () => {
      agirStrict((copie, heure) => reinitialiserSemaine(copie, lundi, aujourdhui(), heure));
      afficherMessage('Semaine réinitialisée.', 'info');
      location.hash = `#/import/${lundi}`;
      apres();
    },
  });
}
