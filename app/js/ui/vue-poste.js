// Mode en poste (#/poste/<composantId>). Provisoire : ramène à la fiche du composant.

import { h } from './dom.js';

export function titre() { return 'Mode en poste'; }

export function rendre(etat, composantId) {
  const fiche = `#/fiche/${encodeURIComponent(composantId ?? '')}`;
  return h('div', { classe: 'vue vue-poste' },
    h('h1', { classe: 'page-titre' }, 'Mode en poste'),
    h('p', { classe: 'vide' }, 'À venir.'),
    h('p', null, h('a', { href: fiche, classe: 'btn' }, 'Retour à la fiche')));
}
