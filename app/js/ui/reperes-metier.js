// Repères métier (aide à la lecture, jamais à la saisie) : pour une famille de produits ou un thème du référentiel,
// temps et températures de cuisson, techniques et conservation, avec fourchette, « standard de base », provenance courte
// et « à valider localement ». Rien n'est copié dans un champ de saisie ni dans l'état. Aucun chiffre ici.
//
// API : reperesPour(cle, etat?) -> lignes ; blocReperes(cle, etat?) -> <details> fermé ou null ; blocBuffet(couverts) -> <details> ;
//       pageReperesMetier(conteneur, { theme, etat? }) -> page de consultation (branchée par l'intégrateur).
//       Avec `etat`, un repère que la propriétaire a ajusté montre d'abord « votre valeur : N », puis le standard de base.

import { ajustementDe } from '../domaine/ajustements.js';
import {
  LIBELLE_STANDARD_BASE, rattachementsDe, reperesAide, reperesConservation, reperesCuisson, standardDeBase, texteProvenance,
} from '../domaine/standards-base.js';
import { h } from './dom.js';
import { ligneFeuille, pastille } from './elements.js';
import { pluriel } from './format.js';

export const THEMES = Object.freeze([
  ['feculents', 'Féculents'], ['legumes', 'Légumes'], ['sauces-cuissons', 'Sauces et cuissons'],
  ['hygiene', 'Hygiène'], ['organisation', 'Organisation'],
]);
const MAX_PAR_RUBRIQUE = 3;
const RUBRIQUES = ['Cuisson', 'Techniques', 'Conservation'];
const LIBELLE_VERIFICATION = Object.freeze({
  confirmee: 'confirmé à la source', partielle: 'confirmé en partie', non_confirmee: 'non confirmé à la source',
  base_sanji_seule: 'base métier seule',
});

const nombreFr = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const texteFourchette = (f, unite) => {
  if (!f) return '';
  const u = unite ? ` ${unite}` : '';
  if (f.min !== null && f.max !== null) return `${f.min === f.max ? nombreFr(f.min) : `${nombreFr(f.min)}–${nombreFr(f.max)}`}${u}`;
  if (f.min !== null) return `au moins ${nombreFr(f.min)}${u}`;
  return f.max !== null ? `au plus ${nombreFr(f.max)}${u}` : '';
};
const coupe = (t, n = 190) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t);

/** Provenance courte d'une entrée du référentiel : première source, vérification, confiance. */
function provenanceEntree(x) {
  const s = x.sources?.[0];
  const verif = LIBELLE_VERIFICATION[x.verification?.resultat];
  return [s ? `${s.organisme}, ${s.titre}` : 'source non précisée', verif, x.confiance ? `confiance ${x.confiance}` : null]
    .filter(Boolean).join(' ; ');
}

function ligneAide(x) {
  const rubrique = /cuisson|cuire|rendement|temps/.test(x.id) ? 'Cuisson' : /conserv|stock/.test(x.id) ? 'Conservation' : 'Techniques';
  return {
    rubrique, id: x.id, titre: x.sujet, texte: coupe(x.enonce), votre: null, standard: null,
    fourchette: x.valeur ? texteFourchette(x.valeur, x.valeur.unite) : '', provenance: provenanceEntree(x),
    aValiderLocalement: x.portee === 'a_valider_localement',
  };
}

/** Sujet de l'ajustement d'un standard : famille, « groupe:<clé> » ou « regle:<clé> ». */
const sujetDe = (c) => c?.famille ?? (c?.groupe ? `groupe:${c.groupe}` : c?.regle_generale ? `regle:${c.regle_generale}` : null);

function ligneStandard(std, rubrique, etat = null) {
  const sujet = etat ? sujetDe(std.cible) : null;
  const ajuste = sujet ? ajustementDe(etat, sujet, std.usage) : null;
  const rattachee = std.provenance.id ? rattachementsDe(std.usage).find((x) => x.id === std.provenance.id) : null;
  const nom = std.provenance.sujet ?? std.provenance.produit ?? '';
  return {
    rubrique, id: std.provenance.id ?? std.provenance.table, titre: nom || std.usage.replace('_', ' '), texte: '',
    votre: ajuste ? `votre valeur : ${nombreFr(ajuste.valeur)} ${ajuste.unite ?? ''}`.trim() : null,
    standard: `${LIBELLE_STANDARD_BASE} : ${nombreFr(std.valeur)} ${std.unite ?? ''}`.trim(),
    fourchette: texteFourchette(std.fourchette, std.unite), provenance: texteProvenance(std, { prefixe: false }),
    aValiderLocalement: rattachee?.portee === 'a_valider_localement',
  };
}

/** Repères d'une famille ou d'un thème : [{ rubrique, id, titre, texte, standard, fourchette, provenance, aValiderLocalement }]. */
export function reperesPour(cle, etat = null) {
  if (typeof cle !== 'string' || cle === '') return [];
  const lignes = [
    ...reperesCuisson(cle).map((s) => ligneStandard(s, 'Cuisson', etat)),
    ...reperesConservation(cle).map((s) => ligneStandard(s, 'Conservation', etat)),
    ...reperesAide(cle).map(ligneAide),
  ];
  const vus = new Set();
  return lignes.filter((l) => (vus.has(l.id) ? false : vus.add(l.id)));
}

function rendreLigne(l) {
  return h('li', { classe: 'repere', dataset: { repere: l.id } },
    h('strong', null, l.titre),
    l.fourchette ? h('span', null, ` : ${l.fourchette}`) : null,
    ' ', l.votre ? [pastille(l.votre, 'vert'), ' '] : null, l.standard ? pastille(l.standard, 'gris') : null,
    l.aValiderLocalement ? [' ', pastille('à valider localement', 'ambre')] : null,
    l.texte ? h('p', { classe: 'petit' }, l.texte) : null,
    h('p', { classe: 'meta' }, `Provenance : ${l.provenance}`));
}

function rubriques(lignes, max = Infinity) {
  let reste = 0;
  const blocs = RUBRIQUES.map((r) => {
    const l = lignes.filter((x) => x.rubrique === r);
    if (l.length === 0) return null;
    reste += Math.max(0, l.length - max);
    const liste = h('ul', { classe: 'liste-simple' }, l.slice(0, max).map(rendreLigne));
    return h('div', null, h('h4', { classe: 'bloc-titre' }, max === Infinity ? `${r} (${l.length})` : r), liste);
  });
  return { blocs, reste };
}

/** Ligne « Repères métier › » d'une famille, qui ouvre ses repères en feuille ; null s'il n'y a rien à dire. Lecture seule. */
export function blocReperes(cle, etat = null) {
  const lignes = reperesPour(cle, etat);
  if (lignes.length === 0) return null;
  const { blocs, reste } = rubriques(lignes, MAX_PAR_RUBRIQUE);
  return h('section', { classe: 'carte reperes-metier', id: 'reperes-metier' }, ligneFeuille('Repères métier', 'Repères métier', () => h('div', null,
    h('p', { classe: 'aide' }, 'Aide à la lecture : rien de ceci n\'est copié dans vos valeurs. Votre valeur passe toujours devant.'),
    blocs,
    reste > 0 ? h('p', { classe: 'meta' }, `${reste} ${reste > 1 ? 'autres repères' : 'autre repère'} dans la page « Repères métier » des Réglages.`) : null)));
}

/** Page de consultation d'un thème (tous les repères) ; le thème par défaut est le premier. Remplit `conteneur`. */
export function pageReperesMetier(conteneur, { theme, sansTitre = false, etat = null } = {}) {
  const actif = THEMES.some(([c]) => c === theme) ? theme : THEMES[0][0];
  const { blocs } = rubriques(reperesPour(actif, etat));
  conteneur.replaceChildren(h('div', { classe: 'vue vue-reperes' },
    sansTitre ? null : h('h1', { classe: 'page-titre' }, 'Repères métier'),
    h('p', { classe: 'aide' }, 'Consultation seulement : fourchettes et provenance du référentiel culinaire. Votre valeur passe toujours devant.'),
    h('div', { classe: 'actions' }, THEMES.map(([c, nom]) => h('button', {
      type: 'button', classe: `btn btn-court${c === actif ? ' principal' : ''}`, 'aria-pressed': c === actif ? 'true' : 'false',
      onClick: () => pageReperesMetier(conteneur, { theme: c, sansTitre, etat }),
    }, nom))),
    h('h2', { classe: 'section-titre' }, THEMES.find(([c]) => c === actif)[1]),
    blocs));
}

// ------------------------------------------------------------------ buffet par couvert

const grammes = (g) => (g >= 1000 ? `${nombreFr(g / 1000)} kg` : `${nombreFr(g)} g`);
const POIDS_ETAT = { sec: 'poids sec', cru_net: 'poids cru net', cuit: 'poids cuit' };

/** Standards de buffet par couvert (usage buffet_couvert), résolus par la même API que le calcul. */
function standardsBuffet() {
  return rattachementsDe('buffet_couvert').map((x) => {
    const c = x.rattachement.cible;
    return c.regle_generale ? standardDeBase(null, 'buffet_couvert', { regle: c.regle_generale })
      : standardDeBase(c.groupe ? `groupe:${c.groupe}` : c.famille, 'buffet_couvert');
  }).filter(Boolean);
}

/**
 * Bloc replié « Buffet » d'une fiche de fonction : quantités par couvert, multipliées par les couverts quand ils
 * sont connus. Lecture seule : aucun effet sur les portions du menu ni sur les commandes.
 */
/** Provenance d'un repère de buffet, en mots du métier : jamais l'identifiant technique de l'entrée du référentiel. */
function provenanceBuffet(s) {
  if (s.origine === 'base_metier') return `${LIBELLE_STANDARD_BASE} (${texteProvenance(s, { prefixe: false })})`;
  const verif = LIBELLE_VERIFICATION[s.provenance.verification];
  return `${LIBELLE_STANDARD_BASE} (référentiel culinaire${verif ? `, ${verif}` : ''})`;
}

export function blocBuffet(couverts) {
  const n = Number.isFinite(Number(couverts)) && Number(couverts) > 0 ? Number(couverts) : 0;
  const standards = standardsBuffet();
  if (standards.length === 0) return null;
  return ligneFeuille('Buffet : quantités par couvert', 'Buffet : quantités par couvert', () => h('div', null,
    h('p', { classe: 'meta' }, `Lecture seule, ${LIBELLE_STANDARD_BASE} : sans effet sur les portions du menu ni sur les commandes.`),
    h('ul', { classe: 'liste-simple' }, standards.map((s) => {
      const etat = POIDS_ETAT[s.etatPoids];
      const { min, max } = s.fourchette;
      return h('li', { classe: 'repere' },
        h('strong', null, s.provenance.sujet), ' ', pastille(LIBELLE_STANDARD_BASE, 'gris'),
        h('p', null, `Par couvert : ${texteFourchette(s.fourchette, 'g')}${etat ? `, ${etat}` : ''}`),
        n > 0 && min !== null && max !== null
          ? h('p', null, `Pour ${pluriel(n, 'couvert')} : ${grammes(min * n)}–${grammes(max * n)}`) : null,
        s.etatPoids ? null : h('p', { classe: 'alerte-texte' }, 'État de poids non établi (cru ou cuit), à confirmer avant tout calcul.'),
        h('p', { classe: 'meta' }, `Provenance : ${provenanceBuffet(s)}`));
    }))), { classe: 'sous-carte buffet-couvert' });
}
