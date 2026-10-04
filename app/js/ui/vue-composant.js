// Composant : calcul, formule, paramètres et provenance, étapes, pesée, mémoire maison, allergènes, productions.

import {
  composerMelange, enregistrerPesee, memoriser, modifierComposant, reprendreMemoire, saisirApresService, supprimerComposant,
} from '../domaine/actions.js';
import { obstacleValidationAllergenes, statutAllergenes } from '../domaine/allergenes.js';
import { chercherBase } from '../domaine/base.js';
import { calculerComposant } from '../domaine/calcul.js';
import { libelleJour } from '../domaine/dates.js';
import { estSauceAConfirmer, lireMemoire, normaliser } from '../domaine/etat.js';
import { SAUCES } from '../domaine/vocabulaire-plats.js';
import { etapesComposant } from '../domaine/planification.js';
import { cleStandardDe, valeurPour } from '../domaine/validation.js';
import {
  CHARGE, ETAPE, ETAT_POIDS, LIBELLE_ESTIMATION_A_VALIDER, ROLE, TYPE_COMPOSANT, UNITE, CATEGORIE, libelle,
} from '../domaine/statuts.js';
import { VERSION_BASE } from '../donnees/base-metier.js';
import { agir, agirStrict, aujourdhui, etat as etatCourant } from '../magasin.js';
import { champs } from './champs.js';
import { ouvrirValidation } from './feuille-validation.js';
import { h } from './dom.js';
import { bouton, ligneVide, lien, pastille, repliable } from './elements.js';
import {
  coefficientDepuis, formaterNombre, libelleCoefficient, milieu, modeDepuisCoefficient, pluriel, quantite, quantiteNoeuds,
} from './format.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { ALLERGENES, PROVENANCES_SAISIE, libelleAllergene, texteSourceAllergenes } from './reference.js';
import { blocReperes } from './reperes-metier.js';
import { carteTache, dialogPreparatoire, ligneProduction } from './taches.js';

export const titre = () => 'Composant';

const VARIANTE_PROVENANCE = {
  RESTAURANT_VALIDE: 'vert', STANDARD_BASE: 'gris', BASE_METIER_ESTIMATION: 'gris', SAISI_SERVICE: 'gris', CALCULE: 'vert', INCONNU: 'gris',
};
const pastilleProvenance = (statut) => pastille(libelle('PROVENANCE', statut), VARIANTE_PROVENANCE[statut] ?? 'gris');
const optionsProvenance = (sansInconnu = false) => PROVENANCES_SAISIE.filter((p) => !(sansInconnu && p === 'INCONNU'))
  .map((p) => [p, libelle('PROVENANCE', p)]);
const nomUnite = (u) => libelle('UNITE', u);
const optionsEtatPoids = () => Object.keys(ETAT_POIDS).map((x) => [x, libelle('ETAT_POIDS', x)]);

const ORIGINE_PORTION = {
  plat: 'corrigée pour ce plat', reference: 'référence de ce nom', standard: 'standard maison',
  standard_base: 'standard de base (modifiable dans Réglages, votre valeur passe devant)',
  // Anciennes origines, encore possibles dans un instantané enregistré avant le 2026-10-04.
  base: 'standard de base (base métier)', repere_valide: 'standard de base (repère validé)',
};
/** « poids sec » ; une préparation maison se compte en quantité finie par portion. */
const libelleEtat = (d, c) => (c.type === 'preparation_maison' ? 'quantité finie' : `poids ${libelle('ETAT_POIDS', d.etat)}`);
/** « 110 g, poids sec, standard maison » : la portion utilisée, l'état de son poids, d'où elle vient. */
const textePortion = (d, c) => `${formaterNombre(d.valeur)} ${nomUnite(d.unite)}, ${libelleEtat(d, c)}, ${ORIGINE_PORTION[d.origine] ?? 'origine non précisée'}`;

// ------------------------------------------------------------------ mélange en parts

const LIGNES_MELANGE = 4;

/** Compositeur : jusqu'à quatre composants avec leurs parts. Crée une recette maison non validée (voir composerMelange). */
function dialogMelange(c) {
  const defs = [];
  for (let i = 1; i <= LIGNES_MELANGE; i += 1) {
    defs.push({ cle: `nom${i}`, type: 'texte', libelle: `Composant ${i}`, valeur: null, placeholder: i <= 2 ? 'obligatoire' : 'facultatif' });
    defs.push({ cle: `parts${i}`, type: 'nombre', libelle: `Parts du composant ${i}`, valeur: null });
  }
  const f = champs(defs);
  panneau({
    titre: `Composer un mélange : ${c.nom}`,
    corps: [h('p', { classe: 'aide' }, 'Exemple : 2 parts de carottes, 1 part de courgettes. L\'application calcule les proportions de la quantité finie. '
      + 'La recette créée n\'est pas validée : vous la validez dans Réglages. La perte de parage de chaque légume n\'est pas appliquée.'),
    ...f.noeuds],
    libelleEnregistrer: 'Créer la recette',
    surEnregistrer: () => {
      const lignes = [];
      for (let i = 1; i <= LIGNES_MELANGE; i += 1) {
        const nom = String(f.valeur(`nom${i}`) ?? '').trim();
        const parts = f.valeur(`parts${i}`);
        if (nom === '' && parts === null) continue;
        lignes.push({ nom, parts: parts ?? 0 });
      }
      agirStrict((x, t) => composerMelange(x, c.id, lignes, t));
    },
  });
}

// ------------------------------------------------------------------ choisir la sauce

// Sauces habituelles selon la nature du plat (clés du vocabulaire existant `SAUCES`) : proposées d'abord, les autres sont
// repliées sous « Autres sauces ». Un classement d'affichage, jamais une décision : rien n'est présélectionné.
const SAUCES_PATES = ['tomate', 'arrabbiata', 'pesto', 'champignons', 'gorgonzola', 'creme', 'carbonara', 'amatriciana', 'bolognaise', 'creme_fumet', 'fruits_de_mer_tomate'];
const SAUCES_RISOTTO = ['safran', 'champignons', 'gorgonzola', 'bisque', 'creme_fumet', 'pesto'];

/** Le plat décrit-il un risotto ? (nom d'origine « base de risotto à confirmer » ou intitulé du menu) sinon des pâtes. */
const estRisotto = (c, intitule) => /risotto/.test(normaliser(`${c.nom} ${typeof c.implicite === 'string' ? c.implicite : ''} ${intitule}`));

/** { habituelles, autres } : les sauces du vocabulaire qui vont avec ce plat, puis toutes les autres, chacune une seule fois. */
export function saucesPourPlat(c, intitule = '') {
  const cles = estRisotto(c, intitule) ? SAUCES_RISOTTO : SAUCES_PATES;
  const habituelles = cles.map((cle) => SAUCES.find((x) => x.cle === cle)).filter(Boolean);
  return { habituelles, autres: SAUCES.filter((x) => !habituelles.includes(x)) };
}

let compteurSauces = 0;

/**
 * Sauce implicite « à confirmer » : le titre dit le plat, le jour et le menu ; le chef choisit d'abord parmi les sauces qui
 * vont avec le plat, puis éventuellement parmi « Autres sauces » (repliées), ou tape la sienne. Aucune sauce n'est
 * présélectionnée (la crème n'est jamais le défaut). Valider renomme le composant ; la saisie libre prime sur la liste.
 */
export function dialogChoisirSauce(c) {
  const intitule = String(etatCourant().jours?.[c.date]?.menus?.[c.menu]?.intitule ?? '').trim();
  const { habituelles, autres } = saucesPourPlat(c, intitule);
  compteurSauces += 1;
  const groupe = `choix-sauce-${compteurSauces}`;
  const radios = [];
  const ligne = (sauce, i) => {
    const r = h('input', { id: `${groupe}-${i}`, type: 'radio', name: groupe });
    r.checked = false;
    radios.push([r, sauce.nom]);
    return h('label', { classe: 'case', pour: `${groupe}-${i}` }, r, h('span', null, sauce.nom));
  };
  const f = champs([{ cle: 'libre', type: 'texte', libelle: 'Ou tapez la sauce', valeur: '', placeholder: 'nom de la sauce' }]);
  const titreDuPlat = [intitule || c.nom, c.date ? libelleJour(c.date) : null, c.menu ? `menu ${c.menu}` : null].filter(Boolean).join(', ');
  panneau({
    titre: `Choisir la sauce : ${titreDuPlat}`,
    corps: [
      h('p', { classe: 'aide' }, 'Rien n\'est choisi à votre place : cochez une sauce ou tapez la vôtre.'),
      h('fieldset', { classe: 'champ' }, h('legend', null, 'Sauces qui vont avec ce plat'), habituelles.map((x, i) => ligne(x, i))),
      repliable('Autres sauces', false, h('fieldset', { classe: 'champ' }, h('legend', { classe: 'sr' }, 'Autres sauces'),
        autres.map((x, i) => ligne(x, habituelles.length + i)))),
      ...f.noeuds],
    libelleEnregistrer: 'Valider la sauce',
    surEnregistrer: () => {
      const libre = String(f.valeur('libre') ?? '').trim();
      const nom = libre !== '' ? libre : (radios.find(([r]) => r.checked)?.[1] ?? null);
      if (!nom) throw new Error('Choisissez une sauce dans la liste ou tapez son nom.');
      agirStrict((x, t) => modifierComposant(x, c.id, { nom }, t));
    },
  });
}

// ------------------------------------------------------------------ modifier

export function dialogModifier(c) {
  const e = etatCourant();
  const f = champs([
    { cle: 'nom', type: 'texte', libelle: 'Nom', valeur: c.nom, placeholder: 'nom du composant' },
    { cle: 'produitNom', type: 'texte', libelle: 'Nom du produit acheté', valeur: c.produitNom, placeholder: 'nom du produit tel que commandé',
      aide: 'Sert à regrouper les besoins dans « Produits » (produit simple).' },
    { cle: 'categorie', type: 'choix', libelle: 'Catégorie', valeur: c.categorie, options: Object.keys(CATEGORIE).map((x) => [x, libelle('CATEGORIE', x)]) },
    { cle: 'attribue', type: 'case', libelle: 'Attribué au poste', valeur: c.attribue },
    { cle: 'type', type: 'choix', libelle: 'Type', valeur: c.type, options: Object.keys(TYPE_COMPOSANT).map((x) => [x, libelle('TYPE_COMPOSANT', x)]),
      aide: 'Produit simple : quantité de produit brut. Préparation maison : quantité finie à produire. Générique : portions, composition à définir.' },
    { cle: 'role', type: 'choix', libelle: 'Rôle dans le plat', valeur: c.role, options: [[null, 'non précisé'], ...Object.keys(ROLE).map((x) => [x, libelle('ROLE', x)])] },
    { cle: 'charge', type: 'choix', libelle: 'Charge de travail', valeur: c.charge,
      options: [[null, 'non estimée'], ...Object.keys(CHARGE).map((x) => [x, libelle('CHARGE', x)])],
      aide: 'Courte, moyenne ou longue : une échelle de charge, pas une durée mesurée.' },
    { cle: 'gramValeur', type: 'nombre', libelle: 'Grammage par portion', valeur: c.grammage.valeur,
      aide: 'Portion de ce plat seulement. Vide : l\'application prend la référence de ce nom, le standard maison ou le standard de base.' },
    { cle: 'gramUnite', type: 'choix', libelle: 'Unité du grammage', valeur: c.grammage.unite, options: Object.keys(UNITE).map((x) => [x, nomUnite(x)]) },
    { cle: 'gramEtat', type: 'choix', libelle: 'État du poids du grammage', valeur: c.grammage.etat ?? 'cuit', options: optionsEtatPoids(),
      aide: 'Sec : produit sec, avant cuisson. Cru net : cru et déjà paré. Cuit : poids servi.' },
    { cle: 'gramStatut', type: 'choix', libelle: 'Provenance du grammage', valeur: c.grammage.statut, options: optionsProvenance() },
    { cle: 'gramSource', type: 'texte', libelle: 'Source du grammage', valeur: c.grammage.source, placeholder: 'd\'où vient ce grammage' },
    { cle: 'recetteId', type: 'choix', libelle: 'Recette liée', valeur: c.recetteId,
      options: [[null, 'aucune'], ...Object.values(e.recettes).map((r) => [r.id, `${r.nom} (version ${r.version}${r.valide ? '' : ', non validée'})`])] },
  ]);
  panneau({
    titre: `Modifier ${c.nom}`,
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      if (v.gramValeur !== null && v.gramStatut === 'INCONNU') throw new Error('Précisez la provenance du grammage : elle est obligatoire dès qu\'une valeur est saisie.');
      const maj = {
        nom: v.nom, produitNom: v.produitNom, categorie: v.categorie, attribue: v.attribue, type: v.type, role: v.role, charge: v.charge,
        grammage: { valeur: v.gramValeur, unite: v.gramUnite, etat: v.gramEtat, statut: v.gramValeur === null ? 'INCONNU' : v.gramStatut, source: v.gramSource },
      };
      if (v.recetteId !== c.recetteId) maj.recetteId = v.recetteId;
      agirStrict((x, t) => modifierComposant(x, c.id, maj, t));
    },
  });
}

// ------------------------------------------------------------------ portion de ce plat

/** Correction faite sur ce plat seulement : jamais le standard maison, jamais les autres plats. */
function dialogPortionPlat(c, d) {
  const preparation = c.type === 'preparation_maison';
  // L'état proposé est celui de la portion utilisée ; sans portion, aucun choix (obligatoire). Une préparation est toujours « cuit ».
  const etatPropose = preparation ? 'cuit' : (d?.etat ?? null);
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Valeur de la portion', valeur: d?.origine === 'plat' ? d.valeur : null,
      aide: 'Un nombre ; la virgule est acceptée.' },
    { cle: 'unite', type: 'choix', libelle: 'Unité', valeur: d?.unite ?? c.grammage.unite, options: Object.keys(UNITE).map((x) => [x, nomUnite(x)]) },
    { cle: 'etat', type: 'choix', libelle: 'État du poids', valeur: etatPropose, cache: preparation,
      options: [...(etatPropose ? [] : [[null, 'choisir…']]), ...optionsEtatPoids()],
      aide: 'Sec : produit sec, avant cuisson. Cru net : cru et déjà paré. Cuit : poids servi.' },
  ]);
  panneau({
    titre: `Portion de ce plat : ${c.nom}`,
    corps: [h('p', { classe: 'aide' }, 'Cette correction ne vaut que pour ce plat : le standard maison n\'est pas modifié.'), ...f.noeuds],
    surEnregistrer: () => {
      const v = f.lire();
      if (v.valeur === null) throw new Error('Saisissez la valeur de la portion.');
      if (v.etat === null) throw new Error('Choisissez l\'état du poids : sec, cru net ou cuit.');
      agirStrict((x, t) => modifierComposant(x, c.id, {
        grammage: { valeur: v.valeur, unite: v.unite, etat: v.etat, statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' },
      }, t));
    },
  });
}

// ------------------------------------------------------------------ étapes

const MAX_RESULTATS = 40;

function dialogEtape(c) {
  const dejaLa = new Set(c.etapes.map((x) => x.etape));
  const disponibles = Object.keys(ETAPE).filter((x) => !dejaLa.has(x));
  if (disponibles.length === 0) {
    afficherMessage('Les trois étapes sont déjà présentes : retirez-en une pour la remplacer.', 'alerte');
    return;
  }
  const f = champs([
    { cle: 'etape', type: 'choix', libelle: 'Étape', valeur: disponibles[0], options: disponibles.map((x) => [x, libelle('ETAPE', x)]) },
    { cle: 'mode', type: 'choix', libelle: 'Saisie', valeur: 'perte', options: [['perte', 'perte en %'], ['gain', 'gain ×']], cache: true,
      aide: 'Le gain (absorption) ne concerne que la cuisson.' },
    { cle: 'valeur', type: 'nombre', libelle: 'Perte en %', valeur: null,
      aide: 'Coefficient = 1 − perte / 100. Une perte ne se compte qu\'une fois par étape.' },
    { cle: 'statut', type: 'choix', libelle: 'Provenance (obligatoire)', valeur: '', options: [['', 'choisir…'], ...optionsProvenance(true)] },
    { cle: 'source', type: 'texte', libelle: 'Source', valeur: '', placeholder: 'd\'où vient cette valeur' },
  ]);
  const base = champs([{ cle: 'terme', type: 'texte', libelle: 'Chercher dans la base métier', valeur: c.produitNom || c.nom,
    aide: 'Estimations générales, jamais appliquées sans votre geste : toucher une ligne remplit le champ avec le milieu de la fourchette.' }]);
  const resultats = h('div', { classe: 'resultats-base', 'aria-live': 'polite' });
  const noteRemplissage = h('p', { classe: 'aide', 'aria-live': 'polite' });

  const majSaisie = () => {
    const cuisson = f.valeur('etape') === 'cuisson';
    f.montrer('mode', cuisson);
    const mode = cuisson ? f.valeur('mode') : 'perte';
    f.changerLibelle('valeur', mode === 'gain' ? 'Gain ×' : 'Perte en %');
  };
  f.surChangement('etape', () => { majSaisie(); resultats.replaceChildren(); });
  f.surChangement('mode', majSaisie);

  const chercher = () => {
    const lignes = chercherBase(base.valeur('terme'), f.valeur('etape'));
    if (lignes.length === 0) {
      resultats.replaceChildren(h('p', { classe: 'vide' }, 'Aucune ligne trouvée pour cette étape : saisissez la valeur vous-même.'));
      return;
    }
    resultats.replaceChildren(
      h('p', { classe: 'aide' }, `${pluriel(lignes.length, 'ligne trouvée', 'lignes trouvées')}${lignes.length > MAX_RESULTATS ? ` (les ${MAX_RESULTATS} premières : affinez la recherche)` : ''}.`),
      ...lignes.slice(0, MAX_RESULTATS).map((l) => h('button', {
        type: 'button', classe: 'ligne-base',
        onClick: () => {
          const { mode, valeur } = modeDepuisCoefficient(milieu(l.coefMin, l.coefMax));
          f.fixer('mode', mode);
          majSaisie();
          f.fixer('valeur', valeur);
          f.fixer('statut', 'STANDARD_BASE');
          f.fixer('source', `base métier v${VERSION_BASE} : ${l.produit} (${l.texte}), milieu de la fourchette`);
          noteRemplissage.textContent = `Champ rempli avec le milieu de la fourchette (${l.texte}) : standard de base, à remplacer par une pesée si votre cuisine diffère. Rien n'est enregistré avant « Enregistrer ».`;
        },
      }, h('strong', null, l.produit), h('span', null, ` ${l.categorie} · fourchette ${l.texte}`), l.note ? h('span', { classe: 'meta' }, ` · ${l.note}`) : null)));
  };

  panneau({
    titre: 'Ajouter une étape',
    corps: [...f.noeuds, h('div', { classe: 'recherche-base' }, ...base.noeuds, bouton('Chercher dans la base métier', chercher, 'court'), noteRemplissage, resultats)],
    surEnregistrer: () => {
      const v = f.lire();
      if (v.valeur === null) throw new Error('Saisissez la valeur de l\'étape.');
      if (!v.statut) throw new Error('Choisissez la provenance : elle est obligatoire.');
      const mode = v.etape === 'cuisson' ? v.mode : 'perte';
      const etape = { etape: v.etape, coefficient: coefficientDepuis(mode, v.valeur), statut: v.statut, source: v.source };
      agirStrict((x, t) => modifierComposant(x, c.id, { etapes: [...x.composants[c.id].etapes, etape] }, t));
    },
  });
}

function dialogPesee(c) {
  const f = champs([
    { cle: 'etape', type: 'choix', libelle: 'Étape pesée', valeur: c.etapes[0]?.etape ?? 'parage', options: Object.keys(ETAPE).map((x) => [x, libelle('ETAPE', x)]) },
    { cle: 'avant', type: 'nombre', libelle: 'Poids avant', valeur: null },
    { cle: 'apres', type: 'nombre', libelle: 'Poids après', valeur: null,
      aide: 'Même unité pour les deux poids. Le coefficient (après ÷ avant) remplace le standard de base de cette étape par une mesure maison.' },
  ]);
  panneau({
    titre: 'Enregistrer une pesée',
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      if (v.avant === null || v.apres === null) throw new Error('Saisissez les deux poids, avant et après.');
      agirStrict((x, t) => enregistrerPesee(x, c.id, v.etape, v.avant, v.apres, t));
    },
  });
}

// ------------------------------------------------------------------ allergènes, après service

const TEXTE_OBSTACLE_ALLERGENES = {
  'composition à définir': 'Composition à définir : tant que ce composant n\'est ni un produit simple ni une préparation maison, sa liste d\'allergènes ne peut pas être validée.',
  'recette restaurant non validée': 'Recette restaurant non validée : la liste d\'une préparation maison ne compte qu\'avec sa recette validée.',
};

/** Phrase qui dit pourquoi valider la liste ne suffit pas (`obstacle` de `obstacleValidationAllergenes`), ou null. */
export const texteObstacleAllergenes = (obstacle) => (obstacle ? TEXTE_OBSTACLE_ALLERGENES[obstacle] ?? `${obstacle}.` : null);

export function dialogAllergenes(c) {
  const obstacle = obstacleValidationAllergenes(etatCourant(), c);
  const f = champs([
    { cle: 'liste', type: 'cases', libelle: 'Allergènes présents', valeur: c.allergenes.liste, options: ALLERGENES },
    { cle: 'valider', type: 'case', libelle: 'Je valide cette liste', valeur: c.allergenes.statut === 'valide' },
  ]);
  panneau({
    titre: `Allergènes : ${c.nom}`,
    corps: [h('p', { classe: 'aide' }, 'Tant que la liste n\'est pas validée, le statut reste « à confirmer ». Une liste validée ne vaut que si la recette et les ingrédients réellement utilisés sont validés.'),
      obstacle ? h('p', { classe: 'aide', role: 'note' }, `Ici, valider ne suffit pas. ${texteObstacleAllergenes(obstacle)}`) : null,
      ...f.noeuds],
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((x, t) => modifierComposant(x, c.id, { allergenes: { statut: v.valider ? 'valide' : 'a_confirmer', liste: v.liste } }, t));
      const reste = obstacleValidationAllergenes(etatCourant(), etatCourant().composants[c.id]);
      if (v.valider && reste) afficherMessage(`Liste enregistrée, mais elle reste « à confirmer ». ${texteObstacleAllergenes(reste)}`, 'info');
    },
  });
}

function dialogApresService(c, unite) {
  const f = champs([
    { cle: 'surplus', type: 'nombre', libelle: `Surplus utilisable${unite ? ` (${nomUnite(unite)})` : ''}`, valeur: c.apresService.surplus },
    { cle: 'rebut', type: 'nombre', libelle: `Rebut${unite ? ` (${nomUnite(unite)})` : ''}`, valeur: c.apresService.rebut,
      aide: 'Le rebut n\'est pas une perte normale de parage ou de cuisson : il ne modifie aucun coefficient.' },
    { cle: 'note', type: 'zone', libelle: 'Note', valeur: c.apresService.note, placeholder: 'note facultative' },
  ]);
  panneau({
    titre: `Après service : ${c.nom}`,
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((x, t) => saisirApresService(x, c.id, f.lire(), t)); },
  });
}

// ------------------------------------------------------------------ sections

/**
 * La portion utilisée (dépendance « grammage » du calcul), son état de poids et son origine ; deux gestes pour la
 * corriger sur ce plat ou régler le standard maison. Pas de portion par produit pour un composant générique.
 */
function blocPortion(c, calc) {
  if (c.type === 'generique') return null;
  const d = calc.dependances.find((x) => x.parametre === 'grammage');
  // Une portion qui vient d'un standard de base est utilisée telle quelle ; la fiche de validation permet de l'ajuster.
  const cleStandard = cleStandardDe(c);
  const validable = cleStandard && d?.origine === 'standard_base';
  const gestes = h('div', { classe: 'actions' },
    validable ? bouton('Valider la portion', () => {
      const v = valeurPour(etatCourant(), cleStandard, c.role, aujourdhui(), { composantId: c.id });
      if (v) ouvrirValidation(v);
    }, 'court principal') : null,
    bouton('Corriger pour ce plat seulement', () => dialogPortionPlat(c, d), 'court'),
    lien('#/reglages/standards', 'Régler le standard maison', 'btn btn-court'),
    d?.origine === 'plat' ? bouton('Revenir au standard', () => agir((e, t) => modifierComposant(e, c.id,
      { grammage: { valeur: null, statut: 'INCONNU', source: '' } }, t)), 'court') : null);
  if (!d) {
    return h('div', { classe: 'encadre encadre-alerte portion' },
      h('p', null, h('strong', null, 'Portion : absente')),
      h('p', { classe: 'petit' }, 'Ni correction sur ce plat, ni référence de ce nom, ni standard maison, ni standard de base : la quantité ne peut pas être calculée.'),
      gestes);
  }
  return h('div', { classe: 'encadre portion' }, h('p', null, h('strong', null, `Portion : ${textePortion(d, c)}`)), gestes);
}

function sectionEntete(etat, c, calc) {
  const p = calc.portions;
  return h('section', { classe: 'carte' },
    h('h1', { classe: 'page-titre' }, c.nom),
    h('p', { classe: 'meta' }, `Menu ${c.menu} · service de destination : ${libelleJour(c.date)}`),
    h('p', null, pastille(c.attribue ? 'attribué au poste' : 'non attribué', c.attribue ? 'gris' : 'ambre'), ' ',
      pastille(libelle('TYPE_COMPOSANT', c.type), 'gris')),
    calc.statut === 'CALCULE'
      ? h('p', { classe: 'quantite-grande' }, quantiteNoeuds(calc.quantiteTravail, calc.uniteTravail), h('small', null, ` ${calc.libelleQuantite}`))
      : h('p', { classe: 'quantite-grande discret' }, 'quantité inconnue', h('small', null, ` ${calc.libelleQuantite}`)),
    blocPortion(c, calc),
    h('p', null,
      calc.statut === 'CALCULE' ? pastille(libelle('PROVENANCE', 'CALCULE'), 'vert') : pastille(libelle('PROVENANCE', 'INCONNU'), 'gris'), ' ',
      calc.aValider ? pastille(LIBELLE_ESTIMATION_A_VALIDER, 'ambre') : null, ' ',
      calc.aMesurer ? pastille('à mesurer', 'ambre') : null),
    h('p', { classe: 'meta' }, `Portions : ${pluriel(p.total, 'portion')} (hors groupes ${p.prevision}${p.previsionManquante ? ', non saisie' : ''} ; groupes confirmés ${p.groupesConfirmes} ; groupes provisoires ${p.groupesProvisoires})`),
    blocGestes(c));
}

/** Gestes de l'en-tête : modifier, choisir la sauce, composer un mélange, supprimer (partagés avec la fiche technique). */
export function blocGestes(c) {
  return h('div', { classe: 'actions' },
    bouton('Modifier', () => dialogModifier(c), 'court'),
    estSauceAConfirmer(c) ? bouton('Choisir la sauce', () => dialogChoisirSauce(c), 'court') : null,
    c.recetteId ? null : bouton('Composer un mélange', () => dialogMelange(c), 'court'),
    bouton('Supprimer', () => confirmer({
      titre: 'Supprimer ce composant ?', texte: `${c.nom} et ses tâches non faites seront supprimés.`, libelleOk: 'Supprimer', danger: true,
      action: () => { agirStrict((e, t) => supprimerComposant(e, c.id, t)); location.hash = `#/semaine/${c.date}`; },
    }), 'court danger'));
}

/** Gestes avancés de la fiche technique (repli « Plus de réglages ») : tout ce que vue-composant offrait, sans l'en-tête. */
export function sectionsReglages(etat, c, calc) {
  return [blocPortion(c, calc), blocGestes(c), sectionCalcul(c, calc), sectionEtapes(c, calc), sectionProductions(etat, c),
    sectionMemoire(etat, c), sectionAllergenes(etat, c), sectionApresService(c, calc)].filter(Boolean);
}

function sectionCalcul(c, calc) {
  const detail = (d) => {
    if (d.parametre === 'grammage') return `${formaterNombre(d.valeur)} ${nomUnite(d.unite ?? c.grammage.unite)} par portion`;
    if (d.parametre === 'recette') return `version ${d.valeur}`;
    return libelleCoefficient(d.valeur);
  };
  const source = (d) => (d.parametre === 'grammage' ? `${libelleEtat(d, c)}, ${ORIGINE_PORTION[d.origine] ?? 'origine non précisée'}`
    : c.etapes.find((x) => x.etape === d.parametre)?.source ?? '');
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Calcul'),
    h('p', { classe: 'formule' }, calc.formule),
    h('h3', { classe: 'bloc-titre' }, 'Paramètres utilisés et provenance'),
    calc.dependances.length === 0 ? ligneVide('Aucun paramètre renseigné.')
      : h('ul', { classe: 'liste-simple' }, calc.dependances.map((d) => h('li', null,
        h('strong', null, d.parametre === 'recette' ? 'recette' : d.parametre === 'grammage' ? 'grammage' : libelle('ETAPE', d.parametre)), ` : ${detail(d)} `,
        pastilleProvenance(d.statut), source(d) ? h('span', { classe: 'meta' }, ` · ${source(d)}`) : null))),
    h('h3', { classe: 'bloc-titre' }, 'Ce qui manque'),
    calc.manquants.length === 0 ? ligneVide('Rien ne manque pour ce calcul.')
      : h('ul', { classe: 'liste-simple' }, calc.manquants.map((m) => h('li', null, m))));
}

function sectionEtapes(c, calc) {
  const appliquee = (etape) => calc.etapes.find((x) => x.etape === etape)?.appliquee !== false;
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Étapes de perte ou de gain'),
    h('p', { classe: 'aide' }, 'Seules les étapes applicables au type entrent dans le calcul : produit simple, portionnement, cuisson et parage ; préparation maison, portionnement.'),
    c.etapes.length === 0 ? ligneVide('Aucune étape : aucune perte ni gain n\'est appliqué.')
      : h('ul', { classe: 'liste-simple' }, c.etapes.map((x) => h('li', { classe: 'ligne-etape' },
        h('span', null, h('strong', null, libelle('ETAPE', x.etape)), ` : ${libelleCoefficient(x.coefficient)} `, pastilleProvenance(x.statut),
          x.source ? h('span', { classe: 'meta' }, ` · ${x.source}`) : null,
          appliquee(x.etape) ? null : h('span', { classe: 'etape-note' }, 'non appliquée : la portion est déjà exprimée avant cuisson')),
        bouton('Retirer', () => agir((e, t) => modifierComposant(e, c.id, { etapes: e.composants[c.id].etapes.filter((y) => y.etape !== x.etape) }, t)), 'court')))),
    Number.isFinite(calc.quantiteCuiteEstimee)
      ? h('p', { classe: 'petit' }, `soit environ ${quantite(calc.quantiteCuiteEstimee, calc.uniteTravail)} une fois cuit, à titre indicatif`) : null,
    h('div', { classe: 'actions' },
      bouton('Ajouter une étape', () => dialogEtape(c), 'court'),
      bouton('Enregistrer une pesée', () => dialogPesee(c), 'court')),
    h('p', { classe: 'aide' }, 'Une pesée (avant, après) remplace un standard de base par une mesure maison.'));
}

function sectionMemoire(etat, c) {
  const memorise = lireMemoire(etat.memoire, c.nom, c.menu) !== null;
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Référence maison'),
    memorise ? h('p', null, `Une référence maison est mémorisée pour « ${c.nom} ».`) : ligneVide('Aucune référence maison mémorisée pour ce nom.'),
    h('div', { classe: 'actions' },
      bouton('Mémoriser comme référence maison', () => agir((e, t) => memoriser(e, c.id, t)), 'court'),
      memorise ? bouton('Reprendre la référence maison', () => confirmer({
        titre: 'Reprendre la référence maison ?',
        texte: 'Attribution, catégorie, type, charge, grammage du rôle courant et étapes de la référence remplaceront ceux de ce composant.',
        libelleOk: 'Reprendre',
        action: () => {
          const r = agirStrict((e, t) => reprendreMemoire(e, c.id, t));
          afficherMessage(r.applique ? `Référence reprise : ${r.champs.join(', ')}.` : 'Aucune référence à reprendre.', r.applique ? 'ok' : 'info');
        },
      }), 'court') : null),
    h('p', { classe: 'aide' }, 'Rien n\'est repris sans ce geste.'));
}

function sectionAllergenes(etat, c) {
  const s = statutAllergenes(etat, c);
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Allergènes'),
    h('p', null, s.statut === 'valide' ? pastille('liste validée', 'vert') : pastille('allergènes à confirmer', 'ambre'),
      s.raison ? h('span', { classe: 'meta' }, ` ${s.raison}`) : null),
    s.liste.length > 0
      ? h('p', null, s.statut === 'valide' ? 'Allergènes : ' : 'Cochés, non validés : ', s.liste.map(libelleAllergene).join(', '))
      : ligneVide(s.statut === 'valide' ? 'Aucun allergène coché dans la liste validée.' : 'Aucun allergène coché.'),
    h('p', { classe: 'meta' }, texteSourceAllergenes()),
    h('div', { classe: 'actions' }, bouton('Renseigner les allergènes', () => dialogAllergenes(c), 'court')));
}

/** « ven. 2 » : jour abrégé et numéro. */
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;

/** Étapes de préparation de la règle (liste ordonnée) ; rien si le composant n'a pas d'étapes. */
function sectionEtapesPreparation(etat, c) {
  const etapes = etapesComposant(etat, c.id);
  if (etapes.length === 0) return null;
  const VARIANTE = { fait: 'vert', en_cours: 'vert', a_planifier: 'ambre', ecart: 'rouge' };
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Étapes de préparation'),
    h('ol', { classe: 'liste-simple' }, etapes.map((x) => h('li', null,
      h('strong', null, x.libelle), ' ', pastille(libelle('ETAT_TACHE', x.etat), VARIANTE[x.etat] ?? 'gris'),
      x.faitLe && x.faitLe < c.date ? h('span', { classe: 'meta' }, ` · déjà avancé ${courtJour(x.faitLe)}`)
        : (x.jourDecide && x.etat !== 'fait' ? h('span', { classe: 'meta' }, ` · prévu ${courtJour(x.jourDecide)}`) : null)))),
    h('p', { classe: 'aide' }, 'La dernière étape est la finition. L\'avance d\'une étape n\'est pas une durée de conservation de la préparation finie.'));
}

function sectionProductions(etat, c) {
  const ordre = { principale: 0, complement: 1, preparatoire: 2 };
  const lignes = Object.values(etat.productions).filter((p) => p.composantId === c.id)
    .sort((a, b) => ordre[a.genre] - ordre[b.genre]).map((p) => ligneProduction(etat, p));
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Productions du composant'),
    lignes.length === 0 ? ligneVide('Aucune production : le composant doit être attribué au poste.') : lignes.map((l) => carteTache(etat, l)),
    h('div', { classe: 'actions' }, bouton('Noter une action préparatoire', () => dialogPreparatoire(c.id), 'court')));
}

function sectionIngredients(etat, c, calc) {
  if (c.type !== 'preparation_maison') return null;
  const recette = c.recetteId ? etat.recettes[c.recetteId] : null;
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Ingrédients calculés'),
    calc.ingredients
      ? h('ul', { classe: 'liste-simple' }, calc.ingredients.map((i) => h('li', null, `${i.nom} : ${quantite(i.quantite, i.unite)}`)))
      : ligneVide(recette ? (recette.valide ? 'Recette validée, mais rendement ou quantités inutilisables : voir « Ce qui manque ».' : 'Recette liée non validée : ingrédients non calculés.')
        : 'Aucune recette liée : ingrédients non calculés.'),
    recette ? h('p', { classe: 'meta' }, `Recette : ${recette.nom}, version ${recette.version}${recette.valide ? ', validée' : ', non validée'}`) : null);
}

function sectionApresService(c, calc) {
  const a = c.apresService;
  const u = calc.uniteTravail;
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Après service (facultatif)'),
    h('p', null, `Surplus utilisable : ${a.surplus === null ? 'non saisi' : quantite(a.surplus, u)}`),
    h('p', null, `Rebut : ${a.rebut === null ? 'non saisi' : quantite(a.rebut, u)}`),
    a.note ? h('p', null, `Note : ${a.note}`) : null,
    h('div', { classe: 'actions' }, bouton('Saisir après service', () => dialogApresService(c, u), 'court')),
    h('p', { classe: 'aide' }, 'Le rebut n\'est pas une perte normale de parage ou de cuisson.'));
}

export function rendre(etat, id) {
  const c = etat.composants[id];
  const racine = h('div', { classe: 'vue vue-composant' });
  if (!c) {
    racine.appendChild(h('h1', { classe: 'page-titre' }, 'Composant introuvable'));
    racine.appendChild(h('p', null, 'Ce composant n\'existe plus.'));
    racine.appendChild(h('p', null, lien('#/production', 'Retour à la feuille du jour')));
    return racine;
  }
  const calc = calculerComposant(etat, id);
  racine.appendChild(h('p', null, lien(`#/semaine/${c.date}`, '‹ Détail du jour'), ' · ', lien(`#/production/${c.date}`, 'Feuille du jour')));
  for (const s of [sectionEntete(etat, c, calc), sectionCalcul(c, calc), sectionEtapes(c, calc), sectionEtapesPreparation(etat, c), sectionProductions(etat, c),
    sectionIngredients(etat, c, calc), sectionMemoire(etat, c), sectionAllergenes(etat, c), sectionApresService(c, calc), blocReperes(c.famille, etat)]) {
    if (s) racine.appendChild(s);
  }
  return racine;
}

