// Page « Fiches des éléments » (#/fiches, v118) : les fiches retenues, une par élément (carbonara, risotto, côtes de bette à la crème),
// rangées par rubrique : seuls les éléments au poste ont une fiche. Une recherche par nom. Un toucher ouvre la
// petite fiche en feuille (feuille-fiche-element.js). Le tri est dans domaine/fiches-elements.js ; aucune logique métier ici.

import { fichesParRubrique } from '../domaine/fiches-elements.js';
import { etat as etatCourant } from '../magasin.js';
import { h } from './dom.js';
import { ligneVide, pastille } from './elements.js';
import { ouvrirFicheElement } from './feuille-fiche-element.js';

const MESSAGE_VIDE = 'Aucune fiche pour l\'instant : elles se créent quand vous réglez un élément.';

// État de la page seulement (ni sauvegardé ni exporté) : il survit au redessin que chaque geste provoque.
let recherche = '';

export const titre = () => 'Fiches des éléments';

function ligne(f) {
  return h('li', null, h('button', { type: 'button', classe: 'fe-ligne', onClick: () => ouvrirFicheElement(f.cle), 'aria-label': `${f.nom}${f.resume ? ` : ${f.resume}` : ''}` },
    h('span', { classe: 'fe-ligne-nom' }, f.nom),
    f.aSaisir ? pastille(f.resume, 'ambre') : h('span', { classe: 'fe-ligne-resume' }, f.resume)));
}

function rubrique(r) {
  return h('section', { classe: 'fe-rubrique', 'aria-label': r.titre },
    h('h2', { classe: 'section-titre' }, `${r.titre} · ${r.fiches.length}`),
    r.fiches.length === 0 ? null : h('ul', { classe: 'fe-liste' }, r.fiches.map(ligne)));
}

/** Les rubriques (toujours les cinq) ou, s'il n'y a rien à montrer, la phrase qui le dit. */
function contenu(etat) {
  const r = fichesParRubrique(etat, { recherche });
  const message = r.total === 0 ? MESSAGE_VIDE
    : r.rubriques.every((x) => x.fiches.length === 0) ? `Aucune fiche ne correspond à « ${recherche.trim()} ».` : null;
  return [message ? ligneVide(message) : null, ...r.rubriques.map(rubrique)];
}

export function rendre(etat) {
  const zone = h('div', { classe: 'fe-zone' }, contenu(etat).filter(Boolean));
  const champ = h('input', { type: 'search', id: 'fe-recherche', classe: 'fe-recherche', autocomplete: 'off', 'aria-label': 'Chercher une fiche par nom', placeholder: 'Chercher un élément' });
  champ.value = recherche;
  champ.addEventListener('input', () => { recherche = champ.value; zone.replaceChildren(...contenu(etatCourant()).filter(Boolean)); });
  return h('div', { classe: 'vue vue-fiches-elements' },
    h('a', { href: '#/reglages', classe: 'reglage-retour' }, '‹ Réglages'),
    h('h1', { classe: 'page-titre' }, 'Fiches des éléments'),
    champ, zone);
}
