// Assistant de planning : le bouton « Proposer un planning », le calcul (avec le modèle IA seulement si l'assistant est
// activé dans Réglages), puis la feuille « Brouillon » où le chef valide, refuse ou ferme. Rien n'est enregistré avant
// « Valider et planifier » ; l'application passe par le harness (contrôles rejoués, refus si l'état a changé).
// Aucune logique métier ici : tout vient de harness/ et de domaine/.

import { ajouterJours, jourSemaine, libelleJour, lundiDe } from '../domaine/dates.js';
import { libelle } from '../domaine/statuts.js';
import { appliquerProposition, decider } from '../harness/commandes.js';
import { proposerPlanningAssiste } from '../harness/orchestrateur.js';
import { creerRegistre } from '../harness/propositions.js';
import { expliquer } from '../harness/trace.js';
import { agir, aujourdhui, etat as etatCourant, maintenant } from '../magasin.js';
import { assistantPret, fournisseurDepuisReglages, lireReglagesIA } from './assistant-reglages.js';
import { h } from './dom.js';
import { bouton, encadre, pastille, repliable } from './elements.js';
import { quantite } from './format.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';

/** Délai laissé au modèle avant de retomber sur le calcul seul (millisecondes). */
const DELAI_MODELE_MS = 45000;

const registre = creerRegistre();
let enCours = false;

/**
 * Période à planifier : de `date` (ou d'aujourd'hui si `date` est passée) jusqu'au samedi de cette semaine ; un dimanche
 * vise la semaine suivante.
 * @returns {{dateDebut:string, dateFin:string}}
 */
export function periodeDePlanning(date, aujourd) {
  let debut = date > aujourd ? date : aujourd;
  if (jourSemaine(debut) === 7) debut = ajouterJours(debut, 1);
  return { dateDebut: debut, dateFin: ajouterJours(lundiDe(debut), 5) };
}

function ligneItem(item) {
  const valeur = item.quantite.valeur === null ? null : quantite(item.quantite.valeur, item.quantite.unite);
  return h('li', { classe: 'ia-ligne' },
    h('div', { classe: 'ia-ligne-texte' },
      h('strong', null, item.nom),
      h('span', { classe: 'meta' }, ` · service ${libelleJour(item.dateService)}`),
      item.motifs.map((m) => h('span', { classe: 'meta ia-avertissement' }, [' ', pastille('à confirmer', 'ambre'), ` ${m}`]))),
    h('div', { classe: 'ia-ligne-quand' },
      `${libelleJour(item.date)} · ${libelle('CRENEAU', item.creneau)}`,
      valeur ? h('span', { classe: 'meta' }, ` · ${item.quantite.libelle} ${valeur}`) : null));
}

/**
 * Contenu de la feuille « Brouillon » (testable sans ouvrir de panneau).
 * @param {object} proposition
 * @param {{mode:string, avertissements:string[]}} infos
 * @returns {Node[]}
 */
export function contenuProposition(proposition, { mode, avertissements }) {
  const nodes = [
    h('p', { classe: 'meta' },
      mode === 'modele' ? pastille("proposé par l'IA, recontrôlé", 'gris') : pastille('calculé par Sanji', 'vert'),
      ` ${proposition.items.length} préparation${proposition.items.length > 1 ? 's' : ''} à planifier. Rien n'est enregistré avant votre validation.`),
  ];
  for (const a of avertissements) nodes.push(encadre('alerte', a));
  if (proposition.items.length > 0) nodes.push(h('ul', { classe: 'ia-liste' }, proposition.items.map(ligneItem)));
  else nodes.push(h('p', { classe: 'vide' }, 'Rien à planifier sur cette période.'));
  if (proposition.aDecider.length > 0) {
    nodes.push(h('h3', { classe: 'section-titre' }, 'À décider'),
      h('ul', { classe: 'ia-liste' }, proposition.aDecider.map((d) => h('li', { classe: 'ia-ligne' }, pastille('à décider', 'ambre'), ` ${d.texte}`))));
  }
  nodes.push(repliable('Pourquoi cette proposition', false, h('ul', { classe: 'ia-pourquoi' }, expliquer(proposition).map((l) => h('li', { classe: 'meta' }, l)))));
  return nodes;
}

function ouvrirBrouillon(resultat) {
  const { proposition } = resultat;
  const corps = contenuProposition(proposition, resultat);
  if (proposition.items.length === 0) {
    panneau({ titre: 'Planning', corps, lectureSeule: true });
    return;
  }
  panneau({
    titre: 'Brouillon de planning',
    corps,
    libelleEnregistrer: 'Valider et planifier',
    libelleAnnuler: 'Fermer sans décider',
    annulerEnLien: true,
    extras: [{
      libelle: 'Refuser',
      action: (api) => {
        decider(registre, proposition.id, { choix: 'refuser' }, { executeur: agir });
        afficherMessage("Proposition refusée. Rien n'a été changé.", 'info');
        api.fermer();
      },
    }],
    surEnregistrer: () => {
      decider(registre, proposition.id, { choix: 'valider' }, { executeur: agir });
      const r = appliquerProposition(registre, proposition.id, { executeur: agir, aujourdhui: aujourdhui() });
      if (!r.ok) throw new Error(r.message);
      afficherMessage(`${r.appliques.length} préparation${r.appliques.length > 1 ? 's' : ''} planifiée${r.appliques.length > 1 ? 's' : ''}.`, 'ok');
    },
  });
}

/** Lance le calcul puis ouvre le brouillon. Une seule demande à la fois ; fermer la fenêtre d'attente l'annule. */
export async function ouvrirAssistantPlanning({ date }) {
  if (enCours) return;
  enCours = true;
  const controleur = new AbortController();
  const reglages = lireReglagesIA();
  const attente = panneau({
    titre: 'Planning proposé',
    lectureSeule: true,
    corps: [
      h('p', null, 'Calcul en cours…'),
      assistantPret(reglages)
        ? h('p', { classe: 'meta' }, `Le modèle ${reglages.modele} est consulté : il reçoit les noms des composants, les portions et un brouillon de départ, jamais les fiches de fonction ni les allergies.`)
        : h('p', { classe: 'meta' }, 'Calcul par Sanji seul, sans IA.'),
    ],
  });
  let termine = false;
  attente.addEventListener('close', () => { if (!termine) controleur.abort(); });
  try {
    const aujourd = aujourdhui();
    const resultat = await proposerPlanningAssiste({
      etat: etatCourant(), h: maintenant(), aujourdhui: aujourd, ...periodeDePlanning(date, aujourd), registre,
      fournisseur: fournisseurDepuisReglages(reglages), signal: controleur.signal, delaiMs: DELAI_MODELE_MS,
    });
    termine = true;
    attente.close();
    if (!controleur.signal.aborted) ouvrirBrouillon(resultat);
  } catch (erreur) {
    termine = true;
    attente.close();
    afficherMessage(`Planning impossible : ${erreur?.message ?? erreur}`, 'erreur');
  } finally {
    enCours = false;
  }
}

/** Le bouton à poser dans une vue. */
export const boutonProposerPlanning = (date) => bouton('Proposer un planning', () => { ouvrirAssistantPlanning({ date }); }, 'court');
