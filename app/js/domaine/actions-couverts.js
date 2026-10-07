// Action sur les couverts du midi (voir couverts-midi.js) : un total, une répartition calculée ou décidée par le chef.

import { terminer } from './actions.js';
import { repartitionCalculee } from './couverts-midi.js';
import { aMenuDuJour, estDateValide } from './dates.js';
import { assurerJour } from './etat.js';

const entierPositif = (v) => Number.isInteger(v) && v >= 0;

/**
 * Enregistre le total de couverts du midi et sa répartition. `repartition` absente ou null : calcul (historique des ventes,
 * sinon 1/3 – 2/3) ; sinon { 1: n, 2: n } décidée par le chef, de somme égale au total. Écrit aussi les prévisions des deux
 * menus (source du calcul de production), donc la production se recalcule.
 * @returns {{total:number, repartition:null|{1:number,2:number}, h:string}}
 */
export function definirCouvertsMidi(etat, date, { total, repartition = null } = {}, h) {
  if (typeof h !== 'string' || Number.isNaN(Date.parse(h))) {
    throw new Error("Horodatage manquant ou invalide : chaque action reçoit l'heure (ISO) en dernier argument.");
  }
  if (!estDateValide(date)) throw new Error(`Date invalide : « ${date} » (format attendu AAAA-MM-JJ).`);
  if (!aMenuDuJour(date)) throw new Error('Pas de menu du jour ce jour-là : les menus existent du lundi au vendredi.');
  if (!entierPositif(total)) throw new Error('Les couverts du midi : entier supérieur ou égal à 0 attendu.');
  let m1;
  let m2;
  let decidee = null;
  if (repartition === null || repartition === undefined) {
    ({ m1, m2 } = repartitionCalculee(etat, date, total));
  } else {
    if (typeof repartition !== 'object' || !entierPositif(repartition[1]) || !entierPositif(repartition[2])) {
      throw new Error('Répartition : entiers supérieurs ou égaux à 0 attendus pour les menus 1 et 2.');
    }
    if (repartition[1] + repartition[2] !== total) {
      throw new Error(`La répartition (${repartition[1]} + ${repartition[2]}) doit faire ${total} couverts.`);
    }
    [m1, m2] = [repartition[1], repartition[2]];
    decidee = { 1: m1, 2: m2 };
  }
  const j = assurerJour(etat, date);
  j.couverts = { total, repartition: decidee, h };
  j.previsions[1] = { portions: m1, h };
  j.previsions[2] = { portions: m2, h };
  const detail = `${date} : ${total} couverts, menu 1 : ${m1}, menu 2 : ${m2} (${decidee ? 'décidé par vous' : 'calculé'})`;
  return terminer(etat, h, 'definirCouvertsMidi', detail, j.couverts);
}
