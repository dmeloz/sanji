// Tâches de production : carte, évaluation d'avance et panneaux (planifier, reporter, fait, corriger, décider).
// Partagé entre la feuille quotidienne et la vue d'un composant.

import { creneauxDuJour, estDateValide, libelleJour } from '../domaine/dates.js';
import { calculerComposant } from '../domaine/calcul.js';
import {
  chargeCreneau, cibleProduction, ecartProduction, etatCreneau, etatTache, evaluerAvance, regleDe, reelNonCompte, repereConservation, suggererCreneau,
} from '../domaine/planification.js';
import {
  ajouterPreparatoire, annulerFait, corrigerReel, deciderEcart, demarrer, marquerFait, planifier, reporter, supprimerProduction,
} from '../domaine/actions.js';
import { libelle } from '../domaine/statuts.js';
import { agir, agirStrict, etat as etatCourant } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, lien, pastille } from './elements.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { pluriel, quantite } from './format.js';

const VARIANTE_ETAT = {
  a_preciser: 'gris', a_planifier: 'ambre', a_faire: 'gris', en_cours: 'vert', fait: 'vert', ecart: 'rouge',
};

/** Ligne d'affichage d'une production (assemblage de fonctions du domaine, sans règle propre). */
export function ligneProduction(etat, p) {
  const composant = etat.composants[p.composantId] ?? null;
  const calc = composant ? calculerComposant(etat, composant.id) : null;
  return {
    productionId: p.id, composantId: p.composantId, nom: composant?.nom ?? p.libelle, menu: composant?.menu ?? null,
    dateService: p.dateService, genre: p.genre, libelle: p.libelle, jourDecide: p.jourDecide,
    creneauDecide: p.creneauDecide, etat: etatTache(etat, p.id), cible: cibleProduction(etat, p.id),
    unite: p.unite ?? calc?.uniteTravail ?? null, quantiteReelle: p.quantiteReelle, charge: composant?.charge ?? null,
    etapeCle: p.etapeCle ?? null, ordre: p.ordre ?? null,
  };
}

/** Pastilles et textes décrivant une évaluation d'avance (résultat de `evaluerAvance`). */
export function noeudEvaluation(ev) {
  if (!ev) return null;
  const morceaux = [];
  if (ev.jours !== null && ev.jours >= 0) {
    morceaux.push(pastille(ev.jours === 0 ? 'jour même' : `avance : ${pluriel(ev.jours, 'jour')}`, 'gris'));
  }
  if (ev.jours !== null && ev.jours > 0 && !ev.exception) morceaux.push(pastille('pas une exception', 'gris'));
  if (ev.jours !== null && ev.jours > 0 && !ev.exception && ev.autorisee) morceaux.push(pastille('autorisée', 'vert'));
  if (ev.exception) morceaux.push(pastille('exception : plus de deux jours', 'ambre'));
  if (ev.exception && ev.autorisee) morceaux.push(pastille('autorisée par la règle', 'vert'));
  if (ev.exception && !ev.autorisee) morceaux.push(pastille('hors règle : règle de préparation à valider', 'rouge'));
  if (ev.conservation === 'a_confirmer') morceaux.push(pastille('conservation à confirmer', 'ambre'));
  if (ev.conservation === 'referentiel' && ev.repere) {
    morceaux.push(pastille(`conservation : ${ev.repere.texte}`, ev.repere.depasse ? 'ambre' : 'gris'));
    if (ev.repere.depasse) morceaux.push(pastille('avertissement : avance plus longue que la durée de base', 'ambre'));
  }
  if (ev.conservation === 'validee') morceaux.push(pastille("limite d'utilisation validée par l'établissement", 'vert'));
  if (ev.conservation === 'depassee') morceaux.push(pastille("limite d'utilisation dépassée", 'rouge'));
  if (ev.jours !== null && ev.jours > 0 && !ev.couvre) morceaux.push(pastille('non couvert', 'rouge'));
  const aSignaler = !ev.autorisee && !ev.exception ? ev.alertes : [];
  return h('div', { classe: 'evaluation' }, morceaux, aSignaler.map((a) => h('p', { classe: 'alerte-texte' }, a)));
}

/** Texte « charge » d'un créneau : nombre de tâches courtes, moyennes, longues (jamais des minutes). */
export function texteCharge(c) {
  const parties = [];
  if (c.courtes) parties.push(pluriel(c.courtes, 'courte'));
  if (c.moyennes) parties.push(pluriel(c.moyennes, 'moyenne'));
  if (c.longues) parties.push(pluriel(c.longues, 'longue'));
  if (c.nonEstimees) parties.push(`${c.nonEstimees} sans charge estimée`);
  return parties.length > 0 ? `tâches : ${parties.join(', ')}` : 'aucune tâche décidée';
}

const VARIANTE_CRENEAU = { libre: 'vert', charge: 'ambre', indisponible: 'rouge' };
export const pastilleCreneau = (valeur) => pastille(libelle('ETAT_CRENEAU', valeur), VARIANTE_CRENEAU[valeur] ?? 'gris');

// ------------------------------------------------------------------ carte de tâche

/**
 * @param {object} etat
 * @param {object} ligne ligne de production (feuille du jour ou ligneProduction)
 * @param {{evaluation?:object|null, resteACommenter?:Node[], actions?:Node[]|null, motif?:string}} [options]
 */
export function carteTache(etat, ligne, options = {}) {
  const p = etat.productions[ligne.productionId];
  const principale = ligne.genre === 'principale';
  const titre = principale ? ligne.nom
    : ligne.genre === 'preparatoire' ? `Action préparatoire : ${ligne.libelle}` : ligne.libelle;
  const unite = ligne.unite;
  let ligneQuantite;
  if (ligne.genre === 'preparatoire') ligneQuantite = 'sans quantité chiffrée';
  else if (p?.etat === 'fait') {
    // Une production faite montre toujours le réel, même quand son état affiché est « écart à arbitrer ».
    ligneQuantite = `fait : ${quantite(ligne.quantiteReelle, unite)}${ligne.cible !== null ? ` · cible actuelle : ${quantite(ligne.cible, unite)}` : ''}`;
  } else if (ligne.cible !== null) ligneQuantite = `cible : ${quantite(ligne.cible, unite)}`;
  else ligneQuantite = 'quantité inconnue : à préciser';
  const meta = [];
  if (ligne.menu) meta.push(`menu ${ligne.menu}`);
  meta.push(`pour le service du ${libelleJour(ligne.dateService)}`);
  if (ligne.jourDecide) {
    meta.push(`prévu ${libelleJour(ligne.jourDecide)}${ligne.creneauDecide ? `, ${libelle('CRENEAU', ligne.creneauDecide)}` : ''}`);
  }
  return h('article', { classe: `tache tache-${ligne.etat}` },
    h('div', { classe: 'tache-tete' },
      lien(`#/fiche/${encodeURIComponent(ligne.composantId)}`, titre, 'tache-nom'),
      pastille(libelle('ETAT_TACHE', ligne.etat), VARIANTE_ETAT[ligne.etat] ?? 'gris')),
    !principale ? h('p', { classe: 'meta' }, `composant : ${ligne.nom}`) : null,
    h('p', { classe: 'tache-quantite' }, ligneQuantite),
    h('p', { classe: 'meta' }, meta.join(' · ')),
    options.motif ? h('p', { classe: 'meta' }, options.motif) : null,
    noeudEvaluation(options.evaluation),
    options.contenu ?? null,
    h('div', { classe: 'actions' }, options.actions ?? actionsTache(ligne, p)));
}

/** Actions courtes selon l'état : préciser, planifier, démarrer, fait, corriger, reporter, décider. */
export function actionsTache(ligne, p) {
  const id = ligne.productionId;
  const fait = ligne.etat === 'fait' || p?.etat === 'fait';
  const a = [];
  const court = (texte, f, classe = 'court') => bouton(texte, f, classe);
  switch (ligne.etat) {
    case 'a_preciser':
      a.push(lien(`#/fiche/${encodeURIComponent(ligne.composantId)}`, 'Préciser', 'btn btn-court'));
      a.push(court('Planifier', () => dialogPlanifier(id, 'planifier')));
      break;
    case 'a_planifier':
      a.push(court('Planifier', () => dialogPlanifier(id, 'planifier')));
      a.push(court('Fait', () => faireEnUnToucher(id)));
      break;
    case 'a_faire':
      a.push(court('Démarrer', () => agir((e, t) => demarrer(e, id, t))));
      a.push(court('Fait', () => faireEnUnToucher(id)));
      a.push(court('Reporter', () => dialogPlanifier(id, 'reporter')));
      break;
    case 'en_cours':
      a.push(court('Fait', () => faireEnUnToucher(id)));
      a.push(court('Reporter', () => dialogPlanifier(id, 'reporter')));
      break;
    case 'fait':
      a.push(court('Corriger', () => dialogCorriger(id)));
      break;
    case 'ecart':
      a.push(court('Décider', () => dialogDecider(id)));
      if (fait) a.push(court('Corriger', () => dialogCorriger(id)));
      else a.push(court('Fait', () => faireEnUnToucher(id)));
      break;
    default:
  }
  if (!fait && ligne.genre !== 'principale' && !ligne.etapeCle) {
    a.push(court('Retirer', () => confirmer({
      titre: 'Retirer cette tâche ?', texte: ligne.libelle || ligne.nom, libelleOk: 'Retirer', danger: true,
      action: () => agirStrict((e, t) => supprimerProduction(e, id, t)),
    })));
  }
  return a;
}

// ------------------------------------------------------------------ panneaux

function uniteDe(etat, p) {
  return p.unite ?? calculerComposant(etat, p.composantId).uniteTravail ?? null;
}

/**
 * « Fait » en un toucher : la cible devient le réel, un message propose d'annuler (deux minutes) ou de corriger.
 * Sans cible connue, on garde le panneau : il faut saisir la quantité réellement faite.
 */
/**
 * Marque une tâche faite. `sansBandeau` : pas de message « Fait · Annuler » (Production, décision du 2026-10-07 : retoucher la
 * case remet la tâche à faire ; « Corriger » reste dans les actions de la ligne).
 */
export function faireEnUnToucher(productionId, { sansBandeau = false } = {}) {
  const e = etatCourant();
  const p = e.productions[productionId];
  if (p.genre !== 'preparatoire' && cibleProduction(e, productionId) === null) { dialogFait(productionId); return; }
  const r = agir((x, t) => marquerFait(x, productionId, undefined, t));
  if (!r.ok) return;
  try { globalThis.navigator?.vibrate?.(20); } catch { /* sans effet sur iOS */ }
  if (sansBandeau) return;
  const apres = etatCourant().productions[productionId];
  const detail = p.genre === 'preparatoire' ? '' : ` : ${quantite(apres.quantiteReelle, apres.unite)}`;
  afficherMessage(`Fait${detail} (${p.libelle})`, 'ok', [
    { libelle: 'Annuler', action: () => { agir((x, t) => annulerFait(x, productionId, t)); } },
    ...(p.genre === 'preparatoire' ? [] : [{ libelle: 'Corriger', action: () => dialogCorriger(productionId) }]),
  ]);
}

/** Décoche une tâche faite : `annulerFait` ; s'il refuse (délai dépassé, étape suivante faite…), son message est dit en texte. */
export function defaireEnUnToucher(productionId) {
  const r = agir((x, t) => annulerFait(x, productionId, t));
  if (r.ok) afficherMessage('Remis à faire', 'ok');
}

/** « Fait » avec panneau : propose la cible et permet de saisir le réel. */
export function dialogFait(productionId) {
  const e = etatCourant();
  const p = e.productions[productionId];
  const cible = cibleProduction(e, productionId);
  const unite = uniteDe(e, p);
  const sansQuantite = p.genre === 'preparatoire';
  const f = champs(sansQuantite ? [] : [{
    cle: 'reel', type: 'nombre', libelle: `Quantité réelle${unite ? ` (${libelle('UNITE', unite)})` : ''}`, valeur: cible,
    aide: cible !== null
      ? `Cible proposée : ${quantite(cible, unite)}. Corrigez si la quantité réellement faite est différente.`
      : 'La cible est inconnue : saisissez la quantité réellement faite.',
  }]);
  panneau({
    titre: `Fait : ${p.libelle}`,
    corps: [sansQuantite ? h('p', null, 'Marquer cette action préparatoire comme faite ?') : null, ...f.noeuds],
    libelleEnregistrer: 'Marquer fait',
    surEnregistrer: () => {
      const reel = sansQuantite ? null : f.valeur('reel');
      agirStrict((x, t) => marquerFait(x, productionId, reel, t));
    },
  });
}

/** Corrige la quantité réelle d'une production faite. */
export function dialogCorriger(productionId) {
  const e = etatCourant();
  const p = e.productions[productionId];
  const unite = uniteDe(e, p);
  const f = champs([{
    cle: 'reel', type: 'nombre', libelle: `Quantité réelle${unite ? ` (${libelle('UNITE', unite)})` : ''}`, valeur: p.quantiteReelle,
    aide: 'La correction remplace le réel ; les paramètres figés au marquage « fait » ne changent pas.',
  }]);
  panneau({
    titre: `Corriger le réel : ${p.libelle}`,
    corps: f.noeuds,
    surEnregistrer: () => {
      const reel = f.valeur('reel');
      if (reel === null) throw new Error('Saisissez la quantité réelle.');
      agirStrict((x, t) => corrigerReel(x, productionId, reel, t));
    },
  });
}

/** Décider d'un écart : complément, ajustement ou aucune production supplémentaire. */
export function dialogDecider(productionId) {
  const e = etatCourant();
  const p = e.productions[productionId];
  const unite = uniteDe(e, p);
  const cible = cibleProduction(e, productionId);
  const ecart = ecartProduction(e, p.composantId);
  const fait = p.etat === 'fait';
  const f = champs([{
    cle: 'type', type: 'radio', libelle: 'Décision', valeur: null,
    options: [
      ['complement', 'Complément', fait ? 'crée une tâche pour produire le reste' : 'disponible une fois la production faite'],
      ['ajustement', 'Ajustement', 'note l\'écart comme réglé, sans nouvelle production'],
      ['aucune', 'Aucune production supplémentaire'],
    ],
  }]);
  const resume = [`cible actuelle : ${quantite(cible, unite)}`];
  if (fait) resume.push(`réel : ${quantite(p.quantiteReelle, unite)}`);
  if (ecart !== null && ecart > 0) resume.push(`il manque ${quantite(ecart, unite)}`);
  if (ecart !== null && ecart < 0) resume.push(`surplus de ${quantite(-ecart, unite)}`);
  const nonCompte = reelNonCompte(e, p.composantId);
  if (nonCompte) resume.push(`${quantite(nonCompte.quantite, unite)} non comptés : ${nonCompte.raison}`);
  const nomCourant = p.genre === 'principale' ? e.composants[p.composantId]?.nom ?? p.libelle : p.libelle;
  panneau({
    titre: `Écart à arbitrer : ${nomCourant}`,
    corps: [h('p', null, resume.join(' · ')),
      h('p', { classe: 'aide' }, 'La modification des prévisions ne change jamais le réel : c\'est à vous de décider.'),
      ...f.noeuds],
    surEnregistrer: () => {
      const type = f.valeur('type');
      if (!type) throw new Error('Choisissez une décision.');
      agirStrict((x, t) => deciderEcart(x, productionId, type, t));
    },
  });
}

/** « Noter une action préparatoire » (libellé libre) pour un composant. */
export function dialogPreparatoire(composantId) {
  const e = etatCourant();
  const c = e.composants[composantId];
  const f = champs([{
    cle: 'libelle', type: 'zone', libelle: 'Action préparatoire', placeholder: 'décrivez l\'action',
    aide: 'Cette action ne couvre pas le besoin : le produit fini n\'est pas compté comme prêt.',
  }]);
  panneau({
    titre: `Action préparatoire : ${c?.nom ?? ''}`,
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((x, t) => ajouterPreparatoire(x, composantId, f.valeur('libelle'), t)); },
  });
}

/**
 * Planifier ou reporter : choix du jour et du créneau, avec l'évaluation affichée avant d'enregistrer.
 * Un choix hors règle reste possible mais affiche l'alerte.
 * @param {'planifier'|'reporter'} mode
 * @param {{date?:string, creneau?:string}} [preset]
 */
export function dialogPlanifier(productionId, mode, preset = {}) {
  const e = etatCourant();
  const p = e.productions[productionId];
  const composant = e.composants[p.composantId] ?? null;
  const regle = regleDe(e, composant);
  const suggestion = suggererCreneau(e, productionId);
  const dateInit = preset.date ?? p.jourDecide ?? suggestion?.date ?? p.dateService;
  const optionsCreneaux = (date) => (estDateValide(date) ? creneauxDuJour(date) : [])
    .map((c) => [c, libelle('CRENEAU', c)]);
  const creneauInit = preset.creneau ?? p.creneauDecide ?? suggestion?.creneau ?? null;
  const f = champs([
    { cle: 'date', type: 'date', libelle: 'Jour', valeur: dateInit },
    { cle: 'creneau', type: 'choix', libelle: 'Créneau', options: optionsCreneaux(dateInit), valeur: creneauInit },
  ]);
  const zoneEvaluation = h('div', { classe: 'evaluation-bloc', 'aria-live': 'polite' });
  const miseAJour = () => {
    const date = f.valeur('date');
    if (!estDateValide(date)) { zoneEvaluation.replaceChildren(h('p', { classe: 'vide' }, 'Choisissez un jour.')); return; }
    const creneau = f.valeur('creneau');
    const ev = evaluerAvance(date, p.dateService, regle, repereConservation(composant, e));
    const lignes = [h('p', { classe: 'meta' }, `Service : ${libelleJour(p.dateService)}. Production : ${libelleJour(date)}.`),
      noeudEvaluation(ev)];
    if (creneau) {
      const c = chargeCreneau(e, date, creneau);
      lignes.push(h('p', { classe: 'meta' }, 'Créneau : ', pastilleCreneau(etatCreneau(e, date, creneau)), ` ${texteCharge(c)}`));
      for (const a of c.alertes) lignes.push(h('p', { classe: 'alerte-texte' }, a));
    } else lignes.push(h('p', { classe: 'vide' }, creneauxDuJour(date).length === 0 ? 'Jour non travaillé : aucun créneau.' : 'Choisissez un créneau.'));
    zoneEvaluation.replaceChildren(...lignes);
  };
  f.surChangement('date', () => {
    const date = f.valeur('date');
    f.remplacerOptions('creneau', optionsCreneaux(date), null);
    miseAJour();
  });
  f.surChangement('creneau', miseAJour);
  const zoneSuggestion = h('div', { classe: 'suggestion' },
    suggestion
      ? [h('p', null, `Suggestion : ${libelleJour(suggestion.date)}, ${libelle('CRENEAU', suggestion.creneau)}.`),
        bouton('Utiliser la suggestion', () => {
          f.fixer('date', suggestion.date);
          f.remplacerOptions('creneau', optionsCreneaux(suggestion.date), suggestion.creneau);
          miseAJour();
        }, 'court')]
      : h('p', { classe: 'vide' }, 'Aucun créneau libre à suggérer : choisissez-en un vous-même.'));
  miseAJour();
  const extras = mode === 'reporter' && p.jourDecide ? [{
    libelle: 'Remettre à planifier',
    action: (api) => { agirStrict((x, t) => reporter(x, productionId, null, null, t)); api.fermer(); },
  }] : [];
  panneau({
    titre: `${mode === 'reporter' ? 'Reporter' : 'Planifier'} : ${p.libelle}`,
    corps: [zoneSuggestion, ...f.noeuds, zoneEvaluation],
    extras,
    surEnregistrer: () => {
      const date = f.valeur('date');
      const creneau = f.valeur('creneau');
      if (!estDateValide(date)) throw new Error('Choisissez un jour.');
      if (!creneau) throw new Error('Choisissez un créneau.');
      const action = mode === 'reporter' ? reporter : planifier;
      const res = agirStrict((x, t) => action(x, productionId, date, creneau, t));
      const alertes = [...new Set(res.alertes)];
      if (alertes.length > 0) afficherMessage(`Enregistré, avec alerte : ${alertes.join(' ; ')}`, 'alerte');
    },
  });
}

