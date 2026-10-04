// Production (onglet 2) : la mise en place du jour, selon la maquette « Production » de la refonte 1.
// `param` = la date (AAAA-MM-JJ) ; le routeur donne aujourd'hui par défaut. Aucune règle métier ici : les lignes viennent
// de la feuille Jour (`feuilleDuJour`), les gestes de `taches.js`, le corps de la page de `vue-jour.js`.

import { ajouterJours, libelleJour, lundiDe } from '../domaine/dates.js';
import { decisionsDe } from '../domaine/decisions.js';
import { feuilleDuJour } from '../domaine/planification.js';
import { ouvrirDecisions } from './feuille-decisions.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { problemeHorsLigne } from './horsligne.js';
import { lien } from './elements.js';
import { activerGlisser } from './glisser.js';
import { pluriel } from './format.js';
import { corps } from './vue-jour.js';

export function titre() { return 'Production'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
/** « Lun 5 » pour la barre de jours. */
const puceJour = (date) => `${majuscule(libelleJour(date).slice(0, 3))} ${Number(date.slice(8))}`;

/** Sélecteur Aujourd'hui / Demain : deux liens, l'un porte `aria-current` (jamais la couleur seule). */
function selecteur(date, aujourd) {
  const demain = ajouterJours(aujourd, 1);
  const segment = (cible, texte) => h('a', {
    href: `#/production/${cible}`, classe: `prod-segment${cible === date ? ' prod-segment-actif' : ''}`,
    'aria-current': cible === date ? 'date' : null,
  }, texte);
  return h('div', { classe: 'prod-selecteur', role: 'group', 'aria-label': 'Jour' },
    segment(aujourd, 'Aujourd\'hui'), segment(demain, 'Demain'));
}

/** Barre de jours de la semaine (existante) pour aller plus loin qu'Aujourd'hui et Demain. */
function barreDeJours(date, aujourd) {
  const lundi = lundiDe(date);
  const dates = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  if (!dates.includes(date)) dates.push(date);
  const puce = (d) => h('a', {
    href: `#/production/${d}`, classe: `jour-puce${d === date ? ' jour-puce-actif' : ''}${d === aujourd ? ' jour-puce-aujourdhui' : ''}`,
    'aria-label': `${libelleJour(d)}${d === aujourd ? ", aujourd'hui" : ''}${d === date ? ', jour affiché' : ''}`,
    'aria-current': d === date ? 'date' : null,
  }, puceJour(d));
  const puces = dates.map(puce);
  // Sur un petit écran la barre défile : le jour affiché doit être visible, pas caché à droite (le samedi).
  setTimeout(() => puces[dates.indexOf(date)]?.scrollIntoView?.({ inline: 'center', block: 'nearest' }), 0);
  return h('nav', { classe: 'jour-barre', 'aria-label': 'Jours de la semaine' },
    h('a', { href: `#/production/${ajouterJours(lundi, -7)}`, classe: 'jour-puce jour-puce-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
    puces,
    h('a', { href: `#/production/${ajouterJours(lundi, 7)}`, classe: 'jour-puce jour-puce-fleche', 'aria-label': 'Semaine suivante' }, '›'));
}

/** « Mardi 6 octobre · 2 / 5 faites » et l'état hors ligne, puis le titre et les couverts connus. */
function entete(date, aujourd, feuille) {
  const { couverts, menus } = feuille.lecture;
  const { faites, total } = feuille.avancement;
  const unMenuSaisi = menus.some((m) => m.intitule !== '');
  let texteCouverts = null;
  if (couverts.total !== null) texteCouverts = pluriel(couverts.total, 'couvert', 'couverts');
  else if (unMenuSaisi) texteCouverts = 'couverts : prévision à saisir';
  const dateEtAvancement = `${majuscule(libelleJour(date))}${date === aujourd ? ' (aujourd\'hui)' : ''}${total > 0 ? ` · ${faites} / ${total} faites` : ''}`;
  return h('header', { classe: 'jour-tete prod-tete' },
    h('div', { classe: 'prod-tete-ligne' },
      h('p', { classe: 'prod-date' }, dateEtAvancement),
      problemeHorsLigne() ? h('span', { classe: 'prod-horsligne' }, h('span', { classe: 'prod-horsligne-point', 'aria-hidden': 'true' }), problemeHorsLigne()) : null),
    h('h1', { classe: 'page-titre' }, 'Production'),
    h('p', { classe: 'jour-meta' },
      texteCouverts ? h('span', { classe: 'jour-couverts feutre' }, texteCouverts) : null,
      lien(`#/semaine/${date}`, 'Prévisions →', 'jour-lien')));
}

/** Second point d'entrée vers la feuille « À décider » : même source que le bandeau d'Aujourd'hui (`decisionsDe`), rien s'il n'y a rien à décider. */
function accesDecisions(etat, aujourd) {
  const { total } = decisionsDe(etat, aujourd);
  if (total === 0) return null;
  return h('button', { type: 'button', classe: 'au-decisions prod-decisions', onClick: () => ouvrirDecisions() },
    h('span', { classe: 'au-decisions-texte' },
      h('span', { classe: 'au-decisions-titre' }, total === 1 ? '1 décision en attente' : `${total} décisions en attente`),
      h('span', { classe: 'au-decisions-detail' }, 'Ouvrir « À décider »')));
}

export function rendre(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-jour vue-production' });
  const feuille = feuilleDuJour(etat, date);
  racine.appendChild(entete(date, aujourd, feuille));
  const acces = accesDecisions(etat, aujourd);
  if (acces) racine.appendChild(acces);
  racine.appendChild(selecteur(date, aujourd));
  racine.appendChild(barreDeJours(date, aujourd));
  for (const n of corps(etat, date, feuille)) racine.appendChild(n);
  activerGlisser(racine, {
    suivant: () => { location.hash = `#/production/${ajouterJours(date, 1)}`; },
    precedent: () => { location.hash = `#/production/${ajouterJours(date, -1)}`; },
  });
  return racine;
}
