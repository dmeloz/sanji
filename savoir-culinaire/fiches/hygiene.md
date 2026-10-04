# Hygiène, HACCP, allergènes et conservation

Référentiel proposé le 2026-10-04 pour Sanji. **Tout est à valider** (statut `a_valider`, `usage_calcul: false`, portée `a_valider_localement` : le droit et les températures légales dépendent de la version du texte et du canton). Source de vérité : `donnees/hygiene.json` (75 entrées). Textes fédéraux lus à l'état du 01.07.2025 (la LMG relue à l'état 01.10.2024, la VLtH à l'état 01.02.2024). Les aide-mémoire cantonaux lus sont alémaniques (AG, BS, SO, LU, SG) ; la GVG de GastroSuisse (2e édition 2019) a été relue en texte intégral.

Confiance : H = haute, M = moyenne, F = faible. Vérif. (relecture à la source le 2026-10-04) : C confirmée, P partielle, N non confirmée, B base Sanji seule, - sans vérification (entrée sans chiffre ou non relue). Cuisson, froid et durées : voir les conditions dans le JSON pour chaque écart avec la base Sanji.


## Cadre légal suisse

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Loi sur les denrées alimentaires (LMG / LDAl) | La loi fédérale de base est le Lebensmittelgesetz du 20.06.2014 (loi sur les denrées alimentaires et les objets usuels, LDAl), RS 817.0 ; elle pose la sécurité des denrées et les devoirs de l'exploitant. |  | H | C | LMG, Base Sanji |
| Autocontrôle : obligation légale | Quiconque produit, traite, stocke, transporte ou remet des denrées doit veiller au respect des exigences légales ; il est tenu à l'autocontrôle, et le contrôle officiel n'en dispense pas. |  | H | - | LMG, VD |
| Personne responsable | Chaque établissement désigne une personne responsable avec adresse commerciale en Suisse ; à défaut, la direction de l'établissement porte la responsabilité de la sécurité des produits. |  | H | - | LGV |
| Contenu de l'autocontrôle | L'autocontrôle comprend la bonne pratique (dont l'hygiène), l'application du HACCP ou de ses principes, les prélèvements et analyses, la traçabilité, le retrait et le rappel, et la documentation. |  | H | - | LGV |
| Documentation de l'autocontrôle | Le concept d'autocontrôle et les mesures prises doivent être documentés par écrit ou de façon équivalente ; les micro-entreprises peuvent réduire la documentation de façon appropriée. |  | H | - | LGV |
| Ordonnance sur l'hygiène (HyV / OHyg) | L'ordonnance du DFI sur l'hygiène (HyV, OHyg), RS 817.024.1, règle l'hygiène des locaux, du personnel, des températures et de la formation ; les articles de cuisine utiles sont 6, 17, 18, 20 à 22, 24 à 27. |  | H | - | HyV |
| Ordonnance sur l'information sur les denrées (LIV / OIDAl) | L'ordonnance du DFI concernant l'information sur les denrées alimentaires (LIV, OIDAl), RS 817.022.16, fixe la datation, les indications obligatoires et la liste des allergènes (annexe 6). |  | H | - | LIV, Base Sanji |
| Guide de branche approuvé | La branche peut remplacer les exigences détaillées d'autocontrôle par une directive de branche approuvée par l'OSAV ; pour la restauration, c'est la GVG (BPHR en français) de GastroSuisse. |  | H | - | LGV, GVG |
| GVG de GastroSuisse : version | La GVG de GastroSuisse est la 2e édition de 2019, approuvée par l'OSAV le 21.09.2018 (état de la loi au 01.05.2017) ; une version plus récente peut exister. |  | M | C | GVG |
| Amendes maximales en cas d'infraction à la loi sur les denrées | Une infraction intentionnelle aux règles d'hygiène est punie d'une amende jusqu'à 40 000 francs (al. 1) ; si l'auteur agit à titre professionnel (gewerbsmässig) ou pour s'enrichir, jusqu'à 80 000 francs (al. 2). | 40000 à 80000 CHF | H | C | LMG |

## HACCP et autocontrôle

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| HACCP : obligation proportionnée | Quiconque produit, transforme ou traite des denrées applique une ou plusieurs procédures fondées sur le HACCP ou ses principes, adaptées au risque et à la taille. |  | H | - | LGV |
| Principes HACCP (sept composantes) | Sept composantes : analyse des dangers, points critiques (CCP), limites critiques, surveillance, mesures correctives, vérification, documentation. | 7 composantes | H | C | LGV |
| Points critiques usuels en cuisine | Points critiques courants : réception, stockage au froid, cuisson à cœur, refroidissement, maintien au chaud, remise en température ; la liste réelle découle de l'analyse des dangers de l'établissement. |  | M | - | Base Sanji, HyV |
| Surveillance par relevés | Le maintien au froid et au chaud doit être assuré par des thermomètres et des équipements adaptés et contrôlé dans le cadre de l'autocontrôle ; les enceintes doivent permettre de surveiller, voire d'enregistrer, la température. |  | H | - | HyV |
| Vérification d'une sonde | Une sonde fausse invalide les relevés : la base Sanji propose un contrôle mensuel à la glace fondante (0 °C, écart toléré environ 0,5 à 1 °C). | 0.5 à 1 °C d'écart toléré | F | B | Base Sanji |
| Formation du personnel | La personne responsable veille à ce que le personnel soit surveillé et formé selon son activité ; ceux qui conçoivent l'autocontrôle sont formés aux principes HACCP. |  | H | - | HyV |

## Températures

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Froid positif : denrées périssables | Les préparations cuisinées périssables se stockent à 5 °C au maximum ; le droit fédéral exige seulement une température qui empêche la multiplication des germes, avec des valeurs fixées par catégorie. | ≤ 5 °C | H | C | SO-2013, GH-web, Base Sanji, HyV, GVG |
| Viande hachée | La viande hachée se garde à 2 °C à cœur au maximum. | ≤ 2 °C à cœur | M | C | HyV, GH-web, GVG |
| Volaille, préparations et produits de viande | La volaille domestique, les préparations de viande et les produits carnés se gardent à 4 °C à cœur au maximum. | ≤ 4 °C à cœur | H | C | HyV, Base Sanji |
| Viande d'ongulés domestiques et gibier | La viande d'ongulés domestiques et de gibier (hors petit gibier à plume ou poil) se garde à 7 °C à cœur au maximum. | ≤ 7 °C à cœur | H | C | HyV |
| Abats | Les abats et le sang se gardent à 3 °C à cœur au maximum. | ≤ 3 °C à cœur | H | C | HyV, Base Sanji |
| Poisson et fruits de mer frais | Le poisson frais, le poisson décongelé non transformé et les crustacés et mollusques cuits refroidis se conservent à la température de la glace fondante, au plus 2 °C. | 0 à 2 °C | H | C | HyV, GH-web, Base Sanji |
| Lait et produits laitiers : températures | Pas de température fédérale unique en cuisine : lait cru, 10 °C au plus à l'arrivée depuis le producteur et 6 °C au plus en laiterie (HyV art. 46 et 48, qui visent la filière, pas la cuisine) ; lait pasteurisé, 6 °C selon un site de branche et 8 °C selon la base Sanji ; fromage et beurre, 10 °C selon la base Sanji seulement. |  | F | - | HyV, GH-web, Base Sanji, GVG |
| Œufs : température de conservation | Les œufs se gardent propres, secs, à l'abri des chocs et du soleil, à une température la plus constante possible ; les aide-mémoire lucernois et argovien conseillent le frigo après achat. |  | M | C | HyV, LU-Eier, GVG, Base Sanji |
| Surgélation : température de stockage | Les denrées surgelées se tiennent à -18 °C ou moins, la chaîne du froid ne doit pas être rompue ; les couches périphériques ne dépassent pas -15 °C, et seulement brièvement. | ≤ -18 °C | H | C | HyV, Base Sanji |
| Cuisson à cœur | Les aliments se cuisent à cœur à 70 °C au minimum, contrôlés à la sonde ; la GVG précise au moins 2 minutes à cette température. | ≥ 70 °C à cœur | H | C | AG-11, BS-Temp, GVG, GH-web, Base Sanji |
| Exceptions de cuisson à cœur | Les aide-mémoire cantonaux admettent des exceptions à la cuisson complète, par exemple le rosbif ; une source de branche parle de 65 °C en surface avec pièce saisie de tous côtés. | ≥ 65 °C en surface | M | C | AG-11, GH-web, GVG |
| Huile de friture | La température du bain de friture ne dépasse pas 170 °C ; la cuisson doit assez durer pour atteindre la température à cœur, surtout sur grosses pièces. | ≤ 170 °C | M | C | AG-11, BS-Temp, GVG |
| Maintien au chaud | Les plats cuits non servis tout de suite se tiennent à 65 °C minimum jusqu'au service ; le droit exige seulement une température qui empêche la multiplication des germes. | ≥ 65 °C | H | C | AG-11, BS-Temp, HyV, GVG, Base Sanji |
| Durée du maintien au chaud | Pour la qualité, le maintien au chaud des plats précuits est limité à trois heures au plus, selon le produit. | ≤ 3 h | H | C | AG-11, BS-Temp, GVG, Base Sanji |
| Remise en température | Lors de la remise en température d'une préparation déjà cuite, on atteint à cœur au moins 70 °C pendant au moins 2 minutes, avec des appareils ou procédés adaptés ; aucune durée pour y parvenir n'est fixée. | ≥ 70 °C à cœur (au moins 2 min) | H | C | GVG, Base Sanji |
| Refroidissement rapide | Référence unique du référentiel pour le refroidissement : après cuisson, on traverse la zone de 50 °C à 10 °C en deux heures au plus, par refroidissement actif, jamais à température ambiante. | ≤ 2 h (de 50 à 10 °C) | M | C | AG-11, BS-Temp, GH-web, GVG, HyV |
| Techniques de refroidissement | Cellule de refroidissement (sonde à cœur), spirale d'eau froide, eau courante en brassant, ou étalement en couche de 6 cm au plus puis passage au froid ; récipients propres, éviter le contact direct des mains. | ≤ 6 cm d'épaisseur | H | C | AG-11, BS-Temp |
| Stockage après refroidissement | Les préparations à l'avance restent à 5 °C au maximum, couvertes ou sous vide, séparées des denrées crues non prêtes à consommer. | ≤ 5 °C | H | C | SO-2013, LU-Haltb, HyV |
| Denrées périssables hors du froid | Les denrées périssables gardées plus de 3 heures sans froid depuis leur fabrication (sandwichs, mise en place en service, restes de buffet) ne se remettent plus en vente. | ≤ 3 h | H | C | SO-2013, Base Sanji |
| Décongélation : méthodes admises | On décongèle au frigo (récipient avec égouttoir, couvert, liquide jeté), en emballage étanche sous eau froide, ou rapidement au micro-ondes, four ou cuiseur vapeur ; le droit exige un risque microbien minimal ; la décongélation non contrôlée à température ambiante est strictement interdite (AG). |  | H | - | AG-11, BS-Temp, HyV |
| Recongélation | Une denrée décongelée ne se recongèle pas ; pour le haché et les préparations de viande, c'est écrit dans l'ordonnance. |  | H | - | AG-11, BS-Temp, HyV |
| Congélation : produits frais seulement | On congèle des produits frais, jamais en fin de durée de conservation ; la congélation reste une bonne pratique à appliquer sans altérer la qualité. |  | H | - | SO-2013, HyV |
| Panne de froid | En cas de panne, la base Sanji propose de trier sévèrement les denrées très périssables si le frigo reste plus de 4 h entre 5 et 7 °C ou plus, et compte environ 48 h de tenue pour un congélateur plein fermé (24 h à moitié plein). | 24 à 48 h (congélateur fermé) | F | B | Base Sanji |

## Durées de conservation des préparations

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Consommation après décongélation | Une denrée décongelée porte la date de décongélation et se consomme vite : 48 heures au plus, 24 heures pour les produits délicats. | ≤ 48 h après la décongélation (24 h pour les produits délicats) | M | C | GVG, Base Sanji |
| Légumes, pâtes et riz cuits | Pâtes, riz et légumes cuits : au plus 2 jours après le jour de production, au froid à 5 °C ou moins ; riz et pâtes de préférence préparés frais. | ≤ 2 jours après le jour de production | H | C | SO-2013, LU-Haltb, AG-11, GVG |
| Sauces cuites | Sauces cuites : de 2 à 4 jours après le jour de production selon la source (GVG J+2, Soleure J+3, Lucerne J+4) ; la prudence conduit à 2 jours si rien d'autre n'est fixé par l'établissement. | 2 à 4 jours après le jour de production | M | C | SO-2013, LU-Haltb, GVG, Base Sanji |
| Plats de viande cuits, salades assaisonnées, sauces froides | Plats de viande cuits, salades assaisonnées (hors feuilles) et sauces traiteur ou dips : 2 jours après le jour de production. | ≤ 2 jours après le jour de production | H | C | SO-2013, LU-Haltb |
| Desserts et entremets fragiles | Desserts et entremets très périssables : produit du jour, 1 jour au maximum. | ≤ 1 jour | M | C | SO-2013, LU-Haltb, GVG |
| Denrées périssables entamées | Denrées périssables en emballage ouvert (boîtes, sachets) et charcuterie ou préparations de viande entamées : 2 jours selon la liste lucernoise (jour de production + 2). | ≤ 2 jours | M | C | LU-Haltb |
| Œufs en coquille | La durabilité minimale des œufs ne dépasse pas 28 jours après la ponte ; la base Sanji parle de 3 à 5 semaines au frigo. | ≤ 28 jours après la ponte | H | C | VLtH, LU-Eier, GVG, Base Sanji |
| Préparations à base d'œufs crus | Tiramisu, zabaione, mousse : œufs très frais ou, mieux, œuf pasteurisé ; consommer vite et fixer par écrit durée et température de conservation. |  | M | - | LU-Eier |
| Lait et produits laitiers : durée de conservation | Pour le lait et les produits laitiers, la GVG ne fixe pas de durée en jours : on suit l'indication du fabricant, et après ouverture d'un emballage d'origine l'étiquette fait foi. |  | M | C | GVG, Base Sanji |
| Crème fouettée : siphon rempli sur place | La crème fouettée se prépare juste avant le service ; un siphon à crème rempli sur place se garde au froid et se consomme dans un jour au plus. | ≤ 1 jour | H | C | GVG |

## Étiquetage, suivi, traçabilité

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Date de production sur les préparations | Toute préparation à l'avance non consommée entièrement le jour de fabrication porte sa date de production. |  | H | - | SO-2013, LU-Haltb |
| Date limite de consommation et durabilité minimale | Pour les denrées très périssables, la date limite de consommation (Verbrauchsdatum) remplace la date de durabilité minimale ; la DDM reste qualitative. |  | H | - | LIV, HyV, Base Sanji |
| Rotation FEFO | On sort d'abord ce qui expire en premier (FEFO), non ce qui est entré en premier (FIFO), car deux lots achetés le même jour peuvent avoir des dates différentes. |  | M | - | Base Sanji |
| Date de décongélation | Une denrée décongelée porte la date de décongélation et se consomme selon les durées des préparations à l'avance. |  | H | - | AG-11, LU-Haltb |
| Traçabilité : un pas en amont, un pas en aval | On doit pouvoir dire de qui on a reçu les produits et à qui on les a livrés (sauf vente directe aux consommateurs), à toutes les étapes ; les informations sont gardées jusqu'à la consommation présumée. |  | H | - | LGV, LMG |

## Allergènes et contamination croisée

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Les 14 allergènes à déclarer | Quatorze groupes : céréales contenant du gluten, crustacés, œufs, poissons, arachides, soja, lait (lactose compris), fruits à coque, céleri, moutarde, sésame, anhydride sulfureux et sulfites (voir le seuil dans hygiene.allergenes.seuil-sulfites), lupin, mollusques. |  | H | - | LIV, GS-Allerg |
| Seuil de déclaration des sulfites | L'anhydride sulfureux et les sulfites sont à déclarer comme allergène au-delà de 10 mg/kg ou 10 mg/l (exprimés en SO2) ; le même seuil vaut pour un ajout involontaire dans un produit. | ≥ 10 mg/kg ou mg/l de SO2 (déclaration au-delà de ce seuil) | H | C | LIV |
| Insectes (poudre de grillon domestique) | GastroSuisse mentionne en plus la poudre de grillon domestique comme information à fournir. |  | F | - | GS-Allerg, Base Sanji |
| Information sur les denrées non préemballées | Pour les plats servis, l'information sur les allergènes est donnée comme pour les denrées préemballées ; elle peut être orale si un avis écrit bien visible l'indique et si l'information est disponible par écrit ou donnée par une personne compétente. |  | H | - | LGV, LIV, GS-Allerg |
| Contamination croisée : denrées non préemballées | Pour les denrées servies sans emballage, il n'est pas exigé d'indiquer les mélanges involontaires ; GastroSuisse recommande néanmoins d'en parler au client quand le risque existe. |  | M | - | LIV, GS-Allerg |
| Seuils pour mélanges involontaires (préemballé) | Pour les produits préemballés, un mélange involontaire est signalé au-delà de 1 g par kg (cas général), 200 mg de gluten par kg, 10 mg de SO2 par kg, 1 g de lactose par kg. | ≤ 1 g/kg (cas général) | M | C | LIV |
| Allergènes d'une préparation composée | Une préparation contient les allergènes de tous ses composants et de leurs dérivés restant dans le produit fini, même sous forme modifiée. |  | H | - | LIV, Base Sanji |
| Contamination croisée : règles de cuisine et de service | Séparer crus et prêts à consommer, utiliser des contenants fermés dédiés, nettoyer entre préparations, avoir une information écrite accessible à l'équipe pour répondre sans improviser. |  | M | - | HyV, Base Sanji, GS-Allerg |

## Hygiène du personnel

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Hygiène personnelle et tenue | Le personnel respecte l'hygiène personnelle ; la tenue est propre et adaptée ; vestiaires et installations d'hygiène sont disponibles ; la personne responsable y veille (mains, corps, vêtements). |  | H | - | HyV |
| Personnes malades ou blessées | L'accès aux zones de manipulation est interdit aux personnes atteintes d'une maladie transmissible par les aliments ; symptômes à annoncer sans délai ; plusieurs cas simultanés dans l'établissement à signaler à l'autorité cantonale. |  | H | - | HyV |
| Retour après vomissements ou diarrhée | La base Sanji propose un retour après 48 heures sans symptômes ; le canton de Saint-Gall recommande, après une infection à norovirus, de tenir la personne guérie à l'écart 2 à 3 jours de plus. | 48 à 72 h sans symptômes | F | P | Base Sanji, SG-Ausscheider |
| Lavage des mains | La base Sanji prévoit eau tiède, savon, environ 30 secondes, séchage à usage unique ; un site de branche privé conseille 40 à 60 secondes. | 30 à 60 s | F | P | Base Sanji, GH-mains |
| Bijoux, ongles, plaies | La base Sanji demande pas de bijoux ni de montre, ongles courts sans vernis, plaies couvertes d'un pansement détectable, cheveux retenus. |  | F | - | Base Sanji |

## Nettoyage, désinfection, nuisibles

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Nettoyer puis désinfecter | Nettoyer retire les souillures, désinfecter réduit les micro-organismes et n'est efficace que sur surface propre ; deux opérations successives. |  | M | - | HyV, Base Sanji |
| Plan de nettoyage écrit | Un plan écrit précise quoi, quand, comment (produit, dosage, temps de contact), qui et le contrôle ; les locaux et équipements restent propres et entretenus. |  | M | - | HyV, Base Sanji, VD |
| Produits d'entretien | Les produits de nettoyage et de désinfection ne se stockent pas dans les locaux où l'on manipule des denrées ; jamais dans des bouteilles alimentaires. |  | H | - | HyV |
| Lutte contre les nuisibles | Locaux et installations sont gardés exempts de nuisibles, avec des procédures de lutte si nécessaire. |  | H | - | HyV |

## Incidents : rappel, TIAC, échantillons

| Sujet | Énoncé | Valeur | Conf. | Vérif. | Sources |
|---|---|---|---|---|---|
| Retrait et rappel | Si des denrées déjà sorties de l'établissement ont pu nuire à la santé, la personne responsable informe sans délai l'autorité cantonale, retire les produits du marché et, s'ils ont atteint les consommateurs, les rappelle et informe sur le motif. |  | H | - | LGV, BLV-Rückruf |
| Toxi-infection alimentaire collective (TIAC) | En cas de suspicion de maladies liées à l'établissement, conserver des échantillons des denrées suspectes et les mettre à disposition ; plusieurs cas simultanés chez le personnel sont à annoncer à l'autorité cantonale. |  | H | - | LGV, HyV, Base Sanji |
| Échantillons témoins : durée de conservation | La base Sanji retient 72 à 100 h au froid positif (0 à 3 °C) ; la norme allemande DIN 10526 demande au moins 7 jours à -18 °C ; le droit suisse ne fixe pas de durée, seulement de conserver des échantillons en cas de foyer. | 72 à 168 h | F | C | LGV, Base Sanji, LAVES-DIN |
| Échantillons témoins : quantité | Au moins 100 g (ou 100 ml) par composant, en récipient fermé, daté, avec la date et l'heure du repas. | ≥ 100 g (ou ml) par composant | M | C | Base Sanji, LAVES-DIN |

## Divergences avec la base Sanji

- Refroidissement (référence unique : hygiene.temperature.refroidissement) : cantons AG/BS, 50 à 10 °C en 2 h ; GVG GastroSuisse, 65 à moins de 5 °C en 90 min (relue) ; base Sanji, 65 à 10 °C en 3 h ; autres sources 2 à 3 h. Valeur prudente gardée : 2 h.
- Désignations : « LPA » est l'ancien nom de la LMG/LDAl ; formation = HyV art. 22 (la base cite l'art. 20) ; autocontrôle = LGV art. 73 à 85 (la base cite « ODAlOUs art. 10 ») ; la base n'est pas modifiée.
- Cuisson : la GVG demande 70 °C à cœur pendant 2 min (comme la base Sanji) ; les aide-mémoire AG et BS ne donnent pas de durée. Remise en température : même exigence dans la GVG ; aucune durée pour y parvenir n'est fixée.
- Sauces cuites : GVG J+2 (relue), SO +3 j, LU +4 j ; plats cuits : +2 j (base : 3 j). Desserts très périssables : 1 jour (SO, LU) contre le jour même (GVG). Lait et produits laitiers : pas de température fédérale unique en cuisine (lait cru 10 °C à l'arrivée et 6 °C en laiterie, HyV) ; 6 °C (site privé) contre 8 °C (lait) et 10 °C (fromage, beurre) pour la base ; durées : selon le fabricant (GVG). Haché : 2 °C (HyV) contre 2 à 4 °C (base) et 5 °C (liste de la GVG, édition 2019). Friture : 170 °C (AG, BS) contre 175 °C (GVG, relue) et jusqu'à 180 °C (base Sanji).
- Décongélation : consommation sous 48 h, 24 h pour les produits délicats (GVG) contre 24 h cru et 48 h cuit (base Sanji).
- Échantillons témoins : base 72 à 100 h ; norme allemande 7 jours congelé ; rien dans le droit suisse lu. Recongélation d'un cuit issu de décongelé : admise par la base, déconseillée par les cantons.
- Contamination croisée (non préemballé) : LIV art. 5 al. 1 let. f dispense de l'indiquer ; GastroSuisse recommande de la déclarer.
- Retour après maladie : 48 h sans symptômes (base) contre 2 à 3 jours après guérison pour le norovirus (Saint-Gall). Lavage des mains : 30 s (base) contre 40 à 60 s (site privé).


## Lacunes

- **Version récente et édition française de la GVG / BPHR** : Le texte intégral de la GVG (2e édition 2019) a été relu et ses chiffres sont repris ; aucune édition plus récente n'est mentionnée sur la page de GastroSuisse, mais ce n'est pas une preuve qu'il n'en existe pas ; le PDF du canton de Vaud (BPHR en français) n'a pas été rouvert. La GVG ne fixe ni durée ni quantité pour les échantillons témoins.
- **Remise en température : durée pour atteindre la température** : La température (70 °C à cœur, 2 min) est lue dans la GVG (entrée hygiene.temperature.remise-en-temperature) ; aucune source lue ne donne la durée maximale pour y parvenir (la GVG dit seulement « appareils ou procédés adaptés »).
- **Durée du processus de décongélation au frigo** : Aucune source lue ne donne les heures de décongélation au frigo ; la GVG limite seulement la consommation après décongélation (48 h, 24 h pour les produits délicats : entrée ajoutée) ; le repère de la base Sanji (24 h cru, 48 h cuit) n'est pas recoupé comme durée de décongélation.
- **Durées en jours des produits laitiers préparés** : La GVG renvoie aux indications du fabricant (entrée ajoutée) et fixe 1 jour pour un siphon à crème rempli sur place ; aucune source suisse lue ne donne de durées en jours pour le lait ouvert, la crème ou le fromage frais : les durées de la base Sanji (lait ouvert 3 j, crème 2 à 5 j, fromage frais 2 à 3 j) ne sont pas recoupées.
- **Contenu type d'une étiquette de préparation interne** : Seule la date de production est confirmée ; date limite interne et autres mentions non trouvées dans une source suisse officielle.
- **Fréquence et durée d'archivage des relevés** : Non fixées par le droit fédéral lu ; dépendent des cantons et de la GVG.
- **Températures de lavage de la vaisselle, dosages de désinfectants** : Chiffres de la base Sanji (55 à 60 °C, 80 à 85 °C) non recoupés.
- **Déclaration obligatoire des maladies (botulisme, TIAC) et loi sur les épidémies** : Loi sur les épidémies (LEp, RS 818.101) non consultée.
- **Aide-mémoire romands** : Les aide-mémoire de durées et de températures lus viennent de cantons alémaniques (AG, BS, SO, LU) ; aucun équivalent romand trouvé.
- **Allergène insectes** : Absents de l'annexe 6 LIV (état 01.07.2025, texte relu) ; la base légale de l'information sur la poudre de grillon, mentionnée par GastroSuisse, n'est pas identifiée.
- **Délai de vente des œufs (21 jours)** : Mentionné par des pages web non officielles ; introuvable dans la VLtH (art. 92, état 01.02.2024), l'ordonnance sur les œufs (état 01.01.2022, lue via un miroir), la HyV (art. 54), la LIV et les mémos LU et AG ; la GVG parle du 21e jour après la ponte pour la conservation au frais, sans y voir un délai de vente. Seule la DDM de 28 jours est confirmée (VLtH art. 92 al. 4) : délai de vente non vérifié.
- **Version en vigueur de la LMG (RS 817.0)** : Dernier état relu : 01.10.2024 (art. 7, 26, 64). Aucun état postérieur repéré sur Fedlex (sondage non exhaustif des états au 1er et au 15 de chaque mois de 2025 et 2026 : aucun PDF) ; la page Fedlex n'est pas lisible sans navigateur : l'état en vigueur à ce jour reste à confirmer.
- **Température légale du lait pasteurisé, du fromage et du beurre en cuisine** : Aucun chiffre dans la HyV pour la restauration ; la GVG (tableau 6.2) donne 5 °C pour les denrées légèrement périssables en général ; 6 °C (site privé) et 8 à 10 °C (base Sanji) non recoupés par une source officielle.

## Sources (consultées le 2026-10-04)

| Code | Titre | Lien |
|---|---|---|
| LMG | Bundesgesetz über Lebensmittel und Gebrauchsgegenstände (Lebensmittelgesetz, LMG ; loi sur les denrées alimentaires et les objets usuels, LDAl) du 20.06.2014, RS 817.0, état au 01.10.2024 | https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2017/62/20241001/de/pdf-a/fedlex-data-admin-ch-eli-cc-2017-62-20241001-de-pdf-a-1.pdf |
| Base Sanji | Base officielle production-stock-hygiène de Sanji | base-officielle-production-stock-hygiene.md §26 |
| VD | Hygiène : autocontrôle et directives | https://www.vd.ch/economie/protection-consommateur/denrees-et-objets/autocontrole-et-hygiene |
| LGV | Lebensmittel- und Gebrauchsgegenständeverordnung (LGV ; ordonnance sur les denrées alimentaires et les objets usuels, ODAlOUs) du 16.12.2016, RS 817.02, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/63/de |
| HyV | Hygieneverordnung EDI (HyV ; ordonnance du DFI sur l'hygiène, OHyg) du 16.12.2016, RS 817.024.1, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/183/de |
| LIV | Verordnung des EDI betreffend die Information über Lebensmittel (LIV ; ordonnance du DFI concernant l'information sur les denrées alimentaires, OIDAl) du 16.12.2016, RS 817.022.16, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/158/de |
| VLtH | Verordnung des EDI über Lebensmittel tierischer Herkunft (VLtH ; ordonnance du DFI sur les denrées d'origine animale), RS 817.022.108, état au 01.02.2024 | https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2017/152/20240201/de/pdf-a/fedlex-data-admin-ch-eli-cc-2017-152-20240201-de-pdf-a.pdf |
| GVG | Leitlinie Gute Verfahrenspraxis im Gastgewerbe (GVG ; BPHR en français), 2e édition 2019, texte intégral | https://gastrosuisse.ch/assets/de/branchenwissen/hygiene-und-lebensmittelsicherheit/selbstkontrolle/gastrosuisse-merkblatt-hygiene-verfahrenspraxis-im-gastgewerbe-gvg-hygiene-leitlinie.pdf |
| SO-2013 | Vorproduzierte, leicht verderbliche Lebensmittel : Lagerung und Haltbarkeitsfristen (juin 2013) | https://www.so.ch/fileadmin/internet/ddi/ddi-gesa-lk/Lebensmittel_und_Gebrauchsgegenstaende/pdf_LMK/Merkblaetter_LMK/Prozesse_und_Taetigkeiten/Vorproduzierte_Lebensmittel_Haltbarkeitsfristen.pdf |
| GH-web | HACCP-Temperaturen im Überblick | https://www.gastronomie-hygiene.ch/haccp-temperaturen-im-ueberblick/ |
| GH-mains | Hände richtig waschen (site privé, non officiel) | https://www.gastronomie-hygiene.ch/hande-richtig-waschen/ |
| LU-Eier | Merkblatt Kennzeichnung Eier HM1308V7 (13.09.2024) | https://lebensmittelkontrolle.lu.ch/-/media/Lebensmittelkontrolle/Dokumente/Merkblaetter_und_Formulare/Lebensmittel/Merkblatt_Kennzeichnung_Eier.pdf |
| AG-11 | Merkblatt Nr. 11 Temperaturführung im Umgang mit Lebensmitteln : Erhitzen, Abkühlen, Auftauen (état 25.09.2025) | https://www.ag.ch/media/kanton-aargau/dgs/dokumente/verbraucherschutz/lebensmittelkontrolle/lebensmittelinspektorat/merkblaetter/merkblatt-11-temperaturfuehrung-im-umgang-mit-lebensmitteln-erhitzen-abkhlen-auftauen.pdf |
| BS-Temp | Merkblatt Temperaturführung im Umgang mit Lebensmitteln : Erhitzen / Warmhalten, Abkühlen, Auftauen (21.05.2026) | https://media.bs.ch/original_file/3149e56eb6c16426bc56ce1407d0c9b45657e304/260521-merkblatt-erhitzen-warmhalten-abkuehlen-auftauen.pdf |
| LU-Haltb | Merkblatt Haltbarkeitsliste HM1303V7 (date non indiquée) | https://lebensmittelkontrolle.lu.ch/-/media/Lebensmittelkontrolle/Dokumente/Merkblaetter_und_Formulare/Lebensmittel/Merkblatt_Haltbarkeitsliste.pdf |
| GS-Allerg | Allergene Lebensmittel (page de branche) | https://gastrosuisse.ch/de/branchenwissen/hygiene-und-lebensmittelsicherheit/allergene-lebensmittel |
| BLV-Rückruf | Öffentliche Warnungen und Rückrufe von Lebensmitteln | https://www.blv.admin.ch/blv/de/home/lebensmittel-und-ernaehrung/rueckrufe-und-oeffentliche-warnungen.html |
| LAVES-DIN | Die Rückstellprobe (norme allemande DIN 10526, non suisse) | https://www.laves.niedersachsen.de/startseite/lebensmittel/lebensmittelhygiene/weitere_informationen_fur_lebensmittelunternehmer/die-rueckstellprobe-eine-absicherung-fuer-den-lebensmittelunternehmer-108784.html |
| SG-Ausscheider | Info-Blatt BIO 90 : Ausscheider von Krankheitserregern (10.12.2018) | https://www.sg.ch/gesundheit-soziales/verbraucherschutz/lebensmittel/gastro--und-verpflegungsbetriebe/_jcr_content/Par/sgch_downloadlist/DownloadListPar/sgch_download_27444713.ocFile/BIO090%20Infoblatt%20Ausscheider.pdf |
