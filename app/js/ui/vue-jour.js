// Jour (feuille quotidienne) : à faire, attendu, déjà prêt, décisions, à avancer.

import { ajouterJours, estOuvert, libelleJour, lundiDe } from '../domaine/dates.js';
import { evaluationProduction, feuilleDuJour } from '../domaine/planification.js';
import { decisionsSansDoublon } from '../domaine/tableau-blanc.js';
import { libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { ecranAllumePossible } from './ecran-allume.js';
import { bouton, imprimer, encadre, ligneVide, lien, navigationPeriode, pastille, repliable } from './elements.js';
import { formaterHeure, quantite } from './format.js';
import { activerGlisser } from './glisser.js';
import {
  carteTache, dialogPlanifier, dialogPreparatoire, pastilleCreneau, texteCharge,
} from './taches.js';

export const titre = () => 'Jour';

const MOTIF = {
  a_planifier: 'Jour et créneau à décider.',
  ecart: 'Écart à arbitrer : complément, ajustement ou aucune production supplémentaire.',
};

const rubrique = (titreTexte, ...contenu) => h('section', { classe: 'carte rubrique' }, h('h2', { classe: 'section-titre' }, titreTexte), contenu);

function evaluationSiAvance(etat, productionId) {
  const ev = evaluationProduction(etat, productionId);
  return ev && ev.jours > 0 ? ev : null;
}

function rubriqueAFaire(etat, feuille, date, aujourd) {
  const titreTexte = date === aujourd ? "À faire aujourd'hui" : `À faire le ${libelleJour(date)}`;
  const groupes = feuille.aFaire.filter((g) => g.taches.length > 0);
  const { faites, total } = feuille.avancement;
  const jauge = total > 0 ? h('div', { classe: 'avancement' },
    h('progress', { classe: 'avancement-barre', value: faites, max: total, 'aria-label': 'Avancement du jour' }),
    h('p', { classe: 'avancement-texte' }, `${faites} sur ${total} fait${faites >= 2 ? 's' : ''}`)) : null;
  if (groupes.length === 0) return rubrique(titreTexte, jauge, ligneVide(total > 0 ? 'Tout est fait.' : 'Aucune tâche décidée pour ce jour.'));
  return rubrique(titreTexte, jauge, groupes.map((g) => h('div', { classe: 'groupe-creneau' },
    h('h3', null, g.creneau ? libelle('CRENEAU', g.creneau) : 'Créneau non précisé',
      g.etatCreneau && g.etatCreneau !== 'libre' ? [' ', pastilleCreneau(g.etatCreneau)] : null),
    g.charge ? h('p', { classe: 'meta' }, texteCharge(g.charge)) : null,
    g.charge ? g.charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a)) : null,
    g.taches.map((t) => carteTache(etat, t, { evaluation: evaluationSiAvance(etat, t.productionId) })))));
}

function rubriqueAttendus(etat, feuille) {
  if (feuille.attendus.length === 0) return null;
  return rubrique("Attendu d'un autre jour",
    feuille.attendus.map((t) => carteTache(etat, t, { evaluation: evaluationSiAvance(etat, t.productionId) })));
}

function rubriqueDejaPret(etat, feuille) {
  if (feuille.dejaPret.length === 0) return null;
  return rubrique('Déjà prêt pour le service',
    feuille.dejaPret.map((t) => {
      const p = etat.productions[t.productionId];
      return carteTache(etat, t, {
        evaluation: t.evaluation && t.evaluation.jours > 0 ? t.evaluation : null,
        contenu: p?.hFait ? h('p', { classe: 'meta' }, `fait le ${formaterHeure(p.hFait)}`) : null,
      });
    }));
}

function rubriqueDecisions(etat, feuille) {
  // Une tâche seulement « à planifier » déjà proposée dans « À avancer si possible » n'est pas répétée ici.
  const decisions = decisionsSansDoublon(feuille);
  if (decisions.length === 0) return null;
  return rubrique('Décisions nécessaires', decisions.map((t) => carteTache(etat, t, { motif: MOTIF[t.motif] })));
}

/** Une quantité inconnue n'est pas une décision : une seule rubrique calme, sans obligation, qui renvoie aux saisies. */
function rubriqueQuantites(feuille) {
  const manquants = feuille.quantitesManquantes;
  if (manquants.length === 0) return null;
  const noms = [...new Set(manquants.map((q) => q.nom))];
  const apercu = `${noms.slice(0, 6).join(', ')}${noms.length > 6 ? `, et ${noms.length - 6} autres` : ''}`;
  const premier = manquants.map((q) => q.dateService).sort()[0];
  return rubrique('Pas encore chiffré',
    h('p', null, `${noms.length === 1 ? '1 élément n\'a' : `${noms.length} éléments n'ont`} pas encore de quantité : ${apercu}.`),
    h('p', { classe: 'aide' }, 'Rien d\'obligatoire : saisissez les prévisions et les portions quand vous voulez, ou modifiez-les le lendemain. Tout se recalcule.'),
    h('div', { classe: 'actions' },
      lien(`#/menus/${lundiDe(premier)}`, 'Saisir les prévisions', 'btn btn-court'),
      lien('#/reglages', 'Régler les standards maison', 'btn btn-court')));
}

/** Suggestion seulement : une même préparation pour plusieurs services. Chaque service garde sa part, sa cible et son réel. */
function rubriqueLots(feuille) {
  if (feuille.lots.length === 0) return null;
  return rubrique('À faire en une fois',
    h('p', { classe: 'aide' }, 'Suggestion : la même préparation peut servir plusieurs services dans la limite d\'avance autorisée. Chaque tâche garde sa part et se marque faite séparément.'),
    h('ul', { classe: 'liste-lots' }, feuille.lots.map((l) => h('li', null,
      h('strong', null, l.libelle), ` : ${quantite(l.total, l.unite)} en une fois, pour ${l.productions.map((x) => libelleJour(x.dateService)).join(' et ')}`))));
}

function carteAvance(etat, a, date, horsRegle) {
  return carteTache(etat, a, {
    evaluation: a.evaluation,
    actions: [
      bouton(horsRegle ? 'Planifier quand même' : 'Planifier', () => dialogPlanifier(a.productionId, 'planifier', { date, creneau: a.creneau ?? undefined }), 'court'),
      horsRegle ? bouton('Noter une action préparatoire', () => dialogPreparatoire(a.composantId), 'court') : null,
    ],
  });
}

function rubriqueAAvancer(etat, feuille, date) {
  if (feuille.aAvancer.length === 0) return null;
  const autorisees = feuille.aAvancer.filter((a) => a.evaluation.autorisee);
  const horsRegle = feuille.aAvancer.filter((a) => !a.evaluation.autorisee);
  const creneau = feuille.aAvancer[0].creneau;
  return rubrique('À avancer si possible',
    h('p', { classe: 'meta' }, creneau ? `Créneau libre aujourd'hui : ${libelle('CRENEAU', creneau)}.` : 'Aucun créneau libre ce jour après le service.'),
    autorisees.map((a) => carteAvance(etat, a, date, false)),
    horsRegle.length === 0 ? null : repliable(
      `${horsRegle.length === 1 ? '1 avance hors règle' : `${horsRegle.length} avances hors règle`} (plus de deux jours d'avance)`, false,
      [h('p', { classe: 'aide' }, 'Hors règle : l\'avance ne couvre pas le besoin. Planifiez quand même, ou notez une action préparatoire.'),
        horsRegle.map((a) => carteAvance(etat, a, date, true))]));
}

export function rendre(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-jour' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, libelleJour(date), date === aujourd ? [' ', pastille("aujourd'hui", 'vert')] : null));
  racine.appendChild(navigationPeriode(
    { href: `#/jour/${ajouterJours(date, -1)}`, texte: '‹ Jour précédent' },
    { href: `#/jour/${aujourd}`, texte: "Aujourd'hui" },
    { href: `#/jour/${ajouterJours(date, 1)}`, texte: 'Jour suivant ›' }));
  racine.appendChild(h('div', { classe: 'barre-jour' },
    lien(`#/detail/${date}`, 'Détail du jour : menus, prévisions, fiches'),
    bouton('Imprimer la feuille du jour', imprimer, 'court'),
    ecranAllumePossible() ? h('span', { classe: 'meta pas-imprime' }, 'L\'écran reste allumé sur cette page.') : null));
  if (!estOuvert(date)) {
    racine.appendChild(h('p', { classe: 'ferme' }, 'fermé'));
    racine.appendChild(h('p', { classe: 'aide' }, 'Le dimanche est non travaillé : aucune tâche. Il reste compté dans le temps de conservation.'));
  }
  const feuille = feuilleDuJour(etat, date);
  if (feuille.revueMiSemaine) {
    racine.appendChild(encadre('info', 'Mardi : revue de mi-semaine après le service, pour les préparations de mercredi à vendredi.'));
  }
  racine.appendChild(rubriqueAFaire(etat, feuille, date, aujourd));
  for (const r of [rubriqueAttendus(etat, feuille), rubriqueDejaPret(etat, feuille), rubriqueDecisions(etat, feuille),
    rubriqueQuantites(feuille), rubriqueLots(feuille), rubriqueAAvancer(etat, feuille, date)]) {
    if (r) racine.appendChild(r);
  }
  activerGlisser(racine, {
    suivant: () => { location.hash = `#/jour/${ajouterJours(date, 1)}`; },
    precedent: () => { location.hash = `#/jour/${ajouterJours(date, -1)}`; },
  });
  return racine;
}
