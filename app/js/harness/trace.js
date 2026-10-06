// Traçabilité : chaque événement du harness s'écrit dans le journal existant de l'état (`etat.journal`, 2000 lignes,
// exporté avec les données), sous l'action `harness:<type>`. Aucun format persistant nouveau.
// Le détail ne contient que des identifiants et des noms de composants : jamais d'allergies ni d'identités.

import { ajouterJournal } from '../domaine/etat.js';
import { PROVENANCES } from './contrats.js';

const LONGUEUR_MAX = 240;
const PREFIXE = 'harness:';

/**
 * Ajoute une ligne au journal de `etat` (à appeler dans une action de `agir`, jamais ailleurs).
 * Détail : « provenance|propositionId|résumé ».
 * @param {object} etat copie de travail
 * @param {string} h horodatage
 * @param {string} type ex. `validee`, `refusee`, `appliquee`
 * @param {{provenance:string, propositionId?:string|null, resume?:string}} infos
 */
export function tracer(etat, h, type, { provenance, propositionId = null, resume = '' }) {
  if (!Object.values(PROVENANCES).includes(provenance)) throw new Error(`Provenance inconnue : ${provenance}`);
  ajouterJournal(etat, h, `${PREFIXE}${type}`, `${provenance}|${propositionId ?? '-'}|${resume}`.slice(0, LONGUEUR_MAX));
}

/** Entrées du journal écrites par le harness, de la plus récente à la plus ancienne. */
export function evenementsHarness(etat, limite = 20) {
  return (etat.journal ?? []).filter((e) => e.action?.startsWith(PREFIXE)).slice(-limite).reverse();
}

const LIBELLES_ORIGINE = { deterministe: 'calcul déterministe', modele: 'proposition du modèle, recontrôlée par le calcul' };

/**
 * Explique en clair une proposition : d'où elle vient, ce qu'elle utilise, ce qui reste incertain.
 * @returns {string[]}
 */
export function expliquer(proposition) {
  const lignes = [`Origine : ${LIBELLES_ORIGINE[proposition.origine] ?? proposition.origine}.`];
  for (const s of proposition.sources) lignes.push(`Source : ${s}`);
  for (const x of proposition.hypotheses) lignes.push(`Hypothèse : ${x}`);
  for (const x of proposition.incertitudes) lignes.push(`Incertain : ${x}`);
  for (const c of proposition.controles) lignes.push(`Contrôle ${c.ok ? 'passé' : 'échoué'} : ${c.nom}${c.detail ? ` (${c.detail})` : ''}`);
  for (const x of proposition.aDecider) lignes.push(`À décider : ${x.texte}`);
  return lignes;
}
