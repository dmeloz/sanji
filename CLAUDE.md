# CLAUDE.md — Sanji (Copilote entremétier)

Statut : créé par délégation le 2026-10-02, en attente de validation de la propriétaire.

## À lire avant d'agir
1. `plan-final-copilote-entremetier-v1.md` : fait foi pour le métier.
2. `conception-technique-v1.md` : fait foi pour la technique (structure, état, fonctions).
3. Fiche projet : `~/Atelier-Claude/Cerveau-Obsidian/01-Projets/Sanji.md`.

## Commandes
- Tests : `npm test` (Node 22, aucun paquet à installer). 437 tests au 2026-10-04.
- Régénérer la base métier embarquée : `npm run base`.
- Régénérer les repères de portion validés (`app/js/donnees/savoir-metier.js`, généré depuis `connaissances/savoir-metier.json`) : `npm run savoir`. Ne pas éditer le module à la main.
- Servir en local : `npm run serve`, puis http://localhost:5173.
- Essai sur iPhone ou iPad, sur le réseau de la maison seulement : `sh outils/creer-certificat-local.sh` (une fois), puis `node outils/serveur-https-local.mjs`. Les clés vivent dans `.certificats-locaux/` (hors Git). Rien n'est publié.

## Structure
- `app/js/domaine/` : logique métier pure, sans DOM, testée. Les signatures réelles du code font foi sur la conception.
  - `savoir.js` : le savoir culinaire (familles de produits, groupes, portion effective, standards maison). Un seul lexique, aucun chiffre : les coefficients viennent de `donnees/base-metier.js`.
  - `analyse-menu.js` + `vocabulaire-plats.js` : lecture des intitulés (`lirePlat`) : éléments au poste, hors poste ou à confirmer selon le menu ; sauce implicite du menu 1 proposée « à confirmer », jamais choisie ; mémoire d'attribution par `nom|menu`. Vocabulaire générique, sans chiffre.
  - `feuille.js` : analyse du texte collé d'une feuille de menus.
  - `tableau-blanc.js` : données de l'accueil. `bord` = le tableau de bord (menus du jour et des 2 jours suivants, fiches de fonction, « À confirmer » de 3 lignes au plus sans quantité manquante, production et commandes) ; `contexte` (ancienne note) ne s'affiche plus mais désigne la semaine par défaut.
  - `planification.js` : `feuilleDuJour(...).lecture` donne l'ordre de lecture de la feuille Jour (menu 1, menu 2, autres, après service, faites).
- `app/js/magasin.js` : état courant ; `agir(fn)` copie, applique, enregistre, redessine.
- `app/js/stockage.js` : IndexedDB (base `sanji`, magasins `etat` et `photos`).
- `app/js/ui/` : vues et panneaux de saisie. Aucune logique métier ici. Quatre onglets : Tableau (`vue-tableau.js`, tableau de bord à 4 zones), Jour (`vue-jour.js`, une liste de mise en place cochable), Produits, Réglages. `vue-menus.js` saisit toute la semaine.
- Identité visuelle (décision du 2026-10-03, remplace le « tableau blanc » de la section 16) : épurée et professionnelle. Surfaces claires et opaques, filets fins plutôt que cadres et ombres, un seul accent (bleu) et une encre (`--encre`) pour l'action principale, police système, pas de dégradé, pas de police téléchargée. `.feutre` ne désigne plus qu'une graisse (le nom est resté). Ne jamais réintroduire écriture manuscrite, post-it ni cadre d'aluminium.
- `app/sw.js` : cache hors ligne. `VERSION` y est égale à `VERSION_APP` de `app/js/version.js`.
- `tests/aide-dom.js` : faux DOM qui fait tourner les vues sous Node.
- `archives/` : anciennes versions du plan et anciens écrans. Rien n'y fait foi.

## Règles du projet
- Aucune dépendance, aucun build. Ne pas lancer `npm install`.
- Rien sous `app/` n'importe de fichier hors de `app/`. `js/domaine/` reste sans DOM.
- Aucune donnée de restaurant, aucun nom de plat, aucun grammage d'exemple dans `app/`.
- Les jeux de test vivent dans `tests/jeux/`, portent l'étiquette `TEST_ONLY` et ne sont jamais importés par l'application.
- `app/js/donnees/base-metier.js` est généré : ne pas l'éditer à la main.
- Tout nouveau fichier de `app/` doit être ajouté à la liste de cache de `app/sw.js` (un test le vérifie).
- **Toute modification d'un fichier de `app/` impose d'incrémenter ensemble `VERSION` (`app/sw.js`) et `VERSION_APP` (`app/js/version.js`)**, sinon les appareils gardent l'ancienne version en cache.
- Tester dans un navigateur après un changement d'interface : les tests sous faux DOM ne voient ni la mise en page ni IndexedDB.
- **Un parcours se vérifie en le suivant à l'écran, comme le ferait le chef** (ouvrir l'écran, saisir, enregistrer), jamais en injectant les données par un script. Un script ne sert qu'à inspecter.
- Plus aucune validation manuelle : un menu enregistré crée seul ses composants, valides et attribués. Ne jamais réintroduire un bouton « valider ».
- La portion d'un plat se résout au calcul (`grammageEffectif`) : correction du plat, référence du nom, standard maison de la famille, standard maison de la catégorie (clé `groupe:…` dans `etat.standards` ; un légume sans famille en dépend), repère de la base. Elle porte toujours son état de poids ; le calcul part de cet état.
- Faux DOM : `querySelector` n'y cherche que par nom de balise. Garder les champs dans une table plutôt que les retrouver par sélecteur.
- CSS : la classe `.case` est celle des cases à cocher des panneaux ; les cases dessinées du tableau s'appellent `.coche`.
- Piège du cache : après un changement, le navigateur sert encore l'ancienne version au premier rechargement. Recharger deux fois et vérifier « Version de l'application » dans Réglages avant de tester.
- Jamais de publication ni d'hébergement sans accord de la propriétaire.
- `base-officielle-production-stock-hygiene.md` est une donnée de référence : la lire, ne pas la modifier.
- Le dépôt Git local existe depuis le 2026-10-03 (branche `main`, premier commit `76f894b`), sans dépôt distant. Le dossier contient un `.obsidian` et un canvas « Sans titre » : ils sont exclus par `.gitignore`.
