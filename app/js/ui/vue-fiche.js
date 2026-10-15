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
import { bouton, ligneFeuille, ligneVide, lien, pastille } from './elements.js';
import { pluriel, precisionQuantite, qteNoeuds, quantiteNoeuds } from './format.js';
import { libelleAllergene } from './reference.js';
import { blocCommentCalcule } from './comment-calcule.js';
import { blocReperes } from './reperes-metier.js';
import { defaireEnUnToucher, dialogCorriger, faireEnUnToucher } from './taches.js';
import { CATEGORIES_MOT } from '../domaine/mots-retenus.js';
import { estSauceAConfirmer } from '../domaine/etat.js';
import { cleDeNom, ficheDe, nomCorrect } from '../domaine/fiches-retenues.js';
import { blocCorrigerNom } from './corriger-nom.js';
import { blocEnseigner, blocFicheElement, suggestionDe } from './enseigner-mot.js';
import { ouvrirFicheElement } from './feuille-fiche-element.js';
import { boutonPrecisionIA, dialogChoisirSauce, dialogModifier, sectionsReglages } from './vue-composant.js';

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
    const part = calc.statut === 'CALCULE' && calc.uniteTravail !== 'portion' && p.total > 0 && Number.isFinite(calc.quantiteTravail) ? calc.quantiteTravail * (d.portions / p.total) : null;
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
  // Une barre de répartition n'a de sens qu'à partir de deux destinations : seule, elle serait pleine.
  const avecBarre = lignes.length >= 2;
  return h('section', { classe: 'fiche-quantite' },
    h('p', { classe: 'fiche-legende' }, `${jourMeme ? 'À produire aujourd\'hui' : 'À produire'} · pour ${libelleJour(c.date)}`),
    calc.statut === 'CALCULE' && calc.uniteTravail !== 'portion' // jamais « N portions » comme quantité à produire
      ? h('p', { classe: 'fiche-qte-grande' }, quantiteNoeuds(calc.quantiteTravail, calc.uniteTravail), h('small', null, ` ${precisionQuantite(calc)}`))
      : h('p', { classe: 'fiche-qte-grande fiche-qte-inconnue' }, 'à chiffrer'),
    lignes.length === 0 ? h('p', { classe: 'fiche-legende' }, 'Aucune répartition : aucune portion saisie pour ce menu.')
      : h('ul', { classe: 'fiche-repartition' }, lignes.map((l) => h('li', null,
        h('span', { classe: 'fiche-rep-nom' }, l.libelle, h('small', null, ` ${l.certitude}`)),
        avecBarre && l.part !== null ? h('span', { classe: 'fiche-jauge', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(l.ratio * 100)}%` })) : null,
        h('span', { classe: 'fiche-qte' }, l.part !== null ? quantiteNoeuds(l.part, calc.uniteTravail) : qteNoeuds(l.portions > 0 ? `à chiffrer · ${pluriel(l.portions, 'couvert')}` : 'à chiffrer'))))),
    h('p', { classe: 'fiche-legende' }, `Calcul : ${calc.formule}`));
}

/**
 * « Portions : 55 portions (hors groupes 40 ; groupes confirmés 10 ; groupes provisoires 5) » : le détail de l'ancienne vue
 * composant, sans énumérer les groupes à 0 (une absence n'est pas une information).
 */
function detailPortions(p) {
  const parties = [`hors groupes ${p.prevision}${p.previsionManquante ? ', non saisie' : ''}`];
  if (p.groupesConfirmes > 0) parties.push(`groupes confirmés ${p.groupesConfirmes}`);
  if (p.groupesProvisoires > 0) parties.push(`groupes provisoires ${p.groupesProvisoires}`);
  return `Portions : ${pluriel(p.total, 'portion')} (${parties.join(' ; ')})`;
}

/** « ven. 2 » : jour abrégé et numéro. */
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;

/**
 * « Brut à prévoir » : toujours là. Connu quand le parage est appliqué, ou quand la carte du haut dit déjà « brut à prévoir »
 * (produit simple : la quantité de travail est le brut) ; sinon dit « inconnu », sans alerte. Jamais deux messages contraires.
 */
function ligneBrut(calc) {
  const connu = calc.statut === 'CALCULE'
    && (calc.etapes.some((e) => e.etape === 'parage' && e.appliquee) || /brut à prévoir/.test(calc.libelleQuantite));
  return h('section', { classe: 'fiche-brut', 'aria-label': 'Brut à prévoir' },
    h('span', { classe: 'fiche-brut-nom' }, 'Brut à prévoir'),
    connu ? h('span', { classe: 'fiche-qte' }, quantiteNoeuds(calc.brut, calc.uniteTravail))
      : h('span', { classe: 'fiche-brut-inconnu' }, h('span', { classe: 'fiche-qte fiche-brut-tiret' }, '—'), ' inconnu · forme achetée à préciser'));
}

function sectionProvenance(etat, c, calc) {
  return h('section', { classe: 'carte fiche-bloc' },
    h('h2', { classe: 'fiche-titre-bloc' }, 'Calcul et provenance'),
    h('p', null, calc.statut === 'CALCULE' ? pastille(libelle('PROVENANCE', 'CALCULE'), 'vert') : pastille(libelle('PROVENANCE', 'INCONNU'), 'gris'), ' ',
      calc.aValider ? pastille(LIBELLE_ESTIMATION_A_VALIDER, 'ambre') : null, ' ',
      calc.standardBase ? pastille(libelle('PROVENANCE', 'STANDARD_BASE'), 'gris') : null, ' ',
      calc.aMesurer ? pastille('à mesurer', 'ambre') : null),
    h('p', { classe: 'meta' }, detailPortions(calc.portions)),
    blocCommentCalcule(etat, c.id),
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
      ? h('ul', { classe: 'fiche-ingredients' }, calc.ingredients.map((i) => h('li', null, h('span', null, i.nom), h('span', { classe: 'fiche-qte' }, quantiteNoeuds(i.quantite, i.unite)))))
      : ligneVide(recette ? (recette.valide ? 'Recette validée, mais rendement ou quantités inutilisables.' : 'Recette liée non validée : ingrédients non calculés.')
        : 'Aucune recette liée : ingrédients non calculés.'),
    recette ? h('p', { classe: 'meta' }, `Recette : ${recette.nom}, version ${recette.version}${recette.valide ? ', validée' : ', non validée'}`) : null);
}

function sectionEtapes(etapes, c) {
  return h('section', { classe: 'carte fiche-bloc' },
    h('h2', { classe: 'fiche-titre-bloc' }, 'Étapes'),
    etapes.length === 0 ? ligneVide('Aucune étape de préparation définie dans la règle.')
      : h('ol', { classe: 'liste-simple fiche-etapes' }, etapes.map((x) => h('li', null,
        h('strong', null, x.libelle), ' ', pastille(libelle('ETAT_TACHE', x.etat), VARIANTE_ETAPE[x.etat] ?? 'gris'),
        x.faitLe && x.faitLe < c.date ? h('span', { classe: 'meta' }, ` · déjà avancé ${courtJour(x.faitLe)}`)
          : (x.jourDecide && x.etat !== 'fait' ? h('span', { classe: 'meta' }, ` · prévu ${courtJour(x.jourDecide)}`) : null)))));
}

/** G5 : préparation maison sans recette ni étape. La quantité reste juste ; rien n'est inventé. */
function blocSansRecette(c) {
  const ligne = (nom, valeur) => h('div', { classe: 'fiche-ligne' }, h('span', null, nom), h('span', { classe: 'discret' }, valeur));
  return h('section', { classe: 'fiche-sans-recette' },
    ligne('Recette', 'non saisie'), ligne('Étapes', 'aucune'),
    h('p', { classe: 'aide' }, 'Les quantités viennent des couverts et des standards ; elles restent justes sans recette. Le mode en poste apparaîtra avec les étapes.'),
    h('div', { classe: 'fiche-actions' }, bouton('Ajouter la recette', () => dialogModifier(c), 'principal')));
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

/** Étiquette de l'élément : un élément seulement proposé par la lecture dit « proposée · à confirmer » (attention), pas son type. */
function etiquetteElement(c) {
  if (suggestionDe(c)) return pastille(`${CATEGORIES_MOT[suggestionDe(c)].toLowerCase()} proposée · à confirmer`, 'ambre');
  return pastille(etiquetteType(c), c.type === 'produit_simple' ? 'gris' : 'vert');
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
  const sansRecette = c.type === 'preparation_maison' && !c.recetteId && etapes.length === 0;
  const sections = [
    h('a', { href: `#/production/${c.date}`, classe: 'fiche-retour' }, icone('M15 6l-6 6 6 6'), 'Production'),
    h('header', { classe: 'fiche-entete' }, h('h1', { classe: 'page-titre' }, c.nom),
      h('div', { classe: 'fiche-etiquettes' }, etiquetteElement(c),
        // Montrer l'exception : « attribué au poste » est la normale et ne s'écrit pas.
        c.attribue ? null : pastille('non attribué', 'ambre'))),
    // Un élément à préciser : le geste « Demander à l'IA » se voit tout de suite, sans ouvrir « Plus de réglages ».
    blocEnseigner(c, () => dialogChoisirSauce(c)),
    blocFicheElement(c, ficheDe(etat, c.nom), () => ouvrirFicheElement(cleDeNom(nomCorrect(etat.noms, c.nom) ?? c.nom))),
    estSauceAConfirmer(c) ? null : blocCorrigerNom(c),
    boutonPrecisionIA(c) ? h('div', { classe: 'fiche-actions' }, boutonPrecisionIA(c)) : null,
    sectionQuantite(etat, c, calc),
    ligneBrut(calc),
    sectionProvenance(etat, c, calc),
    sectionIngredients(etat, c, calc),
    sansRecette ? blocSansRecette(c) : sectionEtapes(etapes, c),
    sectionAllergenes(etat, c),
    blocReperes(c.famille, etat),
    (poste || fait) ? h('div', { classe: 'fiche-actions' }, poste, fait) : null,
    ligneFeuille('Plus de réglages', 'Plus de réglages', () => h('div', { classe: 'fiche-reglages-corps' }, sectionsReglages(etat, c, calc)), { classe: 'carte fiche-reglages', id: 'fiche-reglages' }),
  ];
  for (const s of sections) if (s) racine.appendChild(s);
  return racine;
}
