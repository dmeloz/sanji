// Jour (feuille quotidienne) : une seule liste de mise en place, dans l'ordre de lecture du poste.
// Menu 1, menu 2, autres tâches, puis « Après service » (avances pour les jours suivants). Une ligne cochable par
// tâche, la quantité et l'état du poids en point focal. Aucun filtre ne cache de tâche ; une tâche faite aujourd'hui
// reste à sa place (cochée, barrée, grisée) ; seules les préparations faites un jour précédent pour plus tard sont repliées ; les décisions sont résumées en 1 à 3 lignes qui mènent au centre « À confirmer » de la même page.

import { ajouterJours, estOuvert, joursEntre, libelleJour, lundiDe } from '../domaine/dates.js';
import { aideRefroidissement, evaluationProduction, feuilleDuJour } from '../domaine/planification.js';
import { libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { ecranAllumePossible } from './ecran-allume.js';
import { bouton, imprimer, encadre, ligneVide, lien, pastille, repliable } from './elements.js';
import { formaterHeure, quantite } from './format.js';
import { activerGlisser } from './glisser.js';
import {
  actionsTache, carteTache, dialogPlanifier, dialogPreparatoire, faireEnUnToucher, defaireEnUnToucher, noeudEvaluation, pastilleCreneau, texteCharge,
} from './taches.js';

export const titre = () => 'Jour';

const MOTIF = {
  a_planifier: 'Jour et créneau à décider.',
  ecart: 'Écart à arbitrer : complément, ajustement ou aucune production supplémentaire.',
};
const COCHABLES = new Set(['a_planifier', 'a_faire', 'en_cours', 'ecart']);
const VARIANTE_ETAT = { a_preciser: 'gris', a_planifier: 'ambre', en_cours: 'vert', ecart: 'rouge' };
const POIDS = { fini: 'quantité finie' };

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
/** « mar. 6 » : jour abrégé et numéro. */
const courtJour = (date) => `${libelleJour(date).slice(0, 3)}. ${Number(date.slice(8))}`;
/** « Lun 5 » pour la barre de jours. */
const puceJour = (date) => `${majuscule(libelleJour(date).slice(0, 3))} ${Number(date.slice(8))}`;
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

// ------------------------------------------------------------------ en-tête

function barreDeJours(date, aujourd) {
  const lundi = lundiDe(date);
  const dates = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  if (!dates.includes(date)) dates.push(date);
  const puce = (d) => h('a', {
    href: `#/jour/${d}`, classe: `jour-puce${d === date ? ' jour-puce-actif' : ''}${d === aujourd ? ' jour-puce-aujourdhui' : ''}`,
    'aria-label': `${libelleJour(d)}${d === aujourd ? ", aujourd'hui" : ''}${d === date ? ', jour affiché' : ''}`,
    'aria-current': d === date ? 'date' : null,
  }, puceJour(d));
  const puces = dates.map(puce);
  // Sur un petit écran la barre défile : le jour affiché doit être visible, pas caché à droite (le samedi).
  setTimeout(() => puces[dates.indexOf(date)]?.scrollIntoView?.({ inline: 'center', block: 'nearest' }), 0);
  return h('nav', { classe: 'jour-barre', 'aria-label': 'Jours de la semaine' },
    h('a', { href: `#/jour/${ajouterJours(lundi, -7)}`, classe: 'jour-puce jour-puce-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
    puces,
    h('a', { href: `#/jour/${ajouterJours(lundi, 7)}`, classe: 'jour-puce jour-puce-fleche', 'aria-label': 'Semaine suivante' }, '›'));
}

function jauge(feuille) {
  const { faites, total } = feuille.avancement;
  if (total === 0) return null;
  return h('div', { classe: 'avancement' },
    h('progress', { classe: 'avancement-barre', value: faites, max: total, 'aria-label': 'Avancement du jour' }),
    h('p', { classe: 'avancement-texte' }, `${faites} sur ${total} fait${faites >= 2 ? 's' : ''}`));
}

function enteteJour(date, aujourd, feuille) {
  const { couverts, menus } = feuille.lecture;
  const unMenuSaisi = menus.some((m) => m.intitule !== '');
  let texteCouverts = null;
  if (couverts.total !== null) texteCouverts = pluriel(couverts.total, 'couvert', 'couverts');
  else if (unMenuSaisi) texteCouverts = 'couverts : prévision à saisir';
  return h('header', { classe: 'jour-tete' },
    h('h1', { classe: 'page-titre' }, majuscule(libelleJour(date)), date === aujourd ? [' ', pastille("aujourd'hui", 'vert')] : null),
    h('p', { classe: 'jour-meta' },
      texteCouverts ? h('span', { classe: 'jour-couverts feutre' }, texteCouverts) : null,
      lien(`#/detail/${date}`, 'Prévisions →', 'jour-lien')),
    jauge(feuille));
}

/** Rappel compact des deux menus et des fiches de fonction du jour : des liens vers le détail du jour. */
function rappelMenus(date, feuille) {
  const { menus, fiches } = feuille.lecture;
  const lignes = menus.filter((m) => m.intitule !== '').map((m) => h('li', null,
    h('a', { href: `#/detail/${date}`, classe: 'jour-menu', 'aria-label': `Menu ${m.menu} : ${m.intitule}, ouvrir le détail du jour` },
      h('span', { classe: 'jour-menu-rang feutre' }, `M${m.menu}`), h('span', { classe: 'jour-menu-texte' }, m.intitule))));
  for (const f of fiches) {
    lignes.push(h('li', null, h('a', { href: `#/detail/${date}`, classe: 'jour-menu jour-banquet' },
      h('span', { classe: 'jour-menu-rang feutre' }, 'Banquet'),
      h('span', { classe: 'jour-menu-texte' }, [f.horaire || null, `${Number(f.couverts) || 0} personnes`, f.numero ? `fiche ${f.numero}` : null].filter(Boolean).join(' · ')))));
  }
  return lignes.length === 0 ? null : h('ul', { classe: 'jour-menus' }, lignes);
}

// ------------------------------------------------------------------ une ligne de mise en place

/** Case à cocher : « Fait » en un toucher, annulable (le message propose d'annuler pendant deux minutes). */
function caseFait(l) {
  return h('button', {
    type: 'button', role: 'checkbox', 'aria-checked': 'false', classe: 'case-fait',
    onClick: () => faireEnUnToucher(l.productionId),
  }, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }), h('span', { classe: 'sr' }, `Marquer fait : ${l.genre === 'principale' ? l.nom : (l.libelle || l.nom)}`));
}

/** Case cochée d'une tâche faite : la toucher la décoche (annulerFait ; un refus est dit en texte, rien ne change). */
const caseFaite = (l) => h('button', {
  type: 'button', role: 'checkbox', 'aria-checked': 'true', classe: 'case-fait case-fait-ok',
  onClick: () => defaireEnUnToucher(l.productionId),
}, h('span', { classe: 'case-fait-boite', 'aria-hidden': 'true' }, '✓'),
h('span', { classe: 'sr' }, `Marquer non fait : ${l.genre === 'principale' ? l.nom : (l.libelle || l.nom)}`));

function texteQuantite(etat, l) {
  const p = etat.productions[l.productionId];
  if (l.genre === 'preparatoire') return null;
  if (p?.etat === 'fait') return Number.isFinite(l.quantiteReelle) ? quantite(l.quantiteReelle, l.unite) : null;
  return l.cible !== null ? quantite(l.cible, l.unite) : null;
}

function poidsDe(l) {
  if (!l.etatPoids) return null;
  return POIDS[l.etatPoids] ?? `poids ${libelle('ETAT_POIDS', l.etatPoids)}`;
}

function badgesEtMeta(l, ev, { groupe }) {
  const meta = [];
  const badges = [];
  if (l.genre === 'preparatoire') meta.push('action préparatoire');
  if (groupe === 'autres' && l.menu) meta.push(`menu ${l.menu}`);
  if (l.creneau) meta.push(libelle('CRENEAU', l.creneau));
  if (l.source === 'attendue' && l.jourDecide) meta.push(`prévu ${libelleJour(l.jourDecide)}`);
  if (l.source === 'suggestion') meta.push('à planifier');
  if (l.avanceJours > 0) {
    meta.unshift(`Pour ${courtJour(l.dateService)}`);
    badges.push(pastille(`Avance J+${l.avanceJours}`, 'gris'));
  }
  if (!l.fait && ev && ev.jours > 0 && !ev.autorisee) {
    badges.push(pastille('hors règle', 'ambre'));
    // La cause est dite sur la ligne : une avance d'un jour peut être hors règle (maximum de l'étape dépassé).
    meta.push(ev.alertes.some((a) => /plus de deux jours/.test(a)) ? 'plus de deux jours d\'avance' : 'au-delà du maximum de l\'étape');
  }
  if (l.etat !== 'a_faire' && l.etat !== 'a_preciser' && l.etat !== 'fait') badges.push(pastille(libelle('ETAT_TACHE', l.etat), VARIANTE_ETAT[l.etat] ?? 'gris'));
  return { meta, badges };
}

/**
 * Avertissement de conservation du référentiel (jamais un blocage) : en texte, avec sa provenance sur une ligne.
 * Seulement quand l'avance dépasse la durée de base et que la propriétaire n'a saisi aucune limite.
 */
function avertissementConservation(ev) {
  if (!ev || ev.conservation !== 'referentiel' || !ev.repere?.depasse) return null;
  return h('p', { classe: 'mep-conservation' },
    h('strong', null, 'Attention : '), `${ev.repere.texte}, avance de ${ev.jours} jours. `,
    h('span', { classe: 'mep-provenance' }, ev.repere.provenance));
}

/** Actions de la ligne hors « Fait » (déjà sur la case) : repliées derrière « Actions » pour garder la liste compacte. */
function actionsDeLigne(etat, l, date) {
  const p = etat.productions[l.productionId];
  if (l.source === 'suggestion') {
    const horsRegle = !l.evaluation.autorisee;
    return [
      bouton(horsRegle ? 'Planifier quand même' : 'Planifier', () => dialogPlanifier(l.productionId, 'planifier', { date, creneau: l.creneau ?? undefined }), 'court'),
      horsRegle ? bouton('Noter une action préparatoire', () => dialogPreparatoire(l.composantId), 'court') : null,
    ];
  }
  return actionsTache(l, p).filter((n) => n.textContent !== 'Fait');
}

function ligneTache(etat, ligneBrute, date, options) {
  const l = { ...ligneBrute, avanceJours: ligneBrute.avanceJours ?? Math.max(0, joursEntre(date, ligneBrute.dateService)) };
  const p = etat.productions[l.productionId];
  const fait = p?.etat === 'fait';
  const q = texteQuantite(etat, l);
  // L'évaluation de l'avance (limite d'utilisation, règle) reste lisible, derrière « Actions ».
  const ev = l.evaluation ?? evaluationProduction(etat, l.productionId);
  const { meta, badges } = badgesEtMeta({ ...l, fait }, ev, options);
  if (fait) badges.unshift(pastille('fait', 'gris'));
  if (fait && l.hFait) {
    const avantAujourdhui = l.hFait.slice(0, 10) < date;
    // Une étape faite avant ce jour : « déjà avancé sam. 3 » (le jour où elle a été faite).
    const dejaAvance = l.etapeCle && avantAujourdhui ? `, déjà avancé ${courtJour(l.hFait.slice(0, 10))}`
      : (avantAujourdhui && l.dateService === date ? ', déjà avancé' : '');
    meta.push(`fait le ${formaterHeure(l.hFait)}${dejaAvance}`);
  }
  const poids = poidsDe(l);
  const actions = actionsDeLigne(etat, l, date).filter(Boolean);
  const evaluation = ev && ev.jours > 0 ? noeudEvaluation(ev) : null;
  return h('li', { classe: `mep-ligne mep-${fait ? 'fait' : l.etat}` },
    h('div', { classe: 'mep-principal' },
      fait ? caseFaite(l) : COCHABLES.has(l.etat) ? caseFait(l) : h('span', { classe: 'case-fait case-fait-vide' }),
      h('div', { classe: 'mep-corps' },
        lien(`#/composant/${encodeURIComponent(l.composantId)}`, l.genre === 'principale' ? l.nom : (l.libelle || l.nom), 'tache-nom mep-nom'),
        h('p', { classe: 'mep-meta' }, badges, meta.join(' · ')),
        avertissementConservation(ev)),
      h('div', { classe: 'mep-quantite' },
        q ? h('strong', { classe: 'mep-qte feutre' }, q) : (l.genre === 'preparatoire' ? null : h('span', { classe: 'mep-neutre' }, 'quantité à compléter')),
        q && poids ? h('span', { classe: 'mep-poids' }, poids) : null)),
    actions.length > 0 || evaluation
      ? h('details', { classe: 'mep-plus' }, h('summary', null, 'Actions'), evaluation, h('div', { classe: 'actions' }, actions))
      : null);
}

const LIGNES_VISIBLES = 8;
const estHorsRegle = (l) => !l.fait && Boolean(l.evaluation) && l.evaluation.jours > 0 && !l.evaluation.autorisee;

function bloc(titreTexte, lignes, etat, date, groupe) {
  if (lignes.length === 0) return null;
  // Avances : celles qui sont dans la règle (J+1, J+2) restent dans la liste ; celles qui la dépassent sont repliées en une
  // ligne avec leur compte (jamais cachées, jamais décidées à la place du chef), pour ne pas allonger la feuille de travail.
  const horsRegle = groupe === 'apres' ? lignes.filter(estHorsRegle) : [];
  const dansLaRegle = groupe === 'apres' ? lignes.filter((l) => !estHorsRegle(l)) : lignes;
  const liste = (ls) => h('ul', { classe: 'mep-liste' }, ls.map((l) => ligneTache(etat, l, date, { groupe })));
  // Page courte : au-delà de 8 lignes de travail, la suite se replie sous « Voir les N autres » (un compte et un toucher).
  const visibles = dansLaRegle.slice(0, LIGNES_VISIBLES);
  const suite = dansLaRegle.slice(LIGNES_VISIBLES);
  const aideApres = groupe === 'apres' ? aideRefroidissement() : null;
  return h('section', { classe: 'jour-bloc' },
    h('h2', { classe: 'section-titre' }, titreTexte),
    aideApres ? h('p', { classe: 'aide mep-aide-froid' }, aideApres) : null,
    visibles.length > 0 ? liste(visibles) : null,
    suite.length > 0 ? repliable(`Voir les ${suite.length} autres`, false, liste(suite), { classe: 'jour-hors-regle' }) : null,
    horsRegle.length > 0 ? repliable(`${horsRegle.length === 1 ? '1 avance hors règle' : `${horsRegle.length} avances hors règle`}`,
      false, liste(horsRegle), { classe: 'jour-hors-regle' }) : null);
}

// ------------------------------------------------------------------ décisions, quantités, lots, charge

/** Résumé de 1 à 3 décisions qui changent le travail ; le bouton ouvre le centre « À confirmer » plus bas. */
function resumeDecisions(decisions, centre) {
  if (decisions.length === 0) return null;
  const aller = () => { centre.open = true; centre.scrollIntoView?.({ block: 'start' }); };
  return h('section', { classe: 'jour-decisions', 'aria-label': 'À confirmer' },
    h('h2', { classe: 'section-titre' }, 'À confirmer'),
    h('ul', { classe: 'jour-decisions-lignes' }, decisions.slice(0, 3).map((d) => h('li', null,
      h('strong', null, d.nom), ` : ${d.motif === 'ecart' ? 'écart à arbitrer' : 'jour et créneau à décider'}`))),
    bouton(`Voir À confirmer (${decisions.length})`, aller, 'court'));
}

/** Centre « À confirmer » : simple liste des décisions de la feuille, avec leurs gestes habituels. */
function centreAConfirmer(etat, decisions) {
  if (decisions.length === 0) return null;
  return repliable(`À confirmer (${decisions.length})`, false,
    decisions.map((t) => carteTache(etat, t, { motif: MOTIF[t.motif] })), { classe: 'jour-centre carte', id: 'a-confirmer' });
}

/** Une quantité inconnue n'est pas une décision : information neutre, une seule rubrique calme. */
function rubriqueQuantites(feuille) {
  const manquants = feuille.quantitesManquantes;
  if (manquants.length === 0) return null;
  const noms = [...new Set(manquants.map((q) => q.nom))];
  const apercu = `${noms.slice(0, 6).join(', ')}${noms.length > 6 ? `, et ${noms.length - 6} autres` : ''}`;
  const premier = manquants.map((q) => q.dateService).sort()[0];
  return h('section', { classe: 'jour-bloc jour-neutre' }, h('h2', { classe: 'section-titre' }, 'Pas encore chiffré'),
    h('p', null, `${noms.length === 1 ? '1 élément n\'a' : `${noms.length} éléments n'ont`} pas encore de quantité : ${apercu}.`),
    h('p', { classe: 'aide' }, 'Rien d\'obligatoire : saisissez les prévisions et les portions quand vous voulez, ou modifiez-les le lendemain. Tout se recalcule.'),
    h('div', { classe: 'actions' },
      lien(`#/menus/${lundiDe(premier)}`, 'Saisir les prévisions', 'btn btn-court'),
      lien('#/reglages', 'Régler les standards maison', 'btn btn-court')));
}

/** Suggestion seulement : une ligne repliable ; la préparation et ses quantités se lisent dans la feuille de chaque tâche. */
function rubriqueLots(feuille) {
  if (feuille.lots.length === 0) return null;
  return repliable(`À faire en une fois : ${pluriel(feuille.lots.length, 'lot possible', 'lots possibles')}`, false, [
    h('p', { classe: 'aide' }, 'Suggestion : la même préparation peut servir plusieurs services dans la limite d\'avance autorisée. Chaque tâche garde sa part et se marque faite séparément.'),
    h('ul', { classe: 'liste-lots' }, feuille.lots.map((l) => h('li', null,
      h('strong', null, l.libelle), ` : ${quantite(l.total, l.unite)} en une fois, pour ${l.productions.map((x) => libelleJour(x.dateService)).join(' et ')} `,
      lien(`#/composant/${encodeURIComponent(l.productions[0].composantId)}`, 'Détail', 'jour-lien')))),
  ], { classe: 'jour-lots' });
}

/** Charge des créneaux : un repli discret, pour ne pas surcharger la liste. */
function chargeDesCreneaux(feuille) {
  const groupes = feuille.aFaire.filter((g) => g.creneau && g.charge && g.taches.length > 0);
  if (groupes.length === 0) return null;
  return repliable('Charge des créneaux', false, groupes.map((g) => h('div', { classe: 'groupe-creneau' },
    h('p', { classe: 'meta' }, `${libelle('CRENEAU', g.creneau)} : ${texteCharge(g.charge)} `,
      g.etatCreneau && g.etatCreneau !== 'libre' ? pastilleCreneau(g.etatCreneau) : null),
    g.charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a)))), { classe: 'jour-charge' });
}

// ------------------------------------------------------------------ la page

export function rendre(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-jour' });
  const feuille = feuilleDuJour(etat, date);
  const { lecture } = feuille;
  racine.appendChild(barreDeJours(date, aujourd));
  racine.appendChild(enteteJour(date, aujourd, feuille));
  const rappel = rappelMenus(date, feuille);
  if (rappel) racine.appendChild(rappel);
  if (!estOuvert(date)) {
    racine.appendChild(h('p', { classe: 'ferme' }, 'fermé'));
    racine.appendChild(h('p', { classe: 'aide' }, 'Le dimanche est non travaillé : aucune tâche. Il reste compté dans le temps de conservation.'));
  }
  if (feuille.revueMiSemaine) {
    racine.appendChild(encadre('info', 'Mardi : revue de mi-semaine après le service, pour les préparations de mercredi à vendredi.'));
  }
  const centre = centreAConfirmer(etat, lecture.decisions);
  const resume = resumeDecisions(lecture.decisions, centre);
  if (resume) racine.appendChild(resume);

  const lignesDeTravail = lecture.service1.length + lecture.service2.length + lecture.autres.length + lecture.apres.length;
  if (lignesDeTravail === 0) {
    racine.appendChild(ligneVide(lecture.pretsPlusTard.length > 0 || feuille.avancement.total > 0 ? 'Tout est fait.' : 'Aucune tâche décidée pour ce jour.'));
  }
  for (const b of [
    bloc('Menu 1 · pour le service du jour', lecture.service1, etat, date, 'service'),
    bloc('Menu 2 · pour le service du jour', lecture.service2, etat, date, 'service'),
    bloc('Autres tâches', lecture.autres, etat, date, 'autres'),
    bloc('Après service · avances pour les jours suivants', lecture.apres, etat, date, 'apres'),
  ]) if (b) racine.appendChild(b);
  if (lecture.pretsPlusTard.length > 0) {
    racine.appendChild(repliable(`Déjà prêt pour plus tard ${lecture.pretsPlusTard.length}`, false,
      h('ul', { classe: 'mep-liste' }, lecture.pretsPlusTard.map((l) => ligneTache(etat, { ...l, etat: 'fait' }, date, { groupe: 'faites' }))),
      { classe: 'jour-faites' }));
  }
  for (const r of [rubriqueQuantites(feuille), rubriqueLots(feuille), chargeDesCreneaux(feuille), centre]) {
    if (r) racine.appendChild(r);
  }
  racine.appendChild(h('div', { classe: 'barre-jour pas-imprime' },
    bouton('Imprimer la feuille du jour', imprimer, 'court'),
    ecranAllumePossible() ? h('span', { classe: 'meta' }, 'L\'écran reste allumé sur cette page.') : null));
  activerGlisser(racine, {
    suivant: () => { location.hash = `#/jour/${ajouterJours(date, 1)}`; },
    precedent: () => { location.hash = `#/jour/${ajouterJours(date, -1)}`; },
  });
  return racine;
}
