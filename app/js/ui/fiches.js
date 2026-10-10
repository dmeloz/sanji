// Fiches de fonction : consultation (tableau blanc), création, modification, répartition, historique.

import { annulerFiche, ajouterAdaptation, confirmerRepartition, creerFiche, modifierFiche } from '../domaine/actions.js';
import { estDateValide } from '../domaine/dates.js';
import { LIBELLES } from '../domaine/statuts.js';
import { agirStrict, etat as etatCourant } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, definitions } from './elements.js';
import { formaterHeure } from './format.js';
import { noter } from './journal-diagnostic.js';
import { confirmer, panneau } from './panneau.js';
import { LIBELLE_MODE, LIBELLE_SERVICE } from './reference.js';
import { blocBuffet } from './reperes-metier.js';

const sommeRepartition = (f) => (Number(f.repartition?.[1]) || 0) + (Number(f.repartition?.[2]) || 0);

/** Texte décrivant le choix de menu d'une fiche et s'il est confirmé ou non. */
export function resumeChoix(f) {
  if (f.mode === 'menu_fixe') return `menu ${f.menuFixe} fixé : ${f.couverts} portions confirmées`;
  if (f.mode === 'choix_libre') {
    const etat = f.statutRepartition === 'confirmee' ? LIBELLES.CERTITUDE.confirmee : LIBELLES.CERTITUDE.provisoire;
    return `choix libre : menu 1 : ${f.repartition?.[1] ?? 0}, menu 2 : ${f.repartition?.[2] ?? 0} (répartition ${etat})`;
  }
  return 'hors menu du jour : aucun besoin menu';
}

/** Vrai si la répartition d'un choix libre ne correspond pas aux couverts. */
export const repartitionIncoherente = (f) => f.mode === 'choix_libre' && sommeRepartition(f) !== Number(f.couverts);

/**
 * Buffet par couvert (repère en lecture seule), visible depuis la fiche elle-même : sans objet pour une fiche annulée,
 * dit « sans objet en menu fixe » pour un menu fixe (les portions sont celles du menu), affiché sinon.
 */
export function buffetDeLaFiche(f) {
  if (f.statut === 'annulee') return null;
  if (f.mode === 'menu_fixe') return h('p', { classe: 'meta' }, 'Buffet par couvert : sans objet en menu fixe.');
  return blocBuffet(f.couverts);
}

/** Détail d'une fiche (lecture) : personnes, horaire, choix, allergies, remarques, version. */
export function ouvrirFiche(ficheId) {
  const f = etatCourant().fiches[ficheId];
  if (!f) return;
  panneau({
    titre: `Fiche ${f.numero || ''}`.trim(),
    lectureSeule: true,
    corps: ({ fermer }) => [
      definitions([
        ['Service', LIBELLE_SERVICE[f.service] ?? f.service],
        ['Horaire', f.horaire || 'non renseigné'],
        ['Personnes', String(f.couverts)],
        ['Choix de menu', resumeChoix(f)],
        ['Allergies', f.allergies.trim() || 'aucune indiquée'],
        ['Remarques', f.remarques.trim() || 'aucune'],
        ['Version', `${f.version}${f.statut === 'annulee' ? ' (annulée)' : ''}`],
      ]),
      repartitionIncoherente(f)
        ? h('p', { classe: 'alerte-texte' }, `La répartition (${sommeRepartition(f)}) ne correspond pas aux couverts (${f.couverts}).`) : null,
      buffetDeLaFiche(f),
      h('div', { classe: 'actions' }, bouton('Modifier la fiche', () => { fermer(); dialogFiche(f, f.date); }, 'court')),
    ],
  });
}

const OPTIONS_MODE = Object.entries(LIBELLE_MODE);

/**
 * Création (fiche = null) ou modification d'une fiche. `prefill` (champs proposés par l'IA, essai) ne sert qu'à préremplir
 * une création ; `surEnregistre(champsEnregistres)` est appelé après l'enregistrement d'une fiche préremplie.
 */
export function dialogFiche(fiche, dateParDefaut, prefill = null, { surEnregistre, doutes = 0 } = {}) {
  const f = fiche;
  const p = f ? null : prefill;
  const form = champs([
    { cle: 'numero', type: 'texte', libelle: 'Identifiant de la fiche', valeur: f?.numero ?? p?.numero ?? '', placeholder: 'numéro ou référence' },
    { cle: 'date', type: 'date', libelle: 'Date', valeur: f?.date ?? p?.date ?? dateParDefaut },
    { cle: 'service', type: 'choix', libelle: 'Service', valeur: f?.service ?? p?.service ?? 'midi', options: [['midi', 'Midi'], ['soir', 'Soir']] },
    { cle: 'horaire', type: 'texte', libelle: 'Horaire', valeur: f?.horaire ?? p?.horaire ?? '', placeholder: 'heure d\'arrivée' },
    { cle: 'couverts', type: 'entier', libelle: 'Couverts (personnes)', valeur: f?.couverts ?? p?.couverts ?? null },
    { cle: 'mode', type: 'choix', libelle: 'Mode', valeur: f?.mode ?? 'menu_fixe', options: OPTIONS_MODE.map(([v, l]) => [v, l[0].toUpperCase() + l.slice(1)]) },
    { cle: 'menuFixe', type: 'choix', libelle: 'Menu fixé', valeur: f?.menuFixe ?? null,
      options: [[null, 'choisir…'], [1, 'Menu 1'], [2, 'Menu 2']] },
    { cle: 'rep1', type: 'entier', libelle: 'Répartition : portions du menu 1', valeur: f?.repartition?.[1] ?? 0 },
    { cle: 'rep2', type: 'entier', libelle: 'Répartition : portions du menu 2', valeur: f?.repartition?.[2] ?? 0 },
    { cle: 'allergies', type: 'zone', libelle: 'Allergies', valeur: f?.allergies ?? p?.allergies ?? '', placeholder: 'allergies signalées pour le groupe' },
    { cle: 'remarques', type: 'zone', libelle: 'Remarques', valeur: f?.remarques ?? p?.remarques ?? '', placeholder: 'remarques' },
  ]);
  const afficher = () => {
    const mode = form.valeur('mode');
    form.montrer('menuFixe', mode === 'menu_fixe');
    form.montrer('rep1', mode === 'choix_libre');
    form.montrer('rep2', mode === 'choix_libre');
  };
  form.surChangement('mode', afficher);
  afficher();
  panneau({
    titre: f ? `Modifier la fiche ${f.numero || ''}`.trim() : 'Nouvelle fiche de fonction',
    corps: [
      f ? h('p', { classe: 'aide' }, 'Chaque modification crée une nouvelle version et remplace l\'ancien besoin, sans double comptage.') : null,
      p ? h('p', { classe: 'aide' }, 'Lu par l\'IA (essai) : relisez chaque champ contre la fiche papier avant d\'enregistrer.') : null,
      // Une fiche lue par l'IA : les allergies sont toujours à relire contre la fiche papier, qu'elles aient été lues ou non.
      p ? h('p', { classe: 'aide' }, p.allergies ? 'Allergies : texte à confirmer, jamais interprété.' : 'Allergies : rien n\'a été lu, vérifiez la fiche papier.') : null,
      p && doutes > 0 ? h('p', { classe: 'aide' }, `${doutes} passage${doutes > 1 ? 's' : ''} illisible${doutes > 1 ? 's' : ''} ou refusé${doutes > 1 ? 's' : ''} : complétez à la main.`) : null,
      ...form.noeuds,
    ],
    surEnregistrer: () => {
      const v = form.lire();
      if (!estDateValide(v.date)) throw new Error('Choisissez la date de la fiche.');
      const champsFiche = {
        numero: v.numero.trim(), date: v.date, service: v.service, horaire: v.horaire.trim(), couverts: v.couverts ?? 0,
        mode: v.mode, menuFixe: v.mode === 'menu_fixe' ? v.menuFixe : null,
        allergies: v.allergies, remarques: v.remarques,
      };
      if (v.mode === 'choix_libre') champsFiche.repartition = { 1: v.rep1 ?? 0, 2: v.rep2 ?? 0 };
      agirStrict((e, t) => (f ? modifierFiche(e, f.id, champsFiche, t) : creerFiche(e, champsFiche, t)));
      noter('fiche_enregistree', { viaIA: p !== null });
      if (p) surEnregistre?.(champsFiche);
    },
  });
}

/** « Confirmer la répartition » : le choix réel du groupe remplace la répartition provisoire. */
export function dialogRepartition(ficheId) {
  const f = etatCourant().fiches[ficheId];
  const form = champs([
    { cle: 'rep1', type: 'entier', libelle: 'Portions du menu 1', valeur: f.repartition?.[1] ?? 0 },
    { cle: 'rep2', type: 'entier', libelle: 'Portions du menu 2', valeur: f.repartition?.[2] ?? 0 },
  ]);
  panneau({
    titre: `Confirmer la répartition ${f.numero || ''}`.trim(),
    corps: [h('p', null, `Couverts de la fiche : ${f.couverts}.`), ...form.noeuds],
    libelleEnregistrer: 'Confirmer la répartition',
    surEnregistrer: () => {
      const v = form.lire();
      agirStrict((e, t) => confirmerRepartition(e, ficheId, { 1: v.rep1 ?? 0, 2: v.rep2 ?? 0 }, t));
    },
  });
}

/** Historique des versions d'une fiche. */
export function dialogHistorique(ficheId) {
  const f = etatCourant().fiches[ficheId];
  panneau({
    titre: `Historique de la fiche ${f.numero || ''}`.trim(),
    lectureSeule: true,
    corps: [h('ul', { classe: 'liste-simple' },
      [...f.historique].reverse().map((x) => h('li', null, `version ${x.version} · ${formaterHeure(x.h)} · ${x.resume}`)))],
  });
}

export function confirmerAnnulation(ficheId) {
  const f = etatCourant().fiches[ficheId];
  confirmer({
    titre: 'Annuler cette fiche ?',
    texte: `La fiche ${f.numero || ''} reste consultable, mais son besoin disparaît du calcul.`,
    libelleOk: 'Annuler la fiche', danger: true,
    action: () => { agirStrict((e, t) => annulerFiche(e, ficheId, t)); },
  });
}

/** « Noter une adaptation décidée » : texte libre, tracé. */
export function dialogAdaptation(ficheId) {
  const f = etatCourant().fiches[ficheId];
  const form = champs([{ cle: 'texte', type: 'zone', libelle: 'Adaptation décidée', placeholder: 'ce qui a été décidé avec le client',
    aide: 'Décision humaine, notée avec la date et l\'heure. L\'application ne tranche pas.' }]);
  panneau({
    titre: `Adaptation : fiche ${f.numero || ''}`.trim(),
    corps: form.noeuds,
    surEnregistrer: () => { agirStrict((e, t) => ajouterAdaptation(e, ficheId, form.valeur('texte'), t)); },
  });
}

