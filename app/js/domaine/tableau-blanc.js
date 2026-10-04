// Tableau blanc : ce que l'écran d'accueil affiche, et la note du contexte (« que dois-je savoir maintenant »).
// Aucune règle métier propre : le module assemble les fonctions du domaine. Ni DOM ni heure courante.

import { proposerComposants } from './analyse-menu.js';
import { propositionsApprentissage } from './apprentissage.js';
import { calculerComposant, formaterQuantite, portionsMenu } from './calcul.js';
import { ajouterJours, aMenuDuJour, estOuvert, jourSemaine, joursEntre, libelleJour, lundiDe } from './dates.js';
import { jourOuVide, normaliser } from './etat.js';
import { avancesPossibles, cibleProduction, etatTache, evaluationProduction, feuilleDuJour } from './planification.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { besoinsProduits, echeanceCommande, suiviProduit } from './produits.js';
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
    return { texte: p.nom, auPoste: Boolean(composant?.attribue), composantId: composant?.id ?? null, implicite: Boolean(p.implicite) };
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
    const morceaux = intitule === '' ? [] : morceauxDuMenu(etat, date, menu, intitule);
    return {
      menu, intitule, saisi: intitule !== '',
      // Un élément implicite (sauce ou base « à confirmer ») n'est pas écrit dans l'intitulé : jamais compté comme un plat.
      morceaux, nbPlats: morceaux.filter((m) => !m.implicite).length,
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
    // Couverts du jour : somme des menus chiffrés ; null quand aucun menu n'a de chiffre (jamais un « 0 » inventé).
    couvertsTotal: menus.some((m) => m.couverts !== null) ? menus.reduce((n, m) => n + (m.couverts ?? 0), 0) : null,
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
  symbole: t.symbole, lien: `#/fiche/${t.composantId}`,
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
    symbole: 'a_faire', lien: `#/fiche/${a.composantId}`,
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
      genre: 'besoin', symbole: 'a_faire', lien: `#/fiche/${aRegler.sansFamille[0]}`,
      texte: n === 1 ? '1 élément du menu à préciser' : `${n} éléments du menu à préciser`,
    });
  }
  if (sansPrevision.length > 0) {
    const n = sansPrevision.length;
    lignes.push({
      genre: 'besoin', symbole: 'a_faire', lien: `#/import/${semaine}`,
      texte: n === 1 ? 'Prévisions à saisir pour 1 jour' : `Prévisions à saisir pour ${n} jours`,
    });
    action ??= { libelle: 'Saisir les prévisions', lien: `#/import/${semaine}` };
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
    action = { libelle: 'Ouvrir la feuille du jour', lien: `#/production/${aujourdhui}` };
    lignes.push(...besoinsDe(etat, lundi).lignes);
  } else if (numeroJour >= 5) {
    type = 'semaine_prochaine';
    titre = numeroJour === 7 ? "Fermé aujourd'hui" : 'Semaine prochaine';
    semaine = lundiSuivant;
    if (semaineSansMenu(etat, lundiSuivant)) {
      lignes.push({ genre: 'info', texte: 'Les menus de la semaine prochaine ne sont pas saisis.' });
      action = { libelle: 'Saisir les menus de la semaine', lien: `#/import/${lundiSuivant}` };
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
        ? { libelle: 'Voir la feuille de lundi', lien: `#/production/${lundiSuivant}` }
        : { libelle: 'Ouvrir la feuille du jour', lien: `#/production/${aujourdhui}` });
    }
  } else if (semaineSansMenu(etat, lundi)) {
    type = 'vide';
    titre = 'Aucun menu saisi cette semaine';
    lignes.push({ genre: 'info', texte: 'Saisissez les menus de la semaine : le tableau se remplit seul.' });
    action = { libelle: 'Saisir les menus de la semaine', lien: `#/import/${lundi}` };
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
    action = besoins.action ?? { libelle: 'Ouvrir la feuille du jour', lien: `#/production/${aujourdhui}` };
  }

  if (arbitrages.length > 0) {
    lignes.push({
      genre: 'decision', symbole: 'a_decider', lien: `#/production/${aujourdhui}`,
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
const JOURS_AVANT_RAPPEL = 7;

/**
 * Rappel de sauvegarde, discret : une semaine après le dernier export, ou après les premières données si rien n'a
 * jamais été exporté. Sans donnée, aucun rappel.
 */
function rappelSauvegarde(etat, aujourdhui) {
  const premier = etat.journal?.[0]?.h ?? null;
  const reference = etat.reglages?.dernierExport ?? premier;
  if (!reference) return null;
  const jours = joursEntre(reference.slice(0, 10), aujourdhui);
  if (!(jours > JOURS_AVANT_RAPPEL)) return null;
  const jamais = !etat.reglages?.dernierExport;
  return {
    genre: 'besoin', symbole: 'a_faire', lien: '#/reglages', texte: 'Sauvegarde à faire',
    detail: jamais ? `jamais exportée, données depuis ${jours} jours` : `dernier export il y a ${jours} jours`,
  };
}

// ------------------------------------------------------------------ le tableau de bord (A-P1)

const MENUS_VISIBLES = 3;
const LIGNES_A_CONFIRMER = 3;
const MODE_FICHE = Object.freeze({ menu_fixe: 'Menu fixe', choix_libre: 'Choix libre', hors_menu: 'Hors menu' });
/** Points qui ne sont pas des décisions mais des quantités ou des données à compléter : dits dans « Production ». */
const POINTS_DE_CHIFFRAGE = new Set(['grammage', 'prevision_manquante', 'composant_a_preciser']);

/** Numéro de semaine ISO du lundi donné. */
function numeroSemaine(lundi) {
  const jeudi = ajouterJours(lundi, 3);
  const premierJanvier = `${jeudi.slice(0, 4)}-01-01`;
  return Math.floor(joursEntre(premierJanvier, jeudi) / 7) + 1;
}

/** Menus : aujourd'hui et les 2 jours suivants (jours à menu) ; le reste de la semaine reste à une touche. */
function menusDuBord(jours, aujourdhui) {
  const avecMenu = jours.filter((j) => j.aMenu);
  const aVenir = avecMenu.filter((j) => j.date >= aujourdhui);
  const dansLaSemaine = jours.some((j) => j.date === aujourdhui);
  // Une autre semaine que la courante : ses trois premiers jours à menu saisi (à défaut, ses jours à menu).
  const saisis = avecMenu.filter((j) => j.menus.some((m) => m.saisi));
  const depart = dansLaSemaine && aVenir.length > 0 ? aVenir : (!dansLaSemaine && saisis.length > 0 ? saisis : avecMenu);
  const visibles = depart.slice(0, MENUS_VISIBLES);
  const reste = avecMenu.filter((j) => !visibles.includes(j));
  const aucunMenu = !avecMenu.some((j) => j.menus.some((m) => m.saisi)) && jours.every((j) => j.groupes.length === 0);
  return { visibles, reste, aucunMenu };
}

function fichesDuBord(etat, dates, lundi) {
  return Object.values(etat.fiches ?? {})
    .filter((f) => f.statut === 'active' && dates.includes(f.date))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.service).localeCompare(String(b.service))
      || String(a.horaire).localeCompare(String(b.horaire)))
    .map((f) => ({
      id: f.id, date: f.date, numero: f.numero, service: f.service, horaire: f.horaire, couverts: f.couverts,
      mode: f.mode, modeTexte: MODE_FICHE[f.mode] ?? '', aAllergies: String(f.allergies ?? '').trim() !== '',
      lien: `#/semaine/${f.date}`, semaine: lundi,
    }));
}

/**
 * « À confirmer » : seulement de vraies décisions (écarts à arbitrer, répartition provisoire, autres points,
 * semaine type). Une quantité ou une portion manquante n'y entre jamais : elle est dite dans « Production ».
 * Trois lignes au plus ; le total compte tout, le détail complet reste sur la feuille du jour et le détail du jour.
 */
function aConfirmerDuBord(etat, dates, aujourdhui) {
  const categories = [];
  const feuille = estOuvert(aujourdhui) ? feuilleDuJour(etat, aujourdhui) : null;
  const ecarts = feuille ? decisionsSansDoublon(feuille).filter((d) => d.motif === 'ecart') : [];
  if (ecarts.length > 0) {
    categories.push({ genre: 'ecart', n: ecarts.length, lien: `#/production/${aujourdhui}`,
      texte: ecarts.length === 1 ? '1 écart à arbitrer' : `${ecarts.length} écarts à arbitrer` });
  }
  const points = dates.map((date) => ({ date, liste: pointsAConfirmer(etat, date).filter((p) => p.type !== 'ecart') }));
  const classe = (filtre) => points.map((x) => ({ date: x.date, liste: x.liste.filter(filtre) })).filter((x) => x.liste.length > 0);
  const repartitions = classe((p) => p.type === 'repartition_provisoire');
  const conservations = classe((p) => p.type === 'conservation');
  const autres = classe((p) => p.type !== 'repartition_provisoire' && p.type !== 'conservation' && !POINTS_DE_CHIFFRAGE.has(p.type));
  const compte = (x) => x.reduce((n, y) => n + y.liste.length, 0);
  if (repartitions.length > 0) {
    const n = compte(repartitions);
    categories.push({ genre: 'repartition', n, lien: `#/semaine/${repartitions[0].date}`,
      texte: n === 1 ? '1 répartition provisoire à confirmer' : `${n} répartitions provisoires à confirmer` });
  }
  if (autres.length > 0) {
    const n = compte(autres);
    categories.push({ genre: 'points', n, lien: `#/semaine/${autres[0].date}`,
      texte: n === 1 ? '1 point à confirmer' : `${n} points à confirmer`, detail: autres[0].liste[0].texte });
  }
  for (const point of pointsGlobaux(etat)) categories.push({ genre: 'global', n: 1, lien: '#/reglages', texte: point.texte });
  if (conservations.length > 0) {
    const n = compte(conservations);
    categories.push({ genre: 'conservation', n, lien: `#/semaine/${conservations[0].date}`,
      texte: n === 1 ? '1 préparation : conservation à confirmer' : `${n} préparations : conservation à confirmer` });
  }
  // Une correction répétée dans le même sens : une ligne par proposition d'apprentissage, après les vraies décisions.
  for (const proposition of propositionsApprentissage(etat, aujourdhui)) {
    categories.push({ genre: 'apprentissage', n: 1, lien: '#/reglages', texte: proposition.texte, proposition });
  }
  // Le total compte des lignes distinctes (jamais des points répétés) ; `reste` = lignes non affichées.
  const lignes = categories.slice(0, LIGNES_A_CONFIRMER);
  return { total: categories.length, lignes, reste: categories.length - lignes.length };
}

/** Commande à relire : besoin changé depuis le contrôle, ou échéance du jour ou dépassée. Rien sans donnée de commande. */
function commandeARelire(etat, lundi, aujourdhui) {
  const { lignes } = besoinsProduits(etat, lundi);
  let arevoir = 0;
  let echeance = 0;
  for (const ligne of lignes) {
    const suivi = suiviProduit(etat, lundi, ligne);
    if (suivi.statutAffiche === 'a_reverifier') arevoir += 1;
    const fournisseur = suivi.fournisseurId ? etat.fournisseurs?.[suivi.fournisseurId] ?? null : null;
    const ech = echeanceCommande(ligne, fournisseur, aujourdhui);
    if (!suivi.commandeLe && (ech.statut === 'aujourdhui' || ech.statut === 'depassee')) echeance += 1;
  }
  const morceaux = [];
  if (arevoir > 0) morceaux.push(arevoir === 1 ? '1 produit à revérifier' : `${arevoir} produits à revérifier`);
  if (echeance > 0) morceaux.push(echeance === 1 ? '1 échéance de commande atteinte' : `${echeance} échéances de commande atteintes`);
  return morceaux.length > 0 ? { texte: `Commande à relire : ${morceaux.join(', ')}`, lien: `#/stock/achats/${lundi}` } : null;
}

/**
 * Production et commandes en résumé. Semaine courante : le jour désigné. Autre semaine affichée : l'avancement de CETTE
 * semaine (`autreSemaine`), jamais celui d'aujourd'hui ; les avances possibles ne parlent que d'aujourd'hui et sont tues.
 */
function productionDuBord(etat, aujourdhui, lundi) {
  const autreSemaine = lundi !== lundiDe(aujourdhui);
  const commande = commandeARelire(etat, lundi, aujourdhui);
  // Ce qui n'est pas encore chiffré : information neutre, jamais une alerte ni une décision.
  const chiffrage = besoinsDe(etat, lundi).lignes;
  if (autreSemaine) {
    const avancement = { faites: 0, total: 0 };
    for (let i = 0; i < 6; i += 1) {
      const date = ajouterJours(lundi, i);
      const a = estOuvert(date) ? feuilleDuJour(etat, date).avancement : null;
      if (a) { avancement.faites += a.faites; avancement.total += a.total; }
    }
    return { autreSemaine, lundi, date: lundi, lien: `#/production/${lundi}`, avancement, avances: 0, commande, chiffrage };
  }
  const feuille = estOuvert(aujourdhui) ? feuilleDuJour(etat, aujourdhui) : null;
  const avances = feuille ? feuille.aAvancer.filter((a) => Number.isFinite(a.cible) && a.evaluation.autorisee).length : 0;
  return {
    autreSemaine, lundi, date: aujourdhui, lien: `#/production/${aujourdhui}`,
    avancement: feuille ? feuille.avancement : { faites: 0, total: 0 },
    avances, commande, chiffrage,
  };
}

function bordDe(etat, aujourdhui, lundi, jours, contexte, rappel) {
  const datesSemaine = jours.map((j) => j.date);
  const aVenir = datesSemaine.includes(aujourdhui) ? datesSemaine.filter((d) => d >= aujourdhui) : datesSemaine;
  return {
    entete: {
      date: aujourdhui, semaine: numeroSemaine(lundi), lundi, lienJour: `#/production/${aujourdhui}`, sauvegarde: rappel,
      aucunMenuCetteSemaine: contexte.type === 'vide',
    },
    menus: menusDuBord(jours, aujourdhui),
    fiches: fichesDuBord(etat, aVenir, lundi),
    aConfirmer: aConfirmerDuBord(etat, aVenir, aujourdhui),
    production: productionDuBord(etat, aujourdhui, lundi),
  };
}

export function tableauBlanc(etat, aujourdhui, lundiAffiche) {
  const contexte = contexteDe(etat, aujourdhui);
  const rappel = rappelSauvegarde(etat, aujourdhui);
  if (rappel) contexte.lignes.push(rappel);
  const lundi = lundiAffiche ? lundiDe(lundiAffiche) : contexte.semaine;
  // Le jour déplié : aujourd'hui s'il est dans la semaine affichée et ouvert, sinon le premier jour à menu saisi.
  const dates = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  let deplie = dates.includes(aujourdhui) ? aujourdhui : null;
  if (!deplie) {
    deplie = dates.find((d) => [1, 2].some((m) => String(jourOuVide(etat, d).menus[m]?.intitule ?? '').trim() !== '')) ?? dates[0];
  }
  const joursDuTableau = dates.map((date) => jourDuTableau(etat, date, aujourdhui, date === deplie));
  return {
    date: aujourdhui,
    lundi,
    bord: bordDe(etat, aujourdhui, lundi, joursDuTableau, contexte, rappel),
    estSemaineCourante: lundi === lundiDe(aujourdhui),
    semainePrecedente: ajouterJours(lundi, -7),
    semaineSuivante: ajouterJours(lundi, 7),
    contexte,
    jours: joursDuTableau,
    pointsGlobaux: pointsGlobaux(etat),
  };
}

// ------------------------------------------------------------------ l'écran Aujourd'hui (refonte 1)

const ORDRE_CERTITUDES = Object.freeze(['estimee', 'provisoire', 'confirmee']);
const A_CONSOMMER_MAX = 3;

/** Certitude d'une fiche de fonction : menu fixe = confirmée ; choix libre selon sa répartition ; hors menu : aucune (jamais inventée). */
function certitudeFiche(f) {
  if (f.mode === 'menu_fixe') return 'confirmee';
  if (f.mode === 'choix_libre') return f.statutRepartition === 'confirmee' ? 'confirmee' : 'provisoire';
  return null;
}

/** Couverts d'un menu du jour et leur certitude : prévision = estimée ; fiches = confirmée ou provisoire. Jamais un « 0 » inventé. */
function couvertsDuMenu(etat, date, menu) {
  const jour = jourOuVide(etat, date);
  const intitule = String(jour.menus[menu].intitule ?? '').trim();
  const portions = portionsMenu(etat, date, menu);
  const parCertitude = new Map();
  for (const d of portions.details) parCertitude.set(d.certitude, (parCertitude.get(d.certitude) ?? 0) + d.portions);
  return {
    menu, saisi: intitule !== '',
    couverts: portions.total > 0 || !portions.previsionManquante ? Math.round(portions.total) : null,
    previsionASaisir: intitule !== '' && portions.previsionManquante === true,
    certitudes: ORDRE_CERTITUDES.filter((c) => parCertitude.has(c)).map((c) => ({ certitude: c, portions: Math.round(parCertitude.get(c)) })),
  };
}

/** Fiches de fonction actives du jour : couverts annoncés par certitude (la fiche hors menu n'a pas de certitude). */
function fichesDuJour(etat, date) {
  const actives = Object.values(etat.fiches ?? {}).filter((f) => f.statut === 'active' && f.date === date);
  const parCertitude = new Map();
  for (const f of actives) {
    const cle = certitudeFiche(f) ?? 'hors_menu';
    parCertitude.set(cle, (parCertitude.get(cle) ?? 0) + (Number(f.couverts) || 0));
  }
  return {
    nombre: actives.length,
    total: actives.length > 0 ? actives.reduce((n, f) => n + (Number(f.couverts) || 0), 0) : null,
    certitudes: [...ORDRE_CERTITUDES, 'hors_menu'].filter((c) => parCertitude.has(c)).map((c) => ({ certitude: c, couverts: parCertitude.get(c) })),
  };
}

/** Prochaine fiche de fonction (aujourd'hui ou plus tard) : allergies et certitude de ses couverts. */
function prochaineFiche(etat, aujourd) {
  const f = Object.values(etat.fiches ?? {})
    .filter((x) => x.statut === 'active' && x.date >= aujourd)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.horaire).localeCompare(String(b.horaire)) || String(a.service).localeCompare(String(b.service)))[0];
  if (!f) return null;
  return {
    id: f.id, date: f.date, numero: f.numero, service: f.service, horaire: f.horaire, couverts: Number(f.couverts) || 0,
    mode: f.mode, modeTexte: MODE_FICHE[f.mode] ?? '', certitude: certitudeFiche(f),
    allergies: String(f.allergies ?? '').trim(), lien: `#/semaine/${f.date}`,
  };
}

/** Prochaine tâche à faire : première ligne non faite de la lecture du jour (service 1, service 2, autres, après service) ; une simple suggestion d'avance n'est pas une tâche décidée. */
function maintenantDe(etat, feuille) {
  if (!feuille) return null;
  const { service1, service2, autres, apres } = feuille.lecture;
  const l = [...service1, ...service2, ...autres, ...apres].find((x) => !x.fait && x.source !== 'suggestion');
  if (!l) return null;
  const ev = evaluationProduction(etat, l.productionId);
  return {
    productionId: l.productionId, composantId: l.composantId, genre: l.genre,
    nom: l.genre === 'principale' ? l.nom : (l.libelle || l.nom), menu: l.menu ?? null, dateService: l.dateService,
    cible: l.cible ?? null, unite: l.unite ?? null, creneau: l.creneau ?? null,
    // Même définition que la feuille « À décider » et points.js : une exception (plus de deux jours) non autorisée.
    horsRegle: Boolean(ev) && ev.jours > 0 && ev.exception && !ev.autorisee,
  };
}

/**
 * Productions faites pour un service à venir (jour même compris, si faites avant), avec l'avertissement de conservation
 * existant (`evaluationProduction` : `evaluerAvance` + `repereConservation`). Les avertissements d'abord, puis le service le plus proche.
 * Une quantité absente n'est jamais un avertissement.
 */
function aConsommerDe(etat, aujourd) {
  const lignes = [];
  for (const p of Object.values(etat.productions ?? {})) {
    if (p.etat !== 'fait' || p.genre === 'preparatoire' || p.dateService < aujourd) continue;
    const composant = etat.composants?.[p.composantId];
    const ev = composant ? evaluationProduction(etat, p.id, { reelle: true }) : null;
    if (!ev || !(ev.jours > 0)) continue;
    lignes.push({
      productionId: p.id, composantId: composant.id, nom: p.genre === 'complement' ? `Complément : ${composant.nom}` : composant.nom,
      dateService: p.dateService, dateFait: p.hFait ? String(p.hFait).slice(0, 10) : null, avanceJours: ev.jours,
      quantite: Number.isFinite(p.quantiteReelle) ? p.quantiteReelle : null, unite: p.unite ?? null,
      horsRegle: ev.exception && !ev.autorisee,
      limiteDepassee: ev.conservation === 'depassee',
      conservation: ev.repere?.depasse ? { texte: ev.repere.texte, provenance: ev.repere.provenance } : null,
    });
  }
  const alerte = (x) => (x.horsRegle || x.limiteDepassee || x.conservation ? 0 : 1);
  lignes.sort((a, b) => alerte(a) - alerte(b) || a.dateService.localeCompare(b.dateService) || a.nom.localeCompare(b.nom));
  return { total: lignes.length, lignes: lignes.slice(0, A_CONSOMMER_MAX) };
}

/** Première date ouverte après `date` (le dimanche est fermé : le lundi suivant). */
function prochainJourOuvert(date) {
  let d = ajouterJours(date, 1);
  while (!estOuvert(d)) d = ajouterJours(d, 1);
  return d;
}

/**
 * Données de l'écran Aujourd'hui : couverts des menus 1 et 2 et des fiches avec leur certitude, prochaine tâche
 * (« Maintenant »), décisions en attente (points « À confirmer » existants, sans quantité manquante), à consommer en
 * priorité, prochaine fiche de fonction, et ce que l'ancien tableau montrait encore (production, commande à relire,
 * rappel de sauvegarde). Pure : ni DOM ni heure courante.
 */
export function aujourdhuiDe(etat, aujourd) {
  const lundi = lundiDe(aujourd);
  const ouvert = estOuvert(aujourd);
  const feuille = ouvert ? feuilleDuJour(etat, aujourd) : null;
  const datesSemaine = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)).filter((d) => d >= aujourd);
  return {
    date: aujourd, lundi, ouvert,
    // Jour fermé : la prochaine journée ouverte (information seule, aucun calcul de production).
    prochainOuvert: ouvert ? null : prochainJourOuvert(aujourd),
    menus: aMenuDuJour(aujourd) ? [1, 2].map((m) => couvertsDuMenu(etat, aujourd, m)) : [],
    fiches: fichesDuJour(etat, aujourd),
    maintenant: maintenantDe(etat, feuille),
    avancement: feuille ? feuille.avancement : { faites: 0, total: 0 },
    decisions: aConfirmerDuBord(etat, datesSemaine, aujourd),
    aConsommer: aConsommerDe(etat, aujourd),
    prochaineFiche: prochaineFiche(etat, aujourd),
    production: productionDuBord(etat, aujourd, lundi),
    sauvegarde: rappelSauvegarde(etat, aujourd),
    semaineSansMenu: semaineSansMenu(etat, lundi),
  };
}
