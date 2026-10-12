// Petits éléments d'interface réutilisés par les vues.

import { h, svg } from './dom.js';
import { panneau } from './panneau.js';

// Étiquette d'état : un état porté par une couleur a toujours une icône ET un mot. Le ton neutre (gris) reste en mot seul.
const ICONES_ETIQUETTE = {
  ambre: { classe: 'etq-ambre', formes: [['path', { d: 'M12 3l10 18H2z' }], ['path', { d: 'M12 10v5M12 18v.5' }]] },
  vert: { classe: 'etq-action', formes: [['path', { d: 'M5 12l5 5 9-10' }]] },
  rouge: { classe: 'etq-rouge', formes: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v6M12 16v.5' }]] },
  ia: { classe: 'etq-ia', formes: [['path', { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' }]] },
  chef: { classe: 'etq-chef', formes: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' }]] },
};

/** Pastille de statut, avec icône selon le ton. @param {'ambre'|'vert'|'rouge'|'ia'|'chef'|'gris'} variante */
export function pastille(texte, variante = 'gris') {
  const ton = ICONES_ETIQUETTE[variante];
  const icone = ton && svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, ton.formes.map(([balise, attributs]) => svg(balise, attributs)));
  return h('span', { classe: `etq ${ton ? `${ton.classe} ` : ''}pastille pastille-${variante}` }, icone, texte);
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

/**
 * État vide (refonte 2) : un titre, une phrase, des boutons-liens. `etiquette` : mot d'état au-dessus du titre ;
 * `icone` : tracé d'icône de ligne (attribut `d` d'un chemin 24 px). `actions` : [{ libelle, href, principal }].
 */
export function etatVide({ titre, texte, actions = [], etiquette = null, icone = null }) {
  return h('div', { classe: 'etat-vide' },
    icone ? svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', classe: 'etat-vide-icone' }, [svg('path', { d: icone })]) : null,
    etiquette ? h('span', { classe: 'etq' }, etiquette) : null,
    h('p', { classe: 'etat-vide-titre' }, titre),
    h('p', { classe: 'etat-vide-texte' }, texte),
    actions.length > 0 ? h('div', { classe: 'etat-vide-actions' },
      actions.map((a) => lien(a.href, a.libelle, a.principal ? 'btn btn-principal' : 'btn'))) : null);
}

export function titreSection(texte, id) {
  return h('h2', { classe: 'section-titre', id }, texte);
}

/**
 * Feuille de lecture : un toucher sur un bouton ou un lien du corps la ferme une fois son geste lancé (le geste ouvre sa
 * propre feuille ou redessine la page : la feuille ne reste jamais ouverte sur un contenu périmé).
 */
export function ouvrirFeuilleLecture(titre, corps) {
  const feuille = panneau({ titre, lectureSeule: true, corps });
  feuille.addEventListener('click', (ev) => {
    if (ev.target?.closest?.('.panneau-corps button, .panneau-corps a')) feuille.close();
  });
  return feuille;
}

/**
 * Ligne tappable (cible de 44 px, flèche ›) qui ouvre une feuille en lecture seule : le détail n'est jamais déroulé dans la
 * page. `contenu()` est appelé à chaque ouverture (contenu toujours à jour).
 */
export function ligneFeuille(libelle, titre, contenu, { classe = '', resume = null, ...attributs } = {}) {
  return h('button', {
    type: 'button', classe: `ligne-feuille ${classe}`.trim(), ...attributs,
    onClick: () => ouvrirFeuilleLecture(titre, [contenu()]),
  }, h('span', { classe: 'ligne-feuille-texte' }, h('strong', null, libelle), resume ? h('span', { classe: 'meta' }, resume) : null),
  h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›'));
}

/** Message d'alerte ou d'information dans la page. @param {'alerte'|'info'|'erreur'} niveau */
export function encadre(niveau, ...contenu) {
  return h('div', { classe: `encadre encadre-${niveau}`, role: niveau === 'info' ? undefined : 'alert' }, contenu);
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
