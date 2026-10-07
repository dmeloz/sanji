# Conception technique — Copilote entremétier V1

Statut : choix techniques faits par Claude par délégation le 2026-10-02 (« crée l'app en toute autonomie »), en attente de validation de la propriétaire. Le plan `plan-final-copilote-entremetier-v1.md` fait foi pour le métier ; ce document ne fait foi que pour la technique. En cas de conflit, le plan gagne.

## 1. Choix techniques

- Application web installable (PWA), fichiers statiques, **aucune dépendance, aucun build, aucun `npm install`**. JavaScript moderne en modules ES, HTML, CSS.
- Tests : `node --test tests/` (Node 22). `package.json` minimal avec `"type": "module"`.
- Données : un seul document d'état JSON, persisté dans IndexedDB sur l'appareil. Aucun serveur, aucun compte, aucun envoi réseau.
- Hors ligne : service worker qui met en cache tous les fichiers de `app/`.
- Langue de l'interface et des identifiants de code : français. Identifiants techniques sans accent.
- Interdits : stock théorique, inventaire, calcul des portions de la carte, certification de conservation ou d'allergènes, données de restaurant préremplies, noms de plats ou grammages d'exemple dans le code de l'application.

## 2. Arborescence

```
sanji/
  CLAUDE.md
  package.json
  conception-technique-v1.md
  app/                         ← seul dossier servi et déployable
    index.html
    manifest.webmanifest
    sw.js
    icones/
    css/style.css
    js/main.js
    js/stockage.js             ← IndexedDB (navigateur seulement)
    js/domaine/                ← logique pure, sans DOM, testée sous Node
      dates.js  statuts.js  etat.js  analyse-menu.js  calcul.js
      planification.js  produits.js  allergenes.js  points.js  actions.js
    js/donnees/base-metier.js  ← généré depuis la base métier, jamais édité à la main
    js/ui/                     ← vues
  outils/extraire-base-metier.mjs
  tests/*.test.js
  tests/jeux/TEST_ONLY-*.js    ← jeux de test, jamais importés par app/
```

Règle absolue : rien sous `app/` n'importe quoi que ce soit hors de `app/`. Les modules de `js/domaine/` n'utilisent ni `window`, ni `document`, ni `indexedDB`, ni `Date.now()` implicite : la date du jour et l'horodatage sont toujours passés en argument (`aujourdhui` au format `AAAA-MM-JJ`, `h` au format ISO).

## 3. Vocabulaire fermé (`statuts.js`)

- `PROVENANCE` : `RESTAURANT_VALIDE`, `BASE_METIER_ESTIMATION`, `SAISI_SERVICE`, `CALCULE`, `INCONNU`. Libellés : « validé restaurant », « estimation base métier », « saisi au service », « calculé », « inconnu ».
- `CERTITUDE` (prévisions) : `estimee`, `provisoire`, `confirmee`.
- `ETAT_TACHE` : `a_preciser`, `a_planifier`, `a_faire`, `en_cours`, `fait`, `ecart`. Libellés : « à préciser », « à planifier », « à faire », « en cours », « fait », « écart à arbitrer ».
- `CRENEAU` : `avant_midi`, `apres_midi`, `avant_soir`. Libellés : « avant le service de midi », « après le service de midi », « avant le service du soir ».
- `ETAT_CRENEAU` : `libre`, `charge`, `indisponible`.
- `CHARGE` (d'une production) : `courte`, `moyenne`, `longue` (1, 2, 3 points).
- `TYPE_COMPOSANT` : `produit_simple`, `preparation_maison`, `generique`, `a_preciser`.
- `CATEGORIE` : `legume`, `feculent`, `proteine`, `sauce`, `autre`, `a_preciser`.
- `ROLE` : `plat_principal`, `garniture`, `sauce`, `autre`.
- `ETAPE` : `portionnement`, `cuisson`, `parage`.
- `UNITE` : `g`, `ml`, `piece`.
- `VERIF` : `a_verifier`, `suffisant`, `a_commander` ; l'état affiché « à revérifier » est dérivé.
- Le mot « provisoire » ne désigne que la répartition d'un groupe. Un calcul fondé sur une estimation non validée s'affiche « estimation à valider ».

## 4. Dates (`dates.js`)

Dates en chaînes `AAAA-MM-JJ`, calculées en UTC pour éviter les décalages. Fonctions : `ajouterJours(date, n)`, `jourSemaine(date)` (1 = lundi … 7 = dimanche), `lundiDe(date)`, `joursEntre(a, b)` (jours calendaires, dimanche compté), `estOuvert(date)` (faux le dimanche), `aMenuDuJour(date)` (lundi à vendredi), `creneauxDuJour(date)` (lundi, mardi : `avant_midi`, `apres_midi` ; mercredi à samedi : les trois ; dimanche : aucun), `libelleJour(date)`.

## 5. État (`etat.js`)

`etatInitial()` renvoie une base vide : aucun couvert, aucune recette, aucune production, aucun fournisseur.

```js
{
  application: 'sanji-entremetier', schema: 1,
  reglages: {
    semaineTypeConfirmee: false,
    semaineType: { 1:{avant_midi:'libre',apres_midi:'libre'}, 2:{…}, 3:{avant_midi,apres_midi,avant_soir}, 4:{…}, 5:{…}, 6:{…} },
    capaciteCreneau: null            // points de charge par créneau ; null = non renseignée, aucune alerte de capacité
  },
  jours: { [date]: {
    date,
    menus: { 1:{intitule:'', transcriptionValidee:false, composantsValides:false}, 2:{…} },
    previsions: { 1:{portions:null, h:null}, 2:{portions:null, h:null} },   // hors groupes
    creneaux: { avant_midi:null, apres_midi:null, avant_soir:null },        // null = semaine type
    ventes: { 1:null, 2:null, h:null }
  } },
  fiches: { [id]: {
    id, numero:'', date, service:'midi'|'soir', horaire:'', couverts:0,
    mode:'menu_fixe'|'choix_libre'|'hors_menu', menuFixe:1|2|null,
    repartition:{1:0,2:0}, statutRepartition:'provisoire'|'confirmee',
    allergies:'', remarques:'', statut:'active'|'annulee',
    version:1, historique:[{version,h,resume}], adaptations:[{h,texte}]
  } },
  composants: { [id]: {
    id, date, menu:1|2, nom, categorie, attribue:true|false, valide:false,
    type, role:null, produitNom:'',
    grammage:{valeur:null, unite:'g', statut:'INCONNU', source:''},        // quantité servie par portion
    etapes:[{etape, coefficient, statut, source:''}],                      // coefficient = sortie / entrée
    recetteId:null, recetteVersion:null, charge:null,
    allergenes:{statut:'a_confirmer'|'valide', liste:[], h:null},
    apresService:{surplus:null, rebut:null, note:''}
  } },
  productions: { [id]: {
    id, composantId, dateService, genre:'principale'|'complement'|'preparatoire', libelle:'',
    jourDecide:null, creneauDecide:null, etat:'a_faire'|'en_cours'|'fait',
    cibleAuDemarrage:null, quantiteReelle:null, unite:null, hFait:null, instantane:null,
    decisionEcart:null   // {type:'complement'|'ajustement'|'aucune', cible, h}
  } },
  regles: { [id]: { id, nom, cle, avanceMaxJours:null, limiteUtilisationJours:null, valideLe:null, note:'' } },
  recettes: { [id]: { id, nom, version:1, valide:false, rendement:{valeur:null, unite:'g'},
                      ingredients:[{nom, quantite, unite, fournisseurId:null}], allergenes:[], historique:[] } },
  fournisseurs: { [id]: { id, nom, delaiJours:null, heureLimite:'', note:'' } },
  memoire: { [cle]: { nom, attribue, type, categorie, charge, parRole:{ [role]:{grammage} }, etapes:{ [etape]:{coefficient,statut,source} } } },
  produits: { [lundi + '|' + cle + '|' + unite]: { statut:'a_verifier', quantiteVerifiee:null, besoinAuControle:null,
                      quantiteAcheter:null, conditionnement:'', fournisseurId:null, commandeLe:null } },
  journal: [ {h, action, detail} ]   // 2000 dernières entrées
}
```

- `normaliser(nom)` : minuscules, sans accents, espaces réduits. Sert de `cle`.
- `exporter(etat, h)` renvoie une chaîne JSON `{application, schema, exporteLe, etat}`.
- `importer(texte)` valide `application` et `schema`, **refuse tout fichier portant l'étiquette `TEST_ONLY`** (propriété `etiquette` à n'importe quel niveau), complète les champs absents, renvoie l'état ou lève une erreur en français.
- Les identifiants sont générés par `nouvelId(prefixe)` (compteur + aléa court), sans dépendre de l'heure.

## 6. Analyse d'un intitulé (`analyse-menu.js`)

`proposerComposants(intitule, menu, memoire)` découpe l'intitulé sur `,`, ` et `, ` & `, ` avec `, ` accompagné de `, ` sur lit de ` et renvoie `[{nom, categorie, attribue, type:'a_preciser'}]`, jamais validés.
- Catégorie proposée par un petit lexique de mots courants de cuisine (féculents, légumes, protéines, sauces) ; inconnu → `a_preciser`. Le lexique sert à classer, pas à chiffrer : aucun grammage.
- Menu 1 : tout est proposé `attribue: true`. Menu 2 : `attribue: true` seulement pour `legume` et `feculent` ; protéine, sauce et inconnu restent non attribués.
- Si `memoire[cle]` existe, son `attribue` et sa `categorie` priment (exception mémorisée) et la proposition porte `depuisMemoire: true`.

## 7. Calcul (`calcul.js`)

`portionsMenu(etat, date, menu)` → `{ total, prevision, groupesConfirmes, groupesProvisoires, details:[{source, portions, certitude}] }`.
- `prevision` = prévision hors groupes (0 si `null`, avec `previsionManquante: true`).
- Une fiche compte seulement si `statut === 'active'`, `service === 'midi'`, `aMenuDuJour(date)` et `mode !== 'hors_menu'`. Menu fixé : `couverts` sur `menuFixe`, certitude `confirmee`. Choix libre : `repartition[menu]`, certitude selon `statutRepartition`. Jamais de double comptage : le calcul relit toujours l'état courant.

`calculerComposant(etat, composantId)` → 
```js
{ portions, unite, quantiteServie, etapes:[{etape, coefficient, statut, quantiteAvant}],
  brut, quantiteTravail, uniteTravail, libelleQuantite,
  statut:'CALCULE'|'INCONNU', aValider, aMesurer, dependances:[{parametre, valeur, statut}],
  formule, manquants:[…], ingredients:[{nom, quantite, unite}]|null }
```
- `quantiteServie = portions.total × grammage.valeur`.
- Chaîne dans l'ordre fixe portionnement → cuisson → parage, **uniquement les étapes présentes** : à chaque étape `quantiteAvant = quantiteCourante / coefficient`. Un gain d'absorption est un coefficient > 1. Une même étape ne peut figurer qu'une fois (refusé par `actions.js`).
- `produit_simple` : `quantiteTravail = brut`, libellé « brut à prévoir ».
- `preparation_maison` : `quantiteTravail` = quantité finie à produire (servie ÷ portionnement s'il existe), libellé « quantité finie à produire ». Les étapes cuisson et parage ne s'appliquent pas à la préparation elle-même. Si une recette validée est liée : `ingredients` = `quantiteTravail / rendement.valeur × quantite` ; sinon `ingredients: null` et `manquants` contient « recette ».
- `generique` : pas de grammage ; `quantiteTravail = portions.total`, `uniteTravail = 'portion'`, libellé « portions, composition à définir ».
- `a_preciser` ou grammage absent (hors générique) : `statut: 'INCONNU'`, `manquants` renseigné, aucune quantité inventée.
- `aValider` : vrai si le grammage ou une étape a le statut `BASE_METIER_ESTIMATION` ou `INCONNU`, ou si la recette liée n'est pas validée.
- `aMesurer` : vrai si une étape `BASE_METIER_ESTIMATION` a `|1 − coefficient| ≥ 0,15`.
- `formule` : texte lisible, par exemple « 40 portions × 150 g = 6 000 g servis ; ÷ 0,95 (portionnement) = 6 316 g ; ÷ 2,50 (cuisson, gain) = 2 526 g bruts ».
- Arrondis : calcul en flottant, affichage arrondi à l'unité (g, ml) ou à la pièce supérieure.

## 8. Planification (`planification.js`)

- `etatCreneau(etat, date, creneau)` : valeur du jour, sinon semaine type.
- `cibleProduction(etat, productionId)` : pour `principale`, la `quantiteTravail` du composant ; pour `complement`, `max(0, quantiteTravail − somme des réels des autres productions faites du composant)` ; pour `preparatoire`, `null`.
- `etatTache(etat, productionId)` (dérivé, dans cet ordre) : `a_preciser` si le calcul du composant est `INCONNU` ; `ecart` si `fait` et `ecartProduction(...) !== 0` sans décision pour la cible actuelle, ou `en_cours` avec `cibleAuDemarrage` différente de la cible actuelle ; sinon `fait`, `en_cours`, `a_planifier` (pas de `jourDecide`), `a_faire`.
- `ecartProduction(etat, composantId)` = `quantiteTravail − somme des réels faits` (arrondi à l'unité). Une `decisionEcart` n'éteint l'écart que tant que `decisionEcart.cible` égale la cible actuelle.
- `evaluerAvance(dateProduction, dateService, regle)` → `{ jours, exception, autorisee, conservation:'sans_objet'|'validee'|'a_confirmer'|'depassee', couvre, alertes:[…] }` :
  - `jours = joursEntre(dateProduction, dateService)` ; négatif → non autorisé ; dimanche → non autorisé (aucune tâche).
  - 0 jour : autorisé, conservation sans objet, `couvre: true`.
  - 1 ou 2 jours : autorisé. Conservation `validee` si `limiteUtilisationJours >= jours`, `depassee` si elle est plus petite, `a_confirmer` si absente. `couvre` vrai sauf `depassee`.
  - plus de 2 jours : `exception: true`. Autorisé seulement si la règle a `avanceMaxJours >= jours` **et** `limiteUtilisationJours >= jours`. Sinon `autorisee: false`, `couvre: false`, alerte « hors règle ».
- `regleDe(etat, composant)` : règle dont la `cle` égale `normaliser(composant.nom)`.
- `suggererCreneau(etat, productionId)` : par défaut le jour du service, `avant_midi`. Si ce créneau est `charge` ou `indisponible`, ou en surcharge de capacité, remonter créneau par créneau (au plus loin : 2 jours, ou `avanceMaxJours` de la règle) et prendre le premier créneau `libre` dont l'avance est `autorisee`. Jamais un créneau `charge` ou `indisponible`, jamais le dimanche. Renvoie `{date, creneau, evaluation}` ou `null`.
- `avancesPossibles(etat, aujourdhui)` : productions non faites dont le service est dans les 4 jours calendaires suivants et qui ne sont pas décidées pour un autre jour, chacune avec `evaluerAvance(aujourdhui, dateService, regle)` et le premier créneau `libre` du jour parmi `apres_midi`, `avant_soir` (ou `null`).
- `chargeCreneau(etat, date, creneau)` → `{ etatCreneau, courtes, moyennes, longues, nonEstimees, points, capacite, surcharge, alertes }`. `surcharge` seulement si `capacite` est renseignée. Alerte si une production est décidée sur un créneau `charge` ou `indisponible`. Ne jamais exprimer la charge en minutes.
- `feuilleDuJour(etat, date)` → `{ aFaire:[…par créneau], dejaPret:[…], decisions:[…], aAvancer:[…], revueMiSemaine:boolean }`. `dejaPret` : productions faites dont le service est ce jour ou plus tard, avec leur évaluation d'avance (`couvre` faux → affiché « non couvert »). Une tâche décidée le samedi pour un service du lundi figure dans `aFaire` du samedi et dans la feuille du lundi (`dejaPret` si faite, sinon rubrique `attendus` : « prévu samedi »). `revueMiSemaine` : vrai le mardi.

## 9. Produits et commande (`produits.js`)

- `besoinsProduits(etat, lundi)` : pour les services du lundi au samedi de cette semaine, lignes agrégées par `(normaliser(produit), unite)` à partir des composants attribués et validés : `produit_simple` → `brut` sous `produitNom || nom` ; `preparation_maison` avec recette validée → ses ingrédients. Chaque ligne : `{cle, nom, unite, besoinBrut, aValider, contributions:[{composantId, date, quantite}], premiereUtilisation}`. Les composants non chiffrables sont renvoyés à part (`nonChiffrables`), sans quantité inventée.
- `suiviProduit(etat, lundi, ligne)` → `{ statutAffiche:'a_verifier'|'suffisant'|'a_commander'|'a_reverifier', quantiteVerifiee, proposeeACommander, quantiteAcheter, … }`. `a_reverifier` si le statut enregistré n'est pas `a_verifier` et que `besoinAuControle !== besoinBrut` (arrondi). `proposeeACommander = max(0, besoinBrut − quantiteVerifiee)`. `quantiteAcheter` n'est **jamais** remplie automatiquement.
- `echeanceCommande(ligne, fournisseur, aujourdhui)` → `{ statut:'a_renseigner'|'ok'|'aujourdhui'|'depassee', dateLimite }`, avec `dateLimite = premiereUtilisation − delaiJours`.

## 10. Allergènes et points à confirmer

- `allergenes.js` : `alertesAllergenes(etat, date)` → pour chaque fiche active du jour ayant un texte d'allergie : `{ficheId, numero, service, allergies, composants:[{composantId, nom, statut, liste}], adaptations}`. **Aucune fonction ne renvoie « compatible ».**
- `points.js` : `pointsAConfirmer(etat, date)` → liste `{type, texte, composantId?, ficheId?}` : transcription non validée, composants non validés, composant à préciser, prévision manquante un jour à menu, répartition provisoire ou dont la somme diffère des couverts, conservation à confirmer, avance hors règle, allergènes à confirmer, écart à arbitrer, créneau chargé portant une production. `pointsGlobaux(etat)` : semaine type non confirmée.
- `points.js` : `repereVentes(etat, date, menu)` → au plus 3 ventes saisies du même jour de semaine, les plus récentes d'abord.

## 11. Actions (`actions.js`)

Fonctions qui modifient l'état reçu et ajoutent une ligne au journal. Chacune prend `h` (horodatage ISO). Liste minimale : `definirMenu`, `validerTranscription`, `genererComposants` (remplace les composants non validés du menu par la proposition), `ajouterComposant`, `modifierComposant`, `validerComposant`, `supprimerComposant`, `validerComposantsMenu`, `definirPrevision`, `creerFiche`, `modifierFiche` (incrémente `version`, ajoute à `historique`), `annulerFiche`, `confirmerRepartition`, `ajouterAdaptation`, `definirCreneau`, `definirSemaineType`, `confirmerSemaineType`, `definirCapacite`, `planifier` (jour + créneau, autorisé même hors règle), `demarrer`, `marquerFait` (réel, instantané des paramètres et de la version de recette), `corrigerReel`, `reporter`, `deciderEcart` (`complement` crée une production `complement`), `ajouterPreparatoire`, `supprimerProduction`, `enregistrerPesee` (avant, après → coefficient `RESTAURANT_VALIDE`, source « pesée du … »), `memoriser` (copie les paramètres validés du composant dans `memoire`), `reprendreMemoire`, `definirRegle`, `supprimerRegle`, `creerRecette`, `modifierRecette` (nouvelle version, l'ancienne dans `historique`), `validerRecette`, `definirFournisseur`, `supprimerFournisseur`, `controlerProduit` (statut, quantité vérifiée, mémorise `besoinAuControle`), `definirAchat`, `marquerCommande`, `saisirVentes`, `saisirApresService`.

Invariants :
- `assurerProductions(etat)` est appelé à la fin de chaque action : tout composant attribué **et** validé a exactement une production `principale` ; un composant non attribué ou supprimé perd ses productions non faites.
- Une modification de prévision, de fiche, de recette ou de composant ne modifie jamais `quantiteReelle` ni `instantane`.
- `marquerFait` sans quantité utilise la cible ; `corrigerReel` la remplace ensuite.

## 12. Interface

Mobile d'abord (largeur 375 px), utilisable à une main, gros boutons, texte ≥ 16 px, thème clair et sombre. Barre d'onglets en bas : **Semaine**, **Jour**, **Produits**, **Réglages**. Toute saisie passe par un panneau (`<dialog>`) avec « Enregistrer » : pas de saisie en ligne qui se re-dessine.

- **Semaine (tableau blanc)** : lundi à samedi, dimanche « fermé ». Par jour : intitulés originaux des menus 1 et 2 en premier, puis prévisions (hors groupes + groupes, avec certitude), fiches de fonction (touche = détail : personnes, horaire, choix confirmés ou non, allergies, remarques), nombre de points à confirmer. Pas de liste de tâches. Service du soir et samedi visibles comme occupation. Vendredi et samedi : la semaine suivante s'affiche sous la semaine en cours. Boutons semaine précédente / suivante.
- **Détail d'un jour** (depuis Semaine) : menus (photo facultative comme aide à la transcription, saisie de l'intitulé, validation de la transcription, proposition puis validation des composants), prévisions avec repère des ventes, fiches, état des créneaux, après service.
- **Jour (feuille quotidienne)** : navigation par date, rubriques « À faire aujourd'hui » (par créneau, quantité, unité, service de destination), « Déjà prêt », « Décisions nécessaires », « À avancer si possible ». Une touche ouvre le composant : calcul, formule, provenance, recette. Actions courtes : préciser, planifier, fait, corriger, reporter, décider.
- **Produits** : par semaine, lignes besoin brut / vérifié disponible / proposé à commander / à acheter, statut, fournisseur, échéance. Mention « aucun approvisionnement garanti ».
- **Réglages** : semaine type, capacité, règles de préparation, recettes, fournisseurs, mémoire maison, journal, export, restauration.
- Photo de menu : stockée à part dans IndexedDB, non exportée. Pas d'OCR intégré : le champ de saisie accepte la fonction « Scanner du texte » d'iOS, et la transcription est toujours à valider.

## 13. Écarts constatés à la construction (2026-10-02)

- Les signatures réelles de `app/js/domaine/` font foi. Dans `actions.js`, `h` est toujours le dernier argument.
- Tests : `node --test "tests/*.test.js"` (Node 22 refuse un répertoire en argument).
- `points.js` : une prévision manquante n'est signalée que si l'intitulé du menu est saisi, pour ne pas faire de bruit sur les jours vides.
- `proposeeACommander` reste vide tant qu'aucune quantité vérifiée n'est saisie.
- Une avance qui ne « couvre » pas (hors règle ou limite dépassée) n'est pas comptée dans la couverture du besoin.
- Une photo de menu par jour, pas par menu.
- Gestes absents du domaine, donc de l'interface : supprimer une recette, supprimer une fiche (on l'annule), supprimer une référence maison, revenir sur « semaine type confirmée ».
- Modules ajoutés : `domaine/base.js`, `magasin.js`, `version.js`, `ui/*`.

## 14. Interface V2 — tableau de bord et identité « inox et feutre » (2026-10-02)

Statut : direction proposée par Claude à la demande de la propriétaire (« un dashboard, puis les pages »), en attente de validation après essai.

### Constats de la veille 2026 retenus
- Trois à cinq onglets en bas d'écran, cibles tactiles d'au moins 44 points (recommandations Apple).
- Cartes de synthèse hiérarchisées, une action principale par écran, détail accessible en une touche.
- L'effet de verre translucide d'iOS 26 est critiqué pour sa lisibilité (Nielsen Norman Group) : **surfaces opaques uniquement**, aucun flou, aucune transparence sous du texte.
- Un statut ne se lit jamais par la couleur seule : forme ou pictogramme + texte + couleur.
- Contrastes WCAG 2.2 : 4,5:1 pour le texte, 3:1 pour les éléments d'interface. Mouvement réduit respecté.
- Une application installée sur l'écran d'accueil d'iOS n'est pas soumise à l'effacement après sept jours sans visite.

### Identité
Le vocabulaire visuel vient du poste : l'inox, le tableau blanc, les feutres, le ruban adhésif d'étiquetage, les bacs de mise en place. Pas de fond crème, pas de dégradé, pas d'ombre décorative, pas d'étiquette en capitales, pas de chaîne d'informations séparées par des points médians dans les nouveaux écrans.

Couleurs (clair / sombre) :
| Rôle | Variable | Clair | Sombre |
|---|---|---|---|
| Fond inox | `--fond` | `#e9edee` | `#0f1418` |
| Surface tableau blanc | `--carte` | `#ffffff` | `#182027` |
| Surface secondaire | `--carte-2` | `#f3f5f6` | `#202a33` |
| Encre | `--texte` | `#17212b` | `#e8eef2` |
| Encre douce | `--texte-doux` | `#51606d` | `#a3b1bc` |
| Trait | `--bordure` | `#c9d1d6` | `#2f3b46` |
| Feutre bleu (action) | `--bleu` | `#1b4fb8` | `#2f66d6` |
| Bleu : fond / texte | `--bleu-fond` / `--bleu-texte` | `#e3ebfb` / `#173f93` | `#16284a` / `#9dbcff` |
| Feutre vert (prêt) | `--vert-fond` / `--vert-texte` | `#dff1e6` / `#145a36` | `#173326` / `#7fd3a4` |
| Ruban (à confirmer) | `--ambre` ; `--ambre-fond` / `--ambre-texte` | `#f0b429` ; `#fdf0c8` / `#6b4a00` | `#f0b429` ; `#3d3210` / `#f4cf6b` |
| Feutre rouge (alerte) | `--rouge` ; `--rouge-fond` / `--rouge-texte` | `#c2321f` ; `#fbe1dc` / `#8e2012` | `#e0604d` ; `#47201a` / `#ff9d8e` |

Typographie : aucune police téléchargée. Texte courant en police système (`system-ui`). Titres et chiffres en police arrondie du système (`ui-rounded`, repli `system-ui`), graisse 700 à 800, chiffres tabulaires : l'effet d'un chiffre tracé au feutre, lisible de loin. Échelle : 15, 17, 21, 26, 34 px ; jamais moins de 15 px.

Formes : cartes à rayon 14 px avec un trait de 1 px, sans ombre. Pastilles en pilule. Bacs de la réglette à rayon 7 px. Boutons de 48 px de haut.

### Élément signature : la réglette de mise en place
Une rangée de « bacs », un par tâche du service du jour, comme les bacs alignés sur le poste. Chaque bac est un lien de 44 px au moins vers son composant, avec un libellé accessible. États, lisibles par la forme :
- prêt : bac plein, coche ;
- en cours : bac à moitié plein ;
- à faire : bac vide, contour ;
- à décider (à préciser, à planifier, écart) : contour rouge, point d'exclamation ;
- fait mais non couvert (avance hors règle ou limite dépassée) : bac hachuré.
Sous la réglette, une phrase compte chaque état avec le même pictogramme : elle sert de légende.

### Tableau de bord (onglet Accueil, écran par défaut)
Ordre sur iPhone : date et service ; point global éventuel (semaine type à confirmer) ; mise en place du service avec l'action principale « Ouvrir la feuille du jour » ; menus du jour avec portions ; créneaux du jour (état + charge en blocs : courte 1, moyenne 2, longue 3, jamais de minutes) ; à décider ; à avancer ; fiches et allergies du jour ; commandes de la semaine ; la semaine en bandeau de six jours (et la semaine suivante le vendredi et le samedi). Sur iPad : deux colonnes, la mise en place sur toute la largeur.

Les données viennent d'une seule fonction pure et testée, `tableauDeBord(etat, aujourdhui)` dans `app/js/domaine/tableau-bord.js`. La vue ne calcule rien.

### Onglets
Cinq onglets : Accueil, Semaine, Jour, Produits, Réglages. Barre opaque, pictogrammes en SVG dessinés à la main dans le code, onglet actif marqué par une pilule de fond et un libellé en gras.

### État au 2026-10-02
- Tableau de bord construit et vérifié à l'écran : iPhone clair et sombre, iPad clair, base vide et base d'essai. 220 tests passent.
- La section 12 est dépassée sur un point : il y a cinq onglets, l'accueil est l'écran par défaut.
- Sur l'accueil, menus, mise en place, fiches et commandes se rapportent au jour de service (le lundi si on est dimanche) ; créneaux, décisions et avances se rapportent à aujourd'hui.
- Un bac « non couvert » n'apparaît qu'après arbitrage de l'écart : avant, la tâche est « à décider ».
- Lot suivant, non fait : refonte page par page (Jour, Semaine, Détail du jour, Composant, Produits, Réglages) : hiérarchie, suppression des points médians, pastilles cohérentes avec la réglette.

## 15. Essai avec un vrai menu de la semaine (2026-10-02)

Essai fait avec le menu imprimé du 5 au 9 octobre 2026, fourni en photo par la propriétaire. Les intitulés sont des données de l'application, pas de ce document.

Défauts trouvés et corrigés dans `analyse-menu.js` :
- « et », « & » et « avec » ne séparent plus les composants : dans un menu réel ils relient les éléments d'un même plat. Seules la virgule, « accompagné de » et « sur lit de » séparent.
- Classement : le premier mot reconnu décide ; à position égale, l'expression la plus longue l'emporte ; un mot de forme suivi de « de » (purée, gratin, tagliatelle…) laisse décider le produit nommé ensuite.
- Lexique complété : formes de pâtes, garnitures de pomme de terre nommées « pomme … », bettes, gibier, poissons de lac.
- Tableau de bord : plus de grand « 0 » quand aucune prévision n'est saisie.

Constats non traités, à décider :
- Le vendredi et le samedi, le tableau de bord ne montre pas les menus de lundi et mardi, alors que c'est le moment de les avancer.
- Les pictogrammes imprimés (végétarien, sans gluten) n'ont pas de champ dans l'application.
- Les annotations manuscrites sont ignorées, comme le veut le plan.
- L'import de la photo dans l'application n'a pas été essayé.

## 16. Lot « tableau blanc et savoir culinaire » (2026-10-02)

Décisions de la propriétaire (2026-10-02), inscrites dans le plan : l'application sait seule ce qui revient à l'entremétier et ne demande une validation que par exception ; elle a un savoir culinaire tiré de la base métier ; l'accueil est un tableau blanc de cuisine professionnelle qui montre les bonnes informations selon le contexte ; la semaine prochaine apparaît sur l'accueil. Le problème principal constaté par la propriétaire est la présentation des informations.

Ce lot remplace la section 14 pour l'accueil : la « réglette de bacs » disparaît au profit du tableau blanc. La palette « inox et feutre » reste.

### 16.1 Domaine

**Plus de validation manuelle.**
- `definirMenu` : l'intitulé enregistré vaut transcription validée (`transcriptionValidee: true`). Il régénère les composants du menu **en fusionnant** : un composant dont le nom normalisé est inchangé est conservé tel quel (avec ses réglages et ses productions) ; un composant disparu de l'intitulé est supprimé, sauf s'il a une production faite ; un nouveau composant est créé. `composantsValides` passe à vrai.
- Tout composant créé par l'analyse est `valide: true` d'emblée. `validerTranscription`, `validerComposant`, `validerComposantsMenu`, `genererComposants` restent exportés pour compatibilité mais ne sont plus nécessaires au parcours ; l'interface ne les appelle plus.
- Points à confirmer : les types `transcription` et `composants` disparaissent. Nouveaux types : `composant_inconnu` (catégorie `a_preciser` : « à classer : au poste ou non ? ») et `grammage` (composant attribué sans grammage, hors générique). `composant_a_preciser` reste pour un type non déterminé.

**Savoir culinaire : `app/js/domaine/savoir.js`.**
- Une table `FAMILLES` : pour chaque produit de base connu, `{cle, libelle, categorie, mots:[…], etapes:[{etape, produitBase}]}`. `mots` sont les mots ou expressions du menu qui désignent ce produit (les formes de pâtes désignent toutes la famille « pâtes sèches » ; « pomme mousseline », « pomme au beurre », « pommes vapeur »… désignent « pommes de terre » ; « risotto » désigne « riz »). `produitBase` est le libellé exact d'une ligne de `BASE_METIER` pour l'étape (parage ou cuisson). **Aucun chiffre dans cette table** : les coefficients viennent uniquement de `BASE_METIER`.
- N'associer une étape que si elle s'applique sans condition. Exemples attendus : pâtes, riz, polenta, quinoa, semoule, légumineuses → gain de cuisson ; pommes de terre, carottes, endives, choux, blettes, poireaux, fenouil, courgettes… → perte de parage. Une perte conditionnelle (tomates « pelées à vif, épépinées ») n'est pas appliquée d'office.
- Chaque famille porte un `groupe` (`cereales`, `pommes_de_terre`, `legumineuses`, `legumes`) et `GROUPES` donne leurs libellés. Les repères de portion de la base peuvent être donnés par famille ou par groupe : `grammageEffectif` cherche la ligne de la famille, puis celle du groupe (décision de la propriétaire, 2026-10-02 : repères par grande catégorie, tirés des nutritionnistes et de la restauration collective).
- `familleDe(nom)` → famille ou `null` (même règle de lecture que `categoriePropose` : premier mot reconnu, expression la plus longue, mot de forme suivi de « de »). `analyse-menu.js` s'appuie sur `savoir.js` pour ne garder qu'un seul lexique.
- `appliquerSavoir(etat, composant)` remplit, **seulement si le champ est vide** : `famille` (nouveau champ du composant, clé de la famille ou `null`), `produitNom` (libellé de la famille), `role` (menu 1 → `plat_principal` ; menu 2 → `garniture`, ou `sauce` pour une sauce), `type` (`produit_simple` si une famille est reconnue ; `generique` si la catégorie est connue sans famille ; sinon `a_preciser`), `etapes` (une étape par ligne de base trouvée, coefficient = milieu de `coefMin` et `coefMax`, statut `BASE_METIER_ESTIMATION`, source « base métier : <texte de la fourchette> »). **Le grammage n'est pas copié dans le composant** : il est résolu au moment du calcul (voir « Portion effective »).
- **Portion effective** : `grammageEffectif(etat, composant)` renvoie `{valeur, unite, etat, statut, source, origine}` ou `null`, dans cet ordre de priorité : (1) la correction faite sur le plat lui-même (`composant.grammage.valeur` renseigné, `origine: 'plat'`) ; (2) la référence mémorisée pour ce nom et ce rôle par le geste explicite « mémoriser comme référence maison » (`origine: 'reference'`) ; (3) le **standard maison** de la famille et du rôle (`RESTAURANT_VALIDE`, source « standard maison », `origine: 'standard'`) ; (4) le repère de portion de la base métier (`BASE_METIER_ESTIMATION`, milieu de la fourchette, `origine: 'base'`) ; sinon `null` et point `grammage`. `calculerComposant` et tous les calculs utilisent cette fonction : changer un standard recalcule aussitôt tous les plats non corrigés et non encore faits. Une production faite garde son instantané. **Aucun grammage n'est inventé.**
- Une commande ne part jamais d'une estimation : règle inchangée (`estimationAValider`).

**Mémoire automatique : l'attribution seulement.**
- Quand le chef change « au poste / pas au poste » ou la catégorie d'un composant, ce choix est mémorisé par nom, sans geste supplémentaire, et réappliqué à la saisie suivante.
- **Une correction de portion, de type ou d'étape faite sur un plat reste sur ce plat** : elle ne modifie ni le standard maison, ni la base, ni les autres plats, et elle n'est pas mémorisée d'office (décision de la propriétaire, 2026-10-02 : « une correction sur un plat ne change pas mon standard »). Le geste explicite « mémoriser comme référence maison » (`memoriser`) reste disponible pour ce nom précis.
- Il n'y a pas de `memoireFamilles`.

**Standards maison (décision de la propriétaire, 2026-10-02).**
- Nouvel état : `etat.standards = { [cle de famille]: { [role]: {valeur, unite, etat, h} } }`, vide dans une base neuve, complété par `importer` s'il manque.
- Actions : `definirStandard(etat, cleFamille, role, {valeur, unite, etat}, h)` et `supprimerStandard(etat, cleFamille, role, h)`. Refus en français si la famille ou le rôle est inconnu, si la valeur n'est pas strictement positive, si l'unité ou l'état du poids est invalide.
- Le standard maison passe avant l'estimation de la base. Il n'est modifié que par ces deux actions (écran Réglages), jamais par une correction sur un plat.
- `lignesStandards(etat)` (dans `savoir.js`) renvoie, pour l'écran Réglages, une ligne par famille et par rôle utile (`plat_principal`, `garniture`) : `{cleFamille, libelle, categorie, role, standard|null, repereBase|null}`.
- **Un seul appareil pour l'instant** : aucune synchronisation. Les standards font partie de l'état exporté ; un test vérifie qu'ils survivent à un export suivi d'une restauration (`exporter` puis `importer`), ainsi que le calcul qui en dépend.

**État du poids (décision de la propriétaire, 2026-10-02).**
- Nouvelle énumération `ETAT_POIDS` dans `statuts.js` : `sec`, `cru_net`, `cuit` (libellés « sec », « cru net », « cuit »).
- Toute portion porte son état : `composant.grammage.etat`, `standards[...][...].etat`, `PORTIONS_BASE[].etat`. Une portion sans état connu est lue `cuit` pour les données déjà enregistrées (c'était le sens de « quantité servie ») ; `importer` complète le champ.
- **Le calcul part du bon état, pour ne jamais convertir deux fois** :
  - `cuit` (poids servi) : la chaîne remonte toutes les étapes présentes, portionnement puis cuisson puis parage ;
  - `cru_net` (cru, déjà paré) et `sec` (produit sec) : la quantité obtenue est déjà celle d'avant cuisson. **Ni le portionnement ni la cuisson ne sont appliqués** ; seul le parage, s'il existe, mène au brut.
- Quand une étape de cuisson existe mais n'est pas appliquée, `calculerComposant` renvoie en plus `quantiteCuiteEstimee` (quantité × coefficient de cuisson), à titre d'information seulement, et la formule le dit en clair (« portion exprimée en poids sec : le gain de cuisson n'est pas appliqué »). `etapes[]` porte `appliquee: true|false`.
- Une préparation maison garde le sens « quantité finie par portion » : son état est toujours `cuit`.

**Repères de portion de la base métier.**
- `outils/extraire-base-metier.mjs` lit aussi, **si elle existe**, la table d'une sous-section dont le titre commence par « ### 11.4 Repères de portion » : colonnes repérées par leur titre, dans n'importe quel ordre : `Catégorie`, `Produit`, `Rôle`, `État` (sec, cru net ou cuit), `Portion` (« 100–120 g » ou « 60 g »), `Sources`, `Notes`. Il exporte `PORTIONS_BASE = [{produit, role, etat, min, max, unite, texte, sources, note}]` (liste vide si la section est absente : c'est le cas aujourd'hui). Une ligne sans portion, sans rôle ou sans état reconnu est ignorée et comptée dans un avertissement, jamais devinée. `grammageEffectif` prend le milieu de la fourchette et reprend l'état de la ligne.

**Saisie de la semaine.**
- `analyserFeuille(texte)` (pur, dans un nouveau module `app/js/domaine/feuille.js`) : découpe un texte collé en lignes ; écarte les lignes vides, les prix (`19.-`, `24.–`, `CHF …`), le titre de la feuille et les annotations d'un ou deux caractères ; reconnaît les lignes de date (« lundi 05 octobre », sans tenir compte de la casse ni de l'année) ; les lignes restantes, dans l'ordre, se répartissent deux par deux sur les jours reconnus dans l'ordre (première = menu 1, seconde = menu 2), que la date soit écrite avant, entre ou après les deux lignes. Renvoie `{jours:[{jourSemaine, numero, menu1, menu2}], ignorees:[…], avertissements:[…]}`. Nombre de lignes incohérent → avertissement, rien de deviné.
- `saisirMenusSemaine(etat, lundi, saisie, h)` où `saisie = {[date]: {menu1, menu2, prevision1, prevision2}}` : pour chaque jour du lundi au vendredi, enregistre les intitulés fournis (chaîne vide = ne rien changer ; `null` = effacer) et les prévisions fournies (nombre ou `null` = ne rien changer). Une seule ligne de journal.

**Tableau blanc : `app/js/domaine/tableau-blanc.js`** (remplace `tableau-bord.js`, à supprimer avec ses tests une fois les nouveaux en place).
`tableauBlanc(etat, aujourdhui, lundiAffiche?)` renvoie :
- `contexte` : `{type, titre, lignes, action}` avec `type` parmi :
  - `service` : aujourd'hui a des tâches de service non faites → titre « Avant le service de midi », lignes = tâches à faire ou en cours du service du jour avec quantité formatée, puis les décisions ;
  - `apres_service` : toutes les tâches du service du jour sont faites (ou il n'y en a pas un jour à menu, hors vendredi) → « Après le service », lignes = `aAvancer` du jour ;
  - `semaine_prochaine` : vendredi une fois le service prêt, samedi, dimanche → « Semaine prochaine », lignes = avances possibles pour lundi et mardi ; si la semaine suivante n'a aucun menu, action « Saisir les menus de la semaine » ;
  - `vide` : aucun menu sur la semaine affichée → action « Saisir les menus de la semaine ».
  Le mardi, le contexte `apres_service` ajoute la ligne « revue de mi-semaine ». Chaque ligne : `{texte, quantite, genre:'tache'|'decision'|'avance'|'info', etat, lien}`.
- `lundi` : semaine affichée. Par défaut la semaine d'aujourd'hui du lundi au jeudi et le vendredi tant que le service n'est pas prêt ; la semaine suivante dans le contexte `semaine_prochaine`. `lundiAffiche` force une semaine (navigation).
- `jours` : six jours (lundi à samedi), chacun `{date, estAujourdhui, aMenu, menus:[{menu, intitule, portions, morceaux:[{texte, auPoste, composantId}]}], groupes:[{id, numero, service, couverts, horaire, aAllergies, certitude}], miseEnPlace:[{productionId, composantId, nom, quantite, etat, symbole}], soir:boolean, nbPoints}`. `morceaux` découpe l'intitulé du menu en ses composants, dans l'ordre, pour afficher ce qui est au poste et ce qui ne l'est pas. `symbole` : `fait`, `en_cours`, `a_faire`, `a_decider`, `non_couvert`.
- `pointsGlobaux`, `semainePrecedente`, `semaineSuivante`.

### 16.2 Interface

**Onglets : Tableau, Jour, Produits, Réglages.** L'onglet Semaine disparaît (`vue-semaine.js` supprimé ; `#/semaine/…` et `#/accueil` renvoient au tableau). Route du tableau : `#/tableau` ou `#/tableau/LUNDI`.

**Le tableau blanc (`vue-tableau.js`).**
- Un panneau blanc dans un cadre d'aluminium (bord de 3 px `#b8c2c8`, rayon 8 px), posé sur le fond inox. En thème sombre, le panneau reste clair d'aspect « ardoise » : surface `--carte`, encre claire.
- Écriture au feutre : `--police-feutre: "Marker Felt", "Chalkboard SE", "Bradley Hand", ui-rounded, system-ui, sans-serif` (polices déjà présentes sur iPhone et iPad, rien à télécharger). Elle sert aux jours, aux intitulés, aux chiffres et au titre du contexte, jamais sous 18 px. Les petits textes et les boutons restent en police système.
- Couleurs de feutre : noir (`--texte`) pour ce qui est au poste, bleu (`--bleu`) pour les chiffres de couverts, vert pour ce qui est fait, rouge pour les alertes, allergies et décisions. Ce qui n'est pas au poste (protéine, sauce du menu 2) est écrit en gris, plus petit, en police système. La couleur n'est jamais le seul signal : coche, case, texte barré, point d'exclamation.
- **En haut du tableau, la note du contexte** : un papillon jaune (fond `--ambre-fond`, bande de ruban `--ambre` en haut) avec le titre du contexte, au plus six lignes, et une seule action principale (« Ouvrir la feuille du jour », ou « Saisir les menus de la semaine »). C'est la réponse à « que dois-je savoir maintenant ».
- **La grille.** iPad (largeur ≥ 820 px) : une colonne par jour, du lundi au samedi, séparées par des traits noirs de 2 px comme du ruban de traçage ; lignes « Menu 1 », « Menu 2 », « Groupes », « Mise en place ». iPhone : une bande horizontale par jour, le jour écrit à gauche (« Lun » et le numéro), le contenu à droite ; le jour mis en avant par le contexte est déplié (mise en place visible), les autres sont repliés sur leurs deux menus et leurs couverts.
- Aujourd'hui est marqué par un aimant (pastille ronde rouge) à côté du nom du jour et par le mot « aujourd'hui » en petit.
- Mise en place : une ligne par tâche, case vide (à faire), case à moitié (en cours), coche et texte barré (fait), point d'exclamation rouge (à décider). Chaque ligne mène au composant, cible de 44 px.
- Couverts : le total du menu, au feutre bleu, entouré d'un cercle. Rien n'est affiché s'il n'y a ni prévision ni groupe.
- Rien de vide n'est écrit : pas de « aucune fiche », pas de « 0 ». Une case sans contenu reste blanche.
- En tête du tableau : « Semaine du … » au feutre, flèches semaine précédente et suivante, et un bouton discret « Menus de la semaine ».

**Menus de la semaine (`vue-menus.js`, route `#/menus/LUNDI`).**
- Une zone « Coller le texte de la feuille » avec le bouton « Répartir dans la semaine » : remplit les champs à partir de `analyserFeuille`, affiche les avertissements, n'enregistre rien.
- Cinq blocs, du lundi au vendredi : menu 1 et sa prévision, menu 2 et sa prévision (facultatives).
- Un seul bouton « Enregistrer la semaine » (`saisirMenusSemaine`), puis retour au tableau. Aucune étape de validation.
- La page ne se redessine pas pendant la frappe.

**Détail d'un jour (`vue-detail.js`).** Plus aucun bouton « valider la transcription », « proposer les composants », « valider ». Sous chaque menu : ses composants, chacun avec un interrupteur « au poste » (mémorisé) et un lien vers sa page. Les autres rubriques (prévisions, fiches, allergies, créneaux, après service, photo) sont des blocs repliables, fermés quand ils sont vides.

**Composant (`vue-composant.js`).** La portion affichée dit d'où elle vient (ce plat, référence de ce nom, standard maison, estimation base métier) et dans quel état de poids elle est exprimée. Une portion manquante propose deux gestes : « Corriger pour ce plat seulement » ou « Régler le standard maison » (lien vers Réglages). Corriger un plat ne touche jamais au standard.

**Réglages : section « Standards maison ».** Une ligne par famille et par rôle (`lignesStandards`) : libellé de la famille, rôle, la valeur du standard avec son unité et son état de poids, et à côté, s'il existe, le repère de la base métier à titre indicatif. Chaque ligne se modifie ou s'efface dans un panneau. Texte d'aide : le standard maison passe avant l'estimation de la base ; une correction sur un plat ne le change pas.

## 17. État après le lot « tableau blanc et savoir culinaire » (2026-10-02, soir)

Construit, 300 tests, vérifié à l'écran en suivant le parcours à la main (iPhone clair et sombre, iPad paysage, rechargement sans serveur) :
- saisie de la semaine en collant le texte de la feuille (`vue-menus.js`, `feuille.js`) : essayée avec le texte de la vraie feuille du 5 au 9 octobre ;
- composants créés, classés et attribués sans aucune validation ; savoir appliqué (famille, rôle, type, étapes de la base) ;
- standards maison dans Réglages ; portion effective et état du poids affichés sur chaque composant ; une portion en poids sec n'applique pas le gain de cuisson ;
- accueil en tableau blanc avec la note du contexte ; quatre onglets.

Écarts par rapport à la section 16, décidés pendant la construction :
- La note du contexte présente les besoins (portions à régler, prévisions à saisir, semaine type) comme des cases à cocher, pas comme des alertes ; le point d'exclamation rouge est réservé aux écarts à arbitrer. Une tâche pas encore planifiée ou sans quantité est « à faire », pas « à décider ».
- Seules les avances autorisées et chiffrées sont proposées ; les autres sont résumées en une ligne.
- Les points déjà dits dans la note (portions, prévisions) ne sont pas répétés jour par jour sur le tableau ; `points.js` ne signale plus un composant « à préciser » quand seule la prévision manque.
- `ajouterComposant` crée un composant valide, déduit sa catégorie du nom et applique le savoir.
- Chaque famille porte un `groupe` ; un repère de la base peut être donné par famille ou par groupe.
- Les anciens écrans Accueil et Semaine sont dans `archives/interface-v2/`, pas supprimés.

Dépassé dans ce document : la section 12 (quatre onglets sans tableau) et la section 14 (réglette de bacs, tableau de bord).

Questions ouvertes, à trancher par la propriétaire :
1. Table des repères de portion (note du coffre) : à valider avant tout ajout à la base métier. `PORTIONS_BASE` est vide aujourd'hui.
2. Quatrième état de poids « cru brut » (non paré), nécessaire pour les repères suisses des pommes de terre et des légumes.
3. Standards maison par grande catégorie (féculents, légumes), que le standard d'une famille remplacerait : la semaine d'essai demande huit standards par famille, trois ou quatre suffiraient par catégorie.
4. Un légume sans famille connue (tomates, par exemple) reste « générique » : il se compte en portions, sans poids.

Non vérifié : appareil iPhone ou iPad réel, collage depuis la photo sur iOS, photo de menu, export et restauration par fichier dans un vrai navigateur.

## 18. Refonte du 2026-10-03 et 2026-10-04 (versions 16 à 37)

Cette section résume ce qui a changé depuis la section 17. Le détail des choix par défaut et des limites est dans `docs/refonte-journal.md` ; l'inventaire de départ est dans `inventaire-v23.md`.

**Principes** (décisions de la propriétaire dans le coffre) : les quantités sont facultatives et tout se recalcule ; enregistrer un menu suffit ; direction visuelle épurée et professionnelle ; reprises de l'ancienne application Kōzō validées.

**Interface**
- Tableau = tableau de bord à quatre zones (menus de la semaine, fiches de fonction, « À confirmer » de trois lignes au plus sans quantité manquante, production et commandes). Chaque élément mène à une page.
- Feuille Jour = une liste de mise en place cochable : menu 1, menu 2, autres tâches, après service (avances). « Fait » en un toucher, annulable deux minutes ; jauge ; avances hors règle repliées ; lots suggérés ; écran allumé ; glissement entre jours ; impression.
- Réglages = racine de quatre rubriques et sous-pages (Standards de production, Organisation du poste, Produits et commandes, Données et hors ligne).
- Produits = liste compacte, un produit par ligne ; liste « à commander » à trois états (suggéré, noté, retiré), marge de sécurité sur la seule quantité proposée.

**Logique métier**
- `lirePlat` (analyse-menu.js) : menu 1 = recette de pâtes ou de risotto entièrement au poste, sauce implicite « à confirmer » jamais choisie ; menu 2 = protéine hors poste, garnitures au poste. « X aux Y » donne deux éléments. Vocabulaire générique dans `vocabulaire-plats.js`. Mémoire d'attribution et de référence par `nom|menu`.
- Repères de portion : les six repères validés le 2026-10-03 sont créés dans `savoir/reperes-portion/savoir-metier.json` (généré vers `app/js/donnees/savoir-metier.js`). Ils restent des estimations (milieu de la fourchette, jamais dans une commande) ; le standard maison passe avant. Viande sans os et œufs sont stockés mais pas encore utilisés.
- Assistant de validation (`validation.js`, `actions-validation.js`, `feuille-validation.js`) : valider, corriger, seulement cette fois, plus tard ; la valeur est toujours choisie par la propriétaire.
- Étapes de préparation à avance propre (règle de préparation, `etapes`) : définies par la propriétaire, aucune par défaut ; l'ordre est respecté ; une étape faite n'est jamais supprimée.
- Les pâtes et le risotto du menu 1 ne sont pas avançables par défaut ; une herbe ou une sauce implicite n'est jamais comptée en portions.

**Vérification** : 528 tests sous faux DOM ; captures du rendu réel à 390 px avec Chrome sans fenêtre ; deux relectures indépendantes (lecture seule). Non vérifié : un vrai iPhone, le tactile, IndexedDB réelle après fermeture complète, le service worker.

## 19. Savoir branché : standards de base (2026-10-04, versions 39 à 42)

Décision validée : « Standards de base et ajustement terrain ». Rangement préalable : tout le savoir dans `savoir/` (base métier, repères de portion, référentiel culinaire), documents dans `docs/`.

- **Données** : `savoir/culinaire/rattachements.json` (choisi à la main, sans chiffre) rattache une quarantaine d'entrées du référentiel à une famille, un groupe ou une règle générale, avec usage et unité normalisée ; le générateur produit `app/js/donnees/savoir-culinaire.js` (≈ 406 Ko, gelé, testé à jour).
- **Domaine** : `standards-base.js` (`standardDeBase`, `rendementDeBase`, `reperesConservation`, `reperesCuisson`, `reperesAide`) ; `ajustements.js` + `actions-ajustements.js` (`etat.ajustements`, `valeurEffective`, garde-fous de vraisemblance, avertissement d'hygiène sur la borne prudente) ; `apprentissage.js` + `actions-apprentissage.js` (3 corrections dans le même sens en 30 jours, une par plat et par jour, sens mélangés = rien ; proposition dans « À confirmer »).
- **Calcul et commandes** : statut `STANDARD_BASE` (n'est plus `aValider`) ; une quantité calculée dessus est commandable avec la marge ; la quantité notée est figée au geste « noter » et devient « à relire » si le calcul change ; `INCONNU` reste non commandable sans quantité tapée ; `quantiteAcheter` n'est jamais remplie par le calcul.
- **Planification** : conservation du référentiel ou valeur de la propriétaire → avertissement, jamais blocage (seule `limiteUtilisationJours` bloque) ; riz cuit signalé dès J-2 ; règle de refroidissement (2 h) rappelée « Après service ».
- **Interface** : Réglages > Standards de base (changer, revenir au standard, écarts) ; Réglages > Repères métier (consultation repliée) ; bloc « Repères métier » dans la fiche de composant ; buffet par couvert sur les fiches de fonction ; source légale des allergènes.
- **Vérification** : 639 tests ; relecture indépendante (0 critique, 4 importants et 6 mineurs corrigés) ; captures réelles à 390 px. Non vérifié : un vrai iPhone.

## 20. Refonte 1 : onglets et direction visuelle (2026-10-04, versions 43 à 56)

Décisions validées : « Onglets et écrans de la refonte 1 » et « Direction visuelle de la refonte 1 ». Paquet : `docs/maquette-refonte-1/` (brief, jetons, maquettes). Règle d'or : structure et apparence seulement ; aucune logique métier changée (relecture indépendante : rien de modifié dans le domaine hors fonctions de données pures `aujourdhuiDe`, `prochainOuvert`, `decisions.js`).

- **Onglets** : Aujourd'hui (`vue-aujourdhui.js`), Production (`vue-production.js` + `vue-jour.js`), Semaine (`vue-semaine.js` + `vue-detail.js`), Stock (`vue-stock.js` : Restes, DLC, Achats via `vue-produits.js`). Réglages par le bouton de l'accueil. Écrans hors onglets : Fiche technique (`vue-fiche.js`, gestes avancés de `vue-composant.js` dans « Plus de réglages »), Mode en poste (`vue-poste.js`, étapes de la règle de préparation, au moins 2), Import des menus (`vue-import.js`), feuille À décider (`feuille-decisions.js`, même compte que le bandeau d'accueil, `decisionsDe`).
- **Routes** : `#/aujourdhui`, `#/production[/d]`, `#/semaine[/d]`, `#/stock[/restes|dlc|achats][/d]`, `#/fiche/<id>`, `#/poste/<id>`, `#/import[/d]`, `#/reglages[/rubrique]` ; anciennes adresses redirigées.
- **Apparence** : jetons de `tokens.css` fusionnés dans `style.css` ; police IBM Plex Mono embarquée (`app/polices/`, licence OFL, mise en cache) pour les quantités ; groupement des milliers étroit, nombres de 4 chiffres non groupés ; thème sombre ; contrastes testés (4,5:1).
- **Choix par défaut validés avec le plan** : pas de synchronisation (« hors ligne prêt »), couverts par menu et fiches (pas midi/soir), ni minuteur, ni lots/emplacements, ni relevé de températures, ni réglage d'avance « −/+ », ni planning personnel ; « vérifié disponible », jamais « en stock ».
- **Vérification** : 783 tests ; relecture indépendante (0 critique, 4 importants, 6 mineurs corrigés) ; captures réelles à 390 px en clair et en sombre. Non vérifié : un vrai iPhone.


## 21. Refonte 2 : palette « Grand large », tableau de bord, Couverts midi, Articles (2026-10-07, versions 70 à 80)

Décisions validées le 2026-10-07 : « Écrans et direction visuelle de la refonte 2 », « Couverts du midi et répartition des menus », « Onglet Articles sans gestion de stock », « Règles de l'assistant IA Proposer un planning ». Paquet : `docs/maquette-refonte-2/` (brief, jetons, maquettes, aperçus). Règle d'or : structure et apparence changent, pas la logique métier, sauf les trois règles nouvelles ci-dessous. Une version par étape (un commit par étape, tests verts).

- **v70, palette G** : les valeurs de `tokens.css` sont fusionnées dans `style.css` (mêmes noms de variables, clair et sombre) ; `theme-color`, manifeste et jauge alignés. Bleu océan pour agir, or paille pour ce que le chef doit trancher (`--ambre*` reste un alias), noir pour décider, nuit marine en sombre. Contrastes AA vérifiés par calcul.
- **v71, onglet Articles** : `#/articles` remplace `#/stock` ; les anciennes adresses `#/stock…` et `#/produits…` y mènent. `vue-stock.js` et `vue-produits.js` restent dans le code, sans route (Restes, DLC, Achats masqués, code et données gardés).
- **v72, Production épurée** : liste à plat, une ligne par tâche (case, nom vers la fiche, quantité en Plex Mono), sous-ligne réservée à l'exception (« à préciser », « déjà avancé », « Pour mar. 6 », hors règle, avertissement de conservation), faites grisées sans barré et rangées en bas de leur menu, avances en une ligne « N avances à planifier », étiquette « N à décider » seulement s'il y en a. Plus de bandeau « Fait · Annuler » sur Production (`faireEnUnToucher(id, { sansBandeau })`) : retoucher la case remet la tâche à faire. « ⋯ » reste l'accès aux autres gestes (Démarrer, Reporter, Retirer, Corriger). La barre des jours n'apparaît que hors Aujourd'hui et Demain. La planification ne change pas.
- **v73, Aujourd'hui en tableau de bord** : menus sur 3 jours, cases Production et Couverts midi, « À avancer » (3 lignes), fiche de fonction (aujourd'hui ou demain), « À confirmer · N » (3 lignes, « Tout voir » ouvre la feuille), rappels, carte « Prochaine » fixe. Retirés de l'accueil : créneaux du jour, case ambre, raccourci Articles, « À consommer en priorité » (fonction gardée, masquée). `aujourdhuiDe(etat, aujourd, heure)` ajoute `menusSurTrois`, `couvertsMidi`, `aAvancer`, `avancementJour` (même compte que Production) et `ficheProche`, sans modifier de calcul.
- **v74, règle nouvelle 1 : Couverts midi** (`couverts-midi.js`, `actions-couverts.js`, `feuille-couverts.js`). Un total saisi (− / + ou 40 à 80) ; répartition M1 / M2 calculée = moyenne des 3 derniers jours identiques (`repereVentes`, 3 jours de ventes des deux menus sur les mêmes dates), sinon 1/3 – 2/3 ; corrigeable (« décidé par vous », « Revenir au calcul ») ; « Détail du calcul » replié. `definirCouvertsMidi` écrit `jours[date].couverts = { total, repartition|null, h }` et les prévisions des deux menus : la production se recalcule ; la prévision porte la certitude « provisoire » (`portionsMenu`). `definirPrevision` remet `couverts` à null. Dès 14 h, la case dit « Ventes à saisir » (`ventesASaisir`) et ouvre « Ventes du midi » (`saisirVentes`). Migration légère : `couverts` absent = null ; `importer` remplace par null tout `couverts` invalide. La saisie menu par menu (`dialogPrevision`) a disparu ; la même feuille s'ouvre depuis Semaine pour le jour choisi.
- **v75, Validation des portions** : la feuille se ferme à tout moment (× et toucher du fond ; elle ne se fermait pas), « n / total », parcours une valeur à la fois (`ouvrirValidations`, lancé par « Valider » de la feuille « À décider ») puis écran « terminé » avec « Revenir à Aujourd'hui ». La valeur reste tapée par la propriétaire.
- **v76, règle nouvelle 2 : Articles** (`articles.js`, `actions-articles.js`, `vue-articles.js`) : la liste simple du poste par jour et par menu, lue dans `besoinsProduits` (aucune quantité recalculée ; inconnue = « à compléter », sans alerte), à cocher (`etat.articlesCoches`, clé « composant|article » → horodatage ; import qui écarte toute valeur invalide), Semaine / Aujourd'hui, « Partager la liste » (partage natif, sinon copie). Pas de stock ni de DLC.
- **v77, retouches** : ligne « Brut à prévoir » toujours visible sur la fiche (sans alerte) ; signes « ! » et « ? » dans le bandeau des 7 jours de Semaine ; Réglages en groupes Production, Poste, Assistant, Données. Le mode en poste suivait déjà le thème du téléphone.
- **Règle nouvelle 3 (assistant IA)** : audit en lecture seule le 2026-10-07 ; deux écarts à la décision relevés, non corrigés à ce stade (voir la note de propositions du même jour) : un nom brut part vers le fournisseur par `donnees.manquantes` (`harness/contexte.js`), et « Écarter » une ligne du brouillon n'a pas de geste dans l'interface (le harness sait écarter).
- **v79, corrections des relectures** : (1) `feuille-validation.js` lisait `enfants`, propre au faux DOM : dans un vrai navigateur la feuille plantait à l'ouverture (plus de ×, de compteur ni de parcours) ; corrigé avec `children`, et `tests/api-dom-reelle.test.js` interdit désormais à `app/js/` de lire `.enfants`, `.tous(` ou `.declencher(` ; (2) `feuille-couverts.js` gardait un drapeau levé par l'événement `close`, que le navigateur signale en différé : « Modifier les couverts » depuis les Ventes ne rouvrait rien ; on interroge maintenant `dialog.open`, avec un test à fermeture différée ; (3) l'import d'une feuille de menus (`saisirMenusSemaine`) remet `couverts` à null ; (4) un 0 / 0 jamais touché n'est pas enregistré comme ventes ; (5) la clé d'un article porte son unité. Parcours de validation revérifié à l'écran (1 / 2, 2 / 2, « terminé »).
- **v80, corrections après l'essai de la propriétaire sur iPhone** : (1) plus de barre du haut « Sanji · page » (chaque page porte son titre ; le bouton Réglages passe dans l'en-tête d'Aujourd'hui ; `index.html` n'a plus de `#barre`) ; (2) la carte « Prochaine » est une carte de la page, sous les chiffres, qui défile avec elle (plus fixe) ; (3) les couverts ne se saisissent que dans Aujourd'hui : Semaine les affiche en lecture seule (le « ? » mène à l'import) ; (4) Semaine n'a qu'un bouton « ⋯ » (feuille : « Importer les menus », « Proposer un planning ») et « Ouvrir Jour » / « Voir la feuille du jour » deviennent le lien discret « Production du jour › » ; (5) le menu du jour (`menu-du-jour.js`) s'affiche sous les onglets de Production, pour le jour affiché, et les Articles sont regroupés par menu avec son intitulé. Ces points modifient la décision du 2026-10-07 « Couverts du midi » (autres jours depuis Semaine) à la demande de la propriétaire : à consigner dans une décision.
- **Hors de ce paquet** : le complément annoncé (historique des semaines, rappel du vendredi, états vides, style épuré des autres pages) arrivera dans un second paquet.
- **Vérification** : 1020 tests sous faux DOM ; captures réelles à 390 px en clair et en sombre pour Production, Aujourd'hui, Couverts midi, Articles, Réglages, Semaine ; relectures indépendantes (qualité, sécurité) à la clôture. Non vérifié : un vrai iPhone (tactile, partage natif, IndexedDB réelle, service worker).
