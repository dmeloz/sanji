// Analyse d'un intitulé de menu : découpe et classement proposé.
// Le lexique (savoir.js) sert uniquement à classer des mots par catégorie : il ne porte aucun chiffre.

import { normaliser } from './etat.js';
import { lireNom } from './savoir.js';

// La virgule sépare les composants d'un intitulé. « et », « & » et « avec » ne séparent pas :
// dans un menu réel ils relient les éléments d'un même plat (« … aux olives et fromage »).
const SEPARATEURS = new RegExp([
  '\\s*,\\s*',
  "\\s+accompagn[ée](?:e|s|es)?\\s+(?:de\\s+|d['’])",
  "\\s+sur\\s+(?:un\\s+)?lit\\s+(?:de\\s+|d['’])",
].join('|'), 'i');

// Mots de liaison : on ne coupe jamais juste après (ni juste avant) l'un d'eux (« poulet au riz », « sauce aux carottes »).
const LIAISONS = new Set(['de', 'du', 'des', 'd', 'au', 'aux', 'a', 'la', 'le', 'les', 'l', 'en', 'sur', 'sous', 'avec', 'et', 'sauce', 'jus', 'façon', 'facon']);
const mot = (m) => normaliser(m).replace(/[^a-z0-9]/g, '');

/**
 * Coupe « <protéine> <féculent ou légume connu> » écrit sans virgule (« Escalope pommes frites »). Prudent : le début
 * doit être une protéine, la suite doit nommer un produit connu (famille), et aucune coupure n'est faite après ou avant
 * un mot de liaison. En cas de doute, le nom reste entier.
 */
function couperProteine(nom) {
  const mots = nom.split(/\s+/);
  if (mots.length < 2 || lireNom(nom).categorie !== 'proteine') return [nom];
  for (let i = 1; i < mots.length; i += 1) {
    if (LIAISONS.has(mot(mots[i - 1])) || LIAISONS.has(mot(mots[i]))) continue;
    const gauche = mots.slice(0, i).join(' ');
    const droite = mots.slice(i).join(' ');
    if (lireNom(gauche).categorie === 'proteine' && lireNom(droite).famille !== null) return [gauche, droite];
  }
  return [nom];
}

/**
 * Catégorie proposée pour un nom (`a_preciser` si rien n'est reconnu).
 * Règle : le premier mot reconnu décide (« <protéine> sauce … » reste une protéine). Exception : un mot de
 * forme suivi de « de » (« purée de … », « tagliatelle de … ») laisse décider le produit nommé ensuite.
 * Le lexique et la lecture vivent dans savoir.js : il n'y a qu'un seul lexique pour l'application.
 */
export function categoriePropose(nom) {
  return lireNom(nom).categorie;
}

/**
 * Découpe un intitulé et propose des composants (jamais validés).
 * Menu 1 : tout est attribué. Menu 2 : seulement légumes et féculents. Une exception mémorisée prime.
 * @param {string} intitule
 * @param {1|2} menu
 * @param {object} [memoire] état.memoire
 * @returns {{nom:string, categorie:string, attribue:boolean, type:'a_preciser', depuisMemoire?:true}[]}
 */
export function proposerComposants(intitule, menu, memoire = {}) {
  return String(intitule ?? '').split(SEPARATEURS)
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .flatMap(couperProteine)
    .map((nom) => {
      let categorie = categoriePropose(nom);
      let attribue = menu === 1 ? true : categorie === 'legume' || categorie === 'feculent';
      const cle = normaliser(nom);
      const memorise = memoire && Object.hasOwn(memoire, cle) ? memoire[cle] : null;
      const proposition = { nom, categorie, attribue, type: 'a_preciser' };
      if (memorise) {
        proposition.categorie = memorise.categorie ?? categorie;
        proposition.attribue = typeof memorise.attribue === 'boolean' ? memorise.attribue : attribue;
        proposition.depuisMemoire = true;
      }
      return proposition;
    });
}
