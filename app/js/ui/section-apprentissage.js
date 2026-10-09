// Réglages > Apprentissage et essais : ce que Sanji a appris (lecture seule) et l'accès à « Notes et diagnostic ».

import { libelleJour } from '../domaine/dates.js';
import { rapportApprentissage } from '../domaine/rapport-apprentissage.js';
import { h } from './dom.js';
import { bouton, ligneVide } from './elements.js';
import { pluriel } from './format.js';
import { ouvrirCentreDev } from './centre-dev.js';
import { lireEvenements } from './journal-diagnostic.js';
import { lireNotes } from './notes-dev.js';
import { indicateurErreurs } from './section-diagnostic.js';
import { interrupteurPastille } from './section-notes-dev.js';

const carte = (titre, ...contenu) => h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, titre), contenu);

export const resumeApprentissage = (etat) => {
  const n = rapportApprentissage(etat).motsRetenus;
  return `${pluriel(n, 'mot retenu', 'mots retenus')} · ${pluriel(lireNotes().length, 'note', 'notes')}`;
};

function sectionAppris(etat) {
  const r = rapportApprentissage(etat);
  return carte('Ce que Sanji a appris',
    h('p', null, `${pluriel(r.motsRetenus, 'mot retenu', 'mots retenus')}${r.motsRetenus > r.mots.length ? ` (les ${r.mots.length} premiers sont listés)` : ''}.`),
    r.mots.length === 0 ? ligneVide('Aucun mot retenu pour l\'instant.')
      : h('ul', { classe: 'liste-simple' }, r.mots.map((m) => h('li', null, `${m.nom}${m.menu ? ` (menu ${m.menu})` : ''} · ${m.categorie}`))),
    h('h3', { classe: 'retour-essai-sous-titre' }, 'À préciser par semaine'),
    r.semaines.length === 0 ? ligneVide('Aucune semaine avec des composants.')
      : h('ul', { classe: 'liste-simple' }, r.semaines.map((s) => h('li', null, `Semaine du ${libelleJour(s.lundi)} : ${s.aPreciser} à préciser sur ${s.composants}`))));
}

function sectionCentre() {
  const ouvertes = lireNotes().filter((n) => n.etat !== 'reglee').length;
  return carte('Notes et diagnostic',
    h('p', { classe: 'aide' }, 'Notes, retours d\'essai et journal partent ensemble, d\'un seul geste, depuis une même feuille. Rien n\'est envoyé automatiquement.'),
    interrupteurPastille(),
    h('p', null, `${pluriel(ouvertes, 'note ouverte', 'notes ouvertes')} · ${pluriel(lireEvenements().length, 'événement noté', 'événements notés')}`),
    h('div', { classe: 'actions' }, bouton('Ouvrir notes et diagnostic', () => ouvrirCentreDev(), 'court')));
}

export const sectionsApprentissage = (etat) => [indicateurErreurs(), sectionAppris(etat), sectionCentre()];
