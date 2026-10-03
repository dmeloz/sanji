// Service worker : tout `app/` est mis en cache à l'installation, puis servi « cache d'abord ».
// Règle du projet : tout nouveau fichier de app/ s'ajoute à FICHIERS ET la VERSION s'incrémente
// (js/version.js doit porter la même valeur). Un test vérifie la liste.

const VERSION = '15';
const NOM_CACHE = `sanji-v${VERSION}`;
const PAGE_ACCUEIL = 'index.html';

const FICHIERS = [
  'css/style.css',
  'icones/icone-180.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'index.html',
  'js/domaine/actions.js',
  'js/domaine/allergenes.js',
  'js/domaine/analyse-menu.js',
  'js/domaine/base.js',
  'js/domaine/calcul.js',
  'js/domaine/dates.js',
  'js/domaine/etat.js',
  'js/domaine/feuille.js',
  'js/domaine/planification.js',
  'js/domaine/points.js',
  'js/domaine/produits.js',
  'js/domaine/savoir.js',
  'js/domaine/statuts.js',
  'js/domaine/tableau-blanc.js',
  'js/donnees/base-metier.js',
  'js/magasin.js',
  'js/main.js',
  'js/stockage.js',
  'js/ui/champs.js',
  'js/ui/dom.js',
  'js/ui/elements.js',
  'js/ui/fiches.js',
  'js/ui/format.js',
  'js/ui/horsligne.js',
  'js/ui/messages.js',
  'js/ui/panneau.js',
  'js/ui/photo.js',
  'js/ui/reference.js',
  'js/ui/routeur.js',
  'js/ui/taches.js',
  'js/ui/vue-composant.js',
  'js/ui/vue-detail.js',
  'js/ui/vue-jour.js',
  'js/ui/vue-menus.js',
  'js/ui/vue-produits.js',
  'js/ui/vue-reglages.js',
  'js/ui/vue-tableau.js',
  'js/version.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_CACHE)
      .then((cache) => cache.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n.startsWith('sanji-') && n !== NOM_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  evenement.respondWith(repondre(requete));
});

async function repondre(requete) {
  const cache = await caches.open(NOM_CACHE);
  const trouve = await cache.match(requete, { ignoreSearch: true });
  if (trouve) return trouve;
  if (requete.mode === 'navigate') {
    // Repli de navigation : toute page de l'application est servie par index.html.
    const accueil = await cache.match(PAGE_ACCUEIL);
    if (accueil) return accueil;
  }
  try {
    return await fetch(requete);
  } catch (erreur) {
    return new Response('Hors ligne : ce fichier n\'est pas en cache.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
