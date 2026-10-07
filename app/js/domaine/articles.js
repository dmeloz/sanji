// Articles du poste (onglet Articles, décision du 2026-10-07 « sans gestion de stock ») : la liste simple de ce que le poste entremétier
// utilise, par jour et par menu, lue dans les composants au poste. Même source que les besoins de produits (`besoinsProduits`) : aucune
// quantité n'est recalculée ici ; une quantité inconnue reste « à compléter » (jamais une alerte). Pas de stock, pas de DLC.

import { ajouterJours, estOuvert, lundiDe } from './dates.js';
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
 * Les articles du poste de la semaine du prochain jour ouvert, du jour à la fin de la semaine (du lundi au samedi).
 * @param {object} etat
 * @param {string} aujourd AAAA-MM-JJ
 * @returns {{lundi:string, jours:{date:string, estAujourdhui:boolean, articles:{cle:string, composantId:string, nom:string, menu:number,
 *   quantite:number|null, unite:string|null, aCompleter:boolean, coche:boolean}[]}[]}} seuls les jours qui ont des articles
 */
export function articlesDuPoste(etat, aujourd) {
  const depart = premierJourOuvert(aujourd);
  const lundi = lundiDe(depart);
  const { lignes, nonChiffrables } = besoinsProduits(etat, lundi);
  const coches = etat.articlesCoches ?? {};
  const parJour = new Map();
  const ajouter = (date, composantId, nom, quantite, unite) => {
    if (date < depart) return;
    const composant = etat.composants[composantId];
    if (estSauceAConfirmer(composant)) return; // la sauce implicite n'est pas encore choisie : ce n'est pas un article
    const cle = cleArticle(composantId, nom, unite);
    const article = {
      cle, composantId, nom, menu: composant.menu, quantite, unite, aCompleter: quantite === null, coche: Boolean(coches[cle]),
    };
    if (!parJour.has(date)) parJour.set(date, []);
    parJour.get(date).push(article);
  };
  for (const ligne of lignes) {
    for (const c of ligne.contributions) ajouter(c.date, c.composantId, ligne.nom, c.quantite, ligne.unite);
  }
  for (const n of nonChiffrables) ajouter(n.date, n.composantId, n.nom, null, null);
  const jours = [...parJour.keys()].sort().map((date) => ({
    date, estAujourdhui: date === aujourd,
    articles: parJour.get(date).sort((a, b) => a.menu - b.menu || a.nom.localeCompare(b.nom)),
  }));
  return { lundi, jours };
}
