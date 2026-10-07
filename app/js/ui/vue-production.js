// Production (onglet 2) : la mise en place du jour, selon la maquette « Production » de la refonte 1.
// `param` = la date (AAAA-MM-JJ) ; le routeur donne aujourd'hui par défaut. Aucune règle métier ici : les lignes viennent
// de la feuille Jour (`feuilleDuJour`), les gestes de `taches.js`, le corps de la page de `vue-jour.js`.

import { ajouterJours, libelleJour, lundiDe } from '../domaine/dates.js';
import { decisionsDe } from '../domaine/decisions.js';
import { feuilleDuJour } from '../domaine/planification.js';
import { boutonProposerPlanning } from './assistant-planning.js';
import { ouvrirDecisions } from './feuille-decisions.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { problemeHorsLigne } from './horsligne.js';
import { lien } from './elements.js';
import { activerGlisser } from './glisser.js';
import { corps } from './vue-jour.js';

export function titre() { return 'Production'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
/** « Lun 5 » pour la barre de jours. */
const puceJour = (date) => `${majuscule(libelleJour(date).slice(0, 3))} ${Number(date.slice(8))}`;

/** Onglets texte Aujourd'hui / Demain : deux liens, l'un porte `aria-current` (jamais la couleur seule : graisse et filet). */
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

/**
 * « x / n faites » : les tâches décidées pour ce jour ; sans aucune tâche décidée mais avec des tâches à la liste (rien n'est
 * encore planifié), les lignes de travail du jour, pour que le compte soit dit dès qu'il y a des tâches.
 */
function avancement(feuille) {
  if (feuille.avancement.total > 0) return feuille.avancement;
  const { service1, service2, autres, apres } = feuille.lecture;
  const lignes = [...service1, ...service2, ...autres, ...apres].filter((l) => l.source !== 'suggestion');
  return { faites: lignes.filter((l) => l.fait).length, total: lignes.length };
}

/** Jour en surtitre, « Production », « faites/total » en chiffres de quantité et fine jauge ; l'état hors ligne si besoin. */
function entete(date, aujourd, feuille) {
  const { faites, total } = avancement(feuille);
  const pct = total > 0 ? Math.round((faites / total) * 100) : 0;
  return h('header', { classe: 'jour-tete prod-tete' },
    h('div', { classe: 'prod-tete-ligne' },
      h('p', { classe: 'prod-date' }, `${majuscule(libelleJour(date))}${date === aujourd ? ' (aujourd\'hui)' : ''}`),
      problemeHorsLigne() ? h('span', { classe: 'prod-horsligne' }, h('span', { classe: 'prod-horsligne-point', 'aria-hidden': 'true' }), problemeHorsLigne()) : null),
    h('div', { classe: 'prod-titre-ligne' },
      h('h1', { classe: 'page-titre' }, 'Production'),
      total > 0 ? h('span', { classe: 'prod-compte', 'aria-label': `${faites} faites sur ${total}` }, `${faites}/${total}`) : null),
    total > 0 ? h('div', { classe: 'prod-jauge', role: 'progressbar', 'aria-label': 'Avancement du jour', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(faites) },
      h('span', { style: `width: ${pct}%` })) : null);
}

/** Seul point d'entrée vers les décisions sur Production : l'étiquette « N à décider » (même source que le bandeau d'Aujourd'hui), rien s'il n'y a rien à décider. */
function accesDecisions(etat, aujourd) {
  const { total } = decisionsDe(etat, aujourd);
  if (total === 0) return null;
  return h('button', { type: 'button', classe: 'prod-adecider', onClick: () => ouvrirDecisions() },
    h('span', { 'aria-hidden': 'true' }, '⚠'), ` ${total} à décider`);
}

/** Pied de page : prévisions du jour, assistant (facultatif). */
function pied(date) {
  return h('div', { classe: 'prod-pied pas-imprime' },
    lien(`#/semaine/${date}`, 'Prévisions →', 'jour-lien'),
    boutonProposerPlanning(date));
}

export function rendre(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-jour vue-production' });
  const feuille = feuilleDuJour(etat, date);
  racine.appendChild(entete(date, aujourd, feuille));
  const acces = accesDecisions(etat, aujourd);
  if (acces) racine.appendChild(acces);
  racine.appendChild(selecteur(date, aujourd));
  // Les autres jours : la barre de la semaine n'apparaît que hors Aujourd'hui et Demain (sinon Semaine et le glissement suffisent).
  if (date !== aujourd && date !== ajouterJours(aujourd, 1)) racine.appendChild(barreDeJours(date, aujourd));
  for (const n of corps(etat, date, feuille)) racine.appendChild(n);
  racine.appendChild(pied(date));
  activerGlisser(racine, {
    suivant: () => { location.hash = `#/production/${ajouterJours(date, 1)}`; },
    precedent: () => { location.hash = `#/production/${ajouterJours(date, -1)}`; },
  });
  return racine;
}
