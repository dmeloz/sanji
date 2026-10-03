# Plan final — Copilote entremétier V1

Statut : validé par l’utilisateur, intégrant l’audit croisé de la base métier. Ce document fait foi pour la V1 ; les valeurs génériques ne sont pas des recettes du restaurant.

## Objectif et périmètre

Application compagnon mobile-first en français sur iPhone/iPad, utilisable hors ligne. Transformer menus du jour, fiches de fonction et prévisions en quantités, planning et feuille de travail. Le chef garde toutes les décisions métier. Restaurant ouvert lundi–samedi, fermé dimanche ; lundi/mardi 8 h–16 h 30 ; mercredi–samedi 8 h–22 h. Deux menus du jour lundi–vendredi midi, communiqués le vendredi précédent. Vendredi/samedi servent à avancer le début de la semaine suivante, puis la planification glisse durant la semaine. Carte visible comme contexte mais exclue des calculs V1. Pas de stock théorique ni de module HACCP complet.

Menu 1 : plat complet attribué par défaut à l’entremétier, avec validation et exceptions mémorisables. Menu 2 : légumes et féculent attribués par défaut ; conserver l’intitulé complet mais ne pas attribuer automatiquement protéine ou sauce.

## Références et provenance

Recette et pratique restaurant > valeur générale de la base métier identifiée comme estimation > donnée « à préciser ». La recette restaurant définit ses propres ingrédients ; ne pas fusionner automatiquement deux recettes. Des paramètres généraux compatibles et manquants peuvent être proposés explicitement, jamais insérés silencieusement. Une correction d’un service ne modifie pas la recette de référence. Une nouvelle version de recette ne réécrit pas une production faite. Conserver provenance, statut de validation et version des paramètres utilisés.

Grammages définis selon le rôle du composant dans le plat : un risotto en plat principal et du riz en garniture ne partagent pas automatiquement leur portion. Les fiches types de la base métier sont des exemples, non des recettes du restaurant.

## Entrées

Menu propre photographié/importé : transcrire date et deux intitulés exactement, faire valider la transcription, puis analyser et faire valider les composants du poste. Ignorer les annotations manuscrites comme données ; ne pas prétendre que l’OCR est infaillible. Saisie/correction manuelle toujours possible.

Saisir séparément les prévisions modifiables de portions menu 1 et menu 2 **hors groupes**. Ne pas déduire ces deux chiffres d’un seul total de couverts. Une fiche de fonction possède identifiant, date/service, couverts, choix, allergies et remarques ; modification ou annulation remplace/retire son besoin, sans double comptage. Menu fixé = portions confirmées. Choix libre = couverts confirmés, répartition provisoire explicitement saisie/validée, puis remplacée par le choix réel. Étiqueter toute source : estimée, provisoire ou confirmée.

## Moteur de calcul

Chaque composant affiche une unité adaptée : produit simple en poids sec/cru ou pièces ; préparation maison en quantité finie à produire ; composant vague en portions avec composition à définir. Une recette est facultative pour afficher une tâche simple, mais les ingrédients et commandes détaillés exigent des paramètres suffisants.

Chaîne de calcul uniquement sur les étapes applicables : quantité servie → avant portionnement → avant cuisson → avant parage → brut à prévoir. Parage dépend de la forme achetée ; cuisson de la méthode ; portionnement du geste. Ne jamais compter deux fois la même perte. L’absorption des féculents est un gain de poids. Afficher la formule, les unités, la provenance et les valeurs manquantes. Aucune estimation générique non validée ne devient automatiquement une commande.

Si une valeur générique influence fortement la quantité brute, marquer « à mesurer » et proposer occasionnellement une pesée avant/après pour remplacer l’estimation par une mesure maison, sans obliger à saisir des pesées à chaque service.

## Planification et charge

Pour chaque production conserver : service de destination, jour suggéré, jour décidé, quantité cible, quantité réelle, état, et éventuellement une estimation de charge **courte/moyenne/longue**. Signaler une journée chargée sans prétendre calculer un temps exact si les durées n’ont pas été mesurées.

Avance habituelle : jusqu’à deux jours calendaires. Exception vendredi → lundi seulement pour une préparation configurée comme adaptée. Dimanche sans tâche, mais le temps écoulé compte. Séparer **avance de travail souhaitée** de **limite d’utilisation validée par l’établissement**. Une suggestion de date ne certifie jamais la conservation ; signaler « conservation à confirmer » si la limite maison manque. Déplacement manuel permis avec alerte hors règle.

États : à préciser, à planifier, à faire, en cours, fait, écart à arbitrer. Au marquage « fait », proposer la cible et permettre une correction immédiate du réel. Une modification des prévisions n’altère jamais le réel ; afficher l’écart et laisser choisir complément, ajustement ou aucune production supplémentaire.

## Interfaces

**Tableau blanc hebdomadaire** : intitulés complets menu 1 et menu 2, prévisions utiles, nombre de fiches de fonction, points à confirmer. Vue d’anticipation, sans longue liste de tâches. Accès simple à la semaine suivante vendredi/samedi.

**Feuille quotidienne** : à faire aujourd’hui avec quantité/unité/destination ; déjà prêt pour le service ; décisions nécessaires ; à avancer si possible. Un toucher ouvre calcul, provenance et recette éventuelle. Actions courtes : préciser, planifier, fait, corriger, reporter, décider. Une tâche du samedi pour lundi est visible aux deux endroits.

## Vérification produits et commande

Sans stock théorique, séparer **besoin brut calculé**, **quantité vérifiée disponible pour ce besoin**, **quantité proposée à commander**. Mini check-list : quantité suffisante vérifiée / à commander / à vérifier. Une simple impression de disponibilité ne vaut pas vérification de quantité. Si le besoin évolue, repasser uniquement les produits touchés à « à revérifier ». Quantité réellement à acheter modifiable ; conditionnement si connu. Date limite de commande réglable par fournisseur ; alerte si dépassée ou incompatible ; si absente, « délai fournisseur à renseigner ». Pas de promesse d’approvisionnement garanti.

## Allergènes, service et sauvegarde

Afficher les allergies des fiches sur le service et les composants concernés. Une fiche type générale, même renseignée, ne suffit pas à attester la compatibilité : recette restaurant et ingrédients réellement utilisés doivent être validés. Sinon « allergènes à confirmer ». Adaptation/substitution confirmée par l’humain et tracée.

Après service, saisie courte et facultative des ventes, surplus utilisable ou rebut ; ne pas confondre rebut avec pertes normales de parage/cuisson. Historique des modifications et export/restauration. Vues, calculs, saisie manuelle, changements de prévisions, marquage fait et export utilisables hors réseau. OCR hors ligne non promis avant test sur appareils visés.

## Tests d’acceptation

1. Cortecce et pesto : poids sec des pâtes distinct du poids fini du pesto ; recette facultative pour la tâche simple.
2. Risotto menu 1, orge perlé et pak choï menu 2 : besoins indépendants et grammages liés au rôle de chaque composant.
3. Courgettes grillées : calcul brut selon forme achetée, méthode et étapes applicables ; aucune perte comptée deux fois.
4. Légumes de saison : portions planifiées, aucune composition/commande inventée.
5. Fiche de groupe modifiée/annulée : ancien besoin remplacé/retiré ; choix libre provisoire remplacé par confirmé.
6. 600 g de pesto faits puis hausse de prévisions : réalisé inchangé ; écart affiché et décision humaine.
7. Production samedi pour lundi : deux dates cohérentes, dimanche compté, conservation non déclarée validée sans règle maison.
8. Allergy déclarée : alerte visible, aucune compatibilité affirmée sans ingrédients du restaurant validés.
9. Hausse d’un besoin après contrôle des produits : seuls les articles concernés deviennent « à revérifier » ; besoin brut, disponible vérifié et commande restent distincts.
10. Date limite fournisseur dépassée ou absente : alerte explicite ; charge quotidienne visible sans fausse précision.
11. Mode avion iPhone/iPad : consultation, saisie manuelle, calculs, marquage fait, sauvegarde et export possibles.

Les chiffres des scénarios sont fictifs et ne deviennent jamais des réglages du restaurant. Critère final : lundi matin, le chef voit immédiatement ce qui est prêt, ce qu’il doit produire, combien et quelles décisions restent à prendre.
