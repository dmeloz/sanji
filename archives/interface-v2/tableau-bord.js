// Tableau de bord : une seule fonction pure qui assemble ce que l'écran d'accueil affiche.
// Elle ne contient aucune règle métier propre : elle appelle les fonctions du domaine et les met en forme.
// Ni DOM ni heure courante : la date du jour est un argument.

import { ajouterJours, aMenuDuJour, creneauxDuJour, datesDeLaSemaine, estOuvert, jourSemaine, lundiDe } from './dates.js';
import { portionsMenu } from './calcul.js';
import { jourOuVide } from './etat.js';
import { chargeCreneau, etatTache, evaluationProduction, feuilleDuJour } from './planification.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { besoinsProduits, echeanceCommande, suiviProduit } from './produits.js';

/** Ordre d'affichage de la réglette : ce qui demande une action d'abord, ce qui est prêt à la fin. */
export const ORDRE_SYMBOLES = Object.freeze(['a_decider', 'a_faire', 'en_cours', 'non_couvert', 'pret']);

const ETATS_A_DECIDER = new Set(['a_planifier', 'a_preciser', 'ecart']);
const STATUTS_A_COMMANDER = new Set(['a_commander', 'a_verifier', 'a_reverifier']);

/**
 * Décisions de la feuille du jour sans doublon : une tâche seulement « à planifier » déjà proposée dans
 * « À avancer si possible » n'est pas répétée dans les décisions.
 */
export function decisionsSansDoublon(feuille) {
  const aAvancer = new Set(feuille.aAvancer.map((a) => a.productionId));
  return feuille.decisions.filter((t) => !(t.motif === 'a_planifier' && aAvancer.has(t.productionId)));
}

/** Symbole de la réglette pour une tâche : pret, en_cours, a_faire, a_decider ou non_couvert. */
function symboleDe(etat, production, etatDeLaTache) {
  if (ETATS_A_DECIDER.has(etatDeLaTache)) return 'a_decider';
  if (etatDeLaTache === 'en_cours') return 'en_cours';
  if (etatDeLaTache === 'fait') {
    const evaluation = evaluationProduction(etat, production.id);
    return evaluation && !evaluation.couvre ? 'non_couvert' : 'pret';
  }
  return 'a_faire';
}

function miseEnPlace(etat, jourService) {
  const taches = [];
  for (const p of Object.values(etat.productions ?? {})) {
    if ((p.genre !== 'principale' && p.genre !== 'complement') || p.dateService !== jourService) continue;
    const composant = etat.composants?.[p.composantId];
    if (!composant) continue;
    const etatDeLaTache = etatTache(etat, p.id);
    taches.push({
      productionId: p.id, composantId: composant.id, nom: composant.nom, genre: p.genre,
      etat: etatDeLaTache, symbole: symboleDe(etat, p, etatDeLaTache),
    });
  }
  // Array.prototype.sort est stable : à rang égal, l'ordre des productions est conservé.
  taches.sort((a, b) => ORDRE_SYMBOLES.indexOf(a.symbole) - ORDRE_SYMBOLES.indexOf(b.symbole));
  const compte = Object.fromEntries(ORDRE_SYMBOLES.map((s) => [s, 0]));
  for (const t of taches) compte[t.symbole] += 1;
  compte.total = taches.length;
  return { taches, compte };
}

function creneaux(etat, aujourdhui) {
  return creneauxDuJour(aujourdhui).map((creneau) => {
    const charge = chargeCreneau(etat, aujourdhui, creneau);
    return {
      creneau, etatCreneau: charge.etatCreneau, charge,
      nbTaches: charge.courtes + charge.moyennes + charge.longues + charge.nonEstimees,
    };
  });
}

function fichesActives(etat, date) {
  return Object.values(etat.fiches ?? {})
    .filter((f) => f.statut === 'active' && f.date === date)
    .sort((a, b) => String(a.horaire).localeCompare(String(b.horaire)) || String(a.numero).localeCompare(String(b.numero)));
}

function commandes(etat, lundi, aujourdhui) {
  const { lignes, nonChiffrables } = besoinsProduits(etat, lundi);
  const res = {
    total: lignes.length, aVerifier: 0, aReverifier: 0, aCommander: 0, suffisant: 0,
    echeanceDepassee: 0, echeanceAujourdhui: 0, delaiARenseigner: 0, nonChiffrables: nonChiffrables.length,
  };
  for (const ligne of lignes) {
    const suivi = suiviProduit(etat, lundi, ligne);
    const statut = suivi.statutAffiche;
    if (statut === 'a_verifier') res.aVerifier += 1;
    else if (statut === 'a_reverifier') res.aReverifier += 1;
    else if (statut === 'a_commander') res.aCommander += 1;
    else if (statut === 'suffisant') res.suffisant += 1;
    if (!STATUTS_A_COMMANDER.has(statut)) continue;
    const fournisseur = suivi.fournisseurId ? etat.fournisseurs?.[suivi.fournisseurId] ?? null : null;
    const echeance = echeanceCommande(ligne, fournisseur, aujourdhui).statut;
    if (echeance === 'depassee') res.echeanceDepassee += 1;
    else if (echeance === 'aujourdhui') res.echeanceAujourdhui += 1;
    else if (echeance === 'a_renseigner') res.delaiARenseigner += 1;
  }
  return res;
}

function semaine(etat, lundi, aujourdhui) {
  return {
    lundi,
    jours: datesDeLaSemaine(lundi).map((date) => {
      const jour = jourOuVide(etat, date);
      return {
        date, ouvert: estOuvert(date), estAujourdhui: date === aujourdhui,
        nbPoints: pointsAConfirmer(etat, date).length,
        menusSaisis: [1, 2].filter((m) => String(jour.menus?.[m]?.intitule ?? '').trim() !== '').length,
        nbFiches: fichesActives(etat, date).length,
      };
    }),
  };
}

/**
 * Données du tableau de bord (voir conception, section 14).
 * `jourService` : aujourd'hui s'il est ouvert, sinon le prochain jour ouvert. Les menus, la mise en place, les
 * fiches et les commandes se rapportent au jour de service ; les créneaux, les décisions et les avances à aujourd'hui.
 * @param {object} etat
 * @param {string} aujourdhui AAAA-MM-JJ
 */
export function tableauDeBord(etat, aujourdhui) {
  const ferme = !estOuvert(aujourdhui);
  let jourService = aujourdhui;
  while (!estOuvert(jourService)) jourService = ajouterJours(jourService, 1);
  const aMenu = aMenuDuJour(jourService);
  const feuille = feuilleDuJour(etat, aujourdhui);
  const lundi = lundiDe(aujourdhui);
  const lundis = [lundi];
  if (jourSemaine(aujourdhui) === 5 || jourSemaine(aujourdhui) === 6) lundis.push(ajouterJours(lundi, 7));
  const jourDeService = jourOuVide(etat, jourService);
  return {
    date: aujourdhui,
    ferme,
    jourService,
    aMenu,
    menus: aMenu ? [1, 2].map((menu) => ({
      menu,
      intitule: jourDeService.menus[menu].intitule,
      saisi: jourDeService.menus[menu].intitule.trim() !== '',
      transcriptionValidee: jourDeService.menus[menu].transcriptionValidee,
      portions: portionsMenu(etat, jourService, menu),
    })) : [],
    miseEnPlace: miseEnPlace(etat, jourService),
    creneaux: creneaux(etat, aujourdhui),
    decisions: decisionsSansDoublon(feuille),
    aAvancer: feuille.aAvancer,
    attendus: feuille.attendus,
    fiches: fichesActives(etat, jourService).map((f) => ({
      id: f.id, numero: f.numero, service: f.service, horaire: f.horaire, couverts: f.couverts, mode: f.mode,
      aAllergies: String(f.allergies ?? '').trim() !== '',
    })),
    commandes: commandes(etat, lundiDe(jourService), aujourdhui),
    semaines: lundis.map((l) => semaine(etat, l, aujourdhui)),
    pointsGlobaux: pointsGlobaux(etat),
  };
}
