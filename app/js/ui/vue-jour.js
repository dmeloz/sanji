// Jour (feuille quotidienne) : la LISTE DE MISE EN PLACE du jour (refonte minimaliste, retours d'essai du 2026-10-09).
// Par menu (M1, M2), puis « Autres » et « Après service » : une ligne par tâche = case, verbe + produit, quantité en g ou kg
// à droite. Aucune liste à dérouler : ce qui est secondaire tient en une ligne tappable qui ouvre une feuille (lecture seule).
// Montrer l'exception, pas la normalité : la sous-ligne ne dit que les avances (« Pour mar. 6 »), « déjà avancé », les avances
// hors règle et les avertissements de conservation ; un plat sans portion dit « à saisir » sur la ligne (un toucher, un champ).
// Le créneau, les portions et la provenance se lisent dans la fiche.

import { calculerComposant } from '../domaine/calcul.js';
import { estOuvert, joursEntre, libelleJour, lundiDe } from '../domaine/dates.js';
import { saisirPortionInconnue } from '../domaine/actions-preparation.js';
import { aSaisirPortion, quantiteEnPoids, verbeDe } from '../domaine/mise-en-place.js';
import { aideRefroidissement, evaluationProduction } from '../domaine/planification.js';
import { libelle } from '../domaine/statuts.js';
import { h } from './dom.js';
import { agir } from '../magasin.js';
import { bouton, etatVide, imprimer, encadre, ligneVide, lien, pastille } from './elements.js';
import { parseNombre, phraseConservation, qteNoeuds } from './format.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';
import {
  actionsTache, dialogPlanifier, dialogPreparatoire, faireEnUnToucher, defaireEnUnToucher, noeudEvaluation, pastilleCreneau, texteCharge,
} from './taches.js';

export const titre = () => 'Production';

const COCHABLES = new Set(['a_planifier', 'a_faire', 'en_cours', 'ecart']);

/** « mar. 6 » : jour abrégé et numéro. */
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

// L'en-tête, les menus en petit et le changement de jour (glissement, flèches) vivent dans vue-production.js.

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
  if (p?.etat === 'fait') return quantiteEnPoids(l.quantiteReelle, l.unite);
  // Un plat « composition à définir » n'a que ses portions (unité « portion ») : ce n'est pas une quantité à cuire.
  if (l.unite === 'portion') return null;
  return quantiteEnPoids(l.cible, l.unite);
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
  if (l.source === 'attendue' && l.jourDecide) notes.push({ texte: `prévu ${libelleJour(l.jourDecide)}`, ton: 'doux' });
  if (ev && ev.jours > 0 && !ev.autorisee) {
    // La cause est dite sur la ligne : une avance d'un jour peut être hors règle (maximum de l'étape dépassé).
    notes.push({ texte: `hors règle · ${ev.alertes.some((a) => /plus de deux jours/.test(a)) ? 'plus de deux jours d\'avance' : 'au-delà du maximum de l\'étape'}`, ton: 'ambre' });
  }
  // « à planifier » est l'état ordinaire d'une ligne : seuls « en cours » et « écart » se disent.
  if (['en_cours', 'ecart'].includes(l.etat)) notes.push({ texte: libelle('ETAT_TACHE', l.etat), ton: l.etat === 'en_cours' ? 'doux' : 'ambre' });
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

/** Portion tapée en un toucher : « à saisir » ouvre un champ (g par portion) et « OK » l'enregistre (comme « Préparer la semaine »). */
function panneauSaisie(etat, l, nom) {
  const c = etat.composants[l.composantId];
  const unite = c.grammage?.unite ?? 'g';
  const champ = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', classe: 'prep-champ', 'aria-label': `${nom} : portion en ${libelle('UNITE', unite)}` });
  const valider = (evenement) => {
    evenement?.preventDefault?.();
    let valeur;
    try { valeur = parseNombre(champ.value, nom); } catch (erreur) { afficherMessage(erreur.message, 'erreur'); return; }
    if (valeur === null) { afficherMessage(`${nom} : tapez la portion en ${libelle('UNITE', unite)}.`, 'erreur'); return; }
    const r = agir((e, t) => saisirPortionInconnue(e, l.composantId, valeur, t));
    if (r.ok) afficherMessage(`${nom} : ${valeur} ${libelle('UNITE', unite)} par portion retenu${r.valeur.portee === 'standard' ? ' pour toutes les semaines' : ' pour ce plat'}.`, 'ok');
  };
  return { champ, noeud: h('form', { classe: 'prod-saisie', novalidate: true, onSubmit: valider, hidden: true },
    champ, h('span', { classe: 'prod-saisie-unite' }, `${libelle('UNITE', unite)} par portion`), bouton('OK', valider, 'court', { type: 'submit', 'aria-label': `Valider la portion de ${nom}` })) };
}

/**
 * Ligne de mise en place : case, [verbe] nom (lien vers la fiche), quantité en g ou kg à droite (police des quantités). Une
 * quantité inconnue dit « à saisir » (portion à taper, un toucher) ou « à préciser », jamais « — » seul. Une sous-ligne
 * seulement pour l'exception (voir `notesDeLigne`). Les autres gestes s'ouvrent depuis « ⋯ » (Actions : <plat>), qui porte aussi
 * l'évaluation de l'avance. Une proposition montre « Planifier » directement. Les avertissements de conservation restent dits.
 */
function ligneTache(etat, ligneBrute, date, options) {
  const l = { ...ligneBrute, avanceJours: ligneBrute.avanceJours ?? Math.max(0, joursEntre(date, ligneBrute.dateService)) };
  const p = etat.productions[l.productionId];
  const fait = p?.etat === 'fait';
  const q = texteQuantite(etat, l);
  const nom = l.genre === 'principale' ? l.nom : (l.libelle || l.nom);
  const verbe = l.genre === 'principale' ? verbeDe(etat.composants?.[l.composantId]) : null;
  // L'évaluation de l'avance (limite d'utilisation, règle) reste lisible, derrière « ⋯ ».
  const ev = l.evaluation ?? evaluationProduction(etat, l.productionId);
  const notes = notesDeLigne({ ...l, fait }, ev, date);
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
  // Quantité : en g ou kg ; inconnue, l'étiquette dit pourquoi (portion à saisir, ou autre manque).
  let saisie = null;
  let quantiteNoeud = null;
  if (q) quantiteNoeud = h('strong', { classe: 'mep-qte' }, qteNoeuds(q));
  else if (l.genre !== 'preparatoire' && !fait && aSaisirPortion(etat, l.composantId)) {
    saisie = panneauSaisie(etat, l, nom);
    quantiteNoeud = h('button', {
      type: 'button', classe: 'prod-asaisir', 'aria-label': `${nom} : portion à saisir`,
      onClick: () => { saisie.noeud.hidden = !saisie.noeud.hidden; if (!saisie.noeud.hidden) saisie.champ.focus?.(); },
    }, pastille('à saisir', 'ambre'));
  } else if (l.genre !== 'preparatoire') quantiteNoeud = h('span', { classe: 'prod-apreciser' }, pastille('à préciser', 'ambre'));
  return h('li', { classe: `mep-ligne prod-ligne mep-${fait ? 'fait' : l.etat}` },
    h('div', { classe: 'prod-principal' },
      fait ? caseFaite(l) : COCHABLES.has(l.etat) ? caseFait(l) : h('span', { classe: 'case-fait case-fait-vide' }),
      h('div', { classe: 'mep-corps' },
        h('div', { classe: 'prod-nom-ligne' },
          verbe ? h('span', { classe: 'prod-verbe' }, `${verbe}\u00a0`) : null,
          lien(`#/fiche/${encodeURIComponent(l.composantId)}`, nom, 'prod-nom tache-nom mep-nom')),
        notes.length > 0 ? h('p', { classe: 'mep-meta prod-notes' }, notes.map((n, i) => h('span', { classe: `prod-note prod-note-${n.ton}` }, i > 0 ? ` · ${n.texte}` : n.texte))) : null,
        avertissementConservation(ev),
        surLaLigne.length > 0 ? h('div', { classe: 'actions prod-directes' }, surLaLigne) : null),
      h('div', { classe: 'mep-quantite' }, quantiteNoeud),
      // « ⋯ » a sa propre colonne (la même à chaque ligne) ; sans actions, son emplacement reste vide.
      plus ?? h('span', { classe: 'prod-plus-vide', 'aria-hidden': 'true' })),
    saisie?.noeud ?? null,
    panneau);
}

const estHorsRegle = (l) => !l.fait && Boolean(l.evaluation) && l.evaluation.jours > 0 && !l.evaluation.autorisee;

/** La phrase de refroidissement en une ligne courte : sans le détail des températures ni la source (elles restent dans la fiche). */
const aideCourte = () => aideRefroidissement()?.replace(/\s*\([^)]*\)/g, '') ?? null;

/** Les tâches faites restent dans leur menu, grisées, rangées en bas (ordre de lecture conservé dans chaque moitié). */
const faitesEnBas = (lignes) => [...lignes.filter((l) => !l.fait), ...lignes.filter((l) => l.fait)];

/** Un bloc toujours déplié : titre court (M1, M2, Autres, Après service) puis ses lignes, sans « voir plus ». */
function bloc(titreTexte, lignes, etat, date, aide = null) {
  if (lignes.length === 0) return null;
  return h('section', { classe: 'jour-bloc' },
    h('h2', { classe: 'section-titre prod-groupe-titre' }, titreTexte),
    aide ? h('p', { classe: 'aide mep-aide-froid' }, aide) : null,
    h('ul', { classe: 'mep-liste' }, faitesEnBas(lignes).map((l) => ligneTache(etat, l, date, {}))));
}

/** Une ligne de résumé tappable (compte + ›) qui ouvre une feuille en lecture seule : jamais une liste à dérouler. */
function resume(texte, titreFeuille, corps) {
  return h('button', {
    type: 'button', classe: 'prod-resume',
    onClick: () => panneau({ titre: titreFeuille, corps, lectureSeule: true }),
  }, h('span', { classe: 'prod-resume-texte' }, texte), h('span', { classe: 'prod-resume-fleche', 'aria-hidden': 'true' }, '›'));
}

// ------------------------------------------------------------------ rubriques secondaires : une ligne, une feuille

/** Une quantité inconnue n'est pas une décision : information neutre, une ligne tappable qui ouvre sa feuille. */
function rubriqueQuantites(feuille) {
  const manquants = feuille.quantitesManquantes;
  if (manquants.length === 0) return null;
  const noms = [...new Set(manquants.map((q) => q.nom))];
  const apercu = `${noms.slice(0, 6).join(', ')}${noms.length > 6 ? `, et ${noms.length - 6} autres` : ''}`;
  const premier = manquants.map((q) => q.dateService).sort()[0];
  const phrase = `${noms.length === 1 ? '1 élément n\'a' : `${noms.length} éléments n'ont`} pas encore de quantité : ${apercu}.`;
  return resume(`Pas encore chiffré : ${noms.length}`, 'Pas encore chiffré', () => h('div', null,
    h('p', null, phrase),
    h('p', { classe: 'aide' }, 'Rien d\'obligatoire : saisissez les prévisions et les portions quand vous voulez, ou modifiez-les le lendemain. Tout se recalcule.'),
    h('div', { classe: 'actions' },
      lien(`#/import/${lundiDe(premier)}`, 'Saisir les prévisions', 'btn btn-court'),
      lien('#/reglages', 'Régler les standards maison', 'btn btn-court'))));
}

/** Suggestion seulement : une ligne ; la préparation et ses quantités se lisent dans la feuille. */
function rubriqueLots(feuille) {
  if (feuille.lots.length === 0) return null;
  return resume(`À faire en une fois : ${pluriel(feuille.lots.length, 'lot possible', 'lots possibles')}`, 'À faire en une fois', () => h('div', null,
    h('p', { classe: 'aide' }, 'Suggestion : la même préparation peut servir plusieurs services dans la limite d\'avance autorisée. Chaque tâche garde sa part et se marque faite séparément.'),
    h('ul', { classe: 'liste-lots' }, feuille.lots.map((l) => h('li', null,
      h('strong', null, l.libelle), ` : ${quantiteEnPoids(l.total, l.unite)} en une fois, pour ${l.productions.map((x) => libelleJour(x.dateService)).join(' et ')} `,
      lien(`#/fiche/${encodeURIComponent(l.productions[0].composantId)}`, 'Détail', 'jour-lien'))))));
}

/** Charge des créneaux : une ligne discrète. */
function chargeDesCreneaux(feuille) {
  const groupes = feuille.aFaire.filter((g) => g.creneau && g.charge && g.taches.length > 0);
  if (groupes.length === 0) return null;
  return resume('Charge des créneaux', 'Charge des créneaux', () => h('div', null, groupes.map((g) => h('div', { classe: 'groupe-creneau' },
    h('p', { classe: 'meta' }, `${libelle('CRENEAU', g.creneau)} : ${texteCharge(g.charge)} `,
      g.etatCreneau && g.etatCreneau !== 'libre' ? pastilleCreneau(g.etatCreneau) : null),
    g.charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a))))));
}

/** Les préparations faites un jour précédent pour plus tard : une ligne, la liste en lecture seule dans la feuille. */
function rubriquePretes(lignes) {
  if (lignes.length === 0) return null;
  return resume(`Déjà prêt pour plus tard : ${lignes.length}`, 'Déjà prêt pour plus tard', () => h('ul', { classe: 'liste-lots' }, lignes.map((l) => {
    const q = quantiteEnPoids(l.quantiteReelle, l.unite);
    return h('li', null, h('strong', null, l.genre === 'principale' ? l.nom : (l.libelle || l.nom)), q ? ` : ${q}` : '', ` · pour ${libelleJour(l.dateService)}`);
  })));
}

// ------------------------------------------------------------------ la page

/**
 * Corps de la page Production pour un jour : blocs de mise en place (M1, M2, Autres, Après service), lignes de résumé et
 * pied de page. L'en-tête, les menus en petit et le changement de jour sont dans vue-production.js.
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
  const toutes = [...lecture.service1, ...lecture.service2, ...lecture.autres, ...lecture.apres];
  if (toutes.length === 0) {
    if (lecture.pretsPlusTard.length > 0 || feuille.avancement.total > 0) noeuds.push(ligneVide('Tout est fait.'));
    else if (!estOuvert(date)) noeuds.push(ligneVide('Aucune tâche décidée pour ce jour.'));
    else {
      noeuds.push(etatVide({
        titre: 'Rien à produire ce jour', texte: 'Pas de menu ce jour-là, ou tout a déjà été avancé.',
        actions: [{ libelle: 'Voir la semaine', href: `#/semaine/${lundiDe(date)}` }, { libelle: 'Importer les menus', href: `#/import/${lundiDe(date)}` }],
      }));
    }
  }
  // Hors règle en tête de « Après service » : la ligne le dit (étiquette), rien n'est caché ni décidé à la place du chef.
  const apres = [...lecture.apres.filter(estHorsRegle), ...lecture.apres.filter((l) => !estHorsRegle(l))];
  for (const b of [
    bloc('M1', lecture.service1, etat, date),
    bloc('M2', lecture.service2, etat, date),
    bloc('Autres', lecture.autres, etat, date),
    bloc('Après service', apres, etat, date, aideCourte()),
  ]) if (b) noeuds.push(b);
  const resumes = [rubriquePretes(lecture.pretsPlusTard), rubriqueQuantites(feuille), rubriqueLots(feuille), chargeDesCreneaux(feuille)].filter(Boolean);
  if (resumes.length > 0) noeuds.push(h('div', { classe: 'prod-resumes' }, resumes));
  noeuds.push(h('div', { classe: 'barre-jour pas-imprime' }, bouton('Imprimer la feuille du jour', imprimer, 'court')));
  return noeuds;
}
