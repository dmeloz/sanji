// « Préparer la semaine » (#/preparer/<lundi>, décision du 2026-10-09) : après l'enregistrement des menus, une seule page :
// couverts du midi (valeurs à toucher), valeurs à confirmer (« OK » ou « Tout valider avec les standards »), puis la fiche
// de production. Aucune règle métier ici : tout vient de domaine/preparation.js et des actions du domaine.

import { definirCouvertsMidi } from '../domaine/actions-couverts.js';
import { saisirPortionInconnue, validerToutAvecStandards } from '../domaine/actions-preparation.js';
import { MESSAGE_PORTION_TROP_GRANDE, PORTION_MAX_G } from '../domaine/savoir.js';
import { validerStandard } from '../domaine/actions-validation.js';
import { libelleJour } from '../domaine/dates.js';
import { preparationSemaine } from '../domaine/preparation.js';
import { libelle } from '../domaine/statuts.js';
import { agir, aujourdhui, redessiner } from '../magasin.js';
import { MESSAGE_POIDS_A_CHOISIR } from '../domaine/mise-en-place.js';
import { choixEtatPoids } from './choix-poids.js';
import { h } from './dom.js';
import { bouton, etatVide, lien, pastille } from './elements.js';
import { parseNombre, pluriel, quantite } from './format.js';
import { afficherMessage } from './messages.js';

export function titre() { return 'Préparer la semaine'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Dernier « Tout valider » de la page (le redessin après l'écriture ne doit pas l'effacer) ; propre à une semaine. */
let bilan = null;
/** Ce que chaque « OK » sans standard a retenu (la ligne disparaît une fois validée) ; propre à une semaine. */
let retenus = { lundi: null, textes: [] };
const TEXTE_PORTEE = { standard: 'retenu pour toutes les semaines', plat: 'retenu pour toutes les semaines' };

const phraseBilan = ({ validees, restantInconnu }) => {
  const debut = validees === 0 ? 'Aucune valeur à valider avec les standards' : `${pluriel(validees, 'valeur validée', 'valeurs validées')} avec les standards`;
  return `${debut} ; ${restantInconnu === 0 ? 'rien à saisir' : `il reste ${restantInconnu} à saisir`}.`;
};

function ligneCouverts(jour) {
  const total = jour.couverts.total;
  return h('li', { classe: 'prep-jour' },
    h('div', { classe: 'prep-jour-tete' },
      h('span', { classe: 'prep-jour-nom' }, majuscule(libelleJour(jour.date))),
      h('span', { classe: 'prep-nombre' }, total === null ? '—' : String(total), total === null ? null : h('span', { classe: 'au-sous' }, ' couverts'))),
    h('div', { classe: 'prep-valeurs', role: 'group', 'aria-label': `Couverts du ${libelleJour(jour.date)}` },
      jour.couverts.auChoix.map((n) => h('button', {
        type: 'button', classe: 'btn prep-valeur', 'aria-pressed': total === n ? 'true' : 'false',
        'aria-label': `${n} couverts le ${libelleJour(jour.date)}`,
        onClick: () => { bilan = null; agir((e, t) => definirCouvertsMidi(e, jour.date, { total: n }, t)); },
      }, String(n)))));
}

function ligneStandard(l) {
  return h('li', { classe: 'prep-ligne' },
    h('div', { classe: 'prep-ligne-texte' },
      h('span', { classe: 'prep-ligne-nom' }, l.libelle),
      h('span', { classe: 'prep-ligne-valeur' }, quantite(l.valeurStandard, l.unite), ` · poids ${libelle('ETAT_POIDS', l.etatPoids)} · `, pastille('standard de base', 'gris'))),
    bouton('OK', () => {
      bilan = null;
      agir((e, t) => validerStandard(e, l.cible.famille, l.cible.role, { valeur: l.valeurStandard }, t));
    }, 'court', { 'aria-label': `Valider ${l.libelle} avec le standard` }));
}

function ligneInconnue(l, champs, lundi) {
  const champ = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', classe: 'prep-champ', 'aria-label': `${l.libelle} : valeur en ${libelle('UNITE', l.unite)}` });
  champs.set(l.id, champ);
  const poids = choixEtatPoids(l.etatPoids);
  const valider = () => {
    let valeur;
    try { valeur = parseNombre(champ.value, l.libelle); } catch (erreur) { afficherMessage(erreur.message, 'erreur'); return; }
    if (valeur === null) { afficherMessage(`${l.libelle} : tapez une valeur.`, 'erreur'); return; }
    if (valeur <= 0) { afficherMessage(`${l.libelle} : la portion doit être supérieure à 0.`, 'erreur'); return; }
    if (valeur > PORTION_MAX_G) { afficherMessage(MESSAGE_PORTION_TROP_GRANDE, 'erreur'); return; }
    if (poids.valeur() === null) { afficherMessage(MESSAGE_POIDS_A_CHOISIR, 'erreur'); return; }
    bilan = null;
    const r = agir((e, t) => saisirPortionInconnue(e, l.cible.composantId, valeur, t, poids.valeur()));
    if (!r.ok) return;
    const texte = `${l.libelle} : ${TEXTE_PORTEE[r.valeur.portee]}.`;
    retenus = { lundi, textes: [...(retenus.lundi === lundi ? retenus.textes : []), texte] };
    redessiner(); // la ligne a déjà disparu : on redessine avec la mention
  };
  return h('li', { classe: 'prep-ligne' },
    h('div', { classe: 'prep-ligne-texte' },
      h('span', { classe: 'prep-ligne-nom' }, l.libelle),
      h('span', { classe: 'prep-ligne-valeur' }, `à saisir (${libelle('UNITE', l.unite)} par portion) : choisissez le poids`)),
    poids.noeud,
    h('div', { classe: 'prep-saisie' }, champ, bouton('OK', valider, 'court', { 'aria-label': `Valider ${l.libelle} avec la valeur tapée` })));
}

function sectionAConfirmer(p, lundi) {
  const avecStandard = p.aConfirmer.filter((l) => !l.estInconnu);
  const sansStandard = p.aConfirmer.filter((l) => l.estInconnu);
  const champs = new Map();
  const tout = () => {
    const r = agir((e, t) => validerToutAvecStandards(e, lundi, t));
    if (r.ok) bilan = { lundi, ...r.valeur };
  };
  return h('section', { classe: 'prep-section', 'aria-labelledby': 'prep-titre-confirmer' },
    h('h2', { classe: 'sem-section', id: 'prep-titre-confirmer' }, 'À confirmer'),
    avecStandard.length > 0 ? bouton('Tout valider avec les standards', tout, 'principal prep-tout') : null,
    h('p', { classe: 'prep-bilan', role: 'status' }, bilan?.lundi === lundi ? phraseBilan(bilan) : null),
    retenus.lundi === lundi && retenus.textes.length > 0 ? h('ul', { classe: 'prep-retenus', role: 'status' }, retenus.textes.map((t) => h('li', null, t))) : null,
    p.aConfirmer.length === 0 ? h('p', { classe: 'sem-neutre' }, 'Rien à confirmer.') : null,
    avecStandard.length > 0 ? h('ul', { classe: 'prep-liste' }, avecStandard.map(ligneStandard)) : null,
    sansStandard.length > 0 ? h('div', null,
      h('h3', { classe: 'sem-sous-titre' }, 'Sans standard : à saisir'),
      h('p', { classe: 'aide' }, 'Aucun chiffre n\'est proposé : tapez la portion que vous servez.'),
      h('ul', { classe: 'prep-liste' }, sansStandard.map((l) => ligneInconnue(l, champs, lundi)))) : null);
}

export function rendre(etat, lundi) {
  const p = preparationSemaine(etat, lundi, aujourdhui());
  const racine = h('div', { classe: 'vue vue-preparer' },
    h('header', { classe: 'sem-tete' },
      h('div', { classe: 'sem-tete-texte' },
        h('h1', { classe: 'sem-titre' }, 'Préparer la semaine'),
        h('p', { classe: 'aide' }, 'Touchez les couverts du midi, confirmez les valeurs, puis ouvrez votre fiche de production.')),
      lien(`#/semaine/${lundi}/tableau`, 'Semaine', 'btn')),
    h('section', { classe: 'prep-section', 'aria-labelledby': 'prep-titre-couverts' },
      h('h2', { classe: 'sem-section', id: 'prep-titre-couverts' }, 'Couverts du midi'),
      p.jours.length === 0 ? etatVide({ titre: 'Aucun menu enregistré cette semaine', texte: 'Importez les menus pour préparer la semaine.', actions: [{ libelle: 'Importer les menus', href: `#/import/${lundi}`, principal: true }] })
        : h('ul', { classe: 'prep-liste' }, p.jours.map(ligneCouverts))),
    sectionAConfirmer(p, lundi),
    h('div', { classe: 'prep-fin' },
      lien(`#/production/${p.premierJour ?? lundi}`, 'Voir la fiche de production', 'btn btn-principal prep-fiche'),
      p.restantInconnu > 0 ? h('p', { classe: 'aide' }, `${pluriel(p.restantInconnu, 'valeur reste', 'valeurs restent')} à confirmer : elles resteront signalées dans la fiche.`) : null));
  return racine;
}
