// Service worker : tout `app/` est mis en cache à l'installation, puis servi « cache d'abord ».
// Règle du projet : tout nouveau fichier de app/ s'ajoute à FICHIERS ET la VERSION s'incrémente
// (js/version.js doit porter la même valeur). Un test vérifie la liste.

const VERSION = '119';
const NOM_CACHE = `sanji-v${VERSION}`;
const PAGE_ACCUEIL = 'index.html';

const FICHIERS = [
  'css/style.css',
  'icones/icone-180.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'index.html',
  'js/domaine/actions-achats.js',
  'js/domaine/actions-apprentissage.js',
  'js/domaine/actions-ajustements.js',
  'js/domaine/actions-validation.js',
  'js/domaine/actions-articles.js',
  'js/domaine/actions-couverts.js',
  'js/domaine/actions-fiches.js',
  'js/domaine/actions-mots.js',
  'js/domaine/actions-preparation.js',
  'js/domaine/actions-semaine.js',
  'js/domaine/actions.js',
  'js/domaine/ajustements.js',
  'js/domaine/allergenes.js',
  'js/domaine/apprentissage.js',
  'js/domaine/analyse-menu.js',
  'js/domaine/base.js',
  'js/domaine/articles.js',
  'js/domaine/calcul.js',
  'js/domaine/couverts-midi.js',
  'js/domaine/preparation.js',
  'js/domaine/dates.js',
  'js/domaine/notes-dev.js',
  'js/domaine/rapport-apprentissage.js',
  'js/domaine/rapport-diagnostic.js',
  'js/domaine/retour-essai.js',
  'js/domaine/historique.js',
  'js/domaine/mise-en-place.js',
  'js/domaine/fiches-retenues.js',
  'js/domaine/mots-retenus.js',
  'js/domaine/cloture.js',
  'js/domaine/fiches-elements.js',
  'js/domaine/decisions.js',
  'js/domaine/etat.js',
  'js/domaine/feuille.js',
  'js/domaine/planification.js',
  'js/domaine/points.js',
  'js/domaine/produits.js',
  'js/domaine/savoir.js',
  'js/domaine/standards-base.js',
  'js/domaine/statuts.js',
  'js/domaine/tableau-blanc.js',
  'js/domaine/validation.js',
  'js/domaine/vocabulaire-plats.js',
  'js/donnees/base-metier.js',
  'js/donnees/savoir-culinaire.js',
  'js/donnees/savoir-metier.js',
  'js/harness/commandes.js',
  'js/harness/contexte.js',
  'js/harness/contrats.js',
  'js/harness/fournisseur.js',
  'js/harness/horloge.js',
  'js/harness/lecture-fiche-ia.js',
  'js/harness/lecture-photo-ia.js',
  'js/harness/orchestrateur.js',
  'js/harness/outils.js',
  'js/harness/parcours-planning.js',
  'js/harness/politiques.js',
  'js/harness/precisions-ia.js',
  'js/harness/propositions.js',
  'js/harness/trace.js',
  'js/harness/validateur.js',
  'js/magasin.js',
  'js/main.js',
  'js/stockage.js',
  'js/ui/assistant-planning.js',
  'js/ui/assistant-reglages.js',
  'js/ui/champs.js',
  'js/ui/dernier-envoi.js',
  'js/ui/reinitialiser-semaine.js',
  'js/ui/dom.js',
  'js/ui/ecran-allume.js',
  'js/ui/elements.js',
  'js/ui/corriger-nom.js',
  'js/ui/enseigner-mot.js',
  'js/ui/feuille-cloture.js',
  'js/ui/feuille-fiche-element.js',
  'js/ui/feuille-couverts.js',
  'js/ui/feuille-decisions.js',
  'js/ui/feuille-services.js',
  'js/ui/feuille-validation.js',
  'js/ui/fiches.js',
  'js/ui/lecture-fiche.js',
  'js/ui/format.js',
  'js/ui/fournisseur-web.js',
  'js/ui/glisser.js',
  'js/ui/horsligne.js',
  'js/ui/menu-du-jour.js',
  'js/ui/messages.js',
  'js/ui/nouvelle-version.js',
  'js/ui/panneau.js',
  'js/ui/photo.js',
  'js/ui/reference.js',
  'js/ui/reperes-metier.js',
  'js/ui/routeur.js',
  'js/ui/taches.js',
  'js/ui/vue-aujourdhui.js',
  'js/ui/vue-composant.js',
  'js/ui/vue-detail.js',
  'js/ui/vue-fiche.js',
  'js/ui/vue-fiches-elements.js',
  'js/ui/vue-historique.js',
  'js/ui/vue-import.js',
  'js/ui/vue-preparer.js',
  'js/ui/retours-essai.js',
  'js/ui/journal-diagnostic.js',
  'js/ui/centre-dev.js',
  'js/ui/notes-dev.js',
  'js/ui/section-notes-dev.js',
  'js/ui/section-apprentissage.js',
  'js/ui/section-diagnostic.js',
  'js/ui/vue-jour.js',
  'js/ui/vue-menus.js',
  'js/ui/vue-poste.js',
  'js/ui/vue-production.js',
  'js/ui/vue-produits.js',
  'js/ui/vue-reglages.js',
  'js/ui/vue-semaine.js',
  'js/ui/vue-stock.js',
  'js/ui/vue-articles.js',
  'js/ui/vue-tableau.js',
  'js/version.js',
  'manifest.webmanifest',
  'polices/IBMPlexMono-Medium.woff2',
  'polices/IBMPlexMono-SemiBold.woff2',
  'polices/LICENSE.txt',
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
