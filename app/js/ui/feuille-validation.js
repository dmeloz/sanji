// Feuille de validation d'une portion : une valeur à la fois. Montre la fourchette proposée (jamais une moyenne
// seule), l'état du poids, les sources et l'effet calculé ; la propriétaire tape la valeur, puis choisit un geste :
// valider comme standard maison, corriger, « seulement cette fois » ou « plus tard ». Aucune logique métier ici.

import { accepterApprentissage, ecarterApprentissage } from '../domaine/actions-apprentissage.js';
import { libelleJour } from '../domaine/dates.js';
import { corrigerStandard, correctionDuJour, reporterValidation, validerStandard } from '../domaine/actions-validation.js';
import { libelle } from '../domaine/statuts.js';
import { agirStrict } from '../magasin.js';
import { champs } from './champs.js';
import { h, svg } from './dom.js';
import { bouton } from './elements.js';
import { formaterNombre, pluriel, quantite } from './format.js';
import { panneau } from './panneau.js';

const ROLE_EN_CLAIR = { plat_principal: 'en plat principal', garniture: 'en garniture' };

/** « 50–70 g » (un seul nombre quand min = max). */
export function texteFourchette(p) {
  const portion = p.min === p.max ? formaterNombre(p.min) : `${formaterNombre(p.min)}–${formaterNombre(p.max)}`;
  return `${portion} ${libelle('UNITE', p.unite)}`;
}

/** Icône 18 px, décorative (le mot ou le nom accessible dit la même chose). */
const icone = (chemin, taille = 18) => svg('svg', { viewBox: '0 0 24 24', width: taille, height: taille, fill: 'none', stroke: 'currentColor',
  'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [svg('path', { d: chemin })]);

/**
 * Rend la feuille fermable à tout moment : bouton × (nom accessible « Fermer », 44 px) dans l'en-tête, avec le compteur
 * « 2 / 3 » s'il y en a un, et toucher du fond (un clic dont la cible est le <dialog> lui-même, pas son contenu).
 * `panneau()` ne ferme que sur « Annuler » : sur tablette, sans Échap, rien d'autre ne fermait la feuille.
 */
function rendreFermable(dialogue, position = null) {
  dialogue.addEventListener('click', (evenement) => { if (evenement.target === dialogue) dialogue.close(); });
  const formulaire = dialogue.children[0];
  const titre = formulaire.querySelector('h2');
  const fermer = h('button', { type: 'button', classe: 'vp-fermer', 'aria-label': 'Fermer', onClick: () => dialogue.close() }, icone('M6 6l12 12M18 6L6 18'));
  const entete = h('div', { classe: 'vp-entete' }, titre,
    position ? h('span', { classe: 'vp-position' }, `${position.i + 1} / ${position.total}`) : null, fermer);
  const reste = Array.from(formulaire.children).filter((x) => x !== titre);
  formulaire.replaceChildren(entete, ...(position ? [segments(position)] : []), ...reste);
}

/** Barre de progression décorative : le compteur « n / total » dit la même chose en texte. */
const segments = ({ i, total }) => h('div', { classe: 'vp-segments', 'aria-hidden': 'true' },
  Array.from({ length: total }, (_, k) => h('span', { classe: k <= i ? 'vp-seg vp-seg-fait' : 'vp-seg' })));

const texteEtat = (p) => `poids ${libelle('ETAT_POIDS', p.etat)}`;

/** Ligne d'effet : « 40 portions : 2 000–2 800 g selon la valeur retenue ». */
function texteEffet(valeur) {
  const { effet, proposition: p } = valeur;
  if (effet.portions === 0) return "Aucun plat concerné dans les prochains jours : la valeur servira dès qu'un plat de cette famille sera au poste.";
  const bornes = effet.quantiteMin === effet.quantiteMax ? quantite(effet.quantiteMin, effet.unite)
    : `${quantite(effet.quantiteMin, effet.unite)} à ${quantite(effet.quantiteMax, effet.unite)}`;
  return `${pluriel(effet.portions, 'portion')} : ${bornes} selon la valeur retenue (${texteEtat(p)}).`;
}

/**
 * Ouvre la feuille pour une valeur issue de `valeursAValider` ou `valeurPour`.
 * @param {object} valeur {cle, famille, libelle, role, proposition, sources, effet, composantIds, standard}
 * @param {{position?:{i:number,total:number}, suite?:(resultat:'valide'|'cette_fois'|'plus_tard')=>void}} [parcours]
 *   dans un parcours : `suite` est appelée quand un geste a abouti (pas quand la feuille est fermée par ×, le fond ou Annuler).
 */
export function ouvrirValidation(valeur, { position = null, suite = null } = {}) {
  let resultat = null;
  const p = valeur.proposition;
  const existant = valeur.standard ?? null;
  // Préremplie seulement par une valeur proposée ou déjà validée ; jamais par le milieu d'une fourchette d'estimation.
  const valeurDepart = valeur.valeurProposee ?? existant?.valeur ?? null;
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Valeur de la portion', valeur: valeurDepart,
      aide: valeurDepart === null
        ? `Tapez la valeur que vous servez (${libelle('UNITE', p.unite)}, ${texteEtat(p)}). Elle n'est jamais remplie à votre place.`
        : `Valeur proposée (${libelle('UNITE', p.unite)}, ${texteEtat(p)}) : changez-la si ce n'est pas celle que vous servez.` },
    { cle: 'hors', type: 'case', libelle: 'Cette valeur est hors de la fourchette : je la confirme', valeur: false, cache: true },
  ]);
  const effetVu = h('p', { classe: 'meta' }, texteEffet(valeur));
  const horsFourchette = (v) => v !== null && (v < p.min || v > p.max);
  const majSaisie = () => {
    let v = null;
    try { v = f.valeur('valeur'); } catch { v = null; }
    f.montrer('hors', horsFourchette(v));
    if (v !== null && v > 0 && valeur.effet.portions > 0) {
      effetVu.textContent = `Avec ${formaterNombre(v)} ${libelle('UNITE', p.unite)} : ${pluriel(valeur.effet.portions, 'portion')} = ${quantite(valeur.effet.portions * v, p.unite)}.`;
    } else effetVu.textContent = texteEffet(valeur);
  };
  /** Erreur annoncée dès la saisie invalide (role=alert du panneau) ; effacée dès qu'elle est corrigée ou vide. */
  const signalerErreur = (api) => {
    let message = '';
    try {
      const v = f.valeur('valeur');
      if (v !== null && v <= 0) message = 'La valeur de la portion doit être supérieure à 0.';
    } catch (e) { message = e?.message ?? String(e); }
    api.erreur(message);
  };

  const lire = () => {
    const v = f.lire();
    return { valeur: v.valeur, confirmeHorsFourchette: v.hors === true };
  };
  const essayer = (api, action) => { api.erreur(''); try { action(); } catch (e) { api.erreur(e?.message ?? String(e)); } };
  const seulementCetteFois = (api) => essayer(api, () => {
    if (valeur.composantIds.length === 0) throw new Error('Aucun plat concerné : ouvrez cette feuille depuis un plat pour une correction ponctuelle.');
    const saisie = lire();
    agirStrict((e, t) => { for (const id of valeur.composantIds) correctionDuJour(e, id, { valeur: saisie.valeur }, t); });
    resultat = 'cette_fois';
    api.fermer();
  });
  const nom = `${valeur.libelle} ${ROLE_EN_CLAIR[valeur.role] ?? ''}`.trim();
  const dialogue = panneau({
    titre: `Valider la portion : ${nom}`,
    annulerEnLien: true,
    corps: (api) => {
      majSaisie();
      f.surChangement('valeur', () => { majSaisie(); signalerErreur(api); });
      return [
      h('p', { classe: 'aide' }, 'Estimation à valider : fourchette de référence, pas encore une valeur de votre cuisine.'),
      h('p', { classe: 'quantite-grande fourchette' }, texteFourchette(p), h('small', null, ` ${texteEtat(p)}`)),
      h('p', { classe: 'meta' }, `Le calcul prend aujourd'hui le milieu de cette fourchette (${formaterNombre((p.min + p.max) / 2)} ${libelle('UNITE', p.unite)}).`),
      valeur.sources ? h('p', { classe: 'meta' }, `Sources : ${valeur.sources}`) : null,
      valeur.note ? h('p', { classe: 'meta' }, valeur.note) : null,
      existant ? h('p', { classe: 'encadre' }, `Standard maison déjà validé : ${formaterNombre(existant.valeur)} ${libelle('UNITE', existant.unite)}, poids ${libelle('ETAT_POIDS', existant.etat)}. « Corriger » le remplace.`) : null,
      effetVu,
      ...f.noeuds,
      h('div', { classe: 'actions feuille-valider-secondaires' },
        bouton('Seulement cette fois', () => seulementCetteFois(api), 'court'),
        bouton('Plus tard', () => essayer(api, () => { agirStrict((e, t) => reporterValidation(e, valeur.cle, t)); resultat = 'plus_tard'; api.fermer(); }), 'court'),
        existant ? bouton('Corriger', () => essayer(api, () => { agirStrict((e, t) => corrigerStandard(e, valeur.famille, valeur.role, lire(), t)); resultat = 'valide'; api.fermer(); }), 'court') : null),
      ];
    },
    libelleEnregistrer: 'Valider comme standard maison',
    surEnregistrer: () => { agirStrict((e, t) => validerStandard(e, valeur.famille, valeur.role, lire(), t)); resultat = 'valide'; },
  });
  rendreFermable(dialogue, position);
  if (suite) dialogue.addEventListener('close', () => { if (resultat) suite(resultat); });
}

/**
 * Parcours « Valeurs à valider » : une valeur à la fois (« 1 / 3 »), puis l'écran « terminé ». × ou toucher du fond
 * arrête le parcours à tout moment ; ce qui n'a pas été traité reste proposé.
 * @param {object[]} valeurs de `valeursAValider`
 */
export function ouvrirValidations(valeurs) {
  const total = valeurs.length;
  let reportees = 0;
  const etape = (i) => {
    if (i >= total) { ouvrirTermine(total, reportees); return; }
    ouvrirValidation(valeurs[i], { position: { i, total }, suite: (resultat) => { if (resultat === 'plus_tard') reportees += 1; etape(i + 1); } });
  };
  etape(0);
}

/** Écran de fin : état écrit (mot + coche), retour à Aujourd'hui, × et fond ferment. */
function ouvrirTermine(total, reportees) {
  const phrase = total === 0 ? 'Aucune valeur à valider.' : total === 1 ? 'La valeur est traitée.' : `Les ${total} valeurs sont traitées.`;
  const dialogue = panneau({
    titre: 'Valeurs à valider',
    lectureSeule: true,
    corps: (api) => [
      h('p', { classe: 'vp-etat' }, icone('M5 12l5 5 9-10', 16), 'terminé'),
      h('p', { classe: 'vp-phrase' }, phrase),
      reportees > 0 ? h('p', { classe: 'meta' }, 'Celles mises « plus tard » reviennent le lendemain.') : null,
      h('a', { href: '#/aujourdhui', classe: 'btn btn-decision vp-retour', onClick: () => api.fermer() }, "Revenir à Aujourd'hui"),
    ],
  });
  rendreFermable(dialogue);
}

const ORIGINE_EN_CLAIR = { standard: 'standard maison', standard_base: 'standard de base', reference: 'référence du nom', plat: 'correction du plat' };

/**
 * Feuille d'une proposition d'apprentissage (`propositionsApprentissage`) : « Vous corrigez souvent… ». La valeur proposée
 * (médiane de vos corrections) est préremplie ; la valeur actuelle et vos corrections récentes sont montrées. « En faire
 * mon standard » l'enregistre ; « Non, garder » écarte la proposition (elle se tait 30 jours). Fermer = plus tard.
 */
export function ouvrirProposition(proposition) {
  const p = proposition;
  const unite = libelle('UNITE', p.unite);
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Nouvelle valeur du standard', valeur: p.valeur,
      aide: `Valeur proposée d'après vos corrections (${unite}, poids ${libelle('ETAT_POIDS', p.etatPoids)}) ; vous pouvez la changer.` },
  ]);
  const lire = () => ({ valeur: f.lire().valeur, unite: p.unite, etat: p.etatPoids });
  const origine = p.actuelle ? (ORIGINE_EN_CLAIR[p.actuelle.origine] ?? p.actuelle.origine) : null;
  panneau({
    titre: `Votre standard : ${p.libelle} ${ROLE_EN_CLAIR[p.role] ?? ''}`.trim(),
    corps: [
      h('p', { classe: 'quantite-grande' }, `${formaterNombre(p.valeur)} ${unite}`, h('small', null, ` poids ${libelle('ETAT_POIDS', p.etatPoids)}`)),
      h('p', { classe: 'aide' }, p.actuelle
        ? `Vous avez corrigé ${pluriel(p.nombre, 'fois')} la portion dans le même sens (du ${libelleJour(p.dates[0])} au ${libelleJour(p.dates.at(-1))}).`
        : `Vous avez tapé ${pluriel(p.nombre, 'fois')} à peu près la même portion (du ${libelleJour(p.dates[0])} au ${libelleJour(p.dates.at(-1))}) : cette famille n'a encore aucun standard.`),
      p.actuelle ? h('p', { classe: 'meta' }, `Valeur actuelle : ${formaterNombre(p.actuelle.valeur)} ${libelle('UNITE', p.actuelle.unite)} (${origine}).`) : null,
      h('ul', { classe: 'meta' }, p.historique.map((x) => h('li', null, `${libelleJour(x.date)} : ${x.nom}, ${formaterNombre(x.valeur)} ${unite}`))),
      ...f.noeuds,
    ],
    libelleEnregistrer: p.actuelle ? 'En faire mon standard' : 'En faire ma première valeur',
    surEnregistrer: () => { agirStrict((e, t) => accepterApprentissage(e, p.cleFamille, p.role, lire(), t)); },
    extras: [
      { libelle: 'Non, garder', action: (api) => { agirStrict((e, t) => ecarterApprentissage(e, p.cleFamille, p.role, t)); api.fermer(); } },
    ],
  });
}
