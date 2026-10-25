// Aujourd'hui (onglet 1, accueil), tableau de bord de la refonte 2 (décision du 2026-10-07). La vue ne calcule rien : tout vient
// de `aujourdhuiDe(...)` (domaine/tableau-blanc.js). De haut en bas : en-tête (jour, date, heure), menus sur 3 jours, cases
// Production et Couverts midi, « À avancer » (règle des 2 jours, 3 lignes), fiche de fonction (aujourd'hui ou demain),
// « À confirmer » (3 lignes), rappels discrets ; la carte « Prochaine » est une carte de la page (sous les chiffres), jamais fixe.
// Retirés de l'accueil : case ambre « À confirmer » dans les chiffres, raccourci Articles ; plus aucun créneau (v134). Interface commune des vues : `titre(param, sous)` et `rendre(etat, param, sous)`.

import { libelleJour, lundiDe } from '../domaine/dates.js';
import { alertesAllergenes } from '../domaine/allergenes.js';
import { decisionsDe } from '../domaine/decisions.js';
import { raisonNonChiffree } from '../domaine/mise-en-place.js';
import { preparationSemaine } from '../domaine/preparation.js';
import { aujourdhuiDe } from '../domaine/tableau-blanc.js';
import { aujourdhui, maintenant } from '../magasin.js';
import { h, svg } from './dom.js';
import { lien, pastille } from './elements.js';
import { ouvrirCouvertsMidi, ouvrirVentesMidi } from './feuille-couverts.js';
import { ouvrirDecisions } from './feuille-decisions.js';
import { ouvrirCloture } from './feuille-cloture.js';
import { boutonsGestes, titreCarte } from './geste-rapide.js';
import { problemeHorsLigne } from './horsligne.js';
import { pluriel, qteNoeuds, quantite } from './format.js';
import { faireEnUnToucher } from './taches.js';
import { feuilleChiffrage } from './vue-jour.js';

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
      h('p', { classe: 'au-date' }, `${majuscule(libelleJour(donnees.date))} · ${maintenant().slice(11, 16)}`),
      h('a', { href: '#/reglages', classe: 'au-reglages' }, 'Réglages')),
    h('h1', { classe: 'au-titre' }, "Aujourd'hui"),
    probleme ? h('p', { classe: 'au-hors-ligne', role: 'status' }, h('span', { classe: 'au-point', 'aria-hidden': 'true' }), h('span', null, probleme)) : null);
}

// ------------------------------------------------------------------ menus sur trois jours

const NOM_COURT = (date) => majuscule(libelleJour(date).slice(0, 3));

function colonneJour(jour, lundi) {
  const nom = libelleJour(jour.date).split(' ')[0];
  const numero = libelleJour(jour.date).split(' ')[1];
  const dateCourte = `${NOM_COURT(jour.date)} ${numero}${jour.estAujourdhui ? ' · auj.' : ''}`;
  if (jour.aImporter) {
    return h('a', { href: `#/import/${lundi(jour.date)}`, classe: 'tdb-jour tdb-jour-vide', 'aria-label': `${majuscule(nom)}, menu à importer` },
      h('span', { classe: 'tdb-jour-date' }, dateCourte),
      h('span', { classe: 'tdb-jour-contenu' }, h('span', { classe: 'tdb-a-importer' }, 'menu à importer'),
        h('span', { classe: 'tdb-etiquette' }, 'Importer')));
  }
  const dits = jour.menus.map((m) => `menu ${m.menu} : ${m.intitule || 'non saisi'}`).join(', ');
  return h('a', { href: `#/production/${jour.date}`, classe: `tdb-jour${jour.estAujourdhui ? ' tdb-jour-auj' : ''}`,
    'aria-label': `${majuscule(nom)}${jour.estAujourdhui ? ", aujourd'hui" : ''}, ${dits}` },
  h('span', { classe: 'tdb-jour-date' }, dateCourte),
  h('span', { classe: 'tdb-jour-contenu' }, jour.menus.map((m) => h('span', { classe: 'tdb-m' }, h('b', null, `M${m.menu}`),
    h('span', { classe: m.intitule ? 'tdb-intitule' : 'tdb-intitule au-neutre' }, m.intitule || 'non saisi')))));
}

function sectionMenus(d, lundiDe) {
  if (d.menusSurTrois.length === 0) return null;
  return h('section', { classe: 'tdb-section tdb-section-jours', 'aria-label': 'Jours proches' },
    h('div', { classe: 'tdb-tete' }, h('h2', { classe: 'au-etiquette' }, 'Jours proches'), lien('#/semaine', 'Semaine ›', 'au-lien-court')),
    h('div', { classe: 'tdb-jours' }, d.menusSurTrois.map((j) => colonneJour(j, lundiDe))));
}

// ------------------------------------------------------------------ la journée en chiffres

function caseProduction(d, aujourd) {
  const { faites, total } = d.avancementJour;
  return h('a', { href: `#/production/${aujourd}`, classe: 'tdb-case', 'aria-label': total > 0 ? `Production : ${faites} faites sur ${total}` : 'Production du jour' },
    h('span', { classe: 'au-sous' }, 'Production'),
    h('span', { classe: 'tdb-chiffre' }, total > 0 ? `${faites}/${total}` : '—'),
    total > 0 ? h('span', { classe: 'prod-jauge', 'aria-hidden': 'true' }, h('span', { style: `width: ${Math.round((faites / total) * 100)}%` })) : null);
}

/**
 * Couverts du midi (prévisions saisies) : la touche ouvre la feuille « Couverts midi » ; dès 14 h, tant que les ventes ne sont pas
 * saisies, la case dit « Ventes à saisir » et ouvre la feuille « Ventes du midi ».
 */
function caseCouverts(d, aujourd) {
  const { total, m1, m2, aSaisirVentes, ventes } = d.couvertsMidi;
  let suite = total === null ? 'à saisir' : `M1 ${m1 ?? '—'} · M2 ${m2 ?? '—'}`;
  if (ventes) suite = `servis M1 ${ventes.m1} · M2 ${ventes.m2}`;
  const surClic = () => (aSaisirVentes ? ouvrirVentesMidi(aujourd) : ouvrirCouvertsMidi(aujourd));
  return h('button', { type: 'button', classe: 'tdb-case tdb-case-bouton', onClick: surClic,
    'aria-label': `Couverts midi aujourd'hui : ${total === null ? 'à saisir' : total}${aSaisirVentes ? '. Ventes à saisir' : ''}. Modifier` },
  h('span', { classe: 'au-sous tdb-case-tete' }, 'Couverts midi', icone(['M4 20h4L19 9l-4-4L4 16z'], 'au-icone tdb-crayon')),
  h('span', { classe: 'tdb-chiffre' }, total === null ? '—' : String(total)),
  aSaisirVentes
    ? h('span', { classe: 'tdb-ventes-a-saisir' }, icone(['M12 3l10 18H2z', 'M12 10v5M12 18v.5'], 'au-icone'), 'Ventes à saisir')
    : h('span', { classe: 'au-sous' }, suite));
}

function sectionChiffres(d, aujourd) {
  if (!d.ouvert) return null; // jour fermé : une seule mention, dans la carte « Prochaine »
  // Le samedi, il n'y a pas de menu du jour : pas de couverts du midi à saisir, seule la case Production reste.
  const avecCouverts = d.menus.length > 0;
  return h('section', { classe: `tdb-chiffres${avecCouverts ? '' : ' tdb-chiffres-seule'}`, 'aria-label': 'La journée en chiffres' },
    caseProduction(d, aujourd), avecCouverts ? caseCouverts(d, aujourd) : null);
}

// ------------------------------------------------------------------ à avancer

function sectionAAvancer(d, aujourd) {
  const { total, lignes } = d.aAvancer;
  if (total === 0) return null;
  return h('section', { classe: 'tdb-section', 'aria-label': 'À avancer' },
    h('div', { classe: 'tdb-tete' }, h('h2', { classe: 'au-etiquette' }, 'À avancer'), lien(`#/production/${aujourd}`, 'Production ›', 'au-lien-court')),
    lignes.map((l) => h('a', { href: `#/fiche/${encodeURIComponent(l.composantId)}`, classe: 'tdb-avance' },
      h('span', { classe: 'tdb-avance-nom' }, h('span', { classe: 'nom' }, l.nom), h('span', { classe: 'au-sous' }, `pour ${libelleJour(l.dateService).split(' ')[0]}`)),
      l.quantite !== null && l.unite !== 'portion' ? h('span', { classe: 'au-qte' }, qteNoeuds(quantite(l.quantite, l.unite))) : h('span', { classe: 'au-neutre' }, l.unite === 'portion' ? 'à chiffrer' : '—'))));
}

// ------------------------------------------------------------------ à confirmer

const LIGNES_A_CONFIRMER = 3;

/** Une décision : son titre, puis son geste d'un toucher quand il est sûr, sinon « Décider » (ouvre la feuille « À décider »). */
function ligneAConfirmer(carte, etat) {
  const gestes = boutonsGestes(etat, carte);
  return h('li', null, h('div', { classe: 'au-ligne au-ligne-geste' },
    h('span', { classe: 'au-confirmer-mot' }, 'à décider'),
    h('span', { classe: 'au-confirmer-texte' }, titreCarte(carte, etat)),
    h('span', { classe: 'geste-rapide-groupe' },
      gestes.length > 0 ? gestes : h('button', { type: 'button', classe: 'btn geste-rapide', 'aria-label': `Décider : ${titreCarte(carte, etat)}`, onClick: () => ouvrirDecisions() }, 'Décider'))));
}

/** « À confirmer · N » : le total ET les lignes viennent de `decisionsDe` (les cartes de la feuille « À décider ») ; trois lignes au plus, « Tout voir » ouvre la feuille. */
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

// ------------------------------------------------------------------ Prochaine (fixe en bas)

/** Quantité inconnue : étiquette « à chiffrer » qui ouvre la même feuille que Production (raison, puis ce qui manque). */
function boutonAChiffrer(etat, m) {
  const raison = raisonNonChiffree(etat, m);
  if (!raison) return h('p', { classe: 'prochaine-neutre' }, 'à chiffrer');
  return h('button', { type: 'button', classe: 'prod-asaisir prochaine-neutre', 'aria-label': `${m.nom} : à chiffrer`,
    onClick: () => feuilleChiffrage(etat, m, m.nom, raison) }, pastille('à chiffrer', 'ambre'));
}

function carteProchaine(d, aujourd, etat) {
  const m = d.maintenant;
  if (!m) {
    return h('section', { classe: 'prochaine prochaine-vide', 'aria-label': 'Prochaine action' },
      h('p', { classe: 'prochaine-vide-texte' }, !d.ouvert
        ? ["Fermé aujourd'hui", d.prochainOuvert ? [' · Prochaine production : ',
          h('a', { href: `#/production/${d.prochainOuvert}`, classe: 'au-lien-prochaine' }, libelleJour(d.prochainOuvert).split(' ').slice(0, 2).join(' '))] : null]
        : d.avancement.total > 0 ? "Tout est fait pour aujourd'hui." : "Aucune tâche décidée pour aujourd'hui."));
  }
  const q = m.genre !== 'preparatoire' && m.cible !== null && m.unite !== 'portion' ? quantite(m.cible, m.unite) : null;
  const quand = m.dateService === aujourd ? null : `pour ${libelleJour(m.dateService).split(' ')[0]}`;
  return h('section', { classe: 'prochaine', 'aria-label': 'Prochaine action' },
    h('div', { classe: 'prochaine-tete' },
      h('h2', { classe: 'prochaine-etiquette' }, ['Prochaine action', quand ? ` · ${quand}` : null]),
      h('span', { classe: 'prochaine-menu' }, [m.menu ? `menu ${m.menu}` : null, m.horsRegle ? h('strong', { classe: 'au-hors-regle' }, ' · hors règle') : null])),
    h('div', { classe: 'prochaine-ligne' },
      h('p', { classe: 'prochaine-nom' }, m.nom),
      q ? h('p', { classe: 'au-qte prochaine-qte' }, qteNoeuds(q)) : (m.genre === 'preparatoire' ? null : boutonAChiffrer(etat, m))),
    h('div', { classe: 'au-maintenant-actions' },
      h('a', { href: `#/fiche/${encodeURIComponent(m.composantId)}`, classe: 'au-btn au-btn-clair' }, 'Ouvrir la fiche'),
      h('button', { type: 'button', classe: 'au-btn au-btn-action', onClick: () => faireEnUnToucher(m.productionId), 'aria-label': `Fait : ${m.nom}` }, 'Fait')));
}

// ------------------------------------------------------------------ page

export function rendre(etat) {
  const aujourd = aujourdhui();
  const donnees = aujourdhuiDe(etat, aujourd, maintenant().slice(11, 16));
  const racine = h('div', { classe: 'vue vue-aujourdhui' });
  const morceaux = [entete(donnees), carteProchaine(donnees, aujourd, etat), sectionMenus(donnees, lundiDe),
    sectionAConfirmer(etat, decisionsDe(etat, aujourd)), carteCloture(donnees),
    sectionRappels(donnees, preparationSemaine(etat, donnees.lundi, aujourd).aFaire), sectionChiffres(donnees, aujourd),
    sectionAAvancer(donnees, aujourd), carteFiche(donnees, aujourd, etat)];
  for (const m of morceaux) if (m) racine.appendChild(m);
  return racine;
}
