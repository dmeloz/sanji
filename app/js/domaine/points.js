// Points à confirmer (ce que le chef doit encore trancher) et repère des ventes passées.

import { aMenuDuJour, jourSemaine } from './dates.js';
import { calculerComposant } from './calcul.js';
import { jourOuVide, normaliser } from './etat.js';
import { etatCreneau, etatTache, evaluationProduction } from './planification.js';
import { statutAllergenes } from './allergenes.js';
import { grammageEffectif } from './savoir.js';
import { lireMemoire } from './analyse-menu.js';

const somme = (r) => (Number(r?.[1]) || 0) + (Number(r?.[2]) || 0);

/**
 * Points à confirmer pour une date.
 * Types : prevision_manquante, composant_inconnu (catégorie à préciser : « à classer : au poste ou non ? », tant que
 * le chef n'a rien choisi pour ce nom), composant_a_preciser (type non déterminé), grammage (composant attribué
 * sans portion connue, hors générique), repartition_provisoire, repartition_incoherente, conservation,
 * avance_hors_regle, allergenes, ecart, creneau_charge. Plus de point « transcription » ni « composants » :
 * l'intitulé saisi vaut validation. Un composant inconnu ou de type indéterminé n'ouvre qu'un seul point à la fois.
 * Les points de production se rattachent à la date de service, sauf creneau_charge (jour de travail décidé).
 * @returns {{type:string, texte:string, composantId?:string, ficheId?:string}[]}
 */
export function pointsAConfirmer(etat, date) {
  const points = [];
  const jour = jourOuVide(etat, date);
  const composants = Object.values(etat.composants ?? {}).filter((c) => c.date === date);

  if (aMenuDuJour(date)) {
    for (const menu of [1, 2]) {
      const m = jour.menus[menu];
      // Un jour dont le menu n'est pas saisi ne signale pas de prévision manquante (pas de bruit sur les jours vides).
      if (m.intitule.trim() !== '' && !Number.isFinite(jour.previsions[menu].portions)) {
        points.push({ type: 'prevision_manquante', texte: `Menu ${menu} : prévision hors groupes à saisir` });
      }
    }
  }

  // Inconnu = catégorie non reconnue ET aucun choix du chef mémorisé pour ce nom (attribution ou catégorie).
  const memoire = etat.memoire ?? {};
  const estInconnu = (c) => c.categorie === 'a_preciser' && lireMemoire(memoire, c.nom, c.menu) === null;
  for (const c of composants.filter(estInconnu)) {
    points.push({ type: 'composant_inconnu', composantId: c.id, texte: c.suggestion ? `${c.nom} : à confirmer (${c.suggestion} proposée) : au poste ou non ?` : `${c.nom} : à classer : au poste ou non ?` });
  }

  for (const c of composants.filter((x) => x.attribue && x.valide)) {
    const calc = calculerComposant(etat, c.id);
    if (c.type === 'a_preciser') {
      if (!estInconnu(c)) {
        points.push({ type: 'composant_a_preciser', composantId: c.id,
          texte: `${c.nom} : à préciser (${calc.manquants.join(', ') || 'type'})` });
      }
    } else if (c.type !== 'generique' && grammageEffectif(etat, c) === null) {
      points.push({ type: 'grammage', composantId: c.id, texte: `${c.nom} : portion à saisir` });
    } else if (calc.statut === 'INCONNU') {
      // La prévision manquante est déjà un point à elle seule, et la composition d'un générique reste « à définir »
      // par nature : ni l'une ni l'autre ne fait d'un composant une question à poser au chef.
      const autres = calc.manquants.filter((m) => m !== 'prévision hors groupes' && m !== 'composition');
      if (autres.length > 0) {
        points.push({ type: 'composant_a_preciser', composantId: c.id, texte: `${c.nom} : à préciser (${autres.join(', ')})` });
      }
    }
  }

  const fiches = Object.values(etat.fiches ?? {}).filter((f) => f.statut === 'active' && f.date === date);
  for (const f of fiches) {
    if (f.service === 'midi' && f.mode === 'choix_libre') {
      if (f.statutRepartition !== 'confirmee') {
        points.push({ type: 'repartition_provisoire', ficheId: f.id, texte: `Fiche ${f.numero || f.id} : répartition provisoire` });
      }
      if (somme(f.repartition) !== Number(f.couverts)) {
        points.push({ type: 'repartition_incoherente', ficheId: f.id,
          texte: `Fiche ${f.numero || f.id} : la répartition (${somme(f.repartition)}) ne correspond pas aux couverts (${Number(f.couverts)})` });
      }
    }
  }

  const concernes = new Set();
  for (const f of fiches.filter((x) => String(x.allergies ?? '').trim() !== '' && x.service === 'midi' && x.mode !== 'hors_menu')) {
    for (const c of composants.filter((x) => x.attribue && (f.mode === 'choix_libre' || x.menu === Number(f.menuFixe)))) {
      if (!concernes.has(c.id) && statutAllergenes(etat, c).statut === 'a_confirmer') {
        concernes.add(c.id);
        points.push({ type: 'allergenes', composantId: c.id, ficheId: f.id, texte: `${c.nom} : allergènes à confirmer` });
      }
    }
  }

  for (const p of Object.values(etat.productions ?? {})) {
    const c = etat.composants?.[p.composantId];
    if (!c) continue;
    if (p.dateService === date) {
      const ev = evaluationProduction(etat, p.id);
      if (ev && ev.jours > 0) {
        if (ev.exception && !ev.autorisee) {
          points.push({ type: 'avance_hors_regle', composantId: c.id, texte: `${c.nom} : avance hors règle, le besoin n'est pas couvert` });
        } else if (ev.conservation === 'depassee') {
          points.push({ type: 'avance_hors_regle', composantId: c.id, texte: `${c.nom} : limite d'utilisation dépassée, le besoin n'est pas couvert` });
        } else if (ev.conservation === 'a_confirmer') {
          points.push({ type: 'conservation', composantId: c.id, texte: `${c.nom} : conservation à confirmer` });
        }
      }
      if (etatTache(etat, p.id) === 'ecart') {
        points.push({ type: 'ecart', composantId: c.id, texte: `${c.nom} : écart à arbitrer` });
      }
    }
    if (p.etat !== 'fait' && p.jourDecide === date && p.creneauDecide && etatCreneau(etat, date, p.creneauDecide) !== 'libre') {
      points.push({ type: 'creneau_charge', composantId: c.id, texte: `${c.nom} : décidé sur un créneau signalé chargé ou indisponible` });
    }
  }
  return points;
}

/** Points valables pour toute l'application : la semaine type non confirmée. */
export function pointsGlobaux(etat) {
  return etat.reglages?.semaineTypeConfirmee ? [] : [{ type: 'semaine_type', texte: 'Semaine type à confirmer' }];
}

/**
 * Repère des ventes : au plus 3 ventes saisies du même jour de semaine avant `date`, les plus récentes d'abord.
 * C'est un repère, jamais une prévision.
 * @returns {{date:string, ventes:number}[]}
 */
export function repereVentes(etat, date, menu) {
  const j = jourSemaine(date);
  return Object.values(etat.jours ?? {})
    .filter((x) => x.date < date && jourSemaine(x.date) === j && Number.isFinite(x.ventes?.[menu]))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((x) => ({ date: x.date, ventes: x.ventes[menu] }));
}

/** Moyenne (arrondie) des ventes d'un repère, ou null sans vente. Un repère de plus, jamais une prévision. */
export function moyenneVentes(repere) {
  if (!repere || repere.length === 0) return null;
  return Math.round(repere.reduce((somme, r) => somme + r.ventes, 0) / repere.length);
}
