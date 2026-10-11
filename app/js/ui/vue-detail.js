// Détail d'un jour : menus, prévisions, fiches, allergies, créneaux, après service, points à confirmer.

import {
  ajouterComposant, definirCreneau, definirMenu, modifierComposant, saisirVentes, supprimerComposant,
} from '../domaine/actions.js';
import { aMenuDuJour, creneauxDuJour, libelleJour, lundiDe } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { alertesAllergenes } from '../domaine/allergenes.js';
import { chargeCreneau } from '../domaine/planification.js';
import { couvertsMidiDuJour } from '../domaine/couverts-midi.js';
import { pointsAConfirmer } from '../domaine/points.js';
import { CATEGORIE, ETAT_CRENEAU, libelle } from '../domaine/statuts.js';
import { agir, agirStrict, etat as etatCourant, redessiner } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, ligneVide, lien, pastille } from './elements.js';
import {
  confirmerAnnulation, dialogAdaptation, dialogFiche, dialogHistorique, dialogRepartition, repartitionIncoherente, resumeChoix,
} from './fiches.js';
import { boutonLireFiche } from './lecture-fiche.js';
import { ouvrirCouvertsMidi } from './feuille-couverts.js';
import { formaterHeure, pluriel } from './format.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { importerPhoto, retirerPhoto, urlPhoto } from './photo.js';
import { LIBELLE_SERVICE, libelleAllergene } from './reference.js';
import { blocBuffet } from './reperes-metier.js';
import { pastilleCreneau, texteCharge } from './taches.js';

/** Rubrique à plat de la feuille « Détail du jour » : jamais de repli, le titre reste visible. */
const rubrique = (resume, contenu, { classe = '', ...reste } = {}) => h('section', { classe, ...reste }, resume, contenu);

// ------------------------------------------------------------------ photo du menu papier

function blocPhoto(date) {
  const zone = h('div', { classe: 'photo-zone' }, h('p', { classe: 'vide' }, 'Aucune photo du menu papier.'));
  const retirer = bouton('Retirer la photo', () => confirmer({
    titre: 'Retirer la photo ?', texte: 'La photo de ce jour sera supprimée de cet appareil.', libelleOk: 'Retirer', danger: true,
    action: async () => { await retirerPhoto(date); redessiner(); },
  }), 'court', { hidden: true });
  const entree = h('input', {
    type: 'file', accept: 'image/*', classe: 'cache',
    onChange: async (evenement) => {
      const fichier = evenement.target.files?.[0];
      evenement.target.value = '';
      if (!fichier) return;
      try {
        const conservee = await importerPhoto(date, fichier);
        afficherMessage(conservee ? 'Photo enregistrée sur cet appareil.' : 'Photo gardée en mémoire seulement : elle sera perdue à la fermeture.', conservee ? 'ok' : 'alerte');
        redessiner();
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
      }
    },
  });
  // La lecture de la photo est asynchrone : la miniature apparaît quand la photo est trouvée.
  const bloc = rubrique(h('h3', null, 'Menu papier (facultatif)'), [
    h('p', { classe: 'aide' }, 'La photo sert d\'aide pour la saisie ; elle est réduite à 1600 px, gardée sur l\'appareil et n\'est pas exportée.'),
    zone,
    h('div', { classe: 'actions' },
      h('label', { classe: 'btn btn-court' }, 'Prendre ou importer une photo', entree),
      retirer),
  ], { classe: 'sous-carte' });
  urlPhoto(date).then((url) => {
    if (!url) return;
    retirer.hidden = false;
    zone.replaceChildren(
      h('button', { type: 'button', classe: 'photo-miniature', 'aria-label': 'Agrandir la photo du menu papier',
        onClick: () => panneau({ titre: 'Menu papier', lectureSeule: true,
          corps: [h('img', { classe: 'photo-grande', src: url, alt: 'Photo du menu papier' })] }) },
      h('img', { src: url, alt: 'Photo du menu papier (aide à la saisie)' })));
  }).catch(() => {});
  return bloc;
}

// ------------------------------------------------------------------ menus et composants

function dialogIntitule(date, menu) {
  const m = jourOuVide(etatCourant(), date).menus[menu];
  const f = champs([{
    cle: 'intitule', type: 'zone', libelle: `Intitulé exact du menu ${menu}`, valeur: m.intitule, placeholder: 'intitulé du menu',
    aide: 'La fonction « Scanner du texte » d\'iOS peut servir à la saisie. Recopiez l\'intitulé tel qu\'il est écrit : l\'application en tire les composants.',
  }]);
  panneau({
    titre: `Menu ${menu} : intitulé`,
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((e, t) => definirMenu(e, date, menu, f.valeur('intitule'), t)); },
  });
}

const OPTIONS_CATEGORIE = Object.keys(CATEGORIE).map((c) => [c, libelle('CATEGORIE', c)]);

function dialogComposant(date, menu, c) {
  const f = champs([
    { cle: 'nom', type: 'texte', libelle: 'Nom du composant', valeur: c?.nom ?? '', placeholder: 'nom du composant' },
    { cle: 'categorie', type: 'choix', libelle: 'Catégorie', valeur: c?.categorie ?? 'a_preciser', options: OPTIONS_CATEGORIE },
    c ? { cle: 'attribue', type: 'case', libelle: 'Attribué au poste', valeur: c.attribue }
      : { cle: 'attribue', type: 'choix', libelle: 'Attribué au poste', valeur: 'auto',
        options: [['auto', 'laisser l\'application décider'], ['oui', 'oui'], ['non', 'non']] },
  ]);
  panneau({
    titre: c ? `Modifier ${c.nom}` : `Ajouter un composant au menu ${menu}`,
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      if (c) agirStrict((e, t) => modifierComposant(e, c.id, { nom: v.nom, categorie: v.categorie, attribue: v.attribue }, t));
      else {
        const champsNouveau = { nom: v.nom, categorie: v.categorie };
        if (v.attribue !== 'auto') champsNouveau.attribue = v.attribue === 'oui';
        // Un composant ajouté à la main est pris en compte tout de suite : aucune validation à faire ensuite.
        agirStrict((e, t) => { ajouterComposant(e, date, menu, champsNouveau, t); });
      }
    },
  });
}

/** Interrupteur « au poste » : le choix est enregistré aussitôt, et mémorisé par nom par le domaine. */
export function interrupteurAuPoste(c, prefixe = 'poste') {
  const id = `${prefixe}-${c.id}`;
  const dit = (attribue) => (attribue ? 'au poste' : 'hors poste');
  // L'état est écrit dans les deux sens (jamais une coche seule) ; le nom accessible le porte aussi.
  const texte = dit;
  const mot = h('span', { classe: 'interrupteur-etat' }, texte(c.attribue));
  const entree = h('input', {
    type: 'checkbox', role: 'switch', id, classe: 'interrupteur-entree', checked: c.attribue, 'aria-label': `${c.nom}, ${dit(c.attribue)}`,
    onChange: (evenement) => {
      const cible = evenement.target;
      const voulu = cible.checked;
      const r = agir((e, t) => modifierComposant(e, c.id, { attribue: voulu }, t));
      if (!r.ok) cible.checked = !voulu;
      cible.setAttribute('aria-label', `${c.nom}, ${dit(cible.checked)}`);
      mot.textContent = texte(cible.checked);
    },
  });
  return h('label', { classe: 'interrupteur', pour: id }, entree, mot);
}

function ligneComposant(c) {
  return h('li', { classe: 'composant-ligne' },
    h('div', { classe: 'composant-tete' },
      lien(`#/fiche/${encodeURIComponent(c.id)}`, c.nom, 'tache-nom'),
      interrupteurAuPoste(c)),
    h('p', { classe: 'meta' }, libelle('CATEGORIE', c.categorie)),
    h('div', { classe: 'actions' },
      bouton('Modifier', () => dialogComposant(c.date, c.menu, c), 'court'),
      bouton('Supprimer', () => confirmer({
        titre: 'Supprimer ce composant ?', texte: `${c.nom} et ses tâches non faites seront supprimés.`, libelleOk: 'Supprimer', danger: true,
        action: () => { agirStrict((e, t) => supprimerComposant(e, c.id, t)); },
      }), 'court danger')));
}

function blocMenu(etat, date, menu) {
  const m = jourOuVide(etat, date).menus[menu];
  const saisi = m.intitule.trim() !== '';
  const composants = Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  return h('div', { classe: 'sous-carte', id: `menu-${menu}` },
    h('h3', null, `Menu ${menu}`),
    saisi ? h('p', { classe: 'intitule' }, m.intitule) : h('p', { classe: 'vide' }, 'menu non saisi'),
    h('div', { classe: 'actions' },
      bouton(saisi ? 'Modifier l\'intitulé' : 'Saisir l\'intitulé', () => dialogIntitule(date, menu), 'court')),
    composants.length > 0 ? h('ul', { classe: 'liste-composants' }, composants.map((c) => ligneComposant(c))) : (saisi ? ligneVide('Aucun composant : ajoutez-en si besoin.') : null),
    h('div', { classe: 'actions' }, bouton('Ajouter un composant', () => dialogComposant(date, menu, null), 'court')));
}

function sectionMenus(etat, date) {
  const enveloppe = (titreTexte, contenu) => h('section', { classe: 'carte', id: 'menus' }, h('h2', { classe: 'section-titre' }, titreTexte), contenu);
  if (!aMenuDuJour(date)) return enveloppe('Menus', ligneVide('Pas de menu du jour le samedi.'));
  return enveloppe('Menus du jour', [
    h('div', { classe: 'actions' }, lien(`#/import/${lundiDe(date)}`, 'Saisir toute la semaine', 'btn btn-court')),
    h('p', { classe: 'aide' }, 'L\'application répartit seule ce qui revient au poste ; corrigez seulement une exception.'),
    blocPhoto(date),
    blocMenu(etat, date, 1),
    blocMenu(etat, date, 2)]);
}

// ------------------------------------------------------------------ couverts midi

/** Décision du 2026-10-07 : plus de saisie menu par menu ; un total, la répartition calculée, la même feuille que sur Aujourd'hui. */
function sectionPrevisions(etat, date) {
  if (!aMenuDuJour(date)) return null;
  const c = couvertsMidiDuJour(etat, date);
  const saisie = c.total !== null;
  return rubrique(h('h2', { classe: 'section-titre' }, 'Couverts midi'), [
    h('p', { classe: 'aide' }, 'Les groupes (fiches de fonction) s\'ajoutent à ce total ; les deux menus restent séparés.'),
    h('p', null, saisie
      ? [pluriel(c.total, 'couvert'), ` · menu 1 : ${c.m1} · menu 2 : ${c.m2} `, pastille(c.manuel ? 'décidé par vous' : 'calculé', 'gris'), ' ', pastille('provisoire', 'gris')]
      : 'couverts à saisir'),
    h('div', { classe: 'actions' }, bouton(saisie ? 'Modifier les couverts' : 'Saisir les couverts', () => ouvrirCouvertsMidi(date), 'court')),
  ], { classe: 'carte', id: 'previsions' });
}

// ------------------------------------------------------------------ fiches

function carteFiche(f) {
  const annulee = f.statut === 'annulee';
  return h('article', { classe: `carte-fiche${annulee ? ' annulee' : ''}` },
    h('div', { classe: 'composant-tete' },
      h('strong', null, `Fiche ${f.numero || '(sans identifiant)'} · ${LIBELLE_SERVICE[f.service]}`),
      pastille(`version ${f.version}`, 'gris'), annulee ? pastille('annulée', 'rouge') : null),
    h('p', null, `${pluriel(f.couverts, 'personne')}${f.horaire ? ` · ${f.horaire}` : ''}`),
    h('p', { classe: 'meta' }, resumeChoix(f)),
    repartitionIncoherente(f) && !annulee
      ? h('p', { classe: 'alerte-texte' }, `Alerte : la répartition (${(f.repartition[1] || 0) + (f.repartition[2] || 0)}) ne correspond pas aux couverts (${f.couverts}).`) : null,
    f.allergies.trim() ? h('p', null, h('strong', null, 'Allergies : '), f.allergies) : null,
    f.remarques.trim() ? h('p', null, h('strong', null, 'Remarques : '), f.remarques) : null,
    f.mode === 'menu_fixe' ? null : annulee ? null : blocBuffet(f.couverts),
    h('div', { classe: 'actions' },
      annulee ? null : bouton('Modifier', () => dialogFiche(f, f.date), 'court'),
      !annulee && f.mode === 'choix_libre' && f.statutRepartition !== 'confirmee'
        ? bouton('Confirmer la répartition', () => dialogRepartition(f.id), 'court principal') : null,
      annulee ? null : bouton('Annuler la fiche', () => confirmerAnnulation(f.id), 'court danger'),
      bouton('Historique des versions', () => dialogHistorique(f.id), 'court')));
}

function sectionFiches(etat, date) {
  const fiches = Object.values(etat.fiches).filter((f) => f.date === date)
    .sort((a, b) => a.service.localeCompare(b.service) || a.horaire.localeCompare(b.horaire));
  return rubrique(h('h2', { classe: 'section-titre' }, 'Fiches de fonction'), [
    fiches.length === 0 ? ligneVide('Aucune fiche de fonction ce jour-là.') : fiches.map(carteFiche),
    h('div', { classe: 'actions' }, bouton('Nouvelle fiche', () => dialogFiche(null, date), 'principal'), boutonLireFiche(date)),
  ], { classe: 'carte', id: 'fiches' });
}

// ------------------------------------------------------------------ allergies

function sectionAllergies(etat, date) {
  const alertes = alertesAllergenes(etat, date);
  return rubrique(h('h2', { classe: 'section-titre' }, 'Allergies du jour'), [
    alertes.length === 0 ? ligneVide('Aucune fiche avec allergie signalée ce jour-là.') : alertes.map((a) => h('article', { classe: 'carte-fiche' },
      h('p', null, h('strong', null, `Fiche ${a.numero || ''} (${LIBELLE_SERVICE[a.service]}) : `), a.allergies),
      a.composants.length === 0
        ? h('p', { classe: 'vide' }, 'Aucun composant du menu du jour concerné (service du soir ou hors menu).')
        : h('ul', { classe: 'liste-simple' }, a.composants.map((c) => h('li', null, h('span', null, `${c.nom} `),
          c.statut === 'a_confirmer'
            ? pastille('allergènes à confirmer', 'ambre')
            : pastille(`liste validée : ${c.liste.length > 0 ? c.liste.map(libelleAllergene).join(', ') : 'aucun allergène coché'}`, 'vert')))),
      a.adaptations.length > 0
        ? h('div', null, h('h3', { classe: 'bloc-titre' }, 'Adaptations décidées'),
          h('ul', { classe: 'liste-simple' }, a.adaptations.map((x) => h('li', null, `${formaterHeure(x.h)} : ${x.texte}`)))) : null,
      h('div', { classe: 'actions' }, bouton('Noter une adaptation décidée', () => dialogAdaptation(a.ficheId), 'court')))),
    h('p', { classe: 'aide' }, 'L\'application n\'affirme rien sur les allergènes : seul le chef décide d\'une adaptation, et elle est tracée.'),
  ], { classe: 'carte', id: 'allergies' });
}

// ------------------------------------------------------------------ créneaux

const OPTIONS_ETAT_CRENEAU = [[null, 'selon la semaine type'], ...Object.keys(ETAT_CRENEAU).map((c) => [c, libelle('ETAT_CRENEAU', c)])];

function dialogCreneau(date, creneau) {
  const valeur = jourOuVide(etatCourant(), date).creneaux[creneau];
  const f = champs([{ cle: 'etat', type: 'choix', libelle: `État : ${libelle('CRENEAU', creneau)}`, valeur, options: OPTIONS_ETAT_CRENEAU,
    aide: 'Signalez ici une charge de carte ou une indisponibilité du poste. Cela ne crée ni portion ni recette de carte.' }]);
  panneau({
    titre: `Créneau du ${libelleJour(date)}`,
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((e, t) => definirCreneau(e, date, creneau, f.valeur('etat'), t)); },
  });
}

function sectionCreneaux(etat, date) {
  const jour = jourOuVide(etat, date);
  const charges = creneauxDuJour(date).map((c) => [c, chargeCreneau(etat, date, c)]);
  return rubrique(h('h2', { classe: 'section-titre' }, 'Créneaux du jour'), [
    charges.map(([c, charge]) => h('div', { classe: 'sous-carte' },
      h('h3', null, libelle('CRENEAU', c), ' ', pastilleCreneau(charge.etatCreneau)),
      h('p', { classe: 'meta' }, jour.creneaux[c] === null ? 'état repris de la semaine type' : 'état défini pour ce jour'),
      h('p', null, texteCharge(charge),
        Number.isFinite(charge.capacite) ? ` · ${charge.points} / ${charge.capacite} points de charge` : ''),
      charge.alertes.map((a) => h('p', { classe: 'alerte-texte' }, a)),
      h('div', { classe: 'actions' }, bouton('Modifier l\'état', () => dialogCreneau(date, c), 'court')))),
    h('p', { classe: 'aide' }, 'La charge compte les tâches courtes, moyennes et longues : ce n\'est pas une durée mesurée.'),
  ], { classe: 'carte', id: 'creneaux' });
}

// ------------------------------------------------------------------ après service

function dialogVentes(date) {
  const v = jourOuVide(etatCourant(), date).ventes;
  const f = champs([
    { cle: 'v1', type: 'entier', libelle: 'Ventes du menu 1', valeur: v[1] },
    { cle: 'v2', type: 'entier', libelle: 'Ventes du menu 2', valeur: v[2] },
  ]);
  panneau({
    titre: `Ventes du ${libelleJour(date)}`,
    corps: [h('p', { classe: 'aide' }, 'Facultatif. Les ventes servent de repère pour les prévisions futures ; elles ne modifient aucune prévision.'), ...f.noeuds],
    surEnregistrer: () => {
      const saisie = f.lire();
      agirStrict((e, t) => {
        const avant = jourOuVide(e, date).ventes;
        if (saisie.v1 !== avant[1]) saisirVentes(e, date, 1, saisie.v1, t);
        if (saisie.v2 !== avant[2]) saisirVentes(e, date, 2, saisie.v2, t);
      });
    },
  });
}

function sectionApresService(etat, date) {
  if (!aMenuDuJour(date)) return null;
  const v = jourOuVide(etat, date).ventes;
  return rubrique(h('h2', { classe: 'section-titre' }, 'Après service (facultatif)'), [
    [1, 2].map((m) => h('p', null, `Menu ${m} : `, Number.isFinite(v[m]) ? pluriel(v[m], 'portion vendue', 'portions vendues') : h('span', { classe: 'discret' }, 'ventes non saisies'))),
    v.h ? h('p', { classe: 'meta' }, `saisie du ${formaterHeure(v.h)}`) : null,
    h('div', { classe: 'actions' }, bouton('Saisir les ventes', () => dialogVentes(date), 'court')),
    h('p', { classe: 'aide' }, 'Surplus utilisable et rebut se saisissent sur la page de chaque composant.'),
  ], { classe: 'carte', id: 'apres-service' });
}

// ------------------------------------------------------------------ points à confirmer

export function versAncre(id) {
  return () => {
    const cible = document.getElementById(id);
    // une rubrique repliée (et les replis qui la contiennent) s'ouvre avant qu'on y aille
    for (let n = cible; n; n = n.parentElement) if ('open' in n) n.open = true;
    const reduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cible?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
  };
}

function actionPoint(p) {
  if (p.composantId) return lien(`#/fiche/${encodeURIComponent(p.composantId)}`, 'Ouvrir le composant', 'btn btn-court');
  if (p.type === 'prevision_manquante') return bouton('Aller aux prévisions', versAncre('previsions'), 'court');
  if (p.ficheId) return bouton('Aller aux fiches', versAncre('fiches'), 'court');
  return bouton('Aller aux menus', versAncre('menus'), 'court');
}

function sectionPoints(etat, date) {
  const points = pointsAConfirmer(etat, date);
  const contenu = points.length === 0 ? ligneVide('Rien à confirmer ce jour-là.')
    : h('ul', { classe: 'liste-points' }, points.map((p) => h('li', null, h('span', null, p.texte), actionPoint(p))));
  return h('section', { classe: 'carte', id: 'points' }, h('h2', { classe: 'section-titre' }, 'Points à confirmer'), contenu);
}

// ------------------------------------------------------------------ vue

/** Toutes les rubriques du détail d'un jour ouvert, dans l'ordre, à plat (feuille « Détail du jour »). */
export function sectionsDuJour(etat, date) {
  return [sectionMenus(etat, date), sectionPrevisions(etat, date), sectionFiches(etat, date),
    sectionAllergies(etat, date), sectionCreneaux(etat, date), sectionApresService(etat, date), sectionPoints(etat, date)]
    .filter(Boolean);
}
