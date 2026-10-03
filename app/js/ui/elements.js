// Petits éléments d'interface réutilisés par les vues.

import { h } from './dom.js';

/** Pastille de statut. @param {'ambre'|'vert'|'rouge'|'gris'} variante */
export function pastille(texte, variante = 'gris') {
  return h('span', { classe: `pastille pastille-${variante}` }, texte);
}

export function lien(href, texte, classe = 'lien') {
  return h('a', { href, classe }, texte);
}

/** Bouton d'action. `classe` : '' (neutre), 'principal', 'danger', 'court'. */
export function bouton(texte, surClic, classe = '', extra = {}) {
  const classes = ['btn', ...classe.split(' ').filter(Boolean).map((c) => `btn-${c}`)].join(' ');
  return h('button', { type: 'button', classe: classes, onClick: surClic, ...extra }, texte);
}

/** Ligne discrète pour une rubrique vide (pas de bloc vide). */
export function ligneVide(texte) {
  return h('p', { classe: 'vide' }, texte);
}

export function titreSection(texte, id) {
  return h('h2', { classe: 'section-titre', id }, texte);
}

/**
 * Bloc repliable : un <details> dont le résumé est le titre. `ouvert` le laisse déplié (rubrique qui contient une
 * donnée) ; sans donnée, il reste fermé. `attributs` : classe, id…
 */
export function repliable(resume, ouvert, contenu, attributs = {}) {
  const { classe = '', ...reste } = attributs;
  return h('details', { classe: `repliable ${classe}`.trim(), open: Boolean(ouvert), ...reste },
    h('summary', null, resume), contenu);
}

/** Message d'alerte ou d'information dans la page. @param {'alerte'|'info'|'erreur'} niveau */
export function encadre(niveau, ...contenu) {
  return h('div', { classe: `encadre encadre-${niveau}`, role: niveau === 'info' ? undefined : 'alert' }, contenu);
}

/** Barre de navigation précédent / aujourd'hui / suivant. */
export function navigationPeriode(precedent, courant, suivant) {
  return h('nav', { classe: 'nav-periode', 'aria-label': 'Navigation' },
    lien(precedent.href, precedent.texte, 'btn'),
    lien(courant.href, courant.texte, 'btn'),
    lien(suivant.href, suivant.texte, 'btn'));
}

/** Liste de définitions (terme / valeur). `lignes` : [terme, valeur][] ; les valeurs vides sont ignorées. */
export function definitions(lignes) {
  const dl = h('dl', { classe: 'definitions' });
  for (const [terme, valeur] of lignes) {
    if (valeur === null || valeur === undefined || valeur === '') continue;
    dl.appendChild(h('dt', null, terme));
    dl.appendChild(h('dd', null, valeur));
  }
  return dl;
}

/** Ouvre la fenêtre d'impression du navigateur (sans effet là où elle n'existe pas). */
export function imprimer() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
}
