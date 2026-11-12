// Cuisine (refonte, étape 6) : le troisième onglet, « ce que Sanji sait de votre cuisine ». Ce que Sanji a remarqué (propositions
// d'apprentissage, à accepter ou non dans leur feuille), les fiches des éléments par rubrique, les portions et les règles
// (les rubriques métier de l'ancien Réglages), puis les réglages de l'app. Aucune règle métier ici : la page ne fait que mener.

import { propositionsApprentissage } from '../domaine/apprentissage.js';
import { fichesParRubrique } from '../domaine/fiches-elements.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { ouvrirProposition } from './feuille-validation.js';
import { pluriel } from './format.js';
import { resumeRubrique } from './vue-reglages.js';

export function titre() { return 'Cuisine'; }

const chevron = () => h('span', { classe: 'cui-chevron', 'aria-hidden': 'true' }, '›');

/** Une ligne qui mène quelque part : le nom en avant, une précision en petit dessous, un nombre éventuel à droite. */
function ligne(href, nom, precision = null, nombre = null) {
  return h('li', null, h('a', { href, classe: 'cui-ligne' },
    h('span', { classe: 'cui-ligne-texte' }, h('span', { classe: 'cui-ligne-nom' }, nom), precision ? h('span', { classe: 'cui-ligne-precision' }, precision) : null),
    nombre === null ? null : h('span', { classe: 'cui-ligne-nombre' }, String(nombre)),
    chevron()));
}

const section = (id, titreTexte, lignes) => h('section', { classe: 'cui-section', 'aria-labelledby': `cui-titre-${id}` },
  h('h2', { classe: 'cui-section-titre', id: `cui-titre-${id}` }, titreTexte),
  h('ul', { classe: 'cui-lignes' }, lignes));

/** « Sanji a remarqué » : une carte par proposition d'apprentissage ; le bouton ouvre la feuille où le chef décide. Rien sans proposition. */
function carteRemarques(etat) {
  const propositions = propositionsApprentissage(etat, aujourdhui());
  if (propositions.length === 0) return null;
  return h('section', { classe: 'cui-remarques', 'aria-labelledby': 'cui-titre-remarques' },
    h('h2', { classe: 'cui-remarques-titre', id: 'cui-titre-remarques' }, `Sanji a remarqué · ${propositions.length}`),
    propositions.map((p) => h('div', { classe: 'cui-remarque' },
      h('p', { classe: 'cui-remarque-texte' }, p.texte),
      h('button', { type: 'button', classe: 'btn btn-principal cui-remarque-action', onClick: () => ouvrirProposition(p) }, 'Voir et décider'))));
}

function sectionFiches(etat) {
  const r = fichesParRubrique(etat);
  const pleines = r.rubriques.filter((x) => x.fiches.length > 0);
  return section('fiches', 'Fiches des éléments', pleines.length === 0
    ? [ligne('#/fiches', 'Aucune fiche pour l\'instant', 'elles se créent quand vous réglez un élément')]
    : [...pleines.map((x) => ligne('#/fiches', x.titre, null, x.fiches.length)),
      ligne('#/fiches', 'Chercher un élément', pluriel(r.total, 'fiche'))]);
}

export function rendre(etat) {
  return h('div', { classe: 'vue vue-cuisine' },
    h('header', { classe: 'cui-tete' },
      h('p', { classe: 'cui-sur-titre' }, 'Ce que Sanji sait de votre cuisine'),
      h('h1', { classe: 'cui-titre' }, 'Cuisine')),
    carteRemarques(etat),
    sectionFiches(etat),
    section('portions', 'Portions et règles', [
      ligne('#/reglages/standards', 'Mes standards maison', resumeRubrique('standards', etat)),
      ligne('#/reglages/standards-base', 'Standards de base', resumeRubrique('standards-base', etat)),
      ligne('#/reglages/organisation', 'Avances et conservation', `avance normale : 2 jours · ${resumeRubrique('organisation', etat)}`),
      ligne('#/reglages/reperes', 'Repères métier', 'temps, températures, techniques'),
      ligne('#/reglages/produits', 'Produits et commandes', resumeRubrique('produits', etat)),
    ]),
    section('app', 'Application', [ligne('#/reglages', 'Réglages de l\'app', 'sauvegarde, mise à jour, historique')]));
}
