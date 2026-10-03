// Besoins en produits et suivi de la commande. Trois quantités restent séparées :
// besoin brut calculé, quantité vérifiée disponible, quantité proposée à commander.
// Aucune estimation n'est jamais transformée en commande : `quantiteAcheter` est toujours saisie à la main.

import { ajouterJours, datesDeLaSemaine } from './dates.js';
import { calculerComposant } from './calcul.js';
import { normaliser, suiviProduitVide } from './etat.js';

/** Clé de suivi dans `etat.produits` : lundi|cle|unite. */
export function cleSuivi(lundi, cle, unite) {
  return `${lundi}|${cle}|${unite}`;
}

/**
 * Besoins de la semaine (services du lundi au samedi), agrégés par produit normalisé et unité, à partir des
 * composants attribués et validés. Les composants non chiffrables sont renvoyés à part, sans quantité inventée.
 * @returns {{lignes:{cle:string, nom:string, unite:string, besoinBrut:number, aValider:boolean,
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
  const ajouter = (c, nom, unite, quantite, aValider) => {
    const cle = normaliser(nom);
    const id = `${cle}|${unite}`;
    if (!parCle.has(id)) {
      parCle.set(id, { cle, nom, unite, besoinBrut: 0, aValider: false, contributions: [], premiereUtilisation: c.date });
    }
    const ligne = parCle.get(id);
    ligne.besoinBrut += quantite;
    ligne.aValider = ligne.aValider || aValider;
    ligne.contributions.push({ composantId: c.id, date: c.date, quantite });
    if (c.date < ligne.premiereUtilisation) ligne.premiereUtilisation = c.date;
  };
  for (const c of composants) {
    const calc = calculerComposant(etat, c.id);
    if (calc.statut !== 'CALCULE') {
      nonChiffrables.push({ composantId: c.id, nom: c.nom, date: c.date, raison: `quantité inconnue (${calc.manquants.join(', ')})` });
    } else if (c.type === 'produit_simple') {
      ajouter(c, c.produitNom || c.nom, calc.uniteTravail, calc.brut, calc.aValider);
    } else if (c.type === 'preparation_maison' && calc.ingredients) {
      for (const i of calc.ingredients) ajouter(c, i.nom, i.unite, i.quantite, calc.aValider);
    } else {
      const raison = c.type === 'generique' ? 'composant générique : composition à définir'
        : 'préparation sans recette validée : commande détaillée impossible';
      nonChiffrables.push({ composantId: c.id, nom: c.nom, date: c.date, raison });
    }
  }
  const lignes = [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  return { lignes, nonChiffrables };
}

/**
 * Suivi d'une ligne de besoin. `a_reverifier` si un contrôle a été fait et que le besoin a changé depuis
 * (comparaison arrondie à l'unité). `proposeeACommander` n'existe qu'après une vérification chiffrée ;
 * `quantiteAcheter` n'est jamais remplie automatiquement.
 */
export function suiviProduit(etat, lundi, ligne) {
  const suivi = { ...suiviProduitVide(), ...(etat.produits?.[cleSuivi(lundi, ligne.cle, ligne.unite)] ?? {}) };
  const besoinChange = !Number.isFinite(suivi.besoinAuControle)
    || Math.round(suivi.besoinAuControle) !== Math.round(ligne.besoinBrut);
  const statutAffiche = suivi.statut !== 'a_verifier' && besoinChange ? 'a_reverifier' : suivi.statut;
  // La marge de sécurité ne majore que la quantité proposée, après vérification : ni le besoin ni l'achat.
  const margePourcent = Number.isInteger(etat.reglages?.margeSecurite) ? etat.reglages.margeSecurite : null;
  const besoinMajore = Math.round(ligne.besoinBrut * (1 + (margePourcent ?? 0) / 100));
  const proposeeACommander = Number.isFinite(suivi.quantiteVerifiee)
    ? Math.max(0, besoinMajore - Math.round(suivi.quantiteVerifiee)) : null;
  // « À relire » : la ligne est notée et le besoin a changé depuis. La quantité notée n'est jamais modifiée.
  const aRelire = suivi.etatLigne === 'note'
    && (!Number.isFinite(suivi.besoinAuNote) || Math.round(suivi.besoinAuNote) !== Math.round(ligne.besoinBrut));
  return {
    etatLigne: suivi.etatLigne, besoinAuNote: suivi.besoinAuNote, historique: suivi.historique, aRelire,
    statutAffiche, statut: suivi.statut, besoinBrut: ligne.besoinBrut, besoinAuControle: suivi.besoinAuControle,
    quantiteVerifiee: suivi.quantiteVerifiee, proposeeACommander, margePourcent, estimationAValider: ligne.aValider,
    quantiteAcheter: suivi.quantiteAcheter, conditionnement: suivi.conditionnement,
    fournisseurId: suivi.fournisseurId, commandeLe: suivi.commandeLe,
  };
}

/**
 * Échéance de commande : dateLimite = première utilisation − délai du fournisseur (jours calendaires).
 * @returns {{statut:'a_renseigner'|'ok'|'aujourdhui'|'depassee', dateLimite:string|null}}
 */
export function echeanceCommande(ligne, fournisseur, aujourdhui) {
  if (!fournisseur || !Number.isFinite(fournisseur.delaiJours)) return { statut: 'a_renseigner', dateLimite: null };
  const dateLimite = ajouterJours(ligne.premiereUtilisation, -fournisseur.delaiJours);
  const statut = aujourdhui > dateLimite ? 'depassee' : aujourdhui === dateLimite ? 'aujourdhui' : 'ok';
  return { statut, dateLimite };
}
