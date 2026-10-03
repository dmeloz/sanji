// Tableau blanc : l'écran d'accueil. Il ressemble au tableau blanc d'une cuisine et commence par la note du
// contexte (« que dois-je savoir maintenant »). La vue ne calcule rien : tout vient de `tableauBlanc`.

import { libelleJour } from '../domaine/dates.js';
import { tableauBlanc } from '../domaine/tableau-blanc.js';
import { aujourdhui } from '../magasin.js';
import { h, svg } from './dom.js';
import { lien } from './elements.js';
import { dialogPrevision } from './vue-detail.js';

export function titre() { return 'Tableau'; }

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const ETAT_SYMBOLE = {
  pret: 'prêt', en_cours: 'en cours', a_faire: 'à faire', a_decider: 'à décider', non_couvert: 'fait, non couvert',
};

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

/** Case dessinée (classe « coche ») : l'état se lit par la forme (vide, à moitié, cochée, point d'exclamation, hachurée). */
function caseSymbole(symbole) {
  const enfants = [svg('rect', { classe: 'coche-bord', x: 2, y: 2, width: 20, height: 20, rx: 3 })];
  if (symbole === 'en_cours') enfants.push(svg('rect', { classe: 'coche-plein', x: 3, y: 12, width: 18, height: 9, rx: 1 }));
  if (symbole === 'pret') enfants.push(svg('path', { classe: 'coche-trait', d: 'M6 12.5l4.2 4.2L18.5 7.5' }));
  if (symbole === 'a_decider') {
    enfants.push(svg('path', { classe: 'coche-trait', d: 'M12 6.5v7' }), svg('circle', { classe: 'coche-point', cx: 12, cy: 17.5, r: 1.4 }));
  }
  if (symbole === 'non_couvert') enfants.push(svg('path', { classe: 'coche-hachure', d: 'M4 12L12 4M4 20L20 4M12 20l8-8' }));
  return h('span', { classe: `coche-boite coche-${symbole}` },
    svg('svg', { classe: 'coche', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, enfants),
    h('span', { classe: 'sr' }, `${ETAT_SYMBOLE[symbole]} : `));
}

// ------------------------------------------------------------------ la note du contexte

function ligneNote(ligne) {
  const contenu = [
    ligne.symbole ? caseSymbole(ligne.symbole) : null,
    h('span', { classe: 'note-texte' }, ligne.texte, ligne.detail ? h('span', { classe: 'note-detail' }, ligne.detail) : null),
    ligne.quantite ? h('span', { classe: 'note-quantite feutre' }, ligne.quantite) : null,
  ];
  return h('li', { classe: `note-ligne note-${ligne.genre}` },
    ligne.lien ? h('a', { href: ligne.lien, classe: 'note-lien' }, contenu) : h('span', { classe: 'note-lien' }, contenu));
}

function noteContexte(contexte) {
  return h('section', { classe: `note note-${contexte.type}`, 'aria-labelledby': 'titre-note' },
    h('p', { classe: 'note-date' }, majuscule(libelleJour(contexte.date))),
    h('h1', { classe: 'feutre note-titre', id: 'titre-note' }, contexte.titre),
    h('ul', { classe: 'note-lignes' }, contexte.lignes.map(ligneNote)),
    contexte.autres > 0 ? h('p', { classe: 'note-autres' }, `et ${pluriel(contexte.autres, 'autre ligne', 'autres lignes')} sur la feuille du jour`) : null,
    contexte.action ? h('p', { classe: 'note-action' }, lien(contexte.action.lien, contexte.action.libelle, 'btn btn-principal')) : null);
}

// ------------------------------------------------------------------ le tableau

function morceaux(menu) {
  const noeuds = [];
  menu.morceaux.forEach((morceau, i) => {
    if (i > 0) noeuds.push(h('span', { classe: 'tb-virgule' }, ', '));
    const classe = morceau.auPoste ? 'tb-poste feutre' : 'tb-hors';
    noeuds.push(morceau.composantId
      ? h('a', { href: `#/composant/${morceau.composantId}`, classe }, morceau.texte)
      : h('span', { classe }, morceau.texte));
  });
  return noeuds;
}

function celluleMenu(jour, numero) {
  const menu = jour.menus.find((m) => m.menu === numero);
  if (!menu) {
    return h('div', { classe: 'tb-cellule tb-menu' },
      numero === 1 ? h('p', { classe: 'tb-discret' }, 'pas de menu du jour') : null);
  }
  if (!menu.saisi) return h('div', { classe: 'tb-cellule tb-menu tb-blanc' });
  // Sur un vrai tableau, le nombre de couverts s'écrit à côté du menu : le toucher ouvre la prévision, à saisir
  // ou à réviser quand on veut (le calcul suit). Sans chiffre, un cercle vide invite à la saisir.
  let couverts = null;
  const ouvrir = () => dialogPrevision(jour.date, numero);
  if (menu.couverts !== null) {
    couverts = h('button', {
      type: 'button', onClick: ouvrir,
      classe: `tb-couverts feutre${menu.provisoires ? ' tb-provisoire' : ''}`,
      'aria-label': `${libelleJour(jour.date)}, menu ${numero} : ${pluriel(menu.couverts, 'portion', 'portions')}${menu.provisoires ? ', dont des groupes provisoires' : ''}, modifier la prévision`,
    }, String(menu.couverts));
  } else if (menu.previsionASaisir) {
    couverts = h('button', {
      type: 'button', onClick: ouvrir, classe: 'tb-couverts tb-couverts-vide feutre',
      'aria-label': `${libelleJour(jour.date)}, menu ${numero} : saisir la prévision`,
    }, '?');
  }
  return h('div', { classe: 'tb-cellule tb-menu' },
    h('span', { classe: 'tb-rang', 'aria-label': `Menu ${numero}` }, String(numero)),
    h('p', { classe: 'tb-intitule' }, morceaux(menu)),
    couverts);
}

function celluleGroupes(jour) {
  if (jour.groupes.length === 0) return h('div', { classe: 'tb-cellule tb-groupes tb-blanc' });
  return h('div', { classe: 'tb-cellule tb-groupes' }, h('ul', { classe: 'tb-liste' }, jour.groupes.map((g) => h('li', null,
    h('a', { href: `#/detail/${jour.date}`, classe: 'tb-groupe' },
      h('span', { classe: 'feutre tb-groupe-couverts' }, `${g.couverts} pers.`),
      h('span', { classe: 'tb-groupe-detail' }, [g.service === 'soir' ? 'le soir' : null, g.horaire || null, g.numero ? `fiche ${g.numero}` : null]
        .filter(Boolean).join(', ')),
      g.aAllergies ? h('span', { classe: 'tb-allergie' }, caseSymbole('a_decider'), 'allergie') : null)))));
}

function resumeMiseEnPlace(compte) {
  const morceauxResume = [];
  if (compte.a_decider > 0) morceauxResume.push(`${compte.a_decider} à décider`);
  if (compte.a_faire > 0) morceauxResume.push(`${compte.a_faire} à faire`);
  if (compte.en_cours > 0) morceauxResume.push(`${compte.en_cours} en cours`);
  if (compte.non_couvert > 0) morceauxResume.push(pluriel(compte.non_couvert, 'non couverte', 'non couvertes'));
  if (compte.pret > 0) morceauxResume.push(pluriel(compte.pret, 'prête', 'prêtes'));
  return morceauxResume.join(', ');
}

function celluleMiseEnPlace(jour) {
  const enfants = [];
  // Un jour replié ne résume sa mise en place que s'il s'y passe quelque chose : une liste de « à faire » n'apprend rien.
  const notable = jour.compte.total > jour.compte.a_faire;
  if (jour.miseEnPlace.length > 0 && (jour.deplie || notable)) {
    if (jour.deplie) {
      enfants.push(h('ul', { classe: 'tb-mep' }, jour.miseEnPlace.map((t) => h('li', { classe: `mep mep-${t.symbole}` },
        h('a', { href: `#/composant/${t.composantId}` },
          caseSymbole(t.symbole),
          h('span', { classe: 'mep-nom' }, t.nom),
          t.quantite ? h('span', { classe: 'mep-quantite' }, t.quantite) : null)))));
    } else {
      enfants.push(h('p', { classe: 'tb-resume' }, lien(`#/jour/${jour.date}`, resumeMiseEnPlace(jour.compte), 'tb-resume-lien')));
    }
  }
  if (jour.nbPoints > 0) {
    enfants.push(h('p', { classe: 'tb-points' },
      lien(`#/detail/${jour.date}`, pluriel(jour.nbPoints, 'point à confirmer', 'points à confirmer'), 'tb-points-lien')));
  }
  return h('div', { classe: `tb-cellule tb-miseenplace${enfants.length === 0 ? ' tb-blanc' : ''}` }, enfants);
}

function jourTableau(jour, i) {
  return h('article', {
    classe: `tb-jour${jour.estAujourdhui ? ' tb-aujourdhui' : ''}${jour.deplie ? ' tb-deplie' : ''}`,
    'aria-label': libelleJour(jour.date),
  },
  h('a', { classe: 'tb-nom feutre', href: `#/detail/${jour.date}`, 'aria-label': `${libelleJour(jour.date)}${jour.estAujourdhui ? ", aujourd'hui" : ''} : ouvrir le détail` },
    jour.estAujourdhui ? h('span', { classe: 'aimant', 'aria-hidden': 'true' }) : null,
    h('span', { classe: 'tb-nom-jour' }, JOURS_COURTS[i]),
    h('span', { classe: 'tb-nom-numero' }, String(Number(jour.date.slice(8))))),
  celluleMenu(jour, 1),
  celluleMenu(jour, 2),
  celluleGroupes(jour),
  celluleMiseEnPlace(jour));
}

function tableau(tb) {
  return h('section', { classe: 'tableau', 'aria-labelledby': 'titre-tableau' },
    h('header', { classe: 'tableau-tete' },
      h('a', { href: `#/tableau/${tb.semainePrecedente}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
      h('h2', { classe: 'feutre tableau-titre', id: 'titre-tableau' }, `Semaine du ${libelleJour(tb.lundi).replace(/^lundi\s+/, '')}`),
      h('a', { href: `#/tableau/${tb.semaineSuivante}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine suivante' }, '›')),
    h('div', { classe: 'tableau-grille' }, tb.jours.map((jour, i) => jourTableau(jour, i))));
}

export function rendre(etat, lundiAffiche) {
  const tb = tableauBlanc(etat, aujourdhui(), lundiAffiche ?? undefined);
  const racine = h('div', { classe: 'vue vue-tableau' });
  racine.appendChild(noteContexte(tb.contexte));
  racine.appendChild(tableau(tb));
  racine.appendChild(h('p', { classe: 'tableau-pied' },
    lien(`#/menus/${tb.lundi}`, 'Menus de la semaine', 'btn'),
    tb.estSemaineCourante ? null : lien('#/tableau', "Revenir à aujourd'hui", 'btn')));
  return racine;
}
