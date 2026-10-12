// Le geste pour enseigner : sur un élément « à préciser » ou « à confirmer », quatre choix en un toucher. Le choix classe
// l'élément, retient son mot pour tous les plats et reclasse ceux des semaines à venir (domaine/actions-mots.js).

import { estSauceAConfirmer } from '../domaine/etat.js';
import { classerEtRetenir, retenirElement } from '../domaine/actions-fiches.js';
import { enseignerMot } from '../domaine/actions-mots.js';
import { CATEGORIES_MOT, CLASSEMENTS_ELEMENT, categorieMotValide, choixMotDe } from '../domaine/mots-retenus.js';
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
  mode: 'M4 18h16M6 18a6 6 0 0 1 12 0M12 8V5M9 9l-1.5-2M15 9l1.5-2',
};

/** Suggestion valide de l'élément, ou null. */
export const suggestionDe = (c) => (categorieMotValide(c?.suggestion) ? c.suggestion : null);

/** Icône d'un des quatre choix (la page « Fiches des éléments » la réutilise). */
export const iconeChoix = (cle) => svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
  'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, svg('path', { d: ICONES[cle] }));

function choix(c, cle) {
  const icone = iconeChoix(cle);
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

/**
 * Bloc « Fiche de l'élément » de la fiche technique d'un élément AU POSTE déjà classé : les quatre choix (l'actuel écrit « actuel » et
 * pressé), et « Retenir la fiche » tant qu'aucune fiche n'existe. Rien hors poste, rien tant que l'élément est « à préciser »
 * ou proposé (c'est `blocEnseigner` qui parle alors : un seul bloc).
 * @param {object} c élément ; @param {object|null} fiche sa fiche retenue ; @param {Function} ouvrirFiche ouvre la petite fiche
 */
export function blocFicheElement(c, fiche, ouvrirFiche) {
  if (c.attribue !== true || estSauceAConfirmer(c) || c.categorie === 'a_preciser' || suggestionDe(c)) return null;
  const actuel = choixMotDe(fiche ?? c);
  const choisir = (cle) => {
    const r = agirStrict((e, t) => classerEtRetenir(e, c.id, cle, t));
    if (r) afficherMessage(`Retenu : ${c.nom} = ${CATEGORIES_MOT[cle].toLowerCase()}, fiche des éléments.`, 'ok');
  };
  const retenir = () => {
    agirStrict((e, t) => retenirElement(e, c.id, t));
    afficherMessage(`Retenu : ${c.nom} = ${CATEGORIES_MOT[actuel].toLowerCase()}, fiche des éléments.`, 'ok');
  };
  return h('section', { classe: 'enseigner', 'aria-label': 'Fiche de l\'élément' },
    h('p', { classe: 'aide' }, fiche ? `« ${c.nom} » a sa fiche. Catégorie :` : `« ${c.nom} » n'a pas encore de fiche. Catégorie :`),
    h('div', { classe: 'actions' }, CLASSEMENTS_ELEMENT.map((cle) => h('button', {
      type: 'button', classe: `btn btn-court enseigner-choix${cle === actuel ? ' btn-principal' : ''}`, 'aria-pressed': cle === actuel ? 'true' : 'false', onClick: () => choisir(cle),
    }, iconeChoix(cle), cle === actuel ? `${CATEGORIES_MOT[cle]} · actuel` : CATEGORIES_MOT[cle]))),
    h('div', { classe: 'actions' }, fiche ? bouton('Voir sa fiche retenue', ouvrirFiche, 'court')
      : (actuel ? bouton('Retenir la fiche', retenir, 'principal') : null)));
}
