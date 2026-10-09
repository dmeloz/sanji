// Tableau : un tableau de bord, pas une note générale. Quatre zones sous un en-tête compact : Menus de la semaine,
// Fiches de fonction, À confirmer (3 lignes au plus), Production et commandes. La vue ne calcule rien : tout vient
// de `tableauBlanc(...).bord`. Chaque ligne est un lien (ou le cercle de prévision) ; aucun bouton « valider ».

import { libelleJour, lundiDe } from '../domaine/dates.js';
import { tableauBlanc } from '../domaine/tableau-blanc.js';
import { aujourdhui } from '../magasin.js';
import { h, svg } from './dom.js';
import { lien } from './elements.js';
import { ouvrirProposition } from './feuille-validation.js';
import { ouvrirCouvertsMidi } from './feuille-couverts.js';
import { problemeHorsLigne } from './horsligne.js';

export function titre() { return 'Tableau'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

/** Case dessinée (classe « coche ») : l'état se lit par la forme, jamais par la couleur seule. */
function caseSymbole(symbole) {
  const mots = { a_decider: 'à décider', a_faire: 'à faire' };
  const enfants = [svg('rect', { classe: 'coche-bord', x: 2, y: 2, width: 20, height: 20, rx: 3 })];
  if (symbole === 'a_decider') {
    enfants.push(svg('path', { classe: 'coche-trait', d: 'M12 6.5v7' }), svg('circle', { classe: 'coche-point', cx: 12, cy: 17.5, r: 1.4 }));
  }
  return h('span', { classe: `coche-boite coche-${symbole}` },
    svg('svg', { classe: 'coche', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, enfants),
    h('span', { classe: 'sr' }, `${mots[symbole]} : `));
}

/** « Lun 5 », « Mar 6 » : abréviation du jour et numéro. */
const etiquetteJour = (date) => `${majuscule(libelleJour(date).slice(0, 3))} ${Number(date.slice(8))}`;

// ------------------------------------------------------------------ zone 1 : menus de la semaine

function morceaux(menu) {
  const noeuds = [];
  menu.morceaux.forEach((morceau, i) => {
    if (i > 0) noeuds.push(h('span', { classe: 'tb-virgule' }, ', '));
    const classe = morceau.implicite ? 'tb-implicite' : morceau.auPoste ? 'tb-poste feutre' : 'tb-hors';
    noeuds.push(morceau.composantId
      ? h('a', { href: `#/fiche/${morceau.composantId}`, classe: `${classe} bord-plat` }, morceau.texte)
      : h('span', { classe }, morceau.texte));
  });
  return noeuds;
}

/** Les couverts se règlent dans Aujourd'hui : ici le chiffre est en lecture seule ; « ? » renvoie à l'import de la semaine. */
function couvertsDuMenu(jour, menu) {
  // Le nombre est du texte (plus de rond) ; il ouvre la feuille « Couverts midi » du jour (la même que sur Aujourd'hui).
  const ouvrir = () => ouvrirCouvertsMidi(jour.date);
  if (menu.couverts !== null) {
    return h('button', {
      type: 'button', onClick: ouvrir, classe: `tb-couverts feutre${menu.provisoires ? ' tb-provisoire' : ''}`,
      'aria-label': `${libelleJour(jour.date)}, menu ${menu.menu} : ${pluriel(menu.couverts, 'portion', 'portions')}${menu.provisoires ? ', dont des groupes provisoires' : ''}, modifier les couverts`,
    }, String(menu.couverts));
  }
  if (menu.previsionASaisir) {
    return h('button', {
      type: 'button', onClick: ouvrir, classe: 'tb-couverts tb-couverts-vide feutre',
      'aria-label': `${libelleJour(jour.date)}, menu ${menu.menu} : prévision à saisir, saisir les couverts`,
    }, 'à saisir');
  }
  return null;
}

function ligneMenu(jour, menu) {
  return h('div', { classe: 'bord-menu' },
    h('span', { classe: 'tb-rang' }, h('span', { 'aria-hidden': 'true' }, `M${menu.menu}`), h('span', { classe: 'sr' }, `Menu ${menu.menu}`)),
    h('p', { classe: 'tb-intitule' }, morceaux(menu)),
    couvertsDuMenu(jour, menu));
}

/** Un jour : la ligne entière mène au détail du jour (l'en-tête est étiré sur la ligne), un plat à sa fiche. */
function jourDuBord(jour) {
  const saisis = jour.menus.filter((m) => m.saisi);
  const couverts = jour.couvertsTotal !== null ? ` · ${pluriel(jour.couvertsTotal, 'couvert', 'couverts')}` : '';
  return h('li', { classe: `bord-jour${jour.estAujourdhui ? ' bord-aujourdhui' : ''}` },
    h('a', { href: `#/semaine/${jour.date}`, classe: 'bord-jour-lien feutre',
      'aria-label': `${libelleJour(jour.date)}${jour.estAujourdhui ? ", aujourd'hui" : ''} : ouvrir le détail du jour` },
    `${etiquetteJour(jour.date)}${couverts} `,
    jour.estAujourdhui ? h('span', { classe: 'bord-badge' }, h('span', { 'aria-hidden': 'true' }, '● '), "aujourd'hui") : null),
    saisis.length === 0 ? h('p', { classe: 'tb-discret' }, 'Menus non saisis') : saisis.map((m) => ligneMenu(jour, m)));
}

function zoneMenus(bord, lundi) {
  const { visibles, reste, aucunMenu } = bord.menus;
  const contenu = [];
  if (aucunMenu) {
    contenu.push(h('p', { classe: 'vide' }, 'Aucun menu saisi cette semaine.'));
  } else {
    contenu.push(h('ul', { classe: 'bord-jours liste' }, visibles.map(jourDuBord)));
    if (reste.length > 0) {
      contenu.push(h('details', { classe: 'repliable bord-reste' },
        h('summary', null, 'Afficher le reste de la semaine'),
        h('ul', { classe: 'bord-jours liste' }, reste.map(jourDuBord))));
    }
  }
  contenu.push(h('p', { classe: 'bord-actions' },
    lien(`#/import/${lundi}`, aucunMenu ? 'Saisir les menus de la semaine' : 'Menus de la semaine', 'btn btn-court')));
  return zone('menus', 'Menus de la semaine', contenu);
}

// ------------------------------------------------------------------ zone 2 : fiches de fonction

function ficheDuBord(fiche, aujourd) {
  const entete = [fiche.date !== aujourd ? etiquetteJour(fiche.date) : null, fiche.horaire || null,
    fiche.numero ? `fiche ${fiche.numero}` : null, pluriel(Number(fiche.couverts) || 0, 'couvert', 'couverts')].filter(Boolean).join(' · ');
  return h('li', { classe: 'bord-fiche-ligne' },
    h('a', { href: fiche.lien, classe: 'bord-fiche', 'aria-label': `Fiche de fonction, ${libelleJour(fiche.date)} : ouvrir le détail du jour` },
      h('span', { classe: 'bord-fiche-tete feutre' }, entete),
      h('span', { classe: 'bord-fiche-suite' }, fiche.modeTexte,
        fiche.aAllergies ? [' · ', h('span', { classe: 'tb-allergie' }, caseSymbole('a_decider'), 'allergies')] : null)));
}

function zoneFiches(bord, aujourd) {
  return zone('fiches', 'Fiches de fonction', bord.fiches.length === 0
    ? h('p', { classe: 'vide' }, 'Aucun banquet prévu')
    : h('ul', { classe: 'bord-lignes' }, bord.fiches.map((f) => ficheDuBord(f, aujourd))));
}

// ------------------------------------------------------------------ zone 3 : à confirmer

/** Une ligne : un lien, sauf une proposition d'apprentissage qui ouvre sa feuille (aucune navigation). */
function ligneAConfirmer(l) {
  const contenu = [caseSymbole('a_decider'),
    h('span', { classe: 'bord-ligne-texte' }, l.texte, l.detail ? h('span', { classe: 'note-detail' }, l.detail) : null)];
  if (l.proposition) {
    return h('li', null, h('button', { type: 'button', classe: 'bord-ligne bord-ligne-bouton', onClick: () => ouvrirProposition(l.proposition) }, contenu));
  }
  return h('li', null, h('a', { href: l.lien, classe: 'bord-ligne' }, contenu));
}

function zoneAConfirmer(bord) {
  const { total, lignes, reste } = bord.aConfirmer;
  const resume = total === 0 ? 'Rien à confirmer'
    : total === 1 ? '1 sujet attend le chef' : `${total} sujets attendent le chef`;
  return zone('confirmer', 'À confirmer', [
    h('p', { classe: total === 0 ? 'vide' : 'bord-resume' }, resume),
    lignes.length === 0 ? null : h('ul', { classe: 'bord-lignes' }, lignes.map(ligneAConfirmer)),
    reste > 0 ? h('p', { classe: 'meta' }, `et ${pluriel(reste, 'autre sujet', 'autres sujets')}, à voir sur le détail des jours`) : null,
  ]);
}

// ------------------------------------------------------------------ zone 4 : production et commandes

function zoneProduction(bord) {
  const p = bord.production;
  const { faites, total } = p.avancement;
  const lignes = [];
  if (p.autreSemaine) {
    lignes.push(h('li', null, h('p', { classe: 'meta' }, `Semaine du ${libelleJour(p.lundi).replace(/^lundi\s+/, '')}`)));
  }
  lignes.push(h('li', null, h('a', { href: p.lien, classe: 'bord-ligne bord-jauge' },
    total > 0 ? h('progress', { classe: 'avancement-barre', value: faites, max: total, 'aria-hidden': 'true' }) : null,
    h('span', { classe: 'bord-ligne-texte feutre' }, p.autreSemaine
      ? (total > 0 ? `${faites}/${total} fait cette semaine` : 'Aucune tâche décidée cette semaine')
      : (total > 0 ? `Aujourd'hui ${faites}/${total} fait` : "Aujourd'hui : aucune tâche décidée")))));
  if (p.avances > 0) {
    lignes.push(h('li', null, h('a', { href: p.lien, classe: 'bord-ligne' },
      h('span', { classe: 'bord-ligne-texte' }, `${pluriel(p.avances, 'avance possible', 'avances possibles')} après le service`))));
  }
  if (p.commande) {
    lignes.push(h('li', null, h('a', { href: p.commande.lien, classe: 'bord-ligne' }, h('span', { classe: 'bord-ligne-texte' }, p.commande.texte))));
  }
  // Pas encore chiffré : information neutre, jamais une alerte ni une décision.
  for (const l of p.chiffrage) {
    lignes.push(h('li', null, h('a', { href: l.lien, classe: 'bord-ligne bord-neutre' },
      h('span', { classe: 'bord-ligne-texte' }, l.texte, l.detail ? h('span', { classe: 'note-detail' }, l.detail) : null))));
  }
  return zone('production', 'Production et commandes', h('ul', { classe: 'bord-lignes' }, lignes));
}

// ------------------------------------------------------------------ assemblage

function zone(id, titreTexte, contenu) {
  return h('section', { classe: `bord-zone bord-${id}`, 'aria-labelledby': `bord-titre-${id}` },
    h('h2', { classe: 'bord-zone-titre', id: `bord-titre-${id}` }, titreTexte), contenu);
}

function entete(tb, actions = null) {
  const e = tb.bord.entete;
  return h('header', { classe: 'bord-tete' },
    h('div', { classe: 'bord-semaine-nav' },
      h('a', { href: `#/semaine/${tb.semainePrecedente}/tableau`, classe: 'btn btn-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
      h('div', { classe: 'bord-semaine' },
        h('h1', { classe: 'bord-titre feutre' }, `Semaine du ${libelleJour(tb.lundi).replace(/^lundi\s+/, '')}`),
        h('p', { classe: 'bord-sous-titre' }, `Semaine ${e.semaine}${problemeHorsLigne() ? ` · ${problemeHorsLigne()}` : ''}`)),
      h('a', { href: `#/semaine/${tb.semaineSuivante}/tableau`, classe: 'btn btn-fleche', 'aria-label': 'Semaine suivante' }, '›')),
    h('div', { classe: 'bord-aujourdhui-ligne' },
      h('p', { classe: 'bord-date' }, `Aujourd'hui, ${libelleJour(e.date)}`),
      h('div', { classe: 'sa-groupe' }, lien(e.lienJour, 'Production du jour ›', 'sa-lien-production'), actions)),
    e.sauvegarde ? h('p', { classe: 'bord-rappel' }, h('a', { href: e.sauvegarde.lien, classe: 'bord-ligne bord-neutre' },
      h('span', { classe: 'bord-ligne-texte' }, e.sauvegarde.texte, h('span', { classe: 'note-detail' }, e.sauvegarde.detail)))) : null);
}

/** `options.actions` : un nœud (le bouton « ⋯ » de Semaine) posé sur la ligne « Aujourd'hui, … », pour ne pas prendre une rangée de plus. */
export function rendre(etat, lundiAffiche, options = {}) {
  const aujourd = aujourdhui();
  const tb = tableauBlanc(etat, aujourd, lundiAffiche ?? undefined);
  const racine = h('div', { classe: 'vue vue-tableau vue-bord' });
  racine.appendChild(entete(tb, options.actions ?? null));
  racine.appendChild(zoneMenus(tb.bord, tb.lundi));
  racine.appendChild(zoneFiches(tb.bord, aujourd));
  racine.appendChild(zoneAConfirmer(tb.bord));
  racine.appendChild(zoneProduction(tb.bord));
  if (!tb.estSemaineCourante) {
    racine.appendChild(h('p', { classe: 'tableau-pied' }, lien('#/aujourdhui', "Revenir à aujourd'hui", 'btn')));
  }
  return racine;
}
