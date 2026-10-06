// Propositions : un brouillon explicable, distinct de toute décision enregistrée. Elles vivent en mémoire (aucun format
// persistant nouveau) ; seules leur validation, leur refus et leur application laissent une trace dans le journal.
// Une proposition garde l'empreinte de l'état qu'elle a lu : si l'état change, elle ne s'applique plus.

import { nouvelId } from '../domaine/etat.js';
import { chargeCreneau, etatCreneau, regleDe, repereConservation } from '../domaine/planification.js';
import { CRENEAU } from '../domaine/statuts.js';
import { CODES, ErreurHarness, ORIGINES, STATUTS_PROPOSITION } from './contrats.js';

const CRENEAUX = Object.values(CRENEAU);

/** Statut visé → statuts de départ admis. Valider et refuser passent par `valider` et `refuser`, jamais par `marquer`. */
const TRANSITIONS = Object.freeze({
  [STATUTS_PROPOSITION.APPLIQUEE]: [STATUTS_PROPOSITION.VALIDEE],
  [STATUTS_PROPOSITION.CONFLIT]: [STATUTS_PROPOSITION.VALIDEE],
  [STATUTS_PROPOSITION.PERIMEE]: [STATUTS_PROPOSITION.BROUILLON, STATUTS_PROPOSITION.VALIDEE],
});

/** Hash FNV-1a 32 bits : détecte un changement, ne protège rien (pas de secret ici). */
function fnv1a(texte) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    hash ^= texte.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const choisir = (objet, cles) => (objet ? Object.fromEntries(cles.map((c) => [c, objet[c] ?? null])) : null);

/**
 * Empreinte de la part de l'état dont dépend une proposition : productions et composants concernés, règles, état et
 * charge des créneaux des jours visés. Deux états de même empreinte donnent le même brouillon.
 * @param {object} etat
 * @param {{productionIds:string[], dates:string[]}} perimetre
 */
export function empreinteEtat(etat, { productionIds, dates }) {
  const parties = [];
  for (const id of [...productionIds].sort()) {
    const p = etat.productions?.[id];
    const c = etat.composants?.[p?.composantId];
    parties.push([
      id,
      choisir(p, ['etat', 'jourDecide', 'creneauDecide', 'dateService', 'composantId', 'genre', 'etapeCle', 'unite']),
      choisir(c, ['attribue', 'valide', 'grammage', 'etapes', 'charge', 'famille', 'categorie', 'role', 'type', 'menu', 'nom', 'recetteId']),
      c ? regleDe(etat, c, p.etapeCle ?? null) : null,
      c ? repereConservation(c, etat) : null,
    ]);
  }
  for (const date of [...dates].sort()) {
    parties.push([date, CRENEAUX.map((cr) => [etatCreneau(etat, date, cr), chargeCreneau(etat, date, cr)]), etat.jours?.[date]?.previsions ?? null]);
  }
  parties.push(etat.reglages?.capaciteCreneau ?? null, etat.reglages?.margeSecurite ?? null);
  return fnv1a(JSON.stringify(parties));
}

/** Items d'une proposition validée qui peuvent être appliqués : ni retirés, ni en attente d'une confirmation explicite. */
export function itemsAppliquables(proposition) {
  const decision = proposition.decision ?? { itemsConfirmes: [], itemsRetires: [] };
  return proposition.items.filter((i) => !decision.itemsRetires.includes(i.id) && (!i.exigeConfirmation || decision.itemsConfirmes.includes(i.id)));
}

/** Registre en mémoire. Chaque lecture renvoie une copie : personne ne modifie une proposition sans passer par lui. */
export function creerRegistre() {
  const parId = new Map();

  const exiger = (id) => {
    const p = parId.get(id);
    if (!p) throw new ErreurHarness(CODES.PROPOSITION_INCONNUE, `Proposition inconnue : ${id}`);
    return p;
  };

  return {
    /**
     * @param {{origine:string, items:object[], aDecider:object[], controles:object[], sources?:string[], hypotheses?:string[], incertitudes?:string[]}} donnees
     */
    creer(donnees, etat, h) {
      if (!Object.values(ORIGINES).includes(donnees.origine)) throw new ErreurHarness(CODES.PROPOSITION_INVALIDE, `Origine inconnue : ${donnees.origine}`);
      const perimetre = {
        productionIds: donnees.items.map((i) => i.productionId),
        dates: [...new Set(donnees.items.flatMap((i) => [i.date, i.dateService]))],
      };
      const proposition = {
        id: nouvelId('prop'), type: 'planning', origine: donnees.origine, creeLe: h,
        empreinte: empreinteEtat(etat, perimetre), perimetre,
        items: donnees.items, aDecider: donnees.aDecider,
        sources: donnees.sources ?? [], hypotheses: donnees.hypotheses ?? [], incertitudes: donnees.incertitudes ?? [],
        controles: donnees.controles, statut: STATUTS_PROPOSITION.BROUILLON, decision: null,
      };
      parId.set(proposition.id, structuredClone(proposition));
      return structuredClone(proposition);
    },
    lire: (id) => structuredClone(exiger(id)),
    lister: () => [...parId.values()].map((p) => structuredClone(p)),

    /** Le chef valide : sans confirmation explicite, un item à conservation non validée reste hors de la décision. */
    valider(id, h, { itemsConfirmes = [], itemsRetires = [] } = {}) {
      const p = exiger(id);
      if (p.statut !== STATUTS_PROPOSITION.BROUILLON) throw new ErreurHarness(CODES.STATUT_INCOMPATIBLE, `Proposition ${p.statut} : elle ne peut plus être validée.`);
      const connus = new Set(p.items.map((i) => i.id));
      for (const x of [...itemsConfirmes, ...itemsRetires]) {
        if (!connus.has(x)) throw new ErreurHarness(CODES.REFERENCE_INCONNUE, `Item inconnu : ${x}`);
      }
      const exigeants = new Set(p.items.filter((i) => i.exigeConfirmation).map((i) => i.id));
      for (const x of itemsConfirmes) {
        if (!exigeants.has(x)) throw new ErreurHarness(CODES.PRECONDITION, `L'item ${x} n'exige pas de confirmation.`);
      }
      p.statut = STATUTS_PROPOSITION.VALIDEE;
      p.decision = { h, par: 'chef', choix: 'valider', itemsConfirmes: [...itemsConfirmes], itemsRetires: [...itemsRetires] };
      return structuredClone(p);
    },
    refuser(id, h, raison = '') {
      const p = exiger(id);
      if (p.statut !== STATUTS_PROPOSITION.BROUILLON) throw new ErreurHarness(CODES.STATUT_INCOMPATIBLE, `Proposition ${p.statut} : elle ne peut plus être refusée.`);
      p.statut = STATUTS_PROPOSITION.REFUSEE;
      p.decision = { h, par: 'chef', choix: 'refuser', raison, itemsConfirmes: [], itemsRetires: [] };
      return structuredClone(p);
    },
    /** Changement de statut par la couche de commandes : seules les transitions de TRANSITIONS sont admises. */
    marquer(id, statut) {
      const p = exiger(id);
      if (!TRANSITIONS[statut]?.includes(p.statut)) throw new ErreurHarness(CODES.STATUT_INCOMPATIBLE, `Transition interdite : ${p.statut} → ${statut}`);
      p.statut = statut;
    },
  };
}
