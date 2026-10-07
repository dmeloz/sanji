// Jour (feuille quotidienne) : une seule liste à plat de mise en place, dans l'ordre de lecture du poste (refonte 2, style épuré).
// Menu 1, menu 2, autres tâches, puis les avances pour les jours suivants (une ligne « N avances à planifier »). Une ligne par
// tâche : case, nom, quantité. Aucun filtre ne cache de tâche ; une tâche faite reste dans son menu, grisée (sans barré) et
// rangée en bas ; seules les préparations faites un jour précédent pour plus tard sont repliées.
// Montrer l'exception, pas la normalité : la sous-ligne ne dit que « à préciser », « déjà avancé », les avances hors règle et
// les avertissements de conservation ; le créneau, les portions et la provenance se lisent dans la fiche. Les décisions se
// disent une fois (l'étiquette « N à décider » de Production, qui ouvre la feuille « À décider »).

import { calculerComposant } from '../domaine/calcul.js';
import { estOuvert, joursEntre, libelleJour, lundiDe } from '../domaine/dates.js';
import { aideRefroidissement, evaluationProduction } from '../domaine/planification.js';
import { libelle } from '../domaine/statuts.js';
import { h } from './dom.js';
import { bouton, imprimer, encadre, ligneVide, lien, repliable } from './elements.js';
import { formaterHeure, phraseConservation, qteNoeuds, quantite } from './format.js';
import {
  actionsTache, dialogPlanifier, dialogPreparatoire, faireEnUnToucher, defaireEnUnToucher, noeudEvaluation, pastilleCreneau, texteCharge,
} from './taches.js';

export const titre = () => 'Production';

const COCHABLES = new Set(['a_planifier', 'a_faire', 'en_cours', 'ecart']);
const POIDS = { fini: 'quantité finie' };

/** « mar. 6 » : jour abrégé et numéro. */
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

// L'en-tête, le sélecteur Aujourd'hui / Demain et la barre de jours vivent dans vue-production.js.

// ------------------------------------------------------------------ une ligne de mise en place

/** Case à cocher : « Fait » en un toucher, sans bandeau ; toucher la case cochée remet la tâche à faire. */
function caseFait(l) {
  return h('button', {
    type: 'button', role: 'checkbox', 'aria-checked': 'false', classe: 'case-fait',
    onClick: () => faireEnUnToucher(l.productionId, { sansBandeau: true }),
  }, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }), h('span', { classe: 'sr' }, `Marquer fait : ${l.genre === 'principale' ? l.nom : (l.libelle || l.nom)}`));
}

/** Case cochée d'une tâche faite : la toucher la décoche (annulerFait ; un refus est dit en texte, rien ne change). */
const caseFaite = (l) => h('button', {
  type: 'button', role: 'checkbox', 'aria-checked': 'true', classe: 'case-fait case-fait-ok',
  onClick: () => defaireEnUnToucher(l.productionId),
}, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }, '✓'),
h('span', { classe: 'sr' }, `Marquer non fait : ${l.genre === 'principale' ? l.nom : (l.libelle || l.nom)}`));

function texteQuantite(etat, l) {
  const p = etat.productions[l.productionId];
  if (l.genre === 'preparatoire') return null;
  if (p?.etat === 'fait') return Number.isFinite(l.quantiteReelle) ? quantite(l.quantiteReelle, l.unite) : null;
  return l.cible !== null ? quantite(l.cible, l.unite) : null;
}

/** État du poids dit à la suite de l'unité (« g cru net ») ; jamais caché. */
function poidsDe(l) {
  if (!l.etatPoids) return null;
  return POIDS[l.etatPoids] ?? libelle('ETAT_POIDS', l.etatPoids);
}

/**
 * Sous-ligne d'une tâche : seulement ce qui sort de l'ordinaire. « à préciser » et les états à trancher en or paille, « déjà avancé »,
 * « Pour mar. 6 » (avance) et les causes d'une avance hors règle. Le texte dit toujours l'état : jamais la couleur seule.
 * @returns {{texte: string, ton: 'ambre'|'doux'}[]}
 */
function notesDeLigne(l, ev, date) {
  const notes = [];
  if (l.avanceJours > 0) notes.push({ texte: `Pour ${courtJour(l.dateService)}`, ton: 'doux' });
  if (l.fait && l.hFait) {
    const avantAujourdhui = l.hFait.slice(0, 10) < date;
    // Une étape faite avant ce jour : « déjà avancé sam. 3 » (le jour où elle a été faite).
    if (l.etapeCle && avantAujourdhui) notes.push({ texte: `déjà avancé ${courtJour(l.hFait.slice(0, 10))}`, ton: 'doux' });
    else if (avantAujourdhui && l.dateService === date) notes.push({ texte: 'déjà avancé', ton: 'doux' });
  }
  if (l.fait) return notes;
  if (l.etat === 'a_preciser') notes.push({ texte: 'à préciser', ton: 'ambre' });
  if (l.source === 'attendue' && l.jourDecide) notes.push({ texte: `prévu ${libelleJour(l.jourDecide)}`, ton: 'doux' });
  if (ev && ev.jours > 0 && !ev.autorisee) {
    // La cause est dite sur la ligne : une avance d'un jour peut être hors règle (maximum de l'étape dépassé).
    notes.push({ texte: `hors règle · ${ev.alertes.some((a) => /plus de deux jours/.test(a)) ? 'plus de deux jours d\'avance' : 'au-delà du maximum de l\'étape'}`, ton: 'ambre' });
  }
  // Une proposition est « à planifier » par nature : le titre du groupe le dit.
  if (l.source !== 'suggestion' && ['a_planifier', 'en_cours', 'ecart'].includes(l.etat)) {
    notes.push({ texte: libelle('ETAT_TACHE', l.etat), ton: l.etat === 'en_cours' ? 'doux' : 'ambre' });
  }
  return notes;
}

/**
 * Avertissement de conservation du référentiel (jamais un blocage) : en texte, avec sa provenance sur une ligne.
 * Seulement quand l'avance dépasse la durée de base et que la propriétaire n'a saisi aucune limite.
 */
function avertissementConservation(ev) {
  if (!ev || ev.conservation !== 'referentiel' || !ev.repere?.depasse) return null;
  return h('p', { classe: 'mep-conservation' },
    h('strong', null, phraseConservation(ev.repere.texte, ev.jours)), ' ',
    h('span', { classe: 'mep-provenance' }, ev.repere.provenance));
}

/**
 * Actions de la ligne hors « Fait » (déjà sur la case). Sur une proposition, « Planifier » est montré directement sur la ligne
 * (`directes`) ; tout le reste s'ouvre depuis la ligne (nom ou « ⋯ ») et se range dans `autres`.
 */
function actionsDeLigne(etat, l, date) {
  const p = etat.productions[l.productionId];
  if (l.source === 'suggestion') {
    const horsRegle = !l.evaluation.autorisee;
    return {
      directes: [bouton(horsRegle ? 'Planifier quand même' : 'Planifier', () => dialogPlanifier(l.productionId, 'planifier', { date, creneau: l.creneau ?? undefined }), 'court')],
      autres: [horsRegle ? bouton('Noter une action préparatoire', () => dialogPreparatoire(l.composantId), 'court') : null],
    };
  }
  return { directes: [], autres: actionsTache(l, p).filter((n) => n.textContent !== 'Fait') };
}

/** Provenance de la quantité d'une ligne, avec le vocabulaire existant ; null quand la quantité n'est pas calculée. */
export function provenanceQuantite(etat, composantId) {
  if (!etat.composants?.[composantId]) return null;
  const calc = calculerComposant(etat, composantId);
  if (calc.statut !== 'CALCULE') return null;
  if (calc.standardBase) return libelle('PROVENANCE', 'STANDARD_BASE');
  const grammage = calc.dependances.find((d) => d.parametre === 'grammage');
  if (grammage && ['RESTAURANT_VALIDE', 'SAISI_SERVICE'].includes(grammage.statut)) return libelle('PROVENANCE', grammage.statut);
  return libelle('PROVENANCE', 'CALCULE');
}

/**
 * Provenance à dire sur la ligne : seulement quand elle sort de l'ordinaire (« standard de base », « inconnu »). Une valeur
 * calculée, validée ou saisie ne se répète pas sur chaque ligne ; la provenance complète reste dans la fiche.
 */
export function provenanceAMontrer(provenance) {
  return provenance === libelle('PROVENANCE', 'STANDARD_BASE') || provenance === libelle('PROVENANCE', 'INCONNU') ? provenance : null;
}

let compteurActions = 0;

/**
 * Ligne de mise en place (maquette Production, refonte 2) : case, nom (lien vers la fiche), quantité en chiffres de quantité avec
 * l'unité et l'état du poids ; une sous-ligne seulement pour l'exception (voir `notesDeLigne`). Les autres gestes s'ouvrent depuis
 * « ⋯ » (Actions : <plat>), qui porte aussi l'évaluation de l'avance. Une proposition montre « Planifier » directement.
 * Les avertissements de conservation restent dits. Le créneau, les portions et la provenance se lisent dans la fiche.
 */
function ligneTache(etat, ligneBrute, date, options) {
  const l = { ...ligneBrute, avanceJours: ligneBrute.avanceJours ?? Math.max(0, joursEntre(date, ligneBrute.dateService)) };
  const p = etat.productions[l.productionId];
  const fait = p?.etat === 'fait';
  const q = texteQuantite(etat, l);
  const nom = l.genre === 'principale' ? l.nom : (l.libelle || l.nom);
  // L'évaluation de l'avance (limite d'utilisation, règle) reste lisible, derrière « ⋯ ».
  const ev = l.evaluation ?? evaluationProduction(etat, l.productionId);
  const notes = notesDeLigne({ ...l, fait }, ev, date);
  const poids = poidsDe(l);
  const { directes, autres: autresActions } = actionsDeLigne(etat, l, date);
  const actions = autresActions.filter(Boolean);
  const evaluation = ev && ev.jours > 0 ? noeudEvaluation(ev) : null;
  const surLaLigne = directes.filter(Boolean);
  let panneau = null;
  let plus = null;
  if (actions.length > 0 || evaluation) {
    compteurActions += 1;
    const idActions = `prod-actions-${compteurActions}`;
    panneau = h('div', { classe: 'prod-actions', id: idActions, hidden: true }, evaluation, h('div', { classe: 'actions' }, actions));
    plus = h('button', {
      type: 'button', classe: 'prod-plus', 'aria-label': `Actions : ${nom}`, 'aria-expanded': 'false', 'aria-controls': idActions,
      onClick: () => { panneau.hidden = !panneau.hidden; plus.setAttribute('aria-expanded', String(!panneau.hidden)); },
    }, '⋯');
  }
  return h('li', { classe: `mep-ligne prod-ligne mep-${fait ? 'fait' : l.etat}` },
    h('div', { classe: 'prod-principal' },
      fait ? caseFaite(l) : COCHABLES.has(l.etat) ? caseFait(l) : h('span', { classe: 'case-fait case-fait-vide' }),
      h('div', { classe: 'mep-corps' },
        h('div', { classe: 'prod-nom-ligne' }, lien(`#/fiche/${encodeURIComponent(l.composantId)}`, nom, 'prod-nom tache-nom mep-nom')),
        notes.length > 0 ? h('p', { classe: 'mep-meta prod-notes' }, notes.map((n, i) => h('span', { classe: `prod-note prod-note-${n.ton}` }, i > 0 ? ` · ${n.texte}` : n.texte))) : null,
        avertissementConservation(ev),
        surLaLigne.length > 0 ? h('div', { classe: 'actions prod-directes' }, surLaLigne) : null),
      h('div', { classe: 'mep-quantite' },
        q ? h('strong', { classe: 'mep-qte' }, qteNoeuds(q)) : (l.genre === 'preparatoire' ? null : h('span', { classe: 'mep-neutre' }, '—', h('span', { classe: 'sr' }, ' quantité à compléter'))),
        q && poids ? h('span', { classe: 'mep-poids' }, poids) : null),
      // « ⋯ » a sa propre colonne (la même à chaque ligne) ; sans actions, son emplacement reste vide.
      plus ?? h('span', { classe: 'prod-plus-vide', 'aria-hidden': 'true' })),
    panneau);
}

const LIGNES_VISIBLES = 8;
const estHorsRegle = (l) => !l.fait && Boolean(l.evaluation) && l.evaluation.jours > 0 && !l.evaluation.autorisee;

/** La phrase de refroidissement en une ligne courte : sans le détail des températures ni la source (elles restent dans la fiche). */
const aideCourte = () => aideRefroidissement()?.replace(/\s*\([^)]*\)/g, '') ?? null;

/** Les tâches faites restent dans leur menu, grisées, rangées en bas (ordre de lecture conservé dans chaque moitié). */
const faitesEnBas = (lignes) => [...lignes.filter((l) => !l.fait), ...lignes.filter((l) => l.fait)];

function liste(lignes, etat, date, groupe) {
  return h('ul', { classe: 'mep-liste' }, lignes.map((l) => ligneTache(etat, l, date, { groupe })));
}

function bloc(titreTexte, lignes, etat, date, groupe) {
  if (lignes.length === 0) return null;
  const rangees = faitesEnBas(lignes);
  // Page courte : au-delà de 8 lignes de travail, la suite se replie sous « Voir les N autres » (un compte et un toucher).
  const visibles = rangees.slice(0, LIGNES_VISIBLES);
  const suite = rangees.slice(LIGNES_VISIBLES);
  return h('section', { classe: 'jour-bloc' },
    h('h2', { classe: 'section-titre prod-groupe-titre' }, titreTexte),
    visibles.length > 0 ? liste(visibles, etat, date, groupe) : null,
    suite.length > 0 ? repliable(`Voir les ${suite.length} autres`, false, liste(suite, etat, date, groupe), { classe: 'jour-hors-regle' }) : null);
}

/**
 * Avances pour les jours suivants : une seule ligne repliée, « N avances à planifier » (les propositions, dites une fois dans le
 * titre) ; la liste, avec « Planifier » sur chaque proposition et la phrase de refroidissement, s'ouvre au toucher.
 */
function blocAvances(lignes, etat, date) {
  if (lignes.length === 0) return null;
  const propositions = lignes.filter((l) => l.source === 'suggestion').length;
  const resume = propositions > 0 ? pluriel(propositions, 'avance à planifier', 'avances à planifier') : 'Avances pour les jours suivants';
  const aide = aideCourte();
  return repliable(resume, false, [
    aide ? h('p', { classe: 'aide mep-aide-froid' }, aide) : null,
    liste(faitesEnBas(lignes), etat, date, 'apres'),
  ], { classe: 'prod-avances' });
}

/**
 * Avances hors règle : toujours repliées, avec leur compte et le mot, juste sous le bandeau (jamais cachées, jamais décidées à
 * la place du chef). Celles qui sont dans la règle (J+1, J+2) restent dans « Après service ».
 */
function rubriqueHorsRegle(lignes, etat, date) {
  if (lignes.length === 0) return null;
  return repliable(lignes.length === 1 ? '1 avance hors règle' : `${lignes.length} avances hors règle`, false,
    h('ul', { classe: 'mep-liste' }, lignes.map((l) => ligneTache(etat, l, date, { groupe: 'apres' }))), { classe: 'jour-hors-regle' });
}

// ------------------------------------------------------------------ décisions, quantités, lots, charge

/** Une quantité inconnue n'est pas une décision : information neutre, une seule rubrique calme. */
function rubriqueQuantites(feuille) {
  const manquants = feuille.quantitesManquantes;
  if (manquants.length === 0) return null;
  const noms = [...new Set(manquants.map((q) => q.nom))];
  const apercu = `${noms.slice(0, 6).join(', ')}${noms.length > 6 ? `, et ${noms.length - 6} autres` : ''}`;
  const premier = manquants.map((q) => q.dateService).sort()[0];
  const phrase = `${noms.length === 1 ? '1 élément n\'a' : `${noms.length} éléments n'ont`} pas encore de quantité : ${apercu}.`;
  // Information neutre, pliée : la phrase rassurante (« Rien d'obligatoire… ») vit ici, pas sur la page.
  return repliable('Pas encore chiffré', false, [
    h('p', null, phrase),
    h('p', { classe: 'aide' }, 'Rien d\'obligatoire : saisissez les prévisions et les portions quand vous voulez, ou modifiez-les le lendemain. Tout se recalcule.'),
    h('div', { classe: 'actions' },
      lien(`#/import/${lundiDe(premier)}`, 'Saisir les prévisions', 'btn btn-court'),
      lien('#/reglages', 'Régler les standards maison', 'btn btn-court')),
  ], { classe: 'jour-neutre' });
}

/** Suggestion seulement : une ligne repliable ; la préparation et ses quantités se lisent dans la feuille de chaque tâche. */
function rubriqueLots(feuille) {
  if (feuille.lots.length === 0) return null;
  return repliable(`À faire en une fois : ${pluriel(feuille.lots.length, 'lot possible', 'lots possibles')}`, false, [
    h('p', { classe: 'aide' }, 'Suggestion : la même préparation peut servir plusieurs services dans la limite d\'avance autorisée. Chaque tâche garde sa part et se marque faite séparément.'),
    h('ul', { classe: 'liste-lots' }, feuille.lots.map((l) => h('li', null,
      h('strong', null, l.libelle), ` : ${quantite(l.total, l.unite)} en une fois, pour ${l.productions.map((x) => libelleJour(x.dateService)).join(' et ')} `,
      lien(`#/fiche/${encodeURIComponent(l.productions[0].composantId)}`, 'Détail', 'jour-lien')))),
  ], { classe: 'jour-lots' });
}

/** Charge des créneaux : un repli discret, pour ne pas surcharger la liste. */
function chargeDesCreneaux(feuille) {
  const groupes = feuille.aFaire.filter((g) => g.creneau && g.charge && g.taches.length > 0);
  if (groupes.length === 0) return null;
  return repliable('Charge des créneaux', false, groupes.map((g) => h('div', { classe: 'groupe-creneau' },
    h('p', { classe: 'meta' }, `${libelle('CRENEAU', g.creneau)} : ${texteCharge(g.charge)} `,
      g.etatCreneau && g.etatCreneau !== 'libre' ? pastilleCreneau(g.etatCreneau) : null),
    g.charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a)))), { classe: 'jour-charge' });
}

// ------------------------------------------------------------------ la page

/**
 * Corps de la page Production pour un jour : rappel des menus, décisions, blocs de mise en place, replis, rubriques
 * et pied de page. L'en-tête et la navigation entre jours sont dans vue-production.js.
 */
export function corps(etat, date, feuille) {
  const { lecture } = feuille;
  const noeuds = [];
  if (!estOuvert(date)) {
    noeuds.push(h('p', { classe: 'ferme' }, 'fermé'));
    noeuds.push(h('p', { classe: 'aide' }, 'Le dimanche est non travaillé : aucune tâche. Il reste compté dans le temps de conservation.'));
  }
  if (feuille.revueMiSemaine) {
    noeuds.push(encadre('info', 'Mardi : revue de mi-semaine après le service, pour les préparations de mercredi à vendredi.'));
  }
  // Les décisions se disent une fois : le bandeau « N décisions à prendre » de Production ouvre la feuille « À décider ».
  const toutes = [...lecture.service1, ...lecture.service2, ...lecture.autres, ...lecture.apres];
  const horsRegle = lecture.apres.filter(estHorsRegle);
  const enRegle = lecture.apres.filter((l) => !estHorsRegle(l));
  const rubriqueHors = rubriqueHorsRegle(horsRegle, etat, date);
  if (rubriqueHors) noeuds.unshift(rubriqueHors);

  const lignesDeTravail = toutes.length;
  if (lignesDeTravail === 0) {
    noeuds.push(ligneVide(lecture.pretsPlusTard.length > 0 || feuille.avancement.total > 0 ? 'Tout est fait.' : 'Aucune tâche décidée pour ce jour.'));
  }
  for (const b of [
    bloc('Menu 1', lecture.service1, etat, date, 'service'),
    bloc('Menu 2', lecture.service2, etat, date, 'service'),
    bloc('Autres tâches', lecture.autres, etat, date, 'autres'),
    blocAvances(enRegle, etat, date),
  ]) if (b) noeuds.push(b);
  if (lecture.pretsPlusTard.length > 0) {
    noeuds.push(repliable(`Déjà prêt (${lecture.pretsPlusTard.length})`, false,
      h('ul', { classe: 'mep-liste' }, lecture.pretsPlusTard.map((l) => ligneTache(etat, { ...l, etat: 'fait' }, date, { groupe: 'faites' }))),
      { classe: 'jour-faites' }));
  }
  for (const r of [rubriqueQuantites(feuille), rubriqueLots(feuille), chargeDesCreneaux(feuille)]) {
    if (r) noeuds.push(r);
  }
  noeuds.push(h('div', { classe: 'barre-jour pas-imprime' }, bouton('Imprimer la feuille du jour', imprimer, 'court')));
  return noeuds;
}
