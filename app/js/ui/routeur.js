// Routeur par `location.hash` et redessin complet de la vue (position de défilement conservée).

import { estDateValide, lundiDe } from '../domaine/dates.js';
import { abonner, aujourdhui, etat, statutStockage } from '../magasin.js';
import { h, parId } from './dom.js';
import { maintenirAllume } from './ecran-allume.js';
import { encadre } from './elements.js';
import * as vueAujourdhui from './vue-aujourdhui.js';
import * as vueArticles from './vue-articles.js';
import * as vueFiche from './vue-fiche.js';
import * as vueHistorique from './vue-historique.js';
import * as vueImport from './vue-import.js';
import * as vuePoste from './vue-poste.js';
import * as vueProduction from './vue-production.js';
import * as vueReglages from './vue-reglages.js';
import * as vueSemaine from './vue-semaine.js';

export const VUES = {
  aujourdhui: vueAujourdhui, production: vueProduction, semaine: vueSemaine, articles: vueArticles,
  fiche: vueFiche, poste: vuePoste, import: vueImport, reglages: vueReglages, historique: vueHistorique,
};

/** Onglet actif selon la vue. Réglages n'a plus d'onglet : il s'ouvre depuis Aujourd'hui, dont l'onglet reste marqué. */
export const ONGLET_DE_VUE = {
  aujourdhui: 'aujourdhui', reglages: 'aujourdhui', production: 'production', fiche: 'production', poste: 'production',
  semaine: 'semaine', import: 'semaine', historique: 'semaine', articles: 'articles',
};

/**
 * Analyse un hash (« #/production/2026-10-05 ») : { vue, param, sous? }. Fonction pure, sans DOM.
 * Adresses : #/aujourdhui (accueil, défaut), #/production[/date], #/semaine[/date[/tableau]], #/articles,
 * #/fiche/<composantId>, #/poste/<composantId>, #/import[/date], #/reglages[/rubrique], #/historique.
 * Défauts : production = aujourd'hui ; import = lundi de la semaine donnée ou en cours ; articles : aucun paramètre ; semaine sans date = tableau de la semaine (param null), avec date = détail du jour,
 * « /tableau » en plus = tableau de cette semaine (ramenée au lundi). Une adresse inconnue, ou fiche/poste sans identifiant, mène à l'accueil.
 * Réglages : une clé de rubrique inconnue donne la racine.
 * Anciennes adresses, redirigées pour les favoris : #/accueil et #/tableau → aujourdhui (#/tableau/<date> → tableau de la semaine),
 * #/jour/<d> → production/<d>, #/stock[/…] et #/produits[/…] → articles (Restes, DLC et Achats sont masqués, décision du 2026-10-07), #/detail/<d> → semaine/<d>,
 * #/composant/<id> → fiche/<id>, #/menus/<d> → import/<d>.
 */
/** Décode un morceau d'adresse ; une adresse mal formée (« %E0 ») vaut « absent » au lieu de faire échouer le routeur. */
function decoder(morceau) {
  try { return decodeURIComponent(morceau); } catch { return null; }
}

export function analyserHash(hash, aujourd) {
  const morceaux = String(hash ?? '').replace(/^#\/?/, '').split('/').filter((m) => m !== '');
  const vue = morceaux[0];
  const param = morceaux[1] ? decoder(morceaux[1]) : null;
  const dateValide = param && estDateValide(param);
  if (vue === 'production' || vue === 'jour') return { vue: 'production', param: dateValide ? param : aujourd };
  if (vue === 'semaine') {
    if (!dateValide) return { vue: 'semaine', param: null };
    return morceaux[2] === 'tableau' ? { vue: 'semaine', param: lundiDe(param), sous: 'tableau' } : { vue: 'semaine', param };
  }
  if (vue === 'detail') return { vue: 'semaine', param: dateValide ? param : aujourd };
  if (vue === 'tableau' && dateValide) return { vue: 'semaine', param: lundiDe(param), sous: 'tableau' };
  if (vue === 'import' || vue === 'menus') return { vue: 'import', param: lundiDe(dateValide ? param : aujourd) };
  if (vue === 'articles' || vue === 'stock' || vue === 'produits') return { vue: 'articles', param: null };
  if ((vue === 'fiche' || vue === 'composant') && param) return { vue: 'fiche', param };
  if (vue === 'historique') return { vue, param: null };
  if (vue === 'poste' && param) return { vue: 'poste', param };
  if (vue === 'reglages') return { vue, param: vueReglages.CLES_RUBRIQUES.includes(morceaux[1]) ? morceaux[1] : null };
  return { vue: 'aujourdhui', param: null };
}

let cleCourante = null;

function dessinerBandeaux() {
  const zone = parId('bandeaux');
  if (!zone) return;
  const s = statutStockage();
  zone.replaceChildren(...(s.enregistre ? [] : [
    encadre('erreur', h('strong', null, 'Données non enregistrées sur cet appareil.'), ` Vous pouvez travailler, mais tout sera perdu à la fermeture${s.raison ? ` (${s.raison})` : ''}. Pensez à exporter une sauvegarde (Réglages).`),
  ]));
}

function majOnglets(vue) {
  const actif = ONGLET_DE_VUE[vue];
  for (const a of document.querySelectorAll('#onglets a')) {
    if (a.dataset.onglet === actif) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/** Ferme les dialogues ouverts (leur fermeture nettoie leurs abonnements et rend le focus). */
function fermerPanneaux() {
  const zone = parId('panneaux');
  for (const d of zone?.querySelectorAll?.('dialog[open]') ?? []) d.close();
}

/** Dessine la vue courante. Même vue et même paramètre : le défilement est conservé ; sinon retour en haut. */
export function rendre() {
  const racine = parId('vue');
  if (!racine) return;
  const { vue, param, sous } = analyserHash(location.hash, aujourdhui());
  const cle = `${vue}/${sous ?? ''}/${param ?? ''}`;
  const defilement = cle === cleCourante ? window.scrollY : 0;
  // Changement de page : un dialogue resté ouvert (fiche, saisie, « À décider ») ne suit pas dans la nouvelle page.
  if (cle !== cleCourante) fermerPanneaux();
  let noeud;
  try {
    noeud = VUES[vue].rendre(etat(), param, sous);
  } catch (erreur) {
    noeud = h('div', { classe: 'vue' }, encadre('erreur', `Cette page n'a pas pu s'afficher : ${erreur.message}`),
      h('p', null, h('a', { href: '#/aujourdhui' }, "Retour à Aujourd'hui")));
  }
  racine.replaceChildren(noeud);
  const titrePage = VUES[vue].titre(param, sous);
  document.title = `${titrePage} — Sanji`;
  // Vraie nouvelle page (pas un simple redessin) : le focus passe au contenu, pour le clavier et VoiceOver.
  if (cleCourante !== null && cle !== cleCourante) racine.focus?.({ preventScroll: true });
  majOnglets(vue);
  maintenirAllume(vue === 'production' || vue === 'poste').catch(() => {});
  dessinerBandeaux();
  window.scrollTo(0, defilement);
  cleCourante = cle;
}

/** Branche le routeur : changement de hash et changement d'état. */
export function demarrerRouteur() {
  window.addEventListener('hashchange', rendre);
  abonner(rendre);
  rendre();
}

