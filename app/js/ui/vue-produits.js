// Produits : besoin brut calculé, quantité vérifiée disponible, quantité proposée à commander, quantité à acheter.
// Aucun stock théorique, aucun approvisionnement garanti.

import { noterAchat, restaurerAchat, retirerAchat } from '../domaine/actions-achats.js';
import { controlerProduit, definirAchat, marquerCommande } from '../domaine/actions.js';
import { ajouterJours, libelleJour, lundiDe } from '../domaine/dates.js';
import { besoinsProduits, echeanceCommande, suiviProduit } from '../domaine/produits.js';
import { LIBELLE_ESTIMATION_A_VALIDER, VERIF, libelle } from '../domaine/statuts.js';
import { agir, agirStrict, aujourdhui, etat as etatCourant } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, imprimer, encadre, ligneVide, lien, navigationPeriode, pastille, repliable } from './elements.js';
import { formaterHeure, quantite } from './format.js';
import { panneau } from './panneau.js';

export const titre = () => 'Produits';

const libelleVerif = (v) => (v === 'suffisant' ? 'suffisant vérifié' : libelle('VERIF', v));
const VARIANTE_VERIF = { a_verifier: 'ambre', suffisant: 'vert', a_commander: 'gris', a_reverifier: 'rouge' };
const VARIANTE_ECHEANCE = { a_renseigner: 'ambre', ok: 'vert', aujourdhui: 'ambre', depassee: 'rouge' };

function texteEcheance(ech) {
  switch (ech.statut) {
    case 'a_renseigner': return 'délai fournisseur à renseigner';
    case 'ok': return `dans les temps (à commander avant le ${libelleJour(ech.dateLimite)})`;
    case 'aujourdhui': return `à commander aujourd'hui (limite : ${libelleJour(ech.dateLimite)})`;
    default: return `dépassée (limite : ${libelleJour(ech.dateLimite)})`;
  }
}

function dialogControle(lundi, ligne) {
  const suivi = suiviProduit(etatCourant(), lundi, ligne);
  const f = champs([
    { cle: 'statut', type: 'choix', libelle: 'Contrôle', valeur: suivi.statut,
      options: Object.keys(VERIF).map((v) => [v, libelleVerif(v)]) },
    { cle: 'quantite', type: 'nombre', libelle: `Quantité vérifiée disponible pour ce besoin (${ligne.unite === 'piece' ? 'pièces' : ligne.unite})`,
      valeur: suivi.quantiteVerifiee,
      aide: 'Une impression de disponibilité ne vaut pas vérification : saisissez une quantité réellement comptée ou pesée. Inutile si « à vérifier ».' },
  ]);
  panneau({
    titre: `Contrôle : ${ligne.nom}`,
    corps: [h('p', null, `Besoin brut calculé : ${quantite(ligne.besoinBrut, ligne.unite)}`), ...f.noeuds],
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((e, t) => controlerProduit(e, lundi, ligne.cle, ligne.unite, v.statut, v.quantite, t));
    },
  });
}

function dialogAchat(lundi, ligne) {
  const e = etatCourant();
  const suivi = suiviProduit(e, lundi, ligne);
  const fournisseurs = Object.values(e.fournisseurs).sort((a, b) => a.nom.localeCompare(b.nom));
  const f = champs([
    { cle: 'achat', type: 'nombre', libelle: `Quantité à acheter (${ligne.unite === 'piece' ? 'pièces' : ligne.unite})`, valeur: suivi.quantiteAcheter,
      aide: suivi.proposeeACommander !== null ? `Proposition : ${quantite(suivi.proposeeACommander, ligne.unite)}. La quantité à acheter n'est jamais remplie à votre place.` : 'Jamais remplie automatiquement.' },
    { cle: 'conditionnement', type: 'texte', libelle: 'Conditionnement', valeur: suivi.conditionnement, placeholder: 'conditionnement si connu' },
    { cle: 'fournisseurId', type: 'choix', libelle: 'Fournisseur', valeur: suivi.fournisseurId,
      options: [[null, 'non précisé'], ...fournisseurs.map((x) => [x.id, x.nom])] },
  ]);
  panneau({
    titre: `Achat : ${ligne.nom}`,
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((x, t) => definirAchat(x, lundi, ligne.cle, ligne.unite,
        { quantiteAcheter: v.achat, conditionnement: v.conditionnement, fournisseurId: v.fournisseurId }, t));
    },
  });
}

const ETAT_LIGNE = { suggere: 'Suggéré', note: 'Noté à commander', retire: 'Retiré' };
const ETAT_COURT = { suggere: 'suggéré', note: 'noté', retire: 'retiré' };

/** Noter à commander : une ligne qui repose sur une estimation exige une quantité tapée ; l'application ne la remplit jamais. */
function dialogNoter(lundi, ligne) {
  const f = champs([
    { cle: 'quantite', type: 'nombre', libelle: `Quantité à commander (${ligne.unite === 'piece' ? 'pièces' : ligne.unite})`,
      valeur: suiviProduit(etatCourant(), lundi, ligne).quantiteAcheter,
      aide: ligne.aValider ? 'Ce besoin repose sur une estimation : tapez vous-même la quantité à commander. Elle est obligatoire et jamais remplie à votre place.'
        : 'Facultative : vide, la ligne est seulement notée.' },
  ]);
  panneau({
    titre: `Noter à commander : ${ligne.nom}`,
    corps: [h('p', null, `Besoin brut calculé : ${quantite(ligne.besoinBrut, ligne.unite)}`), ...f.noeuds],
    libelleEnregistrer: 'Noter à commander',
    surEnregistrer: () => {
      const q = f.lire().quantite;
      agirStrict((e, t) => noterAchat(e, lundi, ligne.cle, ligne.unite, q === null ? {} : { quantite: q }, t));
    },
  });
}

/** « 2 400 g » : le chiffre en gros, l'unité à côté (le texte complet reste lu par les lecteurs d'écran). */
function besoinEnGros(ligne) {
  const texte = quantite(ligne.besoinBrut, ligne.unite);
  const i = texte.lastIndexOf(' ');
  return h('span', { classe: 'produit-besoin', 'aria-label': `besoin brut ${texte}` },
    h('span', { classe: 'produit-chiffre feutre', 'aria-hidden': 'true' }, i < 0 ? texte : texte.slice(0, i)),
    i < 0 ? null : h('span', { classe: 'produit-unite', 'aria-hidden': 'true' }, texte.slice(i + 1)));
}

/** Une ligne par produit ; un toucher déplie les détails et les gestes. L'état est écrit en toutes lettres. */
function carteLigne(etat, lundi, ligne, aujourd) {
  const suivi = suiviProduit(etat, lundi, ligne);
  const fournisseur = suivi.fournisseurId ? etat.fournisseurs[suivi.fournisseurId] ?? null : null;
  const ech = echeanceCommande(ligne, fournisseur, aujourd);
  const detail = (cle, valeur) => [h('dt', null, cle), h('dd', null, valeur)];
  return h('details', { classe: 'produit-compact' },
    h('summary', { classe: 'produit-resume' },
      h('span', { classe: 'produit-ligne' },
        h('strong', { classe: 'produit-nom' }, ligne.nom),
        besoinEnGros(ligne)),
      h('span', { classe: 'produit-etat' },
        h('span', { classe: 'produit-etat-texte' }, ETAT_COURT[suivi.etatLigne] ?? ETAT_COURT.suggere,
          suivi.aRelire ? ' · à relire' : ''),
        ligne.aValider ? pastille(LIBELLE_ESTIMATION_A_VALIDER, 'ambre') : null)),
    suivi.aRelire ? h('p', { classe: 'meta' }, 'À relire : le besoin a changé depuis que vous l\'avez noté ; la quantité notée n\'a pas bougé.') : null,
    ligne.aValider ? h('p', { classe: 'meta' }, 'Le besoin repose sur une estimation non validée.') : null,
    h('dl', { classe: 'definitions' },
      detail('Contrôle', pastille(libelleVerif(suivi.statutAffiche), VARIANTE_VERIF[suivi.statutAffiche] ?? 'gris')),
      detail('État', ETAT_LIGNE[suivi.etatLigne] ?? ETAT_LIGNE.suggere),
      detail('Besoin brut calculé', quantite(ligne.besoinBrut, ligne.unite)),
      detail('Vérifié disponible', suivi.quantiteVerifiee === null ? 'non vérifié' : quantite(suivi.quantiteVerifiee, ligne.unite)),
      detail('Proposé à commander', suivi.proposeeACommander === null ? '— (après vérification)'
        : `${quantite(suivi.proposeeACommander, ligne.unite)}${suivi.margePourcent ? ` (dont ${suivi.margePourcent} % de marge)` : ''}`),
      detail('À acheter', suivi.quantiteAcheter === null ? 'à saisir' : quantite(suivi.quantiteAcheter, ligne.unite)),
      detail('Conditionnement', suivi.conditionnement || 'non précisé'),
      detail('Fournisseur', fournisseur ? fournisseur.nom : 'non précisé'),
      detail('Première utilisation', libelleJour(ligne.premiereUtilisation)),
      detail('Échéance de commande', pastille(texteEcheance(ech), VARIANTE_ECHEANCE[ech.statut] ?? 'gris')),
      detail('Commande passée', suivi.commandeLe ? `oui, le ${formaterHeure(suivi.commandeLe)}` : 'non')),
    suivi.statutAffiche === 'a_reverifier' ? h('p', { classe: 'alerte-texte' }, 'Le besoin a changé depuis le contrôle : à revérifier.') : null,
    h('div', { classe: 'actions' },
      suivi.etatLigne === 'retire'
        ? bouton('Remettre', () => agir((e, t) => restaurerAchat(e, lundi, ligne.cle, ligne.unite, t)), 'court')
        : [bouton('Noter à commander', () => dialogNoter(lundi, ligne), 'court'),
          bouton('Retirer', () => agir((e, t) => retirerAchat(e, lundi, ligne.cle, ligne.unite, t)), 'court')],
      bouton('Contrôler', () => dialogControle(lundi, ligne), 'court'),
      bouton('Achat', () => dialogAchat(lundi, ligne), 'court'),
      suivi.etatLigne === 'retire' ? null
        : bouton('Marquer commandé', () => agir((e, t) => marquerCommande(e, lundi, ligne.cle, ligne.unite, t)), 'court',
          { disabled: suivi.quantiteAcheter === null }),
    ));
}

export function rendre(etat, lundi) {
  const aujourd = aujourdhui();
  const { lignes, nonChiffrables } = besoinsProduits(etat, lundi);
  const racine = h('div', { classe: 'vue vue-produits' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, `Produits : semaine du ${libelleJour(lundi)}`));
  racine.appendChild(navigationPeriode(
    { href: `#/produits/${ajouterJours(lundi, -7)}`, texte: '‹ Semaine précédente' },
    { href: `#/produits/${lundiDe(aujourd)}`, texte: "Aujourd'hui" },
    { href: `#/produits/${ajouterJours(lundi, 7)}`, texte: 'Semaine suivante ›' }));
  racine.appendChild(encadre('info', 'Aucun stock théorique, aucun approvisionnement garanti.'));
  racine.appendChild(h('div', { classe: 'actions pas-imprime' }, bouton('Imprimer la liste', imprimer, 'court')));
  racine.appendChild(h('h2', { classe: 'section-titre' }, 'Besoins chiffrés'));
  if (lignes.length === 0) racine.appendChild(ligneVide('Aucun besoin chiffré cette semaine : il faut des composants attribués, validés et calculables.'));
  const retiree = (l) => suiviProduit(etat, lundi, l).etatLigne === 'retire';
  const actives = lignes.filter((x) => !retiree(x));
  if (actives.length > 0) racine.appendChild(h('div', { classe: 'produits-liste' }, actives.map((l) => carteLigne(etat, lundi, l, aujourd))));
  const retirees = lignes.filter(retiree);
  if (retirees.length > 0) {
    racine.appendChild(repliable(`Retirées (${retirees.length})`, false,
      h('div', { classe: 'produits-liste' }, retirees.map((l) => carteLigne(etat, lundi, l, aujourd))), { classe: 'lignes-retirees' }));
  }
  // Composants sans quantité : une seule ligne repliée avec leur compte (information neutre), pas une pile de boutons.
  if (nonChiffrables.length === 0) {
    racine.appendChild(h('h2', { classe: 'section-titre' }, 'Composants non chiffrables'));
    racine.appendChild(ligneVide('Aucun composant non chiffrable.'));
  } else {
    racine.appendChild(repliable(
      `${nonChiffrables.length === 1 ? '1 composant non chiffrable' : `${nonChiffrables.length} composants non chiffrables`} : composition ou quantité à définir`,
      false,
      h('ul', { classe: 'liste-points liste-compacte' }, nonChiffrables.map((n) => h('li', null,
        h('span', null, `${n.nom} (${libelleJour(n.date)}) : ${n.raison}`),
        lien(`#/composant/${encodeURIComponent(n.composantId)}`, 'Ouvrir', 'btn btn-court')))),
      { classe: 'carte' }));
  }
  return racine;
}
