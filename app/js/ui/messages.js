// Messages courts (toasts). Une erreur reste affichée jusqu'à fermeture ; le reste disparaît seul.

import { h, parId } from './dom.js';

const DUREE_MS = 5000;

/** @param {'info'|'ok'|'alerte'|'erreur'} type */
export function afficherMessage(texte, type = 'info') {
  const zone = parId('messages');
  if (!zone) return;
  const retirer = () => noeud.remove();
  const noeud = h('div', { classe: `message message-${type}`, role: type === 'erreur' ? 'alert' : 'status' },
    h('span', { classe: 'message-texte' }, texte),
    h('button', { type: 'button', classe: 'message-fermer', 'aria-label': 'Fermer le message', onClick: retirer }, '×'));
  zone.appendChild(noeud);
  if (type !== 'erreur') setTimeout(retirer, DUREE_MS);
}
