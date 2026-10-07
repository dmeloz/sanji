// Articles (onglet 4, refonte 2) : la liste simple des articles du poste entremétier, par jour et par menu, à cocher.
// Décision du 2026-10-07 « Onglet Articles sans gestion de stock » : ni restes, ni DLC, ni achats, pas de stock théorique.
// Choix Semaine / Aujourd'hui (gardé le temps de la session) et bouton « Partager la liste ». Aucune logique métier ici :
// la liste vient de `articlesDuPoste` (domaine/articles.js). Les anciennes vues vue-stock.js et vue-produits.js restent
// dans le code, masquées : aucune route ne les ouvre.

import { cocherArticle } from '../domaine/actions-articles.js';
import { articlesDuPoste } from '../domaine/articles.js';
import { estOuvert, libelleJour } from '../domaine/dates.js';
import { agir, aujourdhui, redessiner } from '../magasin.js';
import { jourOuVide } from '../domaine/etat.js';
import { h } from './dom.js';
import { bouton, ligneVide, lien } from './elements.js';
import { qteNoeuds, quantite } from './format.js';
import { afficherMessage } from './messages.js';

export function titre() { return 'Articles'; }

const VUES = [['semaine', 'Semaine'], ['jour', "Aujourd'hui"]];
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Vue choisie, gardée le temps de la session (un simple confort : rien n'est enregistré). */
let vueChoisie = 'semaine';

/** Oublie le choix de vue (retour à « Semaine ») : sert aux tests. */
export function oublierVue() { vueChoisie = 'semaine'; }

const titreJour = (j) => `${majuscule(libelleJour(j.date))}${j.estAujourdhui ? " · aujourd'hui" : ''}`;

/** La liste en texte simple, pour la partager : un jour par bloc, une ligne par article, les cases cochées marquées. */
export function texteDeLaListe(jours) {
  return jours.map((j) => [titreJour(j), ...j.articles.map((a) => {
    const q = a.quantite !== null ? ` · ${quantite(a.quantite, a.unite)}` : ' · à compléter';
    return `${a.coche ? '[x]' : '[ ]'} ${a.nom} (menu ${a.menu})${q}`;
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

/** Une ligne : case (un mot pour l'état, jamais la couleur seule), nom, « menu 1 · à compléter », quantité brute à droite. */
function ligneArticle(a) {
  const nomCase = `${a.coche ? 'Décocher' : 'Cocher'} : ${a.nom}`;
  const q = a.quantite !== null ? quantite(a.quantite, a.unite) : null;
  return h('li', { classe: `art-ligne${a.coche ? ' art-ligne-faite' : ''}` },
    h('button', {
      type: 'button', role: 'checkbox', 'aria-checked': a.coche ? 'true' : 'false', classe: `case-fait${a.coche ? ' case-fait-ok' : ''}`,
      onClick: () => agir((x, t) => cocherArticle(x, a.cle, !a.coche, t)),
    }, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }, a.coche ? '✓' : null), h('span', { classe: 'sr' }, nomCase)),
    h('span', { classe: 'art-texte' }, h('span', { classe: 'art-nom' }, a.nom), a.aCompleter ? h('span', { classe: 'au-sous' }, 'à compléter') : null),
    q ? h('span', { classe: 'au-qte art-qte' }, qteNoeuds(q))
      : h('span', { classe: 'au-neutre' }, '—', h('span', { classe: 'sr' }, ' quantité à compléter')));
}

/** Les articles d'un jour regroupés par menu (déjà triés par menu), sous « Menu N · intitulé du jour ». */
function groupesParMenu(etat, jour) {
  const { menus } = jourOuVide(etat, jour.date);
  return [1, 2].map((n) => {
    const articles = jour.articles.filter((a) => a.menu === n);
    if (articles.length === 0) return null;
    const intitule = String(menus?.[n]?.intitule ?? '').trim();
    return h('div', { classe: 'art-menu' },
      h('h3', { classe: 'art-menu-titre' }, intitule ? `Menu ${n} · ${intitule}` : `Menu ${n}`),
      h('ul', { classe: 'art-liste' }, articles.map(ligneArticle)));
  });
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
      h('p', { classe: 'au-date' }, `Semaine du ${libelleJour(lundi)} · pour le poste`),
      h('h1', { classe: 'au-titre' }, 'Articles')),
    selecteur(vueChoisie));
  if (visibles.length === 0) {
    racine.appendChild(ligneVide(jours.length === 0
      ? 'Aucun article pour le poste : les menus de la semaine ne sont pas saisis, ou rien n\'est attribué au poste.'
      : estOuvert(aujourd) ? "Rien pour le poste aujourd'hui." : "Fermé aujourd'hui : rien pour le poste."));
    if (jours.length === 0) racine.appendChild(h('p', null, lien(`#/import/${lundi}`, 'Saisir les menus de la semaine', 'btn btn-court')));
  }
  for (const j of visibles) {
    racine.appendChild(h('section', { classe: 'art-jour', 'aria-label': titreJour(j) },
      h('h2', { classe: 'au-etiquette' }, titreJour(j)),
      groupesParMenu(etat, j)));
  }
  racine.appendChild(h('p', { classe: 'au-sous' }, 'Quantités brutes calculées depuis les menus. Une quantité inconnue reste « à compléter », sans alerte.'));
  if (visibles.length > 0) {
    racine.appendChild(h('div', { classe: 'art-pouce pas-imprime' }, bouton('Partager la liste', () => partager(texteDeLaListe(visibles)), 'large')));
  }
  return racine;
}
