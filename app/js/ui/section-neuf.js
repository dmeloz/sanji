// Réglages > Données : « Repartir à neuf ». Une ligne tappable danger, puis une confirmation qui liste ce qui part, ce qui reste,
// et exige le mot NEUF (pas de toucher malheureux). La logique est dans `remise-a-neuf.js`.

import { etat, maintenant, remplacer } from '../magasin.js';
import { repartirANeuf } from '../remise-a-neuf.js';
import { lireAvantRemiseANeuf } from '../sauvegarde-auto.js';
import { h, svg } from './dom.js';
import { effacerRepere } from './dernier-envoi.js';
import { effacerJournal } from './journal-diagnostic.js';
import { afficherMessage } from './messages.js';
import { effacerNotes } from './notes-dev.js';
import { panneau } from './panneau.js';
import { oublierToutesLesUrls } from './photo.js';
import { effacerRetours } from './retours-essai.js';

const MOT = 'NEUF';

const EFFACEMENTS = [
  { nom: 'les notes de test', effacer: effacerNotes },
  { nom: 'le repère du dernier envoi', effacer: effacerRepere },
  { nom: "les retours d'essai", effacer: effacerRetours },
  { nom: 'le journal de diagnostic', effacer: effacerJournal },
  { nom: 'les photos en mémoire', effacer: oublierToutesLesUrls },
];

const lancerReel = () => repartirANeuf({ etat, maintenant, remplacer, effacements: EFFACEMENTS });

const motTape = (champ) => champ.value.trim().toUpperCase() === MOT;

/** Date (AAAA-MM-JJ) de la copie de sécurité déjà gardée, ou null. */
function dateDeLaCopie(texte) {
  try { return String(JSON.parse(texte).exporteLe).slice(0, 10) || null; } catch { return null; }
}

function phraseCopie(texteExistant) {
  const base = "Avant d'effacer, Sanji garde une copie de sécurité de vos données (« État avant la remise à neuf » dans Copies automatiques). "
    + "Cette copie garde vos données Sanji, mais PAS les photos de menus, ni les notes de test, ni le journal de diagnostic. ";
  const fin = " Si la copie est impossible, rien n'est effacé.";
  if (typeof texteExistant !== 'string') return base + fin.trim();
  const date = dateDeLaCopie(texteExistant);
  return `${base}Une copie de sécurité existe déjà${date ? ` (du ${date})` : ''} : elle est gardée comme avant-dernière copie `
    + "(« État avant la remise à neuf précédente »), et la copie plus ancienne qui s'y trouvait est remplacée. Si vos données sont déjà vides, rien n'est remplacé." + fin;
}

function confirmation(lancer, texteExistant) {
  let autoriser = () => {};
  const champ = h('input', { id: 'neuf-mot', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    onInput: () => autoriser(motTape(champ)) });
  panneau({
    titre: 'Tout effacer et repartir à neuf ?',
    danger: true, okDesactive: true,
    libelleEnregistrer: 'Tout effacer et repartir à neuf',
    corps: (api) => {
      autoriser = api.autoriser;
      return [
        h('p', null, 'Sanji repartira comme à la première utilisation. Seront effacés de cet appareil : les menus et les semaines, les composants, '
          + 'les fiches de fonction, les portions et standards maison, les fiches et mots retenus, les lignes écartées, les ventes, les cases cochées, '
          + 'les notes de test et le journal de diagnostic locaux, les photos de menus et les copies automatiques des 7 derniers jours.'),
        h('p', null, "Gardés : la clé de l'assistant IA, les réglages de cet appareil et « État avant la dernière restauration » et « État avant l'import écarté » (s'ils existent, ils restent restaurables : supprimez-les vous-même si vous n'en voulez plus)."),
        h('p', null, phraseCopie(texteExistant)),
        h('div', { classe: 'champ' }, h('label', { pour: 'neuf-mot' }, `Pour confirmer, tapez ${MOT}`), champ),
      ];
    },
    surEnregistrer: async () => {
      if (!motTape(champ)) throw new Error(`Tapez ${MOT} pour confirmer.`);
      const { avertissements } = await lancer();
      afficherMessage('Sanji est remis à neuf.', 'ok');
      for (const a of avertissements) afficherMessage(`Attention : ${a}.`, 'erreur');
    },
  });
}

export function sectionNeuf(lancer = lancerReel, lireExistante = () => lireAvantRemiseANeuf()) {
  const icone = svg('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
  svg('path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' }));
  return h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, 'Repartir à neuf'),
    h('ul', { classe: 'liste' }, h('li', null, h('button', { type: 'button', classe: 'reglage-rubrique reglage-danger', onClick: async () => confirmation(lancer, await lireExistante().catch(() => null)) },
      icone,
      h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, 'Repartir à neuf'),
        h('span', { classe: 'meta' }, 'efface les menus et tout ce qui a été saisi, comme à la première utilisation')),
      h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›')))));
}
