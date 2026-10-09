// A-P0 : tests de non-régression posés AVANT la refonte du Tableau, de la feuille Jour et des Réglages.
// Ils verrouillent ce qui ne doit jamais se perdre : aucun lien mort, aucune tâche qui disparaît, un « fait » qui survit
// à une sauvegarde et à un changement de prévision, tous les blocs de Réglages. Si la refonte déplace légitimement
// un bloc (Réglages, A-P2), le test d'inventaire se met à jour consciemment, pas silencieusement.
// Faux DOM : ce n'est pas un test dans un navigateur (mise en page, IndexedDB réelle, iOS : non couverts).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import {
  corrigerReel, creerFiche, definirMenu, definirPrevision, definirRegle, definirStandard, marquerFait, planifier, reporter, supprimerComposant,
} from '../app/js/domaine/actions.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { feuilleDuJour } from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let routeur;
let vues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  // Les vues-relais du routeur (clés = adresses) plus les vues d'origine sous leurs anciens noms : les relais délèguent à celles-ci.
  vues = {
    ...routeur.VUES,
    tableau: await import('../app/js/ui/vue-tableau.js'),
    menus: await import('../app/js/ui/vue-menus.js'),
    detail: await import('../app/js/ui/vue-detail.js'),
    jour: await import('../app/js/ui/vue-production.js'),
    composant: await import('../app/js/ui/vue-composant.js'),
    produits: await import('../app/js/ui/vue-produits.js'),
    stock: await import('../app/js/ui/vue-stock.js'), // vue masquée (2026-10-07) : toujours rendue ici pour vérifier ses liens
  };
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

/** Un samedi : menus de la semaine suivante saisis, aucune quantité (ni prévision, ni standard). */
function semaineSansQuantites() {
  const e = etatVide();
  definirMenu(e, S.lundiSuivant, 1, 'riz, carottes', h());
  definirMenu(e, S.lundiSuivant, 2, 'courgettes, quinoa', h());
  return e;
}

/** Même semaine, avec prévisions, standards, une fiche et de l'avance déjà prise. */
function semaineComplete() {
  const e = semaineSansQuantites();
  prevision(e, S.lundiSuivant, 1, 40);
  prevision(e, S.lundiSuivant, 2, 20);
  // Le riz du menu 1 se fait le jour même, sauf exception validée (ici : avance de 2 jours).
  definirRegle(e, { nom: 'riz', avanceMaxJours: 2 }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  creerFiche(e, { numero: 'F1', date: S.lundiSuivant, service: 'midi', horaire: '12:00', couverts: 12, mode: 'menu_fixe', menuFixe: 1 }, h());
  return e;
}

const liensDe = (noeud) => noeud.tous((x) => x.balise === 'a').map((a) => a.attributs.href).filter((x) => typeof x === 'string' && x.startsWith('#/'));

// ---------------------------------------------------------------- aucun lien mort

const RENDUS = (e) => {
  const composants = Object.keys(e.composants);
  return [
    ['tableau', null], ['tableau', S.lundiSuivant], ['menus', S.lundiSuivant], ['detail', S.lundiSuivant], ['detail', S.samedi],
    ['jour', S.samedi], ['jour', S.lundiSuivant], ['produits', S.lundiSuivant], ['reglages', null],
    ['aujourdhui', null], ['production', S.samedi], ['semaine', null], ['semaine', S.samedi], ['articles', null], ['stock', S.lundiSuivant], ['import', S.lundiSuivant],
    ['reglages', 'standards'], ['reglages', 'organisation'], ['reglages', 'produits'], ['reglages', 'donnees'],
    ...composants.slice(0, 4).map((id) => ['composant', id]),
    ...composants.slice(0, 2).map((id) => ['fiche', id]),
  ];
};

// `analyserHash` renvoie toujours une vue (route inconnue = accueil) : seul le premier segment dit si une adresse est connue.
const ADRESSES_HISTORIQUES = ['accueil', 'tableau', 'jour', 'produits', 'stock', 'detail', 'composant', 'menus'];
const adresseConnue = (href) => {
  const premier = href.replace(/^#\/?/, '').split('/')[0];
  return Object.hasOwn(routeur.VUES, premier) || ADRESSES_HISTORIQUES.includes(premier);
};

test('liens : le premier segment d\'une adresse doit être connu (« #/fihce/x » est signalé)', () => {
  assert.equal(adresseConnue('#/fihce/x'), false);
  assert.equal(adresseConnue('#/stok/dlc'), false);
  for (const ok of ['#/fiche/x', '#/production/2026-10-05', '#/stock/dlc', '#/reglages', '#/aujourdhui', '#/composant/x', '#/menus/2026-10-05']) {
    assert.equal(adresseConnue(ok), true, ok);
  }
});

test('liens : chaque lien interne de chaque écran mène à une vue qui existe, avec une cible qui existe', () => {
  for (const [nom, e] of [['sans quantités', semaineSansQuantites()], ['complète', semaineComplete()]]) {
    for (const [vue, param] of RENDUS(e)) {
      magasin.remplacer(structuredClone(e));
      const noeud = aDate(S.samedi, () => vues[vue].rendre(magasin.etat(), param));
      for (const href of liensDe(noeud)) {
        assert.ok(adresseConnue(href), `${nom} / ${vue} ${param} : lien ${href} vers une adresse inconnue (premier segment)`);
        const { vue: cible, param: p } = routeur.analyserHash(href, S.samedi);
        assert.ok(Object.hasOwn(vues, cible), `${nom} / ${vue} ${param} : lien ${href} vers une vue inconnue`);
        if (cible === 'fiche') {
          assert.ok(magasin.etat().composants[p], `${nom} / ${vue} ${param} : lien ${href} vers un composant qui n'existe pas`);
        }
      }
    }
  }
});

test('liens : les adresses historiques mènent toujours à une page, et une route inconnue à Aujourd\'hui', () => {
  for (const hash of ['#/accueil', '#/tableau', '#/', '', '#/inconnu']) {
    assert.equal(routeur.analyserHash(hash, S.samedi).vue, 'aujourdhui', hash);
  }
  const attendu = { '#/jour': 'production', '#/detail': 'semaine', '#/produits': 'articles', '#/stock/dlc/2026-10-05': 'articles', '#/menus': 'import', [`#/composant/${'x'}`]: 'fiche' };
  for (const [hash, vue] of Object.entries(attendu)) assert.equal(routeur.analyserHash(hash, S.samedi).vue, vue, hash);
});

test('liens : Aujourd\'hui mène à un jour, à un plat, aux prévisions et à la semaine suivante', () => {
  const e = semaineComplete();
  magasin.remplacer(e);
  const noeud = aDate(S.samedi, () => vues.tableau.rendre(magasin.etat(), S.lundiSuivant));
  const cibles = new Set(liensDe(noeud).map((href) => routeur.analyserHash(href, S.samedi).vue));
  for (const attendu of ['semaine', 'fiche', 'import']) assert.ok(cibles.has(attendu), `le Tableau ne mène plus à « ${attendu} »`);
});

// ---------------------------------------------------------------- aucune tâche ne disparaît

test('tâches : une quantité absente ne fait jamais disparaître une tâche du samedi (elle est dite, pas cachée)', () => {
  const e = semaineSansQuantites();
  const f = feuilleDuJour(e, S.samedi);
  const visibles = new Set([
    ...f.aFaire.flatMap((g) => g.taches), ...f.attendus, ...f.dejaPret, ...f.decisions, ...f.quantitesManquantes, ...f.aAvancer,
  ].map((t) => t.productionId));
  const attendues = Object.values(e.productions).filter((p) => p.dateService === S.lundiSuivant);
  assert.ok(attendues.length >= 4, 'le jeu doit avoir des productions pour le lundi');
  for (const p of attendues) assert.ok(visibles.has(p.id), `la production ${p.libelle} du lundi n'apparaît nulle part le samedi`);
});

test('tâches : avec quantités, avance et fiche, chaque production du lundi reste visible le samedi', () => {
  const e = semaineComplete();
  const f = feuilleDuJour(e, S.samedi);
  const visibles = new Set([
    ...f.aFaire.flatMap((g) => g.taches), ...f.attendus, ...f.dejaPret, ...f.decisions, ...f.quantitesManquantes, ...f.aAvancer,
  ].map((t) => t.productionId));
  for (const p of Object.values(e.productions).filter((x) => x.dateService === S.lundiSuivant)) {
    assert.ok(visibles.has(p.id), `la production ${p.libelle} a disparu de la feuille du samedi`);
  }
});

test('tâches : un changement de prévision (40 à 46) ne supprime ni ne défait une tâche déjà faite', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 40);
  const id = principaleDe(e, composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST));
  planifier(e, id, S.mardi, 'apres_midi', h());
  marquerFait(e, id, undefined, h(1));
  const avant = structuredClone(e.productions[id]);
  definirPrevision(e, S.mercredi, 1, 46, h(2));
  const apres = e.productions[id];
  assert.ok(apres, 'la production existe encore');
  assert.equal(apres.etat, 'fait');
  assert.equal(apres.quantiteReelle, avant.quantiteReelle, 'le réel fait ne bouge pas');
  assert.deepEqual(apres.instantane, avant.instantane, 'l\'instantané du marquage ne change pas');
  const decisions = feuilleDuJour(e, S.mardi).decisions.map((d) => d.motif);
  assert.ok(decisions.includes('ecart'), 'le recalcul le dit : écart à arbitrer, rien n\'est effacé');
  corrigerReel(e, id, 2300, h(3));
  assert.equal(e.productions[id].quantiteReelle, 2300);
});

test('tâches : tout déplacement ou retrait de tâche laisse une trace dans le journal', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const id = principaleDe(e, c);
  planifier(e, id, S.mardi, 'apres_midi', h(1));
  reporter(e, id, S.lundi, 'avant_midi', h(2));
  reporter(e, id, null, null, h(3));
  const actions = e.journal.map((j) => j.action);
  for (const attendue of ['planifier', 'reporter']) assert.ok(actions.includes(attendue), `${attendue} absent du journal`);
  supprimerComposant(e, c, h(4));
  assert.ok(e.journal.some((j) => j.action === 'supprimerComposant'), 'la suppression d\'un composant est journalisée');
});

// ---------------------------------------------------------------- persistance

test('persistance : un « fait », une correction de réel et une annulation survivent à un export puis un import', () => {
  const e = semaineComplete();
  const fait = Object.values(e.productions).find((p) => e.composants[p.composantId]?.nom === 'riz');
  planifier(e, fait.id, S.samedi, 'apres_midi', h(1));
  marquerFait(e, fait.id, undefined, h(2));
  corrigerReel(e, fait.id, 2900, h(3));
  const relu = importer(exporter(e, h(4)));
  const p = relu.productions[fait.id];
  assert.equal(p.etat, 'fait');
  assert.equal(p.quantiteReelle, 2900);
  assert.deepEqual(p.instantane, e.productions[fait.id].instantane);
  assert.equal(p.jourDecide, S.samedi);
  assert.equal(Object.keys(relu.productions).length, Object.keys(e.productions).length, 'aucune production perdue');
  assert.deepEqual(Object.keys(relu.fiches), Object.keys(e.fiches), 'les fiches de fonction survivent');
  assert.equal(relu.journal.length >= e.journal.length - 1, true, 'le journal survit');
});

// ---------------------------------------------------------------- inventaire des Réglages

const RUBRIQUES_REGLAGES = ['standards-base', 'standards', 'reperes', 'organisation', 'produits', 'assistant-ia', 'apprentissage', 'donnees'];

test('inventaire : les dix blocs de Réglages existent TOUS, répartis sur les sous-pages (jamais en perdre un)', () => {
  magasin.remplacer(etatVide());
  const titresDe = (param) => vues.reglages.rendre(magasin.etat(), param).tous((x) => x.balise === 'h2').map((x) => x.textContent);
  const parPage = {
    standards: ['Standards maison', 'Références maison mémorisées'],
    organisation: ['Semaine type des créneaux', 'Règles de préparation'],
    produits: ['Recettes du restaurant', 'Fournisseurs', 'Commandes'],
    donnees: ['Sauvegarde', "État de l'application", 'Journal des modifications'],
  };
  assert.equal(Object.values(parPage).flat().length, 10);
  for (const [rubrique, attendus] of Object.entries(parPage)) {
    const titres = titresDe(rubrique);
    for (const attendu of attendus) assert.ok(titres.includes(attendu), `le bloc « ${attendu} » a disparu de la sous-page ${rubrique}`);
  }
  // La racine reste courte : aucun des dix blocs, seulement des titres de section et les six rubriques (plus retour et Import des menus).
  const racine = vues.reglages.rendre(magasin.etat(), null);
  const blocs = Object.values(parPage).flat();
  assert.deepEqual(racine.tous((x) => x.balise === 'h2').map((x) => x.textContent).filter((t) => blocs.includes(t)), []);
  assert.deepEqual(liensDe(racine).filter((l) => l.startsWith('#/reglages/')), RUBRIQUES_REGLAGES.map((c) => `#/reglages/${c}`));
});

test('routeur : #/reglages est la racine, #/reglages/<rubrique> une sous-page, une clé inconnue retombe sur la racine', () => {
  assert.deepEqual(routeur.analyserHash('#/reglages', S.samedi), { vue: 'reglages', param: null });
  for (const c of RUBRIQUES_REGLAGES) {
    assert.deepEqual(routeur.analyserHash(`#/reglages/${c}`, S.samedi), { vue: 'reglages', param: c });
    assert.equal(routeur.ONGLET_DE_VUE[routeur.analyserHash(`#/reglages/${c}`, S.samedi).vue], 'aujourdhui', 'Réglages n\'a plus d\'onglet : il s\'ouvre depuis Aujourd\'hui');
  }
  assert.deepEqual(routeur.analyserHash('#/reglages/inconnue', S.samedi), { vue: 'reglages', param: null });
  // Chaque sous-page a son titre de barre et un lien de retour « ‹ Réglages ».
  assert.equal(vues.reglages.titre(null), 'Réglages');
  magasin.remplacer(etatVide());
  for (const c of RUBRIQUES_REGLAGES) {
    assert.notEqual(vues.reglages.titre(c), 'Réglages');
    const retour = vues.reglages.rendre(magasin.etat(), c).tous((x) => x.balise === 'a' && x.textContent === '‹ Réglages');
    assert.equal(retour.length, 1, c);
    assert.equal(retour[0].attributs.href, '#/reglages');
  }
});

test('inventaire : les quatre onglets et les dix vues du routeur sont déclarés, les vues d\'origine existent encore', () => {
  assert.deepEqual(Object.keys(routeur.VUES).sort(), ['articles', 'aujourdhui', 'fiche', 'historique', 'import', 'poste', 'preparer', 'production', 'reglages', 'semaine']);
  assert.deepEqual(Object.keys(vues).sort(), [...Object.keys(routeur.VUES), 'composant', 'detail', 'jour', 'menus', 'produits', 'stock', 'tableau'].sort());
  assert.deepEqual([...new Set(Object.values(routeur.ONGLET_DE_VUE))].sort(), ['articles', 'aujourdhui', 'production', 'semaine']);
});

// ---------------------------------------------------------------- défaut connu, à corriger en A-P1 (test « rouge » assumé)

test('tâches : modifier un menu qui retire un plat non fait le dit dans le journal (correctif A-P1a)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h(1));
  prevision(e, S.lundi, 1, 40);
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h(2));
  const carottes = Object.values(e.productions).find((p) => e.composants[p.composantId]?.nom === 'carottes');
  planifier(e, carottes.id, S.samediPrecedent, 'apres_midi', h(3));
  const avant = e.journal.length;
  definirMenu(e, S.lundi, 1, 'riz, courgettes', h(4));
  assert.equal(Object.values(e.composants).some((c) => c.nom === 'carottes'), false, 'le composant retiré disparaît du menu');
  const ajoute = e.journal.slice(avant).map((j) => `${j.action} ${j.detail}`).join(' | ');
  assert.match(ajoute, /retiré carottes \(1 tâche\)/, 'le journal dit quelle tâche a été retirée');
});

test('tâches : modifier un menu ne supprime jamais une tâche déjà faite', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h(1));
  prevision(e, S.lundi, 1, 40);
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h(2));
  const carottes = Object.values(e.productions).find((p) => e.composants[p.composantId]?.nom === 'carottes');
  planifier(e, carottes.id, S.samediPrecedent, 'apres_midi', h(3));
  marquerFait(e, carottes.id, undefined, h(4));
  definirMenu(e, S.lundi, 1, 'riz, courgettes', h(5));
  assert.equal(e.productions[carottes.id]?.etat, 'fait', 'la tâche faite est conservée');
});
