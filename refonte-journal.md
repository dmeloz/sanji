# Journal de la refonte (A et B), exécutée en autonomie

Délégation de la propriétaire, 2026-10-04 : « réaliser la totalité des 2 prompts corrigés en autonomie, revenir quand la refonte est finie ». Sources : `perplex/sanji-prompts-v23.corrige.md` et `perplex/sanji-addendum-metier.corrige.md`.
Garde-fous maintenus : aucun `git push`, rien de publié, rien de supprimé sans accord, aucune valeur non validée dans une commande, aucune valeur métier inventée. Chaque choix par défaut pris ici est une PROPOSITION appliquée par délégation, à confirmer (liste en bas).

## Ordre d'exécution
1. A-P0 inventaire et tests de non-régression : FAIT (`ee435ae`).
2. A-P1a défaut du journal (tâche retirée par une modification de menu) : FAIT (v24).
3. (fait avant) A-P2 Réglages en sous-menus : FAIT (v25). 30 cas de lecture (Haiku) : FAIT. Conception du volet B (Opus) : FAIT.
3b. A-P1b Tableau et feuille Jour : FAIT (v26, 403 tests).
3c. B-P0 schéma de connaissances, données sources, migration, moteur explicable : à faire.
4. A-P1b nouveau Tableau (dashboard) et nouvelle feuille Jour : à faire.
5. B-P1 lecture de plats (menu 1 / menu 2, « X aux Y », sauce implicite), étapes à avance propre, liste « à commander » à trois états, assistant de validation : à faire.
6. B-P2 journée réelle (banquets, restes, changements, journal de recalcul), 30 cas de lecture à 90 % : à faire.
7. A-P2 Réglages en sous-menus, pages secondaires harmonisées : à faire.
8. Vérification finale, documentation, fiche Sanji : à faire.

## Agents lancés (2026-10-04)
- Conception du volet B (Opus, lecture seule) : spécification d'implémentation dans l'architecture existante.
- A-P1 Tableau et feuille Jour (Sonnet, espace Git isolé).
- A-P2 Réglages en sous-menus (Sonnet, espace Git isolé).
- 30 cas de lecture transcrits en jeu de test (Haiku, espace Git isolé).
Ensuite, après fusion des branches : B-P0 et B-P1 construits à partir de la spécification d'Opus, puis B-P2, puis relecture finale (Opus).

## Choix par défaut appliqués par délégation (à confirmer)
1. **Prompt B réduit** (recommandation de la conception, Opus) : retirés ou reportés buffet, cocktail et repas du personnel, dimensions « moment » et « type de service » des portions, fusion hors ligne, capacités d'équipement, contamination croisée structurée, heures limites fournisseurs, substitutions, DLC et conservation générique, arrondis de conditionnement, restes affectés, portée des corrections à cinq niveaux (ramenée à deux : cette fois / standard), identifiant produit canonique, sous-familles, vague 2.
2. **Les six repères validés** sont créés dans une source versionnée du projet (`connaissances/savoir-metier.json`, générée vers `app/js/donnees/savoir-metier.js`), jamais dans la base officielle, que la propriétaire seule modifie. Viande sans os et œufs y sont stockés mais non utilisés tant que l'application n'a pas de famille protéine.
3. **Pas de quatrième état de poids « brut »** (la décision du 2026-10-03 « cru brut reporté » est maintenue) : la viande sans os est lue comme `cru_net`, les œufs comme `cru_net` en pièces.
4. **Fourchettes** : le calcul garde le milieu de la fourchette comme ESTIMATION étiquetée (comportement validé en amont pour les repères et les coefficients) ; ce n'est pas une valeur du restaurant. Le standard maison, qui passe avant, se règle ligne par ligne.
5. **Brouillon de données de Perplexity** : aucune valeur n'entre dans le calcul. Raisons : états de poids différents entre les deux « sources » (légumes cuits contre cru paré), sources non indépendantes ou secondaires, parages qui contredisent la base embarquée. Il reste un document de comparaison.
6. **Vocabulaire générique** (formes de pâtes, herbes, sauces candidates, sans quantité) autorisé sous `app/` : ce n'est pas un nom de plat du restaurant, comme le lexique existant.
7. **Feuille Jour** : les avances « hors règle » (plus de deux jours) sont repliées en une ligne avec leur compte, jamais cachées. Le jour affiché est amené à l'écran dans la barre des jours.
8. **Tableau** : « Tout » de la barre de jours n'existe pas (ce serait un filtre) ; le centre « À confirmer » est une section de la feuille Jour, faute de route dédiée.
9. **Étapes de préparation** : l'application ne fournit aucune étape ni durée par défaut, mais deux valeurs par défaut s'appliquent dès qu'une règle a au moins deux étapes : la finition a 0 jour d'avance, et une étape sans avance maximale définie n'est jamais autorisée au-delà de la règle générale de deux jours. À confirmer.
10. **Pâtes et risotto du menu 1** : non avançables par défaut (le jour même), sauf si la propriétaire définit une avance maximale sur le nom de la préparation. À confirmer.
11. **Relecture indépendante (Opus, lecture seule)** : un défaut critique (une protéine du menu 2 attribuée au poste par la mémoire du menu 1), cinq importants et plusieurs mineurs ont été trouvés et confiés à deux agents de correction. La liste complète et son état sont dans le compte rendu final.

## Limites connues
- **Lecture des plats** : 30/30 sur les 30 cas d'origine, mais l'auteur avait enrichi le vocabulaire avec leurs mots. Sur 30 cas NEUFS écrits sans lire le code, le premier score était 27/30 (90 %) : les trois échecs venaient de formes de pâtes inconnues (casarecce, tagliolini, fettuccine). Le vocabulaire a ensuite été étendu ; le 30/30 qui suit n'est plus indépendant. La lecture reste bornée par son vocabulaire : un mot de plat inconnu reste « à préciser », jamais inventé. Une règle de repli (« en menu 1, le premier mot inconnu est la pâte ») n'est pas construite.
- Aucune vérification sur un vrai iPhone. L'extension Chrome n'est pas connectée : les écrans ont été relus avec des captures Chrome sans fenêtre à 390 px (rendu réel de la mise en page, mais sans interaction ni tactile).
- Les tests sous faux DOM ne voient ni IndexedDB réelle ni le service worker.
- « 1 changement depuis le dernier calcul » (maquette A) n'existe pas : aucun mécanisme de comparaison n'est construit.
- Le menu 2 : une sauce ou une garniture attribuée au poste par exception reste à la décision du chef.

## B-P2 étapes à avance propre (2026-10-04)
FAIT dans la branche de travail : modèle `etapes` des règles, productions d'étapes, évaluation par étape, ordre planifier/fait, éditeur dans Réglages, blocs Composant et Jour. Aucune étape ni durée par défaut (rien de validé) : la propriétaire les définit. Version non incrémentée ici (à faire à la fusion).
