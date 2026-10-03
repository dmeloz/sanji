# Plan final — Copilote entremétier V1

Statut : validé par l’utilisateur, intégrant l’audit croisé de la base métier et le patch « Alignement du plan V1 avec le workflow réel » (P1 à P6) et les sept réserves de relecture, appliqués le 2026-10-02 à sa demande. Ce document fait foi pour la V1 ; les valeurs génériques ne sont pas des recettes du restaurant.

## Objectif et périmètre

Application compagnon mobile-first en français sur iPhone/iPad, utilisable hors ligne. Transformer menus du jour, fiches de fonction et prévisions en quantités, planning et feuille de travail. Le chef garde toutes les décisions métier. Restaurant ouvert lundi–samedi, fermé dimanche ; lundi/mardi 8 h–16 h 30 ; mercredi–samedi 8 h–22 h. Deux menus du jour lundi–vendredi midi, communiqués le vendredi précédent. Vendredi/samedi servent à avancer le début de la semaine suivante, puis la planification glisse durant la semaine. Carte visible comme contexte mais exclue des quantités et commandes V1 ; sa charge sur le poste peut être signalée par créneau, sans portions ni recettes de carte (voir « Planification et charge »). Pas de stock théorique ni de module HACCP complet.

Menu 1 : plat complet attribué par défaut à l’entremétier, avec validation et exceptions mémorisables. Menu 2 : légumes et féculent attribués par défaut ; conserver l’intitulé complet mais ne pas attribuer automatiquement protéine ou sauce.

## Références et provenance

Recette et pratique restaurant > valeur générale de la base métier identifiée comme estimation > donnée « à préciser ». La recette restaurant définit ses propres ingrédients ; ne pas fusionner automatiquement deux recettes. Des paramètres généraux compatibles et manquants peuvent être proposés explicitement, jamais insérés silencieusement. Une correction d’un service ne modifie pas la recette de référence. Une nouvelle version de recette ne réécrit pas une production faite. Conserver provenance, statut de validation et version des paramètres utilisés.

Grammages définis selon le rôle du composant dans le plat : un risotto en plat principal et du riz en garniture ne partagent pas automatiquement leur portion. Les fiches types de la base métier sont des exemples, non des recettes du restaurant.

Chaque quantité affichée en exploitation porte un statut de provenance : `RESTAURANT_VALIDE`, `BASE_METIER_ESTIMATION`, `SAISI_SERVICE`, `CALCULE` ou `INCONNU`. Ces identifiants techniques s’écrivent sans accent ; les libellés à l’écran sont accentués (« validé restaurant », « estimation base métier », « saisi au service », « calculé », « inconnu »). Le calcul `CALCULE` indique les paramètres dont il dépend ; s’il dépend d’une estimation non validée, le résultat reste marqué « estimation à valider ». Les exemples de la documentation et les scénarios `TEST_ONLY` ne sont jamais une source de calcul en exploitation. Une commande ou une affirmation de compatibilité allergène ne peut pas se baser sur un scénario de test.

Glossaire — trois axes à ne pas confondre. **Provenance d’une quantité** : les cinq statuts ci-dessus. **Certitude d’une prévision** : estimée (prévision hors groupes), provisoire (répartition non confirmée d’un groupe à choix libre), confirmée (menu fixé ou choix réel d’un groupe). **État d’une tâche** : à préciser, à planifier, à faire, en cours, fait, écart à arbitrer. Le mot « provisoire » est réservé à la répartition d’un groupe ; un calcul fondé sur une estimation se dit « estimation à valider ».

## Entrées

Menu propre photographié/importé : transcrire date et deux intitulés exactement, faire valider la transcription, puis analyser et faire valider les composants du poste. Ignorer les annotations manuscrites comme données ; ne pas prétendre que l’OCR est infaillible. Saisie/correction manuelle toujours possible.

Saisir séparément les prévisions modifiables de portions menu 1 et menu 2 **hors groupes**. Ne pas déduire ces deux chiffres d’un seul total de couverts. Une fiche de fonction possède identifiant, date/service, couverts, choix, allergies et remarques ; modification ou annulation remplace/retire son besoin, sans double comptage. Menu fixé = portions confirmées. Choix libre = couverts confirmés, répartition provisoire explicitement saisie/validée, puis remplacée par le choix réel. Étiqueter toute source : estimée, provisoire ou confirmée.

Les prévisions menu 1 et menu 2 hors groupes sont éditables à tout moment et portent un horodatage. Les fiches de fonction conservent leur version et leurs choix ; un changement reçu après le début de la production produit un écart à arbitrer. Après service, les ventes réelles sont affichées comme repère lors de la saisie des prévisions futures ; l’application peut proposer une révision, que le chef valide. Aucune prévision n’est modifiée automatiquement et les quantités précédemment produites ne sont jamais réécrites. L’absence de saisie de ventes ne bloque pas la planification de la semaine suivante.

## Moteur de calcul

Chaque composant affiche une unité adaptée : produit simple en poids sec/cru ou pièces ; préparation maison en quantité finie à produire ; composant vague en portions avec composition à définir. Une recette est facultative pour afficher une tâche simple, mais les ingrédients et commandes détaillés exigent des paramètres suffisants.

Chaîne de calcul uniquement sur les étapes applicables : quantité servie → avant portionnement → avant cuisson → avant parage → brut à prévoir. Parage dépend de la forme achetée ; cuisson de la méthode ; portionnement du geste. Ne jamais compter deux fois la même perte. L’absorption des féculents est un gain de poids. Afficher la formule, les unités, la provenance et les valeurs manquantes. Aucune estimation générique non validée ne devient automatiquement une commande.

Si une valeur générique influence fortement la quantité brute, marquer « à mesurer » et proposer occasionnellement une pesée avant/après pour remplacer l’estimation par une mesure maison, sans obliger à saisir des pesées à chaque service.

## Planification et charge

Pour chaque production conserver : service de destination, jour suggéré, jour décidé, quantité cible, quantité réelle, état, et éventuellement une estimation de charge **courte/moyenne/longue**. Signaler une journée chargée sans prétendre calculer un temps exact si les durées n’ont pas été mesurées.

L’application planifie par créneau de travail, pas seulement par date : avant service de midi, après service de midi et, les jours concernés, avant service du soir. Les horaires d’ouverture du restaurant ne sont pas des heures de disponibilité automatique du chef ; les capacités et échéances de tâches restent configurables. La V1 se limite à ces trois créneaux fixes, sans horaires ni agenda. Deux échelles restent distinctes : la **charge d’une production** (courte / moyenne / longue) et l’**état d’un créneau** (libre / chargé / indisponible).

Les créneaux réellement disponibles ne sont pas présumés, notamment ceux du samedi utilisés pour avancer lundi et mardi : le chef règle une semaine type (état par défaut de chaque créneau), modifiable jour par jour. Tant que la semaine type n’est pas confirmée, l’application le signale comme point à confirmer.

Avance habituelle : jusqu’à deux jours calendaires ; cette fenêtre est une préférence d’organisation. À partir de la publication des menus le vendredi, proposer des avances vendredi après-midi et samedi pour lundi/mardi. Besoins et suggestions sont recalculés à chaque changement d’entrée (menu, prévision, fiche, créneau, production) ; le mardi après service sert de revue de mi-semaine pour les préparations de mercredi à vendredi. Le dimanche est non travaillé, sans tâche, et reste compté en temps de conservation. Toute avance au-delà de deux jours calendaires (vendredi → lundi, samedi → mardi, vendredi → mardi) est signalée comme exception et nécessite une règle spécifique validée pour la préparation concernée, qui fixe son avance maximale en jours ; elle n’est jamais autorisée globalement. Si la conservation n’est pas validée, proposer uniquement une action préparatoire compatible ou laisser la tâche à décider ; ne jamais marquer le produit fini comme couvert. Séparer **avance de travail souhaitée** de **limite d’utilisation validée par l’établissement**. Une suggestion de date ne certifie jamais la conservation ; signaler « conservation à confirmer » si la limite maison manque. Déplacement manuel permis avec alerte hors règle.

L’utilisateur peut signaler une charge de carte ou une indisponibilité de poste pour un créneau (libre / chargé / indisponible). Cette information influe seulement sur la suggestion du moment de production et les alertes de surcharge ; elle ne crée pas de portions de carte ni de recettes fictives. Les productions des menus du midi ne doivent pas être automatiquement planifiées sur un créneau occupé par le service du soir.

États : à préciser, à planifier, à faire, en cours, fait, écart à arbitrer. Au marquage « fait », proposer la cible et permettre une correction immédiate du réel. Une modification des prévisions n’altère jamais le réel ; afficher l’écart et laisser choisir complément, ajustement ou aucune production supplémentaire.

## Interfaces

**Tableau blanc hebdomadaire** : chaque jour affiche en premier les intitulés originaux et complets des deux menus, puis les prévisions utiles, les fiches de fonction liées au service et les points à confirmer. Chaque fiche donne accès à ses informations utiles : nombre de personnes, horaire, choix de menu confirmés ou non, allergies et remarques ; le nombre de fiches seul ne suffit pas à la décision de production. Vue d’anticipation, sans longue liste de tâches. Le vendredi et le samedi, rendre la semaine suivante visible sans faire disparaître la semaine en cours. Les services du soir et le samedi restent visibles comme occupation du poste, mais ne génèrent pas de besoins menu du jour puisqu’ils n’en ont pas.

**Feuille quotidienne** : à faire aujourd’hui avec quantité/unité/destination ; déjà prêt pour le service ; décisions nécessaires ; à avancer si possible. Un toucher ouvre calcul, provenance et recette éventuelle. Actions courtes : préciser, planifier, fait, corriger, reporter, décider. Une tâche du samedi pour lundi est visible aux deux endroits.

## Vérification produits et commande

Sans stock théorique, séparer **besoin brut calculé**, **quantité vérifiée disponible pour ce besoin**, **quantité proposée à commander**. Mini check-list : quantité suffisante vérifiée / à commander / à vérifier. Une simple impression de disponibilité ne vaut pas vérification de quantité. Si le besoin évolue, repasser uniquement les produits touchés à « à revérifier ». Quantité réellement à acheter modifiable ; conditionnement si connu. Date limite de commande réglable par fournisseur ; alerte si dépassée ou incompatible ; si absente, « délai fournisseur à renseigner ». Pas de promesse d’approvisionnement garanti.

## Allergènes, service et sauvegarde

Afficher les allergies des fiches sur le service et les composants concernés. Une fiche type générale, même renseignée, ne suffit pas à attester la compatibilité : recette restaurant et ingrédients réellement utilisés doivent être validés. Sinon « allergènes à confirmer ». Adaptation/substitution confirmée par l’humain et tracée.

Après service, saisie courte et facultative des ventes, surplus utilisable ou rebut ; ne pas confondre rebut avec pertes normales de parage/cuisson. Historique des modifications et export/restauration. Vues, calculs, saisie manuelle, changements de prévisions, marquage fait et export utilisables hors réseau. OCR hors ligne non promis avant test sur appareils visés.

## Tests d’acceptation — scénarios paramétriques

Les tests décrivent des comportements, **sans noms de plats issus d’une semaine passée, sans grammages d’exemple et sans quantité fictive intégrée aux données de production**. Les éventuels jeux de test techniques sont créés séparément, portent l’étiquette `TEST_ONLY` et ne sont jamais importés dans les réglages, recettes, catalogue, prévisions ou semaines réelles. Aucune valeur de test ne peut devenir une valeur par défaut. Une base neuve ne contient aucun couvert, recette restaurant ou production prérempli.

1. Un produit sec et une préparation maison du même menu affichent chacun l’unité correspondant à leur usage ; une fiche recette absente ne masque pas une tâche simple.
2. Les besoins des menus 1 et 2 restent indépendants ; le grammage dépend du rôle du composant dans le plat.
3. Le brut à prévoir applique uniquement les transformations pertinentes à la forme achetée et à la méthode, sans double perte.
4. Un composant générique reste planifiable en portions ; sa composition et sa commande détaillée attendent validation.
5. La modification ou annulation d’une fiche retire son ancien besoin ; le choix provisoire d’un groupe est remplacé, non ajouté, par le choix confirmé.
6. Une hausse de prévision après production conserve la quantité réellement faite et affiche un écart à arbitrer.
7. Une production avancée pour la semaine suivante reste liée à son service ; dimanche compte dans le temps écoulé et toute exception d’avance nécessite la règle de préparation validée.
8. Une allergie de groupe reste visible ; aucune compatibilité n’est affirmée sans ingrédients restaurant validés et décision humaine pour l’adaptation.
9. Si un besoin change après vérification des produits, seuls les contrôles concernés repassent à vérifier ; besoin brut, disponible vérifié et commande restent séparés.
10. Un délai de commande dépassé ou inconnu est signalé ; la charge d’un créneau n’est pas présentée comme une durée de travail mesurée.
11. En mode avion sur l’appareil ciblé, lecture des menus enregistrés, saisie manuelle, calculs, statuts, sauvegarde et export restent possibles.
12. Une production se planifie sur un créneau (avant midi, après midi, avant soir) et non sur une simple date ; lundi et mardi n’ont pas de créneau avant soir, dimanche n’en a aucun.
13. Une avance du samedi pour le lundi est acceptée avec « conservation à confirmer » si la limite maison manque ; une avance de plus de deux jours (samedi → mardi, vendredi → lundi, vendredi → mardi) sans règle validée pour la préparation est signalée hors règle et ne couvre pas le besoin.
14. Un créneau signalé chargé ou indisponible par la carte n’est jamais proposé automatiquement ; ce signalement ne crée ni portion ni recette de carte.
15. Le vendredi et le samedi, le tableau blanc montre la semaine en cours et la semaine suivante ; une tâche du samedi pour le lundi apparaît sur les deux feuilles quotidiennes.

Critère final : à l’arrivée au poste, le chef voit ce qui est prêt, ce qui reste à faire avant le prochain service, ce qui peut être avancé après service, les quantités calculables et les décisions encore ouvertes, sans confusion entre données de démonstration et données de l’établissement.
