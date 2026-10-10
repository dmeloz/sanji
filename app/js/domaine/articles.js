// Articles du poste (onglet Articles, décision du 2026-10-07 « sans gestion de stock ») : la liste simple de ce que le poste entremétier
// utilise, par jour et par menu, lue dans les composants au poste. Même source que les besoins de produits (`besoinsProduits`) : aucune
// quantité n'est recalculée ici ; une quantité inconnue reste « à compléter » (jamais une alerte). Pas de stock, pas de DLC.

import { ajouterJours, estOuvert, lundiDe } from './dates.js';
import { jourDeProduction } from './planification.js';
import { besoinsProduits } from './produits.js';
import { estSauceAConfirmer, normaliser } from './etat.js';

/** Premier jour ouvert à partir de `date` (le dimanche est fermé : le lundi suivant). */
function premierJourOuvert(date) {
  let d = date;
  while (!estOuvert(d)) d = ajouterJours(d, 1);
  return d;
}

/** Clé d'une ligne cochable : le composant, l'article (nom normalisé) et son unité ; stable tant que les menus ne changent pas. */
export const cleArticle = (composantId, nom, unite = null) => `${composantId}|${normaliser(nom)}${unite ? `|${unite}` : ''}`;

/**
 * Les articles du poste, rangés au JOUR DE PRODUCTION de leur composant (avances comprises, `jourDeProduction`) : un composant à
 * servir lundi, avance autorisée, apparaît le samedi. Deux semaines sont lues (celle du prochain jour ouvert et la suivante) ;
 * un article reste sous le premier jour de production de son composant, jamais additionné à un autre plat.
 * @param {object} etat
 * @param {string} aujourd AAAA-MM-JJ
 * @returns {{lundi:string, jours:{date:string, estAujourdhui:boolean, services:string[], articles:{cle:string, composantId:string,
 *   nom:string, menu:number, dateService:string, quantite:number|null, unite:string|null, aCompleter:boolean,
 *   coche:boolean}[]}[]}} seuls les jours qui ont des articles
 */
export function articlesDuPoste(etat, aujourd) {
  const depart = premierJourOuvert(aujourd);
  const lundi = lundiDe(depart);
  const semaines = [besoinsProduits(etat, lundi), besoinsProduits(etat, ajouterJours(lundi, 7))];
  const coches = etat.articlesCoches ?? {};
  const jourParComposant = new Map();
  const parJour = new Map();
  const ajouter = (dateService, composantId, nom, quantite, unite) => {
    if (!jourParComposant.has(composantId)) jourParComposant.set(composantId, jourDeProduction(etat, composantId, depart));
    const jour = jourParComposant.get(composantId);
    if (!jour) return;
    const composant = etat.composants[composantId];
    if (estSauceAConfirmer(composant)) return; // la sauce implicite n'est pas encore choisie : ce n'est pas un article
    const cle = cleArticle(composantId, nom, unite);
    const article = {
      cle, composantId, nom, menu: composant.menu, dateService, quantite, unite,
      aCompleter: quantite === null, coche: Boolean(coches[cle]),
    };
    if (!parJour.has(jour.date)) parJour.set(jour.date, []);
    parJour.get(jour.date).push(article);
  };
  for (const { lignes, nonChiffrables } of semaines) {
    for (const ligne of lignes) {
      for (const c of ligne.contributions) ajouter(c.date, c.composantId, ligne.nom, c.quantite, ligne.unite);
    }
    for (const n of nonChiffrables) ajouter(n.date, n.composantId, n.nom, null, null);
  }
  const jours = [...parJour.keys()].sort().map((date) => {
    const articles = parJour.get(date).sort((a, b) => a.dateService.localeCompare(b.dateService) || a.menu - b.menu || a.nom.localeCompare(b.nom));
    return { date, estAujourdhui: date === aujourd, services: [...new Set(articles.map((x) => x.dateService))], articles };
  });
  return { lundi, jours };
}
