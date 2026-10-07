# Harness IA de Sanji

Statut : socle, premier parcours vertical (planning) et intégration dans l'interface construits le 2026-10-06, version 69. Le modèle (Claude, API Anthropic) est un composant optionnel, désactivé par défaut : il ne s'active que dans Réglages > Assistant IA. Rien n'est publié.

## Intégration dans l'application (version 67)

- **Bouton « Proposer un planning »** : en tête de Production et dans la barre d'outils de la semaine globale (`ui/assistant-planning.js`). Période : de la date affichée (ou d'aujourd'hui) au samedi ; un dimanche vise la semaine suivante.
- **Feuille « Brouillon de planning »** : préparations proposées (jour, créneau, quantité calculée), avertissements, « À décider », et « Pourquoi cette proposition » (sources, hypothèses, incertitudes, contrôles). Trois gestes : « Valider et planifier » (validation puis application atomique), « Refuser » (seule la trace est écrite), « Fermer sans décider » (rien n'est écrit). Fermer la fenêtre « Calcul en cours » annule la demande au modèle.
- **Réglages > Assistant IA** : activation, clé d'API (champ masqué), choix du modèle (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`). Les réglages sont stockés dans le stockage local du navigateur (`sanji-assistant-ia`), **hors de l'état** : ils ne sont ni dans la sauvegarde exportée, ni dans le journal. Une clé collée est nettoyée (caractères invisibles, texte autour) ; un texte qui n'est pas une clé `sk-ant-…` est refusé.
- **Fournisseur** : `ui/fournisseur-web.js` est le seul fichier de `app/` qui parle au réseau (un test le vérifie). Il envoie le contexte minimal et le brouillon de départ : noms des composants, portions, créneaux ; jamais les fiches de fonction ni les allergies. En-tête `anthropic-dangerous-direct-browser-access` obligatoire pour un appel navigateur : la clé reste sur l'appareil, sous la responsabilité de la propriétaire.
- **Sans clé ou désactivé** : Sanji calcule seul, comme avant. En cas de panne, de clé refusée ou de réponse invalide, le calcul répond avec un avertissement.
- **Sécurité (revues du 2026-10-06)** : aucune faille critique. Atténuations en place : clé hors état/sauvegarde/journal, jamais affichée en entier ; noms transmis limités à 60 caractères et filtrés (remarques sur une personne, allergies) ; texte libre du modèle borné (5 éléments de 200 caractères) ; tout le DOM est construit en texte (jamais `innerHTML`) ; contrôles rejoués à l'application. À savoir : la clé est stockée **en clair** dans le stockage local de l'appareil ; utiliser une clé réservée à Sanji, dans un espace de travail Anthropic dédié avec une limite de dépense basse, et la renouveler en cas de perte de l'appareil.
- **CSP (version 69)** : `index.html` déclare `script-src 'self'; connect-src 'self' https://api.anthropic.com; object-src 'none'; base-uri 'none'`. Vérifiée dans Chrome : l'application démarre sans violation, l'API Anthropic reste joignable, une connexion vers un autre site et un script en ligne sont bloqués. Elle ne restreint ni les styles (`vue-fiche.js` pose un attribut `style`), ni les polices, ni les images (`blob:` des photos). Elle limite la sortie de la clé en cas de future faille XSS. **À confirmer sur l'enveloppe iPhone** (origine `sanji://app`) : non testé dans WKWebView. Hébergement futur : une origine dédiée (le stockage local est partagé par toute page de la même origine).
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

`npm test` : 970 tests au 2026-10-06 (865 d'origine, 15 d'import des nouveaux fichiers, 89 du harness et de son interface, dont `tests/harness-horloge.test.js`, `tests/fournisseur-anthropic.test.js` et `tests/assistant-ia.test.js`). Une revue indépendante a relevé un point haut (application sans rejeu des contrôles) et six moyens, corrigés sauf la décision métier ci-dessus. Les tests du harness : `tests/harness-socle.test.js` (contrats, politiques, registre, contexte, trace, fournisseur, hygiène) et `tests/harness-parcours.test.js` (parcours complet, conflits, modèle scripté, refus, boucles, indisponibilité, magasin réel, export/import). Données `TEST_ONLY` uniquement ; outils : `tests/aide-harness.js`.

## Lecture hybride : préciser un élément (version 92)

Décision du 2026-10-07 « Ouverture réseau pour la lecture hybride des menus » : les règles lisent d'abord, sur l'appareil ; l'IA ne voit que le texte imprimé d'un élément resté « à préciser ».
- **Où** : bouton « Demander à l'IA » dans l'en-tête de la fiche d'un composant dont la catégorie est « à préciser » (`ui/vue-composant.js` : `boutonPrecisionIA`, `dialogPrecisionIA` ; `ui/vue-fiche.js`). Visible seulement si l'assistant est prêt (clé et activation, Réglages > Assistant IA).
- **Ce qui part** : `{ nom, menu, intitule }`, rien d'autre (`harness/precisions-ia.js` : `apercuEnvoi`). Le nom et l'intitulé passent par `contientMarqueurPersonnel` (`harness/contexte.js` : personnes, allergies, gluten, lactose, régime ; accents décomposés compris) ; un intitulé avec un marqueur ou un chiffre ne part pas (le nom part seul) ; un nom refusé interdit l'envoi. La clé reste dans l'en-tête HTTP, jamais dans le corps. Un aperçu lisible précède chaque envoi ; jamais automatique.
- **La réponse** : l'outil `proposer_categorie` (`ui/fournisseur-web.js` : `demanderPrecision`) rend une catégorie et une remarque ; `lirePropositionCategorie` n'accepte qu'une catégorie connue (jamais `a_preciser`) ; une remarque avec un chiffre, trop longue ou parlant d'une personne est écartée. Rien n'est appliqué sans « Accepter » ; un légume ou un féculent accepté va au poste (`champsApresProposition`). Fermer le panneau pendant l'attente annule la requête et ignore la réponse ; un composant modifié entre-temps n'est pas écrasé.
- **Apprentissage** : « Accepter » passe par `modifierComposant`, qui retient par nom et par menu (`etat.memoire`) ; `lirePlat(intitule, menu, { memoire })` lit ensuite ce mot comme appris (statut `lu`, origine `memoire`), l'aperçu de l'import aussi.
- **Non couvert** : photos, fiches de fonction, réservations (décisions à part).

## Lecture de la photo de la feuille (version 94)

Décision du 2026-10-07 « Lecture de la photo de la feuille de menus par l'IA » : la photo se scanne avec l'app, chaque vendredi pour la semaine suivante.
- **Où** : bloc « Photo du menu » de l'import (`ui/vue-import.js` : `blocPhoto`, `dialogLecturePhoto`) ; bouton « Lire la photo avec l'IA », visible si l'assistant est prêt et qu'une photo existe. Aperçu de la photo puis « Envoyer » / « Annuler », à chaque fois, jamais automatique.
- **Ce qui part** : l'image (celle déjà réduite à 1600 px, `photo.js` : `photoEnBase64`) et une phrase fixe, rien d'autre (`ui/fournisseur-web.js` : `construireCorpsPhoto`, outil `rendre_feuille`). Jamais la clé dans le corps, jamais d'état.
- **Ce que rend l'IA** : des lignes de texte, que `harness/lecture-photo-ia.js` (`lireLignesFeuille`) valide (80 lignes et 160 caractères au plus, caractères de contrôle retirés, `[illisible]` retiré et compté). Elles remplacent le champ « Texte de la feuille » (le message le dit si un texte était déjà collé) puis passent par la répartition existante : `analyserFeuille`, `repartirSurSemaine` (dates corrigées, semaine détectée), `lirePlat`. Rien n'est enregistré sans « Enregistrer la semaine ».
- **Annulation et erreurs** : fermer le panneau pendant l'attente annule la requête et ignore la réponse ; une erreur reste dans le panneau, ouvert, pour réessayer.
- **Hors périmètre** : annotations manuscrites (ignorées par consigne), fiches de fonction, réservations, allergies.

## Fiches de fonction en mode essai et retours d'essai (version 96)

Décision du 2026-10-07 « Lecture des fiches de fonction par l'IA, en mode essai ».
- **Où** : bouton « Lire une fiche avec l'IA (essai) » dans la zone Services du jour (`ui/vue-semaine.js`, `ui/lecture-fiche.js`), visible si l'assistant est prêt. Photo réduite en mémoire (`photo.js` : `reduireImage`, `blobEnBase64`), jamais stockée.
- **Ce qui part** : l'image et une phrase fixe (`fournisseur-web.js` : `construireCorpsFiche`, outil `rendre_fiche`), après aperçu et avertissement explicite (noms et allergies). Jamais la clé, jamais d'état.
- **Ce que rend l'IA** : propositions validées par `harness/lecture-fiche-ia.js` (7 champs ; `menuFixe`, `mode`, `repartition` ignorés ; date, service, couverts validés) qui préremplissent `dialogFiche(null, date, prefill, { doutes, surEnregistre })`. Rien n'est enregistré avant « Enregistrer ». Les allergies sont toujours signalées « à confirmer » (ou « rien n'a été lu »), jamais interprétées.
- **Retours d'essai** : `ui/retours-essai.js` (localStorage `sanji-retours-essai`, 30 entrées, 14 jours, hors état et sauvegarde) ; lecture de la feuille (menu) et de la fiche y notent « lu par l'IA » et « enregistré » ; Réglages > Apprentissage et essais copie un rapport texte (`domaine/retour-essai.js`) que la propriétaire transmet elle-même, avec un avertissement sur les noms et allergies.
- **À reconfirmer** après l'essai du 2026-10-08.
