// Bandeau « Nouvelle version prête » : sw.js s'active seul (skipWaiting + clients.claim), mais la page ouverte garde l'ancien code
// jusqu'au rechargement. Dès qu'un nouveau worker prend la main sur une page déjà pilotée, on propose un seul geste.
// Aucun accès à navigator ni document au niveau supérieur.

import { h } from './dom.js';
import { bouton } from './elements.js';
import { VERSION_APP } from '../version.js';

/** Le bandeau : une phrase et « Mettre à jour » (`recharger` = rechargement de la page). */
export function bandeauNouvelleVersion(recharger, courante = VERSION_APP) {
  return h('div', { classe: 'encadre encadre-info bandeau-version', role: 'status' },
    h('span', null, `Nouvelle version prête. Vous êtes en version ${courante}.`),
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

const FICHIER_VERSION = 'sw.js'; // jamais mis en cache par sw.js : il vient toujours du réseau (js/version.js serait servi par le cache)
const MOTIF_VERSION = /const VERSION = '(\d+)';/;
const REPERE_RELANCE = 'sanji-maj-relancee';

/** Numéro de version lu dans le texte de sw.js (motif strict, rien n'est exécuté) ; null si le contenu est inattendu. */
export function lireVersionServie(texte) {
  const trouve = typeof texte === 'string' ? MOTIF_VERSION.exec(texte) : null;
  return trouve ? Number(trouve[1]) : null;
}

/**
 * Cherche une nouvelle version et la COMPARE à celle qui tourne : { resultat: 'a_jour' | 'plus_recente' | 'indisponible', servie }.
 * (sw.js s'active seul : regarder installing/waiting disait « à jour » alors que la page gardait l'ancien code.)
 */
export async function verifierMiseAJour(conteneur, {
  chercher = (url, options) => globalThis.fetch(url, options),
  courante = VERSION_APP,
  maintenant = () => Date.now(),
} = {}) {
  try {
    const inscription = await conteneur?.getRegistration?.();
    await inscription?.update?.();
  } catch { /* la comparaison ci-dessous décide */ }
  try {
    const reponse = await chercher(`${FICHIER_VERSION}?v=${maintenant()}`, { cache: 'no-store' });
    if (!reponse?.ok) return { resultat: 'indisponible', servie: null };
    const servie = lireVersionServie(await reponse.text());
    if (servie === null) return { resultat: 'indisponible', servie: null };
    return { resultat: servie > Number(courante) ? 'plus_recente' : 'a_jour', servie };
  } catch {
    return { resultat: 'indisponible', servie: null };
  }
}

function messageDe({ resultat, servie }, courante) {
  if (resultat === 'plus_recente') return `Version ${servie} disponible : Sanji va se relancer.`;
  if (resultat === 'a_jour') return `Sanji est à jour (version ${courante}).`;
  return `Impossible de vérifier (réseau ou hors ligne). Vous êtes en version ${courante}.`;
}

/** Au-delà, on relance quand même : le nouveau worker est installé et prend la main (skipWaiting). */
const DELAI_RELANCE_MS = 6000;

const memoireSession = () => { try { return globalThis.sessionStorage; } catch { return undefined; } };
const essayer = (f) => { try { return f(); } catch { return undefined; } };

/**
 * Réglages : version installée, bouton « Vérifier les mises à jour » et le résultat dessous. Une version plus récente est
 * appliquée tout de suite (relance de l'app) ; une seule relance par version servie (repère de session) : jamais de boucle.
 * Dépendances injectables pour les tests.
 */
export function ligneVerifierMiseAJour(verifier = () => verifierMiseAJour(typeof navigator === 'undefined' ? undefined : navigator.serviceWorker), {
  conteneur = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
  recharger = () => globalThis.location.reload(),
  delaiMs = DELAI_RELANCE_MS,
  memoire = memoireSession(),
  courante = VERSION_APP,
} = {}) {
  const message = h('p', { classe: 'meta', role: 'status' });
  const declencheur = bouton('Vérifier les mises à jour', async () => {
    message.textContent = 'Vérification…';
    const resultat = await verifier();
    message.textContent = messageDe(resultat, courante);
    if (resultat.resultat !== 'plus_recente') { essayer(() => memoire?.removeItem(REPERE_RELANCE)); return; }
    if (essayer(() => memoire?.getItem(REPERE_RELANCE)) === String(resultat.servie)) {
      message.textContent = `Version ${resultat.servie} disponible, mais pas encore appliquée : fermez Sanji puis rouvrez-le. Vous êtes en version ${courante}.`;
      return;
    }
    essayer(() => memoire?.setItem(REPERE_RELANCE, String(resultat.servie)));
    let fait = false;
    const relancer = () => { if (!fait) { fait = true; recharger(); } };
    conteneur?.addEventListener?.('controllerchange', relancer);
    setTimeout(relancer, delaiMs);
  }, 'court');
  return h('div', { classe: 'reglages-maj' }, h('p', { classe: 'reglages-version' }, `Version installée : ${courante}`), declencheur, message);
}
