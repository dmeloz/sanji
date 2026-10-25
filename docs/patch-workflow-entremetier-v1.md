# Patch — Alignement du plan V1 avec le workflow réel

> **Note du 2026-10-25 (v134).** Document historique, conservé tel quel. Les passages sur les créneaux horaires (audit croisé, écart 2 ; P1 : « planifie par créneau de travail » et « créneau libéré après service » ; P3 : charge ou indisponibilité d’un créneau ; tests 10 et 12) sont caducs depuis la v134 : la planification repose sur le jour de travail (date cible) seul, décision de la propriétaire. Texte en vigueur : `plan-final-copilote-entremetier-v1.md` (révision du 2026-10-25) ; proposition de révision des décisions : [[2026-10-25 - Sanji - Suppression des creneaux horaires (revision de decisions)]].

Statut : appliqué le 2026-10-02 au « Plan final — Copilote entremétier V1 », à la demande de l’utilisateur. Version du plan avant patch : `archives/plan-final-copilote-entremetier-v1.avant-patch-2026-10-02.md`. Ne pas réappliquer. Le présent fichier est un patch de spécification, pas des données de restaurant ni un remplacement de la base métier.

## Résultat de l’audit croisé

Le plan couvre les menus 1 et 2, les groupes, la production anticipée, la vue du jour et le tableau blanc. Il reste toutefois quatre écarts avec le travail décrit par le chef de partie : (1) le samedi sert à préparer lundi **et éventuellement mardi**, ce qui ne rentre pas toujours dans une règle de deux jours calendaires ; (2) le service de midi et les créneaux d’après-service ne sont pas distingués, notamment le mardi ; (3) la carte, exclue du calcul V1, occupe malgré tout du temps au poste ; (4) les scénarios de test risquent d’être confondus avec des réglages ou des recettes réels. Le patch ci-dessous traite ces écarts sans introduire de stock théorique.

## P1 — Planification glissante fidèle au poste

**Ajouter à la section « Planification et charge » :**

> L’application planifie par créneau de travail, pas seulement par date : avant service de midi, après service de midi et, les jours concernés, avant service du soir. Les horaires d’ouverture du restaurant ne sont pas des heures de disponibilité automatique du chef ; les capacités et échéances de tâches restent configurables. À partir de la publication des menus le vendredi, proposer des avances vendredi après-midi et samedi pour lundi/mardi, puis recalculer après le service du mardi les préparations des jours suivants. Le dimanche est non travaillé et reste compté en temps de conservation. La fenêtre organisationnelle de deux jours est une préférence ; une avance samedi → mardi ou vendredi → lundi doit être signalée comme exception et nécessiter une règle spécifique validée pour la préparation concernée, non être autorisée globalement. Si la conservation n’est pas validée, proposer uniquement une action préparatoire compatible ou laisser la tâche à décider ; ne jamais marquer le produit fini comme couvert.

**Pourquoi :** le plan actuel permet vendredi → lundi mais omet explicitement la préparation éventuelle du mardi dès le samedi. Il ne distingue pas non plus le midi du créneau libéré après service.

## P2 — Ce que montre le tableau blanc

**Ajouter à la section « Tableau blanc hebdomadaire » :**

> Chaque jour affiche en premier les intitulés originaux des deux menus, puis les fiches de fonction liées au service avec un accès à leurs informations utiles : nombre de personnes, horaire, choix de menu confirmés ou non, allergies et remarques. Le nombre de fiches seul ne suffit pas à la décision de production. Le vendredi et le samedi, rendre la semaine suivante visible sans faire disparaître la semaine en cours. Les services du soir et le samedi restent visibles comme occupation du poste, mais ne génèrent pas de besoins menu du jour puisqu’ils n’en ont pas.

## P3 — Charge de la carte sans calcul de carte

**Ajouter à la section « Périmètre » et à « Planification et charge » :**

> La carte reste exclue des quantités et commandes V1, mais l’utilisateur peut signaler une charge de carte ou une indisponibilité de poste pour un créneau (libre / chargé / indisponible). Cette information influe seulement sur la suggestion du moment de production et les alertes de surcharge ; elle ne crée pas de portions de carte ni de recettes fictives. Les productions des menus du midi ne doivent pas être automatiquement planifiées sur un créneau occupé par le service du soir.

## P4 — Frontière entre prévision, groupe et réalisé

**Ajouter à « Prévisions et groupes » :**

> Les prévisions menu 1 et menu 2 hors groupes sont éditables à tout moment et portent un horodatage. Les fiches de fonction conservent leur version et leurs choix ; un changement reçu après le début de la production produit un écart à arbitrer. Après service, les ventes réelles servent à revoir les prévisions futures, jamais à réécrire les quantités précédemment produites. L’absence de saisie de ventes ne bloque pas la planification de la semaine suivante.

## P5 — Cloisonnement strict des données de test

**Remplacer intégralement la section « Tests d’acceptation » et sa phrase finale par :**

> ### Tests d’acceptation — scénarios paramétriques
>
> Les tests décrivent des comportements, **sans noms de plats issus d’une semaine passée, sans grammages d’exemple et sans quantité fictive intégrée aux données de production**. Les éventuels jeux de test techniques sont créés séparément, portent l’étiquette `TEST_ONLY` et ne sont jamais importés dans les réglages, recettes, catalogue, prévisions ou semaines réelles. Aucune valeur de test ne peut devenir une valeur par défaut. Une base neuve ne contient aucun couvert, recette restaurant ou production prérempli.
>
> 1. Un produit sec et une préparation maison du même menu affichent chacun l’unité correspondant à leur usage ; une fiche recette absente ne masque pas une tâche simple.
> 2. Les besoins des menus 1 et 2 restent indépendants ; le grammage dépend du rôle du composant dans le plat.
> 3. Le brut à prévoir applique uniquement les transformations pertinentes à la forme achetée et à la méthode, sans double perte.
> 4. Un composant générique reste planifiable en portions ; sa composition et sa commande détaillée attendent validation.
> 5. La modification ou annulation d’une fiche retire son ancien besoin ; le choix provisoire d’un groupe est remplacé, non ajouté, par le choix confirmé.
> 6. Une hausse de prévision après production conserve la quantité réellement faite et affiche un écart à arbitrer.
> 7. Une production avancée pour la semaine suivante reste liée à son service ; dimanche compte dans le temps écoulé et toute exception d’avance nécessite la règle de préparation validée.
> 8. Une allergie de groupe reste visible ; aucune compatibilité n’est affirmée sans ingrédients restaurant validés et décision humaine pour l’adaptation.
> 9. Si un besoin change après vérification des produits, seuls les contrôles concernés repassent à vérifier ; besoin brut, disponible vérifié et commande restent séparés.
> 10. Un délai de commande dépassé ou inconnu est signalé ; la charge d’un créneau n’est pas présentée comme une durée de travail mesurée.
> 11. En mode avion sur l’appareil ciblé, lecture des menus enregistrés, saisie manuelle, calculs, statuts, sauvegarde et export restent possibles.
> 12. Les créneaux avant/après service, le samedi vers lundi/mardi, la carte comme charge non chiffrée et la bascule entre semaines respectent le workflow réel.
>
> Critère final : à l’arrivée au poste, le chef voit ce qui est prêt, ce qui reste à faire avant le prochain service, ce qui peut être avancé après service, les quantités calculables et les décisions encore ouvertes, sans confusion entre données de démonstration et données de l’établissement.

## P6 — Règle de qualité des données

**Ajouter aux principes du plan :**

> Chaque quantité affichée en exploitation porte un statut : `RESTAURANT_VALIDÉ`, `BASE_MÉTIER_ESTIMATION`, `SAISI_SERVICE`, `CALCULÉ` ou `INCONNU`. Le calcul `CALCULÉ` indique les paramètres dont il dépend ; s’il dépend d’une estimation non validée, le résultat reste marqué provisoire. Les exemples de la documentation et les scénarios `TEST_ONLY` ne sont jamais une source de calcul en exploitation. Une commande ou une affirmation de compatibilité allergène ne peut pas se baser sur un scénario de test.

## Hors périmètre inchangé

Aucun stock théorique, inventaire, déduction automatique de stock, calcul des portions de la carte ou certification de conformité sanitaire n’est ajouté par ce patch. Les recettes du restaurant conservent priorité sur les propositions de la base métier.
