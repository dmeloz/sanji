# Savoir culinaire de Sanji — brevet fédéral de chef de cuisine

Construit le 2026-10-04, en autonomie, sur demande de la propriétaire. **Contenu validé par la propriétaire le 2026-10-04** après relecture de toutes les fiches (décision `Cerveau-Obsidian/02-Decisions-validees/2026-10-04 - Sanji - Referentiel de savoir culinaire valide.md`). Depuis la décision du 2026-10-04 « Standards de base et ajustement terrain », les entrées listées dans `rattachements.json` sont des standards de base utilisés directement par les calculs ; la valeur de la propriétaire, changée dans Réglages, passe toujours devant. Une entrée ajoutée après cette date repart « à valider ».

## Où lire quoi
- `INDEX.md` : le nombre d'entrées par thème (généré).
- `fiches/*.md` : une fiche lisible par thème (féculents, légumes, sauces et cuissons, hygiène, organisation), avec les sources et les lacunes.
- `COUVERTURE-BREVET.md` : ce que couvre le référentiel face aux domaines du brevet, et ce qui manque.
- `donnees/*.json` : la source de vérité, au format de `FORMAT.md`. `savoir-culinaire.json` en est l'index généré.
- `rattachements.json` : quelles entrées servent aux calculs, pour quelle famille, quel groupe ou quelle règle générale (choisi à la main, aucun chiffre ; règles dans `FORMAT.md`).

## Commandes
- `npm run culinaire` : valide les données (sources, statut, états de poids, https, confiance) et les rattachements, régénère l'index et le module `app/js/donnees/savoir-culinaire.js`. Un fichier non conforme, ou un module pas à jour, fait échouer `npm test`.

## Comment il est branché à l'application
1. Module généré `app/js/donnees/savoir-culinaire.js` (entrées allégées : sources réduites à titre, organisme, url ; conditions tronquées à 300 caractères), lu par `app/js/domaine/standards-base.js` seulement.
2. Entrées rattachées : standards de base (rendements, conservation, temps de cuisson, températures, buffet, allergènes) ; valeur = milieu de la fourchette, borne prudente pour l'hygiène ; le référentiel prime sur la base métier quand sa valeur est confirmée à la source, l'écart reste visible.
3. Les autres entrées sont des aides (par famille ou par thème), à afficher sans entrer dans un calcul.

## Limites connues
- Vérification à la source (2e passe du 2026-10-04) : sur 262 entrées chiffrées, 201 confirmées, 56 appuyées par la seule base de Sanji, 5 partielles (champ `verification` de chaque entrée). Un contrôle croisé indépendant a jugé méritées 25 « confirmées » sur 25 tirées au hasard. Les entrées sans valeur chiffrée (techniques, définitions) n'ont pas été recontrôlées une à une.
- Le règlement d'examen du brevet (2011) est toujours en vigueur selon Hotel & Gastro formation (rapport d'août 2025), une révision étant en projet ; le SEFRI ne l'a pas confirmé. Les compétences détaillées ne sont pas reprises.
- Droit et hygiène : tout est « à valider localement » (cantons, version de la loi).
- Plusieurs lacunes assumées : pâtes fraîches, riz suisse, rapports du risotto, proportions de l'espagnole, bouillon de légumes, planification hebdomadaire, prix de revient complet. Elles sont listées dans chaque fiche.
