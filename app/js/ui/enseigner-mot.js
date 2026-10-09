// Le geste pour enseigner : sur un élément « à préciser » ou « à confirmer », quatre choix en un toucher. Le choix classe
// l'élément, retient son mot pour tous les plats et reclasse ceux des semaines à venir (domaine/actions-mots.js).

import { estSauceAConfirmer } from '../domaine/etat.js';
import { enseignerMot } from '../domaine/actions-mots.js';
import { CATEGORIES_MOT, categorieMotValide } from '../domaine/mots-retenus.js';
import { agirStrict } from '../magasin.js';
import { h, svg } from './dom.js';
import { bouton } from './elements.js';
import { afficherMessage } from './messages.js';

// Icône de ligne (24 px) de chaque choix : l'état n'est jamais porté par la couleur seule.
const ICONES = {
  forme_pates: 'M4 8c4-3 12-3 16 0M4 12c4-3 12-3 16 0M4 16c4-3 12-3 16 0',
  sauce: 'M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10z',
  produit: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z',
  garniture: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 4v2M12 18v2M4 12h2M18 12h2',
};

/** Suggestion valide de l'élément, ou null. */
export const suggestionDe = (c) => (categorieMotValide(c?.suggestion) ? c.suggestion : null);

function choix(c, cle) {
  const icone = svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, svg('path', { d: ICONES[cle] }));
  const propose = suggestionDe(c) === cle;
  return h('button', { type: 'button', classe: `btn btn-court enseigner-choix${propose ? ' btn-principal' : ''}`,
    'aria-label': `${CATEGORIES_MOT[cle]} : retenir « ${c.nom} » pour tous les plats`,
    onClick: () => {
      const r = agirStrict((e, t) => enseignerMot(e, c.id, cle, t));
      const autres = r.reclasses > 0 ? ` ${r.reclasses} autre(s) élément(s) des semaines à venir reclassé(s).` : '';
      afficherMessage(`Retenu : ${r.mot} = ${CATEGORIES_MOT[cle].toLowerCase()}, pour tous les plats.${autres}`, 'ok');
    } }, icone, CATEGORIES_MOT[cle]);
}

/**
 * Les quatre choix pour un élément à préciser ou proposé (suggestion non confirmée). Une sauce implicite « à confirmer » n'a
 * pas de mot à retenir : elle reçoit le geste « Choisir la sauce » (`surSauce`), en principal. Rien si l'élément est précisé.
 */
export function blocEnseigner(c, surSauce = null) {
  if (estSauceAConfirmer(c)) {
    return surSauce ? h('div', { classe: 'enseigner' }, h('div', { classe: 'actions' }, bouton('Choisir la sauce', surSauce, 'court principal'))) : null;
  }
  const suggestion = suggestionDe(c);
  if (c.categorie !== 'a_preciser' && !suggestion) return null;
  return h('div', { classe: 'enseigner' },
    h('p', { classe: 'aide' }, suggestion ? `« ${c.nom} » : ${CATEGORIES_MOT[suggestion].toLowerCase()} proposée, à confirmer. Qu'est-ce que c'est ?`
      : `« ${c.nom} » : qu'est-ce que c'est ? Sanji le retiendra pour tous les plats.`),
    h('div', { classe: 'actions' }, Object.keys(CATEGORIES_MOT).map((cle) => choix(c, cle))));
}
