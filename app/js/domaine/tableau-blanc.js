// Tableau blanc : ce que l'écran d'accueil affiche, et la note du contexte (« que dois-je savoir maintenant »).
// Aucune règle métier propre : le module assemble les fonctions du domaine. Ni DOM ni heure courante.

import { proposerComposants } from './analyse-menu.js';
import { calculerComposant, formaterQuantite, portionsMenu } from './calcul.js';
import { ajouterJours, aMenuDuJour, estOuvert, jourSemaine, libelleJour, lundiDe } from './dates.js';
import { jourOuVide, normaliser } from './etat.js';
import { avancesPossibles, cibleProduction, etatTache, evaluationProduction, feuilleDuJour } from './planification.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { cleStandardGroupe, grammageEffectif, lignesStandards, lignesStandardsGroupes } from './savoir.js';

/** Ordre d'affichage d'une mise en place : ce qui demande une action d'abord, ce qui est prêt à la fin. */
export const ORDRE_SYMBOLES = Object.freeze(['a_decider', 'a_faire', 'en_cours', 'non_couvert', 'pret']);

const LIGNES_MAX = 6;
// Points déjà dits une fois dans la note du contexte : ils ne sont pas répétés jour par jour sur le tableau.
const POINTS_DITS_DANS_LA_NOTE = new Set(['grammage', 'prevision_manquante']);

/**
 * Décisions de la feuille du jour sans doublon : une tâche seulement « à planifier » déjà proposée dans
 * « À avancer si possible » n'est pas répétée dans les décisions.
 */
export function decisionsSansDoublon(feuille) {
  const aAvancer = new Set(feuille.aAvancer.map((a) => a.productionId));
  return feuille.decisions.filter((t) => !(t.motif === 'a_planifier' && aAvancer.has(t.productionId)));
}

/**
 * Symbole d'une tâche. Seul un écart à arbitrer est « à décider » : une tâche pas encore planifiée ou sans
 * quantité reste « à faire », l'application ne demande pas de décision pour cela.
 */
function symboleDe(etat, production, etatDeLaTache) {
  if (etatDeLaTache === 'ecart') return 'a_decider';
  if (etatDeLaTache === 'en_cours') return 'en_cours';
  if (etatDeLaTache === 'fait') {
    const evaluation = evaluationProduction(etat, production.id);
    return evaluation && !evaluation.couvre ? 'non_couvert' : 'pret';
  }
  return 'a_faire';
}

/** Quantité affichée d'une tâche : le réel si elle est faite, sinon la cible ; null si rien n'est calculable. */
function quantiteDe(etat, production) {
  const unite = production.unite ?? calculerComposant(etat, production.composantId).uniteTravail;
  if (production.etat === 'fait' && Number.isFinite(production.quantiteReelle)) return formaterQuantite(production.quantiteReelle, unite);
  const cible = cibleProduction(etat, production.id);
  return Number.isFinite(cible) && unite ? formaterQuantite(cible, unite) : null;
}

/** Tâches (productions principales et compléments) dont le service est ce jour-là. */
function miseEnPlace(etat, date) {
  const taches = [];
  for (const p of Object.values(etat.productions ?? {})) {
    if ((p.genre !== 'principale' && p.genre !== 'complement') || p.dateService !== date) continue;
    const composant = etat.composants?.[p.composantId];
    if (!composant) continue;
    const etatDeLaTache = etatTache(etat, p.id);
    taches.push({
      productionId: p.id, composantId: composant.id, genre: p.genre,
      nom: p.genre === 'complement' ? `Complément : ${composant.nom}` : composant.nom,
      quantite: quantiteDe(etat, p), etat: etatDeLaTache, symbole: symboleDe(etat, p, etatDeLaTache),
      planifiee: Boolean(p.jourDecide),
    });
  }
  taches.sort((a, b) => ORDRE_SYMBOLES.indexOf(a.symbole) - ORDRE_SYMBOLES.indexOf(b.symbole));
  return taches;
}

function compter(taches) {
  const compte = Object.fromEntries(ORDRE_SYMBOLES.map((s) => [s, 0]));
  for (const t of taches) compte[t.symbole] += 1;
  compte.total = taches.length;
  return compte;
}

/** L'intitulé découpé en ses composants, pour montrer ce qui est au poste et ce qui ne l'est pas. */
function morceauxDuMenu(etat, date, menu, intitule) {
  const parNom = new Map();
  for (const c of Object.values(etat.composants ?? {})) {
    if (c.date === date && c.menu === menu) parNom.set(normaliser(c.nom), c);
  }
  return proposerComposants(intitule, menu, {}).map((p) => {
    const composant = parNom.get(normaliser(p.nom)) ?? null;
    return { texte: p.nom, auPoste: Boolean(composant?.attribue), composantId: composant?.id ?? null };
  });
}

function groupesDuJour(etat, date) {
  return Object.values(etat.fiches ?? {})
    .filter((f) => f.statut === 'active' && f.date === date)
    .sort((a, b) => String(a.service).localeCompare(String(b.service)) || String(a.horaire).localeCompare(String(b.horaire)))
    .map((f) => ({
      id: f.id, numero: f.numero, service: f.service, couverts: f.couverts, horaire: f.horaire,
      aAllergies: String(f.allergies ?? '').trim() !== '',
    }));
}

/**
 * Points à confirmer d'un jour qui méritent d'être écrits sur le tableau : ceux que la note dit déjà une fois
 * (portions, prévisions) n'y sont pas répétés.
 */
function pointsDuJour(etat, date) {
  return pointsAConfirmer(etat, date).filter((p) => !POINTS_DITS_DANS_LA_NOTE.has(p.type));
}

function jourDuTableau(etat, date, aujourdhui, deplie) {
  const jour = jourOuVide(etat, date);
  const aMenu = aMenuDuJour(date);
  const menus = aMenu ? [1, 2].map((menu) => {
    const intitule = String(jour.menus[menu].intitule ?? '').trim();
    const portions = portionsMenu(etat, date, menu);
    return {
      menu, intitule, saisi: intitule !== '',
      morceaux: intitule === '' ? [] : morceauxDuMenu(etat, date, menu, intitule),
      // Sans prévision ni groupe, aucun chiffre : un « 0 » laisserait croire à zéro portion.
      couverts: portions.total > 0 || !portions.previsionManquante ? Math.round(portions.total) : null,
      previsionASaisir: intitule !== '' && portions.previsionManquante,
      provisoires: portions.groupesProvisoires > 0,
    };
  }) : [];
  const taches = miseEnPlace(etat, date);
  return {
    date, estAujourdhui: date === aujourdhui, aMenu, deplie,
    menus, groupes: groupesDuJour(etat, date), miseEnPlace: taches, compte: compter(taches),
    nbPoints: pointsDuJour(etat, date).length,
  };
}

/** Familles et rôles sans portion parmi les composants au poste de ces dates : à régler dans les standards maison. */
function portionsARegler(etat, dates) {
  const libelles = new Map([...lignesStandards(etat), ...lignesStandardsGroupes(etat)].map((l) => [`${l.cleFamille}|${l.role}`, l]));
  const vues = new Map();
  const sansFamille = [];
  for (const c of Object.values(etat.composants ?? {})) {
    if (!dates.includes(c.date) || !c.attribue || c.type === 'preparation_maison') continue;
    if (c.type === 'generique') {
      // Seul un légume sans famille a une catégorie de portion : sans standard « Légumes », sa portion est à régler.
      if (c.categorie !== 'legume' || !c.role || grammageEffectif(etat, c)) continue;
      const cleLegumes = `${cleStandardGroupe('legumes')}|${c.role}`;
      if (!vues.has(cleLegumes)) {
        vues.set(cleLegumes, { cleFamille: cleStandardGroupe('legumes'), role: c.role,
          libelle: 'Légumes', nb: 0 });
      }
      vues.get(cleLegumes).nb += 1;
      continue;
    }
    if (grammageEffectif(etat, c)) continue;
    if (!c.famille) { sansFamille.push(c.id); continue; }
    const cle = `${c.famille}|${c.role}`;
    const ligne = libelles.get(cle);
    if (!vues.has(cle)) vues.set(cle, { cleFamille: c.famille, role: c.role, libelle: ligne?.libelle ?? c.famille, nb: 0 });
    vues.get(cle).nb += 1;
  }
  return { familles: [...vues.values()], sansFamille };
}

/** Jours à menu saisi dont la prévision hors groupes manque, sans aucun groupe pour chiffrer. */
function joursSansPrevision(etat, dates) {
  return dates.filter((date) => [1, 2].some((menu) => {
    const saisi = String(jourOuVide(etat, date).menus[menu]?.intitule ?? '').trim() !== '';
    const portions = portionsMenu(etat, date, menu);
    return saisi && portions.previsionManquante && portions.total === 0;
  }));
}

const ligneTache = (t) => ({
  genre: 'tache', texte: t.nom, quantite: t.quantite, detail: null,
  symbole: t.symbole, lien: `#/composant/${t.composantId}`,
});

function ligneAvance(a) {
  const ev = a.evaluation;
  const jours = ev.jours <= 1 ? `${ev.jours} jour d'avance` : `${ev.jours} jours d'avance`;
  const suite = ev.conservation === 'a_confirmer' ? 'conservation à confirmer'
    : ev.conservation === 'depassee' ? 'limite maison dépassée' : null;
  return {
    genre: 'avance', texte: `${a.nom}, pour ${libelleJour(a.dateService)}`,
    detail: suite ? `${jours}, ${suite}` : jours,
    quantite: Number.isFinite(a.cible) && a.unite ? formaterQuantite(a.cible, a.unite) : null,
    symbole: 'a_faire', lien: `#/composant/${a.composantId}`,
  };
}

/**
 * Lignes d'avance : seules les avances autorisées et chiffrées sont proposées. Celles qui demanderaient une règle
 * de préparation validée sont résumées en une ligne, sans alarme.
 */
function lignesAvances(avances, aucune) {
  const chiffrees = avances.filter((a) => Number.isFinite(a.cible));
  const autorisees = chiffrees.filter((a) => a.evaluation.autorisee);
  const horsRegle = chiffrees.length - autorisees.length;
  const lignes = autorisees.map(ligneAvance);
  if (horsRegle > 0) {
    lignes.push({
      genre: 'info', lien: '#/reglages',
      texte: horsRegle === 1
        ? "1 préparation pourrait être avancée dès aujourd'hui avec une règle de préparation validée."
        : `${horsRegle} préparations pourraient être avancées dès aujourd'hui avec une règle de préparation validée.`,
    });
  }
  if (lignes.length === 0) lignes.push({ genre: 'info', texte: aucune });
  return lignes;
}

function semaineSansMenu(etat, lundi) {
  for (let i = 0; i < 5; i += 1) {
    const jour = jourOuVide(etat, ajouterJours(lundi, i));
    if ([1, 2].some((m) => String(jour.menus[m].intitule ?? '').trim() !== '')) return false;
  }
  return true;
}

/**
 * Ce que l'application ne peut pas savoir seule, pour une semaine : les portions sans standard, les éléments
 * qu'elle ne reconnaît pas, les prévisions. Chaque besoin est dit une seule fois, avec le geste qui le règle.
 * Un besoin est une case à cocher, pas une alerte : le point d'exclamation reste réservé aux écarts à arbitrer.
 */
function besoinsDe(etat, semaine) {
  const dates = [0, 1, 2, 3, 4].map((i) => ajouterJours(semaine, i));
  const aRegler = portionsARegler(etat, dates);
  const sansPrevision = joursSansPrevision(etat, dates);
  const lignes = [];
  let action = null;
  if (aRegler.familles.length > 0) {
    const n = aRegler.familles.length;
    const noms = aRegler.familles.slice(0, 3).map((f) => `${f.libelle} en ${f.role === 'plat_principal' ? 'plat principal' : 'garniture'}`);
    lignes.push({
      genre: 'besoin', symbole: 'a_faire', lien: '#/reglages',
      texte: n === 1 ? '1 portion à régler dans les standards maison' : `${n} portions à régler dans les standards maison`,
      detail: `${noms.join(', ')}${n > 3 ? ', et les autres' : ''}`,
    });
    action = { libelle: 'Régler les standards maison', lien: '#/reglages' };
  }
  if (aRegler.sansFamille.length > 0) {
    const n = aRegler.sansFamille.length;
    lignes.push({
      genre: 'besoin', symbole: 'a_faire', lien: `#/composant/${aRegler.sansFamille[0]}`,
      texte: n === 1 ? '1 élément du menu à préciser' : `${n} éléments du menu à préciser`,
    });
  }
  if (sansPrevision.length > 0) {
    const n = sansPrevision.length;
    lignes.push({
      genre: 'besoin', symbole: 'a_faire', lien: `#/menus/${semaine}`,
      texte: n === 1 ? 'Prévisions à saisir pour 1 jour' : `Prévisions à saisir pour ${n} jours`,
    });
    action ??= { libelle: 'Saisir les prévisions', lien: `#/menus/${semaine}` };
  }
  return { lignes, action };
}

/** La note du contexte : ce qu'il faut savoir maintenant, et une seule action principale. */
function contexteDe(etat, aujourdhui) {
  const numeroJour = jourSemaine(aujourdhui);
  const lundi = lundiDe(aujourdhui);
  const lundiSuivant = ajouterJours(lundi, 7);
  const feuille = estOuvert(aujourdhui) ? feuilleDuJour(etat, aujourdhui) : null;
  const tachesDuJour = aMenuDuJour(aujourdhui) ? miseEnPlace(etat, aujourdhui) : [];
  const resteAFaire = tachesDuJour.filter((t) => t.symbole !== 'pret');
  const arbitrages = feuille ? decisionsSansDoublon(feuille).filter((d) => d.motif === 'ecart') : [];
  const lignes = [];
  let type;
  let titre;
  let action;
  let semaine = lundi;

  if (resteAFaire.length > 0) {
    type = 'service';
    titre = 'Avant le service de midi';
    lignes.push(...resteAFaire.map(ligneTache));
    const prets = tachesDuJour.length - resteAFaire.length;
    if (prets > 0) lignes.push({ genre: 'info', texte: prets === 1 ? '1 tâche prête' : `${prets} tâches prêtes`, symbole: 'pret' });
    action = { libelle: 'Ouvrir la feuille du jour', lien: `#/jour/${aujourdhui}` };
    lignes.push(...besoinsDe(etat, lundi).lignes);
  } else if (numeroJour >= 5) {
    type = 'semaine_prochaine';
    titre = numeroJour === 7 ? "Fermé aujourd'hui" : 'Semaine prochaine';
    semaine = lundiSuivant;
    if (semaineSansMenu(etat, lundiSuivant)) {
      lignes.push({ genre: 'info', texte: 'Les menus de la semaine prochaine ne sont pas saisis.' });
      action = { libelle: 'Saisir les menus de la semaine', lien: `#/menus/${lundiSuivant}` };
    } else {
      const besoins = besoinsDe(etat, lundiSuivant);
      lignes.push(...besoins.lignes);
      if (numeroJour !== 7) {
        const limite = ajouterJours(lundiSuivant, 1); // lundi et mardi
        const avances = avancesPossibles(etat, aujourdhui).filter((a) => a.dateService >= lundiSuivant && a.dateService <= limite);
        if (avances.some((a) => Number.isFinite(a.cible)) || besoins.lignes.length === 0) {
          lignes.push(...lignesAvances(avances, 'Rien à avancer pour lundi et mardi pour le moment.'));
        }
      }
      action = besoins.action ?? (numeroJour === 7
        ? { libelle: 'Voir la feuille de lundi', lien: `#/jour/${lundiSuivant}` }
        : { libelle: 'Ouvrir la feuille du jour', lien: `#/jour/${aujourdhui}` });
    }
  } else if (semaineSansMenu(etat, lundi)) {
    type = 'vide';
    titre = 'Aucun menu saisi cette semaine';
    lignes.push({ genre: 'info', texte: 'Saisissez les menus de la semaine : le tableau se remplit seul.' });
    action = { libelle: 'Saisir les menus de la semaine', lien: `#/menus/${lundi}` };
  } else {
    type = 'apres_service';
    titre = 'Après le service';
    const besoins = besoinsDe(etat, lundi);
    lignes.push(...besoins.lignes);
    const avances = feuille ? feuille.aAvancer : [];
    if (avances.some((a) => Number.isFinite(a.cible)) || besoins.lignes.length === 0) {
      lignes.push(...lignesAvances(avances, 'Rien à avancer pour le moment.'));
    }
    if (numeroJour === 2) lignes.push({ genre: 'info', texte: 'Revue de mi-semaine : préparations de mercredi à vendredi.' });
    action = besoins.action ?? { libelle: 'Ouvrir la feuille du jour', lien: `#/jour/${aujourdhui}` };
  }

  if (arbitrages.length > 0) {
    lignes.push({
      genre: 'decision', symbole: 'a_decider', lien: `#/jour/${aujourdhui}`,
      texte: arbitrages.length === 1 ? '1 écart à arbitrer' : `${arbitrages.length} écarts à arbitrer`,
    });
  }
  for (const point of pointsGlobaux(etat)) {
    lignes.push({ genre: 'besoin', symbole: 'a_faire', lien: '#/reglages', texte: point.texte });
  }
  const visibles = lignes.slice(0, LIGNES_MAX);
  return { type, titre, date: aujourdhui, lignes: visibles, autres: lignes.length - visibles.length, action, semaine };
}

/**
 * Données du tableau blanc (voir conception, section 16).
 * @param {object} etat
 * @param {string} aujourdhui AAAA-MM-JJ
 * @param {string} [lundiAffiche] force la semaine affichée (navigation) ; sinon la semaine que le contexte désigne
 */
export function tableauBlanc(etat, aujourdhui, lundiAffiche) {
  const contexte = contexteDe(etat, aujourdhui);
  const lundi = lundiAffiche ? lundiDe(lundiAffiche) : contexte.semaine;
  // Le jour déplié : aujourd'hui s'il est dans la semaine affichée et ouvert, sinon le premier jour à menu saisi.
  const dates = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  let deplie = dates.includes(aujourdhui) ? aujourdhui : null;
  if (!deplie) {
    deplie = dates.find((d) => [1, 2].some((m) => String(jourOuVide(etat, d).menus[m]?.intitule ?? '').trim() !== '')) ?? dates[0];
  }
  return {
    date: aujourdhui,
    lundi,
    estSemaineCourante: lundi === lundiDe(aujourdhui),
    semainePrecedente: ajouterJours(lundi, -7),
    semaineSuivante: ajouterJours(lundi, 7),
    contexte,
    jours: dates.map((date) => jourDuTableau(etat, date, aujourdhui, date === deplie)),
    pointsGlobaux: pointsGlobaux(etat),
  };
}
