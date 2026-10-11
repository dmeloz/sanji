// Feuille « Retenir les éléments de la semaine » (samedi soir et dimanche) : les éléments au poste de la semaine qui n'ont pas
// encore de fiche retenue, groupés par plat pour le contexte. « Retenir tel quel » retient un élément ; « Retenir les N éléments
// nommés » retient tous ceux dont la catégorie est connue. Une sauce sans nom ou un mot « à préciser » n'est jamais retenu : la
// feuille le liste à part avec « Préciser ». Pas d'inventaire de plats. Aucune logique métier ici.

import { retenirElement, retenirElementsDeLaSemaine } from '../domaine/actions-fiches.js';
import { elementsDeLaSemaine } from '../domaine/cloture.js';
import { libelleJour } from '../domaine/dates.js';
import { CATEGORIES_MOT } from '../domaine/mots-retenus.js';
import { agir } from '../magasin.js';
import { h } from './dom.js';
import { bouton, lien, pastille } from './elements.js';
import { feuilleVivante } from './feuille-services.js';
import { pluriel } from './format.js';
import { afficherMessage } from './messages.js';

const titrePlat = (p) => `${p.intitule || 'Menu'} · ${libelleJour(p.date)} · menu ${p.menu}`;

function ligneElement(e) {
  const retenir = () => {
    const r = agir((etat, t) => retenirElement(etat, e.id, t));
    if (r.ok) afficherMessage(`Élément retenu : ${e.nom}.`, 'ok');
  };
  return h('li', { classe: 'cloture-element' },
    h('span', { classe: 'cloture-element-nom' }, e.nom),
    pastille(e.propose ? `${CATEGORIES_MOT[e.choix].toLowerCase()} proposée` : CATEGORIES_MOT[e.choix].toLowerCase(), e.propose ? 'ambre' : 'gris'),
    bouton('Retenir tel quel', retenir, 'court', { 'aria-label': `Retenir tel quel : ${e.nom}` }));
}

function blocPlat(p) {
  const prets = p.elements.filter((e) => !e.retenu && !e.bloque);
  return prets.length === 0 ? null : h('div', { classe: 'cloture-plat' }, h('h3', { classe: 'fe-sous-titre' }, titrePlat(p)), h('ul', { classe: 'liste-simple' }, prets.map(ligneElement)));
}

function blocAPreciser(plats) {
  const lignes = plats.flatMap((p) => p.elements.filter((e) => !e.retenu && e.bloque).map((e) => h('li', { classe: 'cloture-element' },
    h('span', { classe: 'cloture-element-nom' }, `${e.nom} · ${e.raison}`),
    lien(`#/fiche/${encodeURIComponent(e.id)}`, 'Préciser', 'btn btn-court'))));
  return lignes.length === 0 ? null : h('div', { classe: 'cloture-plat' }, h('h3', { classe: 'fe-sous-titre' }, 'À préciser d\'abord'),
    h('p', { classe: 'aide' }, 'Rien n\'est inventé : une sauce sans nom ou un mot à préciser ne se retient pas tel quel.'), h('ul', { classe: 'liste-simple' }, lignes));
}

export function ouvrirCloture(lundi) {
  return feuilleVivante({
    titre: 'Retenir les éléments de la semaine',
    construire: (etat) => {
      const s = elementsDeLaSemaine(etat, lundi);
      const retenirTous = () => {
        const r = agir((e, t) => retenirElementsDeLaSemaine(e, lundi, t));
        if (r.ok) afficherMessage(`${pluriel(r.valeur.retenus, 'élément retenu', 'éléments retenus')}.`, 'ok');
      };
      return h('div', { classe: 'cloture' },
        h('p', null, `${pluriel(s.retenus, 'élément déjà retenu', 'éléments déjà retenus')} cette semaine.`),
        s.aRetenir === 0 ? h('p', { classe: 'aide' }, 'Tous les éléments nommés de la semaine sont retenus.')
          : h('div', { classe: 'actions' }, bouton(`Retenir les ${pluriel(s.aRetenir, 'élément nommé', 'éléments nommés')}`, retenirTous, 'principal')),
        s.plats.map(blocPlat), blocAPreciser(s.plats),
        h('p', null, lien('#/fiches', 'Toutes les fiches')));
    },
  });
}
