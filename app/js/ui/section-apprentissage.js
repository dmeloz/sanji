// Réglages > Apprentissage et essais : ce que Sanji a appris (lecture seule) et l'accès à « Notes et diagnostic ».

import { libelleJour } from '../domaine/dates.js';
import { oublierMot } from '../domaine/actions-mots.js';
import { CATEGORIES_MOT } from '../domaine/mots-retenus.js';
import { rapportApprentissage } from '../domaine/rapport-apprentissage.js';
import { agir } from '../magasin.js';
import { h } from './dom.js';
import { bouton, ligneVide, lien } from './elements.js';
import { pluriel } from './format.js';
import { ouvrirCentreDev } from './centre-dev.js';
import { lireEvenements } from './journal-diagnostic.js';
import { notesParEtat } from './notes-dev.js';
import { indicateurErreurs } from './section-diagnostic.js';
import { interrupteurPastille } from './section-notes-dev.js';

const carte = (titre, ...contenu) => h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, titre), contenu);

export const resumeApprentissage = (etat) => {
  const n = rapportApprentissage(etat).motsRetenus;
  return `${pluriel(n, 'mot retenu', 'mots retenus')} · ${pluriel(notesParEtat('nouvelle').length, 'note nouvelle', 'notes nouvelles')}`;
};

/** Un mot retenu pour tous les plats peut être oublié ; un nom retenu pour un menu se lit seulement. */
function ligneMot(m) {
  if (!m.pourTous) return h('li', null, `${m.nom}${m.menu ? ` (menu ${m.menu})` : ''} · ${m.categorie}`);
  return h('li', { classe: 'ligne-mot' }, h('span', null, `${m.nom} · ${CATEGORIES_MOT[m.categorie].toLowerCase()} · tous les plats`),
    bouton('Oublier', () => agir((e, t) => oublierMot(e, m.nom, t)), 'court', { 'aria-label': `Oublier le mot : ${m.nom}` }));
}

function sectionAppris(etat) {
  const r = rapportApprentissage(etat);
  return carte('Ce que Sanji a appris',
    h('p', null, `${pluriel(r.motsRetenus, 'mot retenu', 'mots retenus')}${r.motsRetenus > r.mots.length ? ` (les ${r.mots.length} premiers sont listés)` : ''}.`),
    r.mots.length === 0 ? ligneVide('Aucun mot retenu pour l\'instant.')
      : h('ul', { classe: 'liste-simple' }, r.mots.map(ligneMot)),
    h('p', null, `${pluriel(r.fichesRetenues, 'fiche d\'élément retenue', 'fiches d\'éléments retenues')}. `, lien('#/fiches', 'Voir les fiches des éléments')),
    h('h3', { classe: 'retour-essai-sous-titre' }, 'À préciser par semaine'),
    r.semaines.length === 0 ? ligneVide('Aucune semaine avec des composants.')
      : h('ul', { classe: 'liste-simple' }, r.semaines.map((s) => h('li', null, `Semaine du ${libelleJour(s.lundi)} : ${s.aPreciser} à préciser sur ${s.composants}`))));
}

function sectionCentre() {
  const nouvelles = notesParEtat('nouvelle').length;
  return carte('Notes et diagnostic',
    h('p', { classe: 'aide' }, 'Notes, retours d\'essai et journal partent ensemble, d\'un seul geste, depuis une même feuille. Rien n\'est envoyé automatiquement.'),
    interrupteurPastille(),
    h('p', null, `${pluriel(nouvelles, 'note nouvelle', 'notes nouvelles')} · ${pluriel(lireEvenements().length, 'événement noté', 'événements notés')}`),
    h('div', { classe: 'actions' }, bouton('Ouvrir notes et diagnostic', () => ouvrirCentreDev(), 'court')));
}

export const sectionsApprentissage = (etat) => [indicateurErreurs(), sectionAppris(etat), sectionCentre()];
