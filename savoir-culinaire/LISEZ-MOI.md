# Savoir culinaire de Sanji — brevet fédéral de chef de cuisine

Construit le 2026-10-04, en autonomie, sur demande de la propriétaire. **Tout est une proposition à valider** : rien n'est branché sur l'application, rien n'entre dans un calcul ou une commande.

## Où lire quoi
- `INDEX.md` : le nombre d'entrées par thème (généré).
- `fiches/*.md` : une fiche lisible par thème (féculents, légumes, sauces et cuissons, hygiène, organisation), avec les sources et les lacunes.
- `COUVERTURE-BREVET.md` : ce que couvre le référentiel face aux domaines du brevet, et ce qui manque.
- `donnees/*.json` : la source de vérité, au format de `FORMAT.md`. `savoir-culinaire.json` en est l'index généré.

## Commandes
- `npm run culinaire` : valide les données (sources, statut, états de poids, https, confiance) et régénère l'index. Un fichier non conforme fait échouer `npm test`.

## Comment il se branchera à l'application (rien n'est fait)
1. Lecture seule : un module généré `app/js/donnees/savoir-culinaire.js`, affiché en « Repères métier » avec source, confiance et mention « à valider ».
2. Une valeur utile à un calcul passe par l'assistant de validation existant : elle ne devient un repère validé que par la valeur que la propriétaire choisit (même circuit que `connaissances/savoir-metier.json`).
3. Calculs et commandes : rien sans validation écrite.

## Limites connues
- Vérification à la source (2e passe du 2026-10-04) : sur 262 entrées chiffrées, 201 confirmées, 56 appuyées par la seule base de Sanji, 5 partielles (champ `verification` de chaque entrée). Un contrôle croisé indépendant a jugé méritées 25 « confirmées » sur 25 tirées au hasard. Les entrées sans valeur chiffrée (techniques, définitions) n'ont pas été recontrôlées une à une.
- Le règlement d'examen du brevet (2011) est toujours en vigueur selon Hotel & Gastro formation (rapport d'août 2025), une révision étant en projet ; le SEFRI ne l'a pas confirmé. Les compétences détaillées ne sont pas reprises.
- Droit et hygiène : tout est « à valider localement » (cantons, version de la loi).
- Plusieurs lacunes assumées : pâtes fraîches, riz suisse, rapports du risotto, proportions de l'espagnole, bouillon de légumes, planification hebdomadaire, prix de revient complet. Elles sont listées dans chaque fiche.
