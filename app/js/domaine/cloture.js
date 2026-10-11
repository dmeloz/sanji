// Clôture de la semaine (v118) : « Retenir les éléments de la semaine ». On retient des ÉLÉMENTS (carbonara, risotto, côtes de
// bette à la crème), jamais un plat entier : chaque élément retenu écrit sa fiche (`etat.fiches_retenues`, voir fiches-retenues.js).
// Lecture seule ici ; les gestes sont dans actions-fiches.js.

import { ajouterJours, jourSemaine, lundiDe } from './dates.js';
import { estSauceAConfirmer, normaliser } from './etat.js';
import { ficheDe } from './fiches-retenues.js';
import { categorieMotValide, choixMotDe } from './mots-retenus.js';

/** Le samedi soir (dès cette heure, « HH:MM ») et le dimanche, la semaine se clôt : on propose de retenir ses éléments. */
export const HEURE_CLOTURE = '18:00';

const JOURS_DE_LA_SEMAINE = 6; // lundi à samedi

/**
 * État d'un élément pour la clôture : { choix, propose, bloque, raison }.
 * `choix` : la catégorie à retenir (un des quatre choix de CATEGORIES_MOT), la proposition de la lecture quand l'élément est « à préciser » ;
 * `bloque` : rien ne peut le retenir sans la propriétaire (sauce implicite sans nom, mot sans proposition).
 */
export function lectureDeCloture(c) {
  if (estSauceAConfirmer(c)) return { choix: null, propose: false, bloque: true, raison: 'sauce à nommer' };
  if (c.categorie === 'a_preciser') {
    return categorieMotValide(c.suggestion) ? { choix: c.suggestion, propose: true, bloque: false, raison: null }
      : { choix: null, propose: false, bloque: true, raison: 'à préciser' };
  }
  return { choix: choixMotDe(c), propose: false, bloque: false, raison: null };
}

/** Vrai si l'élément a déjà une fiche retenue qui dit sa catégorie. */
export const estRetenu = (etat, c) => Boolean(ficheDe(etat, c.nom)?.categorie);

/**
 * Les éléments au poste de la semaine du `lundi` (lundi à samedi), groupés par plat (jour, menu, intitulé).
 * `aRetenir` : noms distincts à retenir ; `bloques` : éléments que rien ne peut retenir seul ; `retenus` : noms distincts déjà retenus.
 * @returns {{plats:{date:string, menu:1|2, intitule:string, elements:{id:string, nom:string, choix:string|null, propose:boolean, bloque:boolean, raison:string|null, retenu:boolean}[]}[], aRetenir:number, bloques:number, retenus:number}}
 */
export function elementsDeLaSemaine(etat, lundi) {
  const dates = Array.from({ length: JOURS_DE_LA_SEMAINE }, (_, i) => ajouterJours(lundi, i));
  const plats = [];
  const vus = { aRetenir: new Set(), retenus: new Set() };
  let bloques = 0;
  for (const date of dates) {
    for (const menu of [1, 2]) {
      const elements = Object.values(etat.composants)
        .filter((c) => c.date === date && c.menu === menu && c.attribue === true)
        .map((c) => ({ id: c.id, nom: c.nom, ...lectureDeCloture(c), retenu: estRetenu(etat, c) }));
      if (elements.length === 0) continue;
      for (const e of elements) {
        const cle = normaliser(e.nom);
        if (e.retenu) vus.retenus.add(cle);
        else if (e.bloque) bloques += 1;
        else vus.aRetenir.add(cle);
      }
      plats.push({ date, menu, intitule: etat.jours?.[date]?.menus?.[menu]?.intitule ?? '', elements });
    }
  }
  return { plats, aRetenir: vus.aRetenir.size, bloques, retenus: vus.retenus.size };
}

/**
 * Rappel « Retenir les éléments de la semaine » : présent le samedi dès HEURE_CLOTURE et le dimanche, seulement s'il reste un
 * élément retenable. Un élément que rien ne peut retenir sans la propriétaire ne fait pas durer le rappel.
 * @returns {{lundi:string, aRetenir:number, retenus:number}|null}
 */
export function rappelCloture(etat, aujourd, heure = null) {
  const jour = jourSemaine(aujourd);
  if (jour !== 7 && !(jour === 6 && typeof heure === 'string' && heure >= HEURE_CLOTURE)) return null;
  const lundi = lundiDe(aujourd);
  const { aRetenir, retenus } = elementsDeLaSemaine(etat, lundi);
  return aRetenir > 0 ? { lundi, aRetenir, retenus } : null;
}
