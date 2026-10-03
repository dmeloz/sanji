// Réglages : une racine courte (quatre rubriques) puis une sous-page par rubrique. Standards maison, références
// mémorisées, semaine type, capacité, règles de préparation, recettes, fournisseurs, marge de commande, sauvegarde,
// état de l'application et journal : aucun réglage n'a été retiré, seulement réparti.

import {
  confirmerSemaineType, creerRecette, definirCapacite, definirFournisseur, definirMargeSecurite, definirRegle, definirSemaineType,
  definirStandard, modifierRecette, noterExport, supprimerFournisseur, supprimerRegle, supprimerStandard, validerRecette,
} from '../domaine/actions.js';
import { creneauxDuJourSemaine } from '../domaine/dates.js';
import { exporter, importer } from '../domaine/etat.js';
import { FAMILLES, GROUPES, lignesStandards, lignesStandardsGroupes } from '../domaine/savoir.js';
import { ETAT_CRENEAU, ETAT_POIDS, UNITE, libelle } from '../domaine/statuts.js';
import { VERSION_BASE } from '../donnees/base-metier.js';
import { VERSION_APP } from '../version.js';
import { agir, agirStrict, etat as etatCourant, maintenant, redessiner, remplacer, statutStockage } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, ligneVide, pastille, repliable, titreSection } from './elements.js';
import { formaterHeure, formaterNombre, nomFichierSauvegarde, parseNombre, pluriel } from './format.js';
import { libelleHorsLigne, situationHorsLigne } from './horsligne.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { ALLERGENES, libelleAllergene } from './reference.js';
import { pastilleCreneau } from './taches.js';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TAILLE_PAGE_JOURNAL = 25;
let pageJournal = 0;

const carte = (titreTexte, ...contenu) => h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, titreTexte), contenu);

// ------------------------------------------------------------------ standards maison

const ROLE_EN_CLAIR = { plat_principal: 'en plat principal', garniture: 'en garniture' };

/** « 110 g, poids sec » */
const texteStandard = (s) => `${formaterNombre(s.valeur)} ${libelle('UNITE', s.unite)}, poids ${libelle('ETAT_POIDS', s.etat)}`;

/** « 100–120 g, poids sec » (un seul nombre quand le minimum égale le maximum). */
function texteRepere(r) {
  const portion = r.min === r.max ? formaterNombre(r.min) : `${formaterNombre(r.min)}–${formaterNombre(r.max)}`;
  return `${portion} ${libelle('UNITE', r.unite)}, poids ${libelle('ETAT_POIDS', r.etat)}`;
}

function dialogStandard(l) {
  const s = l.standard;
  const r = l.repereBase;
  // État du poids proposé : celui du standard déjà réglé (on ne le change pas sans le voir), sinon celui du repère de
  // la base, sinon aucun choix : il est obligatoire. Le repère n'est jamais copié comme valeur.
  const etatPropose = s?.etat ?? r?.etat ?? null;
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: 'Valeur de la portion', valeur: s?.valeur ?? null,
      aide: 'Un nombre ; la virgule est acceptée.' },
    { cle: 'unite', type: 'choix', libelle: 'Unité', valeur: s?.unite ?? r?.unite ?? 'g',
      options: Object.keys(UNITE).map((u) => [u, libelle('UNITE', u)]) },
    { cle: 'etat', type: 'choix', libelle: 'État du poids', valeur: etatPropose,
      options: [...(etatPropose ? [] : [[null, 'choisir…']]), ...Object.keys(ETAT_POIDS).map((x) => [x, libelle('ETAT_POIDS', x)])],
      aide: 'Sec : produit sec, avant cuisson. Cru net : cru et déjà paré. Cuit : poids servi.' },
  ]);
  panneau({
    titre: `Standard maison : ${l.libelle}, ${ROLE_EN_CLAIR[l.role]}`,
    corps: [
      r ? h('p', { classe: 'aide' }, `Repère de la base, à titre indicatif : ${texteRepere(r)}.`) : null,
      ...f.noeuds,
    ],
    extras: s ? [{
      libelle: 'Effacer ce standard',
      action: (api) => { agirStrict((e, t) => supprimerStandard(e, l.cleFamille, l.role, t)); api.fermer(); },
    }] : [],
    surEnregistrer: () => {
      const v = f.lire();
      if (v.valeur === null) throw new Error('Saisissez la valeur de la portion.');
      if (v.etat === null) throw new Error('Choisissez l\'état du poids : sec, cru net ou cuit.');
      agirStrict((e, t) => definirStandard(e, l.cleFamille, l.role, { valeur: v.valeur, unite: v.unite, etat: v.etat }, t));
    },
  });
}

function ligneStandard(l) {
  const nom = `${l.libelle}, ${ROLE_EN_CLAIR[l.role]}`;
  const action = l.standard ? 'Modifier' : 'Régler';
  return h('li', { classe: 'ligne-standard' },
    h('div', { classe: 'standard-texte' },
      h('p', null, h('strong', null, l.libelle), ` ${ROLE_EN_CLAIR[l.role]}`),
      l.standard ? h('p', { classe: 'standard-valeur' }, texteStandard(l.standard)) : h('p', { classe: 'standard-valeur discret' }, 'non réglé'),
      l.repereBase ? h('p', { classe: 'meta' },
        `repère ${l.repereBase.valide ? 'validé' : 'de la base'} : ${texteRepere(l.repereBase)}${l.repereBase.portee === 'groupe' ? ' (repère du groupe)' : ''}`) : null),
    bouton(action, () => dialogStandard(l), 'court', { 'aria-label': `${action} le standard : ${nom}` }));
}

/** Minuscules sans accents, pour la recherche locale. */
const normaliser = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Standards maison : d'abord ceux qui sont réglés ou dont la famille est saisie dans un menu ; les autres sont
 * regroupés par catégorie et repliés. « À régler » est une information, jamais une alerte. Recherche locale (sans
 * enregistrement) : elle filtre toutes les lignes, réglées ou non.
 */
function sectionStandards(etat) {
  const lignes = lignesStandards(etat);
  const lignesGroupes = lignesStandardsGroupes(etat);
  const utilisees = new Set(Object.values(etat.composants).map((c) => c.famille).filter(Boolean));
  const parGroupe = GROUPES.map((g) => ({ g, lignes: [...lignesGroupes.filter((l) => l.groupe === g.cle), ...lignes.filter((l) => l.groupe === g.cle)] }));
  const toutes = parGroupe.flatMap((x) => x.lignes);
  const enUsage = (l) => l.standard !== null || utilisees.has(l.cleFamille);
  const enVue = toutes.filter(enUsage);
  const aRegler = toutes.filter((l) => l.standard === null).length;

  const defaut = () => [
    h('h3', { classe: 'bloc-titre' }, 'Réglés ou utilisés dans vos menus'),
    enVue.length === 0 ? ligneVide('Aucun standard réglé, aucune famille saisie dans un menu pour l\'instant.')
      : h('ul', { classe: 'liste-standards' }, enVue.map(ligneStandard)),
    h('h3', { classe: 'bloc-titre' }, 'Autres standards, par catégorie'),
    parGroupe.map(({ g, lignes: duGroupe }) => {
      const restantes = duGroupe.filter((l) => !enUsage(l));
      if (restantes.length === 0) return null;
      return repliable(`${g.libelle} · ${restantes.length} à régler`, false,
        h('ul', { classe: 'liste-standards' }, restantes.map(ligneStandard)), { classe: 'repliable-groupe' });
    }),
  ];
  const zone = h('div', { classe: 'zone-standards' }, defaut());
  const chercher = (ev) => {
    const q = normaliser(ev.target.value);
    if (q === '') { zone.replaceChildren(...defaut().flat().filter(Boolean)); return; }
    const trouvees = parGroupe.flatMap(({ g, lignes: duGroupe }) => duGroupe.filter((l) => normaliser(`${l.libelle} ${g.libelle}`).includes(q)));
    zone.replaceChildren(trouvees.length === 0 ? ligneVide('Aucun standard ne correspond.') : h('ul', { classe: 'liste-standards' }, trouvees.map(ligneStandard)));
  };
  return h('section', { classe: 'carte' },
    titreSection('Standards maison', 'standards'),
    h('p', { classe: 'aide' }, 'Le standard maison passe avant l\'estimation de la base. Une correction faite sur un plat ne le change pas. '
      + 'Il sert au calcul de tous les plats de cette famille qui n\'ont pas été corrigés. '
      + 'Le standard de toute la catégorie sert aux familles qui n\'ont pas le leur ; pour les légumes, il sert aussi à ceux que l\'application ne reconnaît pas (tomates…).'),
    h('p', { classe: 'meta' }, `${aRegler} à régler, à votre rythme : un standard non réglé laisse simplement la base estimer la portion.`),
    h('input', { type: 'search', classe: 'recherche-standards', 'aria-label': 'Rechercher un standard', placeholder: 'rechercher une famille ou une catégorie',
      autocomplete: 'off', onInput: chercher }),
    zone);
}

// ------------------------------------------------------------------ semaine type et capacité

function dialogJourType(numero) {
  const creneaux = creneauxDuJourSemaine(numero);
  const type = etatCourant().reglages.semaineType[numero];
  const f = champs(creneaux.map((c) => ({
    cle: c, type: 'choix', libelle: libelle('CRENEAU', c), valeur: type[c],
    options: Object.keys(ETAT_CRENEAU).map((x) => [x, libelle('ETAT_CRENEAU', x)]),
  })));
  panneau({
    titre: `Semaine type : ${JOURS[numero].toLowerCase()}`,
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((e, t) => {
        for (const c of creneaux) if (v[c] !== e.reglages.semaineType[numero][c]) definirSemaineType(e, numero, c, v[c], t);
      });
    },
  });
}

function sectionSemaineType(etat) {
  const r = etat.reglages;
  return carte('Semaine type des créneaux',
    h('p', { classe: 'aide' }, 'État par défaut de chaque créneau, modifiable jour par jour. Les créneaux réellement disponibles ne sont jamais présumés.'),
    r.semaineTypeConfirmee ? h('p', null, pastille('semaine type confirmée', 'vert')) : h('p', null, pastille('semaine type à confirmer', 'ambre')),
    [1, 2, 3, 4, 5, 6].map((n) => h('div', { classe: 'ligne-creneau' },
      h('strong', null, JOURS[n]),
      h('span', { classe: 'creneaux-etats' }, creneauxDuJourSemaine(n).map((c) => h('span', { classe: 'creneau-etat' },
        h('span', { classe: 'meta' }, `${libelle('CRENEAU', c).replace('avant le service de ', 'avant ').replace('après le service de ', 'après ').replace('avant le service du ', 'avant ')} `),
        pastilleCreneau(r.semaineType[n][c])))),
      bouton('Modifier', () => dialogJourType(n), 'court'))),
    h('div', { classe: 'actions' },
      bouton('Confirmer la semaine type', () => agir((e, t) => confirmerSemaineType(e, t)), 'principal', { disabled: r.semaineTypeConfirmee })),
    h('h3', { classe: 'bloc-titre' }, 'Capacité par créneau'),
    h('p', null, Number.isFinite(r.capaciteCreneau) ? `${r.capaciteCreneau} points de charge par créneau` : 'non renseignée : aucune alerte de capacité'),
    h('div', { classe: 'actions' }, bouton('Modifier la capacité', () => dialogCapacite(), 'court')));
}

function dialogCapacite() {
  const f = champs([{ cle: 'capacite', type: 'entier', libelle: 'Capacité par créneau (points de charge)', valeur: etatCourant().reglages.capaciteCreneau,
    aide: 'Facultative. Une tâche courte compte 1 point, moyenne 2, longue 3. Vide : aucune alerte de capacité.' }]);
  panneau({
    titre: 'Capacité par créneau',
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((e, t) => definirCapacite(e, f.valeur('capacite'), t)); },
  });
}

// ------------------------------------------------------------------ règles de préparation

function dialogRegle(r) {
  const f = champs([
    { cle: 'nom', type: 'texte', libelle: 'Nom de la préparation', valeur: r?.nom ?? '', placeholder: 'nom de la préparation' },
    { cle: 'avance', type: 'entier', libelle: 'Avance maximale validée (jours)', valeur: r?.avanceMaxJours ?? null,
      aide: 'Jusqu\'à combien de jours avant le service le chef accepte de la préparer.' },
    { cle: 'limite', type: 'entier', libelle: 'Limite d\'utilisation validée par l\'établissement (jours)', valeur: r?.limiteUtilisationJours ?? null,
      aide: 'Durée fixée par l\'établissement. L\'application ne certifie aucune conservation.' },
    { cle: 'note', type: 'zone', libelle: 'Note', valeur: r?.note ?? '', placeholder: 'note facultative' },
  ]);
  panneau({
    titre: r ? `Règle : ${r.nom}` : 'Nouvelle règle de préparation',
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((e, t) => definirRegle(e, { id: r?.id, nom: v.nom, avanceMaxJours: v.avance, limiteUtilisationJours: v.limite, note: v.note }, t));
    },
  });
}

function sectionRegles(etat) {
  const regles = Object.values(etat.regles).sort((a, b) => a.nom.localeCompare(b.nom));
  return carte('Règles de préparation',
    h('p', { classe: 'aide' }, 'L\'application ne certifie aucune conservation : ces durées sont celles que l\'établissement a validées. Sans règle, toute avance de plus de deux jours est hors règle.'),
    regles.length === 0 ? ligneVide('Aucune règle de préparation.') : regles.map((r) => h('article', { classe: 'ligne-reglage' },
      h('strong', null, r.nom),
      h('p', { classe: 'meta' }, `avance maximale validée : ${r.avanceMaxJours === null ? 'non renseignée' : pluriel(r.avanceMaxJours, 'jour')} · limite d'utilisation validée : ${r.limiteUtilisationJours === null ? 'non renseignée' : pluriel(r.limiteUtilisationJours, 'jour')}`),
      r.note ? h('p', { classe: 'meta' }, r.note) : null,
      h('div', { classe: 'actions' },
        bouton('Modifier', () => dialogRegle(r), 'court'),
        bouton('Supprimer', () => confirmer({
          titre: 'Supprimer cette règle ?', texte: r.nom, libelleOk: 'Supprimer', danger: true,
          action: () => { agirStrict((e, t) => supprimerRegle(e, r.id, t)); },
        }), 'court danger')))),
    h('div', { classe: 'actions' }, bouton('Ajouter une règle', () => dialogRegle(null), 'court')));
}

// ------------------------------------------------------------------ recettes

function dialogRecette(r) {
  const f = champs([
    { cle: 'nom', type: 'texte', libelle: 'Nom de la recette', valeur: r?.nom ?? '', placeholder: 'nom de la recette' },
    { cle: 'rendement', type: 'nombre', libelle: 'Rendement (quantité produite)', valeur: r?.rendement.valeur ?? null },
    { cle: 'unite', type: 'choix', libelle: 'Unité du rendement', valeur: r?.rendement.unite ?? 'g', options: Object.keys(UNITE).map((u) => [u, libelle('UNITE', u)]) },
    { cle: 'allergenes', type: 'cases', libelle: 'Allergènes de la recette', valeur: r?.allergenes ?? [], options: ALLERGENES },
  ]);
  const lignes = (r?.ingredients ?? []).map((i) => ({ nom: i.nom, texte: formaterNombre(i.quantite), unite: i.unite, fournisseurId: i.fournisseurId ?? null }));
  const zone = h('div', { classe: 'ingredients' });
  const dessiner = () => {
    zone.replaceChildren(...lignes.map((l, i) => h('div', { classe: 'ligne-ingredient' },
      h('input', { type: 'text', 'aria-label': `Nom de l'ingrédient ${i + 1}`, placeholder: 'ingrédient', value: l.nom, autocomplete: 'off', onInput: (ev) => { l.nom = ev.target.value; } }),
      h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `Quantité de l'ingrédient ${i + 1}`, placeholder: 'quantité', value: l.texte, autocomplete: 'off', onInput: (ev) => { l.texte = ev.target.value; } }),
      (() => {
        const s = h('select', { 'aria-label': `Unité de l'ingrédient ${i + 1}`, onChange: (ev) => { l.unite = ev.target.value; } },
          Object.keys(UNITE).map((u) => h('option', { value: u }, libelle('UNITE', u))));
        s.value = l.unite;
        return s;
      })(),
      bouton('Retirer', () => { lignes.splice(i, 1); dessiner(); }, 'court'))));
  };
  dessiner();
  panneau({
    titre: r ? `Modifier la recette ${r.nom}` : 'Nouvelle recette',
    corps: [
      r ? h('p', { classe: 'aide' }, 'Modifier crée une nouvelle version, à revalider. Les productions déjà faites ne sont pas réécrites.') : null,
      ...f.noeuds,
      h('div', { classe: 'champ' }, h('strong', null, 'Ingrédients'), zone,
        bouton('Ajouter un ingrédient', () => { lignes.push({ nom: '', texte: '', unite: 'g', fournisseurId: null }); dessiner(); }, 'court')),
    ],
    surEnregistrer: () => {
      const v = f.lire();
      const ingredients = lignes.filter((l) => l.nom.trim() !== '' || l.texte.trim() !== '').map((l) => ({
        nom: l.nom, quantite: parseNombre(l.texte, `Quantité de ${l.nom || 'l\'ingrédient'}`), unite: l.unite, fournisseurId: l.fournisseurId,
      }));
      const maj = { nom: v.nom, rendement: { valeur: v.rendement, unite: v.unite }, ingredients, allergenes: v.allergenes };
      agirStrict((e, t) => (r ? modifierRecette(e, r.id, maj, t) : creerRecette(e, maj, t)));
    },
  });
}

function sectionRecettes(etat) {
  const recettes = Object.values(etat.recettes).sort((a, b) => a.nom.localeCompare(b.nom));
  return carte('Recettes du restaurant',
    h('p', { classe: 'aide' }, 'Les fiches types de la base métier ne sont pas des recettes du restaurant : seules celles saisies et validées ici comptent.'),
    recettes.length === 0 ? ligneVide('Aucune recette.') : recettes.map((r) => h('article', { classe: 'ligne-reglage' },
      h('div', { classe: 'composant-tete' }, h('strong', null, r.nom), pastille(`version ${r.version}`, 'gris'),
        r.valide ? pastille('validée', 'vert') : pastille('à valider', 'ambre')),
      h('p', { classe: 'meta' }, `rendement : ${r.rendement.valeur === null ? 'non renseigné' : `${formaterNombre(r.rendement.valeur)} ${libelle('UNITE', r.rendement.unite)}`} · ${pluriel(r.ingredients.length, 'ingrédient')}`),
      r.ingredients.length > 0 ? h('ul', { classe: 'liste-simple petit' }, r.ingredients.map((i) => h('li', null,
        `${i.nom} : ${i.quantite === null ? 'quantité à renseigner' : `${formaterNombre(i.quantite)} ${libelle('UNITE', i.unite)}`}`))) : null,
      r.allergenes.length > 0 ? h('p', { classe: 'meta' }, `Allergènes : ${r.allergenes.map(libelleAllergene).join(', ')}`) : null,
      h('div', { classe: 'actions' },
        bouton('Modifier (nouvelle version)', () => dialogRecette(r), 'court'),
        r.valide ? null : bouton('Valider cette version', () => agir((e, t) => validerRecette(e, r.id, t)), 'court principal')))),
    h('div', { classe: 'actions' }, bouton('Ajouter une recette', () => dialogRecette(null), 'court')));
}

// ------------------------------------------------------------------ fournisseurs

function dialogFournisseur(x) {
  const f = champs([
    { cle: 'nom', type: 'texte', libelle: 'Nom du fournisseur', valeur: x?.nom ?? '', placeholder: 'nom du fournisseur' },
    { cle: 'delai', type: 'entier', libelle: 'Délai de commande (jours)', valeur: x?.delaiJours ?? null,
      aide: 'Sert à calculer l\'échéance de commande. Vide : « délai fournisseur à renseigner ».' },
    { cle: 'heure', type: 'texte', libelle: 'Heure limite', valeur: x?.heureLimite ?? '', placeholder: 'heure limite de commande' },
    { cle: 'note', type: 'zone', libelle: 'Note', valeur: x?.note ?? '', placeholder: 'note facultative' },
  ]);
  panneau({
    titre: x ? `Fournisseur : ${x.nom}` : 'Nouveau fournisseur',
    corps: f.noeuds,
    surEnregistrer: () => {
      const v = f.lire();
      agirStrict((e, t) => definirFournisseur(e, { id: x?.id, nom: v.nom, delaiJours: v.delai, heureLimite: v.heure, note: v.note }, t));
    },
  });
}

function sectionFournisseurs(etat) {
  const liste = Object.values(etat.fournisseurs).sort((a, b) => a.nom.localeCompare(b.nom));
  return carte('Fournisseurs',
    liste.length === 0 ? ligneVide('Aucun fournisseur.') : liste.map((x) => h('article', { classe: 'ligne-reglage' },
      h('strong', null, x.nom),
      h('p', { classe: 'meta' }, `délai de commande : ${x.delaiJours === null ? 'à renseigner' : pluriel(x.delaiJours, 'jour')}${x.heureLimite ? ` · heure limite : ${x.heureLimite}` : ''}`),
      x.note ? h('p', { classe: 'meta' }, x.note) : null,
      h('div', { classe: 'actions' },
        bouton('Modifier', () => dialogFournisseur(x), 'court'),
        bouton('Supprimer', () => confirmer({
          titre: 'Supprimer ce fournisseur ?', texte: x.nom, libelleOk: 'Supprimer', danger: true,
          action: () => { agirStrict((e, t) => supprimerFournisseur(e, x.id, t)); },
        }), 'court danger')))),
    h('div', { classe: 'actions' }, bouton('Ajouter un fournisseur', () => dialogFournisseur(null), 'court')));
}

// ------------------------------------------------------------------ mémoire maison (lecture)

function sectionMemoire(etat) {
  const entrees = Object.entries(etat.memoire).sort(([a], [b]) => a.localeCompare(b));
  return carte('Références maison mémorisées',
    h('p', { classe: 'aide' }, 'Lecture seule : une référence se mémorise depuis la page d\'un composant.'),
    entrees.length === 0 ? ligneVide('Aucune référence mémorisée.') : entrees.map(([cle, m]) => h('article', { classe: 'ligne-reglage' },
      h('strong', null, m.nom || cle),
      h('p', { classe: 'meta' }, `${libelle('TYPE_COMPOSANT', m.type)} · ${libelle('CATEGORIE', m.categorie)} · attribué : ${m.attribue ? 'oui' : 'non'}${m.charge ? ` · charge ${libelle('CHARGE', m.charge)}` : ''}`),
      Object.entries(m.parRole ?? {}).map(([role, v]) => h('p', { classe: 'meta' }, `grammage (${libelle('ROLE', role)}) : ${formaterNombre(v.grammage.valeur)} ${libelle('UNITE', v.grammage.unite)} · ${libelle('PROVENANCE', v.grammage.statut)}`)),
      Object.entries(m.etapes ?? {}).map(([etape, v]) => h('p', { classe: 'meta' }, `${libelle('ETAPE', etape)} : coefficient ${formaterNombre(v.coefficient)} · ${libelle('PROVENANCE', v.statut)}`)))));
}

// ------------------------------------------------------------------ journal
// Libellés lisibles des actions journalisées ; un nom inconnu s'affiche tel quel.
const LIBELLE_ACTION = {
  definirMenu: 'Intitulé de menu saisi', validerTranscription: 'Transcription validée',
  genererComposants: 'Composants proposés', ajouterComposant: 'Composant ajouté', modifierComposant: 'Composant modifié',
  validerComposant: 'Composant validé', supprimerComposant: 'Composant supprimé', validerComposantsMenu: 'Composants du menu validés',
  definirPrevision: 'Prévision modifiée', creerFiche: 'Fiche de fonction créée', modifierFiche: 'Fiche de fonction modifiée',
  annulerFiche: 'Fiche de fonction annulée', confirmerRepartition: 'Répartition confirmée', ajouterAdaptation: 'Adaptation notée',
  definirCreneau: 'État de créneau modifié', definirSemaineType: 'Semaine type modifiée', confirmerSemaineType: 'Semaine type confirmée',
  definirCapacite: 'Capacité modifiée', planifier: 'Tâche planifiée', reporter: 'Tâche reportée', demarrer: 'Tâche démarrée',
  marquerFait: 'Tâche faite', corrigerReel: 'Quantité réelle corrigée', deciderEcart: 'Écart arbitré',
  ajouterPreparatoire: 'Action préparatoire notée', supprimerProduction: 'Tâche supprimée', enregistrerPesee: 'Pesée enregistrée',
  memoriser: 'Référence maison mémorisée', reprendreMemoire: 'Référence maison reprise', definirRegle: 'Règle de préparation enregistrée',
  supprimerRegle: 'Règle de préparation supprimée', creerRecette: 'Recette créée', modifierRecette: 'Recette modifiée',
  validerRecette: 'Recette validée', definirFournisseur: 'Fournisseur enregistré', supprimerFournisseur: 'Fournisseur supprimé',
  controlerProduit: 'Produit contrôlé', definirAchat: 'Achat renseigné', marquerCommande: 'Commande marquée passée',
  saisirVentes: 'Ventes saisies', saisirApresService: 'Après service saisi',
  definirStandard: 'Standard maison réglé', supprimerStandard: 'Standard maison effacé',
  annulerFait: 'Marquage « fait » annulé', composerMelange: 'Mélange composé', noterExport: 'Sauvegarde exportée', definirMargeSecurite: 'Marge de sécurité réglée',
  saisirMenusSemaine: 'Menus de la semaine enregistrés',
};
const MOTS_TECHNIQUES = [
  ['avant_midi', 'avant midi'], ['apres_midi', 'après midi'], ['avant_soir', 'avant soir'], ['->', '→'],
  ['plat_principal', 'plat principal'], ['cru_net', 'cru net'],
  ...FAMILLES.filter((f) => f.cle.includes('_')).map((f) => [f.cle, f.libelle]),
];
/** Remplace les identifiants techniques d'un détail de journal par des mots lisibles. */
function lisible(detail) {
  let texte = String(detail);
  for (const [technique, clair] of MOTS_TECHNIQUES) texte = texte.split(technique).join(clair);
  return texte.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
}

function sectionJournal(etat) {
  const total = etat.journal.length;
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE_JOURNAL));
  pageJournal = Math.min(Math.max(0, pageJournal), pages - 1);
  const recentes = [...etat.journal].reverse().slice(pageJournal * TAILLE_PAGE_JOURNAL, (pageJournal + 1) * TAILLE_PAGE_JOURNAL);
  return carte('Journal des modifications',
    total === 0 ? ligneVide('Aucune modification enregistrée.') : [
      h('ul', { classe: 'liste-journal' }, recentes.map((j) => h('li', null, h('span', { classe: 'meta' }, `${formaterHeure(j.h)} · `), h('strong', null, LIBELLE_ACTION[j.action] ?? j.action), j.detail ? ` : ${lisible(j.detail)}` : ''))),
      h('div', { classe: 'actions' },
        bouton('‹ Plus récentes', () => { pageJournal -= 1; redessiner(); }, 'court', { disabled: pageJournal === 0 }),
        h('span', { classe: 'meta' }, `page ${pageJournal + 1} sur ${pages}`),
        bouton('Plus anciennes ›', () => { pageJournal += 1; redessiner(); }, 'court', { disabled: pageJournal >= pages - 1 })),
    ]);
}

// ------------------------------------------------------------------ sauvegarde

function telecharger(contenu, nom) {
  const url = URL.createObjectURL(contenu);
  const lien = h('a', { href: url, download: nom });
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Export : `navigator.share` avec fichier si disponible, sinon lien de téléchargement. */
function lancerExport() {
  const t = maintenant();
  const nom = nomFichierSauvegarde(t.slice(0, 10));
  const texte = exporter(etatCourant(), t);
  let fichier;
  try {
    fichier = new File([texte], nom, { type: 'application/json' });
  } catch {
    fichier = null;
  }
  const partageable = fichier && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichier] });
  if (partageable) {
    navigator.share({ files: [fichier], title: nom }).then(
      () => { agir((e, t) => noterExport(e, t), { afficher: false }); afficherMessage('Sauvegarde partagée.', 'ok'); },
      (erreur) => {
        if (erreur?.name === 'AbortError') return;
        telecharger(fichier, nom);
        agir((e, t) => noterExport(e, t), { afficher: false });
        afficherMessage('Partage impossible : la sauvegarde a été téléchargée.', 'alerte');
      });
    return;
  }
  telecharger(fichier ?? new Blob([texte], { type: 'application/json' }), nom);
  agir((e, t) => noterExport(e, t), { afficher: false });
  afficherMessage(`Sauvegarde ${nom} téléchargée.`, 'ok');
}

async function lireFichierRestauration(evenement) {
  const fichier = evenement.target.files?.[0];
  evenement.target.value = '';
  if (!fichier) return;
  let nouvelEtat;
  try {
    nouvelEtat = importer(await fichier.text());
  } catch (erreur) {
    afficherMessage(`Fichier refusé : ${erreur.message}`, 'erreur');
    return;
  }
  confirmer({
    titre: 'Remplacer toutes les données ?',
    texte: `Les données de cet appareil seront remplacées par celles du fichier « ${fichier.name} ». Cette action est irréversible : exportez d'abord si vous voulez garder l'état actuel.`,
    libelleOk: 'Remplacer mes données', danger: true,
    action: () => { remplacer(nouvelEtat, fichier.name); afficherMessage('Données restaurées.', 'ok'); },
  });
}

function dialogMarge() {
  const f = champs([{ cle: 'marge', type: 'entier', libelle: 'Marge de sécurité (%)', valeur: etatCourant().reglages.margeSecurite,
    aide: 'Facultative, de 0 à 50. Elle majore seulement la quantité proposée à commander, après une vérification chiffrée. Vide : aucune marge.' }]);
  panneau({
    titre: 'Marge de sécurité',
    corps: f.noeuds,
    surEnregistrer: () => { agirStrict((e, t) => definirMargeSecurite(e, f.valeur('marge'), t)); },
  });
}

function sectionMarge(etat) {
  const m = etat.reglages.margeSecurite;
  return carte('Commandes',
    h('p', null, Number.isInteger(m) ? `Marge de sécurité : ${m} % sur la quantité proposée à commander` : 'Marge de sécurité : aucune'),
    h('p', { classe: 'aide' }, 'Elle ne change ni le besoin calculé, ni la cible de production, ni la quantité à acheter, qui reste à votre main.'),
    h('div', { classe: 'actions' }, bouton('Modifier la marge', () => dialogMarge(), 'court')));
}

function sectionSauvegarde() {
  const entree = h('input', { type: 'file', accept: '.json,application/json', classe: 'cache', onChange: lireFichierRestauration });
  return carte('Sauvegarde',
    h('p', { classe: 'aide' }, 'Le fichier contient toutes les données saisies. Les photos de menus ne sont pas incluses.'),
    h('p', { classe: 'meta' }, etatCourant().reglages.dernierExport ? `Dernier export : ${formaterHeure(etatCourant().reglages.dernierExport)}` : 'Aucun export noté sur cet appareil.'),
    h('div', { classe: 'actions' },
      bouton('Exporter', lancerExport, 'principal'),
      h('label', { classe: 'btn' }, 'Restaurer', entree)));
}

// ------------------------------------------------------------------ stockage, hors ligne, versions

function sectionEtat() {
  const s = statutStockage();
  const hl = situationHorsLigne();
  return carte('État de l\'application',
    h('dl', { classe: 'definitions' },
      h('dt', null, 'Données'),
      h('dd', null, s.enregistre ? pastille('enregistrées sur cet appareil', 'vert') : pastille(`données non enregistrées sur cet appareil${s.raison ? ` (${s.raison})` : ''}`, 'rouge')),
      h('dt', null, 'Stockage persistant'),
      h('dd', null, s.persistant === true ? 'oui' : s.persistant === false ? 'non accordé par le navigateur' : 'non disponible ou non demandé'),
      h('dt', null, 'Mode hors ligne'),
      h('dd', null, pastille(libelleHorsLigne(hl), hl.pret ? 'vert' : hl.attente ? 'gris' : 'ambre')),
      h('dt', null, 'Version de l\'application'), h('dd', null, VERSION_APP),
      h('dt', null, 'Version de la base métier'), h('dd', null, VERSION_BASE)));
}

// ------------------------------------------------------------------ racine et sous-pages

const compteStandards = (etat) => {
  const toutes = [...lignesStandards(etat), ...lignesStandardsGroupes(etat)];
  const regles = toutes.filter((l) => l.standard !== null).length;
  return { regles, aRegler: toutes.length - regles };
};

/** Rubriques de la racine : clé de route, titre, résumé d'une ligne et blocs conservés tels quels. */
const RUBRIQUES = [
  { cle: 'standards', titre: 'Standards de production',
    resume: (e) => { const c = compteStandards(e); return `${pluriel(c.regles, 'standard réglé', 'standards réglés')} · ${c.aRegler} à régler`; },
    blocs: (e) => [sectionStandards(e), sectionMemoire(e)] },
  { cle: 'organisation', titre: 'Organisation du poste',
    resume: (e) => `${e.reglages.semaineTypeConfirmee ? 'semaine type confirmée' : 'semaine type à confirmer'} · ${pluriel(Object.keys(e.regles).length, 'règle')} de préparation`,
    blocs: (e) => [sectionSemaineType(e), sectionRegles(e)] },
  { cle: 'produits', titre: 'Produits et commandes',
    resume: (e) => `${pluriel(Object.keys(e.recettes).length, 'recette')} · ${pluriel(Object.keys(e.fournisseurs).length, 'fournisseur')}`,
    blocs: (e) => [sectionRecettes(e), sectionFournisseurs(e), sectionMarge(e)] },
  { cle: 'donnees', titre: 'Données et hors ligne',
    resume: (e) => (e.reglages.dernierExport ? `dernier export : ${formaterHeure(e.reglages.dernierExport)}` : 'aucun export noté sur cet appareil'),
    blocs: (e) => [sectionSauvegarde(), sectionEtat(), sectionJournal(e)] },
];

export const CLES_RUBRIQUES = RUBRIQUES.map((r) => r.cle);

export const titre = (param) => RUBRIQUES.find((r) => r.cle === param)?.titre ?? 'Réglages';

/** Racine (param null ou inconnu) : liste de rubriques ; sinon la sous-page de la rubrique. */
export function rendre(etat, param = null) {
  const rubrique = RUBRIQUES.find((r) => r.cle === param);
  if (!rubrique) {
    return h('div', { classe: 'vue vue-reglages' },
      h('h1', { classe: 'page-titre' }, 'Réglages'),
      h('ul', { classe: 'liste-rubriques-reglages' }, RUBRIQUES.map((r) => h('li', null,
        h('a', { href: `#/reglages/${r.cle}`, classe: 'reglage-rubrique' },
          h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, r.titre), h('span', { classe: 'meta' }, r.resume(etat))),
          h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›'))))));
  }
  return h('div', { classe: 'vue vue-reglages' },
    h('a', { href: '#/reglages', classe: 'reglage-retour' }, '‹ Réglages'),
    h('h1', { classe: 'page-titre' }, rubrique.titre),
    rubrique.blocs(etat));
}
