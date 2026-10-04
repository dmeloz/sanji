// Aujourd'hui (onglet 1, accueil), maquette « Main » de la refonte 1. La vue ne calcule rien : tout vient de
// `aujourdhuiDe(...)` (domaine/tableau-blanc.js). Couverts des menus 1 et 2 et des fiches avec leur certitude,
// carte « Maintenant » (prochaine tâche, « Fait » annulable), décisions en attente, à consommer en priorité,
// prochaine fiche de fonction. Les zones de l'ancien tableau (menus de la semaine, production et commandes,
// « À confirmer » détaillé) restent à une touche : liens vers Semaine et Production, repli « À confirmer ».
// Interface commune des vues : `titre(param, sous)` et `rendre(etat, param, sous)`.

import { libelleJour } from '../domaine/dates.js';
import { decisionsDe, texteDecisions } from '../domaine/decisions.js';
import { aujourdhuiDe } from '../domaine/tableau-blanc.js';
import { aujourdhui } from '../magasin.js';
import { h, svg } from './dom.js';
import { lien, repliable } from './elements.js';
import { ouvrirDecisions } from './feuille-decisions.js';
import { ouvrirProposition } from './feuille-validation.js';
import { abonnerHorsLigne, libelleHorsLigne, situationHorsLigne } from './horsligne.js';
import { phraseConservation, pluriel, qteNoeuds, quantite } from './format.js';
import { faireEnUnToucher } from './taches.js';

export function titre() { return "Aujourd'hui"; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const CERTITUDE = { estimee: 'estimée', provisoire: 'provisoire', confirmee: 'confirmée', hors_menu: 'hors menu' };
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;

// L'état « hors ligne » est connu après le rendu : la pastille courante se met à jour toute seule.
let pastilleCourante = null;
let texteCourant = null;
let abonnement = null;
function suivreHorsLigne(noeud, texte) {
  pastilleCourante = noeud;
  texteCourant = texte;
  abonnement ??= abonnerHorsLigne((s) => {
    if (texteCourant) texteCourant.textContent = libelleHorsLigne(s);
    if (pastilleCourante) pastilleCourante.dataset.pret = s.pret ? 'oui' : 'non';
  });
}

function icone(chemins, classe = 'au-icone') {
  return svg('svg', { classe, viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
  chemins.map((d) => svg('path', { d })));
}
const CHEVRON = ['M9 6l6 6-6 6'];

// ------------------------------------------------------------------ en-tête

function entete(donnees) {
  const texte = h('span', null, libelleHorsLigne());
  const pastille = h('p', { classe: 'au-hors-ligne', dataset: { pret: situationHorsLigne().pret ? 'oui' : 'non' } },
    h('span', { classe: 'au-point', 'aria-hidden': 'true' }), texte);
  suivreHorsLigne(pastille, texte);
  return h('header', { classe: 'au-tete' },
    h('p', { classe: 'au-date' }, majuscule(libelleJour(donnees.date))),
    h('h1', { classe: 'au-titre' }, "Aujourd'hui"),
    pastille);
}

// ------------------------------------------------------------------ couverts

function certitudes(liste, cle) {
  return liste.map((c) => h('span', { classe: `au-certitude au-certitude-${c.certitude}` },
    h('span', { classe: 'au-certitude-mot' }, CERTITUDE[c.certitude]), ' ', h('span', { classe: 'au-qte' }, String(c[cle]))));
}

function tuileMenu(m) {
  const nombre = m.couverts !== null
    ? [h('span', { classe: 'au-qte au-couverts' }, String(m.couverts)), h('span', { classe: 'au-unite' }, ' couv.')]
    : h('span', { classe: 'au-neutre' }, m.saisi ? 'prévision à saisir' : 'menu non saisi');
  return h('li', { classe: 'au-tuile', 'aria-label': `Menu ${m.menu}` },
    h('span', { classe: 'au-tuile-titre' }, `Menu ${m.menu}`), h('span', { classe: 'au-tuile-valeur' }, nombre),
    h('span', { classe: 'au-tuile-suite' }, certitudes(m.certitudes, 'portions')));
}

function tuileFiches(f) {
  return h('li', { classe: 'au-tuile', 'aria-label': 'Fiches de fonction' },
    h('span', { classe: 'au-tuile-titre' }, 'Fiches'),
    h('span', { classe: 'au-tuile-valeur' }, f.total !== null
      ? [h('span', { classe: 'au-qte au-couverts' }, String(f.total)), h('span', { classe: 'au-unite' }, ' couv.')]
      : h('span', { classe: 'au-neutre' }, 'aucune fiche')),
    h('span', { classe: 'au-tuile-suite' }, certitudes(f.certitudes, 'couverts')));
}

function zoneCouverts(d) {
  if (!d.ouvert) return null; // jour fermé : une seule mention, dans la carte « Maintenant »
  return h('ul', { classe: 'au-couverts-grille', 'aria-label': 'Couverts du jour' }, [...d.menus.map(tuileMenu), tuileFiches(d.fiches)]);
}

// ------------------------------------------------------------------ Maintenant

function destination(m, aujourd) {
  const pour = m.dateService === aujourd ? 'pour le service du jour' : `pour ${libelleJour(m.dateService)}`;
  return [pour, m.menu ? `menu ${m.menu}` : null].filter(Boolean).join(' · ');
}

function carteMaintenant(d, aujourd) {
  const m = d.maintenant;
  const { faites, total } = d.avancement;
  const q = m && m.genre !== 'preparatoire' ? (m.cible !== null ? quantite(m.cible, m.unite) : null) : null;
  const corps = [
    h('div', { classe: 'au-maintenant-tete' },
      h('h2', { classe: 'au-etiquette' }, 'Maintenant'),
      total > 0 ? h('span', { classe: 'au-jauge-texte' }, h('span', { classe: 'au-qte' }, `${faites} / ${total}`), ' faites') : null)];
  if (!m) {
    corps.push(h('p', { classe: 'au-maintenant-vide' }, !d.ouvert ? ["Fermé aujourd'hui", d.prochainOuvert ? ` · Prochaine production : ${libelleJour(d.prochainOuvert).split(' ').slice(0, 2).join(' ')}` : null]
      : total > 0 ? 'Tout est fait pour aujourd\'hui.' : 'Aucune tâche décidée pour aujourd\'hui.'));
  } else {
    corps.push(
      h('div', { classe: 'au-maintenant-ligne' },
        h('p', { classe: 'au-maintenant-nom' }, m.nom),
        q ? h('p', { classe: 'au-qte au-maintenant-qte' }, qteNoeuds(q)) : (m.genre === 'preparatoire' ? null : h('p', { classe: 'au-maintenant-neutre' }, 'quantité à compléter'))),
      h('p', { classe: 'au-maintenant-dest' }, destination(m, aujourd),
        m.horsRegle ? [' · ', h('strong', { classe: 'au-hors-regle' }, 'hors règle')] : null));
  }
  if (total > 0) {
    corps.push(h('progress', { classe: 'au-jauge', value: faites, max: total, 'aria-label': `${faites} sur ${total} faites` }));
  }
  if (m) {
    corps.push(h('div', { classe: 'au-maintenant-actions' },
      h('a', { href: `#/fiche/${encodeURIComponent(m.composantId)}`, classe: 'au-btn au-btn-clair' }, 'Ouvrir la fiche'),
      h('button', { type: 'button', classe: 'au-btn au-btn-contour', onClick: () => faireEnUnToucher(m.productionId),
        'aria-label': `Fait : ${m.nom}` }, 'Fait')));
  }
  return h('section', { classe: 'au-maintenant', 'aria-label': 'Maintenant' }, corps);
}

// ------------------------------------------------------------------ décisions en attente

/** Résumé du bandeau : un mot par genre de carte de la feuille, avec le nombre. */
const GENRE_EN_CLAIR = {
  ecart: ['écart à arbitrer', 'écarts à arbitrer'], avance_hors_regle: ['avance hors règle', 'avances hors règle'],
  sauce: ['sauce à confirmer', 'sauces à confirmer'], repartition: ['répartition provisoire', 'répartitions provisoires'],
  point: ['point à confirmer', 'points à confirmer'], apprentissage: ['proposition', 'propositions'],
  valeur: ['valeur à valider', 'valeurs à valider'],
};
function resumeDecisions(cartes) {
  const n = {};
  for (const c of cartes) n[c.genre] = (n[c.genre] ?? 0) + 1;
  return Object.keys(GENRE_EN_CLAIR).filter((g) => n[g]).map((g) => `${n[g]} ${GENRE_EN_CLAIR[g][n[g] > 1 ? 1 : 0]}`).join(' · ');
}

/** Le bandeau appelle la feuille « À décider » et compte avec la même source qu'elle (`decisionsDe`) ; le repli « À confirmer » de la page reste le détail (liens et propositions). */
function bandeauDecisions(feuille, repli) {
  const { total, cartes } = feuille;
  if (total === 0) return null;
  const surClic = () => {
    if (repli) repli.open = true;
    ouvrirDecisions();
  };
  return h('button', { type: 'button', classe: 'au-decisions', onClick: surClic },
    icone(['M12 3l10 18H2z', 'M12 10v5M12 18v.5']),
    h('span', { classe: 'au-decisions-texte' },
      h('span', { classe: 'au-decisions-titre' }, texteDecisions(total)),
      h('span', { classe: 'au-decisions-detail' }, resumeDecisions(cartes))),
    icone(CHEVRON, 'au-icone au-chevron'));
}

function ligneAConfirmer(l) {
  const contenu = [h('span', { classe: 'au-confirmer-mot' }, 'à décider'), h('span', { classe: 'au-confirmer-texte' }, l.texte,
    l.detail ? h('span', { classe: 'au-sous' }, l.detail) : null)];
  if (l.proposition) {
    return h('li', null, h('button', { type: 'button', classe: 'au-ligne au-ligne-bouton', onClick: () => ouvrirProposition(l.proposition) }, contenu));
  }
  return h('li', null, h('a', { href: l.lien, classe: 'au-ligne' }, contenu));
}

/** Détail des points « À confirmer » existants (3 lignes au plus, comme l'ancien tableau) : rien ne disparaît. */
function repliConfirmer(d) {
  const { total, lignes, reste } = d.decisions;
  if (total === 0) return null;
  return repliable(`À confirmer (${total})`, false, [
    h('ul', { classe: 'au-lignes' }, lignes.map(ligneAConfirmer)),
    reste > 0 ? h('p', { classe: 'au-sous' }, `et ${pluriel(reste, 'autre sujet', 'autres sujets')}, à voir sur le détail des jours`) : null,
  ], { classe: 'au-repli', id: 'bord-titre-confirmer' });
}

// ------------------------------------------------------------------ à consommer en priorité

function ligneAConsommer(l) {
  const alertes = [];
  if (l.horsRegle) alertes.push(h('strong', { classe: 'au-hors-regle' }, 'hors règle'));
  if (l.limiteDepassee) alertes.push(h('strong', { classe: 'au-hors-regle' }, 'limite maison dépassée'));
  const q = l.quantite !== null ? quantite(l.quantite, l.unite) : null;
  return h('li', { classe: 'au-conso' },
    h('a', { href: `#/fiche/${encodeURIComponent(l.composantId)}`, classe: 'au-conso-lien' },
      h('span', { classe: 'au-conso-corps' },
        h('span', { classe: 'au-conso-nom' }, l.nom),
        h('span', { classe: 'au-sous' }, [l.dateFait ? `faite ${courtJour(l.dateFait)}` : null, `pour ${courtJour(l.dateService)}`].filter(Boolean).join(' · '))),
      h('span', { classe: 'au-conso-droite' }, q ? h('span', { classe: 'au-qte' }, qteNoeuds(q)) : null,
        h('span', { classe: 'au-etiquette-statut' }, `avance J+${l.avanceJours}`))),
    alertes.length > 0 ? h('p', { classe: 'au-attention' }, alertes) : null,
    l.conservation ? h('p', { classe: 'au-attention' }, h('strong', null, phraseConservation(l.conservation.texte, l.avanceJours)), ' ',
      h('span', { classe: 'au-sous' }, l.conservation.provenance)) : null);
}

function zoneAConsommer(d) {
  const { total, lignes } = d.aConsommer;
  return h('section', { classe: 'au-carte', 'aria-labelledby': 'au-titre-conso' },
    h('div', { classe: 'au-carte-tete' },
      h('h2', { classe: 'au-etiquette', id: 'au-titre-conso' }, 'À consommer en priorité'),
      lien('#/stock/dlc', 'Tout voir', 'au-lien-court')),
    total === 0 ? h('p', { classe: 'au-neutre' }, 'Rien de fait à l\'avance pour un service à venir.')
      : h('ul', { classe: 'au-lignes' }, lignes.map(ligneAConsommer)));
}

// ------------------------------------------------------------------ prochaine fiche de fonction

function carteFiche(d, aujourd) {
  const f = d.prochaineFiche;
  if (!f) return null;
  const quand = f.date === aujourd ? "aujourd'hui" : libelleJour(f.date);
  const titreFiche = ['Fiche de fonction', quand, f.horaire || null, `${pluriel(f.couverts, 'pers.', 'pers.')}`].filter(Boolean).join(' · ');
  const statut = f.certitude ? CERTITUDE[f.certitude] : f.modeTexte;
  return h('a', { href: f.lien, classe: 'au-fiche', 'aria-label': `${titreFiche}, ouvrir le détail du jour` },
    h('span', { classe: 'au-fiche-corps' },
      h('span', { classe: 'au-fiche-titre' }, titreFiche),
      h('span', { classe: 'au-sous' },
        [f.numero ? `fiche ${f.numero}` : null, f.modeTexte || null].filter(Boolean).join(' · '),
        f.allergies ? [' · ', h('strong', { classe: 'au-allergie' }, 'allergies'), ` : ${f.allergies}`] : ' · aucune allergie notée',
        ' · ', h('strong', { classe: f.certitude ? 'au-statut-certitude' : 'au-statut' }, statut))),
    icone(CHEVRON, 'au-icone au-chevron'));
}

// ------------------------------------------------------------------ le reste de l'ancien tableau, à une touche

function zoneLiens(d, aujourd) {
  const p = d.production;
  const lignes = [];
  const { faites, total } = p.avancement;
  lignes.push(lien(`#/production/${aujourd}`, total > 0 ? `Production : ${faites}/${total} faites aujourd'hui` : 'Production du jour', 'au-ligne au-ligne-lien'));
  if (p.avances > 0) {
    lignes.push(lien(`#/production/${aujourd}`, `${pluriel(p.avances, 'avance possible', 'avances possibles')} après le service`, 'au-ligne au-ligne-lien'));
  }
  lignes.push(lien('#/semaine', 'Semaine : menus et fiches de fonction', 'au-ligne au-ligne-lien'));
  lignes.push(lien(`#/import/${d.lundi}`, d.semaineSansMenu ? 'Saisir les menus de la semaine' : 'Menus de la semaine', 'au-ligne au-ligne-lien'));
  if (p.commande) lignes.push(lien(p.commande.lien, p.commande.texte, 'au-ligne au-ligne-lien'));
  for (const l of p.chiffrage) lignes.push(lien(l.lien, l.detail ? `${l.texte} : ${l.detail}` : l.texte, 'au-ligne au-ligne-lien'));
  if (d.sauvegarde) lignes.push(lien(d.sauvegarde.lien, `${d.sauvegarde.texte} : ${d.sauvegarde.detail}`, 'au-ligne au-ligne-lien'));
  return h('nav', { classe: 'au-carte au-liens', 'aria-label': 'Semaine et production' },
    h('h2', { classe: 'au-etiquette' }, 'Semaine et production'), lignes);
}

// ------------------------------------------------------------------ page

export function rendre(etat) {
  const aujourd = aujourdhui();
  const donnees = aujourdhuiDe(etat, aujourd);
  const racine = h('div', { classe: 'vue vue-aujourdhui' });
  const repli = repliConfirmer(donnees);
  const morceaux = [entete(donnees), zoneCouverts(donnees), carteMaintenant(donnees, aujourd), bandeauDecisions(decisionsDe(etat, aujourd), repli),
    zoneAConsommer(donnees), carteFiche(donnees, aujourd), zoneLiens(donnees, aujourd), repli];
  for (const m of morceaux) if (m) racine.appendChild(m);
  return racine;
}
