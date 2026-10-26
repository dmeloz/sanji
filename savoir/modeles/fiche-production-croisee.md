---
template: fiche_production_croisee
version: 1.1
lang: fr
type: production_culinaire
export_pdf: true
pdf_orientation: landscape
pdf_fit_to_width: 1
moteur: mustache            # {{#liste}} … {{/liste}} répète un bloc ; {{^liste}} … {{/liste}} s'affiche quand la liste est vide

# ------------------------------------------------------------------
# Ce qu'on saisit. Tout le reste de la fiche se calcule à partir d'ici.
# ------------------------------------------------------------------
fiche:
  nom_production: ""
  reference: ""
  version_fiche: ""
  date_creation: ""          # AAAA-MM-JJ
  responsable: ""
  objectif: ""               # ex. « mise en place du jeudi pour 3 services »
  coefficient: 1             # multiplie toutes les quantités (1 = recette de base)
  difficulte: ""             # facile | moyenne | difficile

preparations:                # autant qu'il en faut, plus de limite à 3
  - id: P1
    nom: ""
    rendement: ""            # ex. « 2,4 kg net · 20 portions »
    point_critique: ""       # le CCP (HACCP) : ce qui rend la préparation sûre ou ratée
    conservation: ""         # ex. « 3 jours à 0–5 °C »
    duree: ""                # ex. « 1 h 20 » (sert au temps total)
    materiel: ""             # ex. « sauteuse 40 cm, thermomètre »
    etapes:
      - action: ""
        controle: ""         # paramètre ou contrôle : « 85 °C à cœur »
        duree: ""
    qualite:
      - point: ""
        critere: ""
        correction: ""
    stockage:
      refroidissement: ""    # ex. « de 65 à 10 °C en 2 h au plus »
      conditionnement: ""
      date_limite: ""        # DLC (à consommer jusqu'au) ou DDM (à consommer de préférence avant)
      temperature: ""
      tracabilite: ""        # lot, date de fabrication, étiquette

ingredients:                 # UNE ligne par ingrédient, même s'il sert à plusieurs préparations
  - nom: ""
    unite: "g"               # une seule unité par ligne : g, ml ou pièce (convertir avant)
    brut_net: 1              # rapport poids brut / poids net (1,25 = 20 % de pertes à l'épluchage)
    prix_unitaire: null      # CHF par kg, par litre ou par pièce ; null si inconnu
    allergenes: []           # parmi la liste des 14 ci-dessous
    quantites:               # quantité NETTE par préparation, avant coefficient
      P1: 0
    remarque: ""             # optimisation : « éplucher en une fois », « reste pour P3 »

mise_en_place_commune:       # gestes faits une seule fois pour toute la production
  - ""

ordre:                       # le planning réel, temps morts compris
  - action: ""
    preparation: ""          # P1, P2… ou « commun »
    debut: ""                # ex. « 0:00 », « 0:25 »
    raison: ""               # ex. « le fond cuit pendant qu'on taille »

# ------------------------------------------------------------------
# Calculé par l'outil, jamais saisi à la main
# ------------------------------------------------------------------
# ingredients[].total_net    = somme des quantites × coefficient
# ingredients[].total_brut   = total_net × brut_net  (ce qu'on pèse ou achète)
# ingredients[].cout         = total_brut × prix_unitaire
# preparations[].allergenes  = union des allergènes de ses ingrédients
# temps_total                = fin de la dernière action de « ordre »
# cout_total                 = somme des coûts connus (« partiel » si un prix manque)

# Les 14 allergènes à déclarer (Suisse, OIDAl annexe 6 ; mêmes que l'UE, règlement 1169/2011) :
# gluten, crustaces, oeufs, poissons, arachides, soja, lait, fruits_a_coque, celeri,
# moutarde, sesame, sulfites (> 10 mg/kg), lupin, mollusques
---

# Fiche de production croisée · {{fiche.nom_production}}

Réf. {{fiche.reference}} · version {{fiche.version_fiche}} · {{fiche.date_creation}} · {{fiche.responsable}}
Objectif : {{fiche.objectif}} · Coefficient × {{fiche.coefficient}} · Temps total {{temps_total}} · Difficulté {{fiche.difficulte}}

## 1. Préparations

| ID | Préparation | Rendement | Durée | Point critique (CCP) | Allergènes | Matériel |
|---|---|---:|---:|---|---|---|
{{#preparations}}
| {{id}} | {{nom}} | {{rendement}} | {{duree}} | {{point_critique}} | {{allergenes}} | {{materiel}} |
{{/preparations}}

## 2. Ingrédients croisés

> Un ingrédient n'apparaît qu'une fois. Les colonnes P sont en poids net ; « À peser » est le brut, ce qu'on sort ou ce qu'on achète.

| Ingrédient | {{#preparations}}{{id}} | {{/preparations}}Total net | À peser (brut) | Unité | Allergènes | Coût | Remarque |
|---|{{#preparations}}---:|{{/preparations}}---:|---:|---|---|---:|---|
{{#ingredients}}
| {{nom}} | {{#par_preparation}}{{quantite}} | {{/par_preparation}}{{total_net}} | {{total_brut}} | {{unite}} | {{allergenes}} | {{cout}} | {{remarque}} |
{{/ingredients}}

Coût matière : **{{cout_total}}**

## 3. Mise en place commune

{{#mise_en_place_commune}}
- [ ] {{.}}
{{/mise_en_place_commune}}
- [ ] Matériel prêt : {{materiel_total}}
- [ ] Allergènes de la production contrôlés : {{allergenes_production}}

## 4. Progression par préparation

{{#preparations}}
### {{id}} · {{nom}}

| Étape | Action | Paramètre / contrôle | Durée |
|---:|---|---|---:|
{{#etapes}}
| {{numero}} | {{action}} | {{controle}} | {{duree}} |
{{/etapes}}

{{/preparations}}

## 5. Ordre de production

> Utiliser les temps morts, éviter les attentes et ne manipuler qu'une fois.

| Début | Action | Pour | Gain / raison |
|---:|---|---|---|
{{#ordre}}
| {{debut}} | {{action}} | {{preparation}} | {{raison}} |
{{/ordre}}

## 6. Contrôles qualité

| Préparation | Point de contrôle | Critère attendu | Action corrective |
|---|---|---|---|
{{#preparations}}{{#qualite}}
| {{id}} | {{point}} | {{critere}} | {{correction}} |
{{/qualite}}{{/preparations}}

## 7. Refroidissement, conservation et traçabilité

| Préparation | Refroidissement | Conditionnement | DLC / DDM | Température | Traçabilité |
|---|---|---|---|---|---|
{{#preparations}}
| {{id}} | {{stockage.refroidissement}} | {{stockage.conditionnement}} | {{stockage.date_limite}} | {{stockage.temperature}} | {{stockage.tracabilite}} |
{{/preparations}}

## 8. Allergènes

> Déduits des ingrédients : une préparation est marquée dès qu'un de ses ingrédients l'est. Vérifier les étiquettes des produits transformés (traces, recettes changées).

| Allergène | Présent dans | Ingrédients en cause |
|---|---|---|
{{#allergenes_detail}}
| {{nom}} | {{preparations}} | {{ingredients}} |
{{/allergenes_detail}}
{{^allergenes_detail}}
| Aucun des 14 allergènes déclarés | | |
{{/allergenes_detail}}

> À adapter selon la réglementation applicable et les procédures internes de l'établissement.

## 9. Validation

| | Nom | Date | Signature |
|---|---|---|---|
| Rédigé par | | | |
| Vérifié par | | | |
| Approuvé par | | | |

<!--
Ce qui a changé depuis la version 1.0 (2026-10-20)
- Plus de limite à 3 préparations : listes répétées ({{#preparations}}) au lieu de colonnes P1–P3 figées.
- Chaque champ vient d'une donnée nommée : plus de {{p1_qte}} ou {{action}} identiques d'une ligne à l'autre.
- Les totaux, le brut à peser, le coût et les allergènes par préparation se calculent, ils ne se tapent plus.
- Allergènes portés par chaque ingrédient (les 14 à déclarer), la section 8 se déduit seule.
- Ajouts : coefficient, rapport brut / net, prix, matériel, durée par préparation, heure de début dans l'ordre.
- Doublon retiré : « point critique » vit en section 1, les contrôles en section 6.
- Champs d'en-tête inutilisés (rendement_global, temps_total) devenus calculés ; « DLUO » remplacée par DDM.
-->
