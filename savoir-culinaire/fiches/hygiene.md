# Hygiène, HACCP, allergènes et conservation

Référentiel proposé le 2026-10-04 pour Sanji. **Tout est à valider** (statut `a_valider`, `usage_calcul: false`, portée `a_valider_localement` : le droit et les températures légales dépendent de la version du texte et du canton). Source de vérité : `donnees/hygiene.json` (71 entrées). Textes fédéraux lus à l'état du 01.07.2025 (la LMG, art. 64, relue à l'état 01.10.2024). Les aide-mémoire cantonaux lus sont alémaniques (AG, BS, SO, LU).

Confiance : H = haute, M = moyenne, F = faible. Cuisson, froid et durées : voir les conditions dans le JSON pour chaque écart avec la base Sanji.

## Cadre légal suisse

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Loi sur les denrées alimentaires (LMG / LDAl) | La loi fédérale de base est le Lebensmittelgesetz du 20.06.2014 (loi sur les denrées alimentaires et les objets usuels, LDAl), RS 817.0 ; elle pose la sécurité des denrées et les devoirs de l'exploitant. |  | H | LMG, Base Sanji |
| Autocontrôle : obligation légale | Quiconque produit, traite, stocke, transporte ou remet des denrées doit veiller au respect des exigences légales ; il est tenu à l'autocontrôle, et le contrôle officiel n'en dispense pas. |  | H | LMG, VD |
| Personne responsable | Chaque établissement désigne une personne responsable avec adresse commerciale en Suisse ; à défaut, la direction de l'établissement porte la responsabilité de la sécurité des produits. |  | H | LGV |
| Contenu de l'autocontrôle | L'autocontrôle comprend la bonne pratique (dont l'hygiène), l'application du HACCP ou de ses principes, les prélèvements et analyses, la traçabilité, le retrait et le rappel, et la documentation. |  | H | LGV |
| Documentation de l'autocontrôle | Le concept d'autocontrôle et les mesures prises doivent être documentés par écrit ou de façon équivalente ; les micro-entreprises peuvent réduire la documentation de façon appropriée. |  | H | LGV |
| Ordonnance sur l'hygiène (HyV / OHyg) | L'ordonnance du DFI sur l'hygiène (HyV, OHyg), RS 817.024.1, règle l'hygiène des locaux, du personnel, des températures et de la formation ; les articles de cuisine utiles sont 6, 17, 18, 20 à 22, 24 à 27. |  | H | HyV |
| Ordonnance sur l'information sur les denrées (LIV / OIDAl) | L'ordonnance du DFI concernant l'information sur les denrées alimentaires (LIV, OIDAl), RS 817.022.16, fixe la datation, les indications obligatoires et la liste des allergènes (annexe 6). |  | H | LIV, Base Sanji |
| Guide de branche approuvé | La branche peut remplacer les exigences détaillées d'autocontrôle par une directive de branche approuvée par l'OSAV ; pour la restauration, c'est la GVG (BPHR en français) de GastroSuisse. |  | H | LGV, GVG |
| GVG de GastroSuisse : version | La GVG de GastroSuisse est présentée comme approuvée par l'OSAV le 21.09.2018 (version 2, édition 2019) ; une version plus récente peut exister. |  | M | GVG |
| Amendes maximales en cas d'infraction à la loi sur les denrées | Une infraction intentionnelle aux règles d'hygiène est punie d'une amende jusqu'à 40 000 francs (al. 1) ; si l'auteur agit à titre professionnel (gewerbsmässig) ou pour s'enrichir, jusqu'à 80 000 francs (al. 2). | 40000 à 80000 CHF | H | LMG |

## HACCP et autocontrôle

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| HACCP : obligation proportionnée | Quiconque produit, transforme ou traite des denrées applique une ou plusieurs procédures fondées sur le HACCP ou ses principes, adaptées au risque et à la taille. |  | H | LGV |
| Principes HACCP (sept composantes) | Sept composantes : analyse des dangers, points critiques (CCP), limites critiques, surveillance, mesures correctives, vérification, documentation. | 7 composantes | H | LGV |
| Points critiques usuels en cuisine | Points critiques courants : réception, stockage au froid, cuisson à cœur, refroidissement, maintien au chaud, remise en température ; la liste réelle découle de l'analyse des dangers de l'établissement. |  | M | Base Sanji, HyV |
| Surveillance par relevés | Le maintien au froid et au chaud doit être assuré par des thermomètres et des équipements adaptés et contrôlé dans le cadre de l'autocontrôle ; les enceintes doivent permettre de surveiller, voire d'enregistrer, la température. |  | H | HyV |
| Vérification d'une sonde | Une sonde fausse invalide les relevés : la base Sanji propose un contrôle mensuel à la glace fondante (0 °C, écart toléré environ 0,5 à 1 °C). | 0.5 à 1 °C d'écart toléré | F | Base Sanji |
| Formation du personnel | La personne responsable veille à ce que le personnel soit surveillé et formé selon son activité ; ceux qui conçoivent l'autocontrôle sont formés aux principes HACCP. |  | H | HyV |

## Températures

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Froid positif : denrées périssables | Les préparations cuisinées périssables se stockent à 5 °C au maximum ; le droit fédéral exige seulement une température qui empêche la multiplication des germes, avec des valeurs fixées par catégorie. | ≤ 5 °C | H | SO-2013, GH-web, Base Sanji, HyV |
| Viande hachée | La viande hachée se garde à 2 °C à cœur au maximum. | ≤ 2 °C à cœur | H | HyV, GH-web |
| Volaille, préparations et produits de viande | La volaille domestique, les préparations de viande et les produits carnés se gardent à 4 °C à cœur au maximum. | ≤ 4 °C à cœur | H | HyV, Base Sanji |
| Viande d'ongulés domestiques et gibier | La viande d'ongulés domestiques et de gibier (hors petit gibier à plume ou poil) se garde à 7 °C à cœur au maximum. | ≤ 7 °C à cœur | M | HyV |
| Abats | Les abats et le sang se gardent à 3 °C à cœur au maximum. | ≤ 3 °C à cœur | H | HyV, Base Sanji |
| Poisson et fruits de mer frais | Le poisson frais, le poisson décongelé non transformé et les crustacés et mollusques cuits refroidis se conservent à la température de la glace fondante, au plus 2 °C. | 0 à 2 °C | H | HyV, GH-web, Base Sanji |
| Lait et produits laitiers : températures | Pas de température fédérale unique en cuisine : lait cru, 10 °C au plus à l'arrivée depuis le producteur et 6 °C au plus en laiterie (HyV art. 46 et 48, qui visent la filière, pas la cuisine) ; lait pasteurisé, 6 °C selon un site de branche et 8 °C selon la base Sanji ; fromage et beurre, 10 °C selon la base Sanji seulement. |  | F | HyV, GH-web, Base Sanji |
| Œufs : température de conservation | Les œufs se gardent propres, secs, à l'abri des chocs et du soleil, à une température la plus constante possible ; l'aide-mémoire lucernois conseille le frigo après achat. |  | M | HyV, LU-Eier, Base Sanji |
| Surgélation : température de stockage | Les denrées surgelées se tiennent à -18 °C ou moins, la chaîne du froid ne doit pas être rompue ; les couches périphériques ne dépassent pas -15 °C, et seulement brièvement. | ≤ -18 °C | H | HyV, Base Sanji |
| Cuisson à cœur | Les aliments se cuisent à cœur à 70 °C au minimum, contrôlés à la sonde. | ≥ 70 °C à cœur | H | AG-11, BS-Temp, GH-web, Base Sanji |
| Exceptions de cuisson à cœur | Les aide-mémoire cantonaux admettent des exceptions à la cuisson complète, par exemple le rosbif ; une source de branche parle de 65 °C en surface avec pièce saisie de tous côtés. | ≥ 65 °C en surface | M | AG-11, GH-web |
| Huile de friture | La température du bain de friture ne dépasse pas 170 °C ; la cuisson doit assez durer pour atteindre la température à cœur, surtout sur grosses pièces. | ≤ 170 °C | H | AG-11, BS-Temp |
| Maintien au chaud | Les plats cuits non servis tout de suite se tiennent à 65 °C minimum jusqu'au service ; le droit exige seulement une température qui empêche la multiplication des germes. | ≥ 65 °C | H | AG-11, BS-Temp, HyV, Base Sanji |
| Durée du maintien au chaud | Pour la qualité, le maintien au chaud des plats précuits est limité à trois heures au plus, selon le produit. | ≤ 3 h | H | AG-11, BS-Temp, Base Sanji |
| Refroidissement rapide | Référence unique du référentiel pour le refroidissement : après cuisson, on traverse la zone de 50 °C à 10 °C en deux heures au plus, par refroidissement actif, jamais à température ambiante. | ≤ 2 h (de 50 à 10 °C) | M | AG-11, BS-Temp, GH-web, HyV |
| Techniques de refroidissement | Cellule de refroidissement (sonde à cœur), spirale d'eau froide, eau courante en brassant, ou étalement en couche de 6 cm au plus puis passage au froid ; récipients propres, éviter le contact direct des mains. | ≤ 6 cm d'épaisseur | H | AG-11, BS-Temp |
| Stockage après refroidissement | Les préparations à l'avance restent à 5 °C au maximum, couvertes ou sous vide, séparées des denrées crues non prêtes à consommer. | ≤ 5 °C | H | SO-2013, LU-Haltb, HyV |
| Denrées périssables hors du froid | Les denrées périssables gardées plus de 3 heures sans froid depuis leur fabrication (sandwichs, mise en place en service, restes de buffet) ne se remettent plus en vente. | ≤ 3 h | H | SO-2013, Base Sanji |
| Décongélation : méthodes admises | On décongèle au frigo (récipient avec égouttoir, couvert, liquide jeté), en emballage étanche sous eau froide, ou rapidement au micro-ondes, four ou cuiseur vapeur ; le droit exige un risque microbien minimal ; la décongélation non contrôlée à température ambiante est strictement interdite (AG). |  | H | AG-11, BS-Temp, HyV |
| Recongélation | Une denrée décongelée ne se recongèle pas ; pour le haché et les préparations de viande, c'est écrit dans l'ordonnance. |  | H | AG-11, BS-Temp, HyV |
| Congélation : produits frais seulement | On congèle des produits frais, jamais en fin de durée de conservation ; la congélation reste une bonne pratique à appliquer sans altérer la qualité. |  | H | SO-2013, HyV |
| Panne de froid | En cas de panne, la base Sanji propose de trier sévèrement les denrées très périssables si le frigo reste plus de 4 h entre 5 et 7 °C ou plus, et compte environ 48 h de tenue pour un congélateur plein fermé (24 h à moitié plein). | 24 à 48 h (congélateur fermé) | F | Base Sanji |

## Durées de conservation des préparations

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Légumes, pâtes et riz cuits | Pâtes, riz et légumes cuits : au plus 2 jours après le jour de production, au froid à 5 °C ou moins ; riz et pâtes de préférence préparés frais. | ≤ 2 jours après le jour de production | H | SO-2013, LU-Haltb, AG-11 |
| Sauces cuites | Sauces cuites : de 2 à 4 jours après le jour de production selon la source (GVG J+2, Soleure J+3, Lucerne J+4) ; la prudence conduit à 2 jours si rien d'autre n'est fixé par l'établissement. | 2 à 4 jours après le jour de production | M | SO-2013, LU-Haltb, GVG, Base Sanji |
| Plats de viande cuits, salades assaisonnées, sauces froides | Plats de viande cuits, salades assaisonnées (hors feuilles) et sauces traiteur ou dips : 2 jours après le jour de production. | ≤ 2 jours après le jour de production | H | SO-2013, LU-Haltb |
| Desserts et entremets fragiles | Desserts et entremets très périssables : produit du jour, 1 jour au maximum. | ≤ 1 jour | H | SO-2013, LU-Haltb |
| Denrées périssables entamées | Denrées périssables en emballage ouvert (boîtes, sachets) et charcuterie ou préparations de viande entamées : 2 jours après le jour de production ou d'ouverture. | ≤ 2 jours | M | LU-Haltb |
| Œufs en coquille | La durabilité minimale des œufs ne dépasse pas 28 jours après la ponte ; la base Sanji parle de 3 à 5 semaines au frigo. | ≤ 28 jours après la ponte | H | LU-Eier, AG-03, Base Sanji |
| Préparations à base d'œufs crus | Tiramisu, zabaione, mousse : œufs très frais ou, mieux, œuf pasteurisé ; consommer vite et fixer par écrit durée et température de conservation. |  | M | LU-Eier |
| AG-03 | Merkblatt Nr. 03 Eierverkauf : Lagerung, Kennzeichnung und Selbstkontrolle (état 25.09.2025) | https://www.ag.ch/media/kanton-aargau/dgs/dokumente/verbraucherschutz/lebensmittelkontrolle/lebensmittelinspektorat/merkblaetter/neu-merkblatt-03-eierverkauf-lagerung-kennzeichnung-und-selbstkontrolle.pdf |

## Étiquetage, suivi, traçabilité

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Date de production sur les préparations | Toute préparation à l'avance non consommée entièrement le jour de fabrication porte sa date de production. |  | H | SO-2013, LU-Haltb |
| Date limite de consommation et durabilité minimale | Pour les denrées très périssables, la date limite de consommation (Verbrauchsdatum) remplace la date de durabilité minimale ; la DDM reste qualitative. |  | H | LIV, HyV, Base Sanji |
| Rotation FEFO | On sort d'abord ce qui expire en premier (FEFO), non ce qui est entré en premier (FIFO), car deux lots achetés le même jour peuvent avoir des dates différentes. |  | M | Base Sanji |
| Date de décongélation | Une denrée décongelée porte la date de décongélation et se consomme selon les durées des préparations à l'avance. |  | H | AG-11, LU-Haltb |
| Traçabilité : un pas en amont, un pas en aval | On doit pouvoir dire de qui on a reçu les produits et à qui on les a livrés (sauf vente directe aux consommateurs), à toutes les étapes ; les informations sont gardées jusqu'à la consommation présumée. |  | H | LGV, LMG |

## Allergènes et contamination croisée

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Les 14 allergènes à déclarer | Quatorze groupes : céréales contenant du gluten, crustacés, œufs, poissons, arachides, soja, lait (lactose compris), fruits à coque, céleri, moutarde, sésame, anhydride sulfureux et sulfites (voir le seuil dans hygiene.allergenes.seuil-sulfites), lupin, mollusques. |  | H | LIV, GS-Allerg |
| Seuil de déclaration des sulfites | L'anhydride sulfureux et les sulfites sont à déclarer comme allergène au-delà de 10 mg/kg ou 10 mg/l (exprimés en SO2) ; le même seuil vaut pour un ajout involontaire dans un produit. | ≥ 10 mg/kg ou mg/l de SO2 (déclaration au-delà de ce seuil) | H | LIV |
| Insectes (poudre de grillon domestique) | GastroSuisse mentionne en plus la poudre de grillon domestique comme information à fournir. |  | F | GS-Allerg, Base Sanji |
| Information sur les denrées non préemballées | Pour les plats servis, l'information sur les allergènes est donnée comme pour les denrées préemballées ; elle peut être orale si un avis écrit bien visible l'indique et si l'information est disponible par écrit ou donnée par une personne compétente. |  | H | LGV, LIV, GS-Allerg |
| Contamination croisée : denrées non préemballées | Pour les denrées servies sans emballage, il n'est pas exigé d'indiquer les mélanges involontaires ; GastroSuisse recommande néanmoins d'en parler au client quand le risque existe. |  | M | LIV, GS-Allerg |
| Seuils pour mélanges involontaires (préemballé) | Pour les produits préemballés, un mélange involontaire est signalé au-delà de 1 g par kg (cas général), 200 mg de gluten par kg, 10 mg de SO2 par kg, 1 g de lactose par kg. | ≤ 1 g/kg (cas général) | M | LIV |
| Allergènes d'une préparation composée | Une préparation contient les allergènes de tous ses composants et de leurs dérivés restant dans le produit fini, même sous forme modifiée. |  | H | LIV, Base Sanji |
| Contamination croisée : règles de cuisine et de service | Séparer crus et prêts à consommer, utiliser des contenants fermés dédiés, nettoyer entre préparations, avoir une information écrite accessible à l'équipe pour répondre sans improviser. |  | M | HyV, Base Sanji, GS-Allerg |

## Hygiène du personnel

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Hygiène personnelle et tenue | Le personnel respecte l'hygiène personnelle ; la tenue est propre et adaptée ; vestiaires et installations d'hygiène sont disponibles ; la personne responsable y veille (mains, corps, vêtements). |  | H | HyV |
| Personnes malades ou blessées | L'accès aux zones de manipulation est interdit aux personnes atteintes d'une maladie transmissible par les aliments ; symptômes à annoncer sans délai ; plusieurs cas simultanés dans l'établissement à signaler à l'autorité cantonale. |  | H | HyV |
| Retour après vomissements ou diarrhée | La base Sanji propose un retour après 48 heures sans symptômes. | ≥ 48 h sans symptômes | F | Base Sanji |
| Lavage des mains | La base Sanji prévoit eau tiède, savon, environ 30 secondes, séchage à usage unique, à l'entrée, après le cru, les toilettes, les déchets et le téléphone. | 30 s | F | Base Sanji |
| Bijoux, ongles, plaies | La base Sanji demande pas de bijoux ni de montre, ongles courts sans vernis, plaies couvertes d'un pansement détectable, cheveux retenus. |  | F | Base Sanji |

## Nettoyage, désinfection, nuisibles

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Nettoyer puis désinfecter | Nettoyer retire les souillures, désinfecter réduit les micro-organismes et n'est efficace que sur surface propre ; deux opérations successives. |  | M | HyV, Base Sanji |
| Plan de nettoyage écrit | Un plan écrit précise quoi, quand, comment (produit, dosage, temps de contact), qui et le contrôle ; les locaux et équipements restent propres et entretenus. |  | M | HyV, Base Sanji, VD |
| Produits d'entretien | Les produits de nettoyage et de désinfection ne se stockent pas dans les locaux où l'on manipule des denrées ; jamais dans des bouteilles alimentaires. |  | H | HyV |
| Lutte contre les nuisibles | Locaux et installations sont gardés exempts de nuisibles, avec des procédures de lutte si nécessaire. |  | H | HyV |

## Incidents : rappel, TIAC, échantillons

| Sujet | Énoncé | Valeur | Conf. | Sources |
|---|---|---|---|---|
| Retrait et rappel | Si des denrées déjà sorties de l'établissement ont pu nuire à la santé, la personne responsable informe sans délai l'autorité cantonale, retire les produits du marché et, s'ils ont atteint les consommateurs, les rappelle et informe sur le motif. |  | H | LGV, BLV-Rückruf |
| Toxi-infection alimentaire collective (TIAC) | En cas de suspicion de maladies liées à l'établissement, conserver des échantillons des denrées suspectes et les mettre à disposition ; plusieurs cas simultanés chez le personnel sont à annoncer à l'autorité cantonale. |  | H | LGV, HyV, Base Sanji |
| Échantillons témoins : durée de conservation | La base Sanji retient 72 à 100 h au froid positif (0 à 3 °C) ; la norme allemande DIN 10526 demande au moins 7 jours à -18 °C ; le droit suisse ne fixe pas de durée, seulement de conserver des échantillons en cas de foyer. | 72 à 168 h | F | LGV, Base Sanji, LAVES-DIN |
| Échantillons témoins : quantité | Au moins 100 g (ou 100 ml) par composant, en récipient fermé, daté, avec la date et l'heure du repas. | ≥ 100 g (ou ml) par composant | M | Base Sanji, LAVES-DIN |

## Divergences avec la base Sanji

- Refroidissement (référence unique : hygiene.temperature.refroidissement) : cantons AG/BS, 50 à 10 °C en 2 h ; GVG GastroSuisse, 65 à moins de 5 °C en 90 min (à confirmer) ; base Sanji, 65 à 10 °C en 3 h ; autres sources 2 à 3 h. Valeur prudente gardée : 2 h.
- Désignations : « LPA » est l'ancien nom de la LMG/LDAl ; formation = HyV art. 22 (la base cite l'art. 20) ; autocontrôle = LGV art. 73 à 85 (la base cite « ODAlOUs art. 10 ») ; la base n'est pas modifiée.
- Sauces cuites : GVG J+2, SO +3 j, LU +4 j ; plats cuits : +2 j (base : 3 j). Lait et produits laitiers : pas de température fédérale unique en cuisine (lait cru 10 °C à l'arrivée et 6 °C en laiterie, HyV) ; 6 °C (site privé) contre 8 °C (lait) et 10 °C (fromage, beurre) pour la base. Haché : 2 °C (HyV) contre 2 à 4 °C (base). Friture : 170 °C (AG, BS) contre 175 °C (GVG) et jusqu'à 180 °C (base Sanji).
- Échantillons témoins : base 72 à 100 h ; norme allemande 7 jours congelé ; rien dans le droit suisse lu. Recongélation d'un cuit issu de décongelé : admise par la base, déconseillée par les cantons.
- Contamination croisée (non préemballé) : LIV art. 5 al. 1 let. f dispense de l'indiquer ; GastroSuisse recommande de la déclarer.

## Lacunes

- **Texte intégral de la GVG / BPHR** : PDF de GastroSuisse et du canton de Vaud non lisible par extraction ; aucune valeur lue directement. Versions et chiffres de la GVG (stockage par catégorie, remise en température, échantillons témoins) à recouper dans le guide papier.
- **Remise en température** : Aucune valeur suisse (température et durée) trouvée dans les sources lues.
- **Durées de décongélation au frigo** : Les aide-mémoire suisses lus ne donnent pas de durée ; repère de la base Sanji (24 h cru, 48 h cuit) non recoupé.
- **Durées de conservation des produits laitiers préparés** : Aucune source suisse trouvée ; durées de la base Sanji (lait ouvert 3 j, crème 2 à 5 j, fromage frais 2 à 3 j) non recoupées.
- **Contenu type d'une étiquette de préparation interne** : Seule la date de production est confirmée ; date limite interne et autres mentions non trouvées dans une source suisse officielle.
- **Fréquence et durée d'archivage des relevés** : Non fixées par le droit fédéral lu ; dépendent des cantons et de la GVG.
- **Températures de lavage de la vaisselle, dosages de désinfectants** : Chiffres de la base Sanji (55 à 60 °C, 80 à 85 °C) non recoupés.
- **Déclaration obligatoire des maladies (botulisme, TIAC) et loi sur les épidémies** : Loi sur les épidémies (LEp, RS 818.101) non consultée.
- **Allergène insectes** : Absents de l'annexe 6 LIV (état 01.07.2025, texte relu) ; la base légale de l'information sur la poudre de grillon, mentionnée par GastroSuisse, n'est pas identifiée.
- **Délai de vente des œufs (21 jours)** : Mentionné par des pages web non officielles ; ni les aide-mémoires LU et AG, ni la LIV, ni la HyV relus ne le contiennent ; ordonnance sur les œufs non consultée. Seule la DDM de 28 jours est confirmée : délai de vente non vérifié.
- **Température légale du lait pasteurisé, du fromage et du beurre en cuisine** : Aucun chiffre dans la HyV pour la restauration ; 6 °C (site privé) et 8 à 10 °C (base Sanji) non recoupés par une source officielle.
- **GVG : refroidissement (65 à moins de 5 °C en 90 min) et sauces J+2** : Lus seulement via les autres thèmes du référentiel (extraits de moteur de recherche) ; PDF de la GVG non relu.
- **Version en vigueur de la LMG (RS 817.0)** : Amendes (art. 64) relues à l'état au 01.10.2024 ; Fedlex n'est pas lisible par l'outil sans navigateur, un état plus récent n'a pas pu être contrôlé. Les art. 26, 27 et 28 ont été lus dans l'état de 2017.
- **Aide-mémoire romands** : Les aide-mémoire de durées et de températures lus viennent de cantons alémaniques (AG, BS, SO, LU) ; aucun équivalent romand trouvé.

## Sources (consultées le 2026-10-04)

| Code | Titre | Lien |
|---|---|---|
| LMG | Bundesgesetz über Lebensmittel und Gebrauchsgegenstände (Lebensmittelgesetz, LMG ; loi sur les denrées alimentaires et les objets usuels, LDAl) du 20.06.2014, RS 817.0, état au 01.10.2024 | https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2017/62/20241001/de/pdf-a/fedlex-data-admin-ch-eli-cc-2017-62-20241001-de-pdf-a-1.pdf |
| Base Sanji | Base officielle production-stock-hygiène de Sanji | base-officielle-production-stock-hygiene.md §26 |
| VD | Hygiène : autocontrôle et directives | https://www.vd.ch/economie/protection-consommateur/denrees-et-objets/autocontrole-et-hygiene |
| LGV | Lebensmittel- und Gebrauchsgegenständeverordnung (LGV ; ordonnance sur les denrées alimentaires et les objets usuels, ODAlOUs) du 16.12.2016, RS 817.02, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/63/de |
| HyV | Hygieneverordnung EDI (HyV ; ordonnance du DFI sur l'hygiène, OHyg) du 16.12.2016, RS 817.024.1, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/183/de |
| LIV | Verordnung des EDI betreffend die Information über Lebensmittel (LIV ; ordonnance du DFI concernant l'information sur les denrées alimentaires, OIDAl) du 16.12.2016, RS 817.022.16, état au 01.07.2025 | https://www.fedlex.admin.ch/eli/cc/2017/158/de |
| GVG | Leitlinie Gute Verfahrenspraxis im Gastgewerbe (GVG ; BPHR en français), page de présentation | https://gastrosuisse.ch/de/branchenwissen/hygiene-und-lebensmittelsicherheit/selbstkontrolle |
| SO-2013 | Vorproduzierte, leicht verderbliche Lebensmittel : Lagerung und Haltbarkeitsfristen (juin 2013) | https://www.so.ch/fileadmin/internet/ddi/ddi-gesa-lk/Lebensmittel_und_Gebrauchsgegenstaende/pdf_LMK/Merkblaetter_LMK/Prozesse_und_Taetigkeiten/Vorproduzierte_Lebensmittel_Haltbarkeitsfristen.pdf |
| GH-web | HACCP-Temperaturen im Überblick | https://www.gastronomie-hygiene.ch/haccp-temperaturen-im-ueberblick/ |
| LU-Eier | Merkblatt Kennzeichnung Eier HM1308V7 (13.09.2024) | https://lebensmittelkontrolle.lu.ch/-/media/Lebensmittelkontrolle/Dokumente/Merkblaetter_und_Formulare/Lebensmittel/Merkblatt_Kennzeichnung_Eier.pdf |
| AG-11 | Merkblatt Nr. 11 Temperaturführung im Umgang mit Lebensmitteln : Erhitzen, Abkühlen, Auftauen (état 25.09.2025) | https://www.ag.ch/media/kanton-aargau/dgs/dokumente/verbraucherschutz/lebensmittelkontrolle/lebensmittelinspektorat/merkblaetter/merkblatt-11-temperaturfuehrung-im-umgang-mit-lebensmitteln-erhitzen-abkhlen-auftauen.pdf |
| BS-Temp | Merkblatt Temperaturführung im Umgang mit Lebensmitteln : Erhitzen / Warmhalten, Abkühlen, Auftauen (21.05.2026) | https://media.bs.ch/original_file/3149e56eb6c16426bc56ce1407d0c9b45657e304/260521-merkblatt-erhitzen-warmhalten-abkuehlen-auftauen.pdf |
| LU-Haltb | Merkblatt Haltbarkeitsliste HM1303V7 (date non indiquée) | https://lebensmittelkontrolle.lu.ch/-/media/Lebensmittelkontrolle/Dokumente/Merkblaetter_und_Formulare/Lebensmittel/Merkblatt_Haltbarkeitsliste.pdf |
| GS-Allerg | Allergene Lebensmittel (page de branche) | https://gastrosuisse.ch/de/branchenwissen/hygiene-und-lebensmittelsicherheit/allergene-lebensmittel |
| BLV-Rückruf | Öffentliche Warnungen und Rückrufe von Lebensmitteln | https://www.blv.admin.ch/blv/de/home/lebensmittel-und-ernaehrung/rueckrufe-und-oeffentliche-warnungen.html |
| LAVES-DIN | Die Rückstellprobe (norme allemande DIN 10526, non suisse) | https://www.laves.niedersachsen.de/startseite/lebensmittel/lebensmittelhygiene/weitere_informationen_fur_lebensmittelunternehmer/die-rueckstellprobe-eine-absicherung-fuer-den-lebensmittelunternehmer-108784.html |
