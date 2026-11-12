// Semaine (refonte, étape 5) : l'onglet de la semaine entière, en deux volets. « Jours » : la préparation de la semaine
// (menus, couverts, portions) puis les jours, les plats en évidence (vue-tableau.js, habillée par `.vue-semaine-globale`).
// « Achats » (`#/semaine/achats`) : l'ancien onglet Articles (vue-articles.js). Le bouton « ⋯ » garde Importer les menus,
// Proposer un planning, Vue de la semaine ; l'historique reste à côté. Depuis la v116, un jour n'a pas de page ici :
// `#/semaine/<date>` mène à Production de ce jour (routeur). Aucune règle métier ici.

import { ajouterJours, libelleJour, lundiDe } from '../domaine/dates.js';
import { preparationSemaine } from '../domaine/preparation.js';
import { aujourdhui } from '../magasin.js';
import { ouvrirAssistantPlanning } from './assistant-planning.js';
import { h } from './dom.js';
import { lien } from './elements.js';
import { pluriel } from './format.js';
import { activerFeuilletage } from './glisser.js';
import { problemeHorsLigne } from './horsligne.js';
import { panneau } from './panneau.js';
import { demanderReinitialisation, peutReinitialiser } from './reinitialiser-semaine.js';
import { estSemainePassee } from './semaine-passee.js';
import * as vueArticles from './vue-articles.js';
import * as vueTableau from './vue-tableau.js';

export function titre(param, sous) { return sous === 'achats' ? 'Achats' : 'Semaine'; }

/** Le seul bouton d'action de Semaine : une feuille avec « Importer les menus » et « Proposer un planning ». */
function boutonActions(lundi, date) {
  return h('span', { classe: 'sa-groupe' },
    h('a', { href: '#/historique', classe: 'sa-fleche', 'aria-label': 'Historique des semaines' }, '↺'),
    boutonActionsFeuille(lundi, date));
}

function boutonActionsFeuille(lundi, date) {
  return h('button', {
    type: 'button', classe: 'sa-actions', 'aria-label': 'Actions de la semaine',
    onClick: () => panneau({
      titre: 'Semaine', lectureSeule: true,
      corps: ({ fermer }) => [
        h('a', { href: `#/import/${lundi}`, classe: 'btn sa-action', onClick: () => fermer() }, 'Importer les menus'),
        h('button', { type: 'button', classe: 'btn sa-action', onClick: () => { fermer(); ouvrirAssistantPlanning({ date }); } }, 'Proposer un planning'),
        h('a', { href: `#/semaine/${lundi}/tableau`, classe: 'btn sa-action', onClick: () => fermer() }, 'Vue de la semaine'),
        peutReinitialiser(lundi) ? h('button', { type: 'button', classe: 'btn sa-action', onClick: () => { fermer(); demanderReinitialisation(lundi); } }, 'Réinitialiser la semaine') : null,
      ],
    }),
  }, '⋯');
}

/** « du 5 au 10 octobre » (lundi au samedi) ; les deux mois sont dits quand la semaine en chevauche deux. */
function periode(lundi) {
  const sansJour = (date) => libelleJour(date).split(' ').slice(1);
  const [jourDebut, moisDebut] = sansJour(lundi);
  const [jourFin, moisFin] = sansJour(ajouterJours(lundi, 5));
  return `du ${jourDebut}${moisDebut === moisFin ? '' : ` ${moisDebut}`} au ${jourFin} ${moisFin}`;
}

/** Les deux volets de Semaine : un lien chacun, le volet affiché est dit par `aria-current` (et par le gras, jamais la couleur seule). */
function volets(actif, lundi) {
  const volet = (cle, texte, href) => h('a', { href, classe: `smn-volet${cle === actif ? ' smn-volet-actif' : ''}`, 'aria-current': cle === actif ? 'page' : null }, texte);
  return h('nav', { classe: 'smn-volets', 'aria-label': 'Volets de la semaine' },
    volet('jours', 'Jours', lundi ? `#/semaine/${lundi}/tableau` : '#/semaine'), volet('achats', 'Achats', '#/semaine/achats'));
}

/** En-tête : la période en petit, « Semaine », puis à droite ce que l'appelant donne (flèches et « ⋯ »). */
function entete(sousTitre, droite = null) {
  return h('header', { classe: 'smn-tete' },
    h('div', { classe: 'smn-tete-texte' },
      h('p', { classe: 'smn-periode' }, sousTitre, problemeHorsLigne() ? ` · ${problemeHorsLigne()}` : null),
      h('h1', { classe: 'smn-titre' }, 'Semaine')),
    droite ? h('div', { classe: 'smn-tete-actions' }, droite) : null);
}

/** Une ligne de la préparation : un signe (✓ ou !) et un mot pour l'état, jamais la couleur seule. */
function lignePreparation(fait, libelle, etatTexte) {
  return h('li', { classe: `smn-prep-ligne${fait ? '' : ' smn-prep-a-faire'}` },
    h('span', { classe: 'smn-prep-signe', 'aria-hidden': 'true' }, fait ? '✓' : '!'),
    h('span', { classe: 'smn-prep-libelle' }, libelle),
    h('span', { classe: 'smn-prep-etat' }, etatTexte));
}

/** « Préparation de la semaine » : où en sont les menus, les couverts du midi et les portions, et le bouton de ce qui reste. Rien sur une semaine passée. */
function cartePreparation(etat, lundi) {
  if (estSemainePassee(lundi)) return null;
  const aujourd = aujourdhui();
  const p = preparationSemaine(etat, lundi, aujourd);
  const sansMenu = p.jours.length === 0;
  const sansCouverts = p.jours.filter((j) => j.couverts.total === null && j.date >= aujourd).length;
  const portions = p.aConfirmer.length;
  // Sans menu, le bouton d'import est juste dessous (« Saisir les menus de la semaine ») : pas de doublon ici.
  const action = sansMenu || p.aFaire === 0 ? null
      : lien(`#/preparer/${lundi}`, sansCouverts === 0 ? `Confirmer ${portions === 1 ? 'la portion' : `les ${portions} portions`}` : 'Préparer la semaine', 'btn btn-principal smn-prep-action');
  return h('section', { classe: 'smn-prep', 'aria-labelledby': 'smn-prep-titre' },
    h('h2', { classe: 'smn-prep-titre', id: 'smn-prep-titre' }, 'Préparation de la semaine'),
    h('ul', { classe: 'smn-prep-lignes' },
      lignePreparation(!sansMenu, 'Menus', sansMenu ? 'à importer' : pluriel(p.jours.length, 'jour', 'jours')),
      sansMenu ? null : lignePreparation(sansCouverts === 0, 'Couverts du midi', sansCouverts === 0 ? 'saisis' : `${pluriel(sansCouverts, 'jour', 'jours')} à saisir`),
      sansMenu ? null : lignePreparation(portions === 0, 'Portions', portions === 0 ? 'confirmées' : `${portions} à confirmer`)),
    action);
}

/** Volet « Achats » : la liste des articles par jour de production, sous l'en-tête et les volets de Semaine. */
function rendreAchats(etat) {
  return h('div', { classe: 'vue-semaine-globale' },
    h('div', { classe: 'vue smn-achats' }, entete('À avoir pour chaque jour de production'), volets('achats', null), vueArticles.rendre(etat, { integre: true })));
}

/** Semaine : un lundi (ou une date, ramenée à sa semaine) ou, sans paramètre, la semaine en cours ; `sous === 'achats'` : le volet Achats. */
export function rendre(etat, param, sous) {
  if (sous === 'achats') return rendreAchats(etat);
  const date = param ?? aujourdhui();
  const tete = (tb) => [
    entete(periode(tb.lundi), [
      h('a', { href: `#/semaine/${tb.semainePrecedente}/tableau`, classe: 'smn-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
      h('a', { href: `#/semaine/${tb.semaineSuivante}/tableau`, classe: 'smn-fleche', 'aria-label': 'Semaine suivante' }, '›'),
      boutonActions(tb.lundi, date)]),
    volets('jours', param ? tb.lundi : null),
    cartePreparation(etat, tb.lundi)];
  const interieur = vueTableau.rendre(etat, param ?? null, { tete });
  const racine = h('div', { classe: 'vue-semaine-globale' }, interieur);
  // Glisser change de semaine, comme les flèches ‹ › de l'en-tête : à partir de la semaine AFFICHÉE (sans paramètre, le week-end, c'est la suivante).
  const vers = (decalage) => { location.hash = `#/semaine/${ajouterJours(interieur.getAttribute('data-lundi') ?? lundiDe(date), decalage)}/tableau`; };
  activerFeuilletage(racine, { suivant: () => vers(7), precedent: () => vers(-7) });
  return racine;
}
