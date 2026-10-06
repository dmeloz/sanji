# Harness IA de Sanji

Statut : socle et premier parcours vertical (planning) construits le 2026-10-06, version 66. Aucun fournisseur d'IA n'est branché : le modèle est un composant optionnel, désactivé par défaut. Rien n'est publié.

Le harness est la couche entre l'état de l'application, le domaine, un éventuel modèle et le chef. Il encadre le modèle ; il ne lui délègue rien. Le domaine reste utilisable sans modèle, sans réseau et sans harness.

## Flux

```
demande de planning
→ construireContexte            (contexte.js : minimal, versionné, sans fiche ni allergie)
→ proposerPlanning              (parcours-planning.js : calcul déterministe, toujours produit d'abord)
→ [modèle optionnel]            (orchestrateur.js + fournisseur.js : outils lus, puis un brouillon)
→ controlerBrouillon            (validateur.js : structure fermée, références, rejeu du domaine sur une copie)
→ proposition en mémoire        (propositions.js : brouillon expliqué, empreinte de l'état lu)
→ décision du chef              (commandes.js `decider` : valider, refuser, confirmer item par item)
→ appliquerProposition          (commandes.js : empreinte revérifiée, planifier() dans UNE action `agir`)
→ journal                       (trace.js : harness:validee / harness:refusee / harness:appliquee)
```

Seule `appliquerProposition` écrit, et seulement à travers l'exécuteur injecté (`agir` de `magasin.js` en production). Le modèle ne voit jamais l'état, le DOM ni IndexedDB.

## Modules (`app/js/harness/`)

| Module | Rôle |
|---|---|
| `contrats.js` | Vocabulaire fermé (niveaux, décisions, statuts, provenances, codes), `ErreurHarness`, `verifierSchema` (sans dépendance). |
| `contexte.js` | `construireContexte` : données rangées en confirmées, provisoires, estimées, manquantes ; règles validées ; dernières décisions du harness. Aucune fiche de fonction. |
| `outils.js` | Registre figé des outils et `executerOutil`. Un nom hors registre est refusé (y compris `toString`, `__proto__`). |
| `politiques.js` | `evaluerPolitique` : auto, proposition, confirmation ou interdit. Liste des actions du domaine réservées au chef. |
| `parcours-planning.js` | Premier parcours : productions à planifier → créneau suggéré par le domaine, charge comptée sur une copie. |
| `validateur.js` | `controlerBrouillon` : schéma fermé, références, jour ouvert, créneau libre, capacité, règle d'avance, quantités recalculées. |
| `propositions.js` | Registre en mémoire, `empreinteEtat`, `itemsAppliquables`. Lectures par copie. |
| `commandes.js` | `decider`, `appliquerProposition` : atomique, refus en cas de conflit ou de double exécution. |
| `fournisseur.js` | Interface d'un modèle, `fournisseurDesactive`, `interroger` (délai, annulation, réponse validée). Aucun appel réseau. |
| `orchestrateur.js` | `proposerPlanningAssiste` : calcul d'abord, modèle ensuite (4 échanges au plus, appels répétés interdits), repli toujours possible. |
| `trace.js` | `tracer` (journal existant, détail borné à 240 caractères), `expliquer`, `evenementsHarness`. |

## Registre des outils

| Outil | Niveau | Provenance | Effet |
|---|---|---|---|
| `lire_menus`, `lire_previsions`, `lire_planning`, `lire_regle`, `lire_decisions_en_attente` | lecture | donnée importée / référentiel | aucun |
| `composants_du_poste`, `calculer_quantites`, `suggerer_creneau`, `evaluer_avance` | calcul | calcul déterministe | aucun |
| `proposer_planning` | proposition | calcul déterministe | aucun (brouillon) |
| `planifier_production` | commande | correction humaine | modifie `jourDecide` et `creneauDecide` ; invisible du modèle ; jamais exécutable par `executerOutil` |

Chaque définition porte : nom, objectif, niveau, schéma d'entrée, description de sortie, préconditions, erreurs, effets.

## Niveaux d'autorisation

- **Lecture, calcul** : automatiques.
- **Proposition** : le résultat est un brouillon, rien n'est enregistré.
- **Commande** : interdite pour le modèle et pour un calcul ; réservée à une proposition validée par le chef ; sans validation, elle demande confirmation.
- Actions du domaine **réservées au chef** (`ACTIONS_RESERVEES_AU_CHEF` : règles de préparation, standards, valeurs apprises, recettes, statuts, écarts, saisie du réel, import…) : absentes du registre, refusées avec un message explicite.

## Invariants (tous testés)

1. Une proposition ne modifie jamais la production réelle avant la décision du chef.
2. Valider ne planifie pas : appliquer est une seconde étape explicite.
3. L'application est tout ou rien. Dans la même action `agir`, l'empreinte de l'état est revérifiée puis les contrôles du brouillon sont rejoués sur l'état courant (jour devenu passé, règle changée…) ; au moindre écart : statut `conflit`, aucune écriture.
4. Une proposition s'applique une seule fois.
5. Les quantités affichées viennent toujours du domaine ; une quantité annoncée par un modèle qui diffère du calcul refuse le brouillon.
6. Une avance hors règle, un jour non travaillé, un créneau chargé ou plein, un jour passé ne sont jamais proposés ; la base du menu 1 reste au jour même.
7. Conservation non validée (avance d'au moins un jour sans limite saisie ni repère) : l'item exige une confirmation explicite, porte le motif « ne doit pas être présenté comme couvert » et reste hors de la décision sans confirmation.
8. Quantité inconnue ou absence de créneau compatible : « À décider », jamais devinée. Ce qu'un modèle omet reste « À décider ».
9. Le contexte et le journal ne contiennent ni allergies, ni remarques, ni fiches de fonction.
10. Sans modèle, hors ligne, en panne, en délai dépassé, annulé ou incohérent : le calcul déterministe répond et l'état reste identique.
11. Aucune écriture dans le schéma persistant : propositions en mémoire, traces dans `etat.journal` (format existant).

## Décisions techniques prises (réversibles)

- Dossier `app/js/harness/`, hors `domaine/` (le harness peut recevoir un exécuteur, mais n'importe ni `magasin.js` ni le DOM).
- Exécuteur injecté plutôt qu'import de `magasin.js` : testable sous Node, couplage minimal.
- Propositions en mémoire : pas de migration, pas de nouveau format. Elles ne survivent pas à un rechargement ; la trace des décisions, elle, survit dans le journal.
- Micro-modifications du domaine, comportement inchangé : `sansAvanceParDefaut` exporté ; `suggererCreneau(etat, id, depuis = null)` écarte les jours passés quand `depuis` est donné.
- Version 66 : nouveaux fichiers ajoutés à la liste de cache du service worker.

## Décisions métier ouvertes (accord requis)

- **Conservation à confirmer** : le harness exige une confirmation par item. Le domaine, lui, juge une avance de 1 à 2 jours « autorisée et couvrant le besoin » avec l'alerte « conservation à confirmer ». À valider : cette exigence plus stricte du harness est-elle la règle voulue ?
- **Conservation « référentiel » dépassée** : pour une avance d'au plus 2 jours dont la durée dépasse le repère du standard de base, le domaine avertit seulement et le harness n'exige aucune confirmation (le standard de base n'est pas une valeur validée par la propriétaire). À valider : faut-il aussi exiger une confirmation ?
- **Créneau du jour courant** : le domaine ne connaît pas l'heure ; un créneau du matin peut être proposé l'après-midi. À valider : faut-il une règle d'heure limite par créneau ?
- **Fournisseur d'IA** : aucun choix fait. Choisir un fournisseur, une clé ou un envoi de menus hors de l'appareil lève la règle « aucun envoi réseau » : décision de la propriétaire.
- **Parcours suivants** (écarts à arbitrer, actions préparatoires, apprentissage des portions, allergies, liste à commander) : non commencés, un par un.

## Limites

- Une seule tâche est couverte : le planning de productions non planifiées.
- Aucune interface : le harness n'est branché à aucun écran. Un écran « brouillon à valider » reste à concevoir (dans `ui/`, sans logique métier).
- Les propositions sont perdues au rechargement.
- Aucun fournisseur réel n'a été éprouvé : seul un fournisseur scripté est testé.
- Les contrôles de poids cru/cuit et de double perte restent ceux du domaine (`calculerComposant`) ; le harness ne les recalcule pas.

## Ajouter un outil

1. Ajouter une définition dans `DEFINITIONS` (`outils.js`) : tous les champs du contrat, schéma d'entrée fermé, `executer` pur qui réutilise une fonction de `domaine/` et ne modifie pas l'état.
2. Choisir le niveau : lecture ou calcul si rien n'est écrit ; proposition si un brouillon est rendu ; **commande** seulement avec accord, et alors l'exécuter uniquement depuis `commandes.js`.
3. Ajouter le test de contrat (`tests/harness-socle.test.js`) et un test de non-mutation.
4. Ne jamais ajouter un nom de la liste `ACTIONS_RESERVEES_AU_CHEF`.

## Ajouter un fournisseur d'IA (après accord de la propriétaire)

1. Écrire un objet `{nom, disponible(), demander(requete, {signal})}` dans `ui/` ou dans un module d'amorçage, jamais dans `domaine/` ni `harness/` (règle : aucun `fetch` dans ces dossiers, un test le vérifie).
2. Le brancher en passant `fournisseur` à `proposerPlanningAssiste`.
3. Documenter dans `02-Decisions-validees` l'exception à « aucun envoi réseau », les données transmises et le lieu d'hébergement.
4. Les réponses restent non fiables : le validateur et la politique s'appliquent à l'identique.

## Tests

`npm test` : 924 tests au 2026-10-06 (865 d'origine, 11 d'import des nouveaux fichiers, 48 du harness). Une revue indépendante a relevé un point haut (application sans rejeu des contrôles) et six moyens, corrigés sauf la décision métier ci-dessus. Les tests du harness : `tests/harness-socle.test.js` (contrats, politiques, registre, contexte, trace, fournisseur, hygiène) et `tests/harness-parcours.test.js` (parcours complet, conflits, modèle scripté, refus, boucles, indisponibilité, magasin réel, export/import). Données `TEST_ONLY` uniquement ; outils : `tests/aide-harness.js`.
