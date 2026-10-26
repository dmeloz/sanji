# Refonte interface 3 — lot 0

État de référence et propositions visuelles, sans modification de l’application. Maquettes de travail à décider : elles ne sont pas une décision validée.

## Cadre du relevé

- Application locale Sanji v134, largeur de fenêtre **390 px**, hauteur **844 px**, au 25 octobre 2026.
- État chargé par Réglages → Données → Restaurer depuis `tests/jeux/TEST_ONLY-etat-peuple.json`. Aucun JSON n’a été copié dans ce dossier et aucun geste de saisie métier n’a été validé pendant l’audit.
- Les captures « avant » sont des captures pleine page du navigateur à 390 px. Les SVG « après » sont des maquettes statiques, annotées avec le lot concerné. Elles ne représentent pas du code réalisé.
- La fixture contient des valeurs extrêmes de test (par exemple une quantité Penne hors norme); les captures les montrent telles qu’elles sont. Elles ne sont pas des recommandations culinaires.
- État temporel observé : le 5 octobre est passé. L’import de cette semaine est en lecture seule, la vue Articles « Aujourd’hui » est vide, et le brouillon proposé pour la semaine du 26 octobre dit qu’il n’y a rien à planifier. Ces états n’ont pas été remplacés par des données inventées.

## Avant / après par écran

| Écran | Avant — capture | Après — maquette annotée | Changements proposés, sans changement de comportement |
|---|---|---|---|
| Aujourd’hui | [PNG](avant/aujourdhui.jpg) | [SVG](apres/aujourdhui.svg) | Jours en liste claire, une priorité en tête, rappels plus bas. |
| Production | [PNG](avant/production.jpg) | [SVG](apres/production.svg) | Case, nom/état et quantité dans des colonnes de lecture stables; alerte sous la tâche. |
| Semaine | [PNG](avant/semaine.jpg) | [SVG](apres/semaine.svg) | Tête datée et couverts constante, menus M1/M2 plus compacts, décisions visibles après les jours. |
| Articles | [PNG](avant/articles.jpg) | [SVG](apres/articles.svg) | État vide qui nomme la période et la suite accessible. |
| Réglages | [PNG](avant/reglages.jpg) | [SVG](apres/reglages.svg) | Rubriques existantes regroupées avec des résumés et chevrons alignés. |
| Réglages → Données | [PNG](avant/donnees.jpg) | [SVG](apres/donnees.svg) | Export/restauration et journal visuellement distingués. |
| Import | [PNG](avant/import.jpg) | [SVG](apres/import.svg) | Repères de progression dans la page continue; saisies à plat et lecture seule préservée. |
| Préparer la semaine | [PNG](avant/preparer.jpg) | [SVG](apres/preparer.svg) | Couverts, valeur à confirmer et action finale dans trois niveaux de lecture. |
| Fiches des éléments | [PNG](avant/fiches-elements.jpg) | [SVG](apres/fiches-elements.svg) | Recherche sous le titre, catégories mieux séparées, résumés alignés. |
| Historique | [PNG](avant/historique.jpg) | [SVG](apres/historique.svg) | Une ligne datée par semaine et indicateurs lisibles ensemble. |
| Fiche d’un élément (production) | [PNG](avant/fiche-element.jpg) | [SVG](apres/fiche-element.svg) | Quantité, provenance et avertissement distingués. |
| Fiche retenue d’un élément (feuille) | [PNG](avant/fiche-element-retenue.jpg) | [SVG](apres/fiche-element-retenue.svg) | Nom/catégorie/portion dans l’ordre de lecture; actions groupées en bas. |
| Feuille Planifier | [PNG](avant/feuille-planifier.jpg) | [SVG](apres/planifier.svg) | Suggestion, date, évaluation puis action unique dans cet ordre. |
| Feuille Services du jour | [PNG](avant/services-du-jour.jpg) | [SVG](apres/services-du-jour.svg) | Couverts synthétisés, menus séparés, détail du jour repérable. |
| Feuille Détail du jour | [PNG](avant/detail-du-jour.jpg) | [SVG](apres/detail-du-jour.svg) | Sommaire daté puis menus, couverts, après-service et décisions. |
| Feuille Brouillon de planning | [PNG](avant/brouillon-planning.jpg) | [SVG](apres/brouillon-planning.svg) | État vide en tête, provenance lisible, aucun bouton de validation sans ligne. |

## Inventaire de maintenance

- Les classes présentes dans le DOM sur chacun des écrans sont relevées dans [classes-par-ecran.md](classes-par-ecran.md). Les feuilles listent aussi les classes communes de leur vue sous-jacente.
- Les répétitions et candidats CSS sont détaillés dans [regles-css-a-verifier.md](regles-css-a-verifier.md). Aucun sélecteur ni style n’a été modifié ou supprimé.

## Faits, hypothèses et propositions

- **Faits vérifiés :** vues et textes listés ci-dessus, états du jeu de test, viewport 390 × 844 px, présence des classes décrites.
- **Hypothèse :** une composition plus stable des lignes facilitera le balayage visuel en cuisine à une main. Le relevé n’est pas un test terrain sur iPhone.
- **Propositions :** toutes les maquettes « après » et les lots de la note de proposition. Rien n’est approuvé au-delà du lot 0.

## Hors périmètre du lot 0

Aucun fichier `app/`, `tests/`, `app/js/domaine/` ou `app/js/harness/` n’a été touché. Aucune règle CSS n’a été nettoyée, aucun test ni commit ni push n’a été fait. La fixture reste dans le profil local de Sanji pour consultation.
