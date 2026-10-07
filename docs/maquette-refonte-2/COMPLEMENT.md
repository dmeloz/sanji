# Sanji — complément de la refonte 2 (second paquet)

À appliquer **après** les étapes du `BRIEF.md`, avec la même méthode (plan d'abord, un commit par écran, tests verts, `VERSION` incrémentée, vérification à 390 px en clair et en sombre). Décision : `Cerveau-Obsidian/02-Decisions-validees/2026-10-07 - Sanji - Historique, rappel du vendredi et etats vides.md`.

## 1. Historique des semaines — `maquettes/C6-Historique.dc.html`
- Accès depuis Semaine. Liste des semaines passées, la plus récente en premier : « Semaine du [date] », nombre de jours, état des ventes (« ventes saisies », « ventes à compléter », « 1 jour sans menu »), total servi.
- Une semaine dépliée : un jour par ligne, M1 et M2, couverts servis (`ventes`). Toucher une semaine l'ouvre dans Semaine, **en lecture**.
- Rien n'est effacé : l'app garde déjà toutes les semaines (aucune purge) ; c'est une vue de plus, pas un nouveau stockage.

## 2. Rappel du vendredi — `maquettes/A1d-Vendredi.dc.html`
- Le vendredi (jour de l'affichage des menus de la semaine suivante), si la semaine suivante n'a pas de menu : encart d'action « Menus de la semaine prochaine · à importer » sous les menus d'Aujourd'hui, qui ouvre `#/import/<lundi suivant>`.
- Dans les colonnes de menus : samedi « service non présumé », lundi suivant « menu à importer » en pointillés.

## 3. États vides ou ratés
| Maquette | Quand | Contenu |
|---|---|---|
| `G1-ProductionVide` | aucune tâche ce jour | « Rien à produire aujourd'hui », Voir la semaine, Importer les menus, Avancer pour demain |
| `G2-JourSansMenu` | jour sans menu dans Semaine | « menu à importer », rien n'est calculé, bouton Importer |
| `G3-ArticlesVide` | aucun menu importé | « Aucun article pour l'instant », bouton Importer |
| `G4-ImportIllisible` | lignes non comprises à l'import | encart paille « N lignes non comprises », les lignes citées, « rien n'est deviné », état par jour, Corriger le texte / Enregistrer le lu |
| `G5-FicheSansRecette` | composant sans recette | quantité calculée, Recette « non saisie », Étapes « aucune », Allergènes « à confirmer » (paille), bouton « Ajouter la recette » ; pas de mode en poste sans étapes |

## 4. Style épuré partout
- Toutes les listes à plat sur le fond (plus de carte blanche autour des listes), filets fins en haut et en bas : règle `.liste` de `maquettes/sanji-r2.css`.
- Lignes et cartes cliquables en couleur de texte, pas en bleu d'action : seuls les vrais liens et boutons d'action sont bleus.
- Carte « Prochaine » : la sous-ligne ne dit que le menu (« menu 1 »), sans la provenance.

## À ne pas faire
Pas de nouvelle règle métier, pas de donnée d'exemple, pas de purge des semaines, pas de lecture automatique de photo.
