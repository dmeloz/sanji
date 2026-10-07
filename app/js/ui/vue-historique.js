// Historique des semaines passées (#/historique), en lecture seule : aucun bouton de saisie, aucune écriture.
// Une semaine se déplie (jours, menus 1 et 2, couverts servis). Ne calcule rien : lit domaine/historique.js.

import { libelleJour } from '../domaine/dates.js';
import { historiqueSemaines } from '../domaine/historique.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { ligneVide, repliable } from './elements.js';

export function titre() { return 'Historique'; }

const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const servis = (n) => h('span', { classe: 'hist-qte' }, h('span', { classe: 'qte' }, String(n)), ' servis');

function etatSemaine(s) {
  const morceaux = [pluriel(s.jours.length, 'jour', 'jours'), s.ventesSaisies ? 'ventes saisies' : 'ventes à compléter'];
  if (s.joursSansMenu > 0) morceaux.push(`${pluriel(s.joursSansMenu, 'jour', 'jours')} sans menu`);
  return morceaux.join(' · ');
}

function ligneJour(j) {
  const menus = [j.menu1 ? `M1 ${j.menu1}` : null, j.menu2 ? `M2 ${j.menu2}` : null].filter(Boolean).join(' · ');
  return h('li', { classe: 'hist-jour' },
    h('span', { classe: 'hist-texte' }, h('span', { classe: 'nom' }, majuscule(libelleJour(j.date))), h('span', { classe: 'petit doux' }, menus)),
    j.servis === null ? h('span', { classe: 'petit doux' }, 'ventes à saisir') : servis(j.servis));
}

function semaine(s) {
  const resume = h('span', { classe: 'hist-ligne' },
    h('span', { classe: 'hist-texte' }, h('span', { classe: 'nom' }, `Semaine du ${libelleJour(s.lundi)}`), h('span', { classe: 'petit doux' }, etatSemaine(s))),
    servis(s.totalServi));
  return repliable(resume, false, h('ul', { classe: 'hist-jours' }, s.jours.map(ligneJour)), { classe: 'hist-semaine' });
}

export function rendre(etat) {
  const semaines = historiqueSemaines(etat, aujourdhui());
  return h('div', { classe: 'vue vue-historique' },
    h('a', { href: '#/semaine', classe: 'retour' }, '‹ Semaine'),
    h('p', { classe: 'petit doux' }, "Toutes les semaines restent sur l'iPhone"),
    h('h1', null, 'Historique'),
    semaines.length === 0 ? ligneVide('Aucune semaine passée') : h('div', { classe: 'hist-liste' }, semaines.map(semaine)),
    semaines.length === 0 ? null : h('p', { classe: 'petit doux' }, 'Lecture seule : menus et ventes du midi de chaque semaine.'));
}
