// Accueil : tableau de bord du poste. Tout vient de `tableauDeBord(etat, aujourdhui())` ; cette vue ne calcule rien.
// Ordre : date et service, point global, mise en place (réglette), menus, créneaux, à décider, à avancer,
// fiches, commandes, semaine.

import { libelleJour, lundiDe } from '../domaine/dates.js';
import { libelle } from '../domaine/statuts.js';
import { tableauDeBord } from '../domaine/tableau-bord.js';
import { aujourdhui } from '../magasin.js';
import { ajouter, h, svg } from './dom.js';
import { encadre, ligneVide, lien, pastille } from './elements.js';
import { pluriel } from './format.js';

export const titre = () => 'Accueil';

const MAX_DECISIONS = 4;
const MAX_AVANCES = 3;
const MAX_BLOCS = 9;

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const lienComposant = (id) => `#/composant/${encodeURIComponent(id)}`;

// ------------------------------------------------------------------ pictogrammes (SVG en ligne)

const ATTRIBUTS_SVG = { 'aria-hidden': 'true', focusable: 'false' };

/** Hachures diagonales (segments) à l'intérieur du rectangle [x1, x2] × [y1, y2], sans masque ni identifiant. */
function hachures(x1, y1, x2, y2, pas) {
  const traits = [];
  for (let s = x1 + y1 + pas; s < x2 + y2; s += pas) {
    const xa = Math.max(x1, s - y2);
    const xb = Math.min(x2, s - y1);
    traits.push(svg('line', { classe: 'bac-signe', x1: xa, y1: s - xa, x2: xb, y2: s - xb }));
  }
  return traits;
}

const FORMES_BAC = {
  // Prêt : bac plein et coche.
  pret: () => [
    svg('rect', { classe: 'bac-corps', x: 2, y: 2, width: 44, height: 32, rx: 7 }),
    svg('polyline', { classe: 'bac-signe bac-signe-clair', points: '14,18 21,25 34,11' }),
  ],
  // En cours : bac à moitié plein.
  en_cours: () => [
    svg('path', { classe: 'bac-corps', d: 'M2 18 H46 V27 A7 7 0 0 1 39 34 H9 A7 7 0 0 1 2 27 Z' }),
    svg('rect', { classe: 'bac-bord', x: 2, y: 2, width: 44, height: 32, rx: 7 }),
  ],
  // À faire : bac vide, simple contour.
  a_faire: () => [svg('rect', { classe: 'bac-bord', x: 2, y: 2, width: 44, height: 32, rx: 7 })],
  // À décider : contour rouge épais et point d'exclamation.
  a_decider: () => [
    svg('rect', { classe: 'bac-bord', x: 2, y: 2, width: 44, height: 32, rx: 7 }),
    svg('line', { classe: 'bac-signe', x1: 24, y1: 9, x2: 24, y2: 21 }),
    svg('circle', { classe: 'bac-point', cx: 24, cy: 27, r: 2.4 }),
  ],
  // Fait mais non couvert : bac hachuré.
  non_couvert: () => [
    svg('rect', { classe: 'bac-bord', x: 2, y: 2, width: 44, height: 32, rx: 7 }),
    ...hachures(7, 7, 41, 29, 7),
  ],
};

/** Dessin d'un bac pour un symbole de la réglette. `mini` : version de légende, dans le texte. */
function dessinBac(symbole, mini = false) {
  return svg('svg', { classe: `bac bac-${symbole}${mini ? ' bac-mini' : ''}`, viewBox: '0 0 48 36', ...ATTRIBUTS_SVG },
    ...FORMES_BAC[symbole]());
}

function pictoAllergie() {
  return svg('svg', { classe: 'picto picto-allergie', viewBox: '0 0 24 24', ...ATTRIBUTS_SVG },
    svg('path', { d: 'M12 3.5 L22 20.5 H2 Z', fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    svg('line', { x1: 12, y1: 10, x2: 12, y2: 15, 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 12, cy: 18, r: 1.2, fill: 'currentColor', 'stroke-width': 1 }));
}

function pictoAlerte() {
  return svg('svg', { classe: 'picto picto-alerte', viewBox: '0 0 24 24', ...ATTRIBUTS_SVG },
    svg('circle', { cx: 12, cy: 12, r: 9.5, fill: 'none', 'stroke-width': 2 }),
    svg('line', { x1: 12, y1: 7, x2: 12, y2: 13, 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 12, cy: 16.5, r: 1.2, fill: 'currentColor', 'stroke-width': 1 }));
}

// ------------------------------------------------------------------ réglette de mise en place

const ETAT_BAC = {
  pret: 'prêt', en_cours: 'en cours', a_faire: 'à faire', a_decider: 'à décider', non_couvert: 'non couvert',
};

/** Ordre de la phrase-légende : du plus avancé au plus urgent. */
const ORDRE_PHRASE = ['pret', 'en_cours', 'a_faire', 'a_decider', 'non_couvert'];

function texteCompte(symbole, n) {
  switch (symbole) {
    case 'pret': return `${n} ${n >= 2 ? 'prêtes' : 'prête'}`;
    case 'en_cours': return `${n} en cours`;
    case 'a_faire': return `${n} à faire`;
    case 'a_decider': return `${n} à décider`;
    default: return `${n} ${n >= 2 ? 'non couvertes' : 'non couverte'}`;
  }
}

function bac(tache) {
  return h('a', {
    href: lienComposant(tache.composantId), classe: `bac-lien bac-lien-${tache.symbole}`,
    'aria-label': `${tache.nom} : ${ETAT_BAC[tache.symbole]}`,
  }, dessinBac(tache.symbole), h('span', { classe: 'bac-nom' }, tache.nom));
}

/** Phrase sous la réglette : chaque état présent, avec son pictogramme (elle sert de légende). */
function phraseLegende(compte) {
  const morceaux = [];
  for (const s of ORDRE_PHRASE.filter((x) => compte[x] > 0)) {
    morceaux.push(h('li', { classe: 'legende-item' }, dessinBac(s, true), texteCompte(s, compte[s])));
  }
  return h('ul', { classe: 'legende' }, morceaux);
}

/** Pourquoi il n'y a aucune tâche, et quoi faire. */
function videMiseEnPlace(tb) {
  if (!tb.aMenu) {
    return [h('p', null, 'Pas de menu du jour le samedi : aucune mise en place à suivre. Regardez plutôt ce qui peut être avancé pour la semaine suivante.')];
  }
  const jour = libelleJour(tb.jourService);
  if (tb.menus.every((m) => !m.saisi)) {
    return [
      h('p', null, 'Aucune tâche : le menu du jour n\'est pas saisi.'),
      h('p', null, lien(`#/detail/${tb.jourService}`, tb.jourService === tb.date ? 'Saisir le menu du jour' : `Saisir le menu du ${jour}`, 'btn')),
    ];
  }
  return [
    h('p', null, 'Aucune tâche : les composants du poste ne sont pas encore validés.'),
    h('p', null, lien(`#/detail/${tb.jourService}`, 'Valider les composants', 'btn')),
  ];
}

function carteMiseEnPlace(tb) {
  const { taches, compte } = tb.miseEnPlace;
  const memeJour = tb.jourService === tb.date;
  return h('section', { classe: 'carte carte-pleine carte-mise-en-place', 'aria-labelledby': 'titre-mise-en-place' },
    h('h2', { classe: 'section-titre', id: 'titre-mise-en-place' }, memeJour ? 'Mise en place du service' : `Mise en place du ${libelleJour(tb.jourService)}`),
    taches.length > 0
      ? [h('div', { classe: 'reglette' }, taches.map(bac)), phraseLegende(compte)]
      : videMiseEnPlace(tb),
    h('div', { classe: 'actions' }, lien(`#/jour/${tb.jourService}`, 'Ouvrir la feuille du jour', 'btn btn-principal')));
}

// ------------------------------------------------------------------ menus

function detailPortions(p) {
  const parties = [];
  if (p.prevision > 0) parties.push(`${p.prevision} ${p.prevision >= 2 ? 'estimées' : 'estimée'}`);
  if (p.groupesConfirmes > 0) parties.push(`${p.groupesConfirmes} ${p.groupesConfirmes >= 2 ? 'confirmées' : 'confirmée'} de groupe`);
  if (p.groupesProvisoires > 0) parties.push(`${p.groupesProvisoires} ${p.groupesProvisoires >= 2 ? 'provisoires' : 'provisoire'} de groupe`);
  return parties.length > 0 ? parties.join(', ') : 'aucune prévision saisie';
}

function blocMenu(m, tb) {
  const p = m.portions;
  const chiffrable = p.total > 0 || !p.previsionManquante;
  return h('div', { classe: 'menu-bloc' },
    h('h3', { classe: 'menu-numero' }, `Menu ${m.menu}`),
    m.saisi
      ? h('p', { classe: 'intitule' }, m.intitule)
      : h('p', { classe: 'discret' }, 'menu non saisi ', lien(`#/detail/${tb.jourService}`, 'Saisir le menu du jour')),
    m.saisi && !m.transcriptionValidee ? h('p', null, pastille('transcription à valider', 'ambre')) : null,
    // Sans prévision ni groupe, aucun chiffre : un grand « 0 » laisserait croire à zéro portion.
    chiffrable ? h('p', { classe: 'portions' }, h('span', { classe: 'chiffre-grand' }, String(Math.round(p.total))), ' ', h('span', { classe: 'meta' }, p.total >= 2 ? 'portions' : 'portion')) : null,
    chiffrable ? h('p', { classe: 'meta' }, detailPortions(p)) : null,
    p.previsionManquante && (m.saisi || p.total > 0)
      ? h('p', { classe: 'alerte-texte alerte-icone' }, pictoAlerte(), h('span', null, 'Prévision hors groupes à saisir ', lien(`#/detail/${tb.jourService}`, 'Saisir la prévision')))
      : null);
}

function carteMenus(tb) {
  if (!tb.aMenu) return null;
  const memeJour = tb.jourService === tb.date;
  return h('section', { classe: 'carte', 'aria-labelledby': 'titre-menus' },
    h('h2', { classe: 'section-titre', id: 'titre-menus' }, memeJour ? 'Menus du jour' : `Menus du ${libelleJour(tb.jourService)}`),
    h('div', { classe: 'menus-grille' }, tb.menus.map((m) => blocMenu(m, tb))));
}

// ------------------------------------------------------------------ créneaux

const VARIANTE_CRENEAU = { libre: 'vert', charge: 'ambre', indisponible: 'rouge' };

function blocsCharge(points) {
  const n = Math.min(points, MAX_BLOCS);
  const blocs = [];
  for (let i = 0; i < n; i += 1) blocs.push(h('span', { classe: 'bloc-charge' }));
  return h('span', { classe: 'blocs-charge', 'aria-hidden': 'true' }, blocs, points > MAX_BLOCS ? '+' : null);
}

function ligneCreneau(c) {
  const ch = c.charge;
  const texte = c.nbTaches === 0 ? 'aucune tâche' : pluriel(c.nbTaches, 'tâche');
  return h('li', { classe: 'creneau' },
    h('div', { classe: 'creneau-tete' },
      h('strong', null, majuscule(libelle('CRENEAU', c.creneau))),
      pastille(libelle('ETAT_CRENEAU', c.etatCreneau), VARIANTE_CRENEAU[c.etatCreneau] ?? 'gris')),
    h('div', { classe: 'creneau-charge' }, blocsCharge(ch.points), h('span', null, texte),
      ch.nonEstimees > 0 ? h('span', { classe: 'meta' }, `dont ${ch.nonEstimees} sans charge estimée`) : null),
    ch.alertes.map((a) => h('p', { classe: 'alerte-texte' }, majuscule(a))));
}

function carteCreneaux(tb) {
  if (tb.creneaux.length === 0) return null;
  return h('section', { classe: 'carte', 'aria-labelledby': 'titre-creneaux' },
    h('h2', { classe: 'section-titre', id: 'titre-creneaux' }, 'Créneaux du jour'),
    h('ul', { classe: 'liste-creneaux' }, tb.creneaux.map(ligneCreneau)),
    h('p', { classe: 'aide' }, 'Un bloc par point de charge : courte 1, moyenne 2, longue 3.'));
}

// ------------------------------------------------------------------ à décider, à avancer

const MOTIF = {
  a_preciser: 'quantité à préciser',
  a_planifier: 'jour et créneau à décider',
  ecart: 'écart à arbitrer',
};

function carteDecisions(tb) {
  const n = tb.decisions.length;
  return h('section', { classe: 'carte', 'aria-labelledby': 'titre-decisions' },
    h('h2', { classe: 'section-titre', id: 'titre-decisions' }, 'À décider'),
    n === 0 ? ligneVide('Aucune décision en attente.') : h('ul', { classe: 'liste-lignes' }, tb.decisions.slice(0, MAX_DECISIONS).map((t) => h('li', null,
      lien(lienComposant(t.composantId), t.nom, 'ligne-nom'),
      h('p', { classe: 'meta' }, `${MOTIF[t.motif] ?? 'à décider'}, pour le ${libelleJour(t.dateService)}`)))),
    n > 0 ? h('p', null, lien(`#/jour/${tb.date}`, n === 1 ? 'Voir la décision' : `Voir les ${n} décisions`, 'lien-discret')) : null);
}

/** L'essentiel de l'évaluation d'une avance : « 2 jours d'avance, conservation à confirmer » ou « hors règle ». */
function texteAvance(ev) {
  const parties = [];
  if (!ev.autorisee) parties.push('hors règle');
  if (ev.jours !== null && ev.jours > 0) parties.push(`${pluriel(ev.jours, 'jour')} d'avance`);
  if (ev.conservation === 'a_confirmer') parties.push('conservation à confirmer');
  else if (ev.conservation === 'validee') parties.push('conservation validée');
  else if (ev.conservation === 'depassee') parties.push("limite d'utilisation dépassée");
  return parties.join(', ');
}

function carteAAvancer(tb, miseEnAvant) {
  const n = tb.aAvancer.length;
  return h('section', { classe: `carte${miseEnAvant ? ' carte-en-avant' : ''}`, 'aria-labelledby': 'titre-avancer' },
    h('h2', { classe: 'section-titre', id: 'titre-avancer' }, 'À avancer'),
    n === 0 ? ligneVide('Rien à avancer pour le moment.') : h('ul', { classe: 'liste-lignes' }, tb.aAvancer.slice(0, MAX_AVANCES).map((a) => h('li', null,
      lien(lienComposant(a.composantId), a.nom, 'ligne-nom'),
      h('p', { classe: 'meta' }, `${texteAvance(a.evaluation)}, pour le ${libelleJour(a.dateService)}`)))),
    n > 0 ? h('p', null, lien(`#/jour/${tb.date}`, n > MAX_AVANCES ? `Voir les ${n} tâches à avancer` : 'Voir la feuille du jour', 'lien-discret')) : null);
}

// ------------------------------------------------------------------ fiches, commandes

const SERVICE = { midi: 'service de midi', soir: 'service du soir' };

function ligneFiche(f, tb) {
  return h('li', null, h('a', { classe: 'ligne-fiche', href: `#/detail/${tb.jourService}` },
    h('strong', null, f.numero ? `Fiche ${f.numero}` : 'Fiche'),
    h('span', null, `${SERVICE[f.service] ?? f.service}, ${pluriel(Number(f.couverts) || 0, 'couvert')}${f.horaire ? `, ${f.horaire}` : ''}`),
    f.aAllergies ? h('span', { classe: 'etiquette-allergie' }, pictoAllergie(), 'allergie') : null));
}

function carteFiches(tb) {
  const memeJour = tb.jourService === tb.date;
  return h('section', { classe: 'carte', 'aria-labelledby': 'titre-fiches' },
    h('h2', { classe: 'section-titre', id: 'titre-fiches' }, memeJour ? 'Fiches du jour' : `Fiches du ${libelleJour(tb.jourService)}`),
    tb.fiches.length === 0 ? ligneVide('Aucune fiche de fonction ce jour-là.') : h('ul', { classe: 'liste-lignes' }, tb.fiches.map((f) => ligneFiche(f, tb))));
}

function lignesCommandes(c) {
  const lignes = [];
  const ligne = (n, texte) => { if (n > 0) lignes.push(`${n} ${texte}`); };
  ligne(c.aVerifier, 'à vérifier');
  ligne(c.aReverifier, 'à revérifier');
  ligne(c.aCommander, 'à commander');
  ligne(c.suffisant, c.suffisant >= 2 ? 'suffisants' : 'suffisant');
  ligne(c.echeanceAujourdhui, c.echeanceAujourdhui >= 2 ? "échéances de commande aujourd'hui" : "échéance de commande aujourd'hui");
  ligne(c.delaiARenseigner, c.delaiARenseigner >= 2 ? 'délais fournisseur à renseigner' : 'délai fournisseur à renseigner');
  ligne(c.nonChiffrables, c.nonChiffrables >= 2 ? 'non chiffrables, composition à définir' : 'non chiffrable, composition à définir');
  return lignes;
}

function carteCommandes(tb) {
  const c = tb.commandes;
  const lignes = lignesCommandes(c);
  return h('section', { classe: 'carte', 'aria-labelledby': 'titre-commandes' },
    h('h2', { classe: 'section-titre', id: 'titre-commandes' }, 'Commandes de la semaine'),
    c.echeanceDepassee > 0
      ? h('p', { classe: 'alerte-texte alerte-icone' }, pictoAlerte(), h('span', null, `${pluriel(c.echeanceDepassee, 'échéance')} de commande ${c.echeanceDepassee >= 2 ? 'dépassées' : 'dépassée'}`))
      : null,
    lignes.length === 0 ? ligneVide('Aucun besoin chiffré cette semaine.') : h('ul', { classe: 'liste-simple' }, lignes.map((t) => h('li', null, t))),
    h('p', null, lien(`#/produits/${lundiDe(tb.jourService)}`, 'Voir les produits', 'lien-discret')));
}

// ------------------------------------------------------------------ semaine

function caseJour(j) {
  const nom = libelleJour(j.date);
  const numero = String(Number(j.date.slice(8, 10)));
  const aria = [nom];
  if (j.estAujourdhui) aria.push("aujourd'hui");
  if (j.nbPoints > 0) aria.push(pluriel(j.nbPoints, 'point') + ' à confirmer');
  return h('a', {
    href: `#/detail/${j.date}`, classe: `case-jour${j.estAujourdhui ? ' case-aujourdhui' : ''}`, 'aria-label': aria.join(', '),
    'aria-current': j.estAujourdhui ? 'date' : null,
  },
  h('span', { classe: 'case-initiale' }, nom.charAt(0).toUpperCase()),
  h('span', { classe: 'case-numero' }, numero),
  j.nbPoints > 0 ? h('span', { classe: 'case-points' }, String(j.nbPoints)) : null);
}

function carteSemaine(tb) {
  const aDesPoints = tb.semaines.some((s) => s.jours.some((j) => j.nbPoints > 0));
  return h('section', { classe: 'carte carte-pleine', 'aria-labelledby': 'titre-semaine' },
    h('h2', { classe: 'section-titre', id: 'titre-semaine' }, 'La semaine'),
    tb.semaines.map((s, i) => h('div', { classe: 'bandeau-semaine' },
      h('h3', { classe: 'bloc-titre' }, i === 0 ? 'Cette semaine' : `Semaine du ${libelleJour(s.lundi)}`),
      h('div', { classe: 'bandeau-jours' }, s.jours.slice(0, 6).map(caseJour)))),
    aDesPoints ? h('p', { classe: 'aide' }, 'Le chiffre sur une case donne les points à confirmer ce jour-là.') : null);
}

// ------------------------------------------------------------------ vue

export function rendre(etat) {
  const aujourd = aujourdhui();
  const tb = tableauDeBord(etat, aujourd);
  const racine = h('div', { classe: 'vue vue-accueil' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, majuscule(libelleJour(tb.date))));
  racine.appendChild(tb.ferme
    ? h('p', { classe: 'ferme-annonce' }, `Fermé aujourd'hui. Prochain service : ${libelleJour(tb.jourService)}.`)
    : h('p', { classe: 'meta' }, tb.aMenu ? "Service d'aujourd'hui" : "Service d'aujourd'hui : pas de menu du jour le samedi."));
  for (const p of tb.pointsGlobaux) {
    racine.appendChild(encadre('alerte', p.texte, ' : ', lien('#/reglages', 'ouvrir les réglages')));
  }
  const samedi = !tb.ferme && !tb.aMenu;
  const grille = h('div', { classe: 'accueil-grille' });
  ajouter(grille, carteMiseEnPlace(tb));
  if (samedi) ajouter(grille, carteAAvancer(tb, true));
  ajouter(grille, carteMenus(tb));
  ajouter(grille, carteCreneaux(tb));
  ajouter(grille, carteDecisions(tb));
  if (!samedi) ajouter(grille, carteAAvancer(tb, false));
  ajouter(grille, carteFiches(tb));
  ajouter(grille, carteCommandes(tb));
  ajouter(grille, carteSemaine(tb));
  racine.appendChild(grille);
  return racine;
}
