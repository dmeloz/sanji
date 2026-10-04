// Fiche technique d'un composant (#/fiche/<composantId>) : refonte 1, maquette « Fiche ».
// Affiche ce que l'application sait déjà (calcul, provenance, recette, étapes de la règle, allergènes, repères) ; aucune règle ici.
// Les gestes avancés de l'ancienne vue composant restent dans le repli « Plus de réglages » (voir vue-composant.js).

import { statutAllergenes } from '../domaine/allergenes.js';
import { calculerComposant } from '../domaine/calcul.js';
import { libelleJour } from '../domaine/dates.js';
import { etapesComposant } from '../domaine/planification.js';
import { LIBELLE_ESTIMATION_A_VALIDER, libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { h, svg } from './dom.js';
import { bouton, ligneVide, lien, pastille, repliable } from './elements.js';
import { quantite } from './format.js';
import { libelleAllergene } from './reference.js';
import { blocReperes } from './reperes-metier.js';
import { defaireEnUnToucher, dialogCorriger, faireEnUnToucher } from './taches.js';
import { sectionsReglages } from './vue-composant.js';

export const titre = () => 'Fiche technique';

const VARIANTE_PROVENANCE = { RESTAURANT_VALIDE: 'vert', CALCULE: 'vert' };
const VARIANTE_ETAPE = { fait: 'vert', en_cours: 'vert', a_planifier: 'ambre', ecart: 'rouge' };

/** « Recette » pour une préparation maison, « Brut » pour un produit simple, sinon le type tel que l'application le nomme. */
export const etiquetteType = (c) => (c.type === 'preparation_maison' ? 'Recette' : c.type === 'produit_simple' ? 'Brut' : libelle('TYPE_COMPOSANT', c.type));

/** Production principale du composant (celle que « Fait » marque), ou null. */
export function principaleDuComposant(etat, composantId) {
  return Object.values(etat.productions ?? {}).find((p) => p.composantId === composantId && p.genre === 'principale') ?? null;
}

/**
 * Répartition de la quantité du jour : une ligne par source de portions (prévision du menu, fiches de fonction avec leur
 * certitude). La quantité d'une ligne est la part des portions dans la quantité calculée (la chaîne de calcul est linéaire) ;
 * sans quantité calculée, la ligne ne montre que ses portions.
 */
export function repartition(c, calc) {
  const p = calc.portions;
  return p.details.map((d) => {
    const part = calc.statut === 'CALCULE' && p.total > 0 && Number.isFinite(calc.quantiteTravail) ? calc.quantiteTravail * (d.portions / p.total) : null;
    return {
      libelle: d.source === 'prevision' ? `Menu ${c.menu}` : `Fiche ${d.numero || ''}`.trim(),
      certitude: libelle('CERTITUDE', d.certitude), portions: d.portions, part, ratio: p.total > 0 ? d.portions / p.total : 0,
      source: d.source,
    };
  });
}

const icone = (d) => svg('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' },
  svg('path', { d }));

function sectionQuantite(etat, c, calc) {
  const p = principaleDuComposant(etat, c.id);
  const jourMeme = (p?.jourDecide ?? c.date) === aujourdhui();
  const lignes = repartition(c, calc);
  return h('section', { classe: 'fiche-quantite' },
    h('p', { classe: 'fiche-legende' }, `${jourMeme ? 'À produire aujourd\'hui' : 'À produire'} · pour ${libelleJour(c.date)}`),
    calc.statut === 'CALCULE'
      ? h('p', { classe: 'fiche-qte-grande' }, quantite(calc.quantiteTravail, calc.uniteTravail), h('small', null, ` ${calc.libelleQuantite}`))
      : h('p', { classe: 'fiche-qte-grande fiche-qte-inconnue' }, 'quantité inconnue', h('small', null, ` ${calc.libelleQuantite}`)),
    lignes.length === 0 ? h('p', { classe: 'fiche-legende' }, 'Aucune répartition : aucune portion saisie pour ce menu.')
      : h('ul', { classe: 'fiche-repartition' }, lignes.map((l) => h('li', null,
        h('span', { classe: 'fiche-rep-nom' }, l.libelle, h('small', null, ` ${l.certitude}`)),
        l.part !== null ? h('span', { classe: 'fiche-jauge', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(l.ratio * 100)}%` })) : null,
        h('span', { classe: 'fiche-qte' }, l.part !== null ? quantite(l.part, calc.uniteTravail) : `${l.portions} portions`)))),
    h('p', { classe: 'fiche-legende' }, `Calcul : ${calc.formule}`));
}

function sectionProvenance(c, calc) {
  return h('section', { classe: 'carte fiche-bloc' },
    h('h2', { classe: 'fiche-titre-bloc' }, 'Calcul et provenance'),
    h('p', null, calc.statut === 'CALCULE' ? pastille(libelle('PROVENANCE', 'CALCULE'), 'vert') : pastille(libelle('PROVENANCE', 'INCONNU'), 'gris'), ' ',
      calc.aValider ? pastille(LIBELLE_ESTIMATION_A_VALIDER, 'ambre') : null, ' ',
      calc.standardBase ? pastille(libelle('PROVENANCE', 'STANDARD_BASE'), 'gris') : null),
    calc.dependances.length === 0 ? ligneVide('Aucun paramètre renseigné.')
      : h('ul', { classe: 'liste-simple' }, calc.dependances.map((d) => h('li', null,
        h('strong', null, d.parametre === 'recette' ? 'recette' : d.parametre === 'grammage' ? 'grammage' : libelle('ETAPE', d.parametre)), ' ',
        pastille(libelle('PROVENANCE', d.statut), VARIANTE_PROVENANCE[d.statut] ?? 'gris')))),
    calc.manquants.length === 0 ? null : h('p', { classe: 'meta' }, `Ce qui manque : ${calc.manquants.join(', ')}.`));
}

function sectionIngredients(etat, c, calc) {
  if (c.type !== 'preparation_maison') return null;
  const recette = c.recetteId ? etat.recettes[c.recetteId] : null;
  return h('section', { classe: 'carte fiche-bloc' },
    h('h2', { classe: 'fiche-titre-bloc' }, 'Ingrédients recalculés'),
    calc.ingredients
      ? h('ul', { classe: 'fiche-ingredients' }, calc.ingredients.map((i) => h('li', null, h('span', null, i.nom), h('span', { classe: 'fiche-qte' }, quantite(i.quantite, i.unite)))))
      : ligneVide(recette ? (recette.valide ? 'Recette validée, mais rendement ou quantités inutilisables.' : 'Recette liée non validée : ingrédients non calculés.')
        : 'Aucune recette liée : ingrédients non calculés.'),
    recette ? h('p', { classe: 'meta' }, `Recette : ${recette.nom}, version ${recette.version}${recette.valide ? ', validée' : ', non validée'}`) : null);
}

function sectionEtapes(etapes) {
  return h('section', { classe: 'carte fiche-bloc' },
    h('h2', { classe: 'fiche-titre-bloc' }, 'Étapes'),
    etapes.length === 0 ? ligneVide('Aucune étape de préparation définie dans la règle.')
      : h('ol', { classe: 'liste-simple fiche-etapes' }, etapes.map((x) => h('li', null,
        h('strong', null, x.libelle), ' ', pastille(libelle('ETAT_TACHE', x.etat), VARIANTE_ETAPE[x.etat] ?? 'gris')))));
}

function sectionAllergenes(etat, c) {
  const s = statutAllergenes(etat, c);
  return h('section', { classe: 'carte fiche-bloc' },
    h('div', { classe: 'fiche-ligne' }, h('h2', { classe: 'fiche-titre-bloc' }, 'Allergènes'),
      s.statut === 'valide' ? pastille('liste validée', 'vert') : pastille('à confirmer', 'ambre')),
    s.liste.length > 0 ? h('p', null, s.statut === 'valide' ? 'Présents : ' : 'Cochés, non validés : ', s.liste.map(libelleAllergene).join(', '))
      : (s.statut === 'valide' ? h('p', { classe: 'meta' }, 'Aucun allergène dans la liste validée.') : null),
    s.raison ? h('p', { classe: 'meta' }, s.raison) : null);
}

/** « Fait » : un toucher (annulable) ; une fois fait, « Corriger le réel » et « Annuler le fait ». Sans production, rien. */
function blocFait(etat, c) {
  const p = principaleDuComposant(etat, c.id);
  if (!p) return null;
  if (p.etat === 'fait') { // l'état affiché d'une tâche faite peut être « écart » : le geste suit l'état enregistré
    return [pastille('fait', 'vert'), bouton('Corriger le réel', () => dialogCorriger(p.id)), bouton('Annuler le fait', () => defaireEnUnToucher(p.id))];
  }
  return bouton('Fait', () => faireEnUnToucher(p.id));
}

export function rendre(etat, id) {
  const c = etat.composants[id];
  const racine = h('div', { classe: 'vue vue-fiche' });
  if (!c) {
    racine.appendChild(h('h1', { classe: 'page-titre' }, 'Composant introuvable'));
    racine.appendChild(h('p', null, 'Ce composant n\'existe plus.'));
    racine.appendChild(h('p', null, lien('#/production', 'Retour à la production')));
    return racine;
  }
  const calc = calculerComposant(etat, id);
  const etapes = etapesComposant(etat, id);
  // Le mode en poste avance étape par étape : il n'a de sens qu'avec au moins deux étapes.
  const poste = etapes.length >= 2 ? h('a', { href: `#/poste/${encodeURIComponent(id)}`, classe: 'btn btn-principal fiche-poste' }, 'Mode en poste') : null;
  const fait = blocFait(etat, c);
  const sections = [
    h('a', { href: `#/production/${c.date}`, classe: 'fiche-retour' }, icone('M15 6l-6 6 6 6'), 'Production'),
    h('header', { classe: 'fiche-entete' }, h('h1', { classe: 'page-titre' }, c.nom),
      h('div', { classe: 'fiche-etiquettes' }, pastille(etiquetteType(c), 'vert'), pastille(c.attribue ? 'attribué au poste' : 'non attribué', c.attribue ? 'gris' : 'ambre'))),
    sectionQuantite(etat, c, calc),
    sectionProvenance(c, calc),
    sectionIngredients(etat, c, calc),
    sectionEtapes(etapes),
    sectionAllergenes(etat, c),
    blocReperes(c.famille, etat),
    (poste || fait) ? h('div', { classe: 'fiche-actions' }, poste, fait) : null,
    repliable(h('strong', null, 'Plus de réglages'), false, sectionsReglages(etat, c, calc), { classe: 'carte fiche-reglages', id: 'fiche-reglages' }),
  ];
  for (const s of sections) if (s) racine.appendChild(s);
  return racine;
}
