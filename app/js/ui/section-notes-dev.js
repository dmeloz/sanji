// Réglages > Apprentissage et essais : « Notes de test » (trois groupes : nouvelles, transmises, réglées) et réglage de la pastille.

import { CATEGORIES, TYPES } from '../domaine/notes-dev.js';
import { redessiner } from '../magasin.js';
import { h } from './dom.js';
import { bouton, ligneVide } from './elements.js';
import { pluriel } from './format.js';
import { definirEtatNote, notesParEtat, pastilleActive, reglerPastille, supprimerNote } from './notes-dev.js';
import { confirmer, panneau } from './panneau.js';

const AIDE = 'Vos notes restent sur cet appareil ; elles ne partent qu\'avec le fichier que vous partagez.';

const jour = (hIso) => String(hIso ?? '').slice(0, 16).replace('T', ' ');

export function interrupteurPastille() {
  const active = pastilleActive();
  const mot = h('span', { classe: 'interrupteur-etat' }, active ? 'activée' : 'désactivée');
  const entree = h('input', { type: 'checkbox', role: 'switch', id: 'reglage-pastille-dev', classe: 'interrupteur-entree', checked: active,
    onChange: (e) => { reglerPastille(e.target.checked); mot.textContent = e.target.checked ? 'activée' : 'désactivée'; } });
  return h('label', { classe: 'interrupteur', pour: 'reglage-pastille-dev' }, entree, h('span', null, 'Pastille « Dev » sur chaque écran'), mot);
}

const TITRES_LECTURE = { transmise: 'Notes transmises', reglee: 'Notes réglées' };
const AIDE_ETATS = 'Une note envoyée passe à « transmise » : elle ne repart plus. Rouvrez-la si le problème est toujours là.';

function ligneNote(n, actions) {
  return h('li', { classe: 'note-dev' },
    h('p', { classe: 'note-dev-texte' }, n.texte),
    h('p', { classe: 'aide' }, `${TYPES[n.type] ?? '?'} · ${n.ecran || '?'} · ${jour(n.h)}`),
    h('div', { classe: 'actions' }, actions));
}

const changer = (id, etat, surChangement) => () => { definirEtatNote(id, etat); surChangement(); };

const boutonSupprimer = (n, surChangement) => bouton('Supprimer', () => confirmer({ titre: 'Supprimer cette note ?', texte: 'La note sera supprimée de cet appareil.',
  libelleOk: 'Supprimer', danger: true, action: () => { supprimerNote(n.id); surChangement(); } }), 'court');

/** Feuille en lecture seule des notes transmises ou réglées ; se redessine après chaque geste (et redessine aussi la feuille dessous). */
function ouvrirLecture(etat, surChangement) {
  const racine = h('div');
  const rafraichir = () => {
    const notes = notesParEtat(etat);
    racine.replaceChildren(notes.length === 0 ? ligneVide('Aucune note.') : h('ul', { classe: 'liste-simple' }, notes.map((n) => ligneNote(n, [
      ...(etat === 'transmise' ? [bouton('Réglée', changer(n.id, 'reglee', () => { rafraichir(); surChangement(); }), 'court')] : []),
      bouton('Rouvrir', changer(n.id, 'nouvelle', () => { rafraichir(); surChangement(); }), 'court')]))));
  };
  rafraichir();
  return panneau({ titre: TITRES_LECTURE[etat], lectureSeule: true, corps: [racine] });
}

function groupeCompte(titre, etat, singulier, plur, surChangement) {
  const n = notesParEtat(etat).length;
  return h('div', null, h('h3', { classe: 'retour-essai-sous-titre' }, titre),
    h('p', null, pluriel(n, singulier, plur)),
    n === 0 ? null : h('div', { classe: 'actions' }, bouton('Voir', () => ouvrirLecture(etat, surChangement), 'court', { 'aria-label': `Voir les notes ${plur}` })));
}

/** `surChangement` : appelé après une note réglée, rouverte ou supprimée (la page ou la feuille se redessine). */
export function sectionNotesDev(surChangement = redessiner) {
  const nouvelles = notesParEtat('nouvelle');
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Notes de test'),
    h('p', { classe: 'aide' }, AIDE),
    h('p', { classe: 'aide' }, AIDE_ETATS),
    h('h3', { classe: 'retour-essai-sous-titre' }, 'Nouvelles'),
    nouvelles.length === 0 ? ligneVide('Aucune nouvelle note.')
      : CATEGORIES.map((c) => {
        const ici = nouvelles.filter((n) => n.categorie === c.cle);
        return ici.length === 0 ? null : h('div', null, h('h4', { classe: 'retour-essai-sous-titre' }, c.libelle), h('ul', { classe: 'liste-simple' }, ici.map((n) => ligneNote(n, [
          bouton('Réglée', changer(n.id, 'reglee', surChangement), 'court'), boutonSupprimer(n, surChangement)]))));
      }),
    groupeCompte('Transmises', 'transmise', 'transmise', 'transmises', surChangement),
    groupeCompte('Réglées', 'reglee', 'réglée', 'réglées', surChangement));
}
