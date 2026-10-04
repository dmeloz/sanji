// État du mode hors ligne : « hors ligne prêt » ou « hors ligne indisponible ici » avec la raison (Réglages), et le seul problème à montrer ailleurs (`problemeHorsLigne`).
// Aucun accès à navigator, window ni caches au niveau supérieur.

const PREFIXE_CACHE = 'sanji-';
const situation = { pret: false, attente: true, raison: 'vérification en cours' };
const abonnes = new Set();

export function situationHorsLigne() { return { ...situation }; }
export function abonnerHorsLigne(f) { abonnes.add(f); return () => abonnes.delete(f); }

function definir(pret, raison) {
  situation.pret = pret;
  situation.attente = false;
  situation.raison = raison;
  for (const f of abonnes) f(situation);
}

/** Libellé affichable. */
export function libelleHorsLigne(s = situation) {
  if (s.attente) return 'hors ligne : vérification en cours';
  return s.pret ? 'hors ligne prêt' : `hors ligne indisponible ici : ${s.raison}`;
}

/**
 * Montrer l'exception, pas la normalité : le texte d'un problème seulement, `null` quand tout est normal (prêt, ou
 * vérification encore en cours au démarrage). Les écrans n'affichent rien dans ce cas ; l'état complet reste dans
 * Réglages (`libelleHorsLigne`).
 */
export function problemeHorsLigne(s = situation) {
  if (s.attente || s.pret) return null;
  return s.raison ? `hors ligne pas encore prêt : ${s.raison}` : 'hors ligne pas encore prêt';
}

/** Enregistre le service worker si le navigateur et le contexte le permettent, puis vérifie le cache. */
export async function preparerHorsLigne() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    definir(false, 'ce navigateur ne gère pas les service workers');
    return situation;
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    definir(false, 'contexte non sécurisé (HTTPS ou localhost requis)');
    return situation;
  }
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const noms = typeof caches !== 'undefined' ? await caches.keys() : [];
    if (noms.some((n) => n.startsWith(PREFIXE_CACHE))) definir(true, '');
    else definir(false, 'les fichiers ne sont pas encore en cache');
  } catch (erreur) {
    definir(false, `enregistrement impossible (${erreur?.message ?? 'erreur inconnue'})`);
  }
  return situation;
}
