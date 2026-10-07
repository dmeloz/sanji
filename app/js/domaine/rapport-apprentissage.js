// « Ce que Sanji a appris » : lecture seule de la mémoire des noms et des semaines à préciser. Ne modifie jamais l'état.

import { lundiDe } from './dates.js';

const MAX_MOTS = 30;
const MAX_SEMAINES = 8;
const A_PRECISER = 'a_preciser';

function motDeCle(cle, entree) {
  const coupe = cle.lastIndexOf('|');
  return { nom: coupe < 0 ? cle : cle.slice(0, coupe), menu: coupe < 0 ? null : Number(cle.slice(coupe + 1)), categorie: entree.categorie };
}

export function rapportApprentissage(etat) {
  const retenus = Object.entries(etat?.memoire ?? {})
    .filter(([, entree]) => entree && typeof entree === 'object' && entree.categorie && entree.categorie !== A_PRECISER)
    .map(([cle, entree]) => motDeCle(cle, entree))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const parSemaine = new Map();
  for (const c of Object.values(etat?.composants ?? {})) {
    if (typeof c?.date !== 'string') continue;
    const lundi = lundiDe(c.date);
    const ligne = parSemaine.get(lundi) ?? { lundi, aPreciser: 0, composants: 0 };
    parSemaine.set(lundi, { ...ligne, composants: ligne.composants + 1, aPreciser: ligne.aPreciser + (c.categorie === A_PRECISER ? 1 : 0) });
  }
  const semaines = [...parSemaine.values()].sort((a, b) => (a.lundi < b.lundi ? 1 : -1)).slice(0, MAX_SEMAINES);
  return { motsRetenus: retenus.length, mots: retenus.slice(0, MAX_MOTS), semaines };
}
