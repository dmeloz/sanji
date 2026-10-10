// « Ce que Sanji a appris » : lecture seule de la mémoire des noms et des semaines à préciser. Ne modifie jamais l'état.

import { lundiDe } from './dates.js';
import { categorieMotValide } from './mots-retenus.js';
import { libelle } from './statuts.js';

const MAX_MOTS = 30;
const MAX_SEMAINES = 8;
const A_PRECISER = 'a_preciser';

function motDeCle(cle, entree) {
  const coupe = cle.lastIndexOf('|');
  return { nom: coupe < 0 ? cle : cle.slice(0, coupe), menu: coupe < 0 ? null : Number(cle.slice(coupe + 1)), categorie: entree.categorie };
}

const LIGNES_MAX = 100;

/** « boulgour · garniture · 80 g cuit » : ce qu'une fiche retenue garde, en une ligne. */
function resumeFiche(cle, f) {
  const g = f.grammage ? `${f.grammage.valeur} ${f.grammage.unite === 'g' ? 'g' : libelle('UNITE', f.grammage.unite)} ${libelle('ETAT_POIDS', f.grammage.etat)}` : null;
  return [cle, f.role ? libelle('ROLE', f.role) : (f.categorie ? libelle('CATEGORIE', f.categorie).toLowerCase() : null),
    f.attribue === false ? 'hors poste' : null, g].filter(Boolean).join(' · ');
}

/** « tomate · sauce » : un élément d'un plat retenu (sa fonction si elle est parlante, sinon sa catégorie). */
const resumeElement = (e) => `${e.nom} · ${['sauce', 'garniture', 'herbe'].includes(e.role) ? libelle('ROLE', e.role) : libelle('CATEGORIE', e.categorie).toLowerCase()}`;

export function rapportApprentissage(etat) {
  // Mots retenus pour tous les plats (`etat.mots`, `pourTous`), puis noms retenus pour un menu (`etat.memoire`).
  const pourTous = Object.entries(etat?.mots ?? {})
    .filter(([, entree]) => categorieMotValide(entree?.categorie))
    .map(([mot, entree]) => ({ nom: mot, menu: null, categorie: entree.categorie, pourTous: true }));
  const retenus = Object.entries(etat?.memoire ?? {})
    .filter(([, entree]) => entree && typeof entree === 'object' && entree.categorie && entree.categorie !== A_PRECISER)
    .map(([cle, entree]) => motDeCle(cle, entree))
    .concat(pourTous)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const parSemaine = new Map();
  for (const c of Object.values(etat?.composants ?? {})) {
    if (typeof c?.date !== 'string') continue;
    const lundi = lundiDe(c.date);
    const ligne = parSemaine.get(lundi) ?? { lundi, aPreciser: 0, composants: 0 };
    parSemaine.set(lundi, { ...ligne, composants: ligne.composants + 1, aPreciser: ligne.aPreciser + (c.categorie === A_PRECISER ? 1 : 0) });
  }
  const semaines = [...parSemaine.values()].sort((a, b) => (a.lundi < b.lundi ? 1 : -1)).slice(0, MAX_SEMAINES);
  const entrees = (o) => Object.entries(o && typeof o === 'object' ? o : {}).sort(([a], [b]) => a.localeCompare(b, 'fr'));
  const fiches = entrees(etat?.fiches_retenues).map(([cle, f]) => ({ cle, resume: resumeFiche(cle, f) }));
  const plats = entrees(etat?.plats_retenus).map(([cle, p]) => ({ cle, resume: `${p.intitule || cle} — ${(p.elements ?? []).map(resumeElement).join(' ; ')}` }));
  return { motsRetenus: retenus.length, mots: retenus.slice(0, MAX_MOTS), semaines,
    fiches: fiches.slice(0, LIGNES_MAX), fichesRetenues: fiches.length, plats: plats.slice(0, LIGNES_MAX), platsRetenus: plats.length };
}
