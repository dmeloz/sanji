// Feuilles « Couverts midi » et « Ventes du midi » (refonte 2, décision du 2026-10-07 « Couverts du midi et répartition des menus »).
// Couverts midi : le chef saisit UN total (− / + ou 40, 50, 60, 70, 80) ; la répartition menu 1 / menu 2 est calculée (moyenne des 3 derniers
// jours identiques, sinon 1/3 – 2/3) ; il peut la corriger (« décidé par vous ») et revenir au calcul. « Détail du calcul » est replié.
// « Enregistrer » écrit les prévisions des deux menus (le total porte la certitude « provisoire ») : la production du jour se recalcule.
// Ventes du midi : après le service, M1 et M2 servis (le réel du jour, qui nourrit la moyenne). Aucune logique métier ici :
// tout vient de domaine/couverts-midi.js et de ses actions.

import { definirCouvertsMidi } from '../domaine/actions-couverts.js';
import { saisirVentes } from '../domaine/actions.js';
import { COUVERTS_RAPIDES, apercuCouverts, couvertsMidiDuJour, repartitionCalculee } from '../domaine/couverts-midi.js';
import { libelleJour } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { agirStrict, aujourdhui, etat as etatCourant } from '../magasin.js';
import { h } from './dom.js';
import { qteNoeuds, quantite } from './format.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const pluriel = (n, un, plusieurs) => `${n} ${n >= 2 ? plusieurs : un}`;

/** La feuille actuellement ouverte : on interroge son état réel (`open`), car `close` n'est signalé qu'un peu plus tard par le navigateur. */
let feuilleCourante = null;

/** Bouton rond − / + : 44 px au moins, nom accessible dit ce qu'il fait. */
function pas(symbole, nom, surClic, desactive = false) {
  return h('button', { type: 'button', classe: 'btn cv-pas', 'aria-label': nom, disabled: desactive, onClick: surClic }, symbole);
}

/** Pose la feuille : un seul exemplaire ouvert à la fois, le focus revient à l'appelant à la fermeture. */
function ouvrirFeuille({ titre, corps, surEnregistrer, libelleAnnuler = 'Annuler', extras = [] }) {
  if (typeof document === 'undefined' || feuilleCourante?.open) return null;
  const appelant = document.activeElement ?? null;
  const dialogue = panneau({ titre, corps, surEnregistrer, libelleAnnuler, extras });
  dialogue.className = `${dialogue.className} feuille-decisions feuille-couverts`;
  feuilleCourante = dialogue;
  dialogue.addEventListener('close', () => {
    if (appelant && appelant.isConnected !== false) appelant.focus?.();
  });
  return dialogue;
}

// ------------------------------------------------------------------ Couverts midi

/** Phrase « Détail du calcul » : la proportion utilisée, dite avec sa base (historique ou point de départ). */
function phraseBase(apercu) {
  if (apercu.base === 'historique') {
    return `Proportion : moyenne des ${apercu.jours.length} derniers ${libelleJour(apercu.jours[0]).split(' ')[0]}s servis (menu 1 : ${Math.round(apercu.part * 100)} %).`;
  }
  return 'Proportion : au départ, 1/3 menu 1 et 2/3 menu 2, tant que 3 jours identiques n\'ont pas de ventes saisies.';
}

/** Ligne « menu 1 · plat · 20 × 100 g = 2 000 g » du détail : un composant au poste, avec la portion que le calcul a utilisée. */
function ligneFormule(c) {
  const portion = c.portion ? `${c.portion.valeur} ${c.portion.unite}${c.portion.etat ? ` ${c.portion.etat.replace('_', ' ')}` : ''}` : null;
  const resultat = c.quantite !== null ? quantite(c.quantite, c.unite) : null;
  return h('li', { classe: 'cv-formule' },
    h('span', { classe: 'au-sous' }, `menu ${c.menu} · ${c.nom}`),
    h('span', { classe: 'cv-calcul' }, portion && resultat
      ? [h('span', { classe: 'au-qte' }, String(c.couverts)), ' × ', h('span', { classe: 'au-qte' }, portion), ' = ', h('span', { classe: 'au-qte' }, qteNoeuds(resultat))]
      : [h('span', { classe: 'au-qte' }, String(c.couverts)), ' portions · quantité à compléter']));
}

/** Les fiches de fonction du jour : lien vers le détail du jour (leur gestion reste dans Semaine). */
function lignesFiches(etat, date, fermer) {
  const actives = Object.values(etat.fiches ?? {}).filter((f) => f.statut === 'active' && f.date === date);
  return actives.map((f) => h('a', { href: `#/production/${date}`, classe: 'cv-fiche', onClick: fermer },
    h('span', { classe: 'cv-fiche-texte' }, h('span', { classe: 'nom' }, `Fiche de fonction · ${f.numero || 'sans numéro'}`),
      h('span', { classe: 'au-sous' }, `${pluriel(Number(f.couverts) || 0, 'pers.', 'pers.')}${f.horaire ? ` · ${f.horaire}` : ''}`))));
}

/**
 * Ouvre la feuille « Couverts midi » du jour `date` (aujourd'hui, ou le jour choisi dans Semaine).
 * @param {string} date AAAA-MM-JJ, un jour à menu du jour
 */
export function ouvrirCouvertsMidi(date) {
  const depart = couvertsMidiDuJour(etatCourant(), date);
  const etat = { total: depart.total, m1Manuel: depart.manuel ? depart.m1 : null, detailOuvert: false };
  const zone = h('div', { classe: 'cv-zone', 'aria-live': 'polite' });
  let dialogue = null;
  const fermer = () => dialogue?.close();

  /** Répartition affichée : la correction du chef si elle existe (bornée au total), sinon le calcul. */
  const repartition = () => {
    const total = etat.total ?? 0;
    // Total inchangé et répartition calculée déjà enregistrée : on montre celle qui est enregistrée (pas un nouveau calcul qui la modifierait en silence).
    if (etat.m1Manuel === null && depart.total !== null && total === depart.total && depart.m1 !== null && depart.m2 !== null) {
      return { m1: depart.m1, m2: depart.m2, manuel: false };
    }
    if (etat.m1Manuel !== null) {
      const m1 = Math.min(etat.m1Manuel, total);
      return { m1, m2: total - m1, manuel: true };
    }
    const calcul = repartitionCalculee(etatCourant(), date, total);
    return { m1: calcul.m1, m2: calcul.m2, manuel: false };
  };

  const dessiner = () => {
    const e = etatCourant();
    const total = etat.total ?? 0;
    const r = repartition();
    const regler = (valeur) => { etat.total = Math.max(0, valeur); dessiner(); };
    const intitule = (menu) => String(jourOuVide(e, date).menus[menu].intitule ?? '').trim();
    const apercu = etat.total === null ? null : apercuCouverts(e, date, total, r.manuel ? { 1: r.m1, 2: r.m2 } : null);
    const blocTotal = h('div', { classe: 'cv-total' },
      h('div', { classe: 'cv-total-ligne' },
        pas('−', 'Un couvert de moins', () => regler(total - 1), total <= 0),
        h('span', { classe: 'cv-total-chiffre' }, h('span', { classe: 'cv-grand' }, etat.total === null ? '—' : String(etat.total)), h('span', { classe: 'au-sous' }, 'couverts au total')),
        pas('+', 'Un couvert de plus', () => regler(total + 1))),
      h('div', { classe: 'cv-puces', role: 'group', 'aria-label': 'Choix rapides' },
        COUVERTS_RAPIDES.map((n) => h('button', { type: 'button', classe: 'btn cv-puce', 'aria-pressed': etat.total === n ? 'true' : 'false', onClick: () => regler(n) }, String(n)))));
    const blocRepartition = h('div', { classe: 'cv-repartition' },
      h('div', { classe: 'cv-repartition-tete' },
        h('h3', { classe: 'au-etiquette' }, 'Répartition'),
        r.manuel ? h('button', { type: 'button', classe: 'btn btn-lien cv-retour', onClick: () => { etat.m1Manuel = null; dessiner(); } }, 'Revenir au calcul') : null),
      h('div', { classe: 'cv-menu' },
        h('span', { classe: 'cv-menu-texte' }, h('span', { classe: 'nom' }, 'Menu 1'), h('span', { classe: 'au-sous' }, intitule(1) || 'menu non saisi')),
        h('span', { classe: 'cv-menu-pas' },
          pas('−', 'Un couvert du menu 1 vers le menu 2', () => { etat.m1Manuel = r.m1 - 1; dessiner(); }, r.m1 <= 0),
          h('span', { classe: 'cv-moyen' }, String(r.m1)),
          pas('+', 'Un couvert du menu 2 vers le menu 1', () => { etat.m1Manuel = r.m1 + 1; dessiner(); }, r.m2 <= 0))),
      h('div', { classe: 'cv-menu' },
        h('span', { classe: 'cv-menu-texte' }, h('span', { classe: 'nom' }, 'Menu 2'), h('span', { classe: 'au-sous' }, intitule(2) || 'menu non saisi')),
        h('span', { classe: 'cv-menu-pas cv-menu-pas-fin' }, h('span', { classe: 'cv-moyen' }, String(r.m2)))));
    const blocDetail = h('div', { classe: 'cv-detail' },
      h('button', { type: 'button', classe: 'cv-detail-bouton', 'aria-expanded': etat.detailOuvert ? 'true' : 'false', onClick: () => { etat.detailOuvert = !etat.detailOuvert; dessiner(); } },
        h('span', { classe: 'cv-etiquettes' },
          h('span', { classe: `cv-etiquette${r.manuel ? ' cv-etiquette-chef' : ''}` }, r.manuel ? 'décidé par vous' : 'calculé'),
          h('span', { classe: 'cv-etiquette' }, 'provisoire'),
          h('span', { classe: 'au-sous' }, 'Détail du calcul')),
        h('span', { classe: `cv-chevron${etat.detailOuvert ? ' cv-chevron-ouvert' : ''}`, 'aria-hidden': 'true' }, '⌄')),
      etat.detailOuvert && apercu ? h('div', { classe: 'cv-detail-corps' },
        h('p', { classe: 'au-sous' }, r.manuel ? 'Répartition corrigée à la main.' : phraseBase(apercu)),
        h('ul', { classe: 'cv-formules' }, apercu.composants.map(ligneFormule)),
        h('p', { classe: 'au-sous' }, 'La production suit ces couverts. Les autres jours gardent leur propre prévision.')) : null);
    zone.replaceChildren(
      h('p', { classe: 'au-sous cv-surtitre' }, `${majuscule(libelleJour(date))} · ${date === aujourdhui() ? 'seulement aujourd\'hui' : 'midi'}`),
      blocTotal, blocRepartition, blocDetail, ...lignesFiches(e, date, fermer));
  };
  dessiner();

  dialogue = ouvrirFeuille({
    titre: 'Couverts midi',
    corps: [zone],
    surEnregistrer: () => {
      if (etat.total === null) throw new Error('Saisissez le total des couverts.');
      const r = repartition();
      agirStrict((x, t) => definirCouvertsMidi(x, date, { total: etat.total, repartition: r.manuel ? { 1: r.m1, 2: r.m2 } : null }, t));
      afficherMessage(`Production du jour recalculée · ${pluriel(etat.total, 'couvert', 'couverts')}`, 'ok');
    },
  });
}

// ------------------------------------------------------------------ Ventes du midi

/** Pas de ventes saisies : le départ est 0, jamais le prévu (le réel se compte, il ne se devine pas). */
const venteDepart = (valeur) => (Number.isFinite(valeur) ? valeur : 0);

/**
 * Ouvre « Ventes du midi » : ce qui a vraiment été servi (M1, M2). C'est le réel du jour : il nourrit la moyenne des 3 derniers jours
 * identiques. « Plus tard » ferme sans rien enregistrer.
 * @param {string} date AAAA-MM-JJ, un jour à menu du jour
 */
export function ouvrirVentesMidi(date) {
  const e = etatCourant();
  const jour = jourOuVide(e, date);
  const valeurs = { 1: venteDepart(jour.ventes[1]), 2: venteDepart(jour.ventes[2]) };
  const zone = h('div', { classe: 'cv-zone', 'aria-live': 'polite' });
  const dessiner = () => {
    const ligne = (menu) => h('div', { classe: 'cv-menu' },
      h('span', { classe: 'cv-menu-texte' }, h('span', { classe: 'nom' }, `Menu ${menu}`),
        h('span', { classe: 'au-sous' }, Number.isFinite(jour.previsions[menu].portions) ? `prévu ${jour.previsions[menu].portions}` : 'pas de prévision')),
      h('span', { classe: 'cv-menu-pas' },
        pas('−', `Une vente de moins au menu ${menu}`, () => { valeurs[menu] = Math.max(0, valeurs[menu] - 1); dessiner(); }, valeurs[menu] <= 0),
        h('span', { classe: 'cv-moyen' }, String(valeurs[menu])),
        pas('+', `Une vente de plus au menu ${menu}`, () => { valeurs[menu] += 1; dessiner(); })));
    zone.replaceChildren(
      h('p', { classe: 'au-sous cv-surtitre' }, `${majuscule(libelleJour(date))} · après le service`),
      h('p', null, 'Ce qui a vraiment été servi. C\'est le réel du jour : il nourrit la moyenne des 3 derniers jours identiques.'),
      h('div', { classe: 'cv-repartition' }, ligne(1), ligne(2)),
      h('div', { classe: 'cv-servi' }, h('span', { classe: 'au-sous' }, 'Total servi'), h('span', { classe: 'cv-moyen' }, String(valeurs[1] + valeurs[2]))));
  };
  dessiner();
  ouvrirFeuille({
    titre: 'Ventes du midi',
    corps: [zone],
    libelleAnnuler: 'Plus tard',
    extras: [{ libelle: 'Modifier les couverts', action: (api) => { api.fermer(); ouvrirCouvertsMidi(date); } }],
    surEnregistrer: () => {
      // Un 0 / 0 jamais touché n'est pas une vente : il fausserait la moyenne des 3 derniers jours identiques.
      if (valeurs[1] + valeurs[2] === 0 && !Number.isFinite(jour.ventes[1]) && !Number.isFinite(jour.ventes[2])) throw new Error('Saisissez au moins une vente, ou fermez avec « Plus tard ».');
      agirStrict((x, t) => { saisirVentes(x, date, 1, valeurs[1], t); saisirVentes(x, date, 2, valeurs[2], t); });
      afficherMessage(`Ventes enregistrées · ${pluriel(valeurs[1] + valeurs[2], 'couvert servi', 'couverts servis')}`, 'ok');
    },
  });
}
