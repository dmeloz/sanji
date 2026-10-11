// Constructeur de contexte : le minimum utile à une tâche, structuré, versionné et sans donnée sensible.
// Les fiches de fonction (allergies, remarques, noms) n'y entrent jamais ; seules les portions agrégées y figurent.
// Chaque donnée est rangée par certitude : confirmée, provisoire, estimée ou manquante.

import { aMenuDuJour, ajouterJours, estDateValide, joursEntre } from '../domaine/dates.js';
import { portionsMenu } from '../domaine/calcul.js';
import { etatTache } from '../domaine/planification.js';
import { CODES, ErreurHarness, VERSION_CONTEXTE } from './contrats.js';
import { evenementsHarness } from './trace.js';

export const JOURS_MAX = 14;
const NB_DECISIONS_ANTERIEURES = 10;
const LONGUEUR_NOM_MAX = 60;
export const NOM_NON_TRANSMIS = 'composant (nom non transmis)';
// Un nom vient d'un menu importé : texte libre. Un nom long ou qui ressemble à une remarque sur une personne ne part pas.
const MARQUEURS_PERSONNELS = /(allerg|intol[ée]?ran|c(?:oe|œ)?e?liaque|gluten|lactose|regime|\bpour (m\.|mme|mr|monsieur|madame|le client|la cliente))/i;
/** Vrai si le texte parle d'une personne ou d'un régime (accents décomposés et sans accent compris). */
export function contientMarqueurPersonnel(texte) {
  return MARQUEURS_PERSONNELS.test(String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/** Nom d'un composant ou d'une règle tel qu'il peut être transmis au modèle (heuristique prudente, jamais une garantie). */
export function nomTransmissible(nom) {
  const texte = String(nom ?? '').trim();
  return texte !== '' && texte.length <= LONGUEUR_NOM_MAX && !contientMarqueurPersonnel(texte) ? texte : NOM_NON_TRANSMIS;
}

/**
 * @param {object} etat
 * @param {{tache:string, dateDebut:string, dateFin:string, aujourdhui:string}} demande
 * @returns {{version:number, tache:string, periode:object, donnees:{confirmees:object[], provisoires:object[], estimees:object[], manquantes:object[]}, regles:object[], decisionsAnterieures:object[]}}
 */
export function construireContexte(etat, { tache, dateDebut, dateFin, aujourdhui }) {
  if (![dateDebut, dateFin, aujourdhui].every((d) => typeof d === 'string' && estDateValide(d))) {
    throw new ErreurHarness(CODES.ENTREE_INVALIDE, 'Contexte : dates invalides.');
  }
  const nbJours = joursEntre(dateDebut, dateFin) + 1;
  if (nbJours < 1 || nbJours > JOURS_MAX) throw new ErreurHarness(CODES.ENTREE_INVALIDE, `Contexte : période de 1 à ${JOURS_MAX} jours attendue.`);

  const donnees = { confirmees: [], provisoires: [], estimees: [], manquantes: [] };
  for (let i = 0; i < nbJours; i += 1) {
    const date = ajouterJours(dateDebut, i);
    if (!aMenuDuJour(date)) continue;
    for (const menu of [1, 2]) {
      const p = portionsMenu(etat, date, menu);
      if (p.previsionManquante) donnees.manquantes.push({ type: 'prevision', date, menu });
      else donnees.estimees.push({ type: 'prevision', date, menu, portions: p.prevision, certitude: 'estimee' });
      if (p.groupesConfirmes > 0) donnees.confirmees.push({ type: 'groupes', date, menu, portions: p.groupesConfirmes, certitude: 'confirmee' });
      if (p.groupesProvisoires > 0) donnees.provisoires.push({ type: 'groupes', date, menu, portions: p.groupesProvisoires, certitude: 'provisoire' });
    }
    for (const c of Object.values(etat.composants ?? {}).filter((x) => x.date === date && x.attribue).sort((a, b) => a.id.localeCompare(b.id))) {
      const production = Object.values(etat.productions ?? {}).find((p) => p.composantId === c.id && p.genre === 'principale');
      // L'identifiant de la production relie un composant aux items d'un brouillon : le modèle n'a pas à le deviner.
      const entree = { type: 'composant', id: c.id, date, menu: c.menu, nom: nomTransmissible(c.nom), categorie: c.categorie, productionId: production?.id ?? null };
      (c.valide ? donnees.confirmees : donnees.provisoires).push(entree);
      if (production && etatTache(etat, production.id) === 'a_preciser') {
        // Même filtre que l'entrée « composant » : un nom bloqué ne part pas, même dans ce texte.
        const nom = entree.nom === NOM_NON_TRANSMIS ? 'un composant' : entree.nom;
        donnees.manquantes.push({ type: 'quantite', composantId: c.id, texte: `${nom} : quantité inconnue` });
      }
    }
  }
  const regles = Object.values(etat.regles ?? {}).filter((r) => r.valideLe)
    .map((r) => ({ nom: nomTransmissible(r.nom), avanceMaxJours: r.avanceMaxJours, limiteUtilisationJours: r.limiteUtilisationJours }));
  // Seuls l'heure et le type d'événement : le détail du journal peut contenir un texte libre du chef.
  const decisionsAnterieures = evenementsHarness(etat, NB_DECISIONS_ANTERIEURES).map(({ h, action }) => ({ h, action }));
  return { version: VERSION_CONTEXTE, tache, periode: { debut: dateDebut, fin: dateFin, aujourdhui }, donnees, regles, decisionsAnterieures };
}
