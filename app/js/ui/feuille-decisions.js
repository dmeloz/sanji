// Feuille « À décider » (maquette « Exceptions ») : un <dialog> (panneau.js) qui monte du bas, une carte par décision RÉELLE
// (`decisionsDe`, domaine/decisions.js) avec les actions qui existent déjà : arbitrer un écart, replanifier une avance hors
// règle, choisir la sauce, confirmer une répartition, accepter ou écarter une proposition de l'apprentissage, valider une
// valeur. Une quantité absente n'est jamais une décision. Aucune logique métier ici. La feuille se met à jour sur place quand l'état
// change (une décision prise disparaît) et reste ouverte jusqu'à « OK » ; vide : « Tout est réglé ». Fermeture au bouton et à Échap, focus rendu à l'appelant.

import { libelleJour } from '../domaine/dates.js';
import { decisionsDe } from '../domaine/decisions.js';
import { abonner, aujourdhui, etat as etatCourant } from '../magasin.js';
import { h, svg } from './dom.js';
import { dialogRepartition } from './fiches.js';
import { ouvrirProposition, ouvrirValidations, texteFourchette } from './feuille-validation.js';
import { qteNoeuds, quantite } from './format.js';
import { boutonsGestes, texteRepartition } from './geste-rapide.js';
import { panneau } from './panneau.js';
import { dialogCorriger, dialogDecider, dialogPlanifier } from './taches.js';
import { dialogAllergenes, dialogChoisirSauce, dialogModifier, texteObstacleAllergenes } from './vue-composant.js';

const ETIQUETTE_POINT = {
  allergenes: 'Allergènes à confirmer', conservation: 'Conservation à confirmer', composant_inconnu: 'À classer',
  creneau_charge: 'Créneau chargé', repartition_incoherente: 'Répartition incohérente', semaine_type: 'Semaine type à confirmer', etat_poids_portion: 'État du poids à confirmer',
};
const ROLE_EN_CLAIR = { plat_principal: 'en plat principal', garniture: 'en garniture' };

let feuilleOuverte = false;

function icone(chemins, classe = 'dec-icone', taille = 16) {
  return svg('svg', { classe, viewBox: '0 0 24 24', width: taille, height: taille, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
  chemins.map((d) => svg('path', { d })));
}

/** Une carte : étiquette (mot écrit + icône), titre, détail, un ou deux gestes. `fermer` ferme la feuille avant un changement de page. */
/** `valeurs` : toutes les valeurs à valider de la feuille, pour le parcours « une par une » (la valeur touchée d'abord). */
function carte(c, fermer, valeurs = [], etat = etatCourant()) {
  // Geste d'un toucher quand il est sûr (geste-rapide.js) : en tête de la carte ; les dialogues des autres genres ne changent pas.
  const gestes = boutonsGestes(etat, c, 'btn btn-decision dec-btn');
  // `bouton()` préfixe chaque classe par « btn- » : la classe de mise en page `dec-btn` est donc posée ici, sans préfixe.
  const geste = (classe) => (texte, surClic, extra) => h('button', { type: 'button', classe, onClick: surClic, ...extra }, texte);
  const principal = geste('btn btn-decision dec-btn');
  const secondaire = geste('btn dec-btn');
  const versLien = (href, texte) => h('a', { href, classe: 'btn dec-btn', onClick: fermer }, texte);
  let etiquette; let titre; let detail = null; let actions;
  switch (c.genre) {
    case 'ecart': {
      etiquette = 'Écart à arbitrer';
      titre = c.nom;
      const morceaux = [];
      if (c.cible !== null) morceaux.push(['cible ', quantite(c.cible, c.unite)]);
      if (c.reel !== null) morceaux.push(['réel ', quantite(c.reel, c.unite)]);
      if (c.ecart !== null && c.ecart > 0) morceaux.push(['il manque ', quantite(c.ecart, c.unite)]);
      if (c.ecart !== null && c.ecart < 0) morceaux.push(['surplus de ', quantite(-c.ecart, c.unite)]);
      detail = [morceaux.map(([mot, q], i) => [i > 0 ? ' · ' : null, mot, h('span', { classe: 'dec-qte' }, qteNoeuds(q))]),
        // Un réel non compté (fait un dimanche, hors règle…) : dit pourquoi « il manque » même si le réel égale la cible.
        c.reelNonCompte ? [' · ', h('span', { classe: 'dec-qte' }, qteNoeuds(quantite(c.reelNonCompte.quantite, c.unite))),
          ` non comptés : ${c.reelNonCompte.raison}`] : null,
        h('span', { classe: 'dec-choix' }, 'Complément (produire le reste), ajustement (écart réglé, rien de plus) ou aucune production supplémentaire.')];
      actions = [principal('Décider', () => dialogDecider(c.productionId), { 'aria-label': `Décider de l'écart : ${c.nom}` }),
        versLien(`#/fiche/${encodeURIComponent(c.composantId)}`, 'Ouvrir la fiche')];
      break;
    }
    case 'avance_hors_regle':
      etiquette = 'Avance hors règle';
      titre = `${c.nom} pour ${libelleJour(c.dateService)}`;
      detail = [h('strong', { classe: 'dec-mot' }, c.limiteDepassee ? "limite d'utilisation dépassée" : 'hors règle'),
        ` : avance de ${c.jours} jour${c.jours > 1 ? 's' : ''}, le besoin n'est pas couvert.`];
      if (c.fait) {
        // Déjà faite : replanifier ne changerait rien. Aucune exception « gardée » par production n'existe : seule une règle
        // de préparation (avance maximale, limite d'utilisation) autorise une telle avance ; sinon on corrige le réel.
        detail.push(h('span', { classe: 'dec-choix' }, ' Déjà faite : elle ne se replanifie plus. Si cette avance est voulue, '
          + 'la règle de préparation (avance maximale et limite d\'utilisation) la rend conforme ; sinon corrigez la quantité réellement faite.'));
        actions = [principal('Corriger le réel', () => dialogCorriger(c.productionId), { 'aria-label': `Corriger le réel : ${c.nom}` }),
          versLien('#/reglages/organisation', 'Règle de préparation'),
          versLien(`#/fiche/${encodeURIComponent(c.composantId)}`, 'Ouvrir la fiche')];
        break;
      }
      actions = [principal('Replanifier', () => dialogPlanifier(c.productionId, 'reporter'), { 'aria-label': `Replanifier : ${c.nom}` }),
        versLien(`#/fiche/${encodeURIComponent(c.composantId)}`, 'Ouvrir la fiche')];
      break;
    case 'sauce':
      etiquette = 'Sauce à confirmer';
      titre = c.nom;
      detail = `Menu du ${libelleJour(c.date)} : rien n'est choisi à votre place.`;
      actions = [principal('Choisir la sauce', () => dialogChoisirSauce(etatCourant().composants[c.composantId]), { 'aria-label': `Choisir la sauce : ${c.nom}` }),
        versLien(`#/production/${c.date}`, 'Voir le jour')];
      break;
    case 'repartition':
      etiquette = 'Répartition provisoire';
      titre = `Fiche ${c.numero}`;
      detail = [`${libelleJour(c.date)} : `, h('span', { classe: 'dec-qte' }, String(c.couverts)), ' couverts, répartition provisoire : ',
        h('strong', { classe: 'dec-mot' }, texteRepartition(etat, c.ficheId)), '.'];
      actions = [...gestes, secondaire('Modifier la répartition', () => dialogRepartition(c.ficheId), { 'aria-label': `Modifier la répartition : fiche ${c.numero}` }),
        versLien(`#/production/${c.date}`, 'Voir le jour')];
      break;
    case 'point': {
      etiquette = ETIQUETTE_POINT[c.type] ?? 'À confirmer';
      titre = c.texte;
      const href = c.composantId ? `#/fiche/${encodeURIComponent(c.composantId)}` : c.date ? `#/production/${c.date}` : c.type === 'etat_poids_portion' ? '#/reglages/standards' : '#/reglages';
      if (c.type === 'allergenes' && c.composantId && etatCourant().composants[c.composantId]) {
        // Valider la liste ne règle rien quand la composition manque : l'action proposée est celle qui règle vraiment.
        const composant = () => etatCourant().composants[c.composantId];
        const fiche = versLien(`#/fiche/${encodeURIComponent(c.composantId)}`, 'Ouvrir la fiche');
        if (c.obstacle === 'composition à définir') {
          detail = texteObstacleAllergenes(c.obstacle);
          actions = [principal('Définir la composition', () => dialogModifier(composant()), { 'aria-label': `Définir la composition : ${composant().nom}` }), fiche];
        } else if (c.obstacle) {
          detail = texteObstacleAllergenes(c.obstacle);
          actions = [h('a', { href, classe: 'btn dec-btn btn-decision', onClick: fermer }, 'Ouvrir la fiche'),
            secondaire('Renseigner les allergènes', () => dialogAllergenes(composant()), { 'aria-label': `Renseigner les allergènes : ${composant().nom}` })];
        } else {
          actions = [principal('Renseigner les allergènes', () => dialogAllergenes(composant()), { 'aria-label': `Renseigner les allergènes : ${composant().nom}` }), fiche];
        }
        break;
      }
      actions = [...gestes, h('a', { href, classe: gestes.length > 0 ? 'btn dec-btn' : 'btn dec-btn btn-decision', onClick: fermer }, 'Ouvrir')];
      break;
    }
    case 'apprentissage': {
      const p = c.proposition;
      etiquette = "Proposition de l'apprentissage";
      titre = p.texte;
      detail = p.actuelle ? "Vous corrigez souvent cette portion dans le même sens. Rien n'est appliqué sans votre accord." : "Cette famille n'a pas encore de standard. Rien n'est appliqué sans votre accord.";
      actions = [...gestes, secondaire('Examiner', () => ouvrirProposition(p), { 'aria-label': `Examiner la proposition : ${p.libelle}` })];
      break;
    }
    default: {
      const v = c.valeur;
      etiquette = 'Valeur à valider';
      titre = `${v.libelle} ${ROLE_EN_CLAIR[v.role] ?? ''}`.trim();
      detail = ['Estimation à valider : ', h('span', { classe: 'dec-qte' }, texteFourchette(v.proposition)), '.'];
      actions = [...gestes, secondaire('Autre valeur', () => { fermer(); ouvrirValidations([v, ...valeurs.filter((x) => x !== v)]); }, { 'aria-label': `Choisir une autre valeur : ${titre}` })];
    }
  }
  return h('article', { classe: 'dec-carte', dataset: { genre: c.genre } },
    h('p', { classe: 'dec-etiquette' }, icone(['M12 3l10 18H2z', 'M12 10v5M12 18v.5']), h('span', null, etiquette)),
    h('h3', { classe: 'dec-titre' }, titre),
    detail ? h('p', { classe: 'dec-detail' }, detail) : null,
    h('div', { classe: 'dec-actions' }, actions));
}

/** « OK » : la feuille reste ouverte après chaque décision (elle se met à jour sur place) jusqu'à ce geste. */
function boutonOk(fermer) {
  return h('div', { classe: 'dec-fin' }, h('button', { type: 'button', classe: 'btn btn-decision dec-btn dec-ok', onClick: fermer }, 'OK'));
}

/** Contenu de la feuille pour un état : sous-titre, nombre, cartes ou état vide. */
export function contenuDecisions(etat, aujourd, fermer = () => {}) {
  const { total, cartes } = decisionsDe(etat, aujourd);
  const entete = h('div', { classe: 'dec-entete' },
    h('p', { classe: 'dec-sous' }, "Sanji a tranché le reste. Ici, c'est vous qui décidez."),
    total > 0 ? h('p', { classe: 'dec-nombre' }, h('span', { classe: 'dec-qte' }, String(total)), total === 1 ? ' décision à prendre' : ' décisions à prendre') : null);
  if (total === 0) {
    return [entete, h('div', { classe: 'dec-vide' },
      icone(['M8 12l3 3 5-6', 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0'], 'dec-icone-vide', 40),
      h('p', { classe: 'dec-vide-titre' }, 'Tout est réglé'),
      h('p', { classe: 'dec-sous' }, 'Sanji continue avec vos décisions.')), boutonOk(fermer)];
  }
  const valeurs = cartes.filter((c) => c.genre === 'valeur').map((c) => c.valeur);
  return [entete, h('div', { classe: 'dec-cartes' }, cartes.map((c) => carte(c, fermer, valeurs, etat))), boutonOk(fermer)];
}

/** Ouvre la feuille « À décider » (appelée par le bandeau de l'écran Aujourd'hui). Une seule feuille à la fois. */
export function ouvrirDecisions() {
  if (typeof document === 'undefined' || feuilleOuverte) return;
  feuilleOuverte = true;
  const appelant = document.activeElement ?? null;
  const zone = h('div', { classe: 'dec-zone', 'aria-live': 'polite' });
  let dialogue = null;
  const fermer = () => dialogue?.close();
  const remplir = () => zone.replaceChildren(...contenuDecisions(etatCourant(), aujourdhui(), fermer));
  remplir();
  dialogue = panneau({ titre: 'À décider', corps: [zone], lectureSeule: true });
  dialogue.className = `${dialogue.className} feuille-decisions`;
  // Le titre reçoit le focus à l'ouverture ; si un changement d'état retire le bouton focalisé, le focus y revient.
  const titre = dialogue.querySelector('h2');
  titre?.setAttribute('tabindex', '-1');
  titre?.focus?.();
  const desabonner = abonner(() => {
    remplir();
    const dedans = typeof dialogue.contains === 'function' && dialogue.contains(document.activeElement);
    if (typeof dialogue.contains === 'function' && !dedans) titre?.focus?.();
  });
  dialogue.addEventListener('close', () => {
    desabonner();
    feuilleOuverte = false;
    if (appelant && appelant.isConnected !== false) appelant.focus?.();
  });
}
