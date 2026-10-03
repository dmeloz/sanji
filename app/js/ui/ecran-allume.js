// Écran maintenu allumé sur la feuille du jour (debout au poste, mains occupées). API navigateur « Screen Wake Lock » ;
// sans elle, ou si elle refuse, rien ne se passe et rien ne s'affiche.

let verrou = null;
let voulu = false;

export function ecranAllumePossible() {
  return typeof navigator !== 'undefined' && Boolean(navigator.wakeLock);
}

async function demander() {
  if (!voulu || verrou || !ecranAllumePossible()) return;
  try {
    const obtenu = await navigator.wakeLock.request('screen');
    verrou = obtenu;
    obtenu.addEventListener?.('release', () => { if (verrou === obtenu) verrou = null; });
  } catch {
    verrou = null;
  }
}

/** Demande (true) ou relâche (false) le verrou. Appelable à chaque affichage : sans effet s'il est déjà dans l'état voulu. */
export async function maintenirAllume(actif) {
  voulu = actif;
  if (actif) { await demander(); return; }
  const courant = verrou;
  verrou = null;
  if (courant) { try { await courant.release(); } catch { /* déjà relâché */ } }
}

/** Le système relâche le verrou quand l'application passe en arrière-plan : on le reprend au retour. */
export async function reprendreSiVisible() {
  if (typeof document === 'undefined' || document.visibilityState === 'visible' || document.visibilityState === undefined) await demander();
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => { reprendreSiVisible(); });
}
