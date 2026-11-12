# AGENTS.md — Sanji (Copilote entremétier)

Statut : créé par délégation le 2026-10-02, allégé le 2026-11-11 (étape 3 de la refonte), en attente de validation de la propriétaire.

## À lire avant d'agir
1. `docs/plan-final-copilote-entremetier-v1.md` : fait foi pour le métier.
2. `docs/conception-technique-v1.md` : fait foi pour la technique (structure, état, fonctions).
3. `docs/reference-code.md` : le détail module par module (API, décisions par version). À lire avant de toucher à un module.
4. Fiche projet : `~/Atelier-Claude/Cerveau-Obsidian/01-Projets/Sanji.md`.

## Refonte en cours (depuis le 2026-11-11)
Plan validé par la propriétaire : trois onglets (Aujourd'hui, Semaine, Cuisine) au lieu de quatre, logique métier conservée, une PR par étape. Priorité d'affichage : les plats et les productions en évidence, les dates et repères en petit. La palette sera revue plus tard. Étape 3 (nettoyage technique, sans changement à l'écran) faite en version 147. Étape 4 faite en version 148 : l'onglet Production a disparu, sa liste du jour est dans Aujourd'hui (`ui/vue-aujourdhui.js` : menus du jour en grand, couverts, « À confirmer » sur une ligne, « À produire » = `corps` de `vue-jour.js` avec « Après service » compact) ; `#/production/<date>` reste la page d'un autre jour, ouverte depuis Semaine. Étape 5 faite en version 149 : l'onglet Articles a disparu, Semaine a deux volets (`ui/vue-semaine.js`) : « Jours » (carte « Préparation de la semaine », puis `vue-tableau.js` avec les plats en évidence) et « Achats » (`#/semaine/achats`, la liste de `vue-articles.js` ; `#/articles` y mène). Étape 6 faite en version 150 : troisième onglet Cuisine (`ui/vue-cuisine.js`, `#/cuisine`) : « Sanji a remarqué » (propositions d'apprentissage), fiches des éléments par rubrique, « Portions et règles » (les rubriques métier de Réglages, qui reviennent à Cuisine), puis « Réglages de l'app » ; la racine de Réglages ne garde que l'application (données, historique) et, à part, les outils avancés (assistant IA, apprentissage et essais) ; plus de lien Réglages sur Aujourd'hui. Étape 7 (finitions) faite en version 151 : la page Production d'un jour a un retour « ‹ Semaine » et la date en évidence, l'onglet Cuisine vouvoie comme le reste de l'app ; démarrage mesuré (135 modules, premier écran en moins d'une seconde en local, rien à changer) et mise à jour 146 → 150 vérifiée dans Chromium avec des données (bandeau « Nouvelle version prête », données et cases conservées). La refonte est terminée ; restent à décider par la propriétaire : la palette, la sauvegarde en ligne, le sort de l'assistant IA.

## Commandes
- Tests : `npm test` (Node 22, aucun paquet à installer). 1769 tests au 2026-11-12 (version 151).
- Régénérer la base métier embarquée : `npm run base`.
- Régénérer les repères de portion validés (`app/js/donnees/savoir-metier.js`, généré depuis `savoir/reperes-portion/savoir-metier.json`) : `npm run savoir`. Ne pas éditer le module à la main.
- Référentiel de savoir culinaire (brevet fédéral de chef de cuisine, contenu validé le 2026-10-04) : `savoir/culinaire/` (lire `LISEZ-MOI.md`) ; `npm run culinaire` valide les thèmes et `savoir/culinaire/rattachements.json` (choisi à la main, aucun chiffre), régénère l'index et le module embarqué `app/js/donnees/savoir-culinaire.js` (généré, environ 405 Ko, ne pas l'éditer) ; `npm test` échoue si une entrée ou un rattachement n'est pas conforme, ou si le module n'est pas à jour.
- Servir en local : `npm run serve` (`outils/serveur-local.mjs`, Node, 127.0.0.1 seulement, sans cache), puis http://localhost:5173.
- Essai sur iPhone ou iPad, sur le réseau de la maison seulement : `sh outils/creer-certificat-local.sh` (une fois), puis `node outils/serveur-https-local.mjs`. Les clés vivent dans `.certificats-locaux/` (hors Git). Rien n'est publié.

## Structure
- `app/js/domaine/` : logique métier pure, sans DOM, testée (calcul des portions, standards, planification par date, apprentissage, import robuste). Les actions vivent dans `actions-*.js` ; `actions.js` n'est qu'une façade qui les réexporte.
- `app/js/harness/` : harness IA (le modèle propose, le chef décide). Aucun `fetch`, aucun DOM. Lire `docs/harness-ia.md` avant d'y toucher.
- `app/js/ui/` : vues et feuilles de saisie, aucune logique métier. Le routeur (`routeur.js`) ne connaît que des vues-relais exportant `titre` et `rendre` : un écran se refait en remplaçant son relais.
- `app/js/magasin.js` : état courant ; `agir(fn)` copie, applique, enregistre, redessine.
- `app/js/stockage.js` et `app/js/sauvegarde-auto.js` : IndexedDB (base `sanji`) et copies de sécurité automatiques.
- `app/js/donnees/` : modules générés (base métier, repères de portion, référentiel culinaire). Ne jamais les éditer à la main.
- `app/sw.js` : cache hors ligne. `VERSION` y est égale à `VERSION_APP` de `app/js/version.js`.
- `app/css/style.css` : feuille de style écrite à la main (palette « Grand large », mode sombre désactivé, quantités en IBM Plex Mono embarquée, texte 15 px au moins, jamais un état par la couleur seule).
- `tests/` : tests Node sans dépendance ; `tests/aide-dom.js` est un faux DOM qui fait tourner les vues.
- `savoir/` : tout le savoir métier (carte : `savoir/LISEZ-MOI.md`).
- `docs/` : plan métier, conception technique, référence du code, harness IA, journal et maquettes des refontes précédentes.
- `archives/` : anciennes versions. Rien n'y fait foi.

## Règles du projet
- Aucune dépendance, aucun build. Ne pas lancer `npm install`.
- Rien sous `app/` n'importe de fichier hors de `app/`. `js/domaine/` reste sans DOM.
- Aucune donnée de restaurant, aucun plat de la carte, aucun grammage d'exemple « maison » dans `app/`. Le vocabulaire culinaire général (formes de pâtes, risotto, rösti…) et le référentiel généré `app/js/donnees/savoir-culinaire.js` sont permis.
- Les jeux de test vivent dans `tests/jeux/`, portent l'étiquette `TEST_ONLY` et ne sont jamais importés par l'application.
- `app/js/donnees/base-metier.js` est généré : ne pas l'éditer à la main.
- Tout nouveau fichier de `app/` doit être ajouté à la liste de cache de `app/sw.js` (un test le vérifie).
- **Toute modification d'un fichier de `app/` impose d'incrémenter ensemble `VERSION` (`app/sw.js`) et `VERSION_APP` (`app/js/version.js`)**, sinon les appareils gardent l'ancienne version en cache.
- Tester dans un navigateur après un changement d'interface : les tests sous faux DOM ne voient ni la mise en page ni IndexedDB.
- **Un parcours se vérifie en le suivant à l'écran, comme le ferait le chef** (ouvrir l'écran, saisir, enregistrer), jamais en injectant les données par un script. Un script ne sert qu'à inspecter.
- Plus aucune validation manuelle : un menu enregistré crée seul ses composants, valides et attribués. Ne jamais réintroduire un bouton « valider ».
- La portion d'un plat se résout au calcul (`grammageEffectif`) : correction du plat, référence du nom, standard maison de la famille, standard maison de la catégorie (clé `groupe:…` dans `etat.standards` ; un légume sans famille en dépend), standard de base (repère validé ou de la base, origine `standard_base`, `repere: 'valide'|'base'`). Elle porte toujours son état de poids ; le calcul part de cet état.
- `BASE_METIER_ESTIMATION` est l'ancien nom de `STANDARD_BASE` (données enregistrées avant le 2026-10-04) : il se lit pareil (`estStandardBase` de `statuts.js`).
- Faux DOM : `querySelector` n'y cherche que par nom de balise. `querySelectorAll` y renvoie, comme une NodeList de navigateur, une liste SANS méthodes de tableau : `Array.from(...)` avant `.find`/`.filter` (v134, bug réel évité). Garder les champs dans une table plutôt que les retrouver par sélecteur. Le code de `app/js/` ne doit jamais lire une propriété propre au faux DOM (`enfants`, `tous`, `declencher` : un test le vérifie) ; un `<dialog>` signale `close` en différé, tester `open` plutôt qu'un drapeau.
- CSS : la classe `.case` est celle des cases à cocher des panneaux ; les cases dessinées du tableau s'appellent `.coche`.
- Piège du cache : après un changement, le navigateur sert encore l'ancienne version au premier rechargement. Recharger deux fois et vérifier « Version de l'application » dans Réglages avant de tester.
- Jamais de publication ni d'hébergement sans accord de la propriétaire.
- `savoir/base-metier/base-officielle-production-stock-hygiene.md` est une donnée de référence : la lire, ne pas la modifier.
- Le dépôt Git local existe depuis le 2026-10-03 (branche `main`, premier commit `76f894b`), dépôt distant privé GitHub `dmeloz/sanji` (`origin`) : le travail passe par des branches et des PR fusionnées dans `main`. Le dossier contient un `.obsidian` et un canvas « Sans titre » : ils sont exclus par `.gitignore`.
