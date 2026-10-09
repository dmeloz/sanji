// Réglages : une racine courte (quatre rubriques) puis une sous-page par rubrique. Standards maison, références
// mémorisées, semaine type, capacité, règles de préparation, recettes, fournisseurs, marge de commande, sauvegarde,
// état de l'application et journal : aucun réglage n'a été retiré, seulement réparti.

import { ligneVerifierMiseAJour } from './nouvelle-version.js';
import {
  confirmerSemaineType, creerRecette, definirCapacite, definirFournisseur, definirMargeSecurite, definirRegle, definirSemaineType,
  definirStandard, modifierRecette, noterExport, supprimerFournisseur, supprimerRegle, supprimerStandard, validerRecette,
} from '../domaine/actions.js';
import { ajusterStandard, revenirAuStandard } from '../domaine/actions-ajustements.js';
import { lignesStandardsBase } from '../domaine/ajustements.js';
import { creneauxDuJourSemaine } from '../domaine/dates.js';
import { valeurPour } from '../domaine/validation.js';
import { exporter, importer } from '../domaine/etat.js';
import { FAMILLES, GROUPES, lignesStandards, lignesStandardsGroupes } from '../domaine/savoir.js';
import { ETAT_CRENEAU, ETAT_POIDS, UNITE, libelle } from '../domaine/statuts.js';
import { VERSION_BASE } from '../donnees/base-metier.js';
import { VERSION_APP } from '../version.js';
import { agir, agirStrict, aujourdhui, etat as etatCourant, maintenant, redessiner, remplacer, statutStockage } from '../magasin.js';
import { assistantPret, cleMasquee, effacerReglagesIA, enregistrerReglagesIA, lireReglagesIA } from './assistant-reglages.js';
import { champs } from './champs.js';
import { ouvrirValidation } from './feuille-validation.js';
import { MODELES } from './fournisseur-web.js';
import { h } from './dom.js';
import { bouton, ligneVide, pastille, repliable, titreSection } from './elements.js';
import { formaterHeure, formaterNombre, nomFichierSauvegarde, parseNombre, pluriel } from './format.js';
import { libelleHorsLigne, problemeHorsLigne, situationHorsLigne } from './horsligne.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { ALLERGENES, libelleAllergene } from './reference.js';
import { resumeApprentissage, sectionsApprentissage } from './section-apprentissage.js';
import { pageReperesMetier } from './reperes-metier.js';
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
        `standard de base (${l.repereBase.valide ? 'repère validé' : 'base métier'}) : ${texteRepere(l.repereBase)}${l.repereBase.portee === 'groupe' ? ' (repère du groupe)' : ''}`) : null),
    h('div', { classe: 'actions' },
      l.repereBase ? bouton('Valider la proposition', () => {
        const v = valeurPour(etatCourant(), l.cleFamille, l.role, aujourdhui());
        if (v) ouvrirValidation(v);
      }, 'court', { 'aria-label': `Valider la proposition : ${nom}` }) : null,
      bouton(action, () => dialogStandard(l), 'court', { 'aria-label': `${action} le standard : ${nom}` })));
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
    h('p', { classe: 'aide' }, 'Vos portions par famille de produit. Le standard maison passe avant le standard de base. Une correction faite sur un plat ne le change pas. '
      + 'Il sert au calcul de tous les plats de cette famille qui n\'ont pas été corrigés. '
      + 'Le standard de toute la catégorie sert aux familles qui n\'ont pas le leur ; pour les légumes, il sert aussi à ceux que l\'application ne reconnaît pas (tomates…).'),
    h('p', { classe: 'meta' }, `${aRegler} à régler, à votre rythme : un standard non réglé laisse simplement le standard de base donner la portion.`),
    h('input', { type: 'search', classe: 'recherche-standards', 'aria-label': 'Rechercher un standard', placeholder: 'rechercher une famille ou une catégorie',
      autocomplete: 'off', onInput: chercher }),
    zone);
}

// ------------------------------------------------------------------ standards de base et ajustements

const UNITE_BASE = { '%': '% de perte', x: '× le poids de départ', jours: 'jours', min: 'min', '°C': '°C' };
const uniteBase = (u) => UNITE_BASE[u] ?? u;
/** Usages dont le repli reste ouvert après « Revenir au standard » (sinon le repli se refermait et la ligne disparaissait). */
const repliesOuverts = new Set();
/** Oublie les replis gardés ouverts (essais). */
export function oublierReplis() { repliesOuverts.clear(); }
/** Règle du calcul (calcul.js : la cuisson n'est appliquée qu'à une portion en poids cuit) dite en clair sous un gain de cuisson. */
export const PHRASE_GAIN_SEC = 'Sans effet sur une portion saisie en poids sec (les pâtes et le riz sont souvent comptés secs) : il sert quand la portion est en poids cuit.';
function reviens(l) {
  repliesOuverts.add(l.usage);
  agir((e, t) => revenirAuStandard(e, l.sujet, l.usage, t));
  afficherMessage('Valeur de base rétablie', 'ok');
}
const PROVENANCE_BASE = { propriete: 'votre valeur', referentiel: 'référentiel', base_metier: 'base métier' };

function texteBornes(f, unite) {
  if (!f) return '';
  const n = formaterNombre;
  const t = f.min !== null && f.max !== null ? (f.min === f.max ? n(f.min) : `${n(f.min)}–${n(f.max)}`)
    : f.min !== null ? `au moins ${n(f.min)}` : `au plus ${n(f.max)}`;
  return `${t} ${uniteBase(unite)}`;
}

function dialogAjustement(l) {
  const f = champs([
    { cle: 'valeur', type: 'nombre', libelle: `Votre valeur (${uniteBase(l.base.unite)})`, valeur: l.effectif.valeur,
      aide: `Standard de base : ${formaterNombre(l.base.valeur)} ${uniteBase(l.base.unite)}. La virgule est acceptée.` },
  ]);
  panneau({
    titre: `Changer : ${l.libelle} (${l.usageTitre})`,
    corps: [h('p', { classe: 'aide' }, 'Votre valeur passe devant le standard de base, pour tous les plats concernés.'), ...f.noeuds],
    extras: l.ajuste ? [{ libelle: 'Revenir au standard', action: (api) => { repliesOuverts.add(l.usage); agirStrict((e, t) => revenirAuStandard(e, l.sujet, l.usage, t)); afficherMessage('Valeur de base rétablie', 'ok'); api.fermer(); } }] : [],
    surEnregistrer: () => {
      const v = f.lire().valeur;
      if (v === null) throw new Error('Saisissez la valeur.');
      const res = agirStrict((e, t) => ajusterStandard(e, l.sujet, l.usage, v, t));
      if (res.avertissement) afficherMessage(res.avertissement, 'alerte');
    },
  });
}

function ligneBase(l) {
  const eff = l.effectif;
  const nom = `${l.libelle} (${l.usageTitre})`;
  return h('li', { classe: 'ligne-standard ligne-standard-base' },
    h('div', { classe: 'standard-texte' },
      h('p', null, h('strong', null, l.libelle)),
      h('p', { classe: 'standard-valeur' }, `${formaterNombre(eff.valeur)} ${uniteBase(eff.unite)}`, ' ',
        pastille(PROVENANCE_BASE[eff.origine] ?? eff.origine, eff.ajuste ? 'vert' : 'gris')),
      h('p', { classe: 'meta' }, `Fourchette : ${texteBornes(l.base.fourchette, l.base.unite)}`),
      l.usage === 'rendement_cuisson' && eff.unite === 'x' ? h('p', { classe: 'meta phrase-gain-sec' }, PHRASE_GAIN_SEC) : null,
      l.base.ecart ? h('p', { classe: 'meta' },
        `Écart : référentiel ${texteBornes(l.base.ecart.referentiel, l.base.unite)}, base métier ${texteBornes(l.base.ecart.base_metier, l.base.unite)}`) : null,
      l.ajuste && eff.ajustement.avant?.valeur !== null && eff.ajustement.avant?.valeur !== undefined
        ? h('p', { classe: 'meta' }, `Standard de base : ${formaterNombre(eff.ajustement.avant.valeur)} ${uniteBase(eff.unite)}`) : null),
    h('div', { classe: 'actions' },
      bouton('Changer', () => dialogAjustement(l), 'court', { 'aria-label': `Changer la valeur : ${nom}` }),
      l.ajuste ? bouton('Revenir au standard', () => reviens(l), 'court',
        { 'aria-label': `Revenir au standard de base : ${nom}` }) : null));
}

const texteChanges = (n, total) => (n === 0 ? `${total} valeur${total > 1 ? 's' : ''} de base` : `${n} sur ${total} changée${n > 1 ? 's' : ''} par vous`);

/** Standards de base : une ligne par sujet rattaché, repliée par usage ; « Changer » ouvre un panneau, la valeur passe devant. */
function sectionStandardsBase(etat) {
  return h('section', { classe: 'carte' },
    h('p', { classe: 'aide', id: 'standards-base' }, 'Rendements, conservation, cuissons et températures. On part de ce que disent les manuels. Quand la réalité de votre cuisine est différente, changez la valeur : '
      + 'votre valeur passe devant, pour toujours. « Revenir au standard » rétablit la valeur de base.'),
    lignesStandardsBase(etat).map((u) => (u.lignes.length === 0 ? null
      : repliable(`${u.titre} · ${texteChanges(u.lignes.filter((l) => l.ajuste).length, u.lignes.length)}`, u.lignes.some((l) => l.ajuste) || repliesOuverts.has(u.usage),
        h('ul', { classe: 'liste-standards' }, u.lignes.map((l) => ligneBase({ ...l, usageTitre: u.titre }))), { classe: 'repliable-groupe' }))));
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
  const existantes = r?.etapes ?? [];
  const defsEtapes = [];
  for (let i = 1; i <= MAX_ETAPES; i += 1) {
    defsEtapes.push({ cle: `etape${i}`, type: 'texte', libelle: `Étape ${i} : libellé`, valeur: existantes[i - 1]?.libelle ?? '',
      placeholder: i === 1 ? 'première étape (facultatif)' : 'facultatif' });
    defsEtapes.push({ cle: `avanceEtape${i}`, type: 'entier', libelle: `Étape ${i} : avance maximale (jours)`,
      valeur: existantes[i - 1]?.avanceMaxJours ?? null, placeholder: 'vide = non définie' });
  }
  const fe = champs(defsEtapes);
  const aideEtapes = h('div', { classe: 'aide' },
    h('strong', null, 'Étapes (facultatif)'),
    h('p', null, 'Dans l\'ordre du travail ; la dernière étape est la finition (0 jour d\'avance si vous ne dites rien). '
      + 'Laissez l\'avance vide si elle n\'est pas définie : elle n\'est alors jamais autorisée au-delà de deux jours. '
      + 'L\'avance d\'une étape n\'est pas une durée de conservation de la préparation finie. Sans étape (ou avec une seule), rien ne change.'));
  panneau({
    titre: r ? `Règle : ${r.nom}` : 'Nouvelle règle de préparation',
    corps: [...f.noeuds, aideEtapes, ...fe.noeuds],
    surEnregistrer: () => {
      const v = f.lire();
      const ve = fe.lire();
      const etapes = [];
      // Une étape garde la clé de SA POSITION dans l'éditeur : renommée, elle reste attachée à ses productions
      // (planification, état « fait »). Une ligne sans étape existante reçoit une clé nouvelle et unique.
      const prises = new Set();
      for (let i = 1; i <= MAX_ETAPES; i += 1) {
        const libelleEtape = String(ve[`etape${i}`] ?? '').trim();
        const avance = ve[`avanceEtape${i}`];
        if (libelleEtape === '' && avance === null) continue;
        const cle = existantes[i - 1]?.cle;
        if (cle) prises.add(cle);
        etapes.push({ cle, libelle: libelleEtape, avanceMaxJours: avance });
      }
      for (const x of etapes) {
        if (x.cle) continue;
        const base = normaliser(x.libelle).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'etape';
        let cle = base;
        for (let n = 2; prises.has(cle); n += 1) cle = `${base}-${n}`;
        prises.add(cle);
        x.cle = cle;
      }
      agirStrict((e, t) => definirRegle(e, { id: r?.id, nom: v.nom, avanceMaxJours: v.avance, limiteUtilisationJours: v.limite, note: v.note, etapes }, t));
    },
  });
}

const MAX_ETAPES = 6;

/** « Couper (avance max 3 jours) → Blanchir (avance non définie) → Finir (0 jour) » */
function texteEtapes(etapes) {
  return etapes.map((x, i) => {
    const derniere = i === etapes.length - 1;
    const avance = x.avanceMaxJours === null ? (derniere ? '0 jour par défaut' : 'avance non définie') : `avance max ${pluriel(x.avanceMaxJours, 'jour')}`;
    return `${x.libelle} (${avance})`;
  }).join(' → ');
}

function sectionRegles(etat) {
  const regles = Object.values(etat.regles).sort((a, b) => a.nom.localeCompare(b.nom));
  return carte('Règles de préparation',
    h('p', { classe: 'aide' }, 'L\'application ne certifie aucune conservation : ces durées sont celles que l\'établissement a validées. Sans règle, toute avance de plus de deux jours est hors règle.'),
    regles.length === 0 ? ligneVide('Aucune règle de préparation.') : regles.map((r) => h('article', { classe: 'ligne-reglage' },
      h('strong', null, r.nom),
      h('p', { classe: 'meta' }, `avance maximale validée : ${r.avanceMaxJours === null ? 'non renseignée' : pluriel(r.avanceMaxJours, 'jour')} · limite d'utilisation validée : ${r.limiteUtilisationJours === null ? 'non renseignée' : pluriel(r.limiteUtilisationJours, 'jour')}`),
      (r.etapes ?? []).length > 0 ? h('p', { classe: 'meta' }, `étapes : ${texteEtapes(r.etapes)}`) : null,
      (r.etapes ?? []).length > 0 ? h('p', { classe: 'aide' }, 'L\'avance d\'une étape n\'est pas une durée de conservation de la préparation finie.') : null,
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
  definirPrevision: 'Prévision modifiée', definirCouvertsMidi: 'Couverts midi enregistrés', creerFiche: 'Fiche de fonction créée', modifierFiche: 'Fiche de fonction modifiée',
  annulerFiche: 'Fiche de fonction annulée', confirmerRepartition: 'Répartition confirmée', ajouterAdaptation: 'Adaptation notée',
  definirCreneau: 'État de créneau modifié', definirSemaineType: 'Semaine type modifiée', confirmerSemaineType: 'Semaine type confirmée',
  definirCapacite: 'Capacité modifiée', planifier: 'Tâche planifiée', reporter: 'Tâche reportée', demarrer: 'Tâche démarrée',
  marquerFait: 'Tâche faite', corrigerReel: 'Quantité réelle corrigée', deciderEcart: 'Écart arbitré',
  ajouterPreparatoire: 'Action préparatoire notée', supprimerProduction: 'Tâche supprimée', enregistrerPesee: 'Pesée enregistrée',
  memoriser: 'Référence maison mémorisée', reprendreMemoire: 'Référence maison reprise', definirRegle: 'Règle de préparation enregistrée', etapesRetirees: 'Étape retirée (règle modifiée)',
  supprimerRegle: 'Règle de préparation supprimée', creerRecette: 'Recette créée', modifierRecette: 'Recette modifiée',
  validerRecette: 'Recette validée', definirFournisseur: 'Fournisseur enregistré', supprimerFournisseur: 'Fournisseur supprimé',
  controlerProduit: 'Produit contrôlé', definirAchat: 'Achat renseigné', marquerCommande: 'Commande marquée passée',
  saisirVentes: 'Ventes saisies', saisirApresService: 'Après service saisi',
  definirStandard: 'Standard maison réglé', supprimerStandard: 'Standard maison effacé',
  annulerFait: 'Marquage « fait » annulé', composerMelange: 'Mélange composé', noterExport: 'Sauvegarde exportée', definirMargeSecurite: 'Marge de sécurité réglée',
  saisirMenusSemaine: 'Menus de la semaine enregistrés', reinitialiserSemaine: 'Semaine réinitialisée',
  validerStandard: 'Portion validée comme standard maison', corrigerStandard: 'Standard maison corrigé',
  reporterValidation: 'Validation reportée à plus tard',
  ajusterStandard: 'Valeur de base changée', revenirAuStandard: 'Valeur de base rétablie',
  accepterApprentissage: 'Proposition acceptée comme standard maison', ecarterApprentissage: 'Proposition écartée',
  restaurer: 'Sauvegarde restaurée', noterAchat: 'Ligne notée à commander', retirerAchat: 'Ligne retirée de la liste', restaurerAchat: 'Ligne remise dans la liste',
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

// Détails de journal en phrases : les clés de champ, codes de décision et clés de produit enregistrés tels quels
// (« allergenes », « complement », « carottes|kg ») se lisent ici ; rien n'est changé dans les entrées enregistrées.
const MOTS_CHAMPS = {
  nom: 'nom', categorie: 'catégorie', attribue: 'attribution au poste', type: 'type', role: 'rôle', produitNom: 'produit acheté',
  grammage: 'portion', etapes: 'étapes', recetteId: 'recette', charge: 'charge de travail', allergenes: 'allergènes',
  numero: 'numéro', date: 'jour', service: 'service', horaire: 'horaire', couverts: 'couverts', mode: 'mode',
  menuFixe: 'menu fixé', repartition: 'répartition', allergies: 'allergies', remarques: 'remarques',
};
const DECISIONS_ECART = { complement: 'complément à produire', ajustement: 'écart réglé par ajustement', aucune: 'aucune production supplémentaire' };

/** Applique `f` à la partie après le dernier « : » du détail. */
function apresDernierDeuxPoints(detail, f) {
  const i = detail.lastIndexOf(' : ');
  return i < 0 ? detail : `${detail.slice(0, i)} : ${f(detail.slice(i + 3))}`;
}
/** « carottes|kg » en tête du détail : « carottes (kg) ». */
const produitLisible = (detail) => detail.replace(/^([^|:]+)\|(\S+?)(?= : |$)/, (_, nom, unite) => `${nom.replace(/_/g, ' ')} (${libelle('UNITE', unite)})`);
const listeChamps = (liste) => liste.split(', ').map((k) => MOTS_CHAMPS[k] ?? k).join(', ');

const DETAIL_JOURNAL = {
  modifierComposant: (d) => apresDernierDeuxPoints(d, listeChamps),
  reprendreMemoire: (d) => apresDernierDeuxPoints(d, listeChamps),
  modifierFiche: (d) => apresDernierDeuxPoints(d, listeChamps),
  deciderEcart: (d) => apresDernierDeuxPoints(d, (x) => DECISIONS_ECART[x] ?? x),
  controlerProduit: (d) => apresDernierDeuxPoints(produitLisible(d), (x) => libelle('VERIF', x)),
  noterAchat: produitLisible, retirerAchat: produitLisible, restaurerAchat: produitLisible, definirAchat: produitLisible,
  marquerCommande: produitLisible,
  definirCreneau: (d) => apresDernierDeuxPoints(d, (x) => libelle('ETAT_CRENEAU', x)),
  definirSemaineType: (d) => apresDernierDeuxPoints(d, (x) => libelle('ETAT_CRENEAU', x)),
  noterExport: () => '', // le détail enregistré est l'heure, déjà affichée en tête de ligne
  restaurer: (d) => (d ? `depuis ${d}` : ''),
};

const TEXTE_NEUTRE_JOURNAL = 'Modification enregistrée';
const USAGE_JOURNAL = {
  rendement_parage: () => 'Perte de parage', rendement_cuisson: (u) => (u === 'x' ? 'Gain de cuisson' : 'Perte de cuisson'),
  conservation: () => 'Conservation', cuisson_temps: () => 'Temps de cuisson', temperature: () => 'Température',
};
const enMinuscule = (t) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * Phrase du journal pour une entrée : une table de traduction des types d'entrée en phrases ; une entrée de type inconnu
 * garde un texte neutre (jamais un identifiant technique). Les changements de valeur de base se disent en clair :
 * « Gain de cuisson, pâtes sèches : 2,65 → 2,5 (votre valeur) ».
 * @returns {{titre:string, detail:string}} `detail` vide quand le titre est déjà la phrase complète.
 */
export function phraseJournal(etat, j) {
  const detail = String(j.detail ?? '');
  if (j.action === 'ajusterStandard' || j.action === 'revenirAuStandard') {
    const m = /^([a-z_]+)\|(\S+) : (.*)$/.exec(detail);
    const usage = m && USAGE_JOURNAL[m[1]] ? m[1] : null;
    if (!usage) return { titre: LIBELLE_ACTION[j.action], detail: '' };
    const ligne = lignesStandardsBase(etat).find((u) => u.usage === usage)?.lignes.find((l) => l.sujet === m[2]);
    const sujet = ligne ? enMinuscule(ligne.libelle) : lisible(m[2].replace(/^(regle|groupe):/, '')).replace(/_/g, ' ');
    const v = /^([\d.,-]+) (\S+) \(standard de base\) → ([\d.,-]+) \S+ \(votre valeur\)(?: ; (.*))?$/.exec(m[3]);
    const tete = `${USAGE_JOURNAL[usage](v?.[2] ?? ligne?.base?.unite)}, ${sujet}`;
    if (j.action === 'revenirAuStandard') return { titre: `${tete} : valeur de base rétablie`, detail: '' };
    if (!v) return { titre: `${tete} : valeur changée`, detail: '' };
    const unite = v[2] === 'x' ? '' : ` ${uniteBase(v[2]).replace(/^% de perte$/, '%')}`;
    return { titre: `${tete} : ${v[1]} → ${v[3]}${unite} (votre valeur)${v[4] ? ` ; ${v[4]}` : ''}`, detail: '' };
  }
  const titreAction = LIBELLE_ACTION[j.action];
  if (!titreAction) return { titre: TEXTE_NEUTRE_JOURNAL, detail: '' };
  const phrase = (DETAIL_JOURNAL[j.action] ?? ((d) => d))(detail);
  // Le nom du fichier restauré reste tel quel (sa date ne se réécrit pas).
  return { titre: titreAction, detail: phrase && j.action !== 'restaurer' ? lisible(phrase) : phrase };
}

function sectionJournal(etat) {
  const total = etat.journal.length;
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE_JOURNAL));
  pageJournal = Math.min(Math.max(0, pageJournal), pages - 1);
  const recentes = [...etat.journal].reverse().slice(pageJournal * TAILLE_PAGE_JOURNAL, (pageJournal + 1) * TAILLE_PAGE_JOURNAL);
  return carte('Journal des modifications',
    total === 0 ? ligneVide('Aucune modification enregistrée.') : [
      h('ul', { classe: 'liste-journal' }, recentes.map((j) => {
        const { titre: t, detail } = phraseJournal(etat, j);
        return h('li', null, h('span', { classe: 'meta' }, `${formaterHeure(j.h)} · `), h('strong', null, t), detail ? ` : ${detail}` : '');
      })),
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
        afficherMessage('Sauvegarde téléchargée.', 'ok');
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
    nouvelEtat = importer(await fichier.text(), aujourdhui());
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

// ------------------------------------------------------------------ assistant IA (hors sauvegarde)

function dialogCleAssistant() {
  const f = champs([{ cle: 'cle', type: 'motdepasse', libelle: "Clé d'API Anthropic", valeur: '', placeholder: 'sk-ant-…',
    aide: 'Collez la clé (elle commence par sk-ant-). Elle reste sur cet appareil, n\'est jamais dans la sauvegarde ni dans le journal, et n\'est jamais affichée en entier.' }]);
  panneau({
    titre: "Clé d'API",
    corps: f.noeuds,
    surEnregistrer: () => {
      enregistrerReglagesIA({ cle: f.valeur('cle') });
      afficherMessage('Clé enregistrée sur cet appareil.', 'ok');
      redessiner();
    },
  });
}

function dialogModeleAssistant() {
  const reglages = lireReglagesIA();
  const f = champs([{ cle: 'modele', type: 'choix', libelle: 'Modèle', valeur: reglages.modele,
    options: MODELES.map((m) => [m.id, `${m.libelle} (${m.note})`]) }]);
  panneau({
    titre: "Modèle de l'assistant",
    corps: f.noeuds,
    surEnregistrer: () => { enregistrerReglagesIA({ modele: f.valeur('modele') }); redessiner(); },
  });
}

/** Assistant IA : réglages stockés HORS de l'état (donc hors sauvegarde). Rien n'est envoyé tant que l'assistant n'est pas activé. */
function sectionAssistant() {
  const r = lireReglagesIA();
  const statut = r.actif && r.cle !== '' ? pastille('activé', 'vert') : r.actif ? pastille('clé manquante', 'ambre') : pastille('désactivé', 'gris');
  const modele = MODELES.find((m) => m.id === r.modele);
  return carte('Assistant IA',
    h('p', { classe: 'aide' }, 'Sanji calcule toujours seul. L\'assistant, s\'il est activé, propose un planning que Sanji recontrôle entièrement ; vous validez avant tout enregistrement. '
      + 'Il reçoit les noms des composants, les portions et un brouillon de départ ; les fiches de fonction et les allergies ne sont pas transmises. '
      + 'Les noms viennent de vos menus : évitez d\'y écrire des remarques sur une personne. '
      + 'La clé est enregistrée en clair sur cet appareil : utilisez une clé réservée à Sanji, avec une limite de dépense basse chez Anthropic.'),
    h('dl', { classe: 'definitions' },
      h('dt', null, 'État'), h('dd', null, statut),
      h('dt', null, 'Clé'), h('dd', null, cleMasquee(r.cle)),
      h('dt', null, 'Modèle'), h('dd', null, modele ? modele.libelle : r.modele)),
    h('p', { classe: 'meta' }, 'Les réglages restent sur cet appareil. Chaque proposition envoie une requête à Anthropic et coûte quelques centimes, à votre charge.'),
    h('div', { classe: 'actions' },
      bouton(r.actif ? 'Désactiver' : 'Activer', () => { enregistrerReglagesIA({ actif: !r.actif }); redessiner(); }, r.actif ? '' : 'principal'),
      bouton(r.cle === '' ? 'Saisir la clé' : 'Changer la clé', dialogCleAssistant, 'court'),
      bouton('Choisir le modèle', dialogModeleAssistant, 'court'),
      r.cle === '' ? null : bouton('Effacer la clé', () => confirmer({
        titre: 'Effacer la clé ?', texte: "La clé sera supprimée de cet appareil et l'assistant désactivé.", libelleOk: 'Effacer', danger: true,
        action: () => { effacerReglagesIA(); afficherMessage('Clé effacée.', 'ok'); redessiner(); },
      }), 'court')));
}

// ------------------------------------------------------------------ racine et sous-pages

const compteStandards = (etat) => {
  const toutes = [...lignesStandards(etat), ...lignesStandardsGroupes(etat)];
  const regles = toutes.filter((l) => l.standard !== null).length;
  return { regles, aRegler: toutes.length - regles };
};

/** Rubriques de la racine : clé de route, titre, résumé d'une ligne et blocs conservés tels quels. */
const RUBRIQUES = [
  { cle: 'standards-base', titre: 'Standards de base',
    resume: (e) => { const n = Object.keys(e.ajustements ?? {}).length; return n === 0 ? 'aucune valeur changée' : `${pluriel(n, 'valeur changée', 'valeurs changées')} par vous`; },
    blocs: (e) => [sectionStandardsBase(e)] },
  { cle: 'standards', titre: 'Standards maison',
    resume: (e) => { const c = compteStandards(e); return `${pluriel(c.regles, 'standard réglé', 'standards réglés')} · ${c.aRegler} à régler`; },
    blocs: (e) => [h('p', { classe: 'aide' }, h('a', { href: '#/reglages/standards-base' }, 'Standards de base : changer une valeur de départ ›')),
      sectionStandards(e), sectionMemoire(e)] },
  { cle: 'reperes', titre: 'Repères métier',
    resume: () => 'temps, températures, conservation, techniques : consultation',
    blocs: () => { const c = h('div'); pageReperesMetier(c, { sansTitre: true, etat: etatCourant() }); return [c]; } },
  { cle: 'organisation', titre: 'Organisation du poste',
    resume: (e) => `${e.reglages.semaineTypeConfirmee ? 'semaine type confirmée' : 'semaine type à confirmer'} · ${pluriel(Object.keys(e.regles).length, 'règle')} de préparation`,
    blocs: (e) => [sectionSemaineType(e), sectionRegles(e)] },
  { cle: 'produits', titre: 'Produits et commandes',
    resume: (e) => `${pluriel(Object.keys(e.recettes).length, 'recette')} · ${pluriel(Object.keys(e.fournisseurs).length, 'fournisseur')}`,
    blocs: (e) => [sectionRecettes(e), sectionFournisseurs(e), sectionMarge(e)] },
  { cle: 'assistant-ia', titre: 'Assistant IA',
    resume: () => { const r = lireReglagesIA(); return assistantPret(r) ? `activé · ${r.modele}` : 'désactivé : Sanji calcule seul'; },
    blocs: () => [sectionAssistant()] },
  { cle: 'apprentissage', titre: 'Apprentissage et essais',
    resume: resumeApprentissage,
    blocs: (e) => sectionsApprentissage(e) },
  { cle: 'donnees', titre: 'Données et hors ligne',
    resume: (e) => (e.reglages.dernierExport ? `dernier export : ${formaterHeure(e.reglages.dernierExport)}` : 'aucun export noté sur cet appareil'),
    blocs: (e) => [sectionSauvegarde(), sectionEtat(), sectionJournal(e)] },
];

export const CLES_RUBRIQUES = RUBRIQUES.map((r) => r.cle);

export const titre = (param) => RUBRIQUES.find((r) => r.cle === param)?.titre ?? 'Réglages';

// Racine (refonte 1) : sections de lignes ; aucune règle métier n'est réglable ici.

const rubriqueDe = (cle) => RUBRIQUES.find((r) => r.cle === cle);

/** Ligne qui mène quelque part : titre, résumé et chevron. Toute la ligne est la cible (44 px au moins). */
function ligneLien(href, titreTexte, resumeTexte, pastilleLigne = null) {
  return h('li', null,
    h('a', { href, classe: 'reglage-rubrique' },
      h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, titreTexte), resumeTexte ? h('span', { classe: 'meta' }, resumeTexte) : null, pastilleLigne),
      h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›')));
}

const ligneRubrique = (cle, etat, pastilleLigne = null) => ligneLien(`#/reglages/${cle}`, rubriqueDe(cle).titre, rubriqueDe(cle).resume(etat), pastilleLigne);

/** Ligne d'information, sans réglage : ce n'est pas un lien. */
const ligneInfo = (titreTexte, valeur) => h('li', { classe: 'reglage-info' },
  h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, titreTexte), h('span', { classe: 'meta' }, valeur)));

const groupe = (titreTexte, ...lignes) => h('section', { classe: 'reglages-groupe' },
  h('h2', { classe: 'reglages-groupe-titre' }, titreTexte),
  h('ul', { classe: 'liste liste-rubriques-reglages' }, lignes));

/** Pastille du pied : neutre pendant la vérification, verte une fois prêt, ambre en cas de problème. */
function pastilleHorsLigne(hl) {
  if (hl.attente) return pastille('Vérification en cours', 'gris');
  return problemeHorsLigne(hl) ? pastille('Hors ligne pas encore prêt', 'ambre') : pastille('Fonctionne hors ligne', 'vert');
}

/** Racine (param null ou inconnu) : sections de lignes ; sinon la sous-page de la rubrique. */
export function rendre(etat, param = null) {
  const rubrique = RUBRIQUES.find((r) => r.cle === param);
  if (!rubrique) {
    const hl = situationHorsLigne();
    return h('div', { classe: 'vue vue-reglages vue-reglages-racine' },
      h('a', { href: '#/aujourdhui', classe: 'reglage-retour' }, '‹ Aujourd\'hui'),
      h('h1', { classe: 'page-titre' }, 'Réglages'),
      groupe('Production',
        ligneInfo('Avance normale', '2 jours (règle)'),
        ligneRubrique('standards-base', etat),
        ligneRubrique('standards', etat),
        ligneRubrique('reperes', etat)),
      groupe('Poste',
        ligneRubrique('organisation', etat, etat.reglages.semaineTypeConfirmee ? null : pastille('à confirmer', 'ambre')),
        ligneRubrique('produits', etat),
        ligneLien('#/import', 'Import des menus', 'saisie de la semaine')),
      groupe('Assistant', ligneRubrique('assistant-ia', etat, assistantPret(lireReglagesIA()) ? pastille('activé', 'vert') : null)),
      groupe('Données',
        ligneRubrique('apprentissage', etat),
        ligneRubrique('donnees', etat),
        ligneInfo('Version', `Sanji ${VERSION_APP}`)),
      ligneVerifierMiseAJour(),
      h('p', { classe: 'reglages-note' }, 'Apparence : toujours claire. Écran allumé : en Production et en mode poste.'),
      h('p', { classe: 'reglages-pied' }, pastilleHorsLigne(hl), ' ', h('span', { classe: 'meta' }, libelleHorsLigne(hl))));
  }
  return h('div', { classe: 'vue vue-reglages' },
    h('a', { href: '#/reglages', classe: 'reglage-retour' }, '‹ Réglages'),
    h('h1', { classe: 'page-titre' }, rubrique.titre),
    rubrique.blocs(etat));
}
