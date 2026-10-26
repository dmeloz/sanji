# Modèles de documents de cuisine

Des gabarits de documents de production, à remplir à la main ou à générer depuis Sanji. Rien ici n'est branché dans l'application.

| Fichier | Contenu | Statut |
|---|---|---|
| `fiche-production-croisee.md` | Fiche de production croisée (version 1.1) : plusieurs préparations, un ingrédient sur une seule ligne avec quantité par préparation, total net, brut à peser, coût, allergènes déduits des ingrédients, ordre de production, HACCP, validation. Export PDF paysage. | Proposition du 2026-10-20, à valider par la propriétaire |

Données saisies dans l'en-tête YAML, corps en Mustache (`{{#liste}}…{{/liste}}`). Les totaux, le coût, le temps total et les allergènes par préparation se calculent ; ne jamais les taper à la main.
