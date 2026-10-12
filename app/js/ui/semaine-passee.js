// Garde-fou sur le temps, côté écran : une semaine passée se lit, elle ne se modifie plus (voir `semainePassee`, domaine/dates.js).
import { semainePassee } from '../domaine/dates.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';

/** Vrai si la date appartient à une semaine passée (calculé depuis l'horloge du jour). */
export const estSemainePassee = (date) => semainePassee(date, aujourdhui());

/** La phrase qui remplace les boutons d'écriture ; l'état est dit en toutes lettres, jamais par la couleur seule. */
export const noteSemainePassee = () => h('p', { classe: 'aide semaine-passee', role: 'note' },
  'Semaine passée : lecture seule. Les ventes, les « fait » et les corrections de portion restent possibles.');
