// Tableau blanc : ce que l'écran d'accueil et le tableau de la semaine affichent.
// Aucune règle métier propre : le module assemble les fonctions du domaine. Ni DOM ni heure courante.

import { proposerComposants } from './analyse-menu.js';
import { propositionsApprentissage } from './apprentissage.js';
import { portionsMenu } from './calcul.js';
import { couvertsMidiDuJour, ventesASaisir } from './couverts-midi.js';
import { decisionsDe } from './decisions.js';
import { ajouterJours, aMenuDuJour, creneauxDuJour, estOuvert, jourSemaine, joursEntre, lundiDe } from './dates.js';
import { jourOuVide, normaliser } from './etat.js';
import { etatCreneau, etatTache, evaluationProduction, feuilleDuJour } from './planification.js';
import { rappelCloture } from './cloture.js';
import { pointsAConfirmer, pointsGlobaux } from './points.js';
import { cleStandardGroupe, grammageEffectif, lignesStandards, lignesStandardsGroupes } from './savoir.js';

/**
 * Reste-t-il une tâche à faire ou à contrôler ce jour-là ? Tâches = productions principales et compléments dont le
 * service est ce jour ; « prête » = faite et le besoin couvert.
 */
function resteDuTravail(etat, date) {
  return Object.values(etat.productions ?? {}).some((p) => {
    if ((p.genre !== 'principale' && p.genre !== 'complement') || p.dateService !== date || !etat.composants?.[p.composantId]) return false;
    if (etatTache(etat, p.id) !== 'fait') return true;
    const evaluation = evaluationProduction(etat, p.id);
    return Boolean(evaluation) && !evaluation.couvre;
  });
}

/** L'intitulé découpé en ses composants, pour montrer ce qui est au poste et ce qui ne l'est pas. */
function morceauxDuMenu(etat, date, menu, intitule) {
  const parNom = new Map();
  for (const c of Object.values(etat.composants ?? {})) {
    if (c.date === date && c.menu === menu) parNom.set(normaliser(c.nom), c);
  }
  return proposerComposants(intitule, menu, {}, undefined, etat.mots, { noms: etat.noms, fiches: etat.fiches_retenues }).map((p) => {
    const composant = parNom.get(normaliser(p.nom)) ?? null;
    return { texte: p.nom, auPoste: Boolean(composant?.attribue), composantId: composant?.id ?? null, implicite: Boolean(p.implicite) };
  });
}

/** Une production décidée ce jour, pas faite, dont l'avance n'est pas autorisée par la règle : « hors règle ». */
function aUneProductionHorsRegle(etat, date) {
  return Object.values(etat.productions ?? {}).some((p) => {
    if (p.jourDecide !== date || !etat.composants?.[p.composantId] || p.etat === 'fait') return false;
    const ev = evaluationProduction(etat, p.id);
    return Boolean(ev && ev.jours > 0 && ev.exception && !ev.autorisee);
  });
}

/** « Jour off » : tous les créneaux du jour sont indisponibles (semaine type ou ce jour). Rien d'autre n'est présumé. */
function estJourOff(etat, date) {
  const creneaux = creneauxDuJour(date);
  return estOuvert(date) && creneaux.length > 0 && creneaux.every((c) => etatCreneau(etat, date, c) === 'indisponible');
}

function jourDuTableau(etat, date, aujourdhui) {
  const jour = jourOuVide(etat, date);
  const aMenu = aMenuDuJour(date);
  const menus = aMenu ? [1, 2].map((menu) => {
    const intitule = String(jour.menus[menu].intitule ?? '').trim();
    const portions = portionsMenu(etat, date, menu);
    const morceaux = intitule === '' ? [] : morceauxDuMenu(etat, date, menu, intitule);
    return {
      menu, intitule, saisi: intitule !== '',
      // Un élément implicite (sauce ou base « à confirmer ») n'est pas écrit dans l'intitulé : jamais compté comme un plat.
      morceaux,
      // Sans prévision ni groupe, aucun chiffre : un « 0 » laisserait croire à zéro portion.
      couverts: portions.total > 0 || !portions.previsionManquante ? Math.round(portions.total) : null,
      previsionASaisir: intitule !== '' && portions.previsionManquante,
      provisoires: portions.groupesProvisoires > 0,
    };
  }) : [];
  return {
    date, estAujourdhui: date === aujourdhui, aMenu,
    // Signes du jour (ancienne page de jour) : jamais sur un jour fermé.
    horsRegle: estOuvert(date) && aUneProductionHorsRegle(etat, date),
    aConfirmer: estOuvert(date) && pointsAConfirmer(etat, date).length > 0,
    jourOff: estJourOff(etat, date),
    menus, nbFiches: Object.values(etat.fiches ?? {}).filter((f) => f.statut === 'active' && f.date === date).length,
    // Couverts du jour : somme des menus chiffrés ; null quand aucun menu n'a de chiffre (jamais un « 0 » inventé).
    couvertsTotal: menus.some((m) => m.couverts !== null) ? menus.reduce((n, m) => n + (m.couverts ?? 0), 0) : null,
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

/**
 * Semaine désignée par défaut : le week-end, et le vendredi une fois le travail du jour terminé, la semaine suivante.
 * `vide` : aucun menu saisi cette semaine (du lundi au jeudi, sans travail restant).
 */
function semaineParDefaut(etat, aujourdhui) {
  const lundi = lundiDe(aujourdhui);
  if (aMenuDuJour(aujourdhui) && resteDuTravail(etat, aujourdhui)) return { semaine: lundi, vide: false };
  if (jourSemaine(aujourdhui) >= 5) return { semaine: ajouterJours(lundi, 7), vide: false };
  return { semaine: lundi, vide: semaineSansMenu(etat, lundi) };
}

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
  const aucunMenu = !avecMenu.some((j) => j.menus.some((m) => m.saisi)) && jours.every((j) => j.nbFiches === 0);
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
      lien: `#/production/${f.date}`, semaine: lundi,
    }));
}

/**
 * « À confirmer » : seulement de vraies décisions (écarts à arbitrer, répartition provisoire, autres points,
 * semaine type). Une quantité ou une portion manquante n'y entre jamais : elle est dite dans « Production ».
 * Trois lignes au plus ; le total compte tout, le détail complet reste sur la feuille du jour et le détail du jour.
 */
function aConfirmerDuBord(etat, dates, aujourdhui) {
  const categories = [];
  // Les mêmes écarts que le bandeau et la feuille « À décider » (`decisionsDe`), aussi un jour fermé ou un jour passé.
  const ecarts = decisionsDe(etat, aujourdhui).cartes.filter((c) => c.genre === 'ecart');
  if (ecarts.length > 0) {
    categories.push({ genre: 'ecart', n: ecarts.length, lien: `#/production/${estOuvert(aujourdhui) ? aujourdhui : ecarts[0].date}`,
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
    categories.push({ genre: 'repartition', n, lien: `#/production/${repartitions[0].date}`,
      texte: n === 1 ? '1 répartition provisoire à confirmer' : `${n} répartitions provisoires à confirmer` });
  }
  if (autres.length > 0) {
    const n = compte(autres);
    categories.push({ genre: 'points', n, lien: `#/production/${autres[0].date}`,
      texte: n === 1 ? '1 point à confirmer' : `${n} points à confirmer`, detail: autres[0].liste[0].texte });
  }
  for (const point of pointsGlobaux(etat)) categories.push({ genre: 'global', n: 1, lien: '#/reglages', texte: point.texte });
  if (conservations.length > 0) {
    const n = compte(conservations);
    categories.push({ genre: 'conservation', n, lien: `#/production/${conservations[0].date}`,
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

/**
 * Production en résumé. Semaine courante : le jour désigné. Autre semaine affichée : l'avancement de CETTE
 * semaine (`autreSemaine`), jamais celui d'aujourd'hui ; les avances possibles ne parlent que d'aujourd'hui et sont tues.
 */
function productionDuBord(etat, aujourdhui, lundi) {
  const autreSemaine = lundi !== lundiDe(aujourdhui);
  // Ce qui n'est pas encore chiffré : information neutre, jamais une alerte ni une décision.
  const chiffrage = besoinsDe(etat, lundi).lignes;
  if (autreSemaine) {
    const avancement = { faites: 0, total: 0 };
    for (let i = 0; i < 6; i += 1) {
      const date = ajouterJours(lundi, i);
      const a = estOuvert(date) ? feuilleDuJour(etat, date).avancement : null;
      if (a) { avancement.faites += a.faites; avancement.total += a.total; }
    }
    return { autreSemaine, lundi, date: lundi, lien: `#/production/${lundi}`, avancement, avances: 0, chiffrage };
  }
  const feuille = estOuvert(aujourdhui) ? feuilleDuJour(etat, aujourdhui) : null;
  const avances = feuille ? feuille.aAvancer.filter((a) => Number.isFinite(a.cible) && a.evaluation.autorisee).length : 0;
  return {
    autreSemaine, lundi, date: aujourdhui, lien: `#/production/${aujourdhui}`,
    avancement: feuille ? feuille.avancement : { faites: 0, total: 0 },
    avances, chiffrage,
  };
}

function bordDe(etat, aujourdhui, lundi, jours, aucunMenuCetteSemaine, rappel) {
  const datesSemaine = jours.map((j) => j.date);
  const aVenir = datesSemaine.includes(aujourdhui) ? datesSemaine.filter((d) => d >= aujourdhui) : datesSemaine;
  return {
    entete: {
      date: aujourdhui, semaine: numeroSemaine(lundi), lundi, lienJour: `#/production/${aujourdhui}`, sauvegarde: rappel,
      aucunMenuCetteSemaine,
    },
    menus: menusDuBord(jours, aujourdhui),
    fiches: fichesDuBord(etat, aVenir, lundi),
    aConfirmer: aConfirmerDuBord(etat, aVenir, aujourdhui),
    production: productionDuBord(etat, aujourdhui, lundi),
  };
}

/**
 * Données du tableau blanc (voir conception, section 16).
 * @param {object} etat
 * @param {string} aujourdhui AAAA-MM-JJ
 * @param {string} [lundiAffiche] force la semaine affichée (navigation) ; sinon la semaine par défaut
 */
export function tableauBlanc(etat, aujourdhui, lundiAffiche) {
  const defaut = semaineParDefaut(etat, aujourdhui);
  const rappel = rappelSauvegarde(etat, aujourdhui);
  const lundi = lundiAffiche ? lundiDe(lundiAffiche) : defaut.semaine;
  const dates = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  const joursDuTableau = dates.map((date) => jourDuTableau(etat, date, aujourdhui));
  return {
    date: aujourdhui,
    lundi,
    bord: bordDe(etat, aujourdhui, lundi, joursDuTableau, defaut.vide, rappel),
    estSemaineCourante: lundi === lundiDe(aujourdhui),
    semainePrecedente: ajouterJours(lundi, -7),
    semaineSuivante: ajouterJours(lundi, 7),
    jours: joursDuTableau,
    pointsGlobaux: pointsGlobaux(etat),
  };
}

// ------------------------------------------------------------------ l'écran Aujourd'hui (refonte 1)

const ORDRE_CERTITUDES = Object.freeze(['estimee', 'provisoire', 'confirmee']);

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
    allergies: String(f.allergies ?? '').trim(), lien: `#/production/${f.date}`,
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

/** Première date ouverte après `date` (le dimanche est fermé : le lundi suivant). */
function prochainJourOuvert(date) {
  let d = ajouterJours(date, 1);
  while (!estOuvert(d)) d = ajouterJours(d, 1);
  return d;
}

const A_AVANCER_MAX = 3;
const JOURS_A_MENU_VISIBLES = 3;

/** Les menus du jour et des deux jours à menu suivants (le samedi et le dimanche n'ont pas de menu du jour) ; un jour sans aucun intitulé est « à importer ». */
function menusSurTrois(etat, aujourd) {
  const jours = [];
  for (let i = 0; i < 14 && jours.length < JOURS_A_MENU_VISIBLES; i += 1) {
    const date = ajouterJours(aujourd, i);
    if (!aMenuDuJour(date)) continue;
    const jour = jourOuVide(etat, date);
    const menus = [1, 2].map((menu) => ({ menu, intitule: String(jour.menus[menu].intitule ?? '').trim() }));
    jours.push({ date, estAujourdhui: date === aujourd, menus, aImporter: menus.every((m) => m.intitule === '') });
  }
  return jours;
}

/**
 * « À avancer » : les avances que la règle des deux jours autorise et qui ne sont que proposées (pas encore décidées), avec le jour
 * du service et la quantité calculée. Les avances hors règle restent dans Production ; une action préparatoire n'a pas de quantité.
 */
function aAvancerDe(feuille) {
  if (!feuille) return { total: 0, lignes: [] };
  const propositions = feuille.lecture.apres.filter((l) => l.source === 'suggestion' && l.genre !== 'preparatoire' && l.evaluation?.autorisee);
  return {
    total: propositions.length,
    lignes: propositions.slice(0, A_AVANCER_MAX).map((l) => ({
      composantId: l.composantId, nom: l.genre === 'principale' ? l.nom : (l.libelle || l.nom),
      dateService: l.dateService, quantite: l.cible ?? null, unite: l.unite ?? null,
    })),
  };
}

/**
 * « faites / total » du jour, comme sur Production : les tâches décidées ; sans aucune tâche décidée mais avec des lignes de
 * travail (rien n'est encore planifié), ces lignes, pour que le compte soit dit dès qu'il y a du travail.
 */
function avancementDuJour(feuille) {
  if (!feuille) return { faites: 0, total: 0 };
  if (feuille.avancement.total > 0) return feuille.avancement;
  const { service1, service2, autres, apres } = feuille.lecture;
  const lignes = [...service1, ...service2, ...autres, ...apres].filter((l) => l.source !== 'suggestion');
  return { faites: lignes.filter((l) => l.fait).length, total: lignes.length };
}

/** Couverts du midi (prévisions seules, hors fiches), ventes à saisir dès 14 h et ventes saisies si les deux menus le sont. */
function couvertsMidiAvecVentes(etat, date, heure) {
  const v = jourOuVide(etat, date).ventes;
  const saisies = Number.isFinite(v[1]) && Number.isFinite(v[2]);
  return { ...couvertsMidiDuJour(etat, date), aSaisirVentes: ventesASaisir(etat, date, heure), ventes: saisies ? { m1: v[1], m2: v[2] } : null };
}

/**
 * Données de l'écran Aujourd'hui : couverts des menus 1 et 2 et des fiches avec leur certitude, prochaine tâche
 * (« Maintenant »), décisions en attente (points « À confirmer » existants, sans quantité manquante), prochaine fiche de fonction, et ce que l'ancien tableau montrait encore (production,
 * rappel de sauvegarde). Pure : ni DOM ni heure courante.
 */
export function aujourdhuiDe(etat, aujourd, heure = null) {
  const lundi = lundiDe(aujourd);
  const ouvert = estOuvert(aujourd);
  const feuille = ouvert ? feuilleDuJour(etat, aujourd) : null;
  const datesSemaine = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)).filter((d) => d >= aujourd);
  const ficheProche = prochaineFiche(etat, aujourd);
  return {
    date: aujourd, lundi, ouvert,
    // Jour fermé : la prochaine journée ouverte (information seule, aucun calcul de production).
    prochainOuvert: ouvert ? null : prochainJourOuvert(aujourd),
    menus: aMenuDuJour(aujourd) ? [1, 2].map((m) => couvertsDuMenu(etat, aujourd, m)) : [],
    fiches: fichesDuJour(etat, aujourd),
    menusSurTrois: menusSurTrois(etat, aujourd),
    couvertsMidi: couvertsMidiAvecVentes(etat, aujourd, heure),
    aAvancer: aAvancerDe(feuille),
    maintenant: maintenantDe(etat, feuille),
    avancement: feuille ? feuille.avancement : { faites: 0, total: 0 },
    avancementJour: avancementDuJour(feuille),
    decisions: aConfirmerDuBord(etat, datesSemaine, aujourd),
    // Fiche de fonction du tableau de bord : seulement si elle tombe aujourd'hui ou demain.
    ficheProche: ficheProche && ficheProche.date <= ajouterJours(aujourd, 1) ? ficheProche : null,
    production: productionDuBord(etat, aujourd, lundi),
    sauvegarde: rappelSauvegarde(etat, aujourd),
    semaineSansMenu: semaineSansMenu(etat, lundi),
    // Décision du 2026-10-07 : le vendredi (et le week-end, jusqu'à l'import), la semaine suivante sans menu est rappelée.
    rappelCloture: rappelCloture(etat, aujourd, heure),
    rappelVendredi: jourSemaine(aujourd) >= 5 && semaineSansMenu(etat, ajouterJours(lundi, 7)) ? { lundi: ajouterJours(lundi, 7) } : null,
  };
}
