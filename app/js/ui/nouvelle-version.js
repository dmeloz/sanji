// Bandeau « Nouvelle version prête » : sw.js s'active seul (skipWaiting + clients.claim), mais la page ouverte garde l'ancien code
// jusqu'au rechargement. Dès qu'un nouveau worker prend la main sur une page déjà pilotée, on propose un seul geste.
// Aucun accès à navigator ni document au niveau supérieur.

import { h } from './dom.js';
import { bouton } from './elements.js';

/** Le bandeau : une phrase et « Mettre à jour » (`recharger` = rechargement de la page). */
export function bandeauNouvelleVersion(recharger) {
  return h('div', { classe: 'encadre encadre-info bandeau-version', role: 'status' },
    h('span', null, 'Nouvelle version prête.'),
    bouton('Mettre à jour', recharger, 'principal'));
}

/**
 * Appelle `montrer` une seule fois quand un nouveau worker prend la main (`conteneur` = navigator.serviceWorker).
 * Première installation (pas de worker avant) : rien, la page est déjà à jour.
 */
export function surveillerNouvelleVersion(conteneur, montrer) {
  if (!conteneur?.addEventListener || !conteneur.controller) return;
  let montre = false;
  conteneur.addEventListener('controllerchange', () => {
    if (montre) return;
    montre = true;
    montrer();
  });
}
