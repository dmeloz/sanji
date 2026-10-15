// Choix de l'état du poids d'une portion tapée (v131) : trois boutons « Poids sec / Poids cru / Poids cuit », celui du repère de la
// famille présélectionné. L'état choisi est celui qui est enregistré : rien n'est deviné en silence. Aucune logique métier ici.

import { ETAT_POIDS } from '../domaine/statuts.js';
import { h } from './dom.js';

const NOM_BOUTON = Object.freeze({ sec: 'Poids sec', cru_net: 'Poids cru', cuit: 'Poids cuit' });

/**
 * @param {string|null} initial état présélectionné (sec, cru_net, cuit) ; null = aucun bouton enfoncé, valeur() rend null
 * @param {(etat: string) => void} [surChoix] appelé à chaque choix
 * @returns {{noeud: object, valeur: () => string|null}}
 */
export function choixEtatPoids(initial, surChoix = () => {}) {
  let choisi = initial === null ? null : Object.hasOwn(ETAT_POIDS, initial) ? initial : 'cuit';
  const boutons = Object.keys(NOM_BOUTON).map((etat) => [etat, h('button', {
    type: 'button', classe: 'btn btn-court prep-valeur', 'aria-pressed': 'false',
    onClick: () => { choisi = etat; marquer(); surChoix(etat); },
  })]);
  function marquer() {
    for (const [etat, b] of boutons) {
      const actif = etat === choisi;
      b.setAttribute('aria-pressed', actif ? 'true' : 'false');
      b.textContent = actif ? `✓ ${NOM_BOUTON[etat]}` : NOM_BOUTON[etat];
    }
  }
  marquer();
  const noeud = h('div', { classe: 'prep-valeurs choix-poids', role: 'group', 'aria-label': 'État du poids de la portion' }, boutons.map(([, b]) => b));
  return { noeud, valeur: () => choisi };
}
