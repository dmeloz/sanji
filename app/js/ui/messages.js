// Messages courts (toasts). Une erreur reste affichée jusqu'à fermeture ; le reste disparaît seul.

import { h, parId } from './dom.js';

const DUREE_MS = 5000;

const DUREE_AVEC_ACTIONS_MS = 9000;

/**
 * @param {'info'|'ok'|'alerte'|'erreur'} type
 * @param {{libelle:string, action:Function}[]} [actions] boutons du message (« Annuler », « Corriger »…) ; le message
 *   reste un peu plus longtemps et se ferme après l'action
 */
export function afficherMessage(texte, type = 'info', actions = []) {
  const zone = parId('messages');
  if (!zone) return;
  const retirer = () => noeud.remove();
  const noeud = h('div', { classe: `message message-${type}`, role: type === 'erreur' ? 'alert' : 'status' },
    h('span', { classe: 'message-texte' }, texte),
    actions.map((a) => h('button', { type: 'button', classe: 'message-action', onClick: () => { retirer(); a.action(); } }, a.libelle)),
    h('button', { type: 'button', classe: 'message-fermer', 'aria-label': 'Fermer le message', onClick: retirer }, '×'));
  zone.appendChild(noeud);
  if (type !== 'erreur') setTimeout(retirer, actions.length > 0 ? DUREE_AVEC_ACTIONS_MS : DUREE_MS);
}
