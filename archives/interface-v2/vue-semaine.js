// Semaine (tableau blanc) : vue d'anticipation, sans liste de tâches.

import { ajouterJours, aMenuDuJour, creneauxDuJour, datesDeLaSemaine, estOuvert, jourSemaine, libelleJour, lundiDe }
  from '../domaine/dates.js';
import { portionsMenu } from '../domaine/calcul.js';
import { pointsAConfirmer, pointsGlobaux } from '../domaine/points.js';
import { etatCreneau } from '../domaine/planification.js';
import { jourOuVide } from '../domaine/etat.js';
import { libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { encadre, lien, navigationPeriode, pastille, titreSection } from './elements.js';
import { ouvrirFiche } from './fiches.js';
import { pluriel } from './format.js';
import { pastilleCreneau } from './taches.js';
import { LIBELLE_MODE } from './reference.js';

export const titre = () => 'Semaine';

const VARIANTE_CERTITUDE = { estimee: 'gris', provisoire: 'ambre', confirmee: 'vert' };

function blocMenus(etat, date) {
  const jour = jourOuVide(etat, date);
  return h('div', { classe: 'bloc' },
    [1, 2].map((menu) => {
      const m = jour.menus[menu];
      const saisi = m.intitule.trim() !== '';
      return h('p', { classe: 'menu-ligne' },
        h('strong', null, `Menu ${menu} : `),
        saisi ? h('span', { classe: 'intitule' }, m.intitule) : h('span', { classe: 'discret' }, 'menu non saisi'),
        saisi && !m.transcriptionValidee ? [' ', pastille('transcription à valider', 'ambre')] : null);
    }));
}

function blocPrevisions(etat, date) {
  return h('div', { classe: 'bloc' }, h('h3', { classe: 'bloc-titre' }, 'Prévisions'),
    [1, 2].map((menu) => {
      const p = portionsMenu(etat, date, menu);
      return h('div', { classe: 'prevision' },
        h('p', null, h('strong', null, `Menu ${menu} : `),
          p.details.length === 0 ? 'aucune prévision saisie' : `total ${pluriel(p.total, 'portion')}`),
        h('ul', { classe: 'liste-simple petit' },
          p.details.map((d) => h('li', null,
            `${d.source === 'prevision' ? 'hors groupes' : `groupe ${d.numero || ''}`.trim()} : ${d.portions} `,
            pastille(libelle('CERTITUDE', d.certitude), VARIANTE_CERTITUDE[d.certitude] ?? 'gris')))),
        p.previsionManquante && p.details.length > 0 ? h('p', { classe: 'petit alerte-texte' }, 'prévision hors groupes non saisie') : null);
    }));
}

function chipFiche(f) {
  return h('button', { type: 'button', classe: 'chip', onClick: () => ouvrirFiche(f.id) },
    h('span', null, `${f.numero || 'fiche'} · ${f.couverts} pers.${f.horaire ? ` · ${f.horaire}` : ''}`),
    pastille(f.mode === 'menu_fixe' ? `menu ${f.menuFixe} fixé`
      : f.mode === 'choix_libre' ? `choix libre, ${f.statutRepartition === 'confirmee' ? 'confirmé' : 'provisoire'}`
        : LIBELLE_MODE.hors_menu, f.mode === 'choix_libre' && f.statutRepartition !== 'confirmee' ? 'ambre' : 'gris'),
    f.allergies.trim() ? pastille('allergies', 'rouge') : null);
}

function blocFiches(etat, date) {
  const fiches = Object.values(etat.fiches).filter((f) => f.date === date && f.statut === 'active')
    .sort((a, b) => a.horaire.localeCompare(b.horaire) || a.numero.localeCompare(b.numero));
  const midi = fiches.filter((f) => f.service === 'midi');
  const soir = fiches.filter((f) => f.service === 'soir');
  const aSoir = creneauxDuJour(date).includes('avant_soir');
  const sections = [];
  if (midi.length > 0) sections.push(h('div', { classe: 'bloc' }, h('h3', { classe: 'bloc-titre' }, 'Fiches du service de midi'), h('div', { classe: 'chips' }, midi.map(chipFiche))));
  if (aSoir || soir.length > 0) {
    const etatSoir = aSoir ? etatCreneau(etat, date, 'avant_soir') : null;
    sections.push(h('div', { classe: 'bloc' },
      h('h3', { classe: 'bloc-titre' }, 'Service du soir', etatSoir && etatSoir !== 'libre' ? [' ', pastilleCreneau(etatSoir)] : null),
      soir.length > 0 ? h('div', { classe: 'chips' }, soir.map(chipFiche)) : h('p', { classe: 'vide' }, 'aucune fiche du soir')));
  }
  if (midi.length === 0 && soir.length === 0 && !aSoir) sections.push(h('p', { classe: 'vide' }, 'aucune fiche de fonction'));
  else if (midi.length === 0 && aMenuDuJour(date)) sections.push(h('p', { classe: 'vide' }, 'aucune fiche de fonction à midi'));
  return sections;
}

function carteJour(etat, date, aujourd) {
  const ouvert = estOuvert(date);
  const contenu = [];
  if (!ouvert) {
    contenu.push(h('p', { classe: 'ferme' }, 'fermé'));
  } else {
    if (aMenuDuJour(date)) contenu.push(blocMenus(etat, date), blocPrevisions(etat, date));
    else contenu.push(h('p', { classe: 'vide' }, 'Pas de menu du jour ce jour-là.'));
    contenu.push(...blocFiches(etat, date));
    const n = pointsAConfirmer(etat, date).length;
    contenu.push(h('p', { classe: 'points' }, n > 0 ? pastille(`${pluriel(n, 'point')} à confirmer`, 'ambre') : h('span', { classe: 'discret' }, 'rien à confirmer')));
  }
  return h('section', { classe: `carte jour${date === aujourd ? ' est-aujourdhui' : ''}${ouvert ? '' : ' jour-ferme'}`, id: `jour-${date}` },
    h('h3', { classe: 'jour-entete' },
      ouvert ? lien(`#/detail/${date}`, libelleJour(date), 'jour-titre') : h('span', { classe: 'jour-titre' }, libelleJour(date)),
      date === aujourd ? pastille("aujourd'hui", 'vert') : null),
    ...contenu,
    ouvert ? h('p', { classe: 'liens-jour' }, lien(`#/detail/${date}`, 'Détail du jour'), ' · ', lien(`#/jour/${date}`, 'Feuille du jour')) : null);
}

function semaine(etat, lundi, aujourd) {
  return h('div', { classe: 'grille-jours' }, datesDeLaSemaine(lundi).map((d) => carteJour(etat, d, aujourd)));
}

export function rendre(etat, lundi) {
  const aujourd = aujourdhui();
  const courante = lundiDe(aujourd);
  const racine = h('div', { classe: 'vue vue-semaine' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, `Semaine du ${libelleJour(lundi)}`));
  racine.appendChild(navigationPeriode(
    { href: `#/semaine/${ajouterJours(lundi, -7)}`, texte: '‹ Semaine précédente' },
    { href: `#/semaine/${courante}`, texte: "Aujourd'hui" },
    { href: `#/semaine/${ajouterJours(lundi, 7)}`, texte: 'Semaine suivante ›' }));
  for (const p of pointsGlobaux(etat)) {
    racine.appendChild(encadre('alerte', p.texte, ' : ', lien('#/reglages', 'ouvrir les réglages')));
  }
  racine.appendChild(semaine(etat, lundi, aujourd));
  if (lundi === courante && [5, 6].includes(jourSemaine(aujourd))) {
    const suivante = ajouterJours(lundi, 7);
    racine.appendChild(titreSection(`Semaine suivante : du ${libelleJour(suivante)}`));
    racine.appendChild(h('p', { classe: 'aide' }, 'Menus communiqués le vendredi : de quoi avancer le début de la semaine.'));
    racine.appendChild(semaine(etat, suivante, aujourd));
  }
  return racine;
}
