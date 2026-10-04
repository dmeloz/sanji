# Organisation, calculs et cadre du brevet

Statut : proposition à valider (rien n'est validé ni branché sur l'application). Généré le 2026-10-04. Données : `donnees/organisation.json`.

64 entrées. Colonnes : valeur et état de poids, confiance (H haute, M moyenne, F faible), sources. Les chiffres de la base Sanji sont des repères génériques à remplacer par les pesées de la maison. `usage_calcul` reste faux partout.

## Brigade, poste et mise en place

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Poste d'entremétier | L'entremétier prépare surtout les garnitures de féculents et de légumes et reprend les autres tâches de la cuisine chaude ; potage, légumes, œufs et entremets en dépendent parfois comme sous-postes. Note : Source de vulgarisation professionnelle en allemand ; la répartition exacte varie selon la taille de la maison. |  | M | g-wie-gastro.de; g-wie-gastro.de |
| Postes voisins de l'entremétier | Le saucier assure plats chauds principaux, viande et poisson avec leurs sauces ; le garde-manger tient la cuisine froide : ce sont les deux postes avec lesquels l'entremétier coordonne ses cuissons et ses envois. Note : Organisation classique en brigade ; une petite cuisine fusionne souvent ces postes. |  | M | g-wie-gastro.de |
| Hiérarchie de brigade | Le chef de cuisine dirige, le sous-chef le seconde et le remplace, les chefs de partie puis demi-chefs de partie répondent chacun de leur poste.  |  | M | g-wie-gastro.de; g-wie-gastro.de |
| Chef de partie | Le chef de partie répond de la mise en place et du dressage de son poste. Note : Cadre de brigade classique. |  | M | g-wie-gastro.de |
| Tâches du chef de cuisine | Le chef de cuisine répond de la planification du personnel, des achats, de la calculation des prix et de la vente. Note : Recoupé par les domaines du brevet : denrées et art culinaire, marketing, organisation, conduite, finances. |  | M | g-wie-gastro.de; Hotel & Gastro formation |
| Mise en place | La mise en place est la préparation organisée des denrées et du poste avant le service.  |  | M | g-wie-gastro.de |
| Mise en place et rotation | Les denrées à date la plus proche se préparent et se consomment en premier ; la file de priorité de la rotation fait office de politique de mise en place. Note : Non recoupé en externe ; la base Sanji parle de FEFO (premier expiré, premier sorti) et non de PEPS. |  | M | Sanji §16 |

## Planification, avance de production, lots, banquets, assiette

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Planification et commandes | Le besoin brut calculé pour la production planifiée alimente directement le réassort ; la perte de production n'est jamais confondue avec le rebut. Note : Principe de chaîne planification, calcul, commande ; la planification hebdomadaire détaillée n'a pas de source externe retenue. |  | M | Sanji §12; Sanji §19 |
| Cuisson avancée refroidie | Le cook and chill consiste à cuire selon les principes HACCP, refroidir vite, stocker au froid puis remettre en température avant le service.  |  | M | dish.co |
| Durée de refroidissement rapide | La durée de refroidissement rapide de référence est celle de hygiene.temperature.refroidissement (50 à 10 °C en 2 h au plus) ; pour le cook and chill en cellule, dish.co cite 90 min pour atteindre 3 °C à cœur. Note : Renvoi : la référence unique du référentiel est hygiene.temperature.refroidissement (écarts entre GVG, cantons et base Sanji décrits là). Les 90 min de dish.co visent 3 °C à cœur ; la base Sanji (65 à 10 °C en 3 h) est un autre repère, non repris ici. Le plan HACCP de l'établissement et le canton priment. |  | F | dish.co; Sanji §6 |
| Durée de tenue après refroidissement | Un plat refroidi vite et tenu sans rupture du froid se garde jusqu'à 7 j à 3 °C max selon dish.co ; base Sanji 3 j (repère prudent). Note : Correction : une version antérieure citait 5 j pour dish.co ; la page dit « jusqu'à sept jours » à 3 °C au plus, selon le type de plat. Fourchette la plus large gardée ; durées de qualité, pas des dates limites ; à rapprocher des durées légales de hygiene.duree.sauces-cuites et des aide-mémoires cantonaux. Marquer chaque lot à la production. | 3 à 7 j | M | dish.co; Sanji §8 |
| Remise en température | La remise en température vise 70 à 75 °C à cœur avant le service. Note : Le repère de la base Sanji est 70 °C pendant 2 min à cœur ; le haut de fourchette vient d'un fournisseur d'équipement. | 70 à 75 °C | M | dish.co; Sanji §6 |
| Zone de danger et temps cumulé | Entre environ 10 et 65 °C les bactéries se multiplient ; le temps passé dans cette zone est cumulatif, d'où refroidissement rapide, petites portions et récipients plats. Note : Raisonnement à enseigner, pas seulement les chiffres ; relève du thème hygiène pour les seuils. Pour le refroidissement et le maintien au chaud, voir hygiene.temperature.refroidissement et hygiene.temperature.maintien-chaud (référence du référentiel). | 10 à 65 °C | F | Sanji §6 |
| Chaîne de préparation | Toute production subit trois pertes en chaîne : parage, cuisson, portionnement ; chaque étape se pèse séparément et se planifie dans cet ordre.  |  | M | Sanji §10 |
| Cuisson en lots et buffet | Réapprovisionner un buffet par petites quantités et produire à la demande plutôt que de tout garder garni jusqu'à la fermeture réduit les restes. Note : Cas d'un hôtel ; l'étude cite -43 % de déchets au buffet du petit déjeuner par an, valeur propre à ce cas. |  | M | United Against Waste |
| Production à la demande | Remplacer des plats précuits exposés par une préparation sur commande supprime la production spéculative.  |  | M | United Against Waste |
| Banquet : calcul de brut pour N couverts | Pour N couverts d'une pièce de viande poêlée, le brut à commander est le net cuit servi multiplié par un multiplicateur, par exemple environ 1,74 avec un parage de 20 %, une cuisson de 25 % et un tranchage de 4 %. Note : Exemple illustratif tiré de la base Sanji, seul le mécanisme (net cuit × multiplicateur = brut) est à retenir ; chiffre recalculé 1 / (0,80 × 0,75 × 0,96), non recoupé en externe. Les pertes de l'établissement remplacent ces valeurs génériques. | 1.74 kg brut par kg cuit servi (cuit) | F | Sanji §28 |
| Banquet : cuisson basse température | Un rôti de 3 kg perd environ 12 % en basse température contre 28 % au four traditionnel, soit près de 480 g gagnés par pièce. Note : Exemple illustratif ; l'écart dépend de la pièce, de l'appareil et de la température à cœur. | 12 à 28 % de perte de cuisson (cru_net) | F | Sanji §28 |
| Service à l'assiette | La perte de dressage est de 2 à 4 % pour une viande poêlée portionnée en amont et de 2 à 3 % pour un légume de garniture. Note : Valeurs génériques à remplacer par la pesée de la maison. | 2 à 4 % du cuit (cuit) | F | Sanji §11.3 |
| Service à l'assiette et tranchage | Un rôti tranché en salle ou en cuisine perd 5 à 8 % au portionnement. Note : Valeurs génériques à remplacer par la pesée de la maison. | 5 à 8 % du cuit (cuit) | F | Sanji §11.3 |

## Calculs de la profession

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Rendement | Le rendement est la part du produit qui reste à une étape ; le multiplicateur d'une étape est l'inverse du rendement.  |  | M | Sanji §10 |
| Perte de production | La perte de production (parage, cuisson, portionnement) est une constante technique mesurée par pesée, distincte du rebut qui est une anomalie motivée.  |  | M | Sanji §10; Sanji §20 |
| Étapes chaînées | Les multiplicateurs des étapes se multiplient entre eux ; l'exemple type est 1,18 pour l'épluchage et 1,43 pour l'étuvage, soit 1,69 au total. Note : Exemple carottes glacées ; pour 10 kg nets, 16,9 kg bruts. | 1.69 x brut par kg servi (cuit) | F | Sanji §10 |
| Quantité à commander | Le brut à commander est le nombre de portions multiplié par la grammage net et par le multiplicateur total. Note : Le grammage doit toujours porter son état de poids (cuit, cru net). |  | M | Sanji §12 |
| Facteur de conversion | Le facteur de conversion entre états de poids est 1 divisé par le rendement de l'étape traversée ; il s'applique dans le sens net vers brut pour commander.  |  | M | Sanji §10 |
| Coût matière par portion | Le coût matière par portion est le poids brut par portion multiplié par le prix brut au kilo ; le prix net au kilo est le prix brut multiplié par le multiplicateur total.  |  | M | Sanji §12; gastrolaunch.ch |
| Prix net d'une pièce de viande | Une pièce de viande achetée à un prix P par kilo brut, avec parage 20 %, cuisson poêlée 20 % et dressage 3 %, a un multiplicateur d'environ 1,61 : le kilo servi coûte P × 1,61. Note : Exemple illustratif (1 / (0,80 × 0,80 × 0,97)), sans prix réel ; seul le mécanisme est à retenir ; non recoupé en externe. | 1.61 x brut par kg servi (cuit) | F | Sanji §12 |
| Gain de cuisson d'un féculent | Un riz cuit à l'eau gagne 2,75 fois son poids sec ; le multiplicateur total tombe sous 1 et le prix net peut passer sous le prix brut. Note : Un rendement supérieur à 100 % se traite comme une perte inversée, sans blocage. | 2.75 x poids sec (sec) | F | Sanji §12 |
| Pertes de cuisson courantes | La base Sanji retient comme repères de perte de cuisson 20 % poêlé, 27,5 % au four traditionnel et 12,5 % à la vapeur. Note : Valeurs génériques de la base ; la pesée de la maison fait foi. | 12.5 à 27.5 % du paré (cru_net) | F | Sanji §12 |
| Coefficient de vente | Le prix de vente net est le coût matière multiplié par le coefficient ; le coefficient est le prix de vente divisé par le coût matière.  |  | M | gastrolaunch.ch |
| Coefficient des plats | Le coefficient indicatif des plats est de 2,8 à 3,5 (part matière de 28 à 35 %) selon gastrolaunch ; resmio cite la règle empirique du facteur 3 et déconseille les facteurs fixes. Note : Fourchette de gastrolaunch retenue. Divergence : resmio indique la règle du facteur 3, un outil de prix avec des facteurs de 3 à 5 (vins surtout) et un plat de pâtes à environ 2 en coûts complets ; l'ancienne borne de 4,0 n'est pas retrouvée sur resmio pour les plats et est retirée. Repères d'éditeurs privés, pas une norme ; chaque maison fixe le sien selon sa structure de charges. | 2.8 à 3.5 coefficient | F | gastrolaunch.ch; resmio GmbH |
| Part matière (food cost) | La part matière cible des plats se situe entre 25 et 35 % du prix de vente net ; la base Sanji donne 30 à 35 % pour la restauration. Note : Dépend du type d'établissement ; le prix de vente net est hors TVA. | 25 à 35 % du prix de vente net | M | gastrolaunch.ch; Sanji §12 |
| Prix de vente TTC | Le prix TTC est le prix net multiplié par 1 plus le taux de TVA ; sur place le taux cité est 8,1 %. Note : Taux en vigueur à vérifier auprès de l'AFC ; les taux changent. Le taux à l'emporter diffère. | 8.1 % de TVA (sur place) | M | gastrolaunch.ch |
| Marge et charges | Une marge bénéficiaire de 5 à 15 % du chiffre d'affaires est citée comme réaliste, avec des coûts de personnel de 30 à 40 % au plus. Note : Repère de blog professionnel, non officiel ; ne pas utiliser pour juger une maison. | 5 à 15 % du chiffre d'affaires | F | gastrolaunch.ch |
| Prix de revient | Le prix de revient d'un plat part du coût matière de tous les composants et s'enrichit des autres charges avant de fixer un prix de vente. Note : Le détail des charges (personnel, frais généraux) n'a pas été détaillé dans une source officielle. |  | F | gastrolaunch.ch |
| Réassort | Le manque est le maximum de zéro et de la cible moins le stock ; l'achat se déclenche quand le manque dépasse une marge, et la quantité se convertit en conditionnement en arrondissant au-dessus.  |  | M | Sanji §19 |
| Seuil dynamique | Le seuil dynamique est la consommation moyenne multipliée par la couverture cible en jours ; il n'est fiable qu'avec assez d'historique mesuré.  |  | M | Sanji §19 |

## Stock

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Rotation des stocks | La rotation correcte est premier expiré, premier sorti ; en rayon on prend la date la plus proche, à la réception une date courte devient priorité.  |  | M | Sanji §16 |
| Préavis selon le type de produit | Repère de préavis avant la date limite : 3 à 5 jours pour une grosse pièce, 1 à 2 jours pour un produit standard, 0 à 1 jour pour un produit fragile. Note : Estimation de la base Sanji, non norme et non recoupée en externe ; à fixer par l'établissement selon ses produits. | 0 à 5 j avant la limite | F | Sanji §16 |
| Inventaire | En contexte professionnel l'inventaire mensuel complet est valorisé et sert de base au calcul du coût matière ; un inventaire tournant par zone complète le dispositif.  |  | M | Sanji §18 |
| Écarts d'inventaire | Un écart se corrige par un ajustement motivé et écrit, jamais en silence ; des écarts répétés sur un produit signalent un mauvais mode de quantité.  |  | M | Sanji §18 |
| Valorisation du stock | La valeur du stock est la somme des quantités multipliées par le prix des lots actifs ; elle sert aussi à valoriser le gaspillage.  |  | M | Sanji §19 |

## Gaspillage et durabilité

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Motifs de rebut | Chaque rebut reçoit un motif (périmé, abîmé, restes, erreur d'achat, incident, rappel) ; le motif dominant désigne l'action corrective à mener.  |  | M | Sanji §20 |
| Rebut sanitaire et évitable | Le rebut sanitaire n'est pas négociable alors que le rebut évitable est la cible d'amélioration.  |  | M | Sanji §20 |
| Mesurer et ajuster les portions | Réduire le gaspillage commence par mesurer où et quand il survient, puis par ajuster les portions au besoin réel.  |  | M | United Against Waste; United Against Waste |
| Effet d'un ajustement de portions | Dans un cas d'hôtel, le déchet par client est passé de 153 g à 97 g, soit -37 %. Note : Cas unique ; ne pas généraliser. État du poids non précisé par la source (restes d'assiette). | 97 à 153 g par client (cuit) | F | United Against Waste |
| Résultats de projets en restauration | Dix établissements conseillés en 2015 ont réduit leurs déchets de 25 % en moyenne ; un projet lucernois 2022-2023 a obtenu 35 % en moyenne, jusqu'à 50 %. Note : Moyennes de projets accompagnés ; pas une promesse pour une cuisine donnée. | 25 à 50 % de réduction | M | United Against Waste; United Against Waste |
| Volume en Suisse | La restauration suisse produit environ 210 000 à 240 000 tonnes de déchets alimentaires par an, soit environ un dixième du total. Note : Deux sources divergent (OFEV 210 000 t, United Against Waste 240 000 t) ; fourchette la plus large dans l'énoncé. Total de déchets, pas un état de produit : valeur laissée dans l'énoncé. |  | M | Office fédéral de l'environnement; United Against Waste |
| Objectif fédéral | Le Conseil fédéral vise de réduire de moitié les pertes alimentaires évitables d'ici 2030 par rapport à 2017. Note : Plan d'action de la Confédération ; vérifier l'état actuel du plan. | 50 % de réduction d'ici 2030 | M | Office fédéral de l'environnement |

## Ergonomie et sécurité

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Dangers en cuisine | Les checklists officielles de cuisine regroupent les dangers en sols glissants, objets coupants, machines, chaleur, charges, produits chimiques et incendie.  |  | M | CFST/EKAS |
| Types d'accidents | Dans le secteur de l'hôtellerie-restauration, la liste de contrôle EKAS/Suva « Küche » attribue 35 % des accidents aux coupures et piqûres, 25 % aux glissades et trébuchements et 5 % aux brûlures et ébouillantements. Note : Chiffres de la liste de contrôle EKAS 6802.d « Küche » (révision de juillet 2025), relus sur le PDF ; l'année et la base statistique ne sont pas indiquées dans le document. Les sources web antérieures (wirtepatent.ch) sont retirées. | 5 à 35 % des accidents | M | CFST/EKAS et Suva |
| Branche de sécurité | La solution de branche du secteur offre manuel, check-lists, formation (KOPAS) et soutien de spécialistes pour appliquer la sécurité au travail.  |  | M | GastroSuisse; wirtepatent.ch |
| Charges et manutention | La Suva cite 15 kg pour une femme et 25 kg pour un homme en manutention occasionnelle, et une évaluation dès 7 kg et 12 kg au-delà de quatre levées par heure. Note : Poids de charges de manutention, pas des poids de denrées : valeur laissée dans l'énoncé. Chiffres relevés via résultats de recherche ; recouper avec la publication Suva avant usage. Hauteur, rotation et prise changent l'appréciation. |  | M | Suva |
| Technique de levage | Lever dos droit, genoux fléchis, charge près du corps, prise à deux mains. |  | M | Suva |

## Nutrition et régimes

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Fruits et légumes | La recommandation suisse est de 5 portions par jour, 3 de légumes et 2 de fruits, une portion pesant environ 120 g. Note : Poids de portion cru ; recouper avec la brochure officielle avant usage. | 120 g par portion (cru_net) | M | SGE avec l'OSAV |
| Légumineuses | La pyramide suisse 2024 place les protéines végétales et les légumineuses devant la viande et le poisson, avec une portion par jour pour le groupe des protéines. |  | M | SGE avec l'OSAV |
| Régime végétalien | Une alimentation végane est possible pour un adulte en bonne santé avec un supplément de vitamine B12, et déconseillée aux enfants, adolescents, femmes enceintes ou allaitantes et personnes âgées. Note : Le PDF de la SGE n'a pas pu être lu ; énoncé reposant sur le résumé de recherche et la recommandation officielle. |  | M | SGE; SGE avec l'OSAV |
| Régime végétarien | Un régime végétarien demande une sélection consciente des aliments pour couvrir les besoins, notamment en B12. Note : Source non lue en entier ; à compléter. |  | F | SGE |
| Sans gluten | En Suisse un aliment est dit sans gluten jusqu'à 20 mg de gluten par kg à la vente ; la mention gluten très réduit va jusqu'à 100 mg/kg pour des ingrédients spécialement traités. Note : Seuil de désignation de produits préemballés ; la cuisine sans gluten en restauration relève aussi des contaminations croisées à vérifier avec le chimiste cantonal. | 20 à 100 mg de gluten par kg | M | Fedlex; lexfind.ch |
| Sans lactose | Un aliment est dit sans lactose s'il contient moins de 0,1 g de lactose pour 100 g ou 100 ml à la consommation. Note : Définition réglementaire des produits ; vérifier la version de l'ordonnance en vigueur. | 0 à 0.1 g de lactose pour 100 g ou 100 ml | M | lexfind.ch; biolytix.ch |
| Allergènes à déclarer | La liste des allergènes à déclarer relève du droit (LIV annexe 6) : voir hygiene.allergenes.liste-14 ; elle n'est pas répétée ici. Note : Renvoi à hygiene.allergenes.liste-14 (LIV, texte relu à l'état au 01.07.2025) et à hygiene.allergenes.seuil-sulfites. La base Sanji §24 parle de quatorze allergènes, ce qui concorde. Droit alimentaire : vérifier la version de l'ordonnance et le canton. |  | M | Sanji §24 |

## Équipe et brevet

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Conduite d'équipe | Le domaine conduite du brevet couvre la direction d'équipe, le développement du personnel, le droit du travail et la résolution de conflits. Note : Description de domaine, pas contenu d'examen. |  | M | Hotel & Gastro formation |
| Implication de l'équipe | Impliquer l'équipe dans le suivi des quantités produites aide à réduire les pertes, y compris au restaurant du personnel.  |  | M | United Against Waste |
| Domaines du brevet | Selon Hotel & Gastro formation, le brevet de chef de cuisine comprend cinq domaines : denrées et art culinaire, marketing et vente, organisation de l'entreprise, conduite du personnel, finances. Note : Voir COUVERTURE-BREVET.md ; règlement non lu en entier. |  | M | Hotel & Gastro formation; Hotel & Gastro formation |

## Lacunes

- Planification hebdomadaire détaillée : Aucune source externe fiable retenue ; le calendrier se construit à partir des menus de la maison.
- Fiches de fonction et fiches banquet : Pas de source publique retenue sur le contenu type ; modèles à construire avec la propriétaire.
- Calcul du prix de revient complet (charges, personnel) : Aucune source officielle ; seul le coût matière est documenté.
- Durées de conservation et refroidissement légaux : La référence de refroidissement est hygiene.temperature.refroidissement ; les 7 jours du cook and chill viennent d'un fournisseur privé (dish.co) et ne sont pas recoupés ; la directive cantonale et le plan HACCP priment.
- Limites de manutention : texte Suva complet : Chiffres issus de résultats de recherche ; publication Suva à recouper.
- Nutrition : besoins en énergie et nutriments, tableaux de composition : Non cherchés (base de données suisse des valeurs nutritives à consulter).
- Brochure de la Commission fédérale / guide de la restauration collective (BLV) : Le PDF du guide n'a pas répondu (erreur 502) ; contenu non intégré.
- Textes SGE vegan et OFSP/BLV en PDF : PDF non lisibles par l'outil d'extraction ; énoncés prudents.
- Ergonomie du poste (hauteurs de travail, équipements) : Aucune valeur sourcée retenue.
- Calculs de rotation du stock (indicateurs de rotation en jours) : Aucune formule sourcée retenue.
- Durée de 7 jours du cook and chill (dish.co) : dish.co est un fournisseur privé ; la durée de 7 j à 3 °C n'est pas recoupée par une source officielle.

## Sources externes consultées le 2026-10-04

- CFST/EKAS : Checkliste Küche (EKAS 6802.d, révision juillet 2025, chiffres 35 / 25 / 5 % relus sur le PDF), https://www.ekas.admin.ch/fileadmin/Dokumente/Checklisten/06802_D.pdf
- Fedlex : Verordnung des EDI über die Information über Lebensmittel (LIV), https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2017/158/20180612/de/pdf-a/fedlex-data-admin-ch-eli-cc-2017-158-20180612-de-pdf-a.pdf
- GastroSuisse : Arbeitssicherheit (Branchenlösung), https://gastrosuisse.ch/de/recht/mitarbeitende/arbeitssicherheit
- Hotel & Gastro formation : Cheffe cuisinière / Chef cuisinier BF, https://hotelgastro.ch/fr/ausbildung/cheffe-de-cuisine-chef-de-cuisine-avec-brevet-federal/
- Hotel & Gastro formation : Chefköchin/Chefkoch EFA, https://www.hotelgastro.ch/eidgenoessischer-fachausweis?c=Chefkoechin_mit_eidgenoessischem_FachausweisChefkoch_mit_eidgenoessischem_Fachausweis
- Office fédéral de l'environnement (OFEV/BAFU) : Lebensmittelverluste, https://www.bafu.admin.ch/de/foodwaste
- SGE : Merkblatt vegane Ernährung, https://www.sge-ssn.ch/media/qejpveze/merkblatt-vegane-ernaehrung.pdf
- SGE (association) avec l'OSAV : Schweizer Ernährungsempfehlungen, Kurzversion 2024, https://www.sge-ssn.ch/media/e23asbw5/schweizer-ernaehrungsempfehlungen_kurzversion_de-1.pdf
- Suva (assurance accidents, établissement de droit public) : Lasten clever heben, https://www.suva.ch/de-ch/praevention/nach-gefahren/gefaehrliche-materialien-strahlungen-und-situationen/koerperliche-belastung-und-ergonomie/umgang-mit-schweren-lasten/heben-sie-lasten-clever
- United Against Waste : Food Waste in der Gastronomie, https://united-against-waste.ch/event/food-waste-in-der-gastronomie/
- United Against Waste : Food Waste vermeiden (résultats de projets), https://united-against-waste.ch/medien-article/aktuelles-zum-thema-lebensmittelabfall/
- United Against Waste : Schritt für Schritt weniger Food Waste, https://united-against-waste.ch/schritt-fuer-schritt-weniger-food-waste/
- biolytix.ch : Laktosefreie Produkte: Fakten zur Kennzeichnung, https://www.biolytix.ch/laktosefreie-produkte-wichtige-fakten-zur-lebensmittelkennzeichnung/
- dish.co : Cook and Chill: Heute kochen, morgen servieren, https://www.dish.co/DE/de/blog/cook-and-chill/
- g-wie-gastro.de : Küche Organisation: Küchenbrigade, https://g-wie-gastro.de/gastronomie-glossar/kuechenbrigade/
- g-wie-gastro.de : Küchenbrigade: Aufbau & Posten, https://g-wie-gastro.de/mehr-zur-gastronomie/glossar/gastro-wissen-allgemein/organigramm-kueche-kuechenbrigade-aufbau/
- gastrolaunch.ch (plateforme de conseil pour la gastronomie) : Kalkulation in der Gastronomie: Preise richtig berechnen, https://gastrolaunch.ch/ratgeber/artikel/kalkulation-gastronomie-preise-richtig-berechnen
- lexfind.ch (site privé reproduisant le texte de l'ordonnance) : Verordnung des EDI über Speziallebensmittel 817.022.104, https://www.lexfind.ch/tolv/149819/de?download=true
- resmio GmbH (éditeur de logiciel de gestion de restaurant) : Kalkulation in der Gastronomie, https://www.resmio.com/spoon-bytes/kalkulation-gastronomie/
- wirtepatent.ch : KOPAS im Gastgewerbe, Arbeitssicherheit in Küche und Service, https://www.wirtepatent.ch/de/wissen/kopas-im-gastgewerbe-n-arbeitssicherheit-in-kueche-und-service-176.html
