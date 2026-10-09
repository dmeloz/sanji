// Semaine (onglet 3), refonte 1. Un jour (#/semaine/<date>) : puces lundi → samedi, bandeau du jour, services (menus 1 et 2
// avec l'attribution au poste, la carte en contexte sans quantité, fiches de fonction avec leurs allergies), « À produire
// ce jour » (créneau, avance, « hors règle » écrit en toutes lettres, « Fait », « Déplacer »), puis TOUT le détail existant
// du jour (vue-detail.js) dans des replis. Sans date, ou avec `sous === 'tableau'` : la semaine globale (vue-tableau.js), restylée.
// Cet écran ne calcule rien : il lit planification.js, calcul.js (portionsMenu), points.js, allergenes.js et l'état.

import { ajouterJours, creneauxDuJour, estDateValide, estOuvert, jourSemaine, joursEntre, libelleJour, lundiDe } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { alertesAllergenes } from '../domaine/allergenes.js';
import { calculerComposant, portionsMenu } from '../domaine/calcul.js';
import { etatCreneau, evaluationProduction } from '../domaine/planification.js';
import { pointsAConfirmer } from '../domaine/points.js';
import { tableauBlanc } from '../domaine/tableau-blanc.js';
import { LIBELLES, libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { ouvrirAssistantPlanning } from './assistant-planning.js';
import { h } from './dom.js';
import { panneau } from './panneau.js';
import { couvertsMidiDuJour } from '../domaine/couverts-midi.js';
import { ouvrirCouvertsMidi } from './feuille-couverts.js';
import { bouton, lien, pastille, repliable } from './elements.js';
import { ouvrirFiche } from './fiches.js';
import { boutonLireFiche } from './lecture-fiche.js';
import { problemeHorsLigne } from './horsligne.js';
import { demanderReinitialisation, peutReinitialiser } from './reinitialiser-semaine.js';
import { qteNoeuds, quantite } from './format.js';
import {
  actionsTache, defaireEnUnToucher, dialogCorriger, dialogPlanifier, faireEnUnToucher, ligneProduction, noeudEvaluation,
} from './taches.js';
import * as vueDetail from './vue-detail.js';
import * as vueTableau from './vue-tableau.js';

const estJour = (param, sous) => Boolean(param) && sous !== 'tableau' && estDateValide(param);

export function titre(param, sous) { return estJour(param, sous) ? 'Semaine : détail du jour' : 'Semaine'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;
const ORDRE_CRENEAU = ['avant_midi', 'apres_midi', 'avant_soir'];
const rangCreneau = (c) => (ORDRE_CRENEAU.includes(c) ? ORDRE_CRENEAU.indexOf(c) : ORDRE_CRENEAU.length);
const COCHABLES = new Set(['a_planifier', 'a_faire', 'en_cours', 'ecart']);

// ------------------------------------------------------------------ lectures (aucune règle propre)

/** Productions décidées ce jour (faites ou non), dans l'ordre créneau puis nom. */
function productionsDuJour(etat, date) {
  return Object.values(etat.productions ?? {})
    .filter((p) => p.jourDecide === date && etat.composants?.[p.composantId])
    .map((p) => ligneProduction(etat, p))
    .sort((a, b) => rangCreneau(a.creneauDecide) - rangCreneau(b.creneauDecide) || String(a.nom).localeCompare(String(b.nom))
      || (a.ordre ?? 0) - (b.ordre ?? 0));
}

/** Même règle que la feuille Jour : une avance qui n'est pas autorisée est « hors règle ». Jamais une quantité absente. */
const estHorsRegle = (etat, l) => {
  if (etat.productions?.[l.productionId]?.etat === 'fait') return false;
  const ev = evaluationProduction(etat, l.productionId);
  return Boolean(ev && ev.jours > 0 && ev.exception && !ev.autorisee);
};

/** « Jour off » : tous les créneaux du jour sont indisponibles dans la semaine type (ou sur ce jour). Rien d'autre n'est présumé. */
function estJourOff(etat, date) {
  const creneaux = creneauxDuJour(date);
  return estOuvert(date) && creneaux.length > 0 && creneaux.every((c) => etatCreneau(etat, date, c) === 'indisponible');
}

// ------------------------------------------------------------------ en-tête et puces

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

function entete(etat, date, aujourd) {
  const lundi = lundiDe(date);
  const numero = tableauBlanc(etat, aujourd, lundi).bord.entete.semaine;
  return h('header', { classe: 'sem-tete' },
    h('div', { classe: 'sem-tete-texte' },
      h('p', { classe: 'sem-legende' }, `Semaine ${numero} · ouvert lun → sam${problemeHorsLigne() ? ` · ${problemeHorsLigne()}` : ''}`),
      h('h1', { classe: 'sem-titre' }, 'Semaine')),
    h('div', { classe: 'sa-groupe' },
      h('a', { href: `#/semaine/${ajouterJours(date, -7)}`, classe: 'sa-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
      h('a', { href: `#/semaine/${ajouterJours(date, 7)}`, classe: 'sa-fleche', 'aria-label': 'Semaine suivante' }, '›'),
      boutonActions(lundi, date)));
}

function puces(etat, date, aujourd) {
  const lundi = lundiDe(date);
  const jours = [0, 1, 2, 3, 4, 5, 6].map((i) => ajouterJours(lundi, i));
  const puce = (d) => {
    const nom = majuscule(libelleJour(d).slice(0, 3));
    if (!estOuvert(d)) {
      return h('span', { classe: `sem-puce sem-puce-ferme${d === date ? ' sem-puce-actif' : ''}`, 'aria-label': `${majuscule(libelleJour(d))}, fermé`,
        'aria-current': d === date ? 'date' : null },
      h('span', { classe: 'sem-puce-nom' }, nom), h('span', { classe: 'sem-puce-mot' }, 'fermé'));
    }
    const horsRegle = productionsDuJour(etat, d).some((l) => estHorsRegle(etat, l));
    const off = estJourOff(etat, d);
    const aConfirmer = pointsAConfirmer(etat, d).length > 0;
    const marques = [horsRegle ? 'hors règle, à trancher' : null, aConfirmer ? 'à confirmer' : null, off ? 'jour off' : null].filter(Boolean);
    return h('a', {
      href: `#/semaine/${d}`, classe: `sem-puce${d === date ? ' sem-puce-actif' : ''}${d === aujourd ? ' sem-puce-aujourdhui' : ''}`,
      'aria-label': `${majuscule(libelleJour(d))}${d === aujourd ? ", aujourd'hui" : ''}${marques.length ? `, ${marques.join(', ')}` : ''}`,
      'aria-current': d === date ? 'date' : null,
    }, h('span', { classe: 'sem-puce-nom' }, nom),
    // Signe du jour : « ! » à trancher (hors règle), sinon « ? » à confirmer, sinon le point « jour off ». Le jour est aussi dit en toutes lettres (aria-label).
    horsRegle || aConfirmer ? h('span', { classe: 'sem-signe', 'aria-hidden': 'true' }, horsRegle ? '!' : '?')
      : h('span', { classe: `sem-point${off ? ' sem-point-off' : ''}`, 'aria-hidden': 'true' }));
  };
  // Légende : seulement les signes présents dans la semaine (une ligne au plus), au lieu de trois lignes fixes.
  const presents = { regle: false, confirmer: false, off: false };
  for (const d of jours) {
    if (!estOuvert(d)) continue;
    if (productionsDuJour(etat, d).some((l) => estHorsRegle(etat, l))) presents.regle = true;
    if (pointsAConfirmer(etat, d).length > 0) presents.confirmer = true;
    if (estJourOff(etat, d)) presents.off = true;
  }
  const cle = [
    presents.regle ? h('span', null, h('span', { classe: 'sem-signe', 'aria-hidden': 'true' }, '!'), ' hors règle, à trancher') : null,
    presents.confirmer ? h('span', null, h('span', { classe: 'sem-signe', 'aria-hidden': 'true' }, '?'), ' à confirmer') : null,
    presents.off ? h('span', null, h('span', { classe: 'sem-point sem-point-off', 'aria-hidden': 'true' }), ' jour off') : null,
  ].filter(Boolean);
  return h('div', { classe: 'sem-bandeau-jours' },
    h('nav', { classe: 'sem-puces', 'aria-label': 'Jours de la semaine' }, jours.map(puce)),
    cle.length > 0 ? h('p', { classe: 'sem-legende sem-cle' }, cle) : null);
}

// ------------------------------------------------------------------ bandeau du jour

/** Le bandeau dit les points à confirmer existants (points.js) ; chaque ligne est écrite, jamais portée par la couleur seule. */
function bandeau(etat, date) {
  const lignes = [];
  if (!estOuvert(date)) {
    lignes.push({ texte: 'Fermé : le dimanche est non travaillé, sans tâche ; il reste compté dans le temps de conservation.', type: 'neutre' });
    return lignes;
  }
  if (estJourOff(etat, date)) lignes.push({ texte: 'Jour off selon la semaine type : aucun créneau de travail.', type: 'off' });
  if (jourSemaine(date) === 2) lignes.push({ texte: 'Mardi : revue de mi-semaine après le service, pour les préparations de mercredi à vendredi.', type: 'rythme' });
  const points = pointsAConfirmer(etat, date);
  if (points.length > 0) {
    lignes.push({ texte: points.length === 1 ? '1 point à confirmer ce jour-là.' : `${points.length} points à confirmer ce jour-là.`, type: 'confirmer', aller: true });
  }
  return lignes;
}

function noeudBandeau(lignes) {
  if (lignes.length === 0) return null;
  return h('div', { classe: 'sem-bandeaux' }, lignes.map((l) => h('div', { classe: `sem-banniere sem-banniere-${l.type}`, role: l.type === 'confirmer' ? 'status' : null },
    h('span', { classe: 'sem-banniere-texte' }, l.texte),
    l.aller ? bouton('Voir', vueDetail.versAncre('points'), 'court', { 'aria-label': 'Voir les points à confirmer' }) : null)));
}

// ------------------------------------------------------------------ services : menus, carte, fiches

function certitudeDuMenu(etat, date, menu) {
  const p = portionsMenu(etat, date, menu);
  const parties = [];
  for (const [cle, mot] of [['estimee', 'estimée'], ['provisoire', 'provisoire'], ['confirmee', 'confirmée']]) {
    const n = p.details.filter((d) => d.certitude === cle).reduce((s, d) => s + d.portions, 0);
    // Une prévision estimée à 0 se dit « estimée 0 » ; une prévision « provisoire » (total saisi dans Couverts midi) ne laisse pas d'« estimée 0 ».
    const prevision0Estimee = cle === 'estimee' && p.details.some((d) => d.source === 'prevision' && d.certitude === 'estimee');
    if (n > 0 || prevision0Estimee) parties.push({ cle, mot: LIBELLES.CERTITUDE[cle] ?? mot, n });
  }
  return { total: Math.round(p.total), manquante: Boolean(p.previsionManquante) && p.total === 0, parties };
}

function ligneComposants(etat, date, menu) {
  const composants = Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  if (composants.length === 0) return null;
  const aposte = composants.filter((c) => c.attribue).length;
  // Carte réduite (décision du 2026-10-09) : l'attribution reste repliée, le résumé dit combien d'éléments sont au poste.
  // Les interrupteurs restent dedans (modifier l'attribution d'un geste).
  return h('details', { classe: 'repliable sem-poste' },
    h('summary', null, `Attribution au poste : ${aposte} sur ${composants.length}`),
    h('ul', { classe: 'sem-composants' }, composants.map((c) => h('li', { classe: 'sem-composant' },
      lien(`#/fiche/${encodeURIComponent(c.id)}`, c.nom, 'tache-nom'),
      vueDetail.interrupteurAuPoste(c, 'sem-poste')))));
}

function blocMenu(etat, date, menu) {
  const intitule = jourOuVide(etat, date).menus[menu].intitule.trim();
  const certitude = intitule === '' ? null : certitudeDuMenu(etat, date, menu);
  return h('div', { classe: 'sem-menu' },
    h('div', { classe: 'sem-ligne' },
      h('span', { classe: 'sem-rang' }, `Menu ${menu}`),
      intitule === '' ? h('span', { classe: 'sem-neutre' }, 'menu non saisi') : h('span', { classe: 'sem-intitule sem-intitule-court', title: intitule }, intitule)),
    certitude ? h('p', { classe: 'sem-couverts' },
      certitude.manquante ? h('span', { classe: 'sem-neutre' }, 'prévision à saisir')
        : [h('span', { classe: 'sem-qte' }, String(certitude.total)), ` ${certitude.total >= 2 ? 'couverts' : 'couvert'}`],
      certitude.parties.length > 0 && !certitude.manquante
        ? h('span', { classe: 'sem-certitudes' }, certitude.parties.map((p) => pastille(`${p.mot} ${p.n}`, p.cle === 'confirmee' ? 'vert' : 'gris'))) : null) : null,
    intitule === '' ? null : ligneComposants(etat, date, menu));
}

function ficheDuJour(etat, f, alertes) {
  const certitude = f.mode === 'menu_fixe' ? 'confirmee' : f.mode === 'choix_libre' ? (f.statutRepartition === 'confirmee' ? 'confirmee' : 'provisoire') : null;
  const allergie = alertes.find((a) => a.ficheId === f.id);
  const aConfirmer = allergie?.composants.some((c) => c.statut === 'a_confirmer');
  return h('li', { classe: 'sem-fiche' },
    h('div', { classe: 'sem-ligne' },
      h('span', { classe: 'sem-fiche-titre' }, [f.numero ? `Fiche ${f.numero}` : 'Fiche', f.service, f.horaire || null].filter(Boolean).join(' · ')),
      h('span', null, h('span', { classe: 'sem-qte' }, String(Number(f.couverts) || 0)), (Number(f.couverts) || 0) >= 2 ? ' personnes' : ' personne')),
    certitude ? h('p', { classe: 'sem-couverts' }, pastille(`répartition ${LIBELLES.CERTITUDE[certitude]}`, certitude === 'confirmee' ? 'vert' : 'gris')) : null,
    String(f.allergies ?? '').trim() ? h('p', { classe: 'sem-allergies' }, h('strong', null, 'Allergies : '), f.allergies) : null,
    aConfirmer ? h('p', null, pastille('allergènes à confirmer', 'ambre')) : null,
    bouton('Voir la fiche', () => ouvrirFiche(f.id), 'court', { 'aria-label': `Voir la fiche ${f.numero || ''} de fonction` }));
}

/** « Couverts midi · 50 · M1 30 · M2 20 » et un bouton qui ouvre la feuille de saisie (la même que sur Aujourd'hui), sans rond ni pastille. */
function ligneCouverts(etat, date) {
  const c = couvertsMidiDuJour(etat, date);
  const saisi = c.total !== null;
  return h('div', { classe: 'sa-couverts' },
    h('span', { classe: 'sa-couverts-texte' }, h('span', { classe: 'sem-rang' }, 'Couverts midi'),
      saisi ? h('span', { classe: 'sa-couverts-nombres' }, h('span', { classe: 'sem-qte' }, String(c.total)), `  ·  M1 ${c.m1 ?? '—'}  ·  M2 ${c.m2 ?? '—'}`) : h('span', { classe: 'sem-neutre' }, 'à saisir')),
    h('button', { type: 'button', classe: 'btn btn-court', onClick: () => ouvrirCouvertsMidi(date), 'aria-label': `${saisi ? 'Modifier' : 'Saisir'} les couverts midi du ${libelleJour(date)}` }, saisi ? 'Modifier' : 'Saisir'));
}

function carteServices(etat, date) {
  const fiches = Object.values(etat.fiches ?? {}).filter((f) => f.date === date && f.statut === 'active')
    .sort((a, b) => String(a.service).localeCompare(b.service) || String(a.horaire).localeCompare(String(b.horaire)));
  const alertes = alertesAllergenes(etat, date);
  const aMenus = jourSemaine(date) <= 5;
  return h('section', { classe: 'sem-carte', 'aria-labelledby': 'sem-titre-services' },
    h('h2', { classe: 'sem-section', id: 'sem-titre-services' }, `Services · ${libelleJour(date)}`),
    aMenus ? [ligneCouverts(etat, date), blocMenu(etat, date, 1), blocMenu(etat, date, 2)] : h('p', { classe: 'sem-neutre' }, 'Pas de menu du jour ce jour-là.'),
    h('div', { classe: 'sem-ligne' }, h('span', { classe: 'sem-rang' }, 'Carte'),
      h('span', { classe: 'sem-intitule' }, 'contexte du service')),
    // Essai du 2026-10-07 : la lecture d'une fiche se trouve ici, sans ouvrir le détail du jour.
    boutonLireFiche(date) ? h('div', { classe: 'actions' }, boutonLireFiche(date)) : null,
    fiches.length > 0 ? h('div', { classe: 'sem-fiches' }, h('h3', { classe: 'sem-sous-titre' }, 'Fiches de fonction'),
      h('ul', { classe: 'sem-liste' }, fiches.map((f) => ficheDuJour(etat, f, alertes)))) : null);
}

// ------------------------------------------------------------------ à produire ce jour

function texteSousTitre(etat, date, l) {
  const parties = [];
  if (l.creneauDecide) parties.push(libelle('CRENEAU', l.creneauDecide));
  const avance = Math.max(0, joursEntre(date, l.dateService));
  parties.push(avance === 0 ? 'jour même' : `pour ${libelleJour(l.dateService)} · J-${avance}`);
  if (l.menu) parties.push(`menu ${l.menu}`);
  if (l.genre === 'preparatoire') parties.push('action préparatoire');
  return parties.join(' · ');
}

function noeudQuantite(etat, l) {
  const p = etat.productions[l.productionId];
  if (l.genre === 'preparatoire') return null;
  if (p?.etat === 'fait') return Number.isFinite(l.quantiteReelle) ? h('span', { classe: 'sem-qte sem-qte-ligne' }, qteNoeuds(quantite(l.quantiteReelle, l.unite))) : null;
  if (l.cible !== null) return h('span', { classe: 'sem-qte sem-qte-ligne' }, qteNoeuds(quantite(l.cible, l.unite)));
  // Une quantité absente n'est ni une décision ni une alerte : une mention neutre.
  return h('span', { classe: 'sem-neutre sem-qte-absente' }, 'quantité à compléter');
}

/** État court d'une ligne : fait, à confirmer (quantité absente ou valeur INCONNU) ou calculé. Une action préparatoire n'a pas de quantité. */
function pastilleEtat(etat, l, fait) {
  if (fait) return pastille('fait', 'gris');
  if (l.genre === 'preparatoire') return null;
  const aConfirmer = l.cible === null || calculerComposant(etat, l.composantId).aValider;
  return aConfirmer ? pastille('à confirmer', 'ambre') : pastille('calculé', 'gris');
}

function ligneAProduire(etat, date, l) {
  const p = etat.productions[l.productionId];
  const fait = p?.etat === 'fait';
  const horsRegle = estHorsRegle(etat, l);
  const ev = evaluationProduction(etat, l.productionId);
  const nom = l.genre === 'principale' ? l.nom : (l.libelle || l.nom);
  const avance = Math.max(0, joursEntre(date, l.dateService));
  const sousTitre = horsRegle ? `${texteSousTitre(etat, date, l)} · ${avance} jours d'avance` : texteSousTitre(etat, date, l);
  const principal = [];
  if (fait) {
    if (l.genre !== 'preparatoire') principal.push(bouton('Corriger le réel', () => dialogCorriger(l.productionId), 'court', { 'aria-label': `Corriger le réel : ${nom}` }));
  } else {
    if (COCHABLES.has(l.etat)) principal.push(bouton('Fait', () => faireEnUnToucher(l.productionId), 'court principal', { 'aria-label': `Marquer fait : ${nom}` }));
    principal.push(bouton('Déplacer', () => dialogPlanifier(l.productionId, 'reporter'), 'court', { 'aria-label': `Déplacer à un autre jour : ${nom}` }));
  }
  const autres = actionsTache(l, p).filter((n) => !['Fait', 'Corriger', 'Reporter', 'Planifier'].includes(n.textContent));
  if (fait) autres.push(bouton('Remettre à faire', () => defaireEnUnToucher(l.productionId), 'court'));
  const details = (ev && ev.jours > 0) || autres.length > 0
    ? h('details', { classe: 'mep-plus sem-plus' }, h('summary', null, 'Actions et avance'),
      ev && ev.jours > 0 ? noeudEvaluation(ev) : null, h('div', { classe: 'actions' }, autres))
    : null;
  return h('li', { classe: `sem-prod${horsRegle ? ' sem-prod-hors-regle' : ''}${fait ? ' sem-prod-fait' : ''}` },
    h('div', { classe: 'sem-prod-ligne' },
      h('div', { classe: 'sem-prod-corps' },
        lien(`#/fiche/${encodeURIComponent(l.composantId)}`, nom, 'tache-nom'),
        h('p', { classe: 'sem-prod-sous' }, pastilleEtat(etat, l, fait), ' ',
          horsRegle ? h('strong', { classe: 'sem-hors-regle' }, 'hors règle · ') : null, sousTitre)),
      noeudQuantite(etat, l)),
    h('div', { classe: 'sem-prod-actions' }, principal),
    details);
}

function sectionAProduire(etat, date) {
  const lignes = productionsDuJour(etat, date);
  return h('section', { classe: 'sem-aproduire', 'aria-labelledby': 'sem-titre-produire' },
    h('h2', { classe: 'sem-section', id: 'sem-titre-produire' }, 'À produire ce jour'),
    lignes.length === 0 ? h('p', { classe: 'sem-neutre' }, 'Aucune production décidée ce jour-là.')
      : h('ul', { classe: 'sem-liste' }, lignes.map((l) => ligneAProduire(etat, date, l))),
    h('p', null, lien(`#/production/${date}`, 'Production du jour ›', 'sa-lien-production')));
}

// ------------------------------------------------------------------ vue

function rendreJour(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-semaine vue-detail' });
  racine.appendChild(entete(etat, date, aujourd));
  racine.appendChild(puces(etat, date, aujourd));
  racine.appendChild(h('h2', { classe: 'sem-jour' }, majuscule(libelleJour(date)), date === aujourd ? [' ', pastille("aujourd'hui", 'vert')] : null));
  const bande = noeudBandeau(bandeau(etat, date));
  if (bande) racine.appendChild(bande);
  if (!estOuvert(date)) return racine;
  const vide = productionsDuJour(etat, date).length === 0 ? vueDetail.etatVideSansMenu(etat, date) : null;
  if (vide) racine.appendChild(vide);
  // « À produire » d'abord (décision du 2026-10-09), puis les services réduits, puis tout le détail replié.
  racine.appendChild(sectionAProduire(etat, date));
  racine.appendChild(carteServices(etat, date));
  racine.appendChild(repliable(h('h2', { classe: 'sem-section' }, 'Tout le détail du jour'), false,
    [h('p', { classe: 'aide' }, 'Intitulés, composants, prévisions, fiches de fonction, allergies, créneaux, après service, points à confirmer. La carte n\'est qu\'un contexte : aucune quantité n\'en est calculée.'),
      ...vueDetail.sectionsDuJour(etat, date, { replie: true })], { classe: 'sem-detail', id: 'detail-jour' }));
  return racine;
}

/** Semaine globale : la vue d'ensemble existante (menus, fiches, à confirmer, production), habillée par `.vue-semaine-globale`. */
function rendreGlobale(etat, lundi) {
  const interieur = vueTableau.rendre(etat, lundi ?? null, { actions: boutonActions(lundiDe(lundi ?? aujourdhui()), lundi ?? aujourdhui()) });
  return h('div', { classe: 'vue-semaine-globale' }, interieur);
}

export function rendre(etat, param, sous) {
  return estJour(param, sous) ? rendreJour(etat, param) : rendreGlobale(etat, param);
}
