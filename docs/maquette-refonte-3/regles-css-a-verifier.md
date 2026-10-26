# Règles CSS — inventaire de vérification

Audit statique de `app/css/style.css` (1 316 lignes au moment du relevé), rapproché des classes du DOM à 390 px dans [classes-par-ecran.md](classes-par-ecran.md). Aucun nettoyage effectué.

## Ce qui est établi

- Les classes observées ont des styles répartis entre le socle (`.vue`, `.contenu`, `.page-titre`, `.section-titre`, `.carte`, `.btn`, `.etq`) et des blocs propres aux vues (`.tdb-*`, `.prod-*`/`.mep-*`, `.bord-*`, `.art-*`, `.reglage-*`, `.prep-*`, `.fe-*`, `.hist-*`).
- La feuille est en cascade historique : des règles de vue et des retouches plus récentes réécrivent certains mêmes sélecteurs. Une règle répétée n’est pas en soi morte; elle peut corriger un breakpoint ou une vue ciblée.

## Doublons exacts repérés

Les sélecteurs suivants apparaissent deux fois dans des blocs distincts. Le numéro de ligne renvoie à `app/css/style.css`; la seconde occurrence peut être un correctif intentionnel.

| Sélecteur | Lignes | Vérification avant toute retouche |
|---|---:|---|
| `.onglets` | 111, 1169 | Barre fixe puis variante paysage. |
| `.onglets a` | 126, 1170 | Cible tactile puis variante paysage. |
| `.contenu` | 146, 482, 587 | Socle de page, tablette et impression. |
| `.tache-nom` | 217, 498 | Style de tâche puis règle de lien tactile. |
| `.tache-quantite` | 218, 892 | Format de quantité puis variante de production. |
| `.bord-aujourdhui` | 409, 1216 | Tableau de semaine puis retouche finale de cette vue. |
| `.bord-plat` | 419, 931 | Composant de menu et lien du tableau. |
| `.interrupteur-entree` (+ pseudo-états) | 519, 924–927 | Styles d’interrupteur repris près de Production. |
| `.prod-asaisir` | 583, 1269 | Impression puis variante de Production. |
| `.liste-rubriques-reglages` | 594, 1212 | Même sélecteur répété dans deux ensembles de styles. |
| `.mep-ligne.mep-fait .mep-qte` | 647, 988 | Apparence de quantité terminée à deux endroits. |
| `.prod-ligne .mep-qte` | 729, 899 | Même déclaration/variante à comparer. |
| `.fiche-qte-grande small` | 738, 918 | Petit libellé de quantité repris plus bas. |
| `.vue-semaine-globale .bord-zone` | 784, 1213 | Les valeurs divergent : historique puis remplacement final; ne pas fusionner sans vérifier le rendu attendu. |
| `.stock-segment` | 790, 794 | Style courant et exception mouvement réduit. |
| `.ia-ligne` / `.ia-ligne-quand` | 965, 1174 / 968, 1186 | Styles du brouillon et retouches d’état écarté. |
| `.cv-chevron` | 1064, 1066 | Style courant et exception mouvement réduit. |
| `.art-pouce` | 1113, 1115 | Barre d’action Articles et variante desktop. |
| `.prep-champ` | 1245, 1252 | Contrôle de préparation repris par une règle plus précise. |

## Candidats à vérifier, pas déclarés morts

Une recherche littérale des noms de classes CSS dans `app/js/ui/*.js` laisse des noms sans occurrence littérale : `achats-regle`, `coche-a_decider`, `encadre-erreur`, `hist-ligne`, `message-alerte`, `message-erreur`, `message-ok`, `nav-semaine*`, `prod-actions`, `tache-a_*`, entre autres. Ce résultat ne suffit pas à prouver qu’une règle est morte : certains noms peuvent être assemblés, employés par un autre module, ou correspondre à un état non affiché par la fixture.

Avant d’en retirer une, vérifier les chaînes assemblées, tous les modules de `app/`, les variantes conditionnelles et les vues non montrées par cet état. La feuille de style contient notamment des règles de mode poste, apprentissage, IA, import, fiches et feuilles rarement ouvertes; leur absence des captures ne signifie pas qu’elles sont inutilisées.

## Repère de travail pour les lots

Le lot CSS doit d’abord repérer la règle gagnante au viewport 390 px et les breakpoints concernés, puis faire une modification ciblée et vérifier les écrans partagés. Un éventuel nettoyage demandera un lot et une décision dédiés; il ne fait pas partie du lot 0.
