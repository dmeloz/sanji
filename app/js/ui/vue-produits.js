// Produits : besoin brut calculé, quantité vérifiée disponible, quantité proposée à commander, quantité à acheter.
// Aucun stock théorique, aucun approvisionnement garanti.

import { controlerProduit, definirAchat, marquerCommande } from '../domaine/actions.js';
import { ajouterJours, libelleJour, lundiDe } from '../domaine/dates.js';
import { besoinsProduits, echeanceCommande, suiviProduit } from '../domaine/produits.js';
import { LIBELLE_ESTIMATION_A_VALIDER, VERIF, libelle } from '../domaine/statuts.js';
import { agir, agirStrict, aujourdhui, etat as etatCourant } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, encadre, ligneVide, lien, navigationPeriode, pastille } from './elements.js';
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

function carteLigne(etat, lundi, ligne, aujourd) {
  const suivi = suiviProduit(etat, lundi, ligne);
  const fournisseur = suivi.fournisseurId ? etat.fournisseurs[suivi.fournisseurId] ?? null : null;
  const ech = echeanceCommande(ligne, fournisseur, aujourd);
  return h('article', { classe: 'carte ligne-produit' },
    h('div', { classe: 'composant-tete' },
      h('strong', { classe: 'tache-nom' }, ligne.nom),
      pastille(libelleVerif(suivi.statutAffiche), VARIANTE_VERIF[suivi.statutAffiche] ?? 'gris')),
    ligne.aValider ? h('p', null, pastille(LIBELLE_ESTIMATION_A_VALIDER, 'ambre'), h('span', { classe: 'meta' }, ' le besoin repose sur une estimation non validée')) : null,
    h('dl', { classe: 'definitions' },
      h('dt', null, 'Besoin brut calculé'), h('dd', null, quantite(ligne.besoinBrut, ligne.unite)),
      h('dt', null, 'Vérifié disponible'), h('dd', null, suivi.quantiteVerifiee === null ? 'non vérifié' : quantite(suivi.quantiteVerifiee, ligne.unite)),
      h('dt', null, 'Proposé à commander'), h('dd', null, suivi.proposeeACommander === null ? '— (après vérification)' : quantite(suivi.proposeeACommander, ligne.unite)),
      h('dt', null, 'À acheter'), h('dd', null, suivi.quantiteAcheter === null ? 'à saisir' : quantite(suivi.quantiteAcheter, ligne.unite)),
      h('dt', null, 'Conditionnement'), h('dd', null, suivi.conditionnement || 'non précisé'),
      h('dt', null, 'Fournisseur'), h('dd', null, fournisseur ? fournisseur.nom : 'non précisé'),
      h('dt', null, 'Première utilisation'), h('dd', null, libelleJour(ligne.premiereUtilisation)),
      h('dt', null, 'Échéance de commande'), h('dd', null, pastille(texteEcheance(ech), VARIANTE_ECHEANCE[ech.statut] ?? 'gris')),
      h('dt', null, 'Commande passée'), h('dd', null, suivi.commandeLe ? `oui, le ${formaterHeure(suivi.commandeLe)}` : 'non')),
    suivi.statutAffiche === 'a_reverifier' ? h('p', { classe: 'alerte-texte' }, 'Le besoin a changé depuis le contrôle : à revérifier.') : null,
    h('div', { classe: 'actions' },
      bouton('Contrôler', () => dialogControle(lundi, ligne), 'court'),
      bouton('Achat', () => dialogAchat(lundi, ligne), 'court'),
      bouton('Marquer commandé', () => agir((e, t) => marquerCommande(e, lundi, ligne.cle, ligne.unite, t)), 'court',
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
  racine.appendChild(h('h2', { classe: 'section-titre' }, 'Besoins chiffrés'));
  if (lignes.length === 0) racine.appendChild(ligneVide('Aucun besoin chiffré cette semaine : il faut des composants attribués, validés et calculables.'));
  for (const l of lignes) racine.appendChild(carteLigne(etat, lundi, l, aujourd));
  racine.appendChild(h('h2', { classe: 'section-titre' }, 'Composants non chiffrables : composition à définir'));
  if (nonChiffrables.length === 0) racine.appendChild(ligneVide('Aucun composant non chiffrable.'));
  else {
    racine.appendChild(h('ul', { classe: 'liste-points' }, nonChiffrables.map((n) => h('li', null,
      h('span', null, `${n.nom} (${libelleJour(n.date)}) : ${n.raison}`),
      lien(`#/composant/${encodeURIComponent(n.composantId)}`, 'Ouvrir', 'btn btn-court')))));
  }
  return racine;
}
