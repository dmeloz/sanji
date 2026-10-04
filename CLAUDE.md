# CLAUDE.md — Sanji (Copilote entremétier)

Statut : créé par délégation le 2026-10-02, en attente de validation de la propriétaire.

## À lire avant d'agir
1. `docs/plan-final-copilote-entremetier-v1.md` : fait foi pour le métier.
2. `docs/conception-technique-v1.md` : fait foi pour la technique (structure, état, fonctions).
3. Fiche projet : `~/Atelier-Claude/Cerveau-Obsidian/01-Projets/Sanji.md`.

## Commandes
- Tests : `npm test` (Node 22, aucun paquet à installer). 568 tests au 2026-10-04.
- Régénérer la base métier embarquée : `npm run base`.
- Régénérer les repères de portion validés (`app/js/donnees/savoir-metier.js`, généré depuis `savoir/reperes-portion/savoir-metier.json`) : `npm run savoir`. Ne pas éditer le module à la main.
- Référentiel de savoir culinaire (brevet fédéral de chef de cuisine, contenu validé le 2026-10-04) : `savoir/culinaire/` (lire `LISEZ-MOI.md`) ; `npm run culinaire` valide les thèmes et `savoir/culinaire/rattachements.json` (choisi à la main, aucun chiffre), régénère l'index et le module embarqué `app/js/donnees/savoir-culinaire.js` (généré, environ 405 Ko, ne pas l'éditer) ; `npm test` échoue si une entrée ou un rattachement n'est pas conforme, ou si le module n'est pas à jour.
- Servir en local : `npm run serve`, puis http://localhost:5173.
- Essai sur iPhone ou iPad, sur le réseau de la maison seulement : `sh outils/creer-certificat-local.sh` (une fois), puis `node outils/serveur-https-local.mjs`. Les clés vivent dans `.certificats-locaux/` (hors Git). Rien n'est publié.

## Structure
- `app/js/domaine/` : logique métier pure, sans DOM, testée. Les signatures réelles du code font foi sur la conception.
  - `savoir.js` : le savoir culinaire (familles de produits, groupes, portion effective, standards maison). Un seul lexique, aucun chiffre : les coefficients viennent des standards de base (`standards-base.js`).
  - `standards-base.js` : les STANDARDS DE BASE (décision du 2026-10-04 « Standards de base et ajustement terrain ») : base métier + repères de portion validés + référentiel culinaire, utilisés directement par les calculs, statut `STANDARD_BASE`, libellé « standard de base » ; la valeur de la propriétaire passe toujours devant (correction du plat > référence du nom > standard maison de la famille puis de la catégorie > standard de base). API (détail en tête du fichier) : `standardDeBase(sujet, usage, { etatPoids, regle })` → `{ usage, valeur, fourchette:{min,max}, unite, uniteSource, etatPoids, sens, origine:'referentiel'|'base_metier', statut, libelle, cible, provenance:{id|table, source, verification, confiance, version}, ecart:null|{referentiel, base_metier}, coefficient? }` ; `rendementDeBase(famille, 'parage'|'cuisson')`, `reperesConservation(famille)`, `reperesCuisson(famille)`, `reperesAide(familleOuTheme)`, `rattachementsDe(usage)`, `texteProvenance(std)`, `USAGES`, `REGLES_GENERALES`. Sujet : clé de famille, `groupe:<clé>`, `categorie:<clé>` ou null. Valeur : milieu de la fourchette (quantités, rendements, temps), borne prudente pour l'hygiène (`sens` du rattachement), seuil seul tel quel ; référentiel quand `verification.resultat === 'confirmee'`, sinon base métier, sinon référentiel ; `ecart` quand les deux diffèrent. Seul ce module importe `donnees/savoir-culinaire.js` (un test le vérifie : ajouter tout nouvel importeur à sa liste).
  - `analyse-menu.js` + `vocabulaire-plats.js` : lecture des intitulés (`lirePlat`) : éléments au poste, hors poste ou à confirmer selon le menu ; sauce implicite du menu 1 proposée « à confirmer », jamais choisie ; mémoire d'attribution par `nom|menu`. Vocabulaire générique, sans chiffre.
  - `validation.js` + `actions-validation.js` : assistant de validation des portions (une estimation de repère ne devient un standard maison que par la valeur choisie par la propriétaire ; « seulement cette fois » et « plus tard » ne touchent jamais au standard). `actions-achats.js` : liste « à commander » à trois états (suggéré, noté, retiré) ; une ligne fondée sur une valeur INCONNU ne se note qu'avec une quantité tapée ; une ligne calculée sur les standards de base se note sans quantité (noter = confirmer), commandable pour le besoin majoré de la marge (`suiviProduit(...).quantiteCommandable`, `origineQuantite: 'standard_base'`) ; `quantiteAcheter` n'est jamais remplie par le calcul. `calculerComposant(...).aValider` ne compte plus que les valeurs INCONNU (et la recette non validée) ; `standardBase` dit qu'un standard de base y contribue ; `aMesurer` reste une information. Interface : `ui/feuille-validation.js`.
  - `feuille.js` : analyse du texte collé d'une feuille de menus.
  - `tableau-blanc.js` : données de l'accueil. `bord` = le tableau de bord (menus du jour et des 2 jours suivants, fiches de fonction, « À confirmer » de 3 lignes au plus sans quantité manquante, production et commandes) ; `contexte` (ancienne note) ne s'affiche plus mais désigne la semaine par défaut.
  - `planification.js` : `feuilleDuJour(...).lecture` donne l'ordre de lecture de la feuille Jour (menu 1, menu 2, autres, après service, faites). Étapes à avance propre : la règle de préparation (`etat.regles`) peut porter `etapes: [{cle, libelle, avanceMaxJours}]` (la dernière = finition) ; `assurerProductions` crée alors une production `preparatoire` par étape (`etapeCle`, `ordre`), `regleDe(etat, composant, etapeCle)` évalue chaque étape à son propre maximum, `etapesComposant` les liste. Aucune étape ni durée par défaut ; sans étapes, rien ne change. Pâtes et risotto du menu 1 (production principale d'un composant menu 1, féculent, plat_principal) : jour même, jamais proposés en avance (`avancesPossibles`, `lotsPossibles`, « Après service »), sauf `avanceMaxJours` > 0 dans la règle du nom ou production déjà planifiée à la main. `lecture.service1/2` est triée par rôle (base féculent, garnitures féculent puis légumes, composant_recette, herbe, sauce). Conservation : `evaluerAvance(date, service, regle, repere)` ; sans limite saisie (`limiteUtilisationJours`), `repereConservation(composant)` (standard de base, plus courte durée en jours des produits cuits de la famille) remplace « conservation à confirmer » (`conservation: 'referentiel'`, `repere`) et AVERTIT au-delà de sa durée (riz cuit : dès J-2) sans bloquer ni classer « hors règle » ; seule la limite saisie bloque. `aideRefroidissement()` : phrase de l'aide « Après service » (50 à 10 °C en 2 h au plus). Rattachements en `h`, `semaines`, `mois` : usages `refroidissement`, `limite_duree`, `duree_stockage` (jamais convertis en jours).
- `app/js/magasin.js` : état courant ; `agir(fn)` copie, applique, enregistre, redessine.
- `app/js/stockage.js` : IndexedDB (base `sanji`, magasins `etat` et `photos`).
- `app/js/ui/` : vues et panneaux de saisie. Aucune logique métier ici. Quatre onglets : Tableau (`vue-tableau.js`, tableau de bord à 4 zones), Jour (`vue-jour.js`, une liste de mise en place cochable), Produits, Réglages. `vue-menus.js` saisit toute la semaine.
- Identité visuelle (décision du 2026-10-03, remplace le « tableau blanc » de la section 16) : épurée et professionnelle. Surfaces claires et opaques, filets fins plutôt que cadres et ombres, un seul accent (bleu) et une encre (`--encre`) pour l'action principale, police système, pas de dégradé, pas de police téléchargée. `.feutre` ne désigne plus qu'une graisse (le nom est resté). Ne jamais réintroduire écriture manuscrite, post-it ni cadre d'aluminium.
- `app/sw.js` : cache hors ligne. `VERSION` y est égale à `VERSION_APP` de `app/js/version.js`.
- `tests/aide-dom.js` : faux DOM qui fait tourner les vues sous Node.
- `savoir/` : tout le savoir métier, au même endroit (carte : `savoir/LISEZ-MOI.md`). `base-metier/` = la base officielle de production, stock et hygiène (référence) ; `reperes-portion/` = les six repères validés ; `culinaire/` = le référentiel du brevet fédéral.
- `docs/` : plan métier, conception technique, patch du workflow, inventaire v23, journal de refonte.
- `archives/` : anciennes versions du plan, anciens écrans, échanges avec Perplexity (`perplexity-2026-10-03/`, hors Git). Rien n'y fait foi.

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
- Faux DOM : `querySelector` n'y cherche que par nom de balise. Garder les champs dans une table plutôt que les retrouver par sélecteur.
- CSS : la classe `.case` est celle des cases à cocher des panneaux ; les cases dessinées du tableau s'appellent `.coche`.
- Piège du cache : après un changement, le navigateur sert encore l'ancienne version au premier rechargement. Recharger deux fois et vérifier « Version de l'application » dans Réglages avant de tester.
- Jamais de publication ni d'hébergement sans accord de la propriétaire.
- `savoir/base-metier/base-officielle-production-stock-hygiene.md` est une donnée de référence : la lire, ne pas la modifier.
- Le dépôt Git local existe depuis le 2026-10-03 (branche `main`, premier commit `76f894b`), sans dépôt distant. Le dossier contient un `.obsidian` et un canvas « Sans titre » : ils sont exclus par `.gitignore`.
