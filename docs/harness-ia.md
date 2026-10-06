# Harness IA de Sanji

Statut : socle, premier parcours vertical (planning) et intégration dans l'interface construits le 2026-10-06, version 67. Le modèle (Claude, API Anthropic) est un composant optionnel, désactivé par défaut : il ne s'active que dans Réglages > Assistant IA. Rien n'est publié.

## Intégration dans l'application (version 67)

- **Bouton « Proposer un planning »** : en tête de Production et dans la barre d'outils de la semaine globale (`ui/assistant-planning.js`). Période : de la date affichée (ou d'aujourd'hui) au samedi ; un dimanche vise la semaine suivante.
- **Feuille « Brouillon de planning »** : préparations proposées (jour, créneau, quantité calculée), avertissements, « À décider », et « Pourquoi cette proposition » (sources, hypothèses, incertitudes, contrôles). Trois gestes : « Valider et planifier » (validation puis application atomique), « Refuser » (seule la trace est écrite), « Fermer sans décider » (rien n'est écrit). Fermer la fenêtre « Calcul en cours » annule la demande au modèle.
- **Réglages > Assistant IA** : activation, clé d'API (champ masqué), choix du modèle (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`). Les réglages sont stockés dans le stockage local du navigateur (`sanji-assistant-ia`), **hors de l'état** : ils ne sont ni dans la sauvegarde exportée, ni dans le journal. Une clé collée est nettoyée (caractères invisibles, texte autour) ; un texte qui n'est pas une clé `sk-ant-…` est refusé.
- **Fournisseur** : `ui/fournisseur-web.js` est le seul fichier de `app/` qui parle au réseau (un test le vérifie). Il envoie le contexte minimal et le brouillon de départ : noms des composants, portions, créneaux ; jamais les fiches de fonction ni les allergies. En-tête `anthropic-dangerous-direct-browser-access` obligatoire pour un appel navigateur : la clé reste sur l'appareil, sous la responsabilité de la propriétaire.
- **Sans clé ou désactivé** : Sanji calcule seul, comme avant. En cas de panne, de clé refusée ou de réponse invalide, le calcul répond avec un avertissement.
- **À vérifier sur appareil** : l'appel depuis l'enveloppe iPhone (origine `sanji://app`) dépend du CORS de l'API ; sinon un pont natif `URLSession` serait nécessaire. Non testé ici.

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
| `horloge.js` | Montre interne : horloge injectable, bornes de fin de créneau (réglages de la propriétaire), `creneauPasse`, `exclusionDuPasse`. |
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
7. Conservation non validée (avance d'au moins un jour sans limite saisie ni repère) : avertissement léger porté par l'item (« ne doit pas être présenté comme couvert »), `couvre` faux, aucune confirmation exigée. Le mécanisme de confirmation par item (`exigeConfirmation`) reste disponible pour de futures commandes.
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

- **Heures de fin de créneau** : l'horloge interne est en place (`horloge.js`) mais aucune borne n'est renseignée ; sans borne, un créneau du matin peut être proposé l'après-midi. À fournir par la propriétaire.
- **Fournisseur d'IA** : aucun choix fait. La règle « aucun envoi réseau » est levée pour une couche d'IA optionnelle (décision du 2026-10-06), mais rien ne part tant que le fournisseur, la clé et les données transmises ne sont pas validés.

## Décisions prises (2026-10-06, la propriétaire)

- Une conservation non validée donne un **avertissement léger**, jamais une confirmation, et n'est jamais présentée comme couverte (`evaluation.couvre` reste faux). Une conservation « référentiel » dépassée avertit aussi, sans confirmation.
- **Pas de parcours « conservation »** dans le harness : il n'ajoute rien au domaine sur ce sujet.
- **Horloge interne** : `creerHorloge` / `horlogeFixe`, bornes de fin de créneau `{avant_midi?, apres_midi?, avant_soir?}` validées en `HH:MM`, `creneauPasse`, `exclusionDuPasse`. Le calcul (`suggererCreneau(etat, id, depuis, exclure)`), le validateur et l'application d'une proposition écartent un créneau terminé ; l'application rejoue ce contrôle (conflit si l'heure de fin passe entre la validation et l'application). Sans borne : comportement inchangé.
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

## Essai avec l'API Anthropic (hors application)

`outils/fournisseur-anthropic.mjs` relaie vers `app/js/ui/fournisseur-web.js` (une seule implémentation, requête HTTP directe, Node 22, aucune dépendance) ; `outils/essai-anthropic.mjs` lance le harness sur des données `TEST_ONLY`. Rien de réel n'est envoyé, rien n'est branché dans `app/`.

```
read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY && node outils/essai-anthropic.mjs --montrer
```

- La clé n'est lue que dans `ANTHROPIC_API_KEY` ; sans elle, aucun appel n'est fait. Un test vérifie qu'aucune clé n'est écrite dans le dépôt.
- Modèle par défaut `claude-opus-5-5` (changer avec `SANJI_MODELE`), effort `low`, un seul échange, un seul outil `rendre_brouillon` (schéma du brouillon). Seuls le contexte minimal et le brouillon de départ sont envoyés ; `--montrer` affiche exactement la requête.
- Non activé : le repli serveur `fallbacks` (un refus du modèle laisse simplement le calcul déterministe répondre).

## Ajouter un fournisseur d'IA (après accord de la propriétaire)

1. Écrire un objet `{nom, disponible(), demander(requete, {signal})}` dans `ui/` ou dans un module d'amorçage, jamais dans `domaine/` ni `harness/` (règle : aucun `fetch` dans ces dossiers, un test le vérifie).
2. Le brancher en passant `fournisseur` à `proposerPlanningAssiste`.
3. Documenter dans `02-Decisions-validees` l'exception à « aucun envoi réseau », les données transmises et le lieu d'hébergement.
4. Les réponses restent non fiables : le validateur et la politique s'appliquent à l'identique.

## Tests

`npm test` : 962 tests au 2026-10-06 (865 d'origine, 15 d'import des nouveaux fichiers, 82 du harness et de son interface, dont `tests/harness-horloge.test.js`, `tests/fournisseur-anthropic.test.js` et `tests/assistant-ia.test.js`). Une revue indépendante a relevé un point haut (application sans rejeu des contrôles) et six moyens, corrigés sauf la décision métier ci-dessus. Les tests du harness : `tests/harness-socle.test.js` (contrats, politiques, registre, contexte, trace, fournisseur, hygiène) et `tests/harness-parcours.test.js` (parcours complet, conflits, modèle scripté, refus, boucles, indisponibilité, magasin réel, export/import). Données `TEST_ONLY` uniquement ; outils : `tests/aide-harness.js`.
