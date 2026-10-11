// Orchestrateur : pilote contexte → outils → proposition → contrôles, avec un calcul déterministe toujours disponible.
// Le brouillon du calcul est produit d'abord : sans modèle, hors ligne, en erreur, en délai dépassé ou annulé, le
// chef reçoit quand même une proposition. Un modèle ne peut que proposer une autre répartition, recontrôlée entièrement.
// Cette fonction ne modifie jamais l'état : elle rend une proposition en mémoire.

import { CODES, ErreurHarness, ORIGINES } from './contrats.js';
import { construireContexte } from './contexte.js';
import { estUtilisable, fournisseurDesactive, interroger } from './fournisseur.js';
import { descriptionsPourModele, executerOutil } from './outils.js';
import { productionsAPlanifier, proposerPlanning } from './parcours-planning.js';
import { controlerBrouillon } from './validateur.js';

export const MAX_ITERATIONS = 4;

/** Le texte libre d'un modèle est borné (nombre et longueur) avant d'être montré au chef, toujours préfixé « modèle : ». */
const NB_TEXTES_MAX = 5;
const LONGUEUR_TEXTE_MAX = 200;
const bornerTextes = (textes) => (textes ?? []).slice(0, NB_TEXTES_MAX).map((x) => `modèle : ${String(x).slice(0, LONGUEUR_TEXTE_MAX)}`);

const SOURCES = Object.freeze([
  'Menus, composants et prévisions de l\'état local (aucune donnée externe)',
  'Quantités : calculerComposant (standards de base, valeurs du chef, état du poids)',
  'Créneaux et avances : suggererCreneau, evaluerAvance et règles de préparation validées',
]);
const HYPOTHESE_SANS_HEURE = 'Un créneau du jour courant est supposé disponible même si son heure est passée (aucune heure de fin de créneau n\'est renseignée).';

/** Construit la proposition à partir d'un contrôle réussi. */
function enregistrer(registre, etat, h, origine, controle, { nonPlacees = [], hypotheses = [], incertitudes = [], aDeciderEn = [] }) {
  const aDecider = [
    ...controle.aDecider,
    ...nonPlacees.map((n) => ({ id: `decider-${n.productionId}`, genre: 'non_placee', productionId: n.productionId, composantId: n.composantId, texte: n.texte })),
    ...aDeciderEn,
  ];
  const incertains = [
    ...controle.items.filter((i) => i.evaluation.conservation === 'a_confirmer' && i.evaluation.jours > 0)
      .map((i) => `${i.nom} : conservation non validée (avertissement), à ne pas considérer comme couvert`),
    ...incertitudes,
  ];
  return registre.creer({
    origine, items: controle.items, aDecider, controles: controle.controles,
    sources: [...SOURCES], hypotheses: [HYPOTHESE_SANS_HEURE, ...hypotheses], incertitudes: incertains,
  }, etat, h);
}

/** Productions à planifier absentes d'un brouillon du modèle : elles restent « à décider », jamais oubliées. */
function nonTraitees(etat, periode, controle) {
  const couvertes = new Set([...controle.items.map((i) => i.productionId), ...controle.aDecider.map((d) => d.productionId)]);
  return productionsAPlanifier(etat, periode.dateDebut, periode.dateFin).filter((p) => !couvertes.has(p.id)).map((p) => ({
    id: `decider-${p.id}`, genre: 'non_traitee', productionId: p.id, composantId: p.composantId,
    texte: `${etat.composants[p.composantId].nom} : non traité par le modèle, à décider`,
  }));
}

/**
 * Propose un planning pour une période.
 * @param {{etat:object, h:string, aujourdhui:string, dateDebut:string, dateFin:string, registre:object,
 *   fournisseur?:object, signal?:AbortSignal|null, maxIterations?:number, delaiMs?:number}} demande
 * @returns {Promise<{proposition:object, mode:'deterministe'|'modele', avertissements:string[]}>}
 */
export async function proposerPlanningAssiste({
  etat, h: hDonnee, aujourdhui: aujourdhuiDonne, dateDebut, dateFin, registre, fournisseur = fournisseurDesactive, signal = null,
  maxIterations = MAX_ITERATIONS, delaiMs,
}) {
  const h = hDonnee;
  const aujourdhui = aujourdhuiDonne;
  if (!h || !aujourdhui) throw new ErreurHarness(CODES.ENTREE_INVALIDE, "Il faut les valeurs h et aujourdhui.");
  const periode = { h, aujourdhui, dateDebut, dateFin };
  const contexte = construireContexte(etat, { tache: 'planning', dateDebut, dateFin, aujourdhui });
  const base = proposerPlanning(etat, periode);
  const controleBase = controlerBrouillon(base.brouillon, etat, { h, aujourdhui });
  if (controleBase.erreurs.length) {
    throw new ErreurHarness(CODES.PROPOSITION_INVALIDE, `Le calcul déterministe a produit un brouillon invalide : ${controleBase.erreurs[0]}`);
  }
  const repli = (avertissements) => ({
    proposition: enregistrer(registre, etat, h, ORIGINES.DETERMINISTE, controleBase, { nonPlacees: base.nonPlacees }),
    mode: 'deterministe', avertissements,
  });

  if (!estUtilisable(fournisseur)) return repli([]);

  const avertissements = [];
  const lecture = structuredClone(etat);
  const historique = [];
  const dejaVus = new Set();
  try {
    for (let i = 0; i < maxIterations; i += 1) {
      const reponse = await interroger(fournisseur, {
        contexte, outils: descriptionsPourModele(), historique, brouillonDeterministe: base.brouillon,
      }, { delaiMs, signal });
      if (reponse.type === 'appel_outil') {
        const cle = JSON.stringify([reponse.outil, reponse.entrees]);
        if (dejaVus.has(cle)) { avertissements.push('Le modèle répète le même appel : abandon, calcul sans IA.'); break; }
        dejaVus.add(cle);
        try {
          historique.push({ outil: reponse.outil, entrees: reponse.entrees, ...executerOutil(reponse.outil, reponse.entrees, { etat: lecture, aujourdhui, h }) });
        } catch (erreur) {
          if (!(erreur instanceof ErreurHarness)) throw erreur;
          historique.push({ outil: reponse.outil, entrees: reponse.entrees, erreur: erreur.message });
        }
        continue;
      }
      const controle = controlerBrouillon(reponse.brouillon, etat, { h, aujourdhui });
      // Le modèle ne peut proposer que des productions de la période demandée et du poste (attribuées, à planifier).
      const permises = new Set(productionsAPlanifier(etat, dateDebut, dateFin).map((p) => p.id));
      const horsPerimetre = controle.items.filter((i) => !permises.has(i.productionId));
      if (horsPerimetre.length) controle.erreurs.push(`production hors période ou hors poste : ${horsPerimetre[0].nom}`);
      if (controle.erreurs.length) {
        avertissements.push(`Proposition du modèle refusée par les contrôles : ${controle.erreurs.slice(0, 3).join(' ; ')}`);
        break;
      }
      return {
        proposition: enregistrer(registre, etat, h, ORIGINES.MODELE, controle, {
          hypotheses: bornerTextes(reponse.brouillon.hypotheses),
          incertitudes: bornerTextes(reponse.brouillon.incertitudes),
          aDeciderEn: nonTraitees(etat, periode, controle),
        }),
        mode: 'modele', avertissements,
      };
    }
    if (!avertissements.length) avertissements.push(`Le modèle n'a pas rendu de brouillon en ${maxIterations} échanges : calcul sans IA.`);
  } catch (erreur) {
    avertissements.push(erreur instanceof ErreurHarness ? erreur.message : `Erreur inattendue du modèle : ${erreur?.message ?? 'inconnue'}`);
  }
  return repli(avertissements);
}
