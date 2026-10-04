// Mode en poste (#/poste/<composantId>) : refonte 1, maquette « Poste ». Une étape à la fois, en très grand.
// Les étapes sont celles de la règle de préparation (etapesComposant) ; « Fait » est l'action existante, l'ordre des
// étapes est contrôlé par refusOrdreEtape. Ni minuteur ni durée. L'écran maintenu allumé est géré par le routeur
// (ecran-allume.js) : demandé sur cette vue, relâché en la quittant.

import { calculerComposant } from '../domaine/calcul.js';
import { etapesComposant, refusOrdreEtape } from '../domaine/planification.js';
import { libelle } from '../domaine/statuts.js';
import { etat as etatCourant } from '../magasin.js';
import { h, svg } from './dom.js';
import { ecranAllumePossible } from './ecran-allume.js';
import { bouton, pastille } from './elements.js';
import { quantiteNoeuds } from './format.js';
import { defaireEnUnToucher, faireEnUnToucher } from './taches.js';

export function titre() { return 'Mode en poste'; }

// Position courante, gardée entre les redessins du routeur (chaque « Fait » redessine la vue).
let position = { id: null, i: 0 };
let refus = null; // { id, i, texte } : refus de l'ordre des étapes, dit en texte

/** Production d'une étape de la règle (la préparatoire portant cette clé), ou null. */
export function productionDeLEtape(etat, composantId, etapeCle) {
  return Object.values(etat.productions ?? {}).find((p) => p.composantId === composantId && p.etapeCle === etapeCle) ?? null;
}

/** Indice de départ : la première étape pas encore faite, sinon la première. */
export function indiceDeDepart(etapes) {
  const i = etapes.findIndex((x) => x.etat !== 'fait');
  return i < 0 ? 0 : i;
}

const icone = (d) => svg('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'aria-hidden': 'true' },
  svg('path', { d }));

function lienFiche(id, classe, ...contenu) {
  return h('a', { href: `#/fiche/${encodeURIComponent(id)}`, classe }, ...contenu);
}

/** Oublie la position et le refus (en quittant par « Terminer » ; aussi pour les tests). */
export function oublier() { position = { id: null, i: 0 }; refus = null; }

function remplir(racine, etat, id) {
  const c = etat.composants?.[id];
  const etapes = c ? etapesComposant(etat, id) : [];
  if (!c || etapes.length < 2) {
    racine.replaceChildren(
      h('h1', { classe: 'page-titre' }, 'Mode en poste'),
      h('p', { classe: 'vide' }, 'Pas d\'étapes pour ce composant'),
      h('p', null, lienFiche(id ?? '', 'btn', c ? 'Retour à la fiche' : 'Retour à la fiche (composant introuvable)')));
    return;
  }
  if (position.id !== id) position = { id, i: indiceDeDepart(etapes) };
  const n = etapes.length;
  const i = Math.min(Math.max(position.i, 0), n - 1);
  position.i = i;
  const etape = etapes[i];
  const derniere = i === n - 1;
  const calc = calculerComposant(etat, id);
  const p = productionDeLEtape(etat, id, etape.etapeCle);
  const aller = (j) => () => { position.i = j; refus = null; remplir(racine, etatCourant(), id); };
  const faire = () => {
    const courant = etatCourant();
    const prod = productionDeLEtape(courant, id, etape.etapeCle);
    const texte = prod ? refusOrdreEtape(courant, prod, { fait: true }) : null;
    if (texte) { refus = { id, i, texte }; remplir(racine, courant, id); return; }
    refus = null;
    if (!prod) return;
    faireEnUnToucher(prod.id);
    remplir(racine, etatCourant(), id);
  };
  const annuler = () => { refus = null; defaireEnUnToucher(p.id); remplir(racine, etatCourant(), id); };
  const message = refus && refus.id === id && refus.i === i ? refus.texte : null;

  racine.replaceChildren(...[
    h('header', { classe: 'poste-entete' },
      lienFiche(id, 'poste-quitter', icone('M6 6l12 12M18 6L6 18'), h('span', { classe: 'poste-sr' }, 'Quitter le mode en poste')),
      h('div', { classe: 'poste-titre' },
        h('h1', { classe: 'poste-nom' }, c.nom, ' · ',
          calc.statut === 'CALCULE' ? h('span', { classe: 'poste-qte' }, quantiteNoeuds(calc.quantiteTravail, calc.uniteTravail))
            : h('span', { classe: 'poste-qte-inconnue' }, 'quantité inconnue')),
        h('span', { classe: 'poste-allume' }, h('span', { classe: 'poste-point', 'aria-hidden': 'true' }),
          ecranAllumePossible() ? 'Écran maintenu allumé' : "l'écran peut se mettre en veille")),
      h('span', { classe: 'poste-cale', 'aria-hidden': 'true' })),
    h('div', { classe: 'poste-segments', 'aria-hidden': 'true' },
      etapes.map((x, k) => h('span', { classe: `poste-segment${k <= i ? ' poste-segment-plein' : ''}` }))),
    h('div', { classe: 'poste-etape' },
      h('p', { classe: 'poste-numero' }, `Étape ${i + 1} sur ${n}`),
      h('p', { classe: 'poste-texte' }, etape.libelle),
      h('p', { classe: 'poste-etat' }, p?.etat === 'fait' ? pastille('fait', 'vert') : null, ' ', libelle('ETAT_TACHE', etape.etat))),
    p ? h('div', { classe: 'poste-fait' },
      p.etat === 'fait' ? bouton('Annuler le fait', annuler, 'poste-grand') : bouton('Fait', faire, 'principal poste-grand')) : null,
    message ? h('p', { classe: 'poste-refus', role: 'alert' }, message) : null,
    h('div', { classe: 'poste-nav' },
      bouton('Précédente', aller(i - 1), 'poste-grand', i === 0 ? { disabled: true } : {}),
      derniere ? h('a', { href: `#/fiche/${encodeURIComponent(id)}`, classe: 'btn btn-principal btn-poste-grand', onClick: oublier }, 'Terminer')
        : bouton('Suivante', aller(i + 1), 'principal poste-grand')),
  ].filter(Boolean));
}

export function rendre(etat, composantId) {
  const racine = h('div', { classe: 'vue vue-poste' });
  remplir(racine, etat, composantId);
  return racine;
}
