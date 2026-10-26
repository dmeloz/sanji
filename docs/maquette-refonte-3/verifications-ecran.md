# Vérifications d'écran à 390 px (refonte 3)

Points purement visuels, retirés des tests (lecture de `style.css` par regex) : à vérifier à l'œil sur iPhone ou navigateur à 390 px.

| Écran | À voir à 390 px | Règle CSS |
|---|---|---|
| Aujourd'hui, Jours proches | Intitulé du menu en bloc, sans boîte à lignes tronquée | `.tdb-intitule { display: block }` |
| Production, titre | Date complète sur sa zone, à côté des deux flèches ; la date passe à la ligne | `.vue-production .prod-titre-ligne` (grid), `.vue-production .prod-date` (white-space: normal) |
| Production, titre | Flèches de jour de 44 px, faciles à toucher | `.prod-fleche` (width/height: var(--cible)) |
| Production, lignes | Nom du plat sur plusieurs lignes, quantité distincte, case et quantité alignées | `.vue-production .prod-nom` (white-space: normal), `.prod-principal` (grid-template-columns) |
| Import, Préparer | Repère d'étape lisible, cibles de 44 px, texte d'au moins 15 px | bloc `Refonte 3 — lot 3` (`.imp-etape-titre`, `.prep-etape`) |
| Services, Planifier, Brouillon | Rubriques lisibles, cibles de 44 px, pas de `details` déroulant ni de dégradé | bloc `Refonte 3 — lot 4` (`.services-etape`, `.planifier-etape`, `.ia-etape`) |
| Semaine | Chaque jour en carte (fond carte), menus M1/M2 en grille | `.vue-semaine-globale .bord-jour`, `.vue-semaine-globale .bord-menu` |
| Articles | Carte « aucun article aujourd'hui » : cibles de 44 px, sans dégradé | bloc `Refonte 3 — lot 5` (`.art-vide-aujourdhui`) |
| Réglages | Groupes en cartes, rubriques non numérotées | `.vue-reglages-racine .reglages-groupe`, absence de `reglages-groupe-titre::before` |
| Réglages, Données | Cartes repérées, zone de remise à neuf distincte | `.vue-reglages-donnees > .carte`, `.vue-reglages-donnees .reglage-danger` |
| Fiches des éléments | Rubriques en cartes, champ de recherche de 44 px | `.vue-fiches-elements .fe-rubrique`, `.vue-fiches-elements .fe-recherche` |
| Historique | Semaines en cartes, colonne des quantités stable | `.vue-historique .hist-semaine`, `.vue-historique .hist-qte` |
| Feuilles du lot 6 | Cibles de 44 px, texte au gabarit corps, pas de `details` ni de dégradé | bloc `Refonte 3 — lot 6` |
| Semaine (v143) | Menus M1/M2 compacts (une ligne par menu, sans filet entre eux), chiffre des couverts et « couverts à saisir » de 44 px, tête datée « Semaine · 5 octobre » | `.vue-semaine-globale .bord-menu`, `.bord-jour-tete`, `button.bord-jour-couverts` |
| Semaine (v143) | Liens de plat de l'intitulé en ligne normale (une ligne repliée = interligne 1,35, pas 44 px) ; chiffre des couverts et ligne `.bord-menu` gardent 44 px ; semaine passée : « couverts non saisis » | `.vue-semaine-globale .tb-intitule .bord-plat` (display: inline) |
