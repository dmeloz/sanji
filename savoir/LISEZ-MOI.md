# Savoir métier de Sanji

Tout le savoir que l'application utilise ou utilisera est ici, au même endroit.

| Dossier | Contenu | Statut | Généré vers |
|---|---|---|---|
| `base-metier/` | Base officielle de production, stock et hygiène (version 5.5) : pertes, rendements, cuissons, découpes, températures, durées. Donnée de référence : ne pas la modifier. | Référence fournie par la propriétaire | `app/js/donnees/base-metier.js` (`npm run base`) |
| `reperes-portion/` | Les six repères de portion validés le 2026-10-03. | Validés | `app/js/donnees/savoir-metier.js` (`npm run savoir`) |
| `culinaire/` | Référentiel du brevet fédéral de chef de cuisine : 5 thèmes, 413 entrées sourcées, fiches lisibles. | Contenu validé le 2026-10-04 ; pas encore branché | Rien pour l'instant (`npm run culinaire` valide et fait l'index) |

Les fichiers générés de `app/js/donnees/` ne s'éditent jamais à la main. `npm test` vérifie qu'ils sont à jour et conformes.
