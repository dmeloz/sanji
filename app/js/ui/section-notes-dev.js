// Réglages > Apprentissage et essais : « Notes de test » (liste, réglée / rouvrir, supprimer) et réglage de la pastille.

import { CATEGORIES, TYPES } from '../domaine/notes-dev.js';
import { redessiner } from '../magasin.js';
import { h } from './dom.js';
import { bouton, ligneVide } from './elements.js';
import { pluriel } from './format.js';
import { basculerNote, lireNotes, pastilleActive, reglerPastille, supprimerNote } from './notes-dev.js';
import { confirmer } from './panneau.js';

const AIDE = 'Vos notes restent sur cet appareil ; elles ne partent qu\'avec le fichier que vous partagez.';

const jour = (hIso) => String(hIso ?? '').slice(0, 16).replace('T', ' ');

export function interrupteurPastille() {
  const active = pastilleActive();
  const mot = h('span', { classe: 'interrupteur-etat' }, active ? 'activée' : 'désactivée');
  const entree = h('input', { type: 'checkbox', role: 'switch', id: 'reglage-pastille-dev', classe: 'interrupteur-entree', checked: active,
    onChange: (e) => { reglerPastille(e.target.checked); mot.textContent = e.target.checked ? 'activée' : 'désactivée'; } });
  return h('label', { classe: 'interrupteur', pour: 'reglage-pastille-dev' }, entree, h('span', null, 'Pastille « Dev » sur chaque écran'), mot);
}

function ligneNote(n, surChangement) {
  const reglee = n.etat === 'reglee';
  return h('li', { classe: 'note-dev' },
    h('p', { classe: 'note-dev-texte' }, n.texte),
    h('p', { classe: 'aide' }, `${TYPES[n.type] ?? '?'} · ${reglee ? 'réglée' : 'ouverte'} · ${n.ecran || '?'} · ${jour(n.h)}`),
    h('div', { classe: 'actions' },
      bouton(reglee ? 'Rouvrir' : 'Réglée', () => { basculerNote(n.id); surChangement(); }, 'court'),
      bouton('Supprimer', () => confirmer({ titre: 'Supprimer cette note ?', texte: 'La note sera supprimée de cet appareil.', libelleOk: 'Supprimer', danger: true,
        action: () => { supprimerNote(n.id); surChangement(); } }), 'court')));
}

/** `surChangement` : appelé après une note réglée ou supprimée (la page ou la feuille se redessine). */
export function sectionNotesDev(surChangement = redessiner) {
  const notes = lireNotes();
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Notes de test'),
    h('p', { classe: 'aide' }, AIDE),
    h('p', null, pluriel(notes.length, 'note', 'notes')),
    notes.length === 0 ? ligneVide('Aucune note pour l\'instant. Touchez « Dev » sur n\'importe quel écran pour en écrire une.')
      : CATEGORIES.map((c) => {
        const ici = notes.filter((n) => n.categorie === c.cle);
        return ici.length === 0 ? null : h('div', null, h('h3', { classe: 'retour-essai-sous-titre' }, c.libelle), h('ul', { classe: 'liste-simple' }, ici.map((n) => ligneNote(n, surChangement))));
      }));
}
