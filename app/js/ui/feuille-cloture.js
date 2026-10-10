// Feuille « Retenir les plats de la semaine » (samedi soir et dimanche) : les plats de la semaine pas encore retenus, avec ce qui
// reste à confirmer. « Retenir tel quel » confirme les éléments déjà nommés et retient le plat ; une sauce sans nom n'est jamais
// inventée (le plat reste à confirmer, et la feuille le dit). Pas de bouton « tout retenir ». Aucune logique métier ici.

import { retenirTelQuel } from '../domaine/actions-fiches.js';
import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { platsDeLaSemaine } from '../domaine/plats-retenus.js';
import { agir, etat as etatCourant } from '../magasin.js';
import { h } from './dom.js';
import { afficherMessage } from './messages.js';
import { pluriel } from './format.js';
import { panneau } from './panneau.js';

function lignePlat(p) {
  const zone = h('div', { classe: 'cloture-geste' });
  const retenir = () => {
    const r = agir((e, t) => retenirTelQuel(e, p.date, p.menu, t));
    if (!r.ok) return;
    zone.replaceChildren(h('span', { classe: 'discret' }, 'Retenu'));
    afficherMessage(`Plat retenu : ${p.intitule}.`, 'ok');
  };
  if (p.bloque) {
    zone.appendChild(h('p', { classe: 'aide' }, 'Pas retenu : ce plat garde un élément sans nom (sauce à nommer ou mot à préciser). Rien n\'est inventé : précisez-le sur la fiche.'));
  } else {
    zone.appendChild(h('button', { type: 'button', classe: 'btn btn-court', onClick: retenir, 'aria-label': `Retenir tel quel : ${p.intitule}` }, 'Retenir tel quel'));
  }
  return h('li', { classe: 'cloture-plat' },
    h('strong', null, p.intitule), h('span', { classe: 'meta' }, ` · ${libelleJour(p.date)} · menu ${p.menu}`),
    p.reste.length > 0 ? h('ul', { classe: 'liste-simple' }, p.reste.map((r) => h('li', null, r))) : h('p', { classe: 'aide' }, 'Rien à confirmer.'),
    zone);
}

export function ouvrirCloture(lundi) {
  const plats = platsDeLaSemaine(etatCourant(), [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)));
  const aRetenir = plats.filter((p) => !p.retenu);
  const retenus = plats.length - aRetenir.length;
  panneau({
    titre: 'Retenir les plats de la semaine',
    lectureSeule: true,
    corps: [
      h('p', null, `${pluriel(retenus, 'plat déjà retenu', 'plats déjà retenus')} cette semaine.`),
      aRetenir.length === 0 ? h('p', { classe: 'aide' }, 'Tous les plats de la semaine sont retenus.') : h('ul', { classe: 'liste-simple' }, aRetenir.map(lignePlat)),
    ],
  });
}
