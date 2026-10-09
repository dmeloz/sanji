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

/** Demande au navigateur de chercher une nouvelle version : 'a_jour' | 'en_cours' (le bandeau suivra) | 'indisponible'. */
export async function verifierMiseAJour(conteneur) {
  try {
    const inscription = await conteneur?.getRegistration?.();
    if (!inscription) return 'indisponible';
    await inscription.update();
    return inscription.installing || inscription.waiting ? 'en_cours' : 'a_jour';
  } catch {
    return 'indisponible';
  }
}

const MESSAGES = {
  a_jour: 'Sanji est à jour.',
  en_cours: 'Mise à jour en cours : Sanji va se relancer.',
  indisponible: 'Impossible de vérifier pour l\'instant (réseau ou mode hors ligne).',
};

/** Au-delà, on relance quand même : le nouveau worker est installé et prend la main (skipWaiting). */
const DELAI_RELANCE_MS = 6000;

/**
 * Réglages : bouton « Vérifier les mises à jour » et le résultat dessous. Une mise à jour trouvée est appliquée tout de suite
 * (relance de l'app), sans passer par le bandeau. Dépendances injectables pour les tests.
 */
export function ligneVerifierMiseAJour(verifier = () => verifierMiseAJour(typeof navigator === 'undefined' ? undefined : navigator.serviceWorker), {
  conteneur = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
  recharger = () => globalThis.location.reload(),
  delaiMs = DELAI_RELANCE_MS,
} = {}) {
  const message = h('p', { classe: 'meta', role: 'status' });
  const declencheur = bouton('Vérifier les mises à jour', async () => {
    message.textContent = 'Vérification…';
    const resultat = await verifier();
    message.textContent = MESSAGES[resultat];
    if (resultat !== 'en_cours') return;
    let fait = false;
    const relancer = () => { if (!fait) { fait = true; recharger(); } };
    conteneur?.addEventListener?.('controllerchange', relancer);
    setTimeout(relancer, delaiMs);
  }, 'court');
  return h('div', { classe: 'reglages-maj' }, declencheur, message);
}
