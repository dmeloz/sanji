// Assistant de planning : le bouton « Proposer un planning », le calcul (avec le modèle IA seulement si l'assistant est
// activé dans Réglages), puis la feuille « Brouillon » où le chef valide, refuse ou ferme. Rien n'est enregistré avant
// « Valider et planifier » ; l'application passe par le harness (contrôles rejoués, refus si l'état a changé).
// Aucune logique métier ici : tout vient de harness/ et de domaine/.

import { ajouterJours, jourSemaine, libelleJour, lundiDe } from '../domaine/dates.js';
import { appliquerProposition, decider } from '../harness/commandes.js';
import { proposerPlanningAssiste } from '../harness/orchestrateur.js';
import { creerRegistre } from '../harness/propositions.js';
import { expliquer } from '../harness/trace.js';
import { agir, aujourdhui, etat as etatCourant, maintenant } from '../magasin.js';
import { assistantPret, fournisseurDepuisReglages, lireReglagesIA } from './assistant-reglages.js';
import { h } from './dom.js';
import { bouton, encadre, pastille } from './elements.js';
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

/** Identifiant du champ « Jour » d'une ligne du brouillon (stable : il sert à relire la date corrigée à la validation). */
const idJour = (itemId) => `ia-jour-${itemId}`;

/**
 * Une ligne du brouillon, avec son geste « Écarter » / « Rétablir » et son jour corrigeable (champ date natif, borné à
 * aujourd'hui et au service). L'état « écartée » est dit en texte et grisé (classe `ec-ecartee`), jamais par la couleur
 * seule. `ecartes` (Set d'identifiants d'items) est mis à jour ici.
 */
function ligneItem(item, ecartes, surChangement, champsJour) {
  const valeur = item.quantite.valeur === null ? null : quantite(item.quantite.valeur, item.quantite.unite);
  const etat = h('span', { classe: 'meta ec-etat' });
  const li = h('li', { classe: 'ia-ligne' });
  const geste = h('button', { type: 'button', classe: 'btn ec-bouton' });
  const jour = h('input', { type: 'date', id: idJour(item.id), classe: 'ia-jour', value: item.date, min: aujourdhui(), max: item.dateService ?? null,
    'aria-label': `Jour de production : ${item.nom}` });
  champsJour.set(item.id, jour);
  const afficher = () => {
    const ecartee = ecartes.has(item.id);
    li.className = ecartee ? 'ia-ligne ec-ecartee' : 'ia-ligne';
    etat.textContent = ecartee ? ' · écartée' : '';
    jour.disabled = ecartee;
    geste.textContent = ecartee ? 'Rétablir' : 'Écarter';
    geste.setAttribute('aria-label', `${ecartee ? 'Rétablir' : 'Écarter'} : ${item.nom}`);
  };
  geste.addEventListener('click', () => {
    if (ecartes.has(item.id)) ecartes.delete(item.id); else ecartes.add(item.id);
    afficher();
    surChangement();
  });
  afficher();
  li.appendChild(h('div', { classe: 'ia-ligne-texte' },
    h('strong', null, item.nom),
    etat,
    h('span', { classe: 'meta' }, ` · service ${libelleJour(item.dateService)}`),
    item.motifs.map((m) => h('span', { classe: 'meta ia-avertissement' }, [' ', pastille('à confirmer', 'ambre'), ` ${m}`]))));
  li.appendChild(h('div', { classe: 'ia-ligne-quand' },
    h('label', { classe: 'meta', pour: idJour(item.id) }, 'Jour '), jour,
    valeur ? h('span', { classe: 'meta' }, ` · ${item.quantite.libelle} ${valeur}`) : null));
  li.appendChild(geste);
  return li;
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Jours corrigés par le chef dans le brouillon : `{ itemId: date }` pour chaque ligne gardée dont le champ diffère de la
 * proposition. `champsJour` est la table item → champ date (règle du projet : garder les champs dans une table plutôt que
 * les retrouver par sélecteur ; une NodeList de navigateur n'a pas `find`). */
function joursCorriges(champsJour, proposition, ecartes) {
  const jours = {};
  for (const item of proposition.items) {
    if (ecartes.has(item.id)) continue;
    const champ = champsJour.get(item.id);
    if (champ && champ.value && champ.value !== item.date) jours[item.id] = champ.value;
  }
  return jours;
}

/**
 * Contenu de la feuille « Brouillon » (testable sans ouvrir de panneau).
 * @param {object} proposition
 * @param {{mode:string, avertissements:string[], periode?:object|null, ecartes?:Set<string>, surChangement?:(restantes:number)=>void, champsJour?:Map<string,Element>}} infos
 *   `ecartes` : identifiants des lignes écartées par le chef ; `surChangement` est appelé avec le nombre de lignes restantes
 * @returns {Node[]}
 */
export function contenuProposition(proposition, { mode, avertissements, periode = null, ecartes = new Set(), surChangement = () => {}, champsJour = new Map() }) {
  const total = proposition.items.length;
  const compteur = h('span');
  const majCompteur = () => {
    const restantes = total - ecartes.size;
    compteur.textContent = ` ${pluriel(restantes, 'préparation')} à planifier${ecartes.size > 0 ? ` (${pluriel(ecartes.size, 'écartée')})` : ''}. Rien n'est enregistré avant votre validation.`;
    return restantes;
  };
  majCompteur();
  const nodes = [
    h('p', { classe: 'meta' },
      mode === 'modele' ? pastille("proposé par l'IA, recontrôlé", 'gris') : pastille('calculé par Sanji', 'vert'),
      compteur),
  ];
  if (periode) nodes.push(h('p', { classe: 'meta' }, `Période : du ${libelleJour(periode.dateDebut)} au ${libelleJour(periode.dateFin)}.`));
  for (const a of avertissements) nodes.push(encadre('alerte', a));
  if (proposition.items.length > 0) nodes.push(h('ul', { classe: 'ia-liste' }, proposition.items.map((i) => ligneItem(i, ecartes, () => surChangement(majCompteur()), champsJour))));
  else nodes.push(h('p', { classe: 'vide' }, 'Rien à planifier sur cette période.'));
  if (proposition.aDecider.length > 0) {
    nodes.push(h('h3', { classe: 'section-titre' }, 'À décider'),
      h('ul', { classe: 'ia-liste' }, proposition.aDecider.map((d) => h('li', { classe: 'ia-ligne' }, pastille('à décider', 'ambre'), ` ${d.texte}`))));
  }
  nodes.push(h('h3', { classe: 'section-titre' }, 'Pourquoi cette proposition'),
    h('ul', { classe: 'ia-pourquoi' }, expliquer(proposition).map((l) => h('li', { classe: 'meta' }, l))));
  return nodes;
}

function ouvrirBrouillon(resultat) {
  const { proposition } = resultat;
  const ecartes = new Set();
  const champsJour = new Map();
  let boutonValider = null;
  const corps = contenuProposition(proposition, {
    ...resultat,
    ecartes,
    champsJour,
    surChangement: (restantes) => { if (boutonValider) boutonValider.disabled = restantes === 0; },
  });
  if (proposition.items.length === 0) {
    panneau({ titre: 'Planning', corps, lectureSeule: true });
    return;
  }
  const dialogue = panneau({
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
    surEnregistrer: (api) => {
      // Une proposition n'est validée qu'une fois : après un échec d'application, un second clic ne rejoue pas la validation.
      if (ecartes.size === proposition.items.length) throw new Error('Toutes les préparations sont écartées : rétablissez-en une ou refusez le brouillon.');
      if (registre.lire(proposition.id).statut === 'brouillon') {
        // Un jour corrigé refusé (dimanche, après le service…) lève : le panneau affiche le message et reste ouvert, la
        // proposition reste un brouillon, le chef change la date et revalide.
        const jours = joursCorriges(champsJour, proposition, ecartes);
        decider(registre, proposition.id, { choix: 'valider', itemsRetires: [...ecartes], jours }, { executeur: agir, aujourdhui: aujourdhui() });
      }
      const r = appliquerProposition(registre, proposition.id, { executeur: agir, aujourdhui: aujourdhui() });
      if (!r.ok) {
        // Rien n'a été écrit. Le brouillon ne peut plus servir : on le dit et on ferme, au lieu de laisser une impasse.
        afficherMessage(`${r.message} Rien n'a été planifié : relancez « Proposer un planning ».`, 'alerte');
        api.fermer();
        return;
      }
      afficherMessage(`${r.appliques.length} préparation${r.appliques.length > 1 ? 's' : ''} planifiée${r.appliques.length > 1 ? 's' : ''}.`, 'ok');
    },
  });
  boutonValider = Array.from(dialogue.querySelectorAll('button')).find((b) => b.getAttribute('type') === 'submit') ?? null;
}

/** Lance le calcul puis ouvre le brouillon. Une seule demande à la fois ; fermer la fenêtre d'attente l'annule. */
export async function ouvrirAssistantPlanning({ date }) {
  if (enCours) return;
  enCours = true;
  let attente = null;
  let termine = false;
  try {
    const controleur = new AbortController();
    const reglages = lireReglagesIA();
    attente = panneau({
      titre: 'Planning proposé',
      lectureSeule: true,
      corps: [
        h('p', null, 'Calcul en cours…'),
        assistantPret(reglages)
          ? h('p', { classe: 'meta' }, `Le modèle ${reglages.modele} est consulté : il reçoit les noms des composants, les portions et un brouillon de départ ; les fiches de fonction et les allergies ne sont pas transmises.`)
          : h('p', { classe: 'meta' }, 'Calcul par Sanji seul, sans IA.'),
      ],
    });
    attente.addEventListener('close', () => { if (!termine) controleur.abort(); });
    const aujourd = aujourdhui();
    const periode = periodeDePlanning(date, aujourd);
    const resultat = await proposerPlanningAssiste({
      etat: etatCourant(), h: maintenant(), aujourdhui: aujourd, ...periode, registre,
      fournisseur: fournisseurDepuisReglages(reglages), signal: controleur.signal, delaiMs: DELAI_MODELE_MS,
    });
    termine = true;
    attente.close();
    if (!controleur.signal.aborted) ouvrirBrouillon({ ...resultat, periode });
  } catch (erreur) {
    termine = true;
    attente?.close();
    afficherMessage(`Planning impossible : ${erreur?.message ?? erreur}`, 'erreur');
  } finally {
    // Quoi qu'il arrive (échec d'ouverture du panneau compris), le bouton redevient utilisable.
    enCours = false;
  }
}

/** Le bouton à poser dans une vue. */
export const boutonProposerPlanning = (date) => bouton('Proposer un planning', () => { ouvrirAssistantPlanning({ date }); }, 'court');
