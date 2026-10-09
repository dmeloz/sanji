// « Préparer la semaine » (décision du 2026-10-09) : ce qui reste à faire entre l'enregistrement des menus et la fiche de
// production : couverts du midi par jour, valeurs à confirmer (avec ou sans standard de base). Aucune règle nouvelle : le
// module assemble couverts-midi.js et validation.js. Pur : ni DOM ni heure courante (`aujourd` vient de l'appelant).

import { COUVERTS_RAPIDES, couvertsMidiDuJour } from './couverts-midi.js';
import { aMenuDuJour, datesDeLaSemaine } from './dates.js';
import { jourOuVide } from './etat.js';
import { ROLES_STANDARD, grammageEffectif } from './savoir.js';
import { cleStandardDe, valeursAValider } from './validation.js';

const JOURS_DE_LA_SEMAINE = 7;
const ROLE_EN_CLAIR = { plat_principal: 'plat principal', garniture: 'garniture' };

const intitule = (etat, date, menu) => String(jourOuVide(etat, date).menus[menu].intitule ?? '').trim();

/** Une portion sans valeur ni standard : le plat est au poste, validé, de type connu, et son calcul reste INCONNU. */
function sansPortion(etat, composant) {
  return composant.attribue && composant.valide && composant.type !== 'generique' && composant.type !== 'a_preciser'
    && grammageEffectif(etat, composant) === null;
}

/**
 * Préparation d'une semaine (lundi donné).
 * - `jours` : les jours de service qui ont un menu (lundi au vendredi, jamais le dimanche), avec les couverts du midi
 *   (`total` : null tant que rien n'est saisi) et les valeurs rapides à proposer (`auChoix`).
 * - `aConfirmer` : une ligne par valeur à confirmer. Avec standard : `{ id, libelle, cible:{type:'standard', famille, role},
 *   valeurStandard, unite, etatPoids, estInconnu:false }` ; sans standard : `{ id, libelle, cible:{type:'composant', composantId, famille|null, role},
 *   valeurStandard:null, unite, estInconnu:true }`.
 * - `restantInconnu` : nombre de lignes sans standard ; `aFaire` : jours à venir sans couverts + lignes à confirmer.
 * - `premierJour` : jour de la fiche de production à ouvrir (premier jour à menu jamais avant `aujourd`, sinon le premier
 *   de la semaine), ou null sans menu.
 */
export function preparationSemaine(etat, lundi, aujourd) {
  const dates = datesDeLaSemaine(lundi).slice(0, JOURS_DE_LA_SEMAINE);
  const jours = dates.filter((date) => aMenuDuJour(date) && (intitule(etat, date, 1) !== '' || intitule(etat, date, 2) !== ''))
    .map((date) => ({
      date, menus: { 1: intitule(etat, date, 1), 2: intitule(etat, date, 2) },
      couverts: { total: couvertsMidiDuJour(etat, date).total, auChoix: COUVERTS_RAPIDES },
    }));

  const avecStandard = valeursAValider(etat, lundi, JOURS_DE_LA_SEMAINE).map((v) => ({
    id: `valeur:${v.cle}`, libelle: `${v.libelle} · ${ROLE_EN_CLAIR[v.role] ?? v.role}`,
    cible: { type: 'standard', famille: v.famille, role: v.role },
    valeurStandard: (v.proposition.min + v.proposition.max) / 2, unite: v.proposition.unite, etatPoids: v.proposition.etat, estInconnu: false,
  }));
  const sansStandard = Object.values(etat.composants ?? {}).filter((c) => dates.includes(c.date) && sansPortion(etat, c))
    .sort((a, b) => a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom))
    .map((c) => ({
      id: `portion:${c.id}`, libelle: c.nom,
      // Famille et rôle connus : la valeur tapée devient le standard maison (retenu pour toutes les semaines).
      cible: { type: 'composant', composantId: c.id, famille: ROLES_STANDARD.includes(c.role) ? cleStandardDe(c) : null, role: c.role },
      valeurStandard: null, unite: c.grammage.unite, etatPoids: c.grammage.etat, estInconnu: true,
    }));

  const aConfirmer = [...avecStandard, ...sansStandard];
  const sansCouverts = jours.filter((j) => j.couverts.total === null && j.date >= aujourd).length;
  const premier = jours.find((j) => j.date >= aujourd) ?? jours[0] ?? null;
  return { jours, aConfirmer, restantInconnu: sansStandard.length, aFaire: sansCouverts + aConfirmer.length, premierJour: premier?.date ?? null };
}
