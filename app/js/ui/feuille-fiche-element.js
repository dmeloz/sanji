// La petite fiche d'un élément (v118), en feuille vivante : nom (« Corriger le nom »), catégorie, portion,
// « Oublier cette fiche ». Chaque geste est une action de domaine/actions-fiches.js ; la feuille se redessine d'elle-même.
// Aucune logique métier ici.

import { definirPortionFiche, oublierFiche, reclasserFiche, renommerFiche } from '../domaine/actions-fiches.js';
import { nomDeFiche, portionDeFiche, resumeDeFiche } from '../domaine/fiches-elements.js';
import { cleDeNom } from '../domaine/fiches-retenues.js';
import { CATEGORIES_MOT, choixMotDe } from '../domaine/mots-retenus.js';
import { ROLES_STANDARD } from '../domaine/savoir.js';
import { ETAT_POIDS, LIBELLES } from '../domaine/statuts.js';
import { agir } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, pastille } from './elements.js';
import { iconeChoix } from './enseigner-mot.js';
import { feuilleVivante } from './feuille-services.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';

const OPTIONS_POIDS = Object.keys(ETAT_POIDS).map((cle) => [cle, LIBELLES.ETAT_POIDS[cle]]);
const sousTitre = (texte) => h('h3', { classe: 'fe-sous-titre' }, texte);

/** Nom : un champ prérempli et « Enregistrer » ; la fiche peut changer de clé (le nom corrigé), `suivre` la rejoint. */
function blocNom(cle, fiche, suivre) {
  const nom = nomDeFiche(cle, fiche);
  const f = champs([{ cle: 'nom', type: 'texte', libelle: 'Corriger le nom', valeur: nom }]);
  const enregistrer = () => {
    const neuf = String(f.valeur('nom') ?? '').trim();
    if (neuf === nom) return;
    suivre(cleDeNom(neuf)); // avant l'action : la feuille se redessine tout de suite, sous la nouvelle clé
    const r = agir((e, t) => renommerFiche(e, cle, neuf, t));
    if (!r.ok) { suivre(cle); return; }
    afficherMessage(r.valeur.retenue ? `Retenu : ${r.valeur.ancien} s'écrira ${r.valeur.nom}.` : `Nom corrigé : ${r.valeur.nom}.`, 'ok');
  };
  return h('div', { classe: 'corriger-nom' }, ...f.noeuds,
    h('div', { classe: 'actions' }, bouton('Enregistrer', enregistrer, 'court', { 'aria-label': 'Enregistrer le nom corrigé' })));
}

/** Catégorie : les quatre choix de « enseigner-mot » ; celui de la fiche est dit en toutes lettres et pressé. */
function blocCategorie(cle, fiche) {
  const actuel = choixMotDe(fiche);
  return h('div', { classe: 'fe-bloc' }, sousTitre('Catégorie'),
    h('p', null, actuel ? pastille(CATEGORIES_MOT[actuel], 'vert') : pastille('à préciser', 'ambre')),
    h('div', { classe: 'enseigner' }, h('div', { classe: 'actions' }, Object.keys(CATEGORIES_MOT).map((choix) => h('button', {
      type: 'button', classe: `btn btn-court enseigner-choix${choix === actuel ? ' btn-principal' : ''}`, 'aria-pressed': choix === actuel ? 'true' : 'false',
      onClick: () => agir((e, t) => reclasserFiche(e, cle, choix, t)),
    }, iconeChoix(choix), CATEGORIES_MOT[choix])))));
}

/** Portion : un champ g et l'état du poids, seulement pour un plat principal ou une garniture. */
function blocPortion(etat, cle, fiche) {
  const portion = portionDeFiche(etat, cle, fiche);
  const entete = [sousTitre('Portion'), h('p', null, portion ? pastille(resumeDeFiche(fiche, portion), 'vert') : pastille('portion à saisir', 'ambre'))];
  if (!ROLES_STANDARD.includes(fiche.role)) {
    return h('div', { classe: 'fe-bloc' }, ...entete, h('p', { classe: 'aide' }, 'Une portion se règle pour un plat principal ou une garniture.'));
  }
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Portion (g)', valeur: portion?.valeur ?? null },
    { cle: 'etat', type: 'choix', libelle: 'Poids', options: OPTIONS_POIDS, valeur: portion?.etat ?? 'cuit' },
  ]);
  const enregistrer = () => {
    const r = agir((e, t) => definirPortionFiche(e, cle, f.valeur('valeur'), f.valeur('etat'), t));
    if (r.ok) afficherMessage('Portion retenue.', 'ok');
  };
  return h('div', { classe: 'fe-bloc' }, ...entete, ...f.noeuds,
    h('div', { classe: 'actions' }, bouton('Enregistrer la portion', enregistrer, 'court')));
}

function oublier(cle, fiche, fermer) {
  confirmer({
    titre: 'Oublier cette fiche ?', texte: `« ${nomDeFiche(cle, fiche)} » et ses orthographes retenues seront oubliées. Les éléments déjà créés ne changent pas.`,
    libelleOk: 'Oublier', danger: true,
    action: () => { const r = agir((e, t) => oublierFiche(e, cle, t), { afficher: false }); if (!r.ok) throw new Error(r.erreur); fermer(); },
  });
}

/** Ouvre la petite fiche de la fiche retenue de clé `cleDepart`. */
export function ouvrirFicheElement(cleDepart) {
  let cle = cleDepart;
  return feuilleVivante({
    titre: 'Fiche de l\'élément',
    construire: (etat, { fermer }) => {
      const fiche = etat.fiches_retenues?.[cle];
      if (!fiche) return h('p', { classe: 'vide' }, 'Cette fiche n\'existe plus.');
      return h('div', { classe: 'fiche-element' },
        h('p', { classe: 'fe-nom' }, nomDeFiche(cle, fiche)),
        blocNom(cle, fiche, (neuve) => { cle = neuve; }),
        blocCategorie(cle, fiche), blocPortion(etat, cle, fiche),
        h('div', { classe: 'actions' }, bouton('Oublier cette fiche', () => oublier(cle, fiche, fermer), 'danger court')));
    },
  });
}
