// Feuille « Services du jour » (v116) : ce que l'ancienne page de jour de la Semaine offrait, ouvert depuis Production.
// Une ligne discrète sous les menus (« Services du jour · couverts 60 · 1 fiche ›») ouvre une feuille : couverts du midi, menus avec
// leur certitude et l'attribution au poste, fiches de fonction et allergies, points à confirmer. Un bouton en bas ouvre
// « Détail du jour » (vue-detail.js, `sectionsDuJour`). Cet écran ne calcule rien : il lit calcul.js (portionsMenu), points.js,
// allergenes.js, couverts-midi.js et l'état ; les gestes sont ceux de vue-detail.js, fiches.js et feuille-couverts.js.

import { alertesAllergenes } from '../domaine/allergenes.js';
import { portionsMenu } from '../domaine/calcul.js';
import { couvertsMidiDuJour } from '../domaine/couverts-midi.js';
import { estOuvert, jourSemaine, libelleJour } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { pointsAConfirmer } from '../domaine/points.js';
import { LIBELLES } from '../domaine/statuts.js';
import { abonner, etat as etatCourant } from '../magasin.js';
import { h } from './dom.js';
import { bouton, lien, pastille } from './elements.js';
import { dialogFiche, ouvrirFiche } from './fiches.js';
import { ouvrirCouvertsMidi } from './feuille-couverts.js';
import { boutonLireFiche } from './lecture-fiche.js';
import { panneau } from './panneau.js';
import * as vueDetail from './vue-detail.js';

const MENUS = [1, 2];
const aDesMenus = (date) => jourSemaine(date) <= 5;
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

function fichesActives(etat, date) {
  return Object.values(etat.fiches ?? {}).filter((f) => f.date === date && f.statut === 'active')
    .sort((a, b) => String(a.service).localeCompare(b.service) || String(a.horaire).localeCompare(String(b.horaire)));
}

/** Ouvre une feuille en lecture seule après avoir fermé celle d'où l'on vient (une seule feuille de lecture à la fois). */
function ouvrirApres(fermer, ouvrir) {
  fermer();
  ouvrir();
}

// ------------------------------------------------------------------ la ligne de Production

/** « Services du jour · couverts 60 · 1 fiche ›» : une ligne tappable (48 px). Null un jour fermé. */
export function ligneServicesDuJour(etat, date) {
  if (!estOuvert(date)) return null;
  const parties = ['Services du jour'];
  if (aDesMenus(date)) {
    const total = couvertsMidiDuJour(etat, date).total;
    parties.push(total === null ? 'couverts à saisir' : `couverts ${total}`);
  }
  const fiches = fichesActives(etat, date).length;
  if (fiches > 0) parties.push(pluriel(fiches, 'fiche', 'fiches'));
  return h('button', {
    type: 'button', classe: 'prod-resume prod-services', onClick: () => ouvrirServices(date),
    'aria-label': `${parties.join(', ')}, ouvrir`,
  }, h('span', { classe: 'prod-resume-texte' }, h('span', { 'aria-hidden': 'true' }, '▤ '), parties.join(' · ')),
  h('span', { classe: 'prod-resume-fleche', 'aria-hidden': 'true' }, '›'));
}

// ------------------------------------------------------------------ contenu de la feuille

function certitudeDuMenu(etat, date, menu) {
  const p = portionsMenu(etat, date, menu);
  const parties = [];
  for (const cle of ['estimee', 'provisoire', 'confirmee']) {
    const n = p.details.filter((d) => d.certitude === cle).reduce((s, d) => s + d.portions, 0);
    // Une prévision estimée à 0 se dit « estimée 0 » ; une prévision « provisoire » ne laisse pas d'« estimée 0 ».
    const prevision0Estimee = cle === 'estimee' && p.details.some((d) => d.source === 'prevision' && d.certitude === 'estimee');
    if (n > 0 || prevision0Estimee) parties.push({ cle, mot: LIBELLES.CERTITUDE[cle], n });
  }
  return { total: Math.round(p.total), manquante: Boolean(p.previsionManquante) && p.total === 0, parties };
}

/** Les éléments du menu avec leur bascule « au poste / hors poste » : à plat, jamais dans un repli. */
function listeAttribution(etat, date, menu) {
  const composants = Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  if (composants.length === 0) return null;
  return h('ul', { classe: 'sem-composants' }, composants.map((c) => h('li', { classe: 'sem-composant' },
    lien(`#/fiche/${encodeURIComponent(c.id)}`, c.nom, 'tache-nom'),
    vueDetail.interrupteurAuPoste(c, 'sem-poste'))));
}

function blocMenu(etat, date, menu) {
  const intitule = jourOuVide(etat, date).menus[menu].intitule.trim();
  const certitude = intitule === '' ? null : certitudeDuMenu(etat, date, menu);
  return h('div', { classe: 'sem-menu' },
    h('div', { classe: 'sem-ligne' },
      h('span', { classe: 'sem-rang' }, `Menu ${menu}`),
      intitule === '' ? h('span', { classe: 'sem-neutre' }, 'menu non saisi') : h('span', { classe: 'sem-intitule' }, intitule)),
    certitude ? h('p', { classe: 'sem-couverts' },
      certitude.manquante ? h('span', { classe: 'sem-neutre' }, 'prévision à saisir')
        : [h('span', { classe: 'sem-qte' }, String(certitude.total)), ` ${certitude.total >= 2 ? 'couverts' : 'couvert'}`],
      certitude.parties.length > 0 && !certitude.manquante
        ? h('span', { classe: 'sem-certitudes' }, certitude.parties.map((p) => pastille(`${p.mot} ${p.n}`, p.cle === 'confirmee' ? 'vert' : 'gris'))) : null) : null,
    intitule === '' ? null : listeAttribution(etat, date, menu));
}

/** « Couverts midi · 50 · M1 30 · M2 20 » et un bouton qui ouvre la feuille de saisie (la même que sur Aujourd'hui). */
function ligneCouverts(etat, date, fermer) {
  const c = couvertsMidiDuJour(etat, date);
  const saisi = c.total !== null;
  return h('div', { classe: 'sa-couverts' },
    h('span', { classe: 'sa-couverts-texte' }, h('span', { classe: 'sem-rang' }, 'Couverts midi'),
      saisi ? h('span', { classe: 'sa-couverts-nombres' }, h('span', { classe: 'sem-qte' }, String(c.total)), `  ·  M1 ${c.m1 ?? '—'}  ·  M2 ${c.m2 ?? '—'}`) : h('span', { classe: 'sem-neutre' }, 'à saisir')),
    h('button', {
      type: 'button', classe: 'btn btn-court', onClick: () => ouvrirApres(fermer, () => ouvrirCouvertsMidi(date)),
      'aria-label': `${saisi ? 'Modifier' : 'Saisir'} les couverts midi du ${libelleJour(date)}`,
    }, saisi ? 'Modifier' : 'Saisir'));
}

function ficheDuJour(f, alertes) {
  const certitude = f.mode === 'menu_fixe' ? 'confirmee' : f.mode === 'choix_libre' ? (f.statutRepartition === 'confirmee' ? 'confirmee' : 'provisoire') : null;
  const allergie = alertes.find((a) => a.ficheId === f.id);
  const aConfirmer = allergie?.composants.some((c) => c.statut === 'a_confirmer');
  const couverts = Number(f.couverts) || 0;
  return h('li', { classe: 'sem-fiche' },
    h('div', { classe: 'sem-ligne' },
      h('span', { classe: 'sem-fiche-titre' }, [f.numero ? `Fiche ${f.numero}` : 'Fiche', f.service, f.horaire || null].filter(Boolean).join(' · ')),
      h('span', null, h('span', { classe: 'sem-qte' }, String(couverts)), couverts >= 2 ? ' personnes' : ' personne')),
    certitude ? h('p', { classe: 'sem-couverts' }, pastille(`répartition ${LIBELLES.CERTITUDE[certitude]}`, certitude === 'confirmee' ? 'vert' : 'gris')) : null,
    String(f.allergies ?? '').trim() ? h('p', { classe: 'sem-allergies' }, h('strong', null, 'Allergies : '), f.allergies) : null,
    aConfirmer ? h('p', null, pastille('allergènes à confirmer', 'ambre')) : null,
    bouton('Voir la fiche', () => ouvrirFiche(f.id), 'court', { 'aria-label': `Voir ou modifier la fiche ${f.numero || ''} de fonction` }));
}

function blocFiches(etat, date) {
  const fiches = fichesActives(etat, date);
  const alertes = alertesAllergenes(etat, date);
  return h('div', { classe: 'sem-fiches' },
    h('h3', { classe: 'sem-sous-titre' }, 'Fiches de fonction'),
    fiches.length === 0 ? h('p', { classe: 'sem-neutre' }, 'Aucune fiche de fonction ce jour-là.')
      : h('ul', { classe: 'sem-liste' }, fiches.map((f) => ficheDuJour(f, alertes))),
    h('div', { classe: 'actions' },
      bouton('Nouvelle fiche', () => dialogFiche(null, date), 'court'),
      boutonLireFiche(date)));
}

/** Le bandeau des points à confirmer (points.js), écrit en toutes lettres ; « Voir » ouvre le détail du jour. */
function bandeauPoints(etat, date, fermer) {
  const n = pointsAConfirmer(etat, date).length;
  if (n === 0) return null;
  return h('div', { classe: 'sem-banniere sem-banniere-confirmer', role: 'status' },
    h('span', { classe: 'sem-banniere-texte' }, `${n === 1 ? '1 point' : `${n} points`} à confirmer ce jour-là.`),
    bouton('Voir', () => ouvrirApres(fermer, () => ouvrirDetailDuJour(date, { ancre: 'points' })), 'court', { 'aria-label': 'Voir les points à confirmer' }));
}

// ------------------------------------------------------------------ les deux feuilles

/**
 * Feuille de lecture qui se redessine d'elle-même à chaque changement d'état tant qu'elle est ouverte (nouvelle fiche, composant
 * supprimé…) : abonnement au magasin à l'ouverture, désabonnement à la fermeture. Défilement et focus (par identifiant) sont gardés.
 * `construire(etat, api)` rend le contenu ; `apres` (facultatif) s'exécute une fois à l'ouverture, contenu en place.
 */
export function feuilleVivante({ titre, construire, apres }) {
  const zone = h('div', null);
  let api = null;
  const dessiner = () => {
    const defilement = zone.parentNode?.scrollTop;
    const focus = typeof document !== 'undefined' ? document.activeElement?.id : null;
    zone.replaceChildren(...[construire(etatCourant(), api)].flat().filter(Boolean));
    if (defilement !== undefined && zone.parentNode) zone.parentNode.scrollTop = defilement;
    if (focus) document.getElementById?.(focus)?.focus?.();
  };
  const dialogue = panneau({ titre, lectureSeule: true, corps: (a) => { api = a; dessiner(); return zone; } });
  const desabonner = abonner(dessiner);
  dialogue.addEventListener('close', desabonner);
  apres?.(dialogue);
  return dialogue;
}

/** Feuille « Détail du jour » : intitulés, composants, prévisions, fiches, allergies, créneaux, après service, points (tout à plat). */
export function ouvrirDetailDuJour(date, { ancre = null } = {}) {
  return feuilleVivante({
    titre: 'Détail du jour',
    construire: (etat) => h('div', { classe: 'vue-detail' },
      h('p', { classe: 'aide' }, `${majuscule(libelleJour(date))}. La carte n'est qu'un contexte : aucune quantité n'en est calculée.`),
      ...vueDetail.sectionsDuJour(etat, date, { plat: true })),
    apres: () => { if (ancre) document.getElementById(ancre)?.scrollIntoView?.({ block: 'start' }); },
  });
}

/** Feuille « Services du jour » : couverts, menus, attribution, fiches, allergies, points à confirmer. */
export function ouvrirServices(date) {
  return feuilleVivante({
    titre: `Services · ${libelleJour(date)}`,
    construire: (etat, { fermer }) => h('div', { classe: 'sem-carte' },
      bandeauPoints(etat, date, fermer),
      aDesMenus(date)
        ? [ligneCouverts(etat, date, fermer), ...MENUS.map((m) => blocMenu(etat, date, m))]
        : h('p', { classe: 'sem-neutre' }, 'Pas de menu du jour ce jour-là.'),
      blocFiches(etat, date),
      h('div', { classe: 'actions' }, bouton('Détail du jour', () => ouvrirApres(fermer, () => ouvrirDetailDuJour(date)), 'court'))),
  });
}
