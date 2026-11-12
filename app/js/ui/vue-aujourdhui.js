// Aujourd'hui (onglet 1, accueil), refonte du 2026-11-11 (étape 4) : l'écran de la journée, Production comprise.
// Ordre d'importance voulu par la propriétaire : les plats et les productions en évidence, la date et les repères en petit.
// De haut en bas : en-tête discret (date, heure, Réglages), les deux menus du jour en grand avec les couverts du midi,
// « À confirmer » (une ligne et « Tout voir »), fin de semaine, « À produire » (la liste de mise en place du jour, la même que Production :
// `corps` de vue-jour.js, « Après service » compris), rappels, fiche de fonction proche.
// La vue ne calcule rien : `aujourdhuiDe(...)` (domaine/tableau-blanc.js) et `feuilleDuJour(...)` (domaine/planification.js).
// Un autre jour se lit dans Production (`#/production/<date>`), ouvert depuis Semaine. Interface commune des vues : `titre(param, sous)` et `rendre(etat, param, sous)`.

import { libelleJour, lundiDe } from '../domaine/dates.js';
import { alertesAllergenes } from '../domaine/allergenes.js';
import { decisionsDe } from '../domaine/decisions.js';
import { jourOuVide } from '../domaine/etat.js';
import { feuilleDuJour } from '../domaine/planification.js';
import { preparationSemaine } from '../domaine/preparation.js';
import { aujourdhuiDe } from '../domaine/tableau-blanc.js';
import { aujourdhui, maintenant } from '../magasin.js';
import { boutonProposerPlanning } from './assistant-planning.js';
import { h, svg } from './dom.js';
import { lien, pastille } from './elements.js';
import { ouvrirCouvertsMidi, ouvrirVentesMidi } from './feuille-couverts.js';
import { ouvrirDecisions } from './feuille-decisions.js';
import { ouvrirCloture } from './feuille-cloture.js';
import { ligneServicesDuJour } from './feuille-services.js';
import { boutonsGestes, titreCarte } from './geste-rapide.js';
import { problemeHorsLigne } from './horsligne.js';
import { pluriel } from './format.js';
import { corps } from './vue-jour.js';

export function titre() { return "Aujourd'hui"; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const CERTITUDE = { estimee: 'estimée', provisoire: 'provisoire', confirmee: 'confirmée', hors_menu: 'hors menu' };

function icone(chemins, classe = 'au-icone') {
  return svg('svg', { classe, viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
  chemins.map((d) => svg('path', { d })));
}
const CHEVRON = ['M9 6l6 6-6 6'];

// ------------------------------------------------------------------ en-tête

/** Jour, date et heure du rendu ; l'état « hors ligne » n'apparaît que s'il y a un problème (`problemeHorsLigne`, null sinon). */
function entete(donnees) {
  const probleme = problemeHorsLigne();
  return h('header', { classe: 'au-tete' },
    h('div', { classe: 'au-tete-ligne' },
      h('p', { classe: 'au-date' }, `${majuscule(libelleJour(donnees.date))} · ${maintenant().slice(11, 16)}`)),
    h('h1', { classe: 'au-titre' }, "Aujourd'hui"),
    probleme ? h('p', { classe: 'au-hors-ligne', role: 'status' }, h('span', { classe: 'au-point', 'aria-hidden': 'true' }), h('span', null, probleme)) : null);
}

// ------------------------------------------------------------------ à confirmer

// Une seule ligne sur Aujourd'hui (étape 4) : la liste à produire doit rester en vue ; le total et « Tout voir » disent le reste.
const LIGNES_A_CONFIRMER = 1;

/** Une décision : son titre, puis son geste d'un toucher quand il est sûr, sinon « Décider » (ouvre la feuille « À décider »). */
function ligneAConfirmer(carte, etat) {
  const gestes = boutonsGestes(etat, carte);
  return h('li', null, h('div', { classe: 'au-ligne au-ligne-geste' },
    h('span', { classe: 'au-confirmer-mot' }, 'à décider'),
    h('span', { classe: 'au-confirmer-texte' }, titreCarte(carte, etat)),
    h('span', { classe: 'geste-rapide-groupe' },
      gestes.length > 0 ? gestes : h('button', { type: 'button', classe: 'btn geste-rapide', 'aria-label': `Décider : ${titreCarte(carte, etat)}`, onClick: () => ouvrirDecisions() }, 'Décider'))));
}

/** « À confirmer · N » : le total ET les lignes viennent de `decisionsDe` (les cartes de la feuille « À décider ») ; une ligne, « Tout voir » ouvre la feuille. */
function sectionAConfirmer(etat, feuille) {
  const { total, cartes } = feuille;
  if (total === 0) return null;
  return h('section', { classe: 'tdb-confirmer', 'aria-label': 'À confirmer' },
    h('div', { classe: 'tdb-tete' },
      h('h2', { classe: 'tdb-confirmer-titre' }, icone(['M12 3l10 18H2z', 'M12 10v5M12 18v.5']), `À confirmer · ${total}`),
      h('button', { type: 'button', classe: 'au-lien-court tdb-tout-voir', onClick: () => ouvrirDecisions() }, 'Tout voir ›')),
    h('ul', { classe: 'au-lignes' }, cartes.slice(0, LIGNES_A_CONFIRMER).map((c) => ligneAConfirmer(c, etat))));
}

// ------------------------------------------------------------------ prochaine fiche de fonction

/** Même règle que Semaine : « allergènes à confirmer » tant que la liste d'un composant concerné n'est pas validée. */
function allergenesAConfirmer(etat, f) {
  if (!f.allergies) return false;
  const alerte = alertesAllergenes(etat, f.date).find((a) => a.ficheId === f.id);
  return Boolean(alerte?.composants.some((c) => c.statut === 'a_confirmer'));
}

function carteFiche(d, aujourd, etat) {
  const f = d.ficheProche;
  if (!f) return null;
  const quand = f.date === aujourd ? "aujourd'hui" : libelleJour(f.date);
  const titreFiche = ['Fiche de fonction', quand, f.horaire || null, `${pluriel(f.couverts, 'pers.', 'pers.')}`].filter(Boolean).join(' · ');
  // La certitude porte sur la répartition des couverts, jamais sur les allergènes : on l'écrit comme telle.
  const statut = f.certitude ? `répartition ${CERTITUDE[f.certitude]}` : f.modeTexte;
  const aConfirmer = allergenesAConfirmer(etat, f);
  return h('a', { href: f.lien, classe: 'au-fiche', 'aria-label': `${titreFiche}${aConfirmer ? ', allergènes à confirmer' : ''}, ouvrir le détail du jour` },
    h('span', { classe: 'au-fiche-corps' },
      h('span', { classe: 'au-fiche-titre' }, titreFiche),
      h('span', { classe: 'au-sous' },
        [f.numero ? `fiche ${f.numero}` : null, f.modeTexte || null].filter(Boolean).join(' · '),
        f.allergies ? [' · ', h('strong', { classe: 'au-allergie' }, 'allergies'), ` : ${f.allergies}`] : ' · aucune allergie notée',
        ' · ', h('strong', { classe: f.certitude ? 'au-statut-certitude' : 'au-statut' }, statut)),
      aConfirmer ? h('span', { classe: 'au-fiche-pastille' }, pastille('allergènes à confirmer', 'ambre')) : null),
    icone(CHEVRON, 'au-icone au-chevron'));
}

// ------------------------------------------------------------------ fin de semaine

/** Le rappel de clôture (samedi dès 18:00, dimanche) en carte d'attention, comme « À confirmer » : un seul accès, absent des Rappels. */
function carteCloture(d) {
  const r = d.rappelCloture;
  if (!r) return null;
  const retenus = r.retenus > 0 ? ` · ${pluriel(r.retenus, 'élément déjà retenu', 'éléments déjà retenus')}` : '';
  return h('section', { classe: 'tdb-confirmer tdb-cloture', 'aria-label': 'Fin de semaine' },
    h('h2', { classe: 'tdb-confirmer-titre' }, icone(['M12 3l10 18H2z', 'M12 10v5M12 18v.5']), 'Fin de semaine'),
    h('p', { classe: 'au-sous' }, `Retenir les éléments de la semaine · ${r.aRetenir} à retenir${retenus}`),
    h('button', { type: 'button', classe: 'au-btn au-btn-action', onClick: () => ouvrirCloture(r.lundi) }, 'Retenir les éléments'));
}

// ------------------------------------------------------------------ rappels

/** Ce que l'ancien tableau disait encore et qui garde une action : menus de la semaine à saisir, portions à régler, sauvegarde. */
function sectionRappels(d, aFaire) {
  const lignes = [];
  if (aFaire > 0) lignes.push(lien(`#/preparer/${d.lundi}`, `Préparer la semaine · ${aFaire} à faire`, 'au-ligne au-ligne-lien'));
  if (d.rappelVendredi) lignes.push(lien(`#/import/${d.rappelVendredi.lundi}`, 'Menus de la semaine prochaine · à importer', 'au-ligne au-ligne-lien'));
  if (d.semaineSansMenu) lignes.push(lien(`#/import/${d.lundi}`, 'Saisir les menus de la semaine', 'au-ligne au-ligne-lien'));
  for (const l of d.production.chiffrage) lignes.push(lien(l.lien, l.detail ? `${l.texte} : ${l.detail}` : l.texte, 'au-ligne au-ligne-lien'));
  if (d.sauvegarde) lignes.push(lien(d.sauvegarde.lien, `${d.sauvegarde.texte} : ${d.sauvegarde.detail}`, 'au-ligne au-ligne-lien'));
  if (lignes.length === 0) return null;
  return h('nav', { classe: 'tdb-rappels', 'aria-label': 'Rappels' }, h('h2', { classe: 'au-etiquette' }, 'Rappels'), lignes);
}

// ------------------------------------------------------------------ les menus du jour, en grand

/**
 * Couverts du midi (prévisions saisies) : la touche ouvre la feuille « Couverts midi » ; dès 14 h, tant que les ventes ne sont pas
 * saisies, elle dit « Ventes à saisir » et ouvre la feuille « Ventes du midi ».
 */
function boutonCouverts(d, aujourd) {
  const { total, aSaisirVentes, ventes } = d.couvertsMidi;
  let mot = total === null ? 'couverts à saisir' : 'couverts';
  if (ventes) mot = [h('span', { classe: 'auj-couverts-ligne' }, 'servis '), h('span', { classe: 'auj-couverts-ligne' }, `M1 ${ventes.m1} · M2 ${ventes.m2}`)];
  const surClic = () => (aSaisirVentes ? ouvrirVentesMidi(aujourd) : ouvrirCouvertsMidi(aujourd));
  return h('button', { type: 'button', classe: 'auj-couverts', onClick: surClic,
    'aria-label': `Couverts midi aujourd'hui : ${total === null ? 'à saisir' : total}${aSaisirVentes ? '. Ventes à saisir' : ''}. Modifier` },
  h('span', { classe: 'auj-couverts-nombre' }, total === null ? '—' : String(total)),
  aSaisirVentes
    ? h('span', { classe: 'auj-couverts-mot auj-couverts-ventes' }, 'ventes à saisir')
    : h('span', { classe: 'auj-couverts-mot' }, mot));
}

/** Les deux intitulés du jour en grand (ce que le chef lit d'abord) et les couverts du midi ; rien le samedi ni un jour fermé. */
function carteMenus(etat, d, aujourd) {
  if (d.menus.length === 0) return null;
  const { menus } = jourOuVide(etat, aujourd);
  const intitules = [1, 2].map((n) => String(menus?.[n]?.intitule ?? '').trim());
  const aucun = intitules.every((t) => t === '');
  return h('section', { classe: 'auj-menus', 'aria-label': 'Menus du jour' },
    h('div', { classe: 'auj-menus-plats' },
      intitules.map((texte, i) => h('p', { classe: 'auj-menu' },
        h('span', { classe: 'auj-menu-etiquette' }, `Menu ${i + 1}`),
        texte ? h('span', { classe: 'auj-plat' }, texte) : h('span', { classe: 'auj-plat auj-plat-vide' }, 'non saisi'))),
      aucun ? lien(`#/import/${lundiDe(aujourd)}`, 'Importer les menus', 'au-lien-court') : null),
    boutonCouverts(d, aujourd));
}

// ------------------------------------------------------------------ à produire

/** Jour fermé : une seule mention, et le prochain jour de production. */
function carteFerme(d) {
  return h('section', { classe: 'prochaine prochaine-vide', 'aria-label': 'Jour fermé' },
    h('p', { classe: 'prochaine-vide-texte' }, "Fermé aujourd'hui", d.prochainOuvert ? [' · Prochaine production : ',
      h('a', { href: `#/production/${d.prochainOuvert}`, classe: 'au-lien-prochaine' }, libelleJour(d.prochainOuvert).split(' ').slice(0, 2).join(' '))] : null));
}

/** La liste de mise en place du jour : exactement celle de Production (mêmes lignes, mêmes gestes), sous un titre discret et son compte. */
function sectionProduction(etat, d, aujourd) {
  if (!d.ouvert) return carteFerme(d);
  const feuille = feuilleDuJour(etat, aujourd);
  const { faites, total } = d.avancementJour;
  return h('section', { classe: 'auj-production vue-jour', 'aria-label': 'À produire' },
    h('div', { classe: 'auj-production-tete' },
      h('h2', { classe: 'au-etiquette' }, 'À produire'),
      total > 0 ? h('span', { classe: 'auj-compte' }, `${faites} sur ${total} ${faites >= 2 ? 'faits' : 'fait'}`) : null),
    ligneServicesDuJour(etat, aujourd),
    corps(etat, aujourd, feuille, { avancesCompactes: true }),
    h('div', { classe: 'prod-pied pas-imprime' }, boutonProposerPlanning(aujourd)));
}

// ------------------------------------------------------------------ page

export function rendre(etat) {
  const aujourd = aujourdhui();
  const donnees = aujourdhuiDe(etat, aujourd, maintenant().slice(11, 16));
  const racine = h('div', { classe: 'vue vue-aujourdhui' });
  const morceaux = [entete(donnees), carteMenus(etat, donnees, aujourd),
    sectionAConfirmer(etat, decisionsDe(etat, aujourd)), carteCloture(donnees),
    sectionProduction(etat, donnees, aujourd),
    sectionRappels(donnees, preparationSemaine(etat, donnees.lundi, aujourd).aFaire), carteFiche(donnees, aujourd, etat)];
  for (const m of morceaux) if (m) racine.appendChild(m);
  return racine;
}
