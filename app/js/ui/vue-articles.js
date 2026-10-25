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
import { activerFeuilletage } from './glisser.js';
import { bouton, etatVide, ligneVide, lien, pastille } from './elements.js';
import { qteNoeuds } from './format.js';
import { afficherMessage } from './messages.js';
import { feuilleChiffrage } from './vue-jour.js';

export function titre() { return 'Articles'; }

const VUES = [['semaine', 'Semaine'], ['jour', "Aujourd'hui"]];
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Vue choisie, gardée le temps de la session (un simple confort : rien n'est enregistré). */
let vueChoisie = 'semaine';
/** Jour de production affiché en vue « Aujourd'hui » après un glissement (null : aujourd'hui). Même durée de vie que `vueChoisie`. */
let jourGlisse = null;

/** Oublie le choix de vue (retour à « Semaine ») : sert aux tests. */
export function oublierVue() { vueChoisie = 'semaine'; jourGlisse = null; }

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

/** La liste en texte simple, pour la partager : un jour de production par bloc, une ligne par article NON coché (le reste est déjà fait). */
export function texteDeLaListe(jours) {
  const blocs = jours.map((j) => [titreJour(j), ...j.articles.filter((a) => !a.coche).map((a) => {
    const service = a.dateService === j.date ? `menu ${a.menu}` : `${jourCourt(a.dateService)} · menu ${a.menu}`;
    return `[ ] ${a.nom} (${service}) · ${texteQuantite(a) ?? 'à chiffrer'}`;
  })]).filter((lignes) => lignes.length > 1);
  return blocs.length === 0 ? 'Rien à commander.' : blocs.map((lignes) => lignes.join('\n')).join('\n\n');
}

/** Partage natif (iPhone) ; à défaut, copie dans le presse-papiers ; sinon un message. Annuler le partage n'est pas une erreur. */
async function partager(texte) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text: texte }); return; } // pas de `title` : iOS l'afficherait en plus du texte, qui commence déjà par son titre
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
      onClick: () => { vueChoisie = cle; jourGlisse = null; redessiner(); },
    }, texte)));
}

export function rendre(etat) {
  const aujourd = aujourdhui();
  const { lundi, jours } = articlesDuPoste(etat, aujourd);
  // Un jour glissé qui n'est plus dans la liste ou qui est passé (la liste a changé, un autre jour est venu) : retour à aujourd'hui.
  if (jourGlisse !== null && (jourGlisse < aujourd || !jours.some((j) => j.date === jourGlisse))) jourGlisse = null;
  const dateVue = jourGlisse ?? aujourd;
  const visibles = vueChoisie === 'jour' ? jours.filter((j) => j.date === dateVue) : jours;
  const racine = h('div', { classe: 'vue vue-articles' },
    h('header', { classe: 'art-entete' },
      h('p', { classe: 'au-date' }, 'À avoir pour chaque jour de production'),
      h('h1', { classe: 'au-titre' }, 'Articles')),
    selecteur(vueChoisie));
  if (visibles.length === 0) {
    racine.appendChild(jours.length === 0
      ? etatVide({
        titre: 'Aucun article sur les deux prochaines semaines', texte: 'La liste se remplit quand des éléments au poste sont prévus dans les menus.',
        actions: [{ libelle: 'Importer les menus', href: `#/import/${lundi}`, principal: true }],
      })
      : vueChoisie === 'jour'
        ? h('section', { classe: 'art-vide-aujourdhui', 'aria-labelledby': 'art-vide-aujourdhui-titre' },
          h('h2', { id: 'art-vide-aujourdhui-titre' }, 'Aucun article n’est prévu pour aujourd’hui'),
          h('p', null, estOuvert(aujourd)
            ? 'Les articles prévus pour les autres jours de production restent dans la vue Semaine.'
            : 'Le dimanche est fermé. Les prochains articles restent dans la vue Semaine.'),
          lien(`#/semaine/${lundi}/tableau`, 'Voir la semaine de production', 'btn btn-court'))
        : ligneVide(estOuvert(aujourd) ? "Rien pour le poste aujourd'hui." : "Fermé aujourd'hui : rien pour le poste."));
  }
  for (const j of visibles) {
    racine.appendChild(h('section', { classe: 'art-jour', 'aria-label': titreJour(j) },
      h('h2', { classe: 'au-etiquette' }, titreJour(j)),
      groupesParMenu(etat, j)));
  }
  // Vue « Aujourd'hui » : glisser passe au jour de production suivant ou précédent de la liste (jamais au-delà de ses bornes).
  const versJour = (voisin) => { if (vueChoisie === 'jour' && voisin) { jourGlisse = voisin.date; redessiner(); } };
  activerFeuilletage(racine, {
    suivant: () => versJour(jours.find((j) => j.date > dateVue)),
    precedent: () => versJour(jours.findLast((j) => j.date < dateVue)),
  });
  racine.appendChild(h('p', { classe: 'au-sous' }, 'Les quantités sont liées à la date de production. Une quantité inconnue reste « à chiffrer ».'));
  if (visibles.length > 0) {
    racine.appendChild(h('div', { classe: 'art-pouce pas-imprime' }, bouton('Partager la liste', () => partager(texteDeLaListe(visibles)), 'large')));
  }
  return racine;
}
