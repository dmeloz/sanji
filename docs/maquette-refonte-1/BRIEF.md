# Sanji — appliquer la maquette « refonte 1 »

À lire en entier avant de toucher au code. Ce brief fait suite à deux décisions validées le 2026-10-04 :
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-04 - Sanji - Onglets et ecrans de la refonte 1.md`
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-04 - Sanji - Direction visuelle de la refonte 1.md`

## La règle d'or
**On change la structure et l'apparence. On ne change pas la logique métier.**
Calculs, statuts, règles d'avance, attribution au poste, vocabulaire de provenance, export et restauration, hors ligne : tout reste comme dans la v42 et le plan V1 (`docs/plan-final-copilote-entremetier-v1.md`). Les 639 tests doivent encore passer. Si un écran de la maquette semble demander une nouvelle règle, ne l'invente pas : affiche ce que l'application sait déjà, et note la question pour la propriétaire.

## Contenu du dossier
- `BRIEF.md` : ce fichier.
- `tokens.css` : les valeurs de la nouvelle apparence, à fusionner dans `app/css/style.css`.
- `maquettes/` : la source de chaque écran (format du canevas Design). Prends-y la **disposition et les styles**. Ignore le moteur du canevas (`<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>`, `{{ … }}`, `DCLogic`, `support.js`). Les crochets (`[qté]`, `[Préparation]`…) marquent une donnée réelle de l'application. « Pesto 500 g » est un exemple de la propriétaire, pas une donnée.

## Correspondance des écrans

| Maquette | Ce qu'elle affiche | D'où viennent les données (v42) |
|---|---|---|
| `Main` — **Aujourd'hui** (onglet 1, accueil) | date et état de synchronisation ; couverts midi et soir avec leur certitude ; carte « Maintenant » (prochaine tâche à faire, quantité, destination, jauge du jour) ; bandeau « N décisions en attente » ; « À consommer en priorité » ; fiche de fonction à venir | Tableau actuel (`vue-tableau.js`) : menus, fiches de fonction, À confirmer, production et commandes ; prévisions ; feuille Jour pour la prochaine tâche ; avertissements de conservation existants |
| `Exceptions` — **À décider** (feuille du bas) | une carte par décision, avec ses actions | section « À confirmer » et écarts à arbitrer existants (Complément / Ajustement / Aucune production supplémentaire, avance hors règle, sauce implicite, répartition provisoire…). Une quantité absente **n'est jamais** une décision : ne pas l'y mettre |
| `Production` (onglet 2) | Aujourd'hui / Demain ; lignes à cocher ; nom, étiquette Recette/Brut, destination, créneau, provenance ; quantité à droite ; chevron vers la fiche pour une recette | feuille Jour (`vue-jour.js`, `taches.js`) : « Fait » en un toucher et annulable, Corriger le réel, glisser entre jours. Un produit brut n'affiche que sa quantité et son créneau |
| `Fiche` — **Fiche technique** | quantité du jour en grand, répartition par service, calcul et provenance, ingrédients recalculés, étapes, note, allergènes | détail du composant et de la recette (`vue-composant.js`, `vue-detail.js`, `reperes-metier.js`) |
| `Poste` — **Mode en poste** | une étape à la fois, en grand, écran allumé | recette et étapes existantes ; `ecran-allume.js`. Si la recette n'a pas d'étapes, ne pas proposer ce mode |
| `Semaine` (onglet 3) | puces lundi → samedi, dimanche fermé ; menus du jour et carte (contexte) ; fiche de fonction ; bandeau du jour ; productions avec créneau et avance ; « Déplacer » | Tableau semaine, menus, planification (`planification.js`), charge des créneaux, semaine type. Avance au-delà de 2 jours calendaires = **hors règle** en ambre (règle existante) |
| `Import` — **Import des menus** | saisie de la semaine, vérification de la lecture jour par jour | saisie actuelle (`vue-menus.js`, texte collé ou tapé). La photo reste une aide (`photo.js`) : **pas de lecture automatique de photo** |
| `Stock` (onglet 4) | trois vues : Restes, DLC, Achats | Restes = saisie facultative après service (ventes, surplus, rebut) ; DLC = avertissements de conservation et limites d'utilisation existants ; Achats = vue Produits actuelle (besoin brut, vérifié disponible, proposé à commander, contrôle à 3 états, échéance fournisseur). **Pas de stock théorique** : écrire « vérifié disponible », jamais « en stock » |
| `Reglages` — **Réglages** | sections et lignes | les 4 rubriques existantes (`vue-reglages.js`), ouvertes par le bouton en haut de l'accueil |
| `TabBar` | 4 onglets fixes en bas | remplace la barre actuelle |
| `Composants` | matrice : couleurs, typographie, composants, règles | référence visuelle |

Libellés : garde ceux de l'application quand la maquette en invente (par exemple « estimation fragile » devient la certitude « estimée » ; les provenances restent « validé restaurant », « standard de base », « saisi au service », « calculé », « inconnu »). La carte reste un contexte : aucune quantité de carte n'est calculée.

## Méthode
1. Lis `CLAUDE.md` du projet, la fiche `Cerveau-Obsidian/01-Projets/Sanji.md` et les deux décisions ci-dessus.
2. **Présente un plan avant de modifier quoi que ce soit** : quel fichier de `app/js/ui/` devient quel écran, ce qui est déplacé et ce qui est nouveau. Attends l'accord de la propriétaire.
3. Fusionne `tokens.css` dans `style.css`. Pour la police, ajoute les fichiers IBM Plex Mono (licence OFL) dans `app/polices/` **après accord de la propriétaire**, sans CDN ; le service worker doit les mettre en cache.
4. Écran par écran, dans cet ordre : barre d'onglets et routes, Aujourd'hui, Production, Fiche, Semaine, Stock, À décider, Import, Réglages, Mode en poste. Fais un commit par écran. Tests verts à chaque étape, `VERSION` incrémentée.
5. Vérifie à 390 px (iPhone), en clair et en sombre : cibles d'au moins 44 px, aucun statut porté par la couleur seule, contrastes WCAG, mouvement réduit respecté.
6. En fin de travail : mets à jour `docs/conception-technique-v1.md` (nouvelle section) et la fiche Sanji (état, date, prochaine action).

## À ne pas faire
- Changer un calcul, une règle d'avance ou un statut pour coller à un écran.
- Ajouter une dépendance, un build, une police ou un script chargés en ligne.
- Inventer une valeur métier, une durée de conservation ou une quantité.
- Supprimer une fonction existante qu'aucun écran ne montre plus : la rendre accessible ailleurs (Réglages, menu) et le signaler.
