// Jour (feuille quotidienne) : à faire, attendu, déjà prêt, décisions, à avancer.

import { ajouterJours, estOuvert, libelleJour } from '../domaine/dates.js';
import { evaluationProduction, feuilleDuJour } from '../domaine/planification.js';
import { decisionsSansDoublon } from '../domaine/tableau-blanc.js';
import { libelle } from '../domaine/statuts.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { bouton, encadre, ligneVide, lien, navigationPeriode, pastille } from './elements.js';
import { formaterHeure } from './format.js';
import {
  carteTache, dialogPlanifier, dialogPreparatoire, pastilleCreneau, texteCharge,
} from './taches.js';

export const titre = () => 'Jour';

const MOTIF = {
  a_preciser: 'Quantité à préciser.',
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
  if (groupes.length === 0) return rubrique(titreTexte, ligneVide('Aucune tâche décidée pour ce jour.'));
  return rubrique(titreTexte, groupes.map((g) => h('div', { classe: 'groupe-creneau' },
    h('h3', null, g.creneau ? libelle('CRENEAU', g.creneau) : 'Créneau non précisé',
      g.etatCreneau && g.etatCreneau !== 'libre' ? [' ', pastilleCreneau(g.etatCreneau)] : null),
    g.charge ? h('p', { classe: 'meta' }, texteCharge(g.charge)) : null,
    g.charge ? g.charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a)) : null,
    g.taches.map((t) => carteTache(etat, t, { evaluation: evaluationSiAvance(etat, t.productionId) })))));
}

function rubriqueAttendus(etat, feuille) {
  return rubrique("Attendu d'un autre jour", feuille.attendus.length === 0
    ? ligneVide('Rien d\'attendu d\'un autre jour.')
    : feuille.attendus.map((t) => carteTache(etat, t, { evaluation: evaluationSiAvance(etat, t.productionId) })));
}

function rubriqueDejaPret(etat, feuille) {
  return rubrique('Déjà prêt pour le service', feuille.dejaPret.length === 0
    ? ligneVide('Rien de prêt pour l\'instant.')
    : feuille.dejaPret.map((t) => {
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
  return rubrique('Décisions nécessaires', decisions.length === 0
    ? ligneVide('Aucune décision en attente.')
    : decisions.map((t) => carteTache(etat, t, { motif: MOTIF[t.motif] })));
}

function rubriqueAAvancer(etat, feuille, date) {
  if (feuille.aAvancer.length === 0) return rubrique('À avancer si possible', ligneVide('Rien à avancer pour le moment.'));
  return rubrique('À avancer si possible', feuille.aAvancer.map((a) => {
    const ev = a.evaluation;
    const horsRegle = !ev.autorisee;
    return carteTache(etat, a, {
      evaluation: ev,
      contenu: [
        h('p', { classe: 'meta' }, a.creneau ? `Créneau libre aujourd'hui : ${libelle('CRENEAU', a.creneau)}.` : 'Aucun créneau libre ce jour après le service.'),
        horsRegle ? h('p', { classe: 'aide' }, 'Hors règle : cette avance ne couvre pas le besoin. Notez une action préparatoire, ou laissez la tâche à décider.') : null,
      ],
      actions: [
        bouton(horsRegle ? 'Planifier quand même' : 'Planifier', () => dialogPlanifier(a.productionId, 'planifier', { date, creneau: a.creneau ?? undefined }), 'court'),
        horsRegle ? bouton('Noter une action préparatoire', () => dialogPreparatoire(a.composantId), 'court') : null,
      ],
    });
  }));
}

export function rendre(etat, date) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'vue vue-jour' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, libelleJour(date), date === aujourd ? [' ', pastille("aujourd'hui", 'vert')] : null));
  racine.appendChild(navigationPeriode(
    { href: `#/jour/${ajouterJours(date, -1)}`, texte: '‹ Jour précédent' },
    { href: `#/jour/${aujourd}`, texte: "Aujourd'hui" },
    { href: `#/jour/${ajouterJours(date, 1)}`, texte: 'Jour suivant ›' }));
  racine.appendChild(h('p', null, lien(`#/detail/${date}`, 'Détail du jour : menus, prévisions, fiches')));
  if (!estOuvert(date)) {
    racine.appendChild(h('p', { classe: 'ferme' }, 'fermé'));
    racine.appendChild(h('p', { classe: 'aide' }, 'Le dimanche est non travaillé : aucune tâche. Il reste compté dans le temps de conservation.'));
  }
  const feuille = feuilleDuJour(etat, date);
  if (feuille.revueMiSemaine) {
    racine.appendChild(encadre('info', 'Mardi : revue de mi-semaine après le service, pour les préparations de mercredi à vendredi.'));
  }
  racine.appendChild(rubriqueAFaire(etat, feuille, date, aujourd));
  racine.appendChild(rubriqueAttendus(etat, feuille));
  racine.appendChild(rubriqueDejaPret(etat, feuille));
  racine.appendChild(rubriqueDecisions(etat, feuille));
  racine.appendChild(rubriqueAAvancer(etat, feuille, date));
  return racine;
}
