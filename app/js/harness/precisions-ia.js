// Lecture hybride des menus (décision du 2026-10-07) : ce qui peut partir vers l'IA pour un élément « à préciser », et
// comment lire sa réponse. Seuls le nom, le numéro de menu et l'intitulé du plat partent ; jamais une quantité ni une
// donnée de personne. La réponse n'est qu'une proposition « à confirmer ». Module pur : ni DOM ni réseau.

import { NOM_NON_TRANSMIS, contientMarqueurPersonnel, nomTransmissible } from './contexte.js';
import { CATEGORIE } from '../domaine/statuts.js';

export const INTITULE_MAX = 200;
export const REMARQUE_MAX = 120;

/** @returns {{nom:string, menu:number, intitule:string, texte:string}|null} null si le nom ne peut pas partir */
export function apercuEnvoi(composant, intitule) {
  const nom = nomTransmissible(composant?.nom);
  if (nom === NOM_NON_TRANSMIS) return null;
  const menu = composant.menu;
  if (menu !== 1 && menu !== 2) return null;
  // Même filtre que le nom : un intitulé qui parle d'une personne ou d'une allergie ne part pas, seul le nom part.
  // Un chiffre dans l'intitulé (quantité, prix, nombre de couverts) ne part pas non plus.
  const brut = String(intitule ?? '').normalize('NFC').trim().slice(0, INTITULE_MAX);
  const intituleEnvoye = contientMarqueurPersonnel(brut) || /\d/.test(brut) ? '' : brut;
  const plat = intituleEnvoye === '' ? '' : `, du plat « ${intituleEnvoye} »`;
  return { nom, menu, intitule: intituleEnvoye, texte: `élément « ${nom} » du menu ${menu}${plat}` };
}

/** @returns {{categorie:string, remarque:string}|null} tout champ en plus est ignoré ; réponse invalide : null */
export function lirePropositionCategorie(reponse) {
  if (!reponse || typeof reponse !== 'object') return null;
  const { categorie, remarque } = reponse;
  if (typeof categorie !== 'string' || categorie === 'a_preciser' || !Object.hasOwn(CATEGORIE, categorie)) return null;
  // La catégorie est utile même si la remarque ne l'est pas : une remarque suspecte (trop longue, un chiffre, une
  // personne ou un régime) est simplement écartée.
  const sure = typeof remarque === 'string' && remarque.length <= REMARQUE_MAX && !/\d/.test(remarque) && !contientMarqueurPersonnel(remarque);
  return { categorie, remarque: sure ? remarque.trim() : '' };
}

/** Champs appliqués quand la propriétaire accepte : la catégorie ; un légume ou un féculent va au poste, comme à la lecture d'un intitulé. */
export function champsApresProposition(proposition) {
  const auPoste = proposition.categorie === 'legume' || proposition.categorie === 'feculent';
  return auPoste ? { categorie: proposition.categorie, attribue: true } : { categorie: proposition.categorie };
}
