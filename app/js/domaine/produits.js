// Besoins en produits de la semaine (lus par Articles). Une ligne est marquée « standard de base » si un standard de
// base y contribue (décision du 2026-10-04). Le suivi de commande a disparu (v121).

import { datesDeLaSemaine } from './dates.js';
import { calculerComposant } from './calcul.js';
import { normaliser } from './etat.js';

/**
 * Besoins de la semaine (services du lundi au samedi), agrégés par produit normalisé et unité, à partir des
 * composants attribués et validés. Les composants non chiffrables sont renvoyés à part, sans quantité inventée.
 * `aValider` : la ligne dépend d'une valeur de provenance inconnue (jamais commandable sans quantité tapée) ;
 * `standardBase` : au moins une contribution repose sur un standard de base.
 * @returns {{lignes:{cle:string, nom:string, unite:string, besoinBrut:number, aValider:boolean, standardBase:boolean,
 *   contributions:{composantId:string, date:string, quantite:number}[], premiereUtilisation:string}[],
 *   nonChiffrables:{composantId:string, nom:string, date:string, raison:string}[]}}
 */
export function besoinsProduits(etat, lundi) {
  const dates = new Set(datesDeLaSemaine(lundi).slice(0, 6));
  const parCle = new Map();
  const nonChiffrables = [];
  const composants = Object.values(etat.composants ?? {})
    .filter((c) => dates.has(c.date) && c.attribue && c.valide)
    .sort((a, b) => a.date.localeCompare(b.date) || a.menu - b.menu || a.nom.localeCompare(b.nom));
  const ajouter = (c, nom, unite, quantite, calc) => {
    const cle = normaliser(nom);
    const id = `${cle}|${unite}`;
    if (!parCle.has(id)) {
      parCle.set(id, { cle, nom, unite, besoinBrut: 0, aValider: false, standardBase: false, contributions: [], premiereUtilisation: c.date });
    }
    const ligne = parCle.get(id);
    ligne.besoinBrut += quantite;
    ligne.aValider = ligne.aValider || calc.aValider;
    ligne.standardBase = ligne.standardBase || Boolean(calc.standardBase);
    ligne.contributions.push({ composantId: c.id, date: c.date, quantite });
    if (c.date < ligne.premiereUtilisation) ligne.premiereUtilisation = c.date;
  };
  for (const c of composants) {
    const calc = calculerComposant(etat, c.id);
    if (calc.statut !== 'CALCULE') {
      nonChiffrables.push({ composantId: c.id, nom: c.nom, date: c.date, raison: `quantité inconnue (${calc.manquants.join(', ')})` });
    } else if (c.type === 'produit_simple') {
      ajouter(c, c.produitNom || c.nom, calc.uniteTravail, calc.brut, calc);
    } else if (c.type === 'preparation_maison' && calc.ingredients) {
      for (const i of calc.ingredients) ajouter(c, i.nom, i.unite, i.quantite, calc);
    } else {
      const raison = c.type === 'generique' ? 'composant générique : composition à définir'
        : 'préparation sans recette validée : commande détaillée impossible';
      nonChiffrables.push({ composantId: c.id, nom: c.nom, date: c.date, raison });
    }
  }
  const lignes = [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  return { lignes, nonChiffrables };
}
