# Base officielle — Production, conservation, stock et hygiène alimentaires

**Version 5.5 — Partie F vérifiée et approfondie.** Document maître unique, destiné à servir de base de
connaissance structurée à une plateforme agentique de gestion de restauration. Fusionne
intégralement : les notes 05 (métier : conservation) et 06 (logistique de stock), le
Référentiel v2 (directive cantonale vaudoise OFCO 01.07.2018 + exigences CAMAC), la note 07
(production culinaire), l'audit de complétude v4 et les enrichissements v5 à v5.4.

Contenu ajouté par l'audit v4 : §9 conservations artisanales ; §22 nettoyage-désinfection ;
§23 personnel, mains, nuisibles ; §26 réclamations, TIAC, échantillons témoins et autorités ;
calibration des sondes et revue mensuelle de direction (§25) ; évaluation des fournisseurs
(§17) ; notification de l'autorité dans la procédure de rappel (§27) ; cas pratiques 17–18 ;
décisions 12–14.

Contenu ajouté par la v5 : §11 très largement étoffé (tables de pertes de parage et de cuisson
portées à plus de 120 lignes couvrant légumes, fruits, viandes détaillées par pièce, volaille,
poissons, crustacés/coquillages et féculents/légumineuses) ; §31 sources et références, qui
comble le renvoi laissé sans section depuis la v4 ; chaque ligne des tables §11 est désormais
autoportante (catégorie + produit + perte + note) pour rester exploitable telle quelle par un
système qui interroge ce document plutôt qu'un humain qui le lit linéairement.

Contenu ajouté par la v5.1 (PARTIE J, nouvelle) : §32 catalogue produits instanciant l'objet
`produit` du §3 (~145 entrées : viandes, volailles, poissons, crustacés/coquillages, produits
laitiers, œufs, plats cuisinés, pain, huiles/secs, puis fruits et légumes frais avec leur
conservation pratique) ; §33 calendrier de saisonnalité fruits/légumes (Suisse / Europe
tempérée), donnée de décision d'achat au même titre que le seuil de réassort (§19) ; §34 six
fiches techniques types instanciant l'objet `ficheTechnique` du §3 avec calcul de rendement et
de coût matière réels, y compris un cas sans allergène et un cas illustrant le gain
d'absorption (> 100 %, §3).

Contenu ajouté par la v5.2 : le catalogue produits (§32) est désormais **corrélé ligne à ligne**
au tableau des pertes (§11.1), et non plus relié par une simple catégorie générique. La colonne
« Perte de parage » cite la ligne exacte du §11.1 dont elle dérive et distingue trois cas :
perte chiffrée inconditionnelle (pièce brute à parer), perte conditionnelle « si transformation
maison » (produit vendu entier, parage optionnel selon l'usage), et « — » explicitement motivé
(produit déjà transformé, sans étape de parage possible) — règle de corrélation consignée en
tête de §32. Correction annexe : deux « | » non échappés dans des cellules de tableau (§4, §30)
qui cassaient le comptage de colonnes ont été corrigés.

Contenu ajouté par la v5.3 (PARTIE D approfondie) : §11.3 nouvelle, la perte de portionnement —
troisième pilier du §10 resté une fourchette unique jusqu'ici — est désormais tabulée par
catégorie et geste (tranchage, désossage à chaud, dressage...), au même niveau de détail que le
parage et la cuisson ; §12 reçoit une table de référence prix net sur huit produits représentatifs
du catalogue, chaînant pour la première fois les trois pertes ensemble, riz inclus comme cas où
le multiplicateur total tombe sous 1 (gain de cuisson) ; §13 uniformise veau/porc/agneau en
tables (au lieu de prose, à l'image du bœuf) et ajoute deux tables absentes : cinquième
quartier/abats, et canard/lapin/gibier ; §14 ajoute une table de temps de cuisson indicatifs,
qui manquait à côté des températures à cœur déjà présentes, avec le rappel que la sonde prime
toujours sur l'horloge.

Contenu ajouté par la v5.4 (PARTIE E approfondie) : chaque section qui n'avait que des règles
abstraites ou des formules reçoit désormais un exemple chiffré, à l'image du traitement déjà
appliqué à la Partie D. §15 : plan d'emplacements concret (zones, sous-emplacements, produits
typiques du §32). §16 : préavis par tempérament quantifiés (grosse pièce / standard / fragile)
au lieu de qualificatifs seuls. §18 : calendrier d'inventaire tournant exemple, posé sur le plan
du §15. §19 : table de réassort sur huit produits couvrant chaque cas de figure (achat déclenché,
manque sous la marge, stock au-dessus de la cible, rupture totale, arbitrage saisonnier §33), et
un exemple chiffré de seuil dynamique. §20 : exemple de reporting mensuel de gaspillage par
motif, avec lecture de la répartition plutôt que du seul total.

Contenu ajouté par la v5.5 (Partie F vérifiée et approfondie) : les deux documents PDF ajoutés
au dossier — directive OFCO du 01.07.2018 et page « Exigences pour les locaux » (CAMAC) — ont
permis une vérification directe du §21 contre les sources primaires plutôt que la mémoire du
modèle (détail au §31) : aucune erreur trouvée, mais deux lacunes comblées (distributeurs
automatiques, transport détaillé) et les citations d'articles précisées avec leurs alinéas
exacts. §22 reçoit un plan de nettoyage type sur douze surfaces/équipements. §25 reçoit un
calendrier de calibration exemple et un ordre du jour type pour la revue mensuelle de direction,
qui n'avait jusqu'ici qu'une existence qualitative. §26 reçoit les coordonnées réelles de
l'autorité cantonale vaudoise comme exemple concret du registre de contact.

Marquage utilisé dans tout le document :

- **[R]** exigence réglementaire ou référentiel validé (source citée en §31) ;
- **[BP]** bonne pratique professionnelle de terrain ;
- **[M]** règle du modèle / décision de conception de l'application ;
- **[E]** estimation ou échelle prudente, à remplacer par les mesures de la maison.

---

# PARTIE A — FONDATIONS

## 1. Principes directeurs

1. Le calcul ne remplace jamais le jugement : aspect, odeur, texture et bon sens priment.
2. On n'affirme jamais qu'un produit est « bon » — seulement qu'il est dans les limites calculées.
3. Rien ne se supprime : tout événement est journalisé ; un lot jeté reste dans l'historique,
   c'est la seule source de données sur le gaspillage.
4. Règle du minimum : la limite affichée est toujours la plus courte des limites actives.
5. Toute durée suppose une chaîne du froid respectée ; sans température maîtrisée, aucune durée
   n'est valable.
6. Le vocabulaire professionnel vit dans le modèle, l'interface parle le langage de l'utilisateur.
7. Hors ligne d'abord, avec toujours une porte de sortie (export texte brut) et une sauvegarde
   régulière — le registre est la preuve de l'autocontrôle, sa perte est inacceptable.

## 2. Cadre réglementaire suisse — repères

Hiérarchie des références **[R]** :

1. **LPA** (loi sur les produits alimentaires, RS 817.0) : base légale.
2. **Ordonnances fédérales** :
   - **ODAlOUs** (RS 817.02) : traçabilité à toutes les étapes de la fabrication, de la
     transformation et de la distribution ; art. 10 : la personne responsable veille à ce
     qu'aucune denrée ne subisse d'altération préjudiciable et prend toutes les mesures pour
     maîtriser les dangers ; retrait et rappel avec information de l'autorité si les denrées
     déjà livrées présentent un danger. Principe : un pas en amont (fournisseur), un pas en
     aval (destinataire), plus la filiation interne des productions.
   - **OHyg** (ordonnance du DFI sur l'hygiène, RS 817.024.1) : aménagement des locaux,
     équipements, transport, eau, déchets, hygiène personnelle, autocontrôle fondé sur HACCP.
   - **OIDA / OIDAl** (RS 817.022.16) : information sur les denrées alimentaires — datation,
     indication du lot précédée de la lettre « L », déclaration des allergènes.
   - **LEpI** (loi sur les épidémies) : foyers de toxi-infection alimentaire et botulisme
     alimentaire à déclaration obligatoire (§26).
3. **Exécution cantonale** : chaque canton publie ses instruments. Pour Vaud : la « Directive
   générale en matière d'aménagement et d'hygiène des établissements du secteur alimentaire »
   (OFCO / chimiste cantonal, Epalinges, 01.07.2018), qui explicite ODAlOUs art. 10 et OHyg
   art. 6–20, et les exigences relatives aux plans de mise à l'enquête (CAMAC). L'autorité
   cantonale fait foi sur son territoire.
4. **Guides de branche validés** : BPHR GastroSuisse, validé par l'OSAV — référentiel
   d'exécution de l'autocontrôle.

Deux natures de date, à ne jamais confondre :

- **DLC** (date limite de consommation, « à consommer jusqu'au ») : sanitaire, non dépassable.
  Réservée aux denrées microbiologiquement très périssables (haché, volaille, poisson, plats
  préparés frais). La mise en vente après la DLC est interdite. **[R]**
- **DDM** (date de durabilité minimale, « à consommer de préférence avant ») : qualitative.
  Le dépassement altère goût, texture, valeur nutritionnelle — rarement la sécurité. La vente
  après DDM reste possible sous la responsabilité du distributeur (contrôle, information). **[R]**

Une application qui traite les deux de la même manière produit soit du gaspillage, soit du
risque : la nature de la date (stricte / qualitative) est une donnée du profil produit. **[M]**

---

# PARTIE B — MODÈLE DE DONNÉES

## 3. Modèle de données unifié

Quatre objets portent tout le système : le **produit** (ce qu'on achète), le **lot** (ce qu'on
possède physiquement), l'**événement** (ce qui lui arrive), la **fiche technique** (ce qu'on
produit). L'état d'un lot est le résultat du repli de son journal d'événements — jamais un
champ modifié en silence. Le journal est la source de vérité : audit, traçabilité,
statistiques. **[M]**

Le §32 instancie cet objet `produit` avec des exemples réels prêts à amorcer le catalogue de
l'application ; le §34 fait de même pour `ficheTechnique`.

```text
produit {
  identité, marque possible
  unité canonique            g | ml | pièce | portion
  conditionnements d'achat   ex. brique 1 L, barquette 500 g
  magasin habituel
  seuil, cible               réassort (§19)
  allergènes[]               parmi les 14 à déclaration obligatoire (§24)
  profil → famille de conservation
  rendementParage            rendement brut → paré (§10)
  rendementCuisson           par méthode de cuisson (§10, §14)
  pertePortionnement         typiquement 3–5 % (§10)
}

profil {
  fridge        jours au froid positif, emballage fermé
  freezer       jours au froid négatif — qualité, pas sécurité (§7)
  opened        jours après ouverture — prime sur fridge
  thawed        heures après décongélation, selon nature cru | cuit
  speedTier     grosse pièce | standard | fragile — pilote le préavis d'alerte
  noFreeze      certains produits ne se congèlent pas
  tempCible     température de stockage de référence (§6)
  note          ex. « transvaser hors de la boîte », « ne pas laver »
}

lot {
  produit, quantité + unité
  état                      fermé | ouvert | congelé | décongelé | transformé | clôturé
  ancre                     événement de référence + horodatage (§5)
  date imprimée + nature    DLC stricte | DDM qualitative
  marque + n° lot fournisseur « L »      traçabilité amont [R]
  conservation artisanale   méthode (acide | autoclave) + pH mesuré (§9)
  prix payé                 valorisation, comparaison (§19)
  emplacement
  parent                    filiation si issu d'une transformation ou d'un parage
}

événement {
  type, horodatage, quantité, motif, auteur
  lot(s) source → lot(s) cible
}

ficheTechnique {
  composants[]              produit ou lot + gramature BRUTE
  méthode de cuisson        parmi les 15 + modernes (§14)
  température à cœur cible  (§14)
  rendement prévu           produit des rendements des étapes (§10)
  allergènes                union des composants (§24)
  coût matière              calculé au prix net (§12)
}

emplacement {
  zone          froid positif | froid négatif | sec
  sous-emplacement          « bac à légumes », « étagère 2 »
  température cible
  voisinage     prêt-à-manger | cru | sec | produits d'entretien (§15)
}
```

Règles d'unité **[M]** : une seule unité canonique par produit ; les conditionnements
convertissent l'achat vers l'unité canonique ; borner toute quantité à zéro plutôt que
d'autoriser un négatif ; un lot regroupe des unités homogènes partageant date et état — toute
divergence (ouverture partielle) crée un nouveau lot ; le modèle ne bloque jamais un rendement
supérieur à 100 % (absorption des féculents), il le note « absorption ».

## 4. Cycle de vie du lot

```text
            réception
                │
             fermé ──ouverture──▶ ouvert ──────────────┐
              │  \                                    │
              │   └─congélation─▶ congelé ─décongélation─▶ décongelé
              │                                              │
              └── parage ──▶ lots dérivés ── transformation ─▶ transformé
                                                             (nouvelle ancre)
   tout état ──consommation / rebut──▶ clôturé (jamais supprimé)
```

| Événement | Effet sur l'ancre et la limite | Contraintes |
| --- | --- | --- |
| Réception | ancre = date/heure de réception | saisir DLC/DDM, marque, n° lot, prix ; contrôle (§17) |
| Ouverture | ancre = ouverture, durée `opened` | un geste depuis la carte du lot ; déduction proposée au premier prélèvement |
| Prélèvement | aucun | quantité −, borne à zéro |
| Déplacement | aucun | journalisé ; vers le congélateur → proposer congélation dans le même geste |
| Parage / découpe | aucun sur l'ancre | pesées avant/après = perte mesurée (§10) ; crée des lots dérivés (filets, parures → fond) avec filiation |
| Congélation | ancre = congélation, durée `freezer` | produit frais uniquement, jamais après limite dépassée [BP] ; refus si `noFreeze` |
| Décongélation | ancre = décongélation, durée `thawed` en **heures** | méthode enregistrée ; prime sur tout le reste |
| Transformation | nouvelle ancre = date/heure de production | filiation source → cible ; allergènes = union des sources ; un produit cuit issu d'un décongelé peut être congelé [BP] |
| Mise en bocal / fermentation | nouvelle ancre = date de fabrication | méthode (acide \| autoclave) + pH mesuré obligatoires (§9) |
| Ajustement | aucun | fixe la quantité observée, motif obligatoire, écart écrit en mouvement |
| Rebut | clôture | motif obligatoire (§20), lot conservé |
| Consommation | clôture à quantité nulle | — |

Recongélation d'un produit décongelé cru : mauvaise pratique. L'application alerte et exige une
confirmation explicite mentionnant le risque ; elle n'interdit pas — l'humain décide. **[M][BP]**

`thawedKind` (cru | cuit) est une propriété de l'**état du lot**, initialisée depuis le profil :
une transformation peut faire passer un lot de cru à cuit. **[M]**

## 5. Dates, ancres et affichage

- Une **ancre** = un événement de référence + son horodatage. Ancres possibles : réception,
  ouverture, congélation, décongélation, production. Toute transition qui change l'ancre est un
  événement journalisé. **[M]**
- **Limite effective** = min(DLC imprimée si stricte, ancre + durée du profil pour l'état
  courant, limite maison éventuelle). **[M]**
- **Limite maison** : délai interne volontairement plus court que la date fournisseur (ex.
  reconditionné = 48 h). Outil professionnel standard ; entre dans la règle du minimum. **[BP]**
- Durées exprimées en jours, sauf post-décongélation et maintien au chaud : **heures**.
- Affichage — trois statuts distincts **[M]** :
  - dans les limites (neutre) ;
  - **qualité dégradée** : DDM dépassée — orange, « à utiliser vite, vérifier » ;
  - **limite dépassée** : DLC ou limite calculée dépassée — rouge, décision humaine requise.
- Sous 48 h, le compte à rebours s'affiche en heures. Une date imprimée congélée n'est plus
  affichée comme référence : c'est la limite congélateur qui compte.

---

# PARTIE C — CONSERVATION

## 6. Températures

Précondition de toute durée de conservation. Les enceintes doivent permettre que les
températures soient vérifiées et enregistrées si nécessaire (OHyg 6 let. d). **[R][BP]**

| Zone / étape | Repère | Statut |
| --- | --- | --- |
| Froid positif, denrées très périssables | ≤ 5 °C (viser 0–4 °C en production) | [R] référentiel BPHR |
| Froid négatif | ≤ −18 °C | [R] |
| Réserve sèche | frais, sec, sombre, à l'abri des nuisibles | [BP] |
| Cuisson / décontamination | ≥ 70 °C à cœur pendant 2 min (sonde) | [R] BPHR |
| Maintien au chaud | ≥ 65 °C à cœur, 3 h maximum | [R] BPHR |
| Refroidissement | traverser 65 → 10 °C en ≤ 3 h, puis stockage ≤ 5 °C | [BP] référentiels pro |
| Sans froid | denrées très périssables > 3 h non réfrigérées → rebut | [BP] mémo cantonal |

Grille de stockage par catégorie (pratique professionnelle courante, à confirmer selon canton
et fournisseur) **[E]** : volaille ≤ 4 °C ; haché ≤ 2–4 °C ; abats ≤ 3 °C ; poisson frais sur
glace fondante 0–2 °C ; œufs ≤ 8 °C constant ; lait et produits laitiers ≤ 8 °C ; fromage et
beurre ≤ 10 °C ; plats prêts ≤ 5 °C.

Logique à enseigner, pas seulement les chiffres : entre ~10 °C et ~65 °C les bactéries se
multiplient (maximum vers 20–45 °C) ; le froid ralentit sans tuer ; la cuisson à cœur tue ; le
temps passé dans la zone de danger est cumulatif — d'où refroidissement rapide, petites
portions, récipients plats, et la règle des 3 h. Côté domestique : thermomètre de frigo, porte
= zone la plus chaude. **[BP]**

Instruments **[BP]** : une sonde fausse invalide tous les relevés — vérification périodique par
glace fondante (0 °C, écart toléré ±0,5–1 °C **[E]**), fréquence mensuelle, résultat consigné
(§25).

## 7. Chaîne du froid : congélation, décongélation, incidents

- Congeler **suspend** la dépréciation, ne l'annule pas. À −18 °C constant, la sécurité est
  quasi illimitée : les durées congélateur sont **qualitatives** (rancissement, brûlure de
  congélation), pas sanitaires (USDA/FDA). **[R]** Le modèle traite donc `freezer` comme une
  durée qualité. **[M]**
- Ne congeler que des produits frais — jamais en fin de limite, jamais pour « rattraper » une
  DLC. **[BP]**
- Décongélation : relance un compte à rebours en heures (repère prudent : 24 h cru, 48 h cuit —
  les sources officielles admettent davantage pour certaines pièces ; la règle maison reste
  volontairement courte). **[E]** Méthodes acceptées : froid positif (référence), micro-ondes
  (cuisson immédiate), eau froide renouvelée ; jamais à température ambiante pour les très
  périssables. **[BP]**
- Recongélation d'un cru décongelé : confirmation explicite (§4). Un produit **cuit** issu d'un
  décongelé peut être congelé : c'est une transformation, d'où la filiation.
- Transport : les conteneurs de denrées sous température contrôlée doivent permettre le maintien
  et le contrôle de la température (OHyg art. 12) — règle complète détaillée au §21.
- **Incident** (panne, coupure) **[M][BP]** : marquer les lots exposés. Repères : frigo resté
  > 4 h au-dessus de 5–7 °C → tri sévère des très périssables ; congélateur plein tient ≈ 48 h,
  à moitié ≈ 24 h si le couvercle reste fermé. Tout doute → rebut motif « incident ».
  L'incident est un événement du journal, daté, avec décision documentée.

## 8. Durées par famille — échelles prudentes

Ordres de grandeur **[E]** (synthèse des référentiels FDA/USDA, mémos cantonaux, usage pro),
à affiner par produit et fournisseur. Frigo ≤ 4–5 °C, congélateur ≤ −18 °C (durées qualité).
Ces familles sont déclinées en produits nommés au §32.1, avec les mêmes durées reprises et
affinées produit par produit.

| Famille | Frigo fermé | Congélo | Après ouverture | Notes |
| --- | --- | --- | --- | --- |
| Viande hachée | 1 j | 90–120 j | 1 j | surface exposée = fragilité |
| Volaille | 1–2 j | 240–365 j | 1 j | morceaux < entier |
| Bœuf/veau/porc en pièce | 3–5 j | 180–365 j | 1–2 j | rôti > steak pour le congélo |
| Poisson maigre | 1–2 j | 180–240 j | 1 j | glace fondante à la réception |
| Poisson gras | 1–2 j | 60–90 j | 1 j | rancissement rapide congelé |
| Charcuterie tranchée | 2–3 j | 30–60 j | 2–3 j | — |
| Lait pasteurisé | selon DLC | déconseillé | 3 j | DLC stricte en Suisse |
| Crème | 5 j | 30 j | 2 j | — |
| Fromage pâte dure | 21–30 j | 180 j | 10–14 j | pâte molle : plus court, `noFreeze` |
| Fromage frais | 5–7 j | `noFreeze` | 2–3 j | — |
| Beurre | 30 j | 180 j | 14 j | — |
| Œufs en coquille | 3–5 sem. | `noFreeze` (hors coquille battus : oui) | — | pointe en bas, ne pas laver, DLC 28 j post-ponte |
| Plats cuisinés maison | 3 j | 90–120 j | 2 j | refroidis 65→10 °C ≤ 3 h avant stockage |
| Soupes, sauces | 3–4 j | 60–90 j | 2 j | — |
| Conserves ouvertes | — | — | 2–3 j | transvaser hors de la boîte |
| Pain | ambiant 2–4 j | 60–90 j | — | jamais au frigo (rassit) |
| Huiles | ambiant 6–12 mois | — | 3–6 mois | rancissement, lumière, chaleur |
| Farine, produits secs | ambiant 6–12 mois | — | — | contenant hermétique, mites alimentaires |
| Fruits & légumes | variable | — | — | hors frigo : tomates, bananes, pommes de terre, oignons, ail |

Enseignements transposables : la durée après ouverture est d'un ordre de grandeur plus courte
que fermé ; au congélateur, plus c'est gras moins ça garde (rancissement) ; la surface exposée
compte (haché ≪ pièce entière).

Signes de **rebut immédiat, sans calcul** **[BP]** : boîte bombée ou fuyarde, bocal sans
dépression à l'ouverture, mousse ou bulles anormales, odeur suspecte, moisissure sur produit
non concerné, emballage de surgelé montrant une décongélation (givre interne massif,
déformation).

## 9. Conservations artisanales — lactofermentation, bocaux, saumures

Règle fondamentale **[BP]** : un bocal sûr emprunte l'une des deux seules voies — **acide**
(pH < 4,6, obtenu par vinaigre, citron ou lactofermentation aboutie) ou **autoclave**
(116–121 °C). Jamais de demi-mesure : la spore de *Clostridium botulinum* résiste 2 h à
100 °C, le bain-marie ou le four à 100 °C ne suffisent donc pas pour les produits peu acides.

- **Lactofermentation** : saumure à 2–3 % de sel, démarrage à 18–22 °C ; la sécurité vient de
  la chute du pH sous 4,6. Le pH est **mesuré et consigné par écrit** avant toute mise en
  service — contrôle non négociable en professionnel. **[BP]**
- **Produits peu acides** (haricots, carottes, courgettes, soupes, terrines, viandes,
  poissons — pH > 4,5) : autoclave obligatoire, ou conservation courte au froid avec
  consommation rapide. **[BP]**
- Règles de fabrication **[BP]** : légumes sains, lavés à l'eau courante ; matériel propre et
  joints neufs ; « chaud sur chaud » ; espace de tête respecté ; test de fermeture à 24 h
  (couvercle concave, « pop » à l'ouverture, aucune bulle). Un bocal qui n'a pas pris :
  48 h au frigo ou retraitement immédiat.
- **Jamais goûter un bocal suspect** : la toxine botulique est inodore, incolore, sans goût.
  Couvercle bombé, fuite, bulles, odeur → rebut sans ouvrir (§8). En secours, le réchauffage
  à 85 °C pendant 5 min détruit la toxine éventuelle des préparations peu acides. **[BP]**
- Le botulisme alimentaire est une maladie à déclaration obligatoire (médecin → médecin
  cantonal). **[R]**
- Modèle **[M]** : une mise en bocal ou une fermentation est un événement créateur de lot avec
  méthode (acide | autoclave), pH mesuré et date — sans ces données, le lot est marqué
  « non conforme ».

---

# PARTIE D — PRODUCTION CULINAIRE

## 10. Les trois pertes de la production

Toute production subit en chaîne trois pertes distinctes **[BP]** (structure des référentiels
professionnels) :

1. **Perte de préparation / parage** (brut → paré, prêt à cuire) : épluchures, parures, os,
   arêtes, dénervage. Table détaillée : §11.1.
2. **Perte de cuisson** (paré → cuit) : eau et graisse perdues ; ou gain par absorption
   (féculents). Table détaillée : §11.2.
3. **Perte de portionnement** (cuit → servi) : tranchage, parage à chaud, chutes d'assiette —
   longtemps restée une fourchette unique « 3–5 % » dans ce document alors que les deux autres
   pertes étaient déjà tabulées produit par produit ; table détaillée désormais au §11.3.

Exemple canonique viande : 6,8 kg de pièce fraîche − 25 % de parures/os = 5,1 kg parés ;
− 29 % à la cuisson = 3,6 kg cuits ; − 4 % au tranchage = portionnable.

### La méthode des multiplicateurs

Pour chaque étape : `multiplicateur = 1 / rendement`. Les étapes chaînées se **multiplient**
entre elles **[BP]** :

```text
carottes : épluchage 15 % → rendement 85 % → multiplicateur 1,18
           étuvage + glacer 30 % → multiplicateur 1,43
           chaîne complète : 1,18 × 1,43 = 1,69
→ pour 10 kg de carottes glacées nettes : commander 16,9 kg bruts
```

Règle d'or **[BP]** : les tables génériques (§11) sont des points de départ — la maison
construit sa propre table par pesées avant/après chaque étape, enregistrées comme événements
« parage » (§4). C'est ainsi que le système prend de l'expérience.

## 11. Tables des pertes — base de rendements de production

Valeurs **[E]** issues des référentiels de formation (type Pauli / table des pertes), des
guides de branche (Proviande Suisse pour la découpe des viandes, guides professionnels de
filetage et d'écaillage) et de l'usage professionnel courant — très largement étoffées en v5
pour couvrir l'essentiel des familles rencontrées en cuisine de restauration. Chaque ligne est
autoportante (catégorie + produit + perte + note) : c'est la structure qui permet à un système
d'interroger une ligne isolément, sans devoir relire tout le tableau. Elle reste un point de
départ prudent, jamais une vérité figée — voir la règle de méthode ci-dessous et §10.

Rappel de méthode **[BP]** : le calibre, la saison, le fournisseur, l'outil et la main du
cuisinier font varier chaque ligne de plusieurs points. Seule la pesée avant/après enregistrée
comme événement « parage » (§4, §10) fait foi pour un produit donné chez un exploitant donné ;
ces valeurs génériques sont faites pour être remplacées, produit par produit, par l'expérience
réelle de la maison — jamais pour s'y substituer durablement.

### 11.1 Préparation / parage (perte en % du brut)

| Catégorie | Produit | Perte | Notes |
| --- | --- | --- | --- |
| Légumes racines/tubercules | Pommes de terre | 15–20 % | selon calibre et saison |
| Légumes racines/tubercules | Carottes | 12–15 % | — |
| Légumes racines/tubercules | Panais | 20–25 % | peau épaisse, cœur parfois fibreux |
| Légumes racines/tubercules | Betteraves crues | 20–25 % | fanes + peau |
| Légumes racines/tubercules | Navets | 15–20 % | — |
| Légumes racines/tubercules | Radis noir | 20–25 % | — |
| Légumes racines/tubercules | Topinambours | 25–30 % | forme irrégulière |
| Légumes racines/tubercules | Patates douces | 15–20 % | — |
| Légumes racines/tubercules | Rutabaga | 20–25 % | — |
| Légumes racines/tubercules | Salsifis | 35–40 % | oxydation rapide une fois pelés |
| Bulbes/alliacés | Oignons | 10–15 % | — |
| Bulbes/alliacés | Échalotes | 12–18 % | — |
| Bulbes/alliacés | Ail (gousses pelées) | 10–15 % | — |
| Bulbes/alliacés | Poireaux | 30–40 % | vert feuillu |
| Bulbes/alliacés | Fenouil | 25–30 % | trognon + tiges externes |
| Choux | Chou blanc / rouge | 15–20 % | trognon, feuilles externes |
| Choux | Chou vert frisé (kale) | 20–25 % | côtes centrales |
| Choux | Chou de Bruxelles | 15–20 % | base + feuilles jaunies |
| Choux | Chou-fleur | 30–40 % | tronc + feuilles |
| Choux | Brocoli | 25–30 % | tige pelée réutilisable |
| Choux | Chou romanesco | ~30 % | — |
| Choux | Pak-choï / chou chinois | 10–15 % | base coupée |
| Feuilles/salades | Épinards, jeunes pousses | 30–40 % | tri + queues |
| Feuilles/salades | Blettes (côtes + feuilles) | 20–30 % | séparer côtes/feuilles = deux cuissons |
| Feuilles/salades | Salade pommée | ~33 % | parage |
| Feuilles/salades | Batavia, iceberg | 20–30 % | feuilles externes |
| Feuilles/salades | Roquette, mâche, jeunes pousses | 5–10 % | tri seulement |
| Feuilles/salades | Endives | 10–15 % | base amère retirée |
| Légumes-fruits | Tomates (pelées à vif, épépinées) | 15–20 % | — |
| Légumes-fruits | Concombre (épluché, épépiné) | 15–20 % | — |
| Légumes-fruits | Courgettes | 10–15 % | — |
| Légumes-fruits | Aubergines | 15–20 % | — |
| Légumes-fruits | Poivrons (épépinés) | 20–25 % | — |
| Légumes-fruits | Potiron, courge butternut | 30–40 % | peau + graines |
| Légumes-fruits | Maïs en épi (égrené) | 60–65 % de perte | épi lourd, grains ≈ 35–40 % du poids |
| Légumineuses/gousses fraîches | Petits pois en cosse | ~50 % | écossage |
| Légumineuses/gousses fraîches | Haricots verts | 8–12 % | équeutage |
| Légumineuses/gousses fraîches | Fèves fraîches en cosse | 60–70 % | double épluchage possible |
| Autres légumes | Asperges | 40–50 % | épluchage + talon |
| Autres légumes | Artichauts (cœurs/fonds) | 60–75 % de perte | feuilles + foin, forte perte visuelle |
| Champignons | Champignons de Paris | 10–20 % | pied, tri |
| Champignons | Cèpes, girolles, chanterelles | 15–25 % | nettoyage terre, pas d'eau |
| Fruits | Pommes, poires | 20–30 % | pelées + trognon |
| Fruits | Agrumes pelés à vif | 30–40 % | — |
| Fruits | Ananas | 45–55 % | — |
| Fruits | Melon, pastèque (chair) | 40–50 % | écorce épaisse |
| Fruits | Mangue (pelée, dénoyautée) | 30–35 % | noyau volumineux |
| Fruits | Avocat (pelé, dénoyauté) | 25–30 % | — |
| Fruits | Banane (pelée) | 35–40 % | — |
| Fruits | Kiwi (pelé) | 15–20 % | — |
| Fruits | Fraises (équeutées) | 5–10 % | — |
| Fruits | Raisin (égrappé) | 3–5 % | — |
| Fruits | Pêches, abricots (pelés, dénoyautés) | 15–20 % | — |
| Fruits | Cerises (dénoyautées) | 12–15 % | — |
| Bœuf | Pièce à rôtir (rôti, rosbif) | 10–20 % | dénervage, dégraissage |
| Bœuf | Entrecôte / côte | 15–25 % | os, parage |
| Bœuf | Filet | 15–20 % | dénervage soigné ; chutes valorisables (tournedos, tartare) |
| Bœuf | Bavette, onglet, hampe | 5–10 % | peu de parage, morceaux nerveux mais fins |
| Bœuf | Joue | 15–20 % | dénervage important |
| Bœuf | Paleron, macreuse | 10–15 % | — |
| Bœuf | Queue | 20–25 % | souvent vendue avec l'os |
| Veau | Noix, sous-noix, quasi | 10–15 % | — |
| Veau | Carré | 15–20 % | — |
| Veau | Épaule | 15–20 % | — |
| Veau | Tendron, poitrine | 20–25 % | — |
| Porc | Filet mignon | 5–10 % | peu de déchet |
| Porc | Échine | 10–15 % | — |
| Porc | Épaule | 15–20 % | — |
| Porc | Jambon (désossage) | 20–25 % | — |
| Porc | Poitrine, travers | 10–15 % | — |
| Agneau | Gigot (désossé) | 15–20 % | — |
| Agneau | Selle, carré | 20–25 % | — |
| Agneau | Épaule | 15–20 % | — |
| Agneau | Collier, poitrine | 20–25 % | — |
| Volaille | Poulet entier → 8 pièces | 30–35 % | carcasse → fond |
| Volaille | Poulet entier → filets | 70–75 % de perte | filets ≈ 20–25 % du poids entier |
| Volaille | Canard entier → magrets + cuisses | 50–55 % de perte | carcasse lourde, graisse à récupérer |
| Volaille | Dinde entière → filets/escalopes | 55–60 % de perte | grosse carcasse, forte rentabilité au fond |
| Volaille | Pintade entière → morceaux | 30–35 % | proche du poulet |
| Volaille | Lapin entier → morceaux | 20–25 % | peu d'os perdu |
| Poissons | Poisson rond → filets | 50–60 % de perte | rendement filet 40–50 % |
| Poissons | Poisson plat → filets | 40–50 % de perte | rendement 50–60 % |
| Poissons | Saumon entier → pavés/filets | 45–55 % de perte | tête et arêtes valorisables en fumet |
| Poissons | Thon (parage peau/arêtes) | 20–30 % | pièce souvent déjà levée à l'achat |
| Poissons | Lotte (queue parée) | 40–50 % de perte | grosse tête, membrane à retirer |
| Poissons | Cabillaud, colin → filets | 50–55 % de perte | — |
| Crustacés/coquillages | Crevettes décortiquées | 50–60 % de perte | carapaces → bisque/fumet |
| Crustacés/coquillages | Langoustines décortiquées | 65–70 % de perte | carapaces très valorisables (bisque) |
| Crustacés/coquillages | Homard, tourteau (chair extraite) | 70–75 % de perte | carcasses → bisque |
| Crustacés/coquillages | Moules décoquillées | 75–80 % de perte | cuisson + décoquillage |
| Crustacés/coquillages | Huîtres décoquillées | 85–90 % de perte | rendement chair très faible |
| Crustacés/coquillages | Calamars, seiches (nettoyés) | 20–30 % | poche, plume, peau |

### 11.2 Cuisson (perte en % du paré, gain pour l'absorption)

| Catégorie | Produit / méthode | Perte | Notes |
| --- | --- | --- | --- |
| Viandes rouges | Rôti au four, traditionnel | 25–30 % | rosé < à point |
| Viandes rouges | Rôti basse température (GT) | 10–15 % | argument économique majeur |
| Viandes rouges | Braisé / mijoté | 30–40 % | compensé par le prix brut bas |
| Viandes rouges | Poêlé (entrecôte, médaillon) | 15–25 % | selon cuisson demandée |
| Viandes rouges | Grillé | 20–25 % | contact direct = perte plus marquée qu'au poêlé |
| Viandes rouges | Bouilli (pot-au-feu) | 30–35 % | protéines cédées au bouillon (valorisé) |
| Viandes rouges | Sous-vide basse température | 5–10 % | perte minimale, cuisson de précision (§14) |
| Porc | Confit | 20–25 % | graisse protège, texture différente |
| Porc | Rôti | 25–30 % | — |
| Volaille | Volaille rôtie entière | 25–30 % | — |
| Volaille | Suprêmes poêlés / grillés | 20–25 % | — |
| Volaille | Cuisses braisées | 25–30 % | — |
| Volaille | Confit de canard | 15–20 % | — |
| Poissons | Poché / vapeur | 10–15 % | douce = faible perte |
| Poissons | Grillé / poêlé | 15–20 % | — |
| Poissons | Frit (pané ou nature) | 10–15 % | gain de matière grasse partiellement compensatoire |
| Poissons | Fumé à chaud | 20–25 % | déshydratation partielle |
| Légumes | Étuvés / glacés | ~30 % | — |
| Légumes | Asperges bouillies | ~20 % | — |
| Légumes | Pommes de terre vapeur | 5–10 % | — |
| Légumes | Pommes de terre frites | 30–40 % | perte d'eau, gain de matière grasse |
| Légumes | Champignons sautés | 40–50 % | forte perte d'eau |
| Légumes | Ratatouille, légumes mijotés | 20–25 % | — |
| Féculents / légumineuses (cuisson à l'eau) | Riz | **gain ×2,5–3** | absorption d'eau |
| Féculents / légumineuses (cuisson à l'eau) | Pâtes | **gain ×2–2,5** | absorption |
| Féculents / légumineuses (cuisson à l'eau) | Semoule, couscous | **gain ×2–2,5** | — |
| Féculents / légumineuses (cuisson à l'eau) | Quinoa | **gain ×2,5–3** | — |
| Féculents / légumineuses (cuisson à l'eau) | Polenta | **gain ×3–4** | forte absorption |
| Féculents / légumineuses (cuisson à l'eau) | Légumineuses sèches (lentilles, pois chiches, haricots) | **gain ×2,2–2,5** | après trempage le cas échéant |

Facteurs qui déplacent ces valeurs **[BP]** : calibre et présence d'os, température et durée,
maturité de la viande, qualité de départ, matériel (four mixte vs rôtissoire), savoir-faire du
découpeur ou du poissonnier, fraîcheur et saison pour les légumes. Aucune table ne dispense des
pesées de la maison — c'est leur seule fonction : donner un point de départ crédible avant que
l'événement « parage » (§4) ne le remplace, produit par produit, par l'expérience réelle de
l'établissement. Statut des sources : voir §31.

### 11.3 Portionnement (perte en % du cuit, brut → servi)

Le troisième pilier du §10, resté une fourchette unique « 3–5 % » jusqu'ici : en réalité la
perte de portionnement varie fortement selon la nature du geste final (tranchage à froid,
parage à chaud, découpe en parts, dressage). Valeurs **[E]**, mêmes réserves qu'au §11.1/§11.2.

| Catégorie | Geste | Perte | Notes |
| --- | --- | --- | --- |
| Viande rôtie, pièce entière | Tranchage en salle ou en cuisine | 5–8 % | bords secs, tranche d'entame perdue |
| Viande grillée/poêlée, portionnée en amont | Dressage direct | 2–4 % | peu de manipulation supplémentaire |
| Viande braisée effilochée/désossée à chaud | Désossage à chaud (jarret, joue) | 8–12 % | os et cartilage retirés à chaud, perte visible |
| Volaille rôtie entière | Désossage/détaillage pour dressage (suprême, cuisse) | 5–8 % | carcasse résiduelle une fois désossée à chaud |
| Poisson cuit en pièce | Levée finale d'arêtes, portion pavé | 3–5 % | — |
| Poisson entier cuit, levé au moment du service | Levée à chaud en salle/cuisine | 5–10 % | manipulation plus délicate à chaud |
| Charcuterie, terrine | Tranchage service | 3–5 % | — |
| Fromage à la coupe (plateau, portions) | Parage de croûte, chutes | 5–10 % | dépend du type de croûte |
| Pâtisserie individuelle | Démoulage, finition | 3–6 % | ratés de démoulage inclus |
| Gâteau, tarte | Découpe en parts | 5–8 % | chutes de bord, premières parts souvent imparfaites |
| Pain | Tranchage service | 2–4 % | — |
| Légumes, garniture | Dressage à l'assiette | 2–3 % | la plus faible des trois pertes, geste simple |

Lien avec le catalogue **[M]** : cette table complète la perte de parage du §32 pour les produits
qui y figurent — un rôti de bœuf accumule ainsi trois pertes indépendantes et documentées
(parage §11.1/§32, cuisson §11.2/§34, portionnement §11.3) au lieu d'une seule perte globale
approximative, ce qui est précisément ce que la méthode des multiplicateurs du §10 suppose.

## 12. Prix net et coût matière

```text
brut à commander     = portions × gramature nette × multiplicateur total
coût matière/portion = poids brut par portion × prix brut/kg
prix net/kg          = prix brut/kg × multiplicateur total
```

Le coût réel de la matière se cache dans les pertes : une pièce à 38 CHF/kg avec un rendement
total de 60 % coûte en réalité **63,30 CHF/kg** une fois cuite et portionnée. Toute négociation
d'achat, tout choix de méthode de cuisson et toute fiche technique raisonnent en prix
net. **[BP]**

Exemple complet — **entrecôte poêlée, 100 portions de 180 g cuits** :

- net cuit nécessaire : 100 × 0,180 = 18,0 kg
- ÷ 0,96 portionnement = 18,75 kg cuits ; ÷ 0,80 cuisson (poêlé 20 %) = 23,4 kg parés ;
  ÷ 0,80 parage (20 %) = **29,3 kg bruts à commander**
- à 38 CHF/kg brut : coût matière = 0,293 kg × 38 = **11,13 CHF/portion**
- à prix de vente 38 CHF : part matière 29 % — dans la fourchette cible 30–35 % **[E][BP]**

Liens **[M]** : le besoin brut calculé alimente le réassort (§19) ; la perte de production
mesurée est distincte du **rebut** (§20) — la première est une constante technique à optimiser,
le second une anomalie motivée. Deux compteurs, jamais confondus.

### Table de référence — prix net multi-produits

Le même calcul appliqué à plusieurs produits du catalogue (§32), en chaînant cette fois les
**trois** pertes désormais toutes tabulées (parage §11.1, cuisson §11.2, portionnement §11.3) —
ce qui n'était pas possible avant l'ajout du §11.3. Prix bruts **[E]** indicatifs (marché suisse
d'exemple), méthode de cuisson choisie précisée car elle change le résultat pour un même
produit.

| Produit | Prix brut (CHF/kg) | Parage (§11.1) | Cuisson (§11.2) | Portionnement (§11.3) | Multiplicateur total | Prix net (CHF/kg servi) |
| --- | --- | --- | --- | --- | --- | --- |
| Rôti de bœuf | 32 | 15 % | 27,5 % (four traditionnel) | 6,5 % (tranchage salle) | 1,74 | 55,60 |
| Entrecôte | 42 | 20 % | 20 % (poêlé) | 3 % (dressage direct) | 1,61 | 67,65 |
| Gigot d'agneau | 34 | 17,5 % | 27,5 % (four traditionnel) | 6,5 % (tranchage salle) | 1,79 | 60,80 |
| Filet mignon de porc | 22 | 7,5 % | 20 % (poêlé) | 3 % (dressage direct) | 1,39 | 30,65 |
| Cabillaud (filet) | 26 | 0 % (déjà levé) | 12,5 % (vapeur) | 4 % (portion pavé) | 1,19 | 30,95 |
| Poulet entier | 9,50 | 32,5 % (détaillé pour dressage) | 27,5 % (rôti entier) | 6,5 % (désossage à chaud) | 2,19 | 20,75 |
| Carottes glacées | 2,20 | 15 % | 30 % (étuvage/glaçage) | 2,5 % (dressage) | 1,73 | 3,80 |
| Riz | 3,00 | 0 % (sec) | **gain ×2,75** (cuisson à l'eau) | 2,5 % (dressage) | 0,37 | 1,10 |

Le riz est un cas volontairement gardé dans cette table : le multiplicateur total tombe sous 1
parce que le gain de cuisson dépasse largement les deux petites pertes qui l'entourent — un
produit peut donc coûter **moins cher au kilo net que brut**, ce que le modèle doit accepter
sans le bloquer (§3, « absorption »). C'est le même mécanisme que la fiche riz pilaf du §34,
vérifié ici sur le prix plutôt que sur le poids.

## 13. Découpes

Règles de base **[BP]** : couper perpendiculairement aux fibres ; travailler la viande bien
froide (plus compacte) ; planche dédiée au cru ; retirer tendons et peau argentée. La
dénomination officielle des morceaux relève de la brochure UPSV « La dénomination des morceaux
de viande » et du code des usages (viande chaude = désossée ≤ 2 h après abattage, avant la
rigidité cadavérique ; sinon viande froide). **[R]**

**La règle qui relie découpe et cuisson** **[BP]** : un muscle très sollicité, riche en tissu
conjonctif (collier, épaule, jarret, poitrine) exige une cuisson longue en milieu humide — le
collagène ne fond en gélatine qu'au-delà de ~60 °C sur longue durée. Un muscle noble peu
sollicité (filet, entrecôte, noix) supporte la cuisson courte et sèche. Toute fiche de découpe
se lit comme une fiche de cuisson.

### Bœuf — pièces et destinations

| Pièce | Quartier | Destination type |
| --- | --- | --- |
| Filet | aloyau | poêler, griller, rôtir GT |
| Entrecôte / côte | train de côtes | griller, poêler |
| Faux-filet | aloyau | rôtir, griller |
| Rumsteck | cuisse | rôtir, griller, émincé |
| Noix, tende de tranche, gîte | cuisse | rôtir GT, émincé, sauté |
| Palette, macreuse, basse-côte | épaule | braiser, mijoter |
| Collier | avant | bouillir, braiser |
| Poitrine, flanc | avant | bouillir, braiser (pot-au-feu) |
| Jarret | cuisse/avant | mijoter (osso buco) |
| Queue | — | braiser (fonds puissants) |

### Veau — pièces et destinations

| Pièce | Quartier | Destination type |
| --- | --- | --- |
| Noix, sous-noix, quasi | cuisse | rôtir, poêler, escalopes |
| Carré | avant | rôtir, griller |
| Épaule | avant | braiser, blanquette |
| Tendron, poitrine | avant | mijoter |
| Jarret | cuisse/avant | mijoter (osso buco) |
| Longe, filet | aloyau | rôtir, griller, médaillons |

### Porc — pièces et destinations

| Pièce | Quartier | Destination type |
| --- | --- | --- |
| Filet mignon | longe | poêler, rôtir court |
| Échine | avant | rôtir, griller |
| Épaule | avant | braiser, rôtir long |
| Jambon | cuisse | cuisson, rôtir, salaison |
| Poitrine, travers | avant/flanc | mijoter, griller, confire |
| Pied | avant/arrière | mijoter |

### Agneau — pièces et destinations

| Pièce | Quartier | Destination type |
| --- | --- | --- |
| Gigot | cuisse | rôtir |
| Selle, carré | aloyau | rôtir, griller |
| Épaule | avant | braiser, rôtir long, confire |
| Collier, poitrine | avant | mijoter, navarin |
| Souris | cuisse | braiser |

### Cinquième quartier — abats

Souvent absent des tables de découpe alors qu'il porte une vraie destination culinaire et un
coût matière très bas **[BP]** — cohérent avec l'esprit nose to tail ci-dessous.

| Abat | Espèce courante | Destination type | Notes |
| --- | --- | --- | --- |
| Foie | veau, volaille, porc | poêler (veau), terrine (volaille, porc) | le foie de veau tolère mal la surcuisson |
| Rognons | veau, agneau, porc | poêler, sauce moutarde | dégorger avant cuisson |
| Ris (thymus) | veau, agneau | poêler, braiser | pièce noble, parage délicat (dégorgeage, membrane) |
| Cervelle | veau, agneau | pochée puis poêlée | usage en recul, réglementation variable |
| Cœur | bœuf, veau, volaille | griller, braiser (bœuf), sauté (volaille) | texture ferme si grillé |
| Langue | bœuf, veau | pochée longuement puis pelée | forte gélatine |
| Joue | bœuf, porc | braiser | gélatineuse, cuisson longue obligatoire |
| Pieds | porc, veau | mijoter, paner-griller | forte gélatine, fonds puissants |
| Tripes | bœuf | mijoter longuement | plat traditionnel, cuisson très longue |

### Canard, lapin, gibier — pièces et destinations

| Pièce | Espèce | Destination type |
| --- | --- | --- |
| Magret | canard | poêler, griller (rosé) |
| Cuisse | canard | confire, braiser |
| Foie gras | canard, oie | poêler, terrine |
| Carcasse | canard | fond, fumet |
| Râble | lapin, lièvre | rôtir, poêler |
| Cuisses | lapin | braiser, mijoter (civet) |
| Selle, gigue | chevreuil, cerf | rôtir GT (selle), braiser (gigue) |
| Épaule | gibier à poil | braiser, civet |

Hygiène du gibier **[BP]** : traçabilité renforcée (lieu et date de tir, contrôle sanitaire
avant mise en circulation), maturation à froid positif contrôlée avant découpe — se rapprocher
du guide de branche applicable, la variabilité entre espèces et provenances est plus grande
qu'en boucherie classique.

### Volaille

- Détaillage : en 2 (demi), 4 (filets + cuisses) ou 8 pièces ; suprêmes = filets avec manchon
  d'aile ; haut de cuisse et pilon séparables ; ailes réservées ; **carcasse → fond/fumet**,
  jamais jetée. **[BP]**
- Rendements **[E]** : filets ≈ 20–25 % du poids entier, cuisses ≈ 25–30 %, le reste =
  carcasse, peau, parures — d'où l'intérêt économique de détailler soi-même si le fond est
  valorisé.
- Hygiène **[R][BP]** : volaille = risque salmonelles/campylobacter — zone cru dédiée, plan de
  travail et couteaux désinfectés après usage, **ne jamais laver la volaille** (aérosols
  contaminants), séparation stricte cru/prêt (§15).

### Poisson

- Levée des filets : poisson rond → 2 filets (ou 4 chez les gros) ; poisson plat → 4 filets.
  Darnes et tronçons pour les grosses pièces ; pavé = portion de filet épaisse ; suprême =
  portion taillée en biais.
- Chaîne : écailler → vider → lever les filets → parer → désarêter à la pince. **[BP]**
- Rendements **[E]** : rond 40–50 %, plat 50–60 % ; parage supplémentaire 5–10 %.
- Arêtes et têtes des poissons **maigres** → fumet (20–30 min, sans bouillir fort) ; les
  carcasses grasses donnent de l'amertume. **[BP]**

### Nose to tail et Special Cuts

Tendance confirmée : valoriser l'animal entier — onglet, hampe, araignée, palette, joue, queue,
abats — au-delà des Prime Cuts (filet, entrecôte). Double gain : coût matière et durabilité.
Références Proviande « Special Cuts » et « Nose to tail ». **[BP]**

## 14. Méthodes de cuisson — état 2026

Le canon de formation actuel retient **15 méthodes** (base Pauli, supports de cours 2025),
classées par milieu de transfert de chaleur :

### Milieu liquide / chaleur humide

| Méthode | Principe | Repères |
| --- | --- | --- |
| Blanchir | court passage en liquide bouillant, puis rafraîchir | pré-cuisson, couleur, vitamines |
| Pocher | liquide **sans ébullition**, 65–80 °C | œufs, poisson, volaille, fruits |
| Bouillir / mijoter (sieden) | frémissement ~95–98 °C, jamais gros bouillons | protéines coagulées sans être détruites ; bouillon clair non couvert |
| Cuire à la vapeur | vapeur, avec ou sans pression | peu de lessivage, cuisson douce |
| Étuver | à couvert, peu de liquide, sans coloration | légumes |

### Milieu combiné (liquide + gras)

| Méthode | Principe | Repères |
| --- | --- | --- |
| Braiser | saisir puis cuire longuement à couvert, peu de liquide | pièces à collagène |
| Poêler | cuisson douce au beurre, à couvert, sans coloration forte | petites pièces nobles |
| Glacer | cuire puis napper d'un fond réduit brillant | légumes, petites pièces |

### Milieu gras / chaleur sèche

| Méthode | Principe | Repères |
| --- | --- | --- |
| Sauter | feu vif, peu de gras, pièces saisies rapidement | émincés, petites pièces |
| Rôtir | chaleur sèche, arrosage | four ou rôtissoire, pièces nobles |
| Griller | rayonnement intense | marquage, pièces minces |
| Frire | immersion dans le gras | pré-friture 130–150 °C, finition 170–180 °C |
| Brunir (rösten) | coloration de départ au gras | base de braisages et sauces |

### Four / air chaud

| Méthode | Principe | Repères |
| --- | --- | --- |
| Cuire au four | air chaud, enceinte close | pâtes, pains, gratins de légumes |
| Gratiner | coloration de surface en finition | salamandre, four très chaud |

### Couche moderne (post-2012)

- **Cuisson basse température (GT / Δt)** : enceinte 60–80 °C, sonde à cœur ; pertes réduites
  de moitié sur les rôtis ; exige la gestion documentée temps × température. **[BP]**
- **Sous-vide** : cuisson de précision en sachet ; la sécurité = couple température × durée
  (pasteurisation), jamais la température seule ; refroidissement rapide si non servi
  (§6). **[BP]**
- **Four mixte (vapeur combinée)** : devenu le standard de production — modes vapeur, mixte,
  air pulsé, Δt, régénération ; programmes horodatés = preuve pour l'autocontrôle. **[BP][M]**
- Fumage, cuisson en croûte, bain-marie : variantes spécialisées du canon.

### Physique utile et températures à cœur

- Transfert : conduction (contact), convection (fluide/air), rayonnement (gril).
- Jalons : coagulation des protéines 60–70 °C ; collagène → gélatine > 60 °C longue durée ;
  réaction de Maillard > 140 °C ; caramélisation > 160 °C.
- Sécurité par défaut : **≥ 70 °C à cœur pendant 2 min** (BPHR) **[R]**, exceptions documentées
  (viande de boucherie rosée). Cibles usuelles **[E][BP]** : volaille et haché 72–75 °C ;
  porc 62–65 °C ; agneau rosé 56–58 °C ; bœuf rosé 52–54 °C, à point 60–65 °C ; poisson
  55–60 °C ; remise en température ≥ 70 °C.

### Temps de cuisson indicatifs

Le tableau ci-dessus donne des **températures** ; il manquait un repère de **durée**, pourtant
la donnée la plus demandée en cuisine de production. Valeurs **[E]**, à lire avec une règle
absolue **[BP]** : la température à cœur (relevée à la sonde) fait toujours foi sur l'horloge —
c'est un cas d'application directe du principe n° 1 (§1, « le calcul ne remplace jamais le
jugement »). Le temps au poids fonctionne pour un four traditionnel ; il perd presque tout son
sens en basse température et en sous-vide, où c'est l'épaisseur et la température cible qui
pilotent, pas le poids total de la pièce.

| Méthode | Produit / pièce | Repère de temps | Notes |
| --- | --- | --- | --- |
| Rôtir, four traditionnel | Rôti de bœuf | ~15–20 min/kg (rosé), +5 min/kg (à point) | + repos 10–15 min avant tranchage |
| Rôtir, four traditionnel | Gigot d'agneau | ~15 min/kg (rosé), ~20 min/kg (à point) | + repos avant tranchage |
| Rôtir, four traditionnel | Volaille entière (~1,5 kg) | 55–70 min (180–200 °C) | vérifier un jus clair à la cuisse |
| Rôtir basse température (GT, 60–80 °C enceinte) | Rôti de bœuf, gigot | 2–4 h selon poids et cible à cœur | piloter par sonde, pas par horloge — temps non proportionnel au poids |
| Griller | Entrecôte (2–3 cm) | 3–4 min/face (saignant) | dépend surtout de l'épaisseur, pas du poids |
| Poêler | Filet mignon de porc | 12–15 min, retourné régulièrement | à cœur 62–65 °C |
| Braiser / mijoter | Épaule, jarret, joue | 2,5–4 h à frémissement | jusqu'à ce que la viande se détache à la fourchette, pas à l'horloge |
| Sous-vide | Filet de bœuf (~4 cm d'épaisseur) | 1–2 h à température cible | temps de pasteurisation lié à l'épaisseur (§14), pas au poids |
| Sous-vide | Suprême de volaille | 1–1,5 h à 65 °C | — |
| Pocher / vapeur | Filet de poisson (~150 g) | 8–12 min | selon épaisseur |
| Pocher | Œuf mollet / poché | 3–4 min à l'eau frémissante | — |
| Bouillir / mijoter | Pièce à bouillir (pot-au-feu) | 3–4 h à frémissement | écumer régulièrement |
| Cuire au four | Gratin dauphinois | 60–75 min à 160–170 °C | pommes de terre tendres à cœur |
| Cuire au four | Pain (baguette) | 20–25 min à 230–250 °C | — |
| Frire | Pommes frites, finition | 3–4 min à 170–180 °C | après préfriture 130–150 °C (§14) |
| Blanchir | Légumes verts | 1–3 min puis rafraîchir | selon le légume ; conserve couleur et texture |
| Étuver | Légumes (courgettes, poireaux) | 8–15 min à couvert | — |

---

# PARTIE E — GESTION DE STOCK

## 15. Emplacements et voisinage

- Trois zones : froid positif, froid négatif, sec. Les **sous-emplacements** rendent
  l'application réellement utile ; configurables, avec des défauts crédibles. **[M]**
- Déplacer un lot est un mouvement journalisé ; vers le congélateur = proposer la congélation
  dans le même geste. **[M]**
- Séparation cru / prêt à la consommation : les denrées crues non prêtes doivent être conservées
  séparément des denrées prêtes à la consommation (OHyg 17 al. 2). **[R]** Application pratique :
  prêt-à-manger **au-dessus**, cru **en dessous**, jamais l'inverse (égouttage). **[BP]**
- Substances préjudiciables ou impropres à la consommation : étiquetées comme telles et stockées
  à part, en récipients fermés (OHyg 17 al. 5). **[R]**
- Produits de nettoyage et de désinfection : jamais entreposés dans les locaux alimentaires
  (OHyg 6 let. h). **[R]**
- Allergènes : contenants fermés dédiés. **[BP]**
- Porte de frigo : zone la plus chaude — boissons et condiments, pas le lait ni les œufs en
  contexte pro. **[BP]**

### Exemple de plan d'emplacements

Les règles ci-dessus restent abstraites tant qu'elles ne sont pas posées sur un plan concret.
Exemple **[E]** pour une cuisine de taille courante, à adapter à la configuration réelle des
locaux (§21) :

| Zone | Sous-emplacement | Produits typiques (§32) | Règle appliquée |
| --- | --- | --- | --- |
| Froid positif | Étagère du haut | charcuterie entamée, fromages, restes, plats cuisinés | prêt-à-manger au-dessus (marche en avant, §21) |
| Froid positif | Étagère du bas | viandes et volailles crues | cru en dessous, jamais l'inverse |
| Froid positif | Bac du bas dédié | poissons crus (sur glace fondante si possible) | séparé de la viande crue, odeurs et croisement |
| Froid positif | Bac à légumes | légumes et fruits nécessitant le froid (§32.2) | hors zone cru/prêt, compartiment propre |
| Froid positif | Porte | condiments, boissons ouvertes | zone la plus chaude, jamais lait ni œufs en pro |
| Froid positif | Contenants dédiés | allergènes déclarés (§24) | fermés, identifiés, à l'écart |
| Froid négatif | Bac matières premières | viandes, volailles, poissons à congeler | produits frais uniquement, jamais en fin de limite (§7) |
| Froid négatif | Bac produits finis | plats cuisinés, portions, fonds | filiation tracée (§4) |
| Sec | Étagère féculents/secs | riz, pâtes, légumineuses sèches, farine (§32.1) | hermétique, à l'abri des nuisibles (§23) |
| Sec | Étagère conserves/huiles | conserves fermées, huiles | à l'abri de la lumière et de la chaleur |
| Cave / réserve ambiante | Bac racines | pommes de terre, oignons, ail, courges (§32.2) | jamais au frigo, frais et sombre |
| Hors zone alimentaire | Armoire dédiée | produits de nettoyage et de désinfection | jamais dans un local alimentaire (OHyg 6 let. h, §21) **[R]** |

## 16. Rotation FEFO, alertes et vocabulaire d'interface

- La rotation correcte est **FEFO** — premier expiré, premier sorti (et non PEPS : deux lots du
  même produit achetés le même jour peuvent porter des dates différentes). Elle ne se décrète
  pas : la file de priorité de l'écran d'accueil **est** la politique de rotation. **[M]**
- En rayon : choisir la date la plus longue ; à la réception, une date courte détectée devient
  priorité de consommation immédiate. **[BP]**
- Préavis par tempérament **[M]** : grosse pièce = préavis long (planifier un repas ou une
  production, décongélation 24–48 h incluse) ; standard = moyen ; fragile = court (inutile
  d'alerter dix jours avant). Réglage utilisateur par tempérament, pas constante. Un foyer ou
  un service qui cuisine tous les jours n'a pas les mêmes besoins que celui qui cuisine le
  week-end.

Valeurs de préavis par défaut **[E]**, réglables, appliquées au champ `speedTier` du profil
(§3) — exemples de produits tirés du catalogue (§32) :

| Tempérament (`speedTier`) | Préavis par défaut | Exemples de produits (§32) | Justification |
| --- | --- | --- | --- |
| Grosse pièce | 3–5 jours avant la limite effective | Rôti de bœuf, gigot d'agneau, poulet/pintade entiers, épaule à braiser | temps de planifier un repas ou une production, décongélation 24–48 h incluse (§7) |
| Standard | 1–2 jours avant | escalopes, filets de poisson, charcuterie tranchée, plats cuisinés maison | suffisant pour un repas improvisé, pas de production à planifier |
| Fragile | jour même à J-1 | salades, épinards, poisson frais entier, fraises, crème fouettée | un préavis plus long serait inutile — le produit est déjà en fin de vie utile au moment où il compterait |

Le modèle parle professionnel, l'interface parle l'utilisateur (principe 6) **[M]** :

| Concept du modèle | Formulation d'interface |
| --- | --- |
| Réception / mise en stock | « ranger les courses » |
| Emplacement / sous-emplacement | « frigo, bac à légumes » |
| Rotation FEFO | « à consommer vite » |
| Inventaire tournant | « vérifier un tiroir » |
| Point de commande | « seuil » |
| Réapprovisionnement | « liste de courses » |
| Démarque | « jeté » |
| Parage / découpe | « préparer, tailler » |
| Filiation | « fait à partir de » |
| Limite effective | « à consommer avant » (calculée) |

## 17. Réception et contrôle à réception

Le contrôle à réception n'est pas une option : la personne responsable ne doit pas accepter de
matières premières dont elle sait ou a tout lieu de supposer qu'elles sont contaminées ou
décomposées (OHyg 17 al. 1). **[R]**

Grille professionnelle **[R][BP]** (allégée en domestique) :

1. température du produit (sonde ou infrarouge + contact sur les emballages) ;
2. date résiduelle suffisante pour l'usage prévu ;
3. intégrité des emballages, aspect, odeur ;
4. document de livraison, marque et n° de lot « L » — traçabilité amont ;
5. refus motivé et documenté si critère non conforme (chaîne du froid rompue, date trop courte,
   emballage défectueux, signes de décongélation sur surgelés).

Fournisseurs **[BP]** : liste de fournisseurs évalués (fiabilité de la chaîne du froid,
documents de livraison complets, régularité, réactivité en cas de rappel) ; un fournisseur qui
échoue deux contrôles est réévalué.

Contraintes d'usage **[M]** : 10 à 30 articles en quelques minutes ; surgelés traités en
premier ; emplacement habituel pré-rempli ; saisie de la date **à la réception, jamais après** ;
marquage « à compléter » accepté ; lots créés en une seule validation, annulable.

## 18. Inventaire, écarts et ajustements

- Le stock théorique dérive toujours du réel (prélèvements non saisis, pesées approximatives,
  partages). Réponse : action **ajuster** — quantité observée + motif + écart écrit en
  mouvement ; jamais de correction silencieuse ; borne à zéro. **[M]**
- Un taux d'ajustement élevé sur un produit signale un mode de quantité mal choisi (poids là où
  il faut des portions). **[M][BP]**
- Inventaire tournant **[BP]** : cadence par sous-emplacement (ex. un tiroir par semaine),
  l'application propose la zone du jour. En contexte pro : inventaire mensuel complet valorisé
  — base du calcul du coût matière.

Exemple de calendrier tournant **[E]**, posé sur le plan d'emplacements du §15 — une zone à
faible enjeu (le sec) revient moins souvent qu'une zone à rotation rapide et à risque sanitaire
(le froid positif) :

| Jour | Sous-emplacement (§15) | Fréquence | Notes |
| --- | --- | --- | --- |
| Lundi | Froid positif — bac à légumes | hebdomadaire | rotation rapide, produits fragiles (§32.2) |
| Mardi | Froid positif — étagère du bas (cru) | hebdomadaire | enjeu sanitaire, à ne jamais sauter |
| Mercredi | Froid positif — étagère du haut (prêt-à-manger) | hebdomadaire | inclut le contrôle des restes et plats cuisinés |
| Jeudi | Froid négatif — bacs matières premières et produits finis | bihebdomadaire | rotation plus lente (durées qualité, §7) |
| Vendredi | Sec — féculents, conserves, cave | mensuel | rotation la plus lente, risque le plus faible |
| Fin de mois | Toutes zones | inventaire complet valorisé | base du coût matière (§12) en contexte pro |

Ce calendrier reste un point de départ **[E]** : la fréquence réelle doit suivre le volume et la
sensibilité de chaque zone chez l'exploitant, pas ce tableau tel quel.

## 19. Réassort, liste de courses, prix

```text
stock(produit)  = somme des quantités des lots actifs, en unité canonique
seuil(produit)  = seuil propre au produit, sinon seuil global de réglage
manque(produit) = max(0, cible - stock)
à acheter       = manque > marge  ou  marquage manuel
```

- Conversion en conditionnement d'achat : « il manque 1,5 L » → « 2 briques de 1 L ». Toujours
  arrondir au-dessus et afficher la quantité réellement achetée. **[M]**
- Pour les fruits et légumes frais, le calendrier de saisonnalité (§33) est une donnée de
  décision d'achat au même titre que le seuil : un manque en pleine saison locale et le même
  manque hors saison ne pèsent ni le même prix ni le même rendement (§11). **[BP]**
- Le marquage manuel couvre ce que le calcul ignore (invités, envie, promotion) ; un article
  retiré ne revient pas par recalcul — mémoriser le refus, permettre de le restaurer ; un
  produit désactivé sort du réassort mais reste dans l'historique. **[M]**
- Évolution prévue : seuil dynamique = consommation moyenne × couverture cible (jours entre
  deux achats) ; à terme, le besoin de production (fiches techniques planifiées, §3) pousse
  directement le besoin brut dans le réassort. Le seuil statique reste le défaut. **[M]**
- Liste : regroupée par magasin habituel, besoins déduits séparés des ajouts manuels, cases
  persistantes, **copie en texte brut** (porte de sortie d'une application hors ligne). **[M]**
- Prix comparable au kg ou au L uniquement si quantité totale connue et unité convertible —
  sinon « comparaison insuffisante », jamais de chiffre approximatif. **[M]**
- Valorisation du stock : somme des (quantité × prix) des lots actifs ; base du coût matière
  et de la valorisation du gaspillage. **[BP]**

### Exemple chiffré — réassort sur plusieurs produits

La formule du haut de section reste abstraite tant qu'elle n'est pas appliquée à un vrai jeu de
produits. Exemple **[E]** sur huit produits du catalogue (§32), un par cas de figure utile à
distinguer :

| Produit | Unité | Stock actuel | Seuil | Cible | Manque | À acheter ? | Conditionnement proposé |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lait pasteurisé | L | 0,5 | 1 | 3 | 2,5 | oui | 3 briques de 1 L (arrondi au-dessus) |
| Farine de blé | kg | 2 | 1 | 5 | 3 | oui | 1 sac de 5 kg (meilleur conditionnement disponible) |
| Riz sec | kg | 4 | 2 | 5 | 1 | non — manque ≤ marge | — |
| Carottes | kg | 1 | 3 | 5 | 4 | oui | 4 kg en vrac (pas de conditionnement fixe) |
| Filets de poulet | kg | 0 | 2 | 4 | 4 | oui, prioritaire | 4 kg chez le fournisseur habituel |
| Beurre | kg | 0,5 | 0,25 | 1 | 0,5 | oui | 2 plaquettes de 250 g |
| Huile d'olive | L | 3 | 1 | 2 | 0 (stock > cible) | non | — |
| Tomates | kg | 0 | 2 | 3 | 3 | oui, mais vérifier la saison (§33) | 3 kg — arbitrage prix/rendement si hors saison |

Lecture **[BP]** : le riz montre la règle « manque > marge » qui évite de déclencher un achat
pour un écart insignifiant ; l'huile montre qu'un stock au-dessus de la cible ne déclenche
jamais rien, même loin du seuil ; les filets de poulet à zéro montrent qu'un manque total doit
remonter comme prioritaire, pas juste comme une ligne de plus dans la liste ; les tomates
montrent le lien avec le §33 — le même manque n'a pas le même poids de décision selon la saison.

### Exemple chiffré — seuil dynamique

Le seuil dynamique (consommation moyenne × couverture cible) reste une évolution prévue tant
qu'il n'est pas mesuré ; exemple **[E]** montrant pourquoi un seuil statique mal réglé peut
sous-estimer ou surestimer le besoin réel :

```text
Lait pasteurisé : consommation moyenne mesurée = 0,8 L/jour
                  couverture cible souhaitée   = 4 jours (livraison tous les 4 jours)
                  seuil dynamique = 0,8 × 4 = 3,2 L

Seuil statique actuellement réglé : 1 L → sous-évalué de plus de 2 L : deux jours de rupture
possible avant la prochaine livraison si la consommation réelle suit la moyenne mesurée.
```

Ce calcul suppose une consommation mesurée sur plusieurs cycles — il ne remplace le seuil
statique que lorsque la maison a assez d'historique dans le journal d'événements (§4) pour
qu'il soit fiable, pas dès le premier jour d'usage. **[M]**

## 20. Gaspillage mesuré et valorisé

- Motif obligatoire au rebut : périmé, abîmé, restes, erreur d'achat, incident, rappel. **[M]**
- Jamais de suppression d'un lot jeté. **[M]**
- Valorisation : quantité × prix unitaire du lot (sinon prix moyen du produit). Reporting
  mensuel en CHF et par motif. **[BP]**
- Lecture des motifs **[BP]** : « périmé » → problème d'alerte ou de planification ;
  « erreur d'achat » → liste de courses ; « restes » → portions ; « incident » → équipement ou
  procédure. Distinguer le rebut sanitaire (non négociable) du rebut évitable (cible
  d'amélioration). En restauration, la démarque est un indicateur de gestion suivi.
- Distinction fondamentale **[M]** : la **perte de production** (parage, cuisson,
  portionnement — §10) est une constante technique mesurée par pesées ; le **rebut** est une
  anomalie motivée. Confondre les deux fausse les deux indicateurs.
- Manutention des rebuts : récipients fermés à ouverture hygiénique, retirés rapidement des
  locaux de production (OHyg 15, §21). **[R]**

### Exemple chiffré — reporting mensuel

Exemple **[E]** de sortie du reporting mensuel décrit ci-dessus, pour un mois type :

| Motif | Nombre de lots | Valorisation (CHF) | Part du total | Lecture (§20) |
| --- | --- | --- | --- | --- |
| Périmé | 12 | 145 | 38 % | motif dominant → alerte insuffisante ou seuils de réassort trop hauts (§19) |
| Restes | 8 | 90 | 24 % | portions trop grandes ou planification à revoir (fiches techniques, §34) |
| Erreur d'achat | 5 | 60 | 16 % | doublons ou anticipation à revoir (liste de courses, §19) |
| Incident | 2 | 70 | 18 % | ex. panne de congélateur → maintenance équipement (§7) |
| Abîmé | 1 | 15 | 4 % | manutention ou stockage à revoir (§15) |
| Rappel | 0 | 0 | 0 % | aucun cas ce mois-ci |
| **Total** | **28** | **380** | **100 %** | — |

Lecture **[BP]** : ce n'est pas le total (380 CHF) qui pilote l'action mais la répartition —
ici, « périmé » domine largement et pointe vers les seuils de réassort plutôt que vers un
problème de manutention, alors qu'un mois où « incident » dominerait pointerait vers la
maintenance des équipements plutôt que vers les habitudes d'achat. Le motif change la personne
à qui parler, pas seulement le chiffre à regarder.

---

# PARTIE F — HYGIÈNE ET CONFORMITÉ

## 21. Aménagement, locaux et flux

Référentiel : directive générale du canton de Vaud (OFCO / chimiste cantonal, 01.07.2018),
qui explicite ODAlOUs art. 10 et OHyg art. 6–20 ; vérifier l'instrument équivalent pour tout
autre canton d'exploitation. **[R]**

### Marche en avant

- Garantir dans la mesure du possible la marche en avant — flux des personnes et des
  marchandises — pour prévenir les contaminations croisées. **[R]**
- Conséquence modèle **[M]** : un plan d'emplacements n'est pas neutre. Il suit le flux
  réception → stockage → préparation → cuisson → service, et les zones « sale » et « propre »
  ne se croisent pas.

### Locaux et surfaces

Citations précises **[R]**, vérifiées directement sur le texte de la directive OFCO du
01.07.2018 (§31) plutôt que reconstruites de mémoire :

- Sols : lisses, étanches, hydrofuges, résistants à l'abrasion, non toxiques, nettoyables et
  désinfectables (OHyg art. 7 al. 2 let. a).
- Murs : mêmes exigences que les sols, surface lisse jusqu'à une hauteur appropriée à l'activité
  (OHyg art. 7 al. 2 let. b).
- Plafonds, faux plafonds, toitures apparentes : durs, lisses, conçus pour empêcher
  l'encrassement, la condensation et les moisissures (OHyg art. 7 al. 2 let. c).
- Bois brut interdit dans les locaux où sont manipulées des denrées (précision cantonale sur
  OHyg art. 7).
- Fenêtres et ouvertures sur l'extérieur, **y compris porte-fenêtres** : moustiquaire ou
  équivalent facilement amovible pour le nettoyage (OHyg art. 7 al. 2 let. d).
- Éclairages en verre : protège-néon ou cache-ampoule (précision cantonale).
- Hotte de ventilation au-dessus de tout appareil de cuisson ou chauffage dégageant vapeur ou
  fumée (OHyg art. 10, précision cantonale) ; aucun flux d'air pulsé d'une zone contaminée vers
  une zone propre (OHyg art. 10 al. 2).
- Séparateur à graisses : jamais dans un local contenant des denrées alimentaires, même s'il est
  exigé par un autre service de l'État (précision cantonale explicite, en lien avec la directive
  DCPE 560 du canton sur l'assainissement des cuisines professionnelles).
- Évacuation des eaux résiduaires : conçue pour éviter tout écoulement d'une zone contaminée
  vers une zone propre, systèmes facilement nettoyables (OHyg art. 6 al. 2 let. e).

### Points d'eau

- Au moins un lave-mains dans chaque pièce où des denrées sont manipulées ou servies, ainsi
  qu'aux toilettes (OHyg art. 9, précision cantonale reprise à l'identique dans la checklist
  CAMAC).
- Le point d'eau de lavage des denrées (fruits, légumes) est **distinct** de la plonge à
  ustensiles et du lave-mains ; une double plonge compte pour un seul point d'eau (OHyg art. 8,
  précision cantonale). Ce dispositif est également obligatoire si l'eau de la plonge à
  ustensiles est elle-même destinée à entrer en contact avec des denrées (ex. refroidissement de
  pâtes/riz, fabrication de pâte de boulangerie).
- Conséquence directe : sans dispositif dédié au lavage des denrées, l'utilisation de fruits
  et légumes bruts non préparés n'est pas autorisée (OHyg art. 8).
- Eau chaude et froide à tous les postes, raccordement à l'eau potable ; la glace et la vapeur
  au contact des denrées proviennent d'eau potable ; l'eau non potable circule dans un circuit
  séparé et identifié (OHyg art. 16). **[R]**

### Sanitaires, personnel, déchets

- Toilettes ventilées, ne donnant jamais directement sur un local alimentaire — y compris
  stockage et transit — avec au minimum un sas (OHyg 9, OLT 3 art. 32). **[R]**
- Vestiaires séparés des zones de stockage et de manipulation (OHyg 20, OLT 3 art. 30). **[R]**
- Déchets : retirés au plus vite des locaux de production ; récipients fermés à ouverture
  hygiénique (pédale ou automatique) ; local à déchets propre, exempt de nuisibles, refroidi
  si nécessaire (OHyg 15). **[R]**

### Animaux

- Interdits dans les locaux alimentaires, même détenus ou accompagnés (OHyg 14). Exceptions :
  chiens-guides ; chiens en salle à manger si le responsable l'autorise ; animaux en aquarium
  ou terrarium en salle sans risque de contamination. **[R]**

### Équipements et présentation

- Équipements au contact des denrées : nettoyables, désinfectables, entretenus, munis de
  dispositifs de contrôle si nécessaire — thermomètres, sondes (OHyg 13, calibration §25). **[R]**
- Denrées présentées à la vente sans protection : pare-haleine, cloche ou équivalent. **[R]**

### Transport (OHyg art. 12)

Section restée trop courte jusqu'ici (une seule ligne au §7) au regard du détail réel de
l'article — sept alinéas, repris ici intégralement **[R]** :

- Conteneurs propres, en bon état, conçus pour être nettoyés/désinfectés convenablement.
- Usage **exclusivement réservé** au transport de denrées si un risque de contamination existe
  par d'autres marchandises transportées.
- Si un même conteneur sert à des denrées et d'autres marchandises (ou des denrées différentes) :
  séparation stricte si nécessaire, et nettoyage soigné entre deux chargements.
- Vrac liquide, granulaire ou poudreux : conteneurs réservés, avec mention visible et indélébile
  (dans une langue officielle de la Confédération) indiquant l'usage exclusif alimentaire.
- Chargement disposé et protégé pour réduire au maximum le risque de contamination.
- Température contrôlée : conteneur conçu pour maintenir la température adaptée **et** permettre
  un contrôle de la température de transport — les deux exigences sont cumulatives, pas
  alternatives.

### Installations mobiles, fabrication à domicile et distributeurs automatiques (OHyg art. 11)

- Installations mobiles (étals, tentes-marquises, véhicules-magasins), locaux à usage principal
  d'habitation où des denrées sont régulièrement préparées pour la mise sur le marché, et
  **distributeurs automatiques** : mêmes exigences de fond — installations pour l'hygiène
  personnelle (lavage/séchage des mains, sanitaires, vestiaires si applicable), surfaces au
  contact des denrées lisses/résistantes/non toxiques, dispositifs de nettoyage/désinfection,
  alimentation en eau potable suffisante, équipements de maîtrise et surveillance de la
  température, protection contre la contamination. **[R]**
- Distributeurs automatiques **[M]** : absents jusqu'ici de ce document alors qu'ils sont cités
  nommément par l'article — pertinents pour toute maison qui exploiterait ce canal (vente de
  plats préparés, boissons) ; mêmes exigences de température et de traçabilité que le reste du
  modèle (§3, §6), la surveillance étant simplement automatisée plutôt que manuelle.
- Fabrication à domicile (pratique VD) : tolérance de trois mois après l'annonce d'activité ;
  ensuite, locaux professionnels ou mise en conformité avec procédures strictes séparant
  domaines privé et public. **[R]**
- Animaux de compagnie présents au domicile → manipulation de denrées interdite (renvoi explicite
  de l'art. 11 vers l'art. 14 sur la présence d'animaux). **[R]**
- Food trucks et remorques : eau chaude et froide exigées ; deuxième plonge dédiée aux denrées
  si préparation sur place, séparée distinctement de la plonge à ustensiles (même règle qu'au
  point d'eau fixe : une double plonge compte pour un seul point d'eau). **[R]**

### Checklist plans — mise à l'enquête (CAMAC, VD)

Éléments devant figurer sur les plans, sous peine de préavis négatif **[R]** :

- lave-mains dans chaque zone de manipulation ;
- dispositif(s) de lavage des ustensiles ;
- point(s) d'eau de lavage des denrées, distincts (obligatoire pour licences café-restaurant
  et tea-room ; sinon évalué selon l'activité décrite) ;
- hotte(s) de ventilation le cas échéant ;
- économat(s) éventuel(s) ;
- vestiaires et toilettes du personnel, avec lave-mains ;
- gestion des déchets (local séparé des denrées ou container à l'extérieur de l'immeuble).

Rappels associés : tous les postes d'eau en eau chaude et froide (mélangeur souhaité),
raccordés à l'eau potable ; évacuation sans risque de contamination ; toilettes ventilées avec
sas ; pas de séparateur à graisses en zone alimentaire. La directive du 01.07.2018 s'applique
de manière générale. **[R]**

## 22. Nettoyage et désinfection

- **Nettoyer n'est pas désinfecter** : le nettoyage enlève les souillures, la désinfection
  réduit les micro-organismes — et elle n'est efficace que sur une surface propre. Deux
  opérations successives, dans cet ordre. **[BP]**
- Plan écrit **[BP]** : quoi (surface, équipement), quand (fréquence), comment (produit,
  dosage, temps de contact, rinçage éventuel), qui, contrôle (visuel ; tests ATP en pro).
- Produits **[R][BP]** : stockés hors zone alimentaire (§15), dosages et temps de contact
  respectés, fiches techniques à disposition ; jamais de transfert dans des bouteilles
  alimentaires.
- Vaisselle **[E][BP]** : machine à cycle thermique (lavage ~55–60 °C, rinçage ~80–85 °C) ou
  manuel à l'eau chaude avec produit ; séchage à l'air, jamais au linge réutilisé à l'excès.
- Application **[M]** : le plan est une liste à cocher horodatée avec fréquences — module pro
  (décision 7, §30) ; les retards apparaissent, rien ne disparaît.

### Plan de nettoyage type

Exemple **[E]** de plan écrit pour une cuisine de production courante — point de départ à
adapter aux surfaces et équipements réels de la maison, dans l'esprit du §11 (tables génériques
à remplacer par l'expérience propre à l'établissement) :

| Surface / équipement | Fréquence | Produit / méthode | Qui | Contrôle |
| --- | --- | --- | --- | --- |
| Plans de travail | après chaque usage, et entre cru et prêt (§15) | détergent-désinfectant, support à usage unique ou linge dédié désinfecté | cuisinier de poste | visuel |
| Planches à découper | après chaque usage, séparées cru/prêt (§15) | lavage puis désinfection, ou lave-vaisselle | cuisinier de poste | visuel |
| Couteaux et ustensiles | après chaque usage, surtout après la volaille (§13) | lavage, désinfection si changement cru/cuit | cuisinier de poste | visuel |
| Sol cuisine | quotidien, fin de service | détergent sol, autolaveuse ou serpillère dédiée | équipe de fermeture | visuel |
| Frigos, intérieur | hebdomadaire | détergent-désinfectant alimentaire | responsable de zone | visuel + relevé de température (§25) |
| Congélateurs, intérieur | mensuel ou lors du dégivrage | détergent-désinfectant alimentaire | responsable de zone | visuel |
| Hotte et filtres | filtres mensuels, conduits par un prestataire annuel | dégraissant | équipe / prestataire externe | visuel — accumulation de graisse = risque incendie |
| Sondes de température | après chaque usage | lingette désinfectante | cuisinier de poste | visuel, cf. calibration §25 |
| Lave-mains | quotidien | détergent-désinfectant | équipe de fermeture | visuel |
| Local à déchets | extérieur quotidien, bac intérieur hebdomadaire | détergent-désinfectant | équipe de fermeture | visuel, odeurs |
| Vestiaires et sanitaires du personnel | quotidien | détergent-désinfectant sanitaire | équipe de fermeture | visuel |
| Machine à laver la vaisselle | détartrage/nettoyage interne hebdomadaire | produit détartrant dédié | responsable de zone | visuel + vérification du cycle thermique |

## 23. Personnel, mains et nuisibles

### Hygiène des mains et du personnel

- Lavage des mains : eau tiède + savon, ~30 secondes, séchage à usage unique. Moments clés
  **[BP]** : entrée en poste, après le cru, après les toilettes, après les déchets, après le
  téléphone ou la caisse, après s'être touché le visage.
- **[R][BP]** : pas de bijoux ni montre, ongles courts sans vernis, plaies couvertes d'un
  pansement détectable, tenue de travail propre (OHyg 20), cheveux retenus.
- Maladie **[BP]** : vomissements, diarrhée, infection cutanée → pas de manipulation de
  denrées ; retour après 48 h sans symptômes **[E]**.
- La personne responsable sensibilise et documente la formation du personnel (OHyg 20). **[R]**

### Lutte contre les nuisibles

- Prévention **[R][BP]** : locaux exempts de nuisibles (OHyg 6 let. g) — moustiquaires (§21),
  bacs fermés, stockage surélevé et décollé des murs, denrées sèches en contenants
  hermétiques (mites, §8).
- Détection **[BP]** : plan d'implantation des pièges (indices de capture pour insectes,
  appâts sécurisés pour rongeurs), contrôles périodiques consignés.
- Intervention **[BP]** : entreprise spécialisée, produits jamais en zone alimentaire sans
  protection, registre des interventions ; toute trace (déjections, dégâts d'emballage) =
  événement du journal avec action corrective.

## 24. Allergènes et contaminations croisées

Les 14 allergènes à déclaration obligatoire en Suisse (OIDA) **[R]** : céréales contenant du
gluten, crustacés, œufs, poissons, arachides, soja, lait (lactose inclus), fruits à coque,
céleri, moutarde, sésame, sulfites, lupin, mollusques. S'y ajoute l'obligation d'information
pour les insectes (ex. poudre de grillons domestiques).

Modèle **[M]** : tags allergènes sur le produit ; lors d'une transformation, le lot produit
hérite de l'**union** des allergènes des lots sources ; distinguer « contient » de « traces
de ». Pratique **[BP]** : contenants fermés dédiés, nettoyage validé entre préparations,
information du client écrite ou orale traçable — l'équipe doit pouvoir répondre sans
improviser. La marche en avant (§21) est la première barrière contre les contaminations
croisées. **[R]**

## 25. HACCP et autocontrôle

- Tout établissement suisse applique l'autocontrôle fondé sur HACCP ; le BPHR GastroSuisse,
  validé par l'OSAV, sert de référentiel d'exécution ; en Vaud, l'OFCO est l'autorité
  d'exécution. **[R]**
- Dangers à raisonner en trois familles **[BP]** : biologiques (salmonelles, listeria, EHEC,
  norovirus, *Bacillus cereus* sur riz et féculents cuits, *Clostridium botulinum* sur
  conserves mal traitées — §9), chimiques (produits d'entretien, allergènes), physiques
  (verre — d'où les protège-néons, §21 —, agrafes, fragments).
- Prérequis (PRP) **[R][BP]** : hygiène du personnel (§23) ; plan de nettoyage-désinfection
  (§22) ; lutte contre les nuisibles (§23) ; maintenance du froid ; formation documentée.
- Points critiques typiques en cuisine **[BP]** : réception, stockage froid, cuisson à cœur,
  refroidissement, maintien au chaud, remise en température.
- Relevés **[R][BP]** : températures des enceintes froides 1–2×/jour — les enceintes doivent
  permettre vérification et enregistrement (OHyg 6 let. d) —, contrôles à réception,
  températures à cœur, refroidissements ; horodatés, signés, archivés (durée selon prescription
  cantonale).
- **Calibration** **[BP]** : une sonde fausse invalide tous les relevés — vérification mensuelle
  par glace fondante (0 °C, tolérance ±0,5–1 °C **[E]**), résultat consigné ; un instrument
  hors tolérance est remplacé ou réétalonné, et les relevés de la période sont marqués
  « incertains ».

### Exemple de calendrier de calibration

Exemple **[E]** pour un parc d'instruments courant, même logique que le calendrier d'inventaire
du §18 — chaque instrument passe une fois par mois, peu importe le jour exact tant que le cycle
complet est tenu :

| Instrument | Fréquence | Méthode | Exemple de résultat | Action si hors tolérance |
| --- | --- | --- | --- | --- |
| Sonde de cuisine n° 1 | mensuelle | glace fondante (0 °C, ±0,5–1 °C) | −0,3 °C → conforme | — |
| Sonde de cuisine n° 2 | mensuelle | glace fondante | +1,8 °C → hors tolérance | réétalonnage ou remplacement ; relevés de la période marqués « incertains » |
| Sonde à cœur (four, sous-vide) | mensuelle | glace fondante | +0,1 °C → conforme | — |
| Thermomètre frigo (par enceinte) | mensuelle | glace fondante ou sonde étalon | — | idem |
| Thermomètre congélateur | mensuelle | glace fondante, tolérance élargie côté négatif | — | idem |

### Ordre du jour type — revue mensuelle de direction

Exemple **[BP]** d'agenda pour que la revue mensuelle (§25) ne reste pas une intention sans
forme concrète :

1. Motifs de rebut du mois (§20) — motif dominant, action corrective décidée.
2. Écarts d'inventaire (§18) — produits concernés, mode de quantité à revoir le cas échéant.
3. Incidents de chaîne du froid (§7) — pannes, ruptures, décisions prises.
4. Résultats de calibration (ci-dessus) — instruments hors tolérance, périodes marquées
   incertaines.
5. Retards du plan de nettoyage (§22) — zones concernées.
6. Réclamations et échantillons témoins du mois (§26).
7. Actions décidées, responsables assignés, échéance de suivi.

C'est cet ordre du jour, tenu chaque mois, qui transforme le registre en boucle d'amélioration
plutôt qu'en simple archive.
- Ce que l'application couvre **[M]** : relevés horodatés avec seuils et alertes, plan de
  nettoyage à cocher, registre de traçabilité, registre des rebuts, registre de calibration.
  L'application documente ; la conformité reste la responsabilité de l'exploitant.

## 26. Réclamations, TIAC, échantillons témoins et autorités

- **Réclamation client** (corps étranger, suspicion d'intoxication) **[BP]** : enregistrer
  (quoi, quand, qui, plat, lot concerné), conserver les preuves, isoler les lots suspects,
  décider et consigner. Une réclamation est un événement du journal, lié aux lots.
- **Suspicion de toxi-infection alimentaire collective (TIAC)** **[R]** : informer sans délai
  l'autorité cantonale compétente (en Vaud : OFCO / médecin cantonal) ; geler le service
  concerné ; l'OSAV fournit les outils d'enquête (manuels ALEK). Le botulisme alimentaire est
  à déclaration obligatoire (médecin → médecin cantonal).
- **Échantillons témoins** (restauration collective ; concept prévu par le BPHR) **[R][E]** :
  ≥ 100 g par plat, représentatifs de tout ce qui est servi, récipient fermé et daté (date +
  heure du repas), conservation 72–100 h à 0–3 °C — ou à −18 °C pour les produits très
  fragiles (haché, crèmes) ; sauces conservées à part. En cas de TIAC, ils sont la pièce
  centrale de l'enquête.
- L'application **[M]** : registre des réclamations, registre des échantillons (plat, date,
  emplacement frigo, destruction consignée après délai), contact de l'autorité cantonale
  enregistré dans les réglages.

Exemple de fiche de contact **[R]**, pour l'autorité cantonale vaudoise — à remplacer par
l'équivalent du canton d'exploitation réel :

| Champ | Valeur |
| --- | --- |
| Autorité | Office de la consommation (OFCO), Service de la promotion de l'économie et de l'innovation (SPEI) |
| Adresse | Chemin des Boveresses 155, Case postale 48, 1066 Epalinges |
| Téléphone | +41 21 316 43 43 |
| Courriel | info.conso@vd.ch |
| Horaires réception téléphonique | Lu/Me 08h30–11h30 ; Ma/Je 08h30–11h30 et 14h00–16h30 ; Ve 08h30–11h30 et 14h00–16h00 |
| Accueil physique | sur rendez-vous uniquement |

Coordonnées vérifiées directement sur la page officielle « Exigences pour les locaux »,
canton de Vaud (§31) — à recontrôler périodiquement, une adresse ou un numéro publié en ligne
n'est jamais garanti stable indéfiniment.

## 27. Traçabilité et retrait/rappel

- Amont **[R]** : fournisseur, date de réception, n° de lot « L », date imprimée — saisis à la
  réception. Aval (pro) : production → service/distribution. Interne : la filiation relie lots
  sources → lot produit (y compris les lots dérivés de parage, §4).
- Procédure de retrait/rappel **[R][BP]** : identifier les lots concernés (requête par n° de
  lot ou fournisseur) → isoler et étiqueter « NE PAS UTILISER » → décider (rebut motif
  « rappel ») → **informer l'autorité cantonale si les denrées déjà livrées ou servies
  présentent un danger pour la santé** → documenter. Objectif de performance : retrouver tous
  les plats contenant un lot en quelques minutes, pas en heures.
- Côté domestique, marque + date imprimée + date d'achat suffisent à réagir à un rappel public.

---

# PARTIE G — CAS PRATIQUES

## 28. Cas pratiques de bout en bout

Chaque cas montre : événements → état → limite ou résultat affiché → leçon.

### Conservation et stock

1. **Haché congelé puis cuisiné.** Achat 03.09, DLC 05.09 (stricte). Congélation 04.09 → ancre
   04.09, limite congélo ≈ 04.09 + 90 j. Décongélation 20.09 à 18 h au frigo → limite 21.09
   18 h (24 h, cru). Cuisson 21.09 en sauce → nouveau lot « sauce », ancre = production 21.09,
   durée plat cuisiné ; cette sauce peut être congelée. Leçon : trois ancres successives, la
   transformation réinitialise proprement.
2. **Lait UHT ouvert.** DDM 20.12 (qualitative), ouvert le 10.09 → min(20.12, 10.09 + 3 j) =
   **13.09**. Leçon : l'ouverture prime sur une DDM lointaine ; si c'était une DLC stricte plus
   courte, c'est elle qui primerait.
3. **Restes et portions.** Rebut récurrent de restes de lasagnes (motif « restes ») → le
   reporting mensuel montre le motif dominant → réduire la taille du plat ou congeler en
   portions individuelles à la production. Leçon : le motif pilote l'action corrective.
4. **Panne de congélateur.** Coupure 14 h, congélateur à moitié plein, couvercle fermé → dans
   le repère 24 h ; tri : produits encore glacés durs conservés, produits ramollis et
   dégelés en surface → rebut motif « incident » ou cuisson immédiate. Leçon : l'incident est
   un événement documenté, pas une panique.
5. **Boîte bombée.** Conserve bombée découverte à l'inventaire tournant → rebut sanitaire
   immédiat, sans calcul de date, motif « abîmé ». Leçon : certains signes court-circuitent
   toute logique de durée.
6. **Écart sur fromage râpé.** Stock théorique 800 g, observé 450 g → ajustement, motif
   « prélèvements non saisis » ; troisième écart du mois → passer le produit en mode
   « portions » plutôt qu'en poids. Leçon : l'écart est une information sur la saisie, pas une
   faute à effacer.
7. **Liste de courses.** Manque 1,5 L de lait → « 2 briques de 1 L » ; l'utilisateur retire le
   chocolat proposé → refus mémorisé ; liste copiée en texte brut et envoyée au conjoint.
   Leçon : le calcul propose, l'humain dispose, l'application laisse sortir les données.
8. **Rappel fournisseur.** Alerte rappel sur un lot de volaille « L 2451 » → requête par n° de
   lot : un lot au congélateur (isolé, « NE PAS UTILISER ») et deux plats cuisinés filiés
   (rebuts motif « rappel ») → documenté en dix minutes. Leçon : la traçabilité se teste sur
   la vitesse de réponse.
9. **Contrôle cantonal.** L'inspecteur OFCO demande : relevés de température des enceintes
   froides, plan de nettoyage, traçabilité de la volaille servie à midi. Le journal d'événements
   produit les trois en quelques minutes, horodatés. Leçon : l'autocontrôle se prouve par des
   documents, pas par la mémoire — c'est la fonction première du registre.
10. **Légumes bruts sans point d'eau dédié.** Un tea-room veut proposer des salades composées
    de crudités brutes, mais n'a qu'une double plonge (= un seul point d'eau). Sans dispositif
    de lavage des denrées distinct, l'utilisation de fruits et légumes bruts non préparés n'est
    pas autorisée : soit installer le point d'eau, soit acheter des crudités prêtes à l'emploi
    (lavées, en lot traçable). Leçon : l'aménagement conditionne la carte, pas l'inverse.

### Production culinaire

11. **Banquet, filet de bœuf poêlé 180 g cuit, 120 couverts.** Net 21,6 kg ; ÷ 0,96 tranchage
    = 22,5 kg ; ÷ 0,75 cuisson = 30,0 kg parés ; ÷ 0,80 parage = **37,5 kg bruts**. À
    65 CHF/kg brut : coût matière 20,3 CHF/portion — le filet pardonne peu : d'où l'intérêt
    des Special Cuts en rôti GT pour un banquet.
12. **Bar entier 4 kg.** Rendement filets 45 % = 1,8 kg → 11 portions de 160 g ; tête et arêtes
    → fumet pour la sauce. Le poisson entier n'est cher que si on jette les parures.
13. **Poulet : entier vs filets.** Entier 1,4 kg à 9,50 CHF/kg = 13,30 CHF → 2 filets (~320 g),
    2 cuisses (~500 g), carcasse → fond. En filets du commerce à 25 CHF/kg, les mêmes 320 g
    coûtent 8 CHF sans cuisses ni fond. Le détaillage paie s'il est rapide et le fond utilisé.
14. **Épaule d'agneau.** La griller serait une erreur de lecture (collagène) : braisée 3 h,
    perte 35 %, mais brut à ~14 CHF/kg → portion à ~4,5 CHF de matière. Découpe et méthode ne
    se choisissent jamais séparément.
15. **GT vs rôti classique.** Rôti de 3 kg : perte 12 % en basse température contre 28 % au four
    traditionnel = **480 g gagnés par pièce**. Sur 200 rôtis/an à 20 CHF/kg net : ~1 900 CHF —
    l'argument chiffré d'un four mixte ou d'un thermocirculateur.
16. **Riz : la perte négative.** 500 g de riz sec → ~1,4 kg cuit. Le multiplicateur < 1 se
    traite exactement comme une perte, en sens inverse : le modèle note « absorption » et ne
    bloque jamais un rendement > 100 %.

### Hygiène et conformité

17. **Bocal maison douteux.** Bocal de haricots verts maison au stock, couvercle légèrement
    bombé. Produit peu acide traité au bain-marie 100 °C — la spore de *C. botulinum* y survit.
    Décision : rebut **sans ouvrir ni goûter** (toxine indétectable aux sens), motif « abîmé ».
    Règle consignée : bocaux acceptés uniquement si acides (pH < 4,6 mesuré) ou autoclavés.
    Leçon : certaines erreurs ne se rattrapent pas, elles se préviennent à la fabrication.
18. **Suspicion de TIAC.** Deux familles signalent des symptômes après le banquet de samedi.
    Réclamations enregistrées et liées aux lots ; échantillons témoins du banquet (conservés
    72–100 h) isolés pour analyse ; autorité cantonale informée sans délai ; production du jour
    vérifiée par le journal (températures à cœur, refroidissements). Leçon : registre +
    échantillons témoins = capacité de réponse en heures, et la preuve de bonne foi de
    l'établissement.

---

# PARTIE H — GOUVERNANCE

## 29. Garde-fous et responsabilité

- L'application calcule des limites ; elle ne déclare jamais un produit « bon ». Aspect, odeur,
  texture et bon sens priment ; en cas de doute, on jette — et certains produits ne se goûtent
  jamais pour les tester (§9). **[M][BP]**
- Les durées du §8, les pertes du §11 et les paramètres marqués [E] sont des échelles
  prudentes, pas des références normatives ; les règles marquées [R] doivent être vérifiées
  dans l'état actuel des ordonnances et auprès de l'autorité cantonale d'exécution — pour Vaud,
  l'OFCO (directive du 01.07.2018, à confirmer dans sa version en vigueur).
- La conformité réglementaire (autocontrôle, relevés, formation, aménagement, déclarations)
  reste la responsabilité de l'exploitant ; l'outil documente et alerte, il ne certifie pas.

## 30. Décisions — statut et recommandations

| # | Question | Statut | Recommandation |
| --- | --- | --- | --- |
| 1 | DLC/DDM explicites ? | tranché | oui, nature stricte/qualité dans le modèle, vocabulaire simple en interface |
| 2 | Allergènes et régimes ? | tranché | tags des 14 allergènes dès le modèle, héritage par union ; pas de gestion des régimes |
| 3 | Durées adossées à des sources ? | tranché | oui, échelles marquées [E] + section sources ; vérification cantonale |
| 4 | Repas et menus ? | reporté | la filiation lot → plat et la fiche technique préparent le terrain ; phase 2 |
| 5 | Multi-lieux (maison, chalet, cave) ? | tranché | niveau d'emplacement supplémentaire, pas un nouveau modèle |
| 6 | Codes-barres ? | reporté | phase 2 : base locale minimale + saisie assistée ; pro : catalogue fournisseur |
| 7 | Relevés HACCP intégrés ? | tranché | module pro sur le même journal : relevés, nettoyage, calibration, réclamations |
| 8 | Pro vs domestique ? | tranché | un seul modèle, deux présentations ; le domestique est le sous-ensemble |
| 9 | Aménagement dans l'app ? | tranché | plan d'emplacements reflétant la marche en avant ; checklist locaux en module pro |
| 10 | Table des pertes : générique ou mesurée ? | tranché | départ sur échelles [E] type Pauli ; remplacées par les mesures maison via l'événement « parage » |
| 11 | Méthodes modernes (sous-vide, GT, four mixte) ? | tranché | intégrées au canon des 15 ; sécurité = couple temps × température documenté |
| 12 | Conservations artisanales ? | tranché | oui, avec méthode (acide \| autoclave) + pH mesuré obligatoires ; sinon lot « non conforme » |
| 13 | Échantillons témoins ? | tranché (pro / collectivités) | registre dédié : ≥ 100 g, 72–100 h à 0–3 °C, destruction consignée |
| 14 | Sauvegarde des données ? | tranché | export local régulier (JSON/texte) ; le registre est la preuve, sa perte est inacceptable |

---

# PARTIE I — SOURCES ET RÉFÉRENCES

## 31. Sources et statut de fiabilité

Ce paragraphe comble un renvoi resté sans section depuis la v4 (introduction, marquage [R]).
Il liste la nature des sources derrière chaque marquage, pas une bibliographie juridique
exhaustive — pour toute exploitation réelle, les textes doivent être revérifiés dans leur
version en vigueur auprès de l'autorité cantonale d'exécution (§29).

### Sources des règles [R]

- **Droit fédéral suisse** : LPA (RS 817.0), ODAlOUs (RS 817.02), OHyg (RS 817.024.1),
  OIDA/OIDAl (RS 817.022.16), LEpI. Textes consultables sur le recueil systématique de la
  Confédération (Fedlex) — à revérifier dans leur version en vigueur, ces ordonnances étant
  révisées périodiquement.
- **Exécution cantonale** : pour Vaud, directive OFCO / chimiste cantonal du 01.07.2018.
  Chaque canton d'exploitation publie son propre instrument d'exécution ; l'autorité cantonale
  fait foi sur son territoire et doit être consultée pour toute mise à jour.
- **Vérification directe (v5.5)** : la directive OFCO du 01.07.2018 (5 pages, signée par le
  chimiste cantonal à Epalinges) et la page officielle « Exigences pour les locaux » du canton
  de Vaud (checklist CAMAC) ont été relues intégralement et comparées phrase par phrase au §21
  de ce document. Résultat : aucune erreur factuelle trouvée sur les points déjà couverts
  (points d'eau, séparateur à graisses, bois brut, moustiquaires, animaux, déchets, vestiaires,
  toilettes, food trucks, tolérance domicile) ; deux lacunes identifiées et comblées — les
  distributeurs automatiques (OHyg art. 11, jamais mentionnés) et le détail complet du transport
  (OHyg art. 12, réduit à une ligne). Les citations d'articles ont été précisées à cette
  occasion (alinéas exacts au lieu d'un [R] générique). Cette vérification ne couvre que le
  §21 et les renvois qui en dépendent — elle ne dispense pas de revérifier le reste des [R] dans
  leur version en vigueur.
- **Guide de branche validé par l'OSAV** : BPHR GastroSuisse — référentiel d'exécution de
  l'autocontrôle HACCP en restauration suisse, source des repères de température (§6), des
  seuils de sécurité à cœur (§14) et des échantillons témoins (§26).
- **Code des usages et brochures professionnelles** : UPSV, « La dénomination des morceaux de
  viande » (découpe, §13) ; Proviande Suisse, publications « Special Cuts » et « Nose to tail »
  (§13).

### Sources des estimations [E]

- **Durées de conservation (§8)** : synthèse d'ordres de grandeur issus des repères
  USDA/FDA (FoodKeeper) pour la logique générale de conservation, croisés avec l'usage
  professionnel et des mémos cantonaux — volontairement prudents, à affiner par la maison.
- **Tables de pertes de production (§11)** : structure et valeurs de départ de type Pauli
  (référentiel de formation hôtelière francophone historique) et guides de coupe
  professionnels (Proviande Suisse pour les viandes ; guides de filetage et d'écaillage pour
  la marée) ; les fourchettes larges reflètent la variabilité réelle (calibre, saison,
  fournisseur, savoir-faire) plutôt qu'une fausse précision. **Aucune de ces valeurs n'a été
  mesurée sur les produits réels d'un établissement donné** : elles sont un point de départ
  explicitement conçu pour être remplacé, ligne par ligne, par les pesées enregistrées via
  l'événement « parage » (§4, §10) — c'est ce mécanisme, et non la table, qui fait de la base
  une mémoire d'expérience au fil du temps.
- **Fiabilité décroissante à connaître** : les repères de température et de sécurité
  sanitaire (§6, §9, §14) s'appuient sur des seuils de branche larges et concordants — fiabilité
  la plus haute parmi les [E]. Les tables de pertes (§11) et les durées de conservation (§8)
  varient nettement d'un fournisseur, d'un calibre ou d'un climat à l'autre — fiabilité
  moyenne, à corriger en priorité par la mesure maison.

### Ce que cette base ne remplace pas

- Une vérification juridique des textes cités dans leur version en vigueur à la date
  d'exploitation.
- Un avis de l'autorité cantonale compétente pour toute question d'aménagement, de plan
  d'enquête ou de conformité HACCP spécifique à un établissement.
- Le jugement professionnel sur le terrain (§1) : cette base documente et structure, elle ne
  décide jamais à la place de l'exploitant.

---

# PARTIE J — CATALOGUE ET OUTILLAGE OPÉRATIONNEL

## 32. Catalogue produits — base alimentaire instanciée

Le §8 donne des durées par **famille** (« viande hachée », « volaille »...) ; le §11 donne des
rendements par **catégorie de produit**. Ce paragraphe instancie enfin l'objet `produit` du §3
avec des produits réels, nommés, prêts à devenir des lignes de la base de l'application : c'est
la différence entre un référentiel qu'on lit et un catalogue qu'on interroge. Valeurs **[E]**,
mêmes réserves qu'au §8/§11/§31 : ce sont des points de départ crédibles, à écraser dès que la
maison dispose d'un fournisseur et d'une mesure propres (limite maison, §5).

Colonnes : nature de la date (DLC stricte / DDM qualitative, §2) ; durée frigo fermé ; durée
après ouverture ; durée congélo (qualité, §7) ; durée après décongélation (§7, en heures) ;
allergènes portés parmi les 14 du §24 ; **perte de parage**, corrélée précisément à la ligne du
§11.1 dont elle est tirée (nom de catégorie entre parenthèses), et non plus une simple catégorie
générique comme dans la version précédente.

Règle de corrélation **[M]** : la perte de parage n'est pas une propriété fixe du produit, elle
dépend de sa **forme d'achat**. Un poulet entier ne perd rien tant qu'il est rôti tel quel ; il
perd 30–35 % s'il est détaillé en cuisine (§11.1). Un filet de cabillaud déjà levé par le
poissonnier n'a plus la perte « poisson rond → filets » à subir — elle a déjà été payée par le
fournisseur et se reflète dans son prix au kg, pas dans une perte supplémentaire en cuisine. La
colonne distingue donc trois cas : une perte chiffrée et inconditionnelle (pièce brute à parer),
une perte conditionnelle « si transformation maison » (produit vendu entier mais pouvant être
détaillé sur place), et un « — » explicitement motivé (produit déjà transformé, sans étape de
parage possible). La perte de **cuisson**, elle, dépend de la méthode choisie et non du produit
seul : elle reste rattachée à la fiche technique (§34), qui est le bon niveau pour la fixer.

### 32.1 Épicerie, viandes, volailles, poissons, produits laitiers, plats

| Famille (§8) | Produit | Nature | Frigo fermé | Après ouverture | Congélo | Décongelé | Allergènes | Perte de parage (§11.1) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Viande hachée | Bœuf haché | DLC | 1 j | 1 j | 90–120 j | 24 h (cru) | — | — (déjà transformé, aucun parage) |
| Viande hachée | Veau haché | DLC | 1 j | 1 j | 90–120 j | 24 h (cru) | — | — (déjà transformé, aucun parage) |
| Viande hachée | Porc haché / chair à saucisse | DLC | 1 j | 1 j | 90–120 j | 24 h (cru) | — | — (déjà transformé, aucun parage) |
| Viande hachée | Agneau haché | DLC | 1 j | 1 j | 90–120 j | 24 h (cru) | — | — (déjà transformé, aucun parage) |
| Viande hachée | Haché mixte bœuf-porc | DLC | 1 j | 1 j | 90–120 j | 24 h (cru) | — | — (déjà transformé, aucun parage) |
| Viande hachée | Steak tartare préparé | DLC | même jour | — | `noFreeze` | — | Œufs (si liaison) | — (déjà transformé, aucun parage) |
| Volaille | Poulet entier | DLC | 2 j | 1 j | 300–365 j | 24 h (cru) | — | 30–35 % si détaillage maison (Volaille \| Poulet entier → 8 pièces) ; 0 % si rôti entier |
| Volaille | Cuisses de poulet | DLC | 1–2 j | 1 j | 240–270 j | 24 h (cru) | — | — (déjà découpées à l'achat, résiduel non tabulé) |
| Volaille | Filets/blancs de poulet | DLC | 1–2 j | 1 j | 240–270 j | 24 h (cru) | — | — (déjà parés à l'achat) |
| Volaille | Escalopes de dinde | DLC | 1–2 j | 1 j | 270–300 j | 24 h (cru) | — | — (déjà parées à l'achat) |
| Volaille | Magret de canard | DLC | 2–3 j | 1–2 j | 180–240 j | 24 h (cru) | — | — (déjà paré ; dégraissage résiduel non tabulé) |
| Volaille | Cuisses de canard confites | DDM | 5–7 j (sous graisse) | — | 180 j | — | — | — (produit fini) |
| Volaille | Pintade entière | DLC | 2 j | 1 j | 240–300 j | 24 h (cru) | — | 30–35 % si détaillage maison (Volaille \| Pintade entière → morceaux) ; 0 % si rôtie entière |
| Volaille | Lapin (morceaux) | DLC | 1–2 j | 1 j | 180–240 j | 24 h (cru) | — | — (déjà découpé) ; 20–25 % si désossage d'un lapin entier (Volaille) |
| Bœuf/veau/porc/agneau en pièce | Rôti de bœuf | DLC | 3–5 j | 2 j | 240–365 j | 48 h (cru) | — | 10–20 % (Bœuf \| Pièce à rôtir) |
| Bœuf/veau/porc/agneau en pièce | Entrecôte / faux-filet | DLC | 3–5 j | 2 j | 180–240 j | 48 h (cru) | — | 15–25 % (Bœuf \| Entrecôte / côte) |
| Bœuf/veau/porc/agneau en pièce | Filet de bœuf | DLC | 3–5 j | 2 j | 240–365 j | 48 h (cru) | — | 15–20 % (Bœuf \| Filet) |
| Bœuf/veau/porc/agneau en pièce | Bavette / onglet | DLC | 2–3 j | 1–2 j | 180–240 j | 48 h (cru) | — | 5–10 % (Bœuf \| Bavette, onglet, hampe) |
| Bœuf/veau/porc/agneau en pièce | Rôti de veau | DLC | 3–4 j | 2 j | 240–300 j | 48 h (cru) | — | 10–15 % (Veau \| Noix, sous-noix, quasi) |
| Bœuf/veau/porc/agneau en pièce | Escalopes de veau | DLC | 2–3 j | 1–2 j | 180–240 j | 48 h (cru) | — | — (déjà parées) ; 10–15 % si taillées maison (Veau) |
| Bœuf/veau/porc/agneau en pièce | Rôti de porc / échine | DLC | 3–4 j | 2 j | 180–270 j | 48 h (cru) | — | 10–15 % (Porc \| Échine) |
| Bœuf/veau/porc/agneau en pièce | Côtes de porc | DLC | 2–3 j | 1–2 j | 180–240 j | 48 h (cru) | — | — (déjà débitées, résiduel non tabulé) |
| Bœuf/veau/porc/agneau en pièce | Filet mignon de porc | DLC | 3–4 j | 2 j | 240–300 j | 48 h (cru) | — | 5–10 % (Porc \| Filet mignon) |
| Bœuf/veau/porc/agneau en pièce | Gigot d'agneau | DLC | 3–5 j | 2 j | 240–365 j | 48 h (cru) | — | 15–20 % (Agneau \| Gigot désossé) |
| Bœuf/veau/porc/agneau en pièce | Côtelettes d'agneau | DLC | 2–3 j | 1–2 j | 180–240 j | 48 h (cru) | — | — (déjà débitées à l'achat) |
| Bœuf/veau/porc/agneau en pièce | Épaule d'agneau | DLC | 3–4 j | 2 j | 240–300 j | 48 h (cru) | — | 15–20 % (Agneau \| Épaule) |
| Poisson maigre | Cabillaud / colin, filet | DLC | 1–2 j | 1 j | 180–240 j | 24 h (cru) | Poissons | — (déjà levé) ; 50–55 % si acheté entier (Poissons \| Cabillaud, colin → filets) |
| Poisson maigre | Sole / limande | DLC | 1–2 j | 1 j | 180–210 j | 24 h (cru) | Poissons | 40–50 % de perte si filetée maison (Poissons \| Poisson plat → filets) |
| Poisson maigre | Merlan | DLC | 1–2 j | 1 j | 180–210 j | 24 h (cru) | Poissons | 50–60 % de perte si fileté maison (Poissons \| Poisson rond → filets) |
| Poisson maigre | Lieu noir / jaune | DLC | 1–2 j | 1 j | 180–240 j | 24 h (cru) | Poissons | 50–60 % de perte si fileté maison (Poissons \| Poisson rond → filets) |
| Poisson maigre | Truite | DLC | 1–2 j | 1 j | 180–210 j | 24 h (cru) | Poissons | 50–60 % de perte si filetée maison (Poissons \| Poisson rond → filets) |
| Poisson maigre | Bar / dorade entier | DLC | 1–2 j | 1 j | 180–240 j | 24 h (cru) | Poissons | 50–60 % de perte si levée en filets (Poissons \| Poisson rond → filets) |
| Poisson gras | Saumon frais | DLC | 1–2 j | 1 j | 60–90 j | 24 h (cru) | Poissons | — (déjà en pavés/filets) ; 45–55 % de perte si acheté entier (Poissons \| Saumon entier → pavés/filets) |
| Poisson gras | Maquereau | DLC | 1 j | 1 j | 60–90 j | 24 h (cru) | Poissons | 50–60 % de perte si fileté maison (Poissons \| Poisson rond → filets) |
| Poisson gras | Thon frais | DLC | 1–2 j | 1 j | 60–90 j | 24 h (cru) | Poissons | 20–30 % (Poissons \| Thon, parage peau/arêtes) |
| Poisson gras | Sardines fraîches | DLC | 1 j | 1 j | 60–90 j | 24 h (cru) | Poissons | 50–60 % de perte si filetées (Poissons \| Poisson rond → filets) ; souvent servies entières |
| Poisson gras | Hareng | DLC | 1–2 j | 1 j | 60–90 j | 24 h (cru) | Poissons | 50–60 % de perte si fileté maison (Poissons \| Poisson rond → filets) |
| Crustacés/coquillages frais | Moules fraîches | DLC | 1–2 j | — | `noFreeze` | — | Mollusques | 75–80 % de perte si décoquillées (Crustacés/coquillages \| Moules décoquillées) ; 0 % si servies en coquille |
| Crustacés/coquillages frais | Crevettes crues fraîches | DLC | 1–2 j | 1 j | 60–90 j | 24 h (cru) | Crustacés | 50–60 % de perte si décortiquées (Crustacés/coquillages \| Crevettes décortiquées) |
| Crustacés/coquillages frais | Huîtres | DLC | 7–10 j (vivantes) | — | `noFreeze` | — | Mollusques | 85–90 % de perte si décoquillées (rare ; Crustacés/coquillages \| Huîtres décoquillées) |
| Crustacés/coquillages frais | Langoustines fraîches | DLC | 1–2 j | 1 j | 60–90 j | 24 h (cru) | Crustacés | 65–70 % de perte si décortiquées (Crustacés/coquillages \| Langoustines décortiquées) |
| Charcuterie tranchée | Jambon cuit tranché | DLC | 2–3 j | 2–3 j | 30–60 j | — | — | — (produit fini, acheté tranché) |
| Charcuterie tranchée | Jambon cru/sec tranché | DLC | 5–7 j | 3–5 j | 60–90 j | — | — | — (produit fini, acheté tranché) |
| Charcuterie tranchée | Saucisson sec | DDM | 15–21 j (entamé) | 10–14 j | 60–90 j | — | — | — (produit fini) |
| Charcuterie tranchée | Salami | DDM | 10–14 j (entamé) | 7–10 j | 60–90 j | — | — | — (produit fini) |
| Charcuterie tranchée | Lard fumé / pancetta | DLC | 5–7 j | 5 j | 90–120 j | — | — | — (produit fini) |
| Charcuterie tranchée | Chorizo | DDM | 10–14 j | 7–10 j | 60–90 j | — | — | — (produit fini) |
| Charcuterie tranchée | Terrines / pâtés | DLC | 3–5 j | 2–3 j | `noFreeze` (texture) | — | — | — (produit fini) |
| Lait / crème | Lait pasteurisé entier/demi-écrémé | DLC | selon étiquette | 3 j | déconseillé | — | Lait | — (non concerné) |
| Lait / crème | Lait UHT | DDM | longue (fermé) | 3 j | déconseillé | — | Lait | — (non concerné) |
| Lait / crème | Crème entière liquide | DLC | selon étiquette | 2 j | 30 j | — | Lait | — (non concerné) |
| Lait / crème | Crème fraîche épaisse | DLC | selon étiquette | 3–5 j | `noFreeze` (texture) | — | Lait | — (non concerné) |
| Lait / crème | Crème fouettée / chantilly maison | DLC | jour même–2 j | — | `noFreeze` | — | Lait | — (non concerné) |
| Fromage | Gruyère AOP, Emmental, Comté | DDM | 21–30 j | 10–14 j | 180 j | — | Lait | — (croûte non comestible retirée à la coupe, non tabulé) |
| Fromage | Parmesan | DDM | 30–45 j | 14–21 j | 180 j | — | Lait | — (croûte non comestible, non tabulé) |
| Fromage | Brie, Camembert | DLC | 10–14 j | 5–7 j | `noFreeze` | — | Lait | — (non concerné) |
| Fromage | Reblochon, vacherin | DLC | 7–10 j | 3–5 j | `noFreeze` | — | Lait | — (non concerné) |
| Fromage | Mozzarella | DLC | 5–7 j | 2–3 j | `noFreeze` (texture) | — | Lait | — (non concerné) |
| Fromage | Ricotta, faisselle | DLC | 5–7 j | 2–3 j | `noFreeze` | — | Lait | — (non concerné) |
| Fromage | Chèvre frais | DLC | 5–7 j | 2–3 j | `noFreeze` | — | Lait | — (non concerné) |
| Fromage | Feta (en saumure) | DLC | 14–21 j | 7–10 j | 60–90 j | — | Lait | — (non concerné) |
| Fromage | Beurre doux / demi-sel | DDM | 30 j | 14 j | 180 j | — | Lait | — (non concerné) |
| Œufs | Œufs en coquille | DLC (28 j post-ponte, CH) | 3–5 sem. | — | `noFreeze` (battus : oui) | — | Œufs | — (coquille non comestible, non tabulé) |
| Œufs | Œufs battus, hors coquille | DLC | — | — | 90–120 j | 24 h (décongelé) | Œufs | — (non concerné) |
| Œufs | Mayonnaise maison | DLC | 24–48 h | — | `noFreeze` | — | Œufs | — (non concerné) |
| Plats cuisinés maison | Plat en sauce (bourguignon, blanquette) | DLC | 3 j | 2 j | 90–120 j | 24 h (cuit) | selon composants | — (perte déjà intégrée à la fiche technique, §34) |
| Plats cuisinés maison | Gratin de légumes | DLC | 3 j | 2 j | 60–90 j | 24 h (cuit) | Lait (fréquent) | — (perte déjà intégrée à la fiche technique, §34) |
| Soupes, sauces | Soupe de légumes maison | DLC | 3–4 j | 2 j | 60–90 j | 24 h (cuit) | selon composants | — (perte déjà intégrée à la recette) |
| Soupes, sauces | Fond / fumet maison | DLC | 3–4 j | — | 90–120 j | 24 h (cuit) | selon composants | — (parures déjà comptées ailleurs, §13) |
| Soupes, sauces | Sauce tomate maison | DLC | 4–5 j | 3 j | 90–120 j | — | — | — (perte déjà intégrée à la recette) |
| Soupes, sauces | Pesto maison | DLC | 5–7 j | — | `noFreeze` (texture) | — | Fruits à coque | — (perte déjà intégrée à la recette) |
| Conserves ouvertes / féculents cuits | Conserve de légumes ouverte | DLC | — | 2–3 j (transvasée) | — | — | — | — (non concerné) |
| Conserves ouvertes / féculents cuits | Conserve de poisson ouverte | DLC | — | 2 j (transvasée) | — | — | Poissons | — (non concerné) |
| Conserves ouvertes / féculents cuits | Riz cuit | DLC | 1 j | 1 j (refroidi vite) | 60 j | — | — | — (gain de cuisson déjà appliqué, voir §11.2) |
| Conserves ouvertes / féculents cuits | Pâtes cuites | DLC | 2–3 j | 2 j | 60 j | — | Gluten | — (gain de cuisson déjà appliqué, voir §11.2) |
| Conserves ouvertes / féculents cuits | Légumineuses cuites maison | DLC | 3–4 j | 2–3 j | 90 j | — | — | — (gain de cuisson déjà appliqué, voir §11.2) |
| Pain | Pain de tradition | DDM | 2–3 j (ambiant) | — | 60–90 j | — | Gluten | — (non concerné) |
| Pain | Pain de mie | DDM | 5–7 j (ambiant) | — | 60–90 j | — | Gluten, Lait | — (non concerné) |
| Pain | Viennoiseries | DLC | 1–2 j (ambiant) | — | 60 j | — | Gluten, Lait, Œufs | — (non concerné) |
| Pain | Pâte feuilletée / brisée crue | DLC | 2–3 j | — | 60–90 j | — | Gluten, Lait | — (non concerné) |
| Huiles, produits secs | Huile d'olive | DDM | 12–18 mois (ambiant, obscurité) | 6 mois | — | — | — | — (non concerné) |
| Huiles, produits secs | Huile de tournesol / colza | DDM | 6–12 mois | 3–6 mois | — | — | — | — (non concerné) |
| Huiles, produits secs | Farine de blé | DDM | 6–12 mois (hermétique) | — | — | — | Gluten | — (non concerné) |
| Huiles, produits secs | Sucre | DDM | quasi illimité (sec) | — | — | — | — | — (non concerné) |
| Huiles, produits secs | Riz sec | DDM | 12–24 mois (ambiant) | — | — | — | — | — (le gain s'applique à la cuisson, §11.2, pas au parage) |
| Huiles, produits secs | Pâtes sèches | DDM | 12–24 mois (ambiant) | — | — | — | Gluten (sauf sans gluten) | — (le gain s'applique à la cuisson, §11.2, pas au parage) |
| Huiles, produits secs | Légumineuses sèches | DDM | 12–24 mois (ambiant) | — | — | — | — | — (le gain s'applique à la cuisson, §11.2, pas au parage) |

### 32.2 Fruits et légumes frais — conservation

Ces produits n'ont en général pas de date imprimée (vente en vrac) : la donnée utile est la
durée pratique de bonne tenue, pas une DLC/DDM. Beaucoup se conservent mieux **hors du frigo**
— le froid dégrade leur texture ou leur goût plutôt que de prolonger leur vie utile. Ici, à la
différence du §32.1, la perte de parage n'est pas conditionnelle : elle correspond directement
à la ligne du §11.1 du même nom (même produit, même perte), la corrélation est donc une jointure
directe plutôt qu'une règle de forme d'achat.

| Produit | Frigo (jours indicatifs) | Hors frigo | Perte de parage (§11.1) | Notes |
| --- | --- | --- | --- | --- |
| Pommes de terre | — | 2–4 sem. (ambiant, sombre, frais) | 15–20 % | le froid transforme l'amidon en sucre |
| Carottes | 2–3 sem. (bac à légumes) | — | 12–15 % | — |
| Panais | 2–3 sem. | — | 20–25 % | — |
| Betteraves crues | 2–3 sem. | — | 20–25 % | — |
| Navets | 1–2 sem. | — | 15–20 % | — |
| Radis noir | 2–3 sem. | — | 20–25 % | — |
| Topinambours | 1–2 sem. | — | 25–30 % | — |
| Patates douces | — | 2–3 sem. (ambiant, comme la pomme de terre) | 15–20 % | — |
| Rutabaga | 2–3 sem. | — | 20–25 % | — |
| Salsifis | ~1 sem. | — | 35–40 % | oxyde vite, cuisiner rapidement |
| Oignons | — | plusieurs mois (ambiant, sec, aéré) | 10–15 % | — |
| Échalotes | — | plusieurs mois (ambiant, sec) | 12–18 % | — |
| Ail | — | plusieurs mois (ambiant, sec) | 10–15 % | — |
| Poireaux | ~1 sem. (bac à légumes) | — | 30–40 % | — |
| Fenouil | ~1 sem. | — | 25–30 % | — |
| Chou blanc / rouge | 2–3 sem. | — | 15–20 % | tient très bien |
| Chou vert frisé (kale) | 3–5 j | — | 20–25 % | flétrit vite |
| Chou de Bruxelles | ~1 sem. | — | 15–20 % | — |
| Chou-fleur | ~1 sem. | — | 30–40 % | — |
| Brocoli | 3–5 j | — | 25–30 % | jaunit vite |
| Chou romanesco | 3–5 j | — | ~30 % | — |
| Pak-choï | 3–5 j | — | 10–15 % | — |
| Épinards | 2–3 j | — | 30–40 % | très fragile |
| Blettes | 3–5 j | — | 20–30 % | — |
| Salade pommée | 5–7 j | — | ~33 % | — |
| Batavia, iceberg | 5–7 j | — | 20–30 % | — |
| Roquette, mâche | 2–3 j | — | 5–10 % | très fragile ; la mâche est un légume d'hiver (§33) |
| Endives | ~1 sem. (à l'abri de la lumière) | — | 10–15 % | noircissent à la lumière |
| Tomates | 3–5 j (dégradation goût/texture) | mieux à température ambiante | 15–20 % | ne jamais réfrigérer avant maturité |
| Concombre | ~1 sem. | — | 15–20 % | — |
| Courgettes | 5–7 j | — | 10–15 % | — |
| Aubergines | 5–7 j | — | 15–20 % | sensibles au froid < 10 °C prolongé |
| Poivrons | 1–2 sem. | — | 20–25 % | — |
| Potiron, courge (entier) | — | plusieurs mois (ambiant, cave) | 30–40 % | coupé : 5–7 j au frigo |
| Maïs en épi | 1–2 j | — | 60–65 % de perte | le sucre se change vite en amidon |
| Petits pois frais (en cosse) | 2–3 j | — | ~50 % | consommer vite, sucre chute vite |
| Haricots verts | 3–5 j | — | 8–12 % | — |
| Fèves fraîches | 2–3 j | — | 60–70 % | — |
| Asperges | 3–5 j (debout dans l'eau, comme un bouquet) | — | 40–50 % | — |
| Artichauts | 5–7 j | — | 60–75 % de perte | — |
| Champignons de Paris | 3–5 j (contenant aéré) | — | 10–20 % | ne pas laver avant stockage |
| Cèpes, girolles | 2–3 j | — | 15–25 % | très périssables |
| Pommes | 3–4 sem. | — | 20–30 % | tiennent très bien au frigo |
| Poires | 5–7 j (à point) | — | 20–30 % | — |
| Agrumes (oranges, citrons) | 2–3 sem. | — | 30–40 % | — |
| Ananas | 3–5 j (mûr) | — | 45–55 % | — |
| Melon, pastèque (entier) | — | ambiant jusqu'à maturité | 40–50 % | coupé : 3–5 j au frigo |
| Mangue | 3–5 j (mûre) | — | 30–35 % | — |
| Avocat | 2–3 j (mûr) | ambiant pour mûrir | 25–30 % | — |
| Banane | — | ambiant | 35–40 % | noircit et se dégrade au frigo |
| Kiwi | 1–2 sem. | — | 15–20 % | — |
| Fraises | 2–3 j | — | 5–10 % | très fragile |
| Raisin | 5–7 j | — | 3–5 % | — |
| Pêches, abricots | 3–5 j (mûrs) | — | 15–20 % | — |
| Cerises | 3–5 j | — | 12–15 % | — |

## 33. Calendrier de saisonnalité — fruits et légumes (Suisse / Europe tempérée)

Repère **[E]** pour les achats, les menus et la négociation prix/qualité — la pleine saison
locale est le moment où le rendement (§11) est le meilleur et le prix le plus bas. Hors saison
locale, le produit reste disponible par import ou culture sous abri, à un coût et une empreinte
différents ; ce n'est pas signalé comme un défaut mais comme une donnée de décision. À affiner
selon le climat réel de l'exploitation (altitude, microclimat) et les accords avec les
producteurs locaux.

| Produit | Pleine saison locale | Disponibilité hors saison | Notes |
| --- | --- | --- | --- |
| Asperges (vertes/blanches) | avril–juin | quasi nulle hors saison (import limité) | produit emblématique de saison courte |
| Petits pois frais | mai–juillet | import | — |
| Fèves fraîches | mai–juillet | import | — |
| Fraises | mai–septembre (pic juin–juillet) | import toute l'année, qualité très inférieure | — |
| Cerises | juin–août | import | — |
| Radis | avril–octobre | serre | — |
| Roquette | avril–octobre | serre | — |
| Haricots verts | juin–septembre | import | — |
| Courgettes | juin–septembre | import/serre | — |
| Concombre | juin–septembre | serre toute l'année | — |
| Abricots | juillet–août | import | — |
| Pêches, nectarines | juillet–septembre | import | — |
| Tomates (pleine terre) | juillet–septembre | serre chauffée hors saison (goût très inférieur) | la tomate de serre hivernale n'est pas un équivalent |
| Aubergines | juillet–septembre | import | — |
| Poivrons | juillet–octobre | import | — |
| Maïs en épi | août–septembre | import limité | — |
| Melon, pastèque | juillet–septembre | import | — |
| Prunes, mirabelles | août–septembre | import | — |
| Figues | août–septembre | import | — |
| Raisin de table | septembre–octobre | import | — |
| Artichauts | deux pics : mai–juillet et septembre–octobre | import | — |
| Champignons sauvages (cèpes, girolles) | juin–novembre (pics été/automne) | import, prix élevé | forte variabilité météo d'une année à l'autre |
| Pommes | septembre–mars (récolte sept.–oct., conservation longue) | import mars–août | — |
| Poires | septembre–février | import | — |
| Potiron, courges | septembre–décembre (conservation jusqu'au printemps) | rare hors stock | bonne tenue en cave |
| Choux (blanc, rouge, vert) | septembre–mars | — | tiennent bien, peu d'import nécessaire |
| Chou-fleur | deux pics : septembre–novembre et mars–avril | serre | — |
| Brocoli | juin–novembre | serre/import | — |
| Chou de Bruxelles | octobre–février | — | — |
| Poireaux | septembre–avril | — | — |
| Épinards | mars–mai et septembre–novembre | serre | évite les fortes chaleurs d'été (montent en graine) |
| Blettes | juin–octobre | — | — |
| Carottes | récolte juillet–novembre | conservation cave/frigo toute l'année | — |
| Panais | octobre–mars | — | — |
| Betteraves | juillet–novembre | conservation hiver | — |
| Navets | deux saisons : printemps et automne–hiver | — | — |
| Céleri-rave | octobre–mars | — | — |
| Céleri branche | juillet–novembre | serre/import | — |
| Fenouil | juillet–novembre | import hiver | — |
| Salades pommées, batavia | mai–octobre | sous abri hors saison | — |
| Mâche | septembre–avril | — | légume d'hiver par excellence |
| Endives | octobre–avril (culture forcée à l'obscurité) | disponible quasi toute l'année en pratique | — |
| Oignons | récolte juillet–septembre | conservation toute l'année | — |
| Ail | récolte juillet | conservation jusqu'au printemps suivant | — |
| Pommes de terre | récolte selon variété (primeurs mai–juillet, conservation août–avril) | import printemps | — |
| Kiwi | novembre–mai (production locale limitée, Tessin notamment) | import (hémisphère sud) hors saison | — |
| Agrumes (oranges, clémentines, citrons) | novembre–mars (import méditerranéen, pleine qualité) | disponibles toute l'année, qualité variable | pas de production locale suisse significative |
| Mangue, ananas, banane, avocat | aucune saison locale | import toute l'année | à traiter comme des produits sans calendrier local dans l'appli |

---

## 34. Fiches techniques types — exemples chiffrés

Instanciations concrètes de l'objet `ficheTechnique` du §3, pour vérifier que le modèle tient
sur des cas réels et servir de gabarit. Prix **[E]** illustratifs (marché suisse indicatif), à
remplacer par les prix fournisseur réels de la maison — seul le mécanisme de calcul (§10, §12)
est à retenir tel quel.

### Poulet fermier rôti, garniture — 10 portions

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Poulet fermier entier | 2 × 1,6 kg | ~320 g brut/portion |
| Pommes de terre grenaille | 1,5 kg | garniture, cuisson au jus |
| Beurre | 80 g | badigeonnage |
| Ail, thym, romarin | pour mémoire | aromates |

Méthode : rôtir au four traditionnel (§14) ; température à cœur cible 75 °C (volaille, §14).
Rendement prévu : perte de cuisson volaille rôtie entière 25–30 % (§11.2) → ≈ 235 g cuit
utile/portion avant désossage table. Allergènes (union) : aucun des composants principaux —
vérifier le beurre (Lait). Coût matière : 2 × 1,6 kg à 9,50 CHF/kg = 30,40 CHF + garniture
≈ 4,50 CHF → **3,49 CHF/portion** matière première, hors garniture affinée.

### Blanquette de veau à l'ancienne — 8 portions

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Épaule de veau | 1,6 kg | 200 g brut/portion, braisé (§11.1 : épaule 15–20 % parage) |
| Carottes, oignon, poireau | 600 g | garniture aromatique |
| Crème entière | 300 g | liaison |
| Farine | 40 g | roux blond |
| Jaune d'œuf | 2 pièces | liaison finale |

Méthode : braisé (§14, milieu combiné) ; cuisson longue à couvert, jamais d'ébullition forte.
Rendement prévu : perte de cuisson braisé/mijoté 30–40 % (§11.2) sur le veau paré. Allergènes
(union) : **Lait** (crème), **Œufs** (jaune de liaison), **Gluten** (roux) — exemple typique où
l'union d'allergènes (§24) dépasse largement le composant principal. Coût matière : 1,6 kg à
32 CHF/kg brut, rendement paré ≈ 85 % puis cuit ≈ 65 % → prix net ≈ 58 CHF/kg cuit →
**≈ 8,70 CHF/portion** matière (veau seul, hors garniture et liaison).

### Cabillaud vapeur, beurre blanc — 6 portions

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Filet de cabillaud | 1,0 kg | 165 g brut/portion (poisson maigre, §32.1) |
| Beurre | 150 g | sauce beurre blanc |
| Vin blanc, échalote, vinaigre | pour mémoire | réduction |

Méthode : cuisson vapeur (§14, milieu liquide/chaleur humide) ; température à cœur cible
55–60 °C (poisson, §14). Rendement prévu : perte de cuisson poché/vapeur 10–15 % (§11.2) —
la plus faible du canon, argument qualité autant qu'économique. Allergènes (union) : **Poissons**
(cabillaud), **Lait** (beurre). Coût matière : 1,0 kg à 24 CHF/kg brut, parage poisson maigre
inclus dans l'achat en filet → **≈ 4,60 CHF/portion** matière (poisson + sauce).

### Gratin dauphinois — 12 portions (garniture)

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Pommes de terre | 2,4 kg | ~200 g brut/portion, parage 15–20 % (§11.1) |
| Crème entière | 800 g | — |
| Lait | 400 g | — |
| Ail, muscade | pour mémoire | — |

Méthode : cuisson au four, air chaud (§14). Rendement prévu : léger gain (absorption crème/lait
par l'amidon) — comme le riz ou les pâtes, ne pas bloquer un rendement > 100 %, le noter
« absorption » (§3). Allergènes (union) : **Lait** (crème et lait). Coût matière : 2,4 kg pommes
de terre à 1,80 CHF/kg + crème/lait ≈ 6,50 CHF → **≈ 0,85 CHF/portion**, un des plats
d'accompagnement les plus économiques du canon.

### Ratatouille traditionnelle — 10 portions (garniture ou plat)

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Courgettes | 1,0 kg | — |
| Aubergines | 1,0 kg | — |
| Poivrons | 0,8 kg | — |
| Tomates | 1,2 kg | pelées à vif |
| Oignon, ail | 0,3 kg | — |

Méthode : étuvé puis mijoté (§14). Rendement prévu : perte ~20–25 % (§11.2, légumes mijotés).
Allergènes (union) : **aucun** — bon exemple de fiche sans allergène des 14, utile pour vérifier
que le modèle n'en invente pas par défaut. Coût matière : ≈ 4,3 kg brut de légumes de saison à
2,50 CHF/kg moyen → **≈ 1,08 CHF/portion**, sensible à la saisonnalité (§33) : bien moins cher
en plein été qu'en hors-saison.

### Riz pilaf — 10 portions (garniture, illustration du gain)

| Composant | Grammage brut | Notes |
| --- | --- | --- |
| Riz | 700 g | sec, avant cuisson |
| Oignon | 100 g | suée au beurre |
| Fond blanc | 1,0 L | cuisson à absorption |

Méthode : cuisson à absorption, apparentée au canon « bouillir/mijoter » (§14). Rendement
prévu : **gain ×2,5–3** (§11.2) → ≈ 1,75–2,1 kg cuits pour 10 portions de ~180–200 g. Allergènes
(union) : aucun sur le riz nature — vérifier le fond (souvent **Céleri** en aromate classique).
Coût matière : 700 g à 3 CHF/kg = 2,10 CHF → **≈ 0,21 CHF/portion**, l'un des accompagnements
les moins chers de la carte, ce que le multiplicateur > 1 rend visible immédiatement au lieu de
le cacher dans un calcul de perte classique.
