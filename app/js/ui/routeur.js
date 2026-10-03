// Routeur par `location.hash` et redessin complet de la vue (position de défilement conservée).

import { estDateValide, lundiDe } from '../domaine/dates.js';
import { abonner, aujourdhui, etat, statutStockage } from '../magasin.js';
import { h, parId } from './dom.js';
import { maintenirAllume } from './ecran-allume.js';
import { encadre } from './elements.js';
import * as vueComposant from './vue-composant.js';
import * as vueDetail from './vue-detail.js';
import * as vueJour from './vue-jour.js';
import * as vueMenus from './vue-menus.js';
import * as vueProduits from './vue-produits.js';
import * as vueReglages from './vue-reglages.js';
import * as vueTableau from './vue-tableau.js';

export const VUES = { tableau: vueTableau, menus: vueMenus, detail: vueDetail, jour: vueJour, composant: vueComposant, produits: vueProduits, reglages: vueReglages };

/** Onglet actif selon la vue. */
export const ONGLET_DE_VUE = { tableau: 'tableau', menus: 'tableau', detail: 'tableau', jour: 'jour', composant: 'jour', produits: 'produits', reglages: 'reglages' };

/**
 * Analyse un hash (« #/tableau/2026-10-05 ») : { vue, param }. Fonction pure, sans DOM.
 * Défauts : le tableau blanc quand le hash est vide ou inconnu, sur la semaine que le contexte désigne (param null) ;
 * menus et produits = lundi de la semaine en cours ; jour et détail = aujourd'hui.
 * Les anciennes adresses « #/accueil » et « #/semaine/… » mènent au tableau.
 */
export function analyserHash(hash, aujourd) {
  const morceaux = String(hash ?? '').replace(/^#\/?/, '').split('/').filter((m) => m !== '');
  const vue = morceaux[0];
  const param = morceaux[1] ? decodeURIComponent(morceaux[1]) : null;
  const dateValide = param && estDateValide(param);
  if (vue === 'tableau' || vue === 'semaine') return { vue: 'tableau', param: dateValide ? lundiDe(param) : null };
  if (vue === 'menus' || vue === 'produits') return { vue, param: lundiDe(dateValide ? param : aujourd) };
  if (vue === 'jour' || vue === 'detail') return { vue, param: dateValide ? param : aujourd };
  if (vue === 'composant' && param) return { vue, param };
  if (vue === 'reglages') return { vue, param: null };
  return { vue: 'tableau', param: null };
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

/** Dessine la vue courante. Même vue et même paramètre : le défilement est conservé ; sinon retour en haut. */
export function rendre() {
  const racine = parId('vue');
  if (!racine) return;
  const { vue, param } = analyserHash(location.hash, aujourdhui());
  const cle = `${vue}/${param ?? ''}`;
  const defilement = cle === cleCourante ? window.scrollY : 0;
  let noeud;
  try {
    noeud = VUES[vue].rendre(etat(), param);
  } catch (erreur) {
    noeud = h('div', { classe: 'vue' }, encadre('erreur', `Cette page n'a pas pu s'afficher : ${erreur.message}`),
      h('p', null, h('a', { href: '#/tableau' }, 'Retour au tableau')));
  }
  racine.replaceChildren(noeud);
  const titreVue = parId('barre-titre');
  if (titreVue) titreVue.textContent = VUES[vue].titre(param);
  majOnglets(vue);
  maintenirAllume(vue === 'jour').catch(() => {});
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

