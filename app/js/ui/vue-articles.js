// Articles (onglet 4, refonte 2) : la liste simple des articles du poste entremétier, par jour et par menu, à cocher.
// Décision du 2026-10-07 « Onglet Articles sans gestion de stock » : ni restes, ni DLC, ni achats, pas de stock théorique.
// Une section par JOUR DE PRODUCTION (avances comprises) : « Samedi 10 octobre · pour lundi 12 ». Choix Semaine / Aujourd'hui
// (gardé le temps de la session) et bouton « Partager la liste ». Aucune logique métier ici : la liste vient de
// `articlesDuPoste` (domaine/articles.js). Les anciennes vues Stock et Produits ont été supprimées (v120).

import { cocherArticle } from '../domaine/actions-articles.js';
import { articlesDuPoste } from '../domaine/articles.js';
import { estOuvert, libelleJour } from '../domaine/dates.js';
import { agir, aujourdhui, redessiner } from '../magasin.js';
import { jourOuVide } from '../domaine/etat.js';
import { quantiteEnPoids, raisonNonChiffree } from '../domaine/mise-en-place.js';
import { h } from './dom.js';
import { bouton, etatVide, ligneVide, lien, pastille } from './elements.js';
import { qteNoeuds } from './format.js';
import { afficherMessage } from './messages.js';
import { feuilleChiffrage } from './vue-jour.js';

export function titre() { return 'Articles'; }

const VUES = [['semaine', 'Semaine'], ['jour', "Aujourd'hui"]];
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Vue choisie, gardée le temps de la session (un simple confort : rien n'est enregistré). */
let vueChoisie = 'semaine';

/** Oublie le choix de vue (retour à « Semaine ») : sert aux tests. */
export function oublierVue() { vueChoisie = 'semaine'; }

/** « lundi 12 » : le jour et son quantième, sans le mois. */
const jourCourt = (date) => libelleJour(date).split(' ').slice(0, 2).join(' ');
const listeServices = (dates) => (dates.length > 1 ? `${dates.slice(0, -1).map(jourCourt).join(', ')} et ${jourCourt(dates.at(-1))}` : jourCourt(dates[0]));

/** « Samedi 10 octobre · pour lundi 12 » ; « Mardi 13 octobre · aujourd'hui » quand le service est le jour même. */
function titreJour(j) {
  const pour = j.services.filter((d) => d !== j.date);
  return [majuscule(libelleJour(j.date)), j.estAujourdhui ? "aujourd'hui" : null, pour.length > 0 ? `pour ${listeServices(pour)}` : null]
    .filter(Boolean).join(' · ');
}

/** Quantité en g ou kg comme Production, ou null si elle est inconnue. */
const texteQuantite = (a) => (a.quantite !== null ? quantiteEnPoids(a.quantite, a.unite) : null);

/** La liste en texte simple, pour la partager : un jour de production par bloc, une ligne par article, les cases cochées marquées. */
export function texteDeLaListe(jours) {
  return jours.map((j) => [titreJour(j), ...j.articles.map((a) => {
    const service = a.dateService === j.date ? `menu ${a.menu}` : `${jourCourt(a.dateService)} · menu ${a.menu}`;
    return `${a.coche ? '[x]' : '[ ]'} ${a.nom} (${service}) · ${texteQuantite(a) ?? 'à chiffrer'}`;
  })].join('\n')).join('\n\n');
}

/** Partage natif (iPhone) ; à défaut, copie dans le presse-papiers ; sinon un message. Annuler le partage n'est pas une erreur. */
async function partager(texte) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title: 'Articles du poste', text: texte }); return; }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      afficherMessage('Liste copiée.', 'ok');
      return;
    }
    afficherMessage('Le partage n\'est pas disponible sur cet appareil.', 'erreur');
  } catch (erreur) {
    if (erreur?.name !== 'AbortError') afficherMessage(`Partage impossible : ${erreur?.message ?? erreur}`, 'erreur');
  }
}

/** Étiquette « à chiffrer » (icône + mot) : un toucher ouvre la feuille de la raison ; sans raison connue, un lien « Préciser » vers la fiche. */
function quantiteInconnue(etat, a) {
  const raison = raisonNonChiffree(etat, { composantId: a.composantId, genre: 'principale', cible: null });
  if (!raison) return lien(`#/fiche/${encodeURIComponent(a.composantId)}`, 'Préciser', 'lien art-preciser');
  return h('button', {
    type: 'button', classe: 'prod-asaisir', 'aria-label': `${a.nom} : à chiffrer`,
    onClick: () => feuilleChiffrage(etat, { composantId: a.composantId, genre: 'principale', cible: null }, a.nom, raison),
  }, pastille('à chiffrer', 'ambre'));
}

/** Une ligne : case (un mot pour l'état, jamais la couleur seule), nom, quantité en g ou kg à droite ou « à chiffrer ». */
function ligneArticle(etat, a) {
  const nomCase = `${a.coche ? 'Décocher' : 'Cocher'} : ${a.nom}`;
  const q = texteQuantite(a);
  return h('li', { classe: `art-ligne${a.coche ? ' art-ligne-faite' : ''}` },
    h('button', {
      type: 'button', role: 'checkbox', 'aria-checked': a.coche ? 'true' : 'false', classe: `case-fait${a.coche ? ' case-fait-ok' : ''}`,
      onClick: () => agir((x, t) => cocherArticle(x, a.cle, !a.coche, t)),
    }, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }, a.coche ? '✓' : null), h('span', { classe: 'sr' }, nomCase)),
    h('span', { classe: 'art-texte' }, h('span', { classe: 'art-nom' }, a.nom)),
    q ? h('span', { classe: 'au-qte art-qte' }, qteNoeuds(q)) : quantiteInconnue(etat, a));
}

/** Les articles d'un jour de production regroupés par service puis par menu, sous « [Lundi 12 · ]Menu N · intitulé du service ». */
function groupesParMenu(etat, jour) {
  return jour.services.flatMap((service) => [1, 2].map((n) => {
    const articles = jour.articles.filter((a) => a.dateService === service && a.menu === n);
    if (articles.length === 0) return null;
    const intitule = String(jourOuVide(etat, service).menus?.[n]?.intitule ?? '').trim();
    const titreMenu = `${service === jour.date ? '' : `${majuscule(jourCourt(service))} · `}Menu ${n}${intitule ? ` · ${intitule}` : ''}`;
    return h('div', { classe: 'art-menu' },
      h('h3', { classe: 'art-menu-titre' }, titreMenu),
      h('ul', { classe: 'art-liste' }, articles.map((a) => ligneArticle(etat, a))));
  }));
}

function selecteur(vue) {
  return h('div', { classe: 'art-segments', role: 'group', 'aria-label': 'Période' },
    VUES.map(([cle, texte]) => h('button', {
      type: 'button', classe: `stock-segment${cle === vue ? ' stock-segment-actif' : ''}`, 'aria-pressed': cle === vue ? 'true' : 'false',
      onClick: () => { vueChoisie = cle; redessiner(); },
    }, texte)));
}

export function rendre(etat) {
  const aujourd = aujourdhui();
  const { lundi, jours } = articlesDuPoste(etat, aujourd);
  const visibles = vueChoisie === 'jour' ? jours.filter((j) => j.estAujourdhui) : jours;
  const racine = h('div', { classe: 'vue vue-articles' },
    h('header', { classe: 'art-entete' },
      h('p', { classe: 'au-date' }, 'À avoir pour chaque jour de production'),
      h('h1', { classe: 'au-titre' }, 'Articles')),
    selecteur(vueChoisie));
  if (visibles.length === 0) {
    racine.appendChild(jours.length === 0
      ? etatVide({
        titre: 'Aucun article pour l\'instant', texte: 'La liste se remplit dès que les menus de la semaine sont importés.',
        actions: [{ libelle: 'Importer les menus', href: `#/import/${lundi}`, principal: true }],
      })
      : ligneVide(estOuvert(aujourd) ? "Rien pour le poste aujourd'hui." : "Fermé aujourd'hui : rien pour le poste."));
  }
  for (const j of visibles) {
    racine.appendChild(h('section', { classe: 'art-jour', 'aria-label': titreJour(j) },
      h('h2', { classe: 'au-etiquette' }, titreJour(j)),
      groupesParMenu(etat, j)));
  }
  racine.appendChild(h('p', { classe: 'au-sous' }, 'Quantités brutes calculées depuis les menus. Une quantité inconnue reste « à chiffrer », sans alerte.'));
  if (visibles.length > 0) {
    racine.appendChild(h('div', { classe: 'art-pouce pas-imprime' }, bouton('Partager la liste', () => partager(texteDeLaListe(visibles)), 'large')));
  }
  return racine;
}
