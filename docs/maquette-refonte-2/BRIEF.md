# Sanji — appliquer la maquette « refonte 2 · iPhone »

À lire en entier avant de toucher au code. Ce brief fait suite aux décisions validées par la propriétaire le 2026-10-07 :
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-07 - Sanji - Ecrans et direction visuelle de la refonte 2.md`
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-07 - Sanji - Couverts du midi et repartition des menus.md`
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-07 - Sanji - Onglet Articles sans gestion de stock.md`
- `Cerveau-Obsidian/02-Decisions-validees/2026-10-07 - Sanji - Regles de l'assistant IA Proposer un planning.md`

Contexte : `Cerveau-Obsidian/03-Propositions/2026-10-07 - Sanji - Maquette refonte 2 iPhone et ecarts valides.md` (les 10 écarts validés).

## La règle d'or
**On change la structure et l'apparence. On ne change pas la logique métier**, sauf les trois règles nouvelles décidées le 2026-10-07 et décrites plus bas : la feuille « Couverts midi », l'onglet Articles, les règles de l'assistant IA.
Calculs, statuts, règles d'avance (2 jours calendaires), attribution au poste, vocabulaire de provenance et de certitude, export et restauration, hors ligne : tout reste comme dans la v69 et le plan V1. Les 970 tests doivent encore passer. Si un écran semble demander une autre règle, ne l'invente pas : affiche ce que l'application sait déjà et note la question pour la propriétaire.

## Contenu du dossier
- `BRIEF.md` : ce fichier.
- `tokens.css` : la palette G « Grand large », avec les mêmes noms de variables que `app/css/style.css` (seules les valeurs changent), en clair et en sombre.
- `maquettes/` : la source de chaque écran (format du canevas Design) et `sanji-r2.css`, leur feuille commune. Prends-y la **disposition et les styles**. Ignore le moteur du canevas (`<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>`, `{{ … }}`, `DCLogic`, `support.js`, `dc-import`). Les crochets (`[composant]`, `[qté]`, `[n]`, `[plat du menu 1]`…) marquent une donnée réelle de l'application : **aucune valeur d'exemple**.
- `apercus/` : captures à 390 px, en clair et en sombre, d'Aujourd'hui, de la feuille Couverts midi et de Production.
- `maquettes/DA-Pistes2027.dc.html` : l'étude de palettes ; seule la piste G est retenue.

## Direction visuelle
- Palette G « Grand large » (`tokens.css`) : fond parchemin, cartes crème, **bleu océan pour agir** (remplace le basilic), **or paille pour ce que le chef doit trancher** (remplace l'ambre), rouge pour l'alerte, noir pour décider. En sombre : nuit marine, texte parchemin.
- Polices inchangées : SF Pro pour le texte et les titres, IBM Plex Mono embarquée pour les quantités. Pas de nouvelle police.
- Règles inchangées : texte ≥ 15 px, légendes ≥ 13 px, une icône et un mot pour chaque état, pas de dégradé, cibles ≥ 44 px, mouvement réduit respecté.
- Style « épuré » (pages Production et bloc « À avancer ») : listes à plat sur le fond, filets fins, une ligne par tâche, sous-ligne seulement quand elle sert.

## Correspondance des écrans

| Maquette | Ce qu'elle affiche | D'où viennent les données (v69) |
|---|---|---|
| `Onglets` | 4 onglets : Aujourd'hui, Production, Semaine, **Articles** | barre actuelle ; l'onglet Stock devient Articles |
| `A1-Aujourdhui` — **tableau de bord** (accueil) | de haut en bas : en-tête (jour, date, heure, bouton Réglages) ; **menus sur 3 jours** en colonnes (aujourd'hui en encre, jour sans menu = « menu à importer » en pointillés, toucher = Semaine ou Import) ; deux cases : **Production faites/total** avec jauge, **Couverts midi** (total et « M1 · M2 », toucher = feuille) ; **À avancer** (3 lignes au plus : composant, « pour mardi », quantité ; lien « Production ») ; **fiche de fonction** (seulement s'il y en a une aujourd'hui ou demain) ; **À confirmer** (3 lignes au plus, « Tout voir ») ; **Prochaine** tâche fixe en bas près du pouce (Ouvrir la fiche, Fait) | `tableau-blanc.js` (`bord` donne déjà les menus du jour et des 2 suivants, fiches de fonction, À confirmer) ; production du jour (`planification.js`) ; prévisions ; avances proposées par la règle des 2 jours (`avancesPossibles`). Retirés de l'accueil : bloc « créneaux du jour », case ambre « À confirmer » dans les chiffres, raccourci « Articles ». La page défile ; Prochaine et onglets restent fixes |
| `A1b-CouvertsMidi` — **feuille Couverts midi** | voir « Règle nouvelle 1 » | prévisions du jour |
| `A1c-VentesMidi` — **Ventes du midi** (après le service) | dès 14 h la case Couverts midi affiche « Ventes à saisir » ; feuille M1 / M2 avec − et +, « prévu n » en rappel, total servi, Plus tard / Enregistrer | `saisirVentes` existant |
| `A2-ADecider` | feuille À décider | inchangé (`feuille-decisions.js`) |
| `A3-Production` — **épurée** | en-tête « Production » + « 2/6 » + fine jauge ; étiquette paille « ⚠ N à décider » seulement si N > 0 ; onglets texte Aujourd'hui / Demain ; titres courts « Menu 1 », « Menu 2 » ; **liste à plat** ; une ligne par tâche : case, nom, quantité (chiffre en Plex Mono, unité en petit) ; sous-ligne **seulement** « à préciser » (paille) ou « déjà avancé » ; tâches faites **grisées sans barré et rangées en bas de leur menu** ; « N avances à planifier › » en une ligne | feuille Jour (`vue-jour.js`, `planification.js` `lecture`). **Plus de bandeau « Fait · Annuler »** : retoucher la case remet la tâche « à faire » (décision de la propriétaire). Le créneau, les portions et la provenance restent dans la fiche |
| `A4-Fiche` | fiche technique ; ligne « Brut à prévoir » toujours visible avec « inconnu · forme achetée à préciser », sans alerte (écart 6) | `vue-composant.js` |
| `A5-Poste` | mode en poste ; **suit le thème du téléphone** (écart 7), plus de fond noir imposé | `vue-poste.js` |
| `B1`…`B3` | assistant IA : déclenchement, brouillon (« Écarter » une ligne), trace | harness + `fournisseur-web.js` ; voir « Règle nouvelle 3 » |
| `C1-Semaine` | un jour à la fois, bandeau de 7 jours avec signes « ! » à trancher, « ? » à confirmer, « fermé » le dimanche, jour annoncé en toutes lettres pour les lecteurs d'écran (écart 8) | `vue-semaine.js`, `vue-detail.js` |
| `C2`…`C5` | semaine type, import, « Ce que Sanji a lu » ; `C5` = la même feuille Couverts midi pour le jour choisi, avec la fiche de fonction du jour | `vue-menus.js`, `vue-import.js`, prévisions existantes |
| `D2-Apprentissage` | proposition d'apprentissage | `apprentissage.js` |
| `D3-ValidationPortions` | valeurs à valider une par une ; **après la dernière, écran « terminé »** avec « Revenir à Aujourd'hui » ; bouton × et toucher du fond pour fermer à tout moment | `ui/feuille-validation.js` (corrige une feuille qui ne se fermait pas) |
| `D5-Achats` — **Articles** | voir « Règle nouvelle 2 » | lecture des plats et produits des composants au poste |
| `E1`…`E4` | Réglages, Standards de base, Assistant IA (clé masquée), Données et version | `vue-reglages.js` |
| `F1`…`F8` | premier lancement, base vide, hors ligne, nouvelle version, chargé, erreur, Aujourd'hui et Production en sombre | états existants |
| `Principes`, `DA`, `Ecarts` | référence | — |

## Règle nouvelle 1 — Couverts midi (décision du 2026-10-07)
- Sur Aujourd'hui, la case « Couverts midi » ouvre une feuille **pour le jour actuel seulement** (demain se règle demain).
- Le chef saisit **un total** : boutons − et +, et choix rapides 40, 50, 60, 70, 80.
- La répartition menu 1 / menu 2 se **calcule** : proportion = **moyenne des dernières semaines** ; tant qu'il n'y a pas d'historique, **1/3 menu 1 et 2/3 menu 2** (60 → 20 / 40). Étiquette « calculé ».
- Le chef peut corriger la répartition (− / + sur le menu 1, le menu 2 suit) : étiquette « décidé par vous », lien « Revenir au calcul ».
- « Détail du calcul » est **replié par défaut** ; déplié : la proportion utilisée et `couverts × portion = quantité` pour chaque menu.
- « Enregistrer » : la case affiche le total et « M1 n · M2 n », la **production du jour se recalcule** à partir de ces couverts, un message confirme « Production du jour recalculée ».
- **Réponses de la propriétaire (2026-10-07)** :
  - moyenne = les **3 derniers jours identiques** de la semaine : réutilise le repère existant de `domaine/points.js` (ventes du même jour de semaine, 3 au plus) ; tant qu'il y en a moins de 3, 1/3 – 2/3 ;
  - les ventes se saisissent **dans la case Couverts midi après le service** : la case affiche « Ventes à saisir », le chef tape M1 et M2 (`saisirVentes` existant) ; ce sont le réel du jour ;
  - le total saisi porte la certitude **« provisoire »** ;
  - autres jours : **la même feuille** (total + répartition calculée), ouverte depuis Semaine pour le jour choisi ; la planche `C5` ne garde que la fiche de fonction, la saisie menu par menu disparaît.

## Règle nouvelle 2 — Articles (décision du 2026-10-07)
- L'onglet s'appelle **Articles**. **Pas de gestion de stock ni de DLC pour l'instant.**
- Contenu : la **liste simple** des articles du poste entremétier, **par jour et par menu**, à cocher ; choix « Semaine / Aujourd'hui » ; bouton « Partager la liste ».
- Restes, DLC et Achats sont **masqués** (réponse de la propriétaire) : ni code ni données supprimés, pas d'entrée dans Réglages pour l'instant. La saisie des ventes, qui vivait dans Restes, passe dans la case Couverts midi (règle 1).

## Règle nouvelle 3 — Assistant IA (décision du 2026-10-07)
Vérifie que l'existant (v68–69) respecte : l'IA ne place que des jours et des créneaux, jamais une quantité ; données envoyées limitées aux intitulés, quantités calculées, créneaux libres et règle des 2 jours (jamais fiches de fonction, allergies, remarques, notes) ; « Écarter » une ligne du brouillon ; clé sur l'iPhone, masquée, jamais exportée ni restaurée. Signale tout écart avant de corriger.

## Méthode
1. Lis `CLAUDE.md`, la fiche `Cerveau-Obsidian/01-Projets/Sanji.md` et les décisions ci-dessus.
2. **Présente un plan avant de modifier quoi que ce soit** (fichiers touchés, ordre). Les questions des règles 1 et 2 sont déjà tranchées ci-dessus. Attends l'accord de la propriétaire.
3. Fusionne `tokens.css` dans `style.css` (valeurs seulement) ; mets à jour l'en-tête de `style.css` et la ligne « Identité visuelle » de `CLAUDE.md`.
4. Écran par écran, dans cet ordre : palette, onglets (Articles), Production, Aujourd'hui, feuille Couverts midi, Validation des portions, Articles, puis les retouches des autres écrans. Un commit par écran, tests verts à chaque étape, `VERSION` incrémentée.
5. Vérifie à 390 px en clair et en sombre : cibles ≥ 44 px, aucun état porté par la couleur seule, contrastes WCAG, mouvement réduit.
6. En fin de travail : nouvelle section dans `docs/conception-technique-v1.md`, fiche Sanji à jour (état, date, prochaine action).

## À ne pas faire
- Changer un calcul, une règle d'avance ou un statut pour coller à un écran (hors règles nouvelles 1 à 3).
- Ajouter une dépendance, un build, une police ou un script chargés en ligne.
- Inventer une valeur métier, une durée, une quantité, un nombre de semaines.
- Supprimer une fonction existante qu'aucun écran ne montre plus.
- Mettre des données d'exemple dans l'application : les vraies semaines seront importées par la propriétaire.
