// Centre « Notes et diagnostic » : tout ce qui part dans le fichier partagé, au même endroit (envoi, notes, effacement).

import { etat } from '../magasin.js';
import { h } from './dom.js';
import { bouton } from './elements.js';
import { effacerJournal, lireEvenements } from './journal-diagnostic.js';
import { panneau, confirmer } from './panneau.js';
import { effacerRetours, lireRetours } from './retours-essai.js';
import { boutonsEnvoi } from './section-diagnostic.js';
import { sectionNotesDev } from './section-notes-dev.js';

const AIDE = 'Un seul geste : ce qui est nouveau depuis le dernier envoi part dans le même fichier (journal, texte lu par l\'IA, retours d\'essai, notes, photos). Rien n\'est envoyé automatiquement.';

function contenu(rafraichir) {
  const effacer = () => confirmer({
    titre: 'Effacer le journal de diagnostic ?',
    texte: 'Le journal, les photos et les retours d\'essai gardés sur cet appareil seront supprimés. Vos menus et vos notes ne changent pas.',
    libelleOk: 'Effacer', danger: true,
    action: () => { effacerJournal(); effacerRetours(); rafraichir(); },
  });
  return [
    h('p', { classe: 'aide' }, AIDE),
    boutonsEnvoi(etat()),
    sectionNotesDev(rafraichir),
    h('div', { classe: 'actions' }, bouton('Effacer le journal', effacer, 'court', { disabled: lireEvenements().length + lireRetours().length === 0 })),
  ];
}

export function ouvrirCentreDev() {
  const racine = h('div');
  const rafraichir = () => racine.replaceChildren(...contenu(rafraichir));
  rafraichir();
  return panneau({ titre: 'Notes et diagnostic', lectureSeule: true, corps: [racine] });
}
