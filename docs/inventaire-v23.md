# Sanji v23 — Inventaire de l'existant (A-P0)

Statut : inventaire de départ avant la refonte A (Tableau, Jour, Réglages), établi le 2026-10-04 par lecture du code et des écrans. Aucun comportement n'a été modifié. Les tests qui verrouillent cet inventaire sont dans `tests/non-regression-a-p0.test.js`. FAITS = lus dans le code ou observés ; PROPOSITIONS = destinations suggérées, à valider.

## 1. Routes (location.hash, `app/js/ui/routeur.js`)
| Adresse | Vue | Onglet actif | Paramètre |
|---|---|---|---|
| `#/tableau[/date]` | Tableau (accueil) | Tableau | lundi de la semaine (défaut : semaine désignée par le contexte) |
| `#/menus[/date]` | Menus de la semaine | Tableau | lundi |
| `#/detail[/date]` | Détail d'un jour | Tableau | date (défaut : aujourd'hui) |
| `#/jour[/date]` | Feuille du jour | Jour | date (défaut : aujourd'hui) |
| `#/composant/id` | Fiche d'un plat | Jour | identifiant du composant |
| `#/produits[/date]` | Produits | Produits | lundi |
| `#/reglages` | Réglages | Réglages | aucun |
Adresses historiques : `#/accueil`, `#/semaine[/date]` et toute adresse inconnue mènent au Tableau (le lien « Semaine » du Détail d'un jour utilise encore `#/semaine/…`). Aucun lien direct vers un bloc de Réglages.

## 2. Écrans et fichiers
`vue-tableau.js` (174 l.), `vue-jour.js`, `vue-detail.js`, `vue-menus.js`, `vue-produits.js`, `vue-reglages.js`, `vue-composant.js`, plus `taches.js` (carte de tâche et panneaux), `fiches.js`, `champs.js`, `panneau.js`, `elements.js`. Logique métier dans `app/js/domaine/` (3 230 lignes), sans DOM ; interface dans `app/js/ui/` (3 143 lignes).

## 3. Liens sortants du Tableau
- Note du contexte (`tableau-blanc.js`) : vers `#/reglages` (portions à régler), `#/menus/<semaine>` (prévisions), `#/jour/<date>` (ouvrir la feuille), `#/composant/<id>` (tâche ou élément à préciser).
- Grille : nom d'un jour vers `#/detail/<date>` ; intitulé d'un plat vers `#/composant/<id>` ; cercle de prévision : panneau de saisie sur place ; résumé de mise en place vers `#/jour/<date>` ; points à confirmer vers `#/detail/<date>` ; flèches `#/tableau/<lundi±7>` ; pied : `#/menus/<lundi>`.
- Pas encore de lien vers : les fiches de fonction (banquets) en tant que telles, les commandes, un journal de changements.

## 4. Feuille Jour : états et rubriques (version 23)
Rubriques, dans l'ordre : À faire (par créneau, avec jauge « x sur y faits »), Attendu d'un autre jour, Déjà prêt, Décisions nécessaires, Pas encore chiffré, À faire en une fois, À avancer si possible (avances hors règle repliées). Les rubriques vides sont masquées. États d'une tâche : à préciser, à planifier, à faire, en cours, fait, écart. Gestes : Planifier, Reporter, Démarrer, Fait (un toucher, annulable 2 minutes), Corriger, Décider, Retirer. Fenêtre de décisions et d'avances : 4 jours après la date affichée (`HORIZON_AVANCES`).

## 5. Réglages : dix blocs (une seule page longue)
Standards maison (par catégorie puis famille ; environ 56 lignes), Semaine type des créneaux (avec capacité), Règles de préparation, Recettes du restaurant, Fournisseurs, Références maison mémorisées, Journal des modifications, Commandes (marge de sécurité), Sauvegarde (export, restauration, dernier export), État de l'application.
**Table réalisée (A-P2)** : la page `#/reglages` est une racine de quatre rubriques ; chaque rubrique est une sous-page `#/reglages/<clé>`, avec lien « ‹ Réglages ». Aucun réglage supprimé ni allégé.
| Ancien réglage (bloc) | Nouveau chemin | Touches depuis l'onglet |
|---|---|---|
| Standards maison | Réglages > Standards de production (`#/reglages/standards`) : réglés ou utilisés d'emblée, autres par catégorie repliés avec compteur « à régler », recherche locale | 2 |
| Références maison mémorisées | Réglages > Standards de production | 2 |
| Semaine type des créneaux, capacité | Réglages > Organisation du poste (`#/reglages/organisation`) | 2 |
| Règles de préparation | Réglages > Organisation du poste | 2 |
| Recettes du restaurant | Réglages > Produits et commandes (`#/reglages/produits`) | 2 |
| Fournisseurs | Réglages > Produits et commandes | 2 |
| Commandes (marge de sécurité) | Réglages > Produits et commandes | 2 |
| Sauvegarde (export, restauration, dernier export) | Réglages > Données et hors ligne (`#/reglages/donnees`) | 2 |
| État de l'application (version, hors ligne) | Réglages > Données et hors ligne | 2 |
| Journal des modifications | Réglages > Données et hors ligne | 2 |

Une clé de rubrique inconnue retombe sur la racine. Les liens existants vers `#/reglages` (note du Tableau, feuille Jour) mènent à la racine ; le lien « Régler le standard maison » de la fiche d'un plat mène à `#/reglages/standards`. Rien n'est supprimé ni redirigé définitivement : les rubriques « Menus et services », « Allergènes et sécurité », « Interface et accessibilité » et « À propos » du cahier des charges n'existent pas encore (aucun réglage actuel à y mettre).

## 6. Stockage et hors ligne
- **FAIT** : tout l'état est un seul document dans IndexedDB (base `sanji`, magasin `etat`, clé `principal`), réécrit en entier à chaque action ; les photos sont dans un magasin séparé. Si IndexedDB est indisponible, l'application passe en mémoire et affiche un bandeau « données non enregistrées ».
- **FAIT** : le journal est plafonné à 2 000 lignes ; un export contient tout l'état (sans les photos).
- **FAIT** : le service worker met en cache tous les fichiers de `app/` (un test vérifie la liste) ; version dans `app/sw.js` et `app/js/version.js`.
- **FAIT** : un « fait », sa quantité réelle et son instantané survivent à un export suivi d'un import (test).
- **NON VÉRIFIÉ** : comportement d'IndexedDB sur un vrai iPhone après fermeture complète ; seule l'inspection à l'écran peut le dire.

## 7. Constats pour la refonte (à traiter en A-P1)
1. **FAIT (défaut)** : modifier l'intitulé d'un menu qui retire un plat supprime la tâche non faite correspondante sans trace dans le journal (il ne note que « definirMenu »). Une tâche déjà faite est conservée. Test rouge assumé : `todo` dans `non-regression-a-p0.test.js`.
2. **FAIT** : aucune quantité absente ne cache une tâche (testé le samedi pour le lundi) ; en revanche, au-delà de 4 jours une production n'apparaît pas sur la feuille Jour (elle reste visible sur le Tableau et le Détail du jour).
3. **FAIT** : le cercle de prévision cliquable mesure 34 à 40 px de haut, sous la cible tactile de 44 px.
4. **FAIT** : la note du haut du Tableau mélange jusqu'à 6 sujets ; ses cases dessinées sont des liens.
5. **FAIT** : les fiches de fonction (banquets) n'ont pas de zone propre sur le Tableau.
6. **HYPOTHÈSE** : longueur de défilement de la grille du Tableau sur iPhone (jours empilés) ; à mesurer à 390 × 844.

## 8. Tests de non-régression posés (A-P0)
Aucun lien mort (toutes vues, base vide et complète) ; adresses historiques ; destinations du Tableau ; aucune tâche cachée par une quantité absente ; un changement de prévision (40 à 46) ne défait pas un « fait » ; journal des déplacements ; un « fait » survit à un export ; inventaire des dix blocs de Réglages et des sept vues ; une tâche faite survit à une modification de menu ; un test « rouge » assumé pour le défaut du point 7.1. Deux régressions volontaires (bloc de Réglages renommé, tâche masquée) ont été injectées puis retirées pour vérifier que les tests les détectent.
