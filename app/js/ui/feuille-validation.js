// Feuille de validation d'une portion : une valeur à la fois. Montre la fourchette proposée (jamais une moyenne
// seule), l'état du poids, les sources et l'effet calculé ; la propriétaire tape la valeur, puis choisit un geste :
// valider comme standard maison, corriger, « seulement cette fois » ou « plus tard ». Aucune logique métier ici.

import { accepterApprentissage, ecarterApprentissage } from '../domaine/actions-apprentissage.js';
import { libelleJour } from '../domaine/dates.js';
import { corrigerStandard, correctionDuJour, reporterValidation, validerStandard } from '../domaine/actions-validation.js';
import { libelle } from '../domaine/statuts.js';
import { agirStrict } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { formaterNombre, pluriel, quantite } from './format.js';
import { panneau } from './panneau.js';

const ROLE_EN_CLAIR = { plat_principal: 'en plat principal', garniture: 'en garniture' };

/** « 50–70 g » (un seul nombre quand min = max). */
export function texteFourchette(p) {
  const portion = p.min === p.max ? formaterNombre(p.min) : `${formaterNombre(p.min)}–${formaterNombre(p.max)}`;
  return `${portion} ${libelle('UNITE', p.unite)}`;
}

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
 */
export function ouvrirValidation(valeur) {
  const p = valeur.proposition;
  const existant = valeur.standard ?? null;
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Valeur de la portion', valeur: null,
      aide: `Tapez la valeur que vous servez (${libelle('UNITE', p.unite)}, ${texteEtat(p)}). Elle n'est jamais remplie à votre place.` },
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
  f.surChangement('valeur', majSaisie);

  const lire = () => {
    const v = f.lire();
    return { valeur: v.valeur, confirmeHorsFourchette: v.hors === true };
  };
  const nom = `${valeur.libelle} ${ROLE_EN_CLAIR[valeur.role] ?? ''}`.trim();
  panneau({
    titre: `Valider la portion : ${nom}`,
    corps: [
      h('p', { classe: 'aide' }, 'Estimation à valider : fourchette de référence, pas encore une valeur de votre cuisine.'),
      h('p', { classe: 'quantite-grande fourchette' }, texteFourchette(p), h('small', null, ` ${texteEtat(p)}`)),
      h('p', { classe: 'meta' }, `Le calcul prend aujourd'hui le milieu de cette fourchette (${formaterNombre((p.min + p.max) / 2)} ${libelle('UNITE', p.unite)}).`),
      valeur.sources ? h('p', { classe: 'meta' }, `Sources : ${valeur.sources}`) : null,
      valeur.note ? h('p', { classe: 'meta' }, valeur.note) : null,
      existant ? h('p', { classe: 'encadre' }, `Standard maison déjà validé : ${formaterNombre(existant.valeur)} ${libelle('UNITE', existant.unite)}, poids ${libelle('ETAT_POIDS', existant.etat)}. « Corriger » le remplace.`) : null,
      effetVu,
      ...f.noeuds,
    ],
    libelleEnregistrer: 'Valider comme standard maison',
    surEnregistrer: () => { agirStrict((e, t) => validerStandard(e, valeur.famille, valeur.role, lire(), t)); },
    extras: [
      { libelle: 'Corriger', action: (api) => { agirStrict((e, t) => corrigerStandard(e, valeur.famille, valeur.role, lire(), t)); api.fermer(); } },
      { libelle: 'Seulement cette fois', action: (api) => {
        if (valeur.composantIds.length === 0) throw new Error('Aucun plat concerné : ouvrez cette feuille depuis un plat pour une correction ponctuelle.');
        const saisie = lire();
        agirStrict((e, t) => { for (const id of valeur.composantIds) correctionDuJour(e, id, { valeur: saisie.valeur }, t); });
        api.fermer();
      } },
      { libelle: 'Plus tard', action: (api) => { agirStrict((e, t) => reporterValidation(e, valeur.cle, t)); api.fermer(); } },
    ],
  });
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
  const origine = ORIGINE_EN_CLAIR[p.actuelle.origine] ?? p.actuelle.origine;
  panneau({
    titre: `Votre standard : ${p.libelle} ${ROLE_EN_CLAIR[p.role] ?? ''}`.trim(),
    corps: [
      h('p', { classe: 'quantite-grande' }, `${formaterNombre(p.valeur)} ${unite}`, h('small', null, ` poids ${libelle('ETAT_POIDS', p.etatPoids)}`)),
      h('p', { classe: 'aide' }, `Vous avez corrigé ${pluriel(p.nombre, 'fois')} la portion dans le même sens (du ${libelleJour(p.dates[0])} au ${libelleJour(p.dates.at(-1))}).`),
      h('p', { classe: 'meta' }, `Valeur actuelle : ${formaterNombre(p.actuelle.valeur)} ${libelle('UNITE', p.actuelle.unite)} (${origine}).`),
      h('ul', { classe: 'meta' }, p.historique.map((x) => h('li', null, `${libelleJour(x.date)} : ${x.nom}, ${formaterNombre(x.valeur)} ${unite}`))),
      ...f.noeuds,
    ],
    libelleEnregistrer: 'En faire mon standard',
    surEnregistrer: () => { agirStrict((e, t) => accepterApprentissage(e, p.cleFamille, p.role, lire(), t)); },
    extras: [
      { libelle: 'Non, garder', action: (api) => { agirStrict((e, t) => ecarterApprentissage(e, p.cleFamille, p.role, t)); api.fermer(); } },
    ],
  });
}
