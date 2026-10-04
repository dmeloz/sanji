// Fumée de l'interface sous Node avec un faux DOM : chaque vue se dessine, chaque bouton s'active, chaque panneau
// s'ouvre et se valide sans erreur de code. Ce n'est PAS un test dans un navigateur (mise en page, iOS, IndexedDB,
// service worker, photo : non couverts).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import {
  ajouterAdaptation, ajouterComposant, ajouterPreparatoire, creerFiche, definirCapacite, definirCreneau, definirFournisseur, definirMenu, definirRegle,
  definirStandard, marquerFait, memoriser, modifierComposant, planifier, saisirMenusSemaine, saisirVentes, supprimerStandard,
  controlerProduit,
} from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { exporter, jourOuVide } from '../app/js/domaine/etat.js';
import { GROUPES, grammageEffectif, lignesStandards, lignesStandardsGroupes } from '../app/js/domaine/savoir.js';
import { PORTIONS_BASE } from '../app/js/donnees/base-metier.js';
import { LIBELLE_ESTIMATION_A_VALIDER } from '../app/js/domaine/statuts.js';
import { JEU_REPERES as R, JEU_STANDARDS as ST } from './jeux/TEST_ONLY-savoir.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe, recetteValidee } from './aide.js';
import { etatReglette } from './aide-tableau.js';

let dom;
let magasin;
let vues;
let dialogues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vues = {
    tableau: await import('../app/js/ui/vue-tableau.js'),
    menus: await import('../app/js/ui/vue-menus.js'),
    detail: await import('../app/js/ui/vue-detail.js'),
    jour: await import('../app/js/ui/vue-jour.js'),
    composant: await import('../app/js/ui/vue-composant.js'),
    produits: await import('../app/js/ui/vue-produits.js'),
    reglages: await import('../app/js/ui/vue-reglages.js'),
  };
  dialogues = await import('../app/js/ui/taches.js');
});
after(() => dom.restaurer());

/** État riche construit uniquement avec le jeu TEST_ONLY. */
function etatRiche() {
  const e = etatVide();
  for (const jour of [S.lundi, S.mardi]) {
    menuValide(e, jour, 1, 'INTITULE_TEST_1');
    menuValide(e, jour, 2, 'INTITULE_TEST_2');
    prevision(e, jour, 1, 40);
    prevision(e, jour, 2, 10);
  }
  prevision(e, '2026-09-28', 1, 33);
  saisirVentes(e, '2026-09-28', 1, 31, h());
  const sec = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const cru = composantValide(e, S.lundi, 1, J.PRODUIT_CRU_TEST);
  const prep = composantValide(e, S.lundi, 2, J.PREPARATION_TEST);
  const vague = composantValide(e, S.lundi, 2, J.COMPOSANT_VAGUE_TEST);
  const recette = recetteValidee(e, J.RECETTE_TEST);
  modifierComposant(e, prep, { recetteId: recette }, h());
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre',
    repartition: { 1: 12, 2: 5 }, allergies: 'ALLERGIE_TEST', remarques: 'REMARQUE_TEST' }, h());
  creerFiche(e, { numero: 'FICHE_TEST_2', date: S.lundi, service: 'soir', horaire: '19:30', couverts: 8, mode: 'hors_menu' }, h());
  creerFiche(e, { numero: 'FICHE_TEST_3', date: S.mardi, service: 'midi', couverts: 6, mode: 'menu_fixe', menuFixe: 2, allergies: 'ALLERGIE_TEST' }, h());
  ajouterAdaptation(e, Object.keys(e.fiches)[0], 'ADAPTATION_TEST', h());
  planifier(e, principaleDe(e, sec), S.samediPrecedent, 'apres_midi', h());
  planifier(e, principaleDe(e, prep), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, vague), S.lundi, 'avant_midi', h());
  marquerFait(e, principaleDe(e, cru), null, h());
  prevision(e, S.lundi, 1, 60); // crée un écart sur la production faite
  ajouterPreparatoire(e, sec, 'ACTION_TEST', h());
  definirRegle(e, { nom: 'PREPARATION_TEST', avanceMaxJours: 3, limiteUtilisationJours: 3, note: 'NOTE_TEST' }, h());
  definirFournisseur(e, { nom: 'FOURNISSEUR_TEST', delaiJours: 2, heureLimite: '10:00' }, h());
  definirCreneau(e, S.samediPrecedent, 'avant_soir', 'charge', h());
  definirCapacite(e, 3, h());
  memoriser(e, cru, h());
  controlerProduit(e, S.lundi, 'produit_sec_test', 'g', 'a_commander', 100, h());
  return { e, ids: { sec, cru, prep, vague } };
}

const nettoyerPanneaux = () => { for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove(); };

const TEXTE_INTERDIT = /undefined|\bNaN\b|\bnull\b|\[object/;
const ERREUR_DE_CODE = /is not defined|is not a function|Cannot read|Cannot set|undefined|is not iterable|null|NaN|\[object/;

function verifierTexte(noeud, contexte) {
  const texte = noeud.textContent;
  assert.ok(texte.length > 0, `${contexte} : vue vide`);
  assert.equal(TEXTE_INTERDIT.test(texte), false, `${contexte} : texte suspect « ${texte.match(TEXTE_INTERDIT)?.[0]} »`);
  assert.equal(/compatible/i.test(texte), false, `${contexte} : le mot « compatible » est interdit`);
  return texte;
}

const pages = (ids) => [
  ['tableau', null], ['tableau', S.lundi], ['tableau', S.lundiSuivant], ['menus', S.lundi], ['detail', S.lundi], ['detail', S.mardi], ['detail', S.samedi],
  ['detail', S.dimanche], ['jour', S.lundi], ['jour', S.mardi], ['jour', S.samediPrecedent], ['jour', S.dimanchePrecedent],
  ['produits', S.lundi], ['reglages', null],
  ['reglages', 'standards'], ['reglages', 'organisation'], ['reglages', 'produits'], ['reglages', 'donnees'], ['composant', 'inconnu'],
  ...Object.values(ids).map((id) => ['composant', id]),
];

test('chaque vue se dessine avec une base vide', () => {
  magasin.remplacer(etatVide());
  for (const [vue, param] of pages({ a: 'x' })) {
    verifierTexte(vues[vue].rendre(magasin.etat(), param), `${vue} ${param} (base vide)`);
  }
});

test('chaque vue se dessine avec un état riche', () => {
  const { e, ids } = etatRiche();
  magasin.remplacer(e);
  for (const [vue, param] of pages(ids)) {
    verifierTexte(vues[vue].rendre(magasin.etat(), param), `${vue} ${param} (état riche)`);
  }
});

test('contenus attendus : tableau, détail, produits, réglages', () => {
  const { e } = etatRiche();
  magasin.remplacer(e);
  const tab = vues.tableau.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(tab, /Semaine du 5 octobre/);
  assert.match(tab, /INTITULE_TEST_1/);
  assert.match(tab, /Semaine type à confirmer/);
  assert.match(tab, /point[s]? à confirmer/);
  assert.match(tab, /allergie/);
  const det = vues.detail.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(det, /L'application répartit seule ce qui revient au poste ; corrigez seulement une exception\./);
  assert.doesNotMatch(det, /Rappel : le menu 1/);
  assert.match(det, /reprendre ce chiffre|Saisir la prévision|Modifier la prévision/);
  assert.match(det, /allergènes à confirmer/);
  assert.match(det, /Noter une adaptation décidée/);
  assert.match(det, /tâches :/);
  const samedi = vues.detail.rendre(magasin.etat(), S.samedi).textContent;
  assert.match(samedi, /Pas de menu du jour/);
  const prod = vues.produits.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(prod, /Aucun stock théorique, aucun approvisionnement garanti\./);
  assert.match(prod, /composition à définir/);
  const reg = ['organisation', 'donnees'].map((r) => vues.reglages.rendre(magasin.etat(), r).textContent).join(' ');
  assert.match(reg, /Journal des modifications/);
  assert.match(reg, /ne certifie aucune conservation/);
  assert.match(reg, /hors ligne/i);
});

test('jour : « Fait » marque fait en un toucher avec la cible ; sans quantité connue, aucun « Fait »', async () => {
  nettoyerPanneaux();
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  planifier(e, p, S.mardi, 'apres_midi', h());
  const inconnu = composantValide(e, S.mercredi, 2, J.PRODUIT_SEC_TEST, { nom: 'SANS_PREVISION_TEST' });
  planifier(e, principaleDe(e, inconnu), S.mardi, 'apres_midi', h());
  magasin.remplacer(e);
  const noeud = vues.jour.rendre(magasin.etat(), S.mardi);
  const faits = boutons(noeud).filter((b) => /^Marquer fait : /.test(b.textContent));
  assert.equal(faits.length, 1, 'l\'élément sans quantité n\'a pas de « Fait » : rien n\'est inventé');
  await faits[0].click();
  assert.equal(magasin.etat().productions[p].etat, 'fait', 'un seul toucher');
  assert.equal(magasin.etat().productions[p].quantiteReelle, 500, 'la cible devient le réel');
  assert.equal(panneauxOuverts(dom.corps).length, 0, 'aucun panneau');
  // La jauge du jour suit.
  const apres = vues.jour.rendre(magasin.etat(), S.mardi);
  assert.match(apres.textContent, /2 sur 2 fait|1 sur 2 fait/, 'la jauge compte les productions décidées ce jour');
});

test('jour : deux services du même produit proposent un lot, sans rien planifier ni fusionner', () => {
  const e = etatVide();
  const riz = { ...J.PRODUIT_SEC_TEST, nom: 'riz' };
  for (const jour of [S.mardi, S.mercredi]) { prevision(e, jour, 1, 10); composantValide(e, jour, 1, riz); }
  magasin.remplacer(e);
  const texte = vues.jour.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(texte, /À faire en une fois/);
  assert.match(texte, /riz : 1 000 g en une fois, pour mardi 6 octobre et mercredi 7 octobre/);
  assert.equal(Object.values(magasin.etat().productions).every((p) => p.jourDecide === null), true, 'rien n\'est planifié seul');
});

test('composant : « Composer un mélange » crée une recette en parts, non validée, depuis la fiche', async () => {
  nettoyerPanneaux();
  const e = etatVide();
  prevision(e, S.lundi, 2, 10);
  const id = ajouterComposant(e, S.lundi, 2, { nom: 'légumes du jour', categorie: 'legume', attribue: true }, h());
  magasin.remplacer(e);
  const noeud = vues.composant.rendre(magasin.etat(), id);
  await boutonNomme(noeud, 'Composer un mélange').click();
  const d = panneauOuvert();
  remplir(d, 'Composant 1', 'carottes'); remplir(d, 'Parts du composant 1', '2');
  remplir(d, 'Composant 2', 'courgettes'); remplir(d, 'Parts du composant 2', '1');
  assert.deepEqual(await soumettre(d), []);
  const c = magasin.etat().composants[id];
  assert.equal(c.type, 'preparation_maison');
  const r = magasin.etat().recettes[c.recetteId];
  assert.deepEqual(r.ingredients.map((i) => [i.nom, i.quantite]), [['carottes', 2], ['courgettes', 1]]);
  assert.equal(r.valide, false);
  // Un seul composant renseigné : refusé dans le panneau, rien n'est créé.
  const e2 = etatVide();
  const id2 = ajouterComposant(e2, S.lundi, 2, { nom: 'autre mélange', categorie: 'legume', attribue: true }, h());
  magasin.remplacer(e2);
  const noeud2 = vues.composant.rendre(magasin.etat(), id2);
  nettoyerPanneaux();
  await boutonNomme(noeud2, 'Composer un mélange').click();
  const d2 = panneauOuvert();
  remplir(d2, 'Composant 1', 'carottes'); remplir(d2, 'Parts du composant 1', '2');
  assert.match((await soumettre(d2)).join(' '), /au moins deux composants/);
  assert.equal(Object.keys(magasin.etat().recettes).length, 0);
  nettoyerPanneaux();
});

test('jour : la jauge d\'avancement dit « x sur y faits » et s\'efface sans production décidée', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const p = principaleDe(e, composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST));
  planifier(e, p, S.mardi, 'apres_midi', h());
  magasin.remplacer(e);
  assert.match(vues.jour.rendre(magasin.etat(), S.mardi).textContent, /0 sur 1 fait/);
  assert.doesNotMatch(vues.jour.rendre(magasin.etat(), S.lundi).textContent, /sur \d+ fait/);
});

test('jour : rubriques dans l\'ordre, mardi = revue de mi-semaine, rubrique vide = une ligne discrète', () => {
  const { e } = etatRiche();
  magasin.remplacer(e);
  const texte = vues.jour.rendre(magasin.etat(), S.mardi).textContent;
  // Ordre de lecture A-P1 : menu 1, menu 2, autres tâches, après service, puis les faites repliées ; les décisions
  // sont résumées avant la liste et détaillées dans le centre « À confirmer » en fin de page.
  const lundi = vues.jour.rendre(magasin.etat(), S.lundi).textContent;
  const ordre = ['Menu 1 · pour le service du jour', 'Menu 2 · pour le service du jour', 'Autres tâches',
    'Après service · avances pour les jours suivants', 'Terminé'];
  // Une rubrique vide n'est plus affichée (page moins chargée) : seules les rubriques présentes gardent leur ordre.
  const presentes = ordre.filter((r) => lundi.includes(r));
  assert.ok(presentes.length >= 3, `plusieurs rubriques présentes dans cet état riche : ${lundi.slice(0, 900)}`);
  let position = -1;
  for (const r of presentes) {
    const p = lundi.indexOf(r);
    assert.ok(p > position, `rubrique « ${r} » dans le mauvais ordre`);
    position = p;
  }
  assert.ok(lundi.indexOf('À confirmer') < lundi.indexOf(presentes[0]), 'le résumé des décisions précède la liste');
  const vide = vues.jour.rendre(magasin.etat(), S.jeudi).textContent;
  for (const r of ['Terminé', 'À confirmer', 'Après service']) {
    assert.doesNotMatch(vide, new RegExp(r), `la rubrique vide « ${r} » n'est pas affichée`);
  }
  assert.match(texte, /revue de mi-semaine/);
  assert.doesNotMatch(vues.jour.rendre(magasin.etat(), S.lundi).textContent, /revue de mi-semaine/);
  assert.match(vues.jour.rendre(magasin.etat(), S.jeudi).textContent, /Aucune tâche décidée pour ce jour/);
  // Le samedi : tâche avancée pour lundi visible sur le samedi et, comme « attendu », sur le lundi.
  assert.match(vues.jour.rendre(magasin.etat(), S.samediPrecedent).textContent, /Pour lun\. 5/);
  assert.match(vues.jour.rendre(magasin.etat(), S.lundi).textContent, /prévu samedi 3 octobre/);
});

test('composant : pastilles, formule, provenance, ce qui manque, allergènes, pas de « compatible »', () => {
  const { e, ids } = etatRiche();
  magasin.remplacer(e);
  const cru = vues.composant.rendre(magasin.etat(), ids.cru).textContent;
  assert.match(cru, /calculé/);
  assert.match(cru, /Paramètres utilisés et provenance/);
  assert.match(cru, /Ce qui manque/);
  assert.match(cru, /Mémoriser comme référence maison/);
  assert.match(cru, /Reprendre la référence maison/);
  assert.match(cru, /allergènes à confirmer/);
  assert.match(cru, /Le rebut n'est pas une perte normale/);
  const vague = vues.composant.rendre(magasin.etat(), ids.vague).textContent;
  assert.match(vague, /composition à définir/);
  const prep = vues.composant.rendre(magasin.etat(), ids.prep).textContent;
  assert.match(prep, /INGREDIENT_A_TEST/);
  assert.match(prep, /Ingrédients calculés/);
});

/** Active chaque bouton d'une vue, ouvre puis valide chaque panneau, et signale toute erreur de code. */
async function parcourir(nomVue, param) {
  const corps = dom.corps;
  const vue = vues[nomVue];
  for (let i = 0; i < 500; i += 1) {
    const racine = vue.rendre(magasin.etat(), param);
    const liste = boutons(racine);
    if (i >= liste.length) return i;
    const libelle = liste[i].textContent;
    await liste[i].click();
    for (const dialogue of panneauxOuverts(corps)) {
      const formulaire = dialogue.enfants[0];
      const internes = boutons(dialogue).filter((b) => b.attributs.type === 'button' && !/^(Annuler|Fermer)$/.test(b.textContent));
      for (const b of internes) await b.click();
      await formulaire.declencher('submit');
      for (const alerte of dialogue.tous((x) => x.attributs.role === 'alert' && !x.hidden)) {
        assert.equal(ERREUR_DE_CODE.test(alerte.textContent), false, `${nomVue} ${param} · bouton « ${libelle} » : erreur de code « ${alerte.textContent} »`);
      }
      if (dialogue.open) dialogue.close();
    }
    for (const d of corps.tous((x) => x.balise === 'dialog')) d.remove();
  }
  return 500;
}

test('chaque bouton de chaque vue s\'active sans erreur de code (état riche)', async () => {
  const pagesParcourues = [['menus', S.lundi], ['detail', S.lundi], ['detail', S.mardi], ['jour', S.samediPrecedent],
    ['jour', S.lundi], ['jour', S.mardi], ['produits', S.lundi], ['reglages', null],
    ['reglages', 'standards'], ['reglages', 'organisation'], ['reglages', 'produits'], ['reglages', 'donnees']];
  for (const [vue, param] of pagesParcourues) {
    const { e } = etatRiche();
    magasin.remplacer(e);
    const n = await parcourir(vue, param);
    // Le mardi n'a aucune tâche dans cet état : seule la navigation (liens) s'y trouve. La racine de Réglages n'a que des liens.
    if (!(vue === 'jour' && param === S.mardi) && !(vue === 'reglages' && param === null)) assert.ok(n > 0, `${vue} ${param} : aucun bouton`);
  }
  const { e, ids } = etatRiche();
  for (const id of Object.values(ids)) {
    magasin.remplacer(structuredClone(e));
    await parcourir('composant', id);
  }
});

test('chaque bouton s\'active aussi avec une base vide', async () => {
  for (const [vue, param] of [['menus', S.lundi], ['detail', S.lundi], ['jour', S.lundi], ['produits', S.lundi], ['reglages', null],
    ['reglages', 'standards'], ['reglages', 'organisation'], ['reglages', 'produits'], ['reglages', 'donnees']]) {
    magasin.remplacer(etatVide());
    await parcourir(vue, param);
  }
});

test('panneaux partagés : planifier, reporter, fait, corriger, décider, préparatoire', async () => {
  const { e, ids } = etatRiche();
  magasin.remplacer(e);
  const etat = () => magasin.etat();
  const prod = (id) => principaleDe(etat(), id);
  const ouvrir = async (f) => {
    nettoyerPanneaux();
    f();
    const d = panneauxOuverts(dom.corps)[0];
    assert.ok(d, 'un panneau doit s\'ouvrir');
    return d;
  };
  const valider = async (d) => {
    await d.enfants[0].declencher('submit');
    const erreurs = d.tous((x) => x.attributs.role === 'alert' && !x.hidden).map((x) => x.textContent);
    if (d.open) d.close();
    return erreurs;
  };
  let d = await ouvrir(() => dialogues.dialogPlanifier(prod(ids.sec), 'planifier', { date: S.samediPrecedent, creneau: 'avant_midi' }));
  assert.match(d.textContent, /Service : /);
  assert.deepEqual(await valider(d), [], 'planifier : aucune erreur');
  d = await ouvrir(() => dialogues.dialogPlanifier(prod(ids.cru), 'planifier'));
  assert.deepEqual(await valider(d), ['Cette production est déjà faite : corrigez le réel plutôt que de la déplacer.'], 'une production faite ne se déplace pas');
  d = await ouvrir(() => dialogues.dialogPlanifier(prod(ids.vague), 'reporter'));
  assert.match(d.textContent, /Remettre à planifier/);
  d = await ouvrir(() => dialogues.dialogDecider(prod(ids.cru)));
  assert.match(d.textContent, /Complément/);
  assert.match(d.textContent, /Aucune production supplémentaire/);
  assert.deepEqual(await valider(d), ['Choisissez une décision.']);
  d = await ouvrir(() => dialogues.dialogCorriger(prod(ids.cru)));
  assert.deepEqual(await valider(d), []);
  d = await ouvrir(() => dialogues.dialogFait(prod(ids.vague)));
  assert.deepEqual(await valider(d), []);
  d = await ouvrir(() => dialogues.dialogPreparatoire(ids.sec));
  assert.deepEqual(await valider(d), ["Décrivez l'action préparatoire."]);
});

test('restauration : un fichier valide demande confirmation, un fichier TEST_ONLY est refusé en clair', async () => {
  const { e } = etatRiche();
  nettoyerPanneaux();
  magasin.remplacer(etatVide());
  const racine = vues.reglages.rendre(magasin.etat(), 'donnees');
  const entree = racine.tous((x) => x.balise === 'input' && x.attributs.type === 'file')[0];
  assert.ok(entree, 'champ fichier de restauration');
  const fichier = (nom, texte) => ({ name: nom, text: async () => texte });

  await entree.declencher('change', { target: { files: [fichier('sauvegarde.json', exporter(e, h()))], value: '' } });
  const confirmation = panneauxOuverts(dom.corps)[0];
  assert.ok(confirmation, 'confirmation explicite avant de remplacer');
  assert.match(confirmation.textContent, /Remplacer toutes les données/);
  assert.equal(Object.keys(magasin.etat().fiches).length, 0, 'rien n\'est remplacé avant la confirmation');
  await confirmation.enfants[0].declencher('submit');
  assert.equal(Object.keys(magasin.etat().fiches).length, 3, 'données restaurées après confirmation');
  confirmation.remove();

  const piege = JSON.stringify({ application: 'sanji-entremetier', schema: 1, etat: { etiquette: 'TEST_ONLY' } });
  await entree.declencher('change', { target: { files: [fichier('piege.json', piege)], value: '' } });
  const messages = dom.document.getElementById('messages').textContent;
  assert.match(messages, /Fichier refusé/);
  assert.match(messages, /TEST_ONLY/);
  assert.equal(panneauxOuverts(dom.corps).length, 0, 'aucune confirmation pour un fichier refusé');
  await entree.declencher('change', { target: { files: [fichier('autre.json', 'pas du json')], value: '' } });
  assert.match(dom.document.getElementById('messages').textContent, /illisible/);
});

test('agir : une erreur laisse l\'état intact et ne redessine pas ; un succès remplace l\'état', async () => {
  magasin.remplacer(etatVide());
  let dessins = 0;
  const desabonner = magasin.abonner(() => { dessins += 1; });
  const avant = magasin.etat();
  const echec = magasin.agir(() => { throw new Error('Refus de test'); }, { afficher: false });
  assert.deepEqual(echec, { ok: false, erreur: 'Refus de test' });
  assert.equal(magasin.etat(), avant);
  assert.equal(dessins, 0);
  const succes = magasin.agir((e, t) => { assert.match(t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/); e.reglages.capaciteCreneau = 4; return 'ok'; });
  assert.equal(succes.ok, true);
  assert.equal(magasin.etat().reglages.capaciteCreneau, 4);
  assert.equal(avant.reglages.capaciteCreneau, null, 'l\'ancien état n\'est pas modifié (copie)');
  assert.equal(dessins, 1);
  assert.match(magasin.aujourdhui(), /^\d{4}-\d{2}-\d{2}$/);
  desabonner();
});

// ------------------------------------------------------------------ tableau blanc et menus de la semaine

/** Fixe la date du jour (lue par `aujourdhui()`) le temps d'une fonction. */
function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

const tableau = (iso, etat, lundi = null) => aDate(iso, () => {
  magasin.remplacer(etat);
  return vues.tableau.rendre(magasin.etat(), lundi);
});
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const liens = (noeud) => noeud.tous((x) => x.balise === 'a');
const textes = (noeuds) => noeuds.map((n) => n.textContent);

function verifierTableau(noeud, contexte) {
  const texte = verifierTexte(noeud, contexte);
  assert.equal(ERREUR_DE_CODE.test(texte), false, `${contexte} : message d'erreur de code`);
  // Seul le nombre de portions d'un menu est un bouton (il ouvre la prévision) ; tout le reste est un lien.
  const autres = noeud.tous((x) => x.balise === 'button' && !x.className.split(' ').includes('tb-couverts'));
  assert.equal(autres.length, 0, `${contexte} : aucun bouton hors prévision (liens seulement)`);
  assert.ok(classes(noeud, 'bord-zone').length <= 5, `${contexte} : au plus 5 zones primaires`);
  assert.equal(classes(noeud, 'note').length, 0, `${contexte} : la note multi-sujets n'existe plus`);
  return texte;
}

/** Semaine du 5 octobre saisie avec des mots de catégorie génériques (jeu de test, pas un vrai menu). */
function etatSemaineSaisie() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz et carottes', h());
  definirMenu(e, S.lundi, 2, 'poulet, riz, carottes', h());
  definirMenu(e, S.mardi, 1, 'ELEMENT_INCONNU_TEST', h());
  return e;
}

test('tableau : le titre de la barre est « Tableau »', () => {
  assert.equal(vues.tableau.titre(), 'Tableau');
});

test('tableau : base vide un lundi, invitation à saisir les menus, rien de vide n\'est écrit', () => {
  const noeud = tableau(S.lundi, etatVide());
  const texte = verifierTableau(noeud, 'tableau base vide');
  assert.match(texte, /Aucun menu saisi cette semaine/);
  assert.match(texte, /Saisir les menus de la semaine/);
  assert.match(texte, /Semaine du 5 octobre/);
  assert.doesNotMatch(texte, /menu non saisi|0 portion/);
  assert.match(texte, /Aucun banquet prévu/, 'ligne calme sans fiche');
  assert.equal(classes(noeud, 'bord-zone').length, 4, 'quatre zones sous l\'en-tête');
  assert.ok(liens(noeud).some((a) => a.attributs.href === `#/menus/${S.lundi}`));
  assert.ok(liens(noeud).some((a) => a.attributs.href === `#/jour/${S.lundi}` && /Ouvrir Jour/.test(a.textContent)));
});

test('tableau : le jour du service, la jauge de production et l\'écart à arbitrer mènent à Jour', () => {
  const { e, jour } = etatReglette(); // service du vendredi 2 octobre
  const noeud = tableau(jour, e);
  const texte = verifierTableau(noeud, 'tableau avant service');
  assert.match(texte, /Semaine du 28 septembre/, 'un vendredi avec des tâches à faire reste sur la semaine en cours');
  assert.match(texte, /Aujourd'hui \d+\/\d+ fait/);
  assert.ok(liens(noeud).some((a) => a.attributs.href === `#/jour/${jour}` && /fait/.test(a.textContent)), 'la jauge mène à Jour');
  assert.match(texte, /écart[s]? à arbitrer/);
  // Une seule action principale : ouvrir Jour. La mise en place détaillée vit sur Jour, plus sur le Tableau.
  assert.equal(classes(noeud, 'btn-principal').length, 1);
  assert.doesNotMatch(texte, /ELEMENT_A_FAIRE_TEST/);
});

test('tableau : en fin de semaine, la semaine prochaine s\'affiche ; mercredi, la semaine en cours', () => {
  const e = etatSemaineSaisie();
  for (const jour of [S.veille, S.samediPrecedent, S.dimanchePrecedent]) {
    const texte = verifierTableau(tableau(jour, structuredClone(e)), `tableau ${jour}`);
    assert.match(texte, /Semaine du 5 octobre/, `${jour} : la semaine affichée est la suivante`);
    assert.match(texte, /Revenir à aujourd'hui/);
  }
  const mercredi = verifierTableau(tableau(S.mercredi, structuredClone(e)), 'tableau mercredi');
  assert.match(mercredi, /Semaine du 5 octobre/);
  assert.doesNotMatch(mercredi, /Revenir à aujourd'hui/);
  // Semaine prochaine non saisie : l'invitation à saisir les menus mène à Menus de la semaine.
  const vide = tableau(S.samediPrecedent, etatVide());
  assert.match(verifierTableau(vide, 'tableau samedi vide'), /Aucun menu saisi cette semaine/);
  assert.ok(liens(vide).some((a) => a.attributs.href === `#/menus/${S.lundi}` && /Saisir les menus de la semaine/.test(a.textContent)));
});

// Adapté B-P0 : le repère validé du riz en garniture retire une portion à régler (3 -> 2 : riz en plat principal, carottes).
test('tableau : ce qui est au poste est écrit au feutre, le reste en gris ; l\'inconnu est signalé', () => {
  const noeud = tableau(S.lundi, etatSemaineSaisie());
  const texte = verifierTableau(noeud, 'tableau semaine saisie');
  const auPoste = textes(classes(noeud, 'tb-poste'));
  const horsPoste = textes(classes(noeud, 'tb-hors'));
  assert.ok(auPoste.includes('riz et carottes'), 'menu 1 : le plat entier est au poste');
  assert.ok(auPoste.includes('riz') && auPoste.includes('carottes'), 'menu 2 : féculent et légume au poste');
  assert.deepEqual(horsPoste, ['poulet'], 'menu 2 : la protéine n\'est pas au poste');
  // Aucune portion connue : le tableau le dit et renvoie aux standards maison, sans inventer de quantité.
  assert.match(texte, /2 portions à régler dans les standards maison/);
  assert.match(texte, /1 élément du menu à préciser/);
  assert.match(texte, /Prévisions à saisir pour 2 jours/);
  // Sans prévision ni groupe, aucun chiffre : un cercle vide invite à saisir la prévision.
  assert.deepEqual(textes(classes(noeud, 'tb-couverts')), ['?', '?', '?']);
  assert.equal(classes(noeud, 'tb-couverts-vide').length, 3);
  // Une quantité manquante n'est jamais une décision : ni « à confirmer », ni « à décider » ; elle reste dite, calmement.
  const confirmer = classes(noeud, 'bord-confirmer')[0].textContent;
  assert.doesNotMatch(confirmer, /portion|prévision|quantité|préciser/);
  assert.doesNotMatch(texte, /5 points à confirmer/);
});

test('tableau : le « ? » ouvre la prévision sur place, sans « quantité à régler » dans la liste du jour', async () => {
  nettoyerPanneaux();
  const e = etatSemaineSaisie();
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  magasin.remplacer(e);
  const avant = tableau(S.lundi, magasin.etat());
  assert.doesNotMatch(verifierTableau(avant, 'tableau avant prévision'), /quantité à régler/);
  const ouvrir = (noeud) => boutons(noeud).find((b) => /menu 1 : (saisir la prévision|\d+ portions?)/.test(b.attributs['aria-label'] ?? '')
    && /lundi 5 octobre/.test(b.attributs['aria-label']));
  assert.match(ouvrir(avant).attributs['aria-label'], /saisir la prévision/);
  await ouvrir(avant).click();
  const d = panneauOuvert();
  remplir(d, 'Portions du menu 1, hors groupes', '10');
  assert.deepEqual(await soumettre(d), []);
  assert.equal(jourOuVide(magasin.etat(), S.lundi).previsions[1].portions, 10);
  // Le lendemain, la prévision se réduit au même endroit et le chiffre affiché suit.
  const apres = tableau(S.lundi, magasin.etat());
  assert.match(ouvrir(apres).attributs['aria-label'], /10 portions, modifier la prévision/);
  await ouvrir(apres).click();
  const d2 = panneauOuvert();
  remplir(d2, 'Portions du menu 1, hors groupes', '6');
  assert.deepEqual(await soumettre(d2), []);
  assert.match(ouvrir(tableau(S.lundi, magasin.etat())).attributs['aria-label'], /6 portions/);
});

test('tableau : un standard maison fait disparaître la portion à régler ; la quantité se lit sur Jour', () => {
  const e = etatSemaineSaisie();
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'riz', 'garniture', { valeur: 50, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.lundi, 2, 20);
  const noeud = tableau(S.lundi, e);
  const texte = verifierTableau(noeud, 'tableau avec standards');
  assert.doesNotMatch(texte, /portions? à régler/);
  assert.deepEqual(textes(classes(noeud, 'tb-couverts')), ['10', '20', '?']);
  // 10 portions × 70 g secs = 700 g : la portion est déjà en poids sec, le gain de cuisson n'est pas appliqué.
  // Le détail des quantités n'est plus sur le Tableau : il est sur la feuille du jour.
  const feuille = aDate(S.lundi, () => vues.jour.rendre(magasin.etat(), S.lundi)).textContent;
  assert.doesNotMatch(texte, /700 g/);
  assert.match(feuille, /700 g/);
});

test('tableau : navigation de semaine et retour à aujourd\'hui', () => {
  const noeud = tableau(S.mercredi, etatSemaineSaisie(), S.lundiSuivant);
  const texte = verifierTableau(noeud, 'tableau semaine suivante');
  assert.match(texte, /Semaine du 12 octobre/);
  assert.match(texte, /Revenir à aujourd'hui/);
  const hrefs = liens(noeud).map((a) => a.attributs.href);
  assert.ok(hrefs.includes(`#/tableau/${S.lundi}`) && hrefs.includes('#/tableau/2026-10-19') && hrefs.includes('#/tableau'));
});

test('tableau : se dessine chaque jour de la semaine, base vide et état riche', () => {
  const { e } = etatRiche();
  for (const jour of [S.dimanchePrecedent, S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi, S.samedi, S.dimanche]) {
    verifierTableau(tableau(jour, etatVide()), `tableau ${jour} (vide)`);
    verifierTableau(tableau(jour, structuredClone(e)), `tableau ${jour} (riche)`);
  }
});

const champ = (noeud, id) => noeud.tous((x) => x.attributs.id === id)[0];
const boutonNomme = (noeud, libelle) => boutons(noeud).find((b) => b.textContent === libelle);

test('menus de la semaine : répartir sur des intitulés déjà écrits prévient qu\'ils sont remplacés dans les champs', async () => {
  magasin.remplacer(etatVide());
  const noeud = vues.menus.rendre(magasin.etat(), S.lundi);
  champ(noeud, `menu-${S.lundi}-1`).value = 'ancien intitulé TEST';
  champ(noeud, 'feuille-texte').value = 'Lundi 05 octobre\nriz et carottes\npoulet, riz, carottes';
  await boutonNomme(noeud, 'Répartir dans la semaine').click();
  const texte = noeud.textContent;
  assert.match(texte, /Des intitulés déjà écrits ont été remplacés dans les champs \(lundi 5 octobre\)/);
  assert.match(texte, /Rien n'est enregistré avant « Enregistrer la semaine »/);
  assert.equal(champ(noeud, `menu-${S.lundi}-1`).value, 'riz et carottes');
  // Sans intitulé déjà écrit : pas d'avertissement.
  const propre = vues.menus.rendre(etatVide(), S.lundi);
  champ(propre, 'feuille-texte').value = 'Lundi 05 octobre\nriz et carottes\npoulet, riz, carottes';
  await boutonNomme(propre, 'Répartir dans la semaine').click();
  assert.doesNotMatch(propre.textContent, /déjà écrits/);
});

test('menus de la semaine : une ligne laissée de côté se remet dans un menu, sans rien enregistrer', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatVide());
  const noeud = vues.menus.rendre(magasin.etat(), S.lundi);
  champ(noeud, 'feuille-texte').value = 'Lundi 05 octobre\nriz et carottes\npoulet, riz\n+ pas de gluten';
  await boutonNomme(noeud, 'Répartir dans la semaine').click();
  const restaurer = boutons(noeud).find((b) => b.attributs['aria-label'] === 'Ajouter « + pas de gluten » à un menu');
  assert.ok(restaurer, 'chaque ligne écartée propose de la remettre');
  await restaurer.click();
  const d = panneauOuvert();
  assert.equal(choisi(d, 'Ajouter à'), 'Lundi 5 octobre, menu 1');
  remplir(d, 'Ajouter à', 'Lundi 5 octobre, menu 2');
  assert.deepEqual(await soumettre(d), []);
  assert.equal(champ(noeud, `menu-${S.lundi}-2`).value, 'poulet, riz, + pas de gluten');
  assert.equal(Object.keys(magasin.etat().composants).length, 0, 'rien n\'est enregistré');
  nettoyerPanneaux();
});

test('menus de la semaine : coller, répartir, enregistrer, sans aucune étape de validation', async () => {
  magasin.remplacer(etatVide());
  const noeud = vues.menus.rendre(magasin.etat(), S.lundi);
  verifierTexte(noeud, 'menus de la semaine');
  assert.equal(vues.menus.titre(), 'Menus de la semaine');
  champ(noeud, 'feuille-texte').value = 'Menu du marché\nriz et carottes\nLundi 05 octobre\npoulet, riz, carottes\n19.-\n24.-';
  await boutonNomme(noeud, 'Répartir dans la semaine').click();
  assert.equal(champ(noeud, `menu-${S.lundi}-1`).value, 'riz et carottes');
  assert.equal(champ(noeud, `menu-${S.lundi}-2`).value, 'poulet, riz, carottes');
  assert.match(champ(noeud, 'feuille-retour').textContent, /1 jour rempli/);
  assert.equal(magasin.etat().jours[S.lundi], undefined, 'répartir n\'enregistre rien');
  champ(noeud, `prevision-${S.lundi}-1`).value = '40';
  await boutonNomme(noeud, 'Enregistrer la semaine').click();
  const e = magasin.etat();
  assert.equal(e.jours[S.lundi].menus[1].intitule, 'riz et carottes');
  assert.equal(e.jours[S.lundi].menus[1].transcriptionValidee, true);
  assert.equal(e.jours[S.lundi].previsions[1].portions, 40);
  const composants = Object.values(e.composants).filter((c) => c.date === S.lundi);
  assert.equal(composants.length, 4);
  assert.ok(composants.every((c) => c.valide), 'les composants sont valides sans geste du chef');
  assert.deepEqual(composants.filter((c) => !c.attribue).map((c) => c.nom), ['poulet']);
  assert.equal(globalThis.location.hash, `#/tableau/${S.lundi}`, 'retour au tableau de la semaine');
});

test('menus de la semaine : champs préremplis, texte incohérent signalé, prévision illisible refusée', async () => {
  magasin.remplacer(etatSemaineSaisie());
  const noeud = vues.menus.rendre(magasin.etat(), S.lundi);
  assert.equal(champ(noeud, `menu-${S.lundi}-2`).value, 'poulet, riz, carottes');
  champ(noeud, 'feuille-texte').value = 'lundi 5 octobre\nriz\nmardi 6 octobre\npâtes\npoisson, riz';
  await boutonNomme(noeud, 'Répartir dans la semaine').click();
  assert.match(champ(noeud, 'feuille-retour').textContent, /il en faut deux par jour/);
  assert.equal(champ(noeud, `menu-${S.lundi}-2`).value, 'poulet, riz, carottes', 'les champs ne sont pas écrasés');
  const avant = structuredClone(magasin.etat());
  champ(noeud, `prevision-${S.lundi}-1`).value = 'beaucoup';
  await boutonNomme(noeud, 'Enregistrer la semaine').click();
  assert.deepEqual(magasin.etat(), avant, 'une prévision illisible n\'enregistre rien');
  // Vider un intitulé l'efface ; ne rien toucher ne change rien.
  champ(noeud, `prevision-${S.lundi}-1`).value = '';
  champ(noeud, `menu-${S.mardi}-1`).value = '';
  await boutonNomme(noeud, 'Enregistrer la semaine').click();
  assert.equal(magasin.etat().jours[S.mardi].menus[1].intitule, '');
  assert.equal(magasin.etat().jours[S.lundi].menus[2].intitule, 'poulet, riz, carottes');
});

// ------------------------------------------------------------------ lot C : standards maison, détail d'un jour, composant
// Jeux TEST_ONLY : mots de catégorie génériques (riz, carottes, poulet) et nombres arbitraires, aucune valeur de référence.

// La table des repères de portion embarquée est vide aujourd'hui : les tests qui en ont besoin la remplissent le temps
// d'une fonction avec des lignes TEST_ONLY, puis la rétablissent. Si elle cesse d'être vide, ces tests le disent.

async function avecReperes(lignes, fonction) {
  const embarques = [...PORTIONS_BASE];
  PORTIONS_BASE.length = 0;
  PORTIONS_BASE.push(...lignes);
  try { return await fonction(); } finally { PORTIONS_BASE.length = 0; PORTIONS_BASE.push(...embarques); }
}

/** Contrôle d'un panneau, retrouvé par son libellé (les identifiants des champs sont générés). */
function controleDe(dialogue, libelle) {
  const etiquette = dialogue.tous((x) => x.balise === 'label' && x.textContent === libelle)[0];
  assert.ok(etiquette, `champ « ${libelle} » introuvable dans le panneau`);
  return champ(dialogue, etiquette.attributs.for);
}
/** Remplit un champ : le texte saisi, ou le libellé de l'option choisie pour une liste. */
function remplir(dialogue, libelle, valeur) {
  const controle = controleDe(dialogue, libelle);
  if (controle.balise === 'select') {
    const i = controle.enfants.findIndex((o) => o.textContent === valeur);
    assert.ok(i >= 0, `option « ${valeur} » absente du champ « ${libelle} »`);
    controle.value = String(i);
  } else controle.value = valeur;
}
const choisi = (dialogue, libelle) => { const c = controleDe(dialogue, libelle); return c.enfants[Number(c.value)].textContent; };
const alertesDe = (dialogue) => dialogue.tous((x) => x.attributs.role === 'alert' && !x.hidden).map((x) => x.textContent);
const soumettre = async (dialogue) => { await dialogue.enfants[0].declencher('submit'); return alertesDe(dialogue); };
const panneauOuvert = () => panneauxOuverts(dom.corps)[0];
const parAria = (noeud, texte) => boutons(noeud).find((b) => b.attributs['aria-label'] === texte);

const composantNomme = (etat, nom, date = S.lundi, menu = 2) => Object.values(etat.composants).find((c) => c.date === date && c.menu === menu && c.nom === nom);
const groupesDe = (noeud) => noeud.tous((x) => x.balise === 'details' && x.className.split(' ').includes('repliable-groupe'));
const groupesOuverts = (noeud) => groupesDe(noeud).filter((g) => g.open).map((g) => g.querySelector('summary').textContent);
const dansRepliable = (n) => { for (let p = n.parent; p; p = p.parent) if (p.balise === 'details') return true; return false; };
/** Noms des standards montrés d'emblée (hors catégories repliées), sans doublon, dans l'ordre. */
const nomsEnVue = (noeud) => [...new Set(classes(noeud, 'ligne-standard').filter((l) => !dansRepliable(l)).map((l) => l.querySelector('strong').textContent))];
const pastilleTexte = (noeud, texte) => classes(noeud, 'pastille').find((p) => p.textContent === texte);
/** Texte de la portion annoncée en tête d'un composant. */
const portionAffichee = (noeud) => classes(noeud, 'portion')[0]?.querySelector('strong').textContent;

// ---------------------------------------------------------------- réglages : standards maison

// Adapté B-P0 : les quatre repères validés applicables (pâtes ×2, riz, légumineuses) sont indiqués ; il n'y en a pas d'autre.
test('réglages : « Standards maison » en tête, groupée, repliée sans rien de réglé ni de saisi', () => {
  nettoyerPanneaux();
  magasin.remplacer(etatVide());
  const noeud = vues.reglages.rendre(magasin.etat(), 'standards');
  const texte = verifierTexte(noeud, 'réglages base vide');
  assert.match(texte, /Standards maison/);
  assert.match(texte, /Le standard maison passe avant le standard de base/);
  assert.match(texte, /Une correction faite sur un plat ne le change pas/);
  assert.match(texte, /tous les plats de cette famille qui n'ont pas été corrigés/);
  const premierTitre = noeud.tous((x) => x.balise === 'h2')[0];
  assert.equal(premierTitre.textContent, 'Standards maison', 'la section est la première, sous le titre');
  assert.equal(premierTitre.attributs.id, 'standards', 'ancre « standards » sur le titre');
  assert.equal(classes(noeud, 'ligne-standard').length,
    lignesStandards(magasin.etat()).length + lignesStandardsGroupes(magasin.etat()).length,
    'une ligne par famille et par rôle, plus une par catégorie et par rôle');
  assert.match(texte, /Légumes \(toute la catégorie\) en garniture/);
  const resumes = groupesDe(noeud).map((g) => g.querySelector('summary').textContent);
  assert.equal(resumes.length, GROUPES.length);
  GROUPES.forEach((g, i) => assert.match(resumes[i], new RegExp(`^${g.libelle} · \\d+ à régler$`)));
  assert.deepEqual(groupesOuverts(noeud), [], 'rien de réglé, aucun menu saisi : tout est replié');
  assert.deepEqual(nomsEnVue(noeud), [], 'rien de réglé ni de saisi : rien d\'emblée');
  const total = lignesStandards(magasin.etat()).length + lignesStandardsGroupes(magasin.etat()).length;
  assert.match(texte, new RegExp(`${total} à régler`), 'compteur neutre');
  assert.equal(noeud.tous((x) => x.attributs.role === 'alert').length, 0, '« à régler » n\'est jamais une alerte');
  assert.match(texte, /non réglé/);
  assert.match(texte, /riz en garniture/);
  assert.match(texte, /riz en plat principal/);
  assert.equal(texte.match(/standard de base \(repère validé\)/g).length, 4, 'seuls les quatre repères validés applicables sont indiqués');
  // Adapté B-P1b : « Valider la proposition » s'ajoute à « Régler » sur les seules lignes qui ont un repère.
  for (const l of classes(noeud, 'ligne-standard')) {
    const b = l.tous((x) => x.balise === 'button' && /^Régler le standard/.test(x.attributs['aria-label'] ?? ''))[0];
    assert.equal(b.textContent, 'Régler');
    assert.match(b.attributs['aria-label'], /^Régler le standard : .+, en (plat principal|garniture)$/);
  }
  assert.equal(boutons(noeud).filter((b) => b.textContent === 'Valider la proposition').length, 4, 'une par ligne qui a un repère');
});

test('réglages : un standard réglé ou une famille saisie dans un menu est montré d\'emblée, le reste reste replié', () => {
  const e = etatSemaineSaisie(); // riz, carottes, poulet
  magasin.remplacer(e);
  const noeud = vues.reglages.rendre(magasin.etat(), 'standards');
  verifierTexte(noeud, 'réglages menus saisis');
  assert.deepEqual(groupesOuverts(noeud), []);
  const noms = nomsEnVue(noeud);
  assert.ok(noms.includes('riz') && noms.includes('carottes'), 'riz et carottes sont dans un menu');
  assert.ok(!noms.includes('pommes de terre'));
  definirStandard(e, 'pommes_de_terre', 'garniture', ST.cuit, h());
  magasin.remplacer(e);
  const avecStandard = vues.reglages.rendre(magasin.etat(), 'standards');
  assert.ok(nomsEnVue(avecStandard).includes('pommes de terre'));
  assert.match(avecStandard.textContent, /100 g, poids cuit/);
  assert.deepEqual(nomsEnVue(vues.reglages.rendre(etatVide(), 'standards')), [], 'sans menu ni standard : rien d\'emblée');
});

test('réglages : la recherche locale filtre les standards sans accent ni casse, et revient à la liste', async () => {
  magasin.remplacer(etatVide());
  const noeud = vues.reglages.rendre(magasin.etat(), 'standards');
  const instantane = structuredClone(magasin.etat());
  const champ = noeud.tous((x) => x.balise === 'input' && x.attributs['aria-label'] === 'Rechercher un standard')[0];
  assert.ok(champ, 'champ de recherche');
  const avant = classes(noeud, 'ligne-standard').length;
  assert.ok(avant > 20, 'toutes les lignes existent avant la recherche');
  champ.value = 'CAROTTES';
  await champ.declencher('input', { target: champ });
  const trouvees = classes(noeud, 'ligne-standard');
  assert.ok(trouvees.length >= 2 && trouvees.length < avant);
  assert.ok(trouvees.every((l) => /carottes/i.test(l.textContent)), 'ne reste que ce qui correspond');
  assert.equal(groupesDe(noeud).length, 0, 'pendant la recherche, une seule liste');
  champ.value = 'zzzz';
  await champ.declencher('input', { target: champ });
  assert.match(noeud.textContent, /Aucun standard ne correspond/);
  champ.value = '';
  await champ.declencher('input', { target: champ });
  assert.equal(classes(noeud, 'ligne-standard').length, avant, 'recherche vidée : tout revient');
  assert.equal(groupesDe(noeud).length, GROUPES.length);
  assert.deepEqual(magasin.etat(), instantane, 'la recherche n\'enregistre rien');
});

// Adapté B-P0 : le riz en garniture a déjà un repère validé (50–70 g), qui passe avant le repère de test (50 g).
test('réglages : le repère de la base est indiqué à côté du standard, jamais copié comme valeur', async () => {
  nettoyerPanneaux();
  await avecReperes([R.familleRiz, R.groupeCereales, R.groupeCerealesPrincipal, R.familleCarottes], async () => {
    magasin.remplacer(etatVide());
    const noeud = vues.reglages.rendre(magasin.etat(), 'standards');
    const texte = verifierTexte(noeud, 'réglages avec repères');
    assert.match(texte, /standard de base \(repère validé\) : 50–70 g, poids sec/, 'repère de la famille (validé par la propriétaire)');
    assert.match(texte, /standard de base \(base métier\) : 60–80 g, poids sec \(repère du groupe\)/, 'repère du groupe, signalé comme tel');
    assert.match(texte, /standard de base \(base métier\) : 200–240 g, poids cru net/);
    assert.match(texte, /non réglé/, 'un repère n\'est pas un standard');
    // Panneau d'une ligne sans standard : l'état du repère est proposé, la valeur reste vide.
    await parAria(noeud, 'Régler le standard : riz, en garniture').click();
    const d = panneauOuvert();
    assert.match(d.textContent, /Repère de la base, à titre indicatif : 50–70 g, poids sec/);
    assert.equal(controleDe(d, 'Valeur de la portion').value, '');
    assert.equal(choisi(d, 'État du poids'), 'sec');
    d.close();
    // Un standard déjà réglé reste maître : son état n'est pas remplacé en silence par celui du repère.
    const e = etatVide();
    definirStandard(e, 'riz', 'garniture', ST.cuit, h());
    magasin.remplacer(e);
    await parAria(vues.reglages.rendre(magasin.etat(), 'standards'), 'Modifier le standard : riz, en garniture').click();
    const modif = panneauOuvert();
    assert.equal(controleDe(modif, 'Valeur de la portion').value, '100');
    assert.equal(choisi(modif, 'État du poids'), 'cuit');
    modif.close();
  });
});

// Adapté B-P0 : polenta (sans repère) au lieu du riz (qui propose maintenant l'état de son repère validé) : le choix
// d'état reste obligatoire sans repère ni standard.
test('réglages : régler puis effacer un standard par le panneau modifie etat.standards', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatVide());
  const page = () => vues.reglages.rendre(magasin.etat(), 'standards');

  await parAria(page(), 'Régler le standard : polenta, en garniture').click();
  let d = panneauOuvert();
  assert.match(d.textContent, /Standard maison : polenta, en garniture/);
  assert.equal(choisi(d, 'État du poids'), 'choisir…', 'aucun état proposé sans repère ni standard : le choix est obligatoire');
  assert.equal(boutonNomme(d, 'Effacer ce standard'), undefined, 'rien à effacer tant que le standard n\'existe pas');
  assert.ok(boutonNomme(d, 'Annuler') && d.tous((x) => x.attributs.type === 'submit').length === 1);
  remplir(d, 'Valeur de la portion', '110,5');
  remplir(d, 'Unité', 'g');
  remplir(d, 'État du poids', 'sec');
  assert.deepEqual(await soumettre(d), []);
  assert.equal(d.open, false, 'le panneau se ferme après l\'enregistrement');
  const s = magasin.etat().standards;
  assert.deepEqual(Object.keys(s), ['polenta']);
  assert.deepEqual([s.polenta.garniture.valeur, s.polenta.garniture.unite, s.polenta.garniture.etat], [110.5, 'g', 'sec'], 'la virgule est acceptée');
  assert.equal(s.polenta.plat_principal, undefined, 'l\'autre rôle n\'est pas touché');

  const apres = verifierTexte(page(), 'réglages après réglage');
  assert.match(apres, /110,5 g, poids sec/);
  assert.deepEqual(nomsEnVue(page()), ['polenta'], 'le standard réglé passe en tête de liste');
  assert.ok(parAria(page(), 'Modifier le standard : polenta, en garniture'), 'la ligne propose désormais « Modifier »');

  await parAria(page(), 'Modifier le standard : polenta, en garniture').click();
  d = panneauOuvert();
  assert.equal(controleDe(d, 'Valeur de la portion').value, '110,5', 'le panneau reprend le standard');
  assert.equal(choisi(d, 'État du poids'), 'sec');
  remplir(d, 'État du poids', 'cuit');
  remplir(d, 'Unité', 'ml');
  assert.deepEqual(await soumettre(d), []);
  assert.deepEqual([magasin.etat().standards.polenta.garniture.unite, magasin.etat().standards.polenta.garniture.etat], ['ml', 'cuit']);

  await parAria(page(), 'Modifier le standard : polenta, en garniture').click();
  d = panneauOuvert();
  await boutonNomme(d, 'Effacer ce standard').click();
  assert.equal(d.open, false);
  assert.deepEqual(magasin.etat().standards, {}, 'le standard est effacé, sans trace vide');
  assert.match(page().textContent, /non réglé/);
  assert.deepEqual(nomsEnVue(page()), []);
});

test('réglages : une saisie invalide affiche l\'erreur sans rien enregistrer', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatVide());
  const avant = structuredClone(magasin.etat());
  await parAria(vues.reglages.rendre(magasin.etat(), 'standards'), 'Régler le standard : carottes, en garniture').click();
  const d = panneauOuvert();
  remplir(d, 'État du poids', 'cru net');
  remplir(d, 'Valeur de la portion', '0');
  assert.deepEqual(await soumettre(d), ['La portion du standard doit être un nombre strictement positif.'], 'refus du domaine');
  remplir(d, 'Valeur de la portion', '-5');
  assert.deepEqual(await soumettre(d), ['La portion du standard doit être un nombre strictement positif.']);
  remplir(d, 'Valeur de la portion', 'beaucoup');
  assert.match((await soumettre(d))[0], /nombre invalide/);
  remplir(d, 'Valeur de la portion', '');
  assert.deepEqual(await soumettre(d), ['Saisissez la valeur de la portion.']);
  remplir(d, 'Valeur de la portion', '90');
  remplir(d, 'État du poids', 'choisir…');
  assert.deepEqual(await soumettre(d), ['Choisissez l\'état du poids : sec, cru net ou cuit.']);
  assert.equal(d.open, true, 'le panneau reste ouvert pour corriger');
  assert.deepEqual(magasin.etat(), avant, 'rien n\'est enregistré');
  for (const a of alertesDe(d)) assert.equal(ERREUR_DE_CODE.test(a), false, `erreur de code : ${a}`);
  remplir(d, 'État du poids', 'cru net');
  assert.deepEqual(await soumettre(d), []);
  assert.equal(magasin.etat().standards.carottes.garniture.valeur, 90, 'corrigée, la saisie est enregistrée');
  d.remove();
});

test('réglages : le journal nomme en clair les nouvelles actions', () => {
  const e = etatVide();
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 90, unite: 'g', etat: 'cru_net' }, h());
  definirStandard(e, 'riz', 'garniture', ST.sec, h());
  supprimerStandard(e, 'riz', 'garniture', h());
  saisirMenusSemaine(e, S.lundi, { [S.lundi]: { menu1: 'riz et carottes' } }, h());
  magasin.remplacer(e);
  const texte = verifierTexte(vues.reglages.rendre(magasin.etat(), 'donnees'), 'journal');
  assert.match(texte, /Standard maison réglé/);
  assert.match(texte, /Standard maison effacé/);
  assert.match(texte, /Menus de la semaine enregistrés/);
  assert.match(texte, /pâtes sèches plat principal : 90 g \(cru net\)/, 'les identifiants techniques sont remplacés par des mots');
  assert.doesNotMatch(texte, /definirStandard|supprimerStandard|saisirMenusSemaine|plat_principal|cru_net|pates_seches/);
});

// ---------------------------------------------------------------- détail d'un jour

test('détail : plus aucun bouton ni pastille de validation ; l\'intitulé se modifie par son panneau', async () => {
  for (const [nom, etat] of [['menus saisis', etatSemaineSaisie()], ['état riche', etatRiche().e]]) {
    magasin.remplacer(etat);
    const noeud = vues.detail.rendre(magasin.etat(), S.lundi);
    const texte = verifierTexte(noeud, `détail ${nom}`);
    assert.deepEqual(boutons(noeud).map((b) => b.textContent).filter((t) => /alider|Proposer les composants/.test(t)), [], `${nom} : bouton de validation`);
    assert.doesNotMatch(texte, /à valider|transcription validée|transcription à valider|Valider/, `${nom} : mot de validation`);
    assert.deepEqual(textes(classes(noeud, 'pastille')).filter((t) => /^(validé|à valider)$/.test(t)), [], `${nom} : pastille de validation`);
  }
  nettoyerPanneaux();
  magasin.remplacer(etatSemaineSaisie());
  const noeud = vues.detail.rendre(magasin.etat(), S.lundi);
  await boutonNomme(noeud, 'Modifier l\'intitulé').click(); // menu 1
  const d = panneauOuvert();
  assert.doesNotMatch(d.textContent, /à valider/);
  remplir(d, 'Intitulé exact du menu 1', 'riz et courgettes');
  assert.deepEqual(await soumettre(d), []);
  const m = magasin.etat().jours[S.lundi].menus[1];
  assert.deepEqual([m.intitule, m.transcriptionValidee], ['riz et courgettes', true], 'l\'intitulé enregistré vaut transcription validée');
  assert.ok(Object.values(magasin.etat().composants).filter((c) => c.date === S.lundi && c.menu === 1).every((c) => c.valide));
});

test('détail : sous chaque menu, ses composants avec catégorie, lien et interrupteur « au poste »', () => {
  magasin.remplacer(etatSemaineSaisie());
  const noeud = vues.detail.rendre(magasin.etat(), S.lundi);
  const menu2 = champ(noeud, 'menu-2');
  const lignes = classes(menu2, 'composant-ligne');
  assert.deepEqual(lignes.map((l) => l.querySelector('a').textContent), ['poulet', 'riz', 'carottes']);
  const poulet = composantNomme(magasin.etat(), 'poulet');
  assert.equal(lignes[0].querySelector('a').attributs.href, `#/composant/${encodeURIComponent(poulet.id)}`);
  assert.match(lignes[0].textContent, /protéine/);
  assert.match(lignes[1].textContent, /féculent/);
  assert.match(lignes[2].textContent, /légume/);
  const interrupteurs = lignes.map((l) => l.tous((x) => x.attributs.type === 'checkbox')[0]);
  assert.deepEqual(interrupteurs.map((i) => i.checked), [false, true, true], 'la protéine n\'est pas au poste, le féculent et le légume le sont');
  assert.ok(interrupteurs.every((i) => i.attributs.role === 'switch'));
  assert.match(lignes[0].textContent, /au poste/);
  for (const l of lignes) assert.deepEqual(boutons(l).map((b) => b.textContent), ['Modifier', 'Supprimer']);
  assert.ok(boutonNomme(menu2, 'Ajouter un composant'));
});

test('détail : l\'interrupteur « au poste » change l\'attribution et la mémorise', async () => {
  magasin.remplacer(etatSemaineSaisie());
  const poulet = composantNomme(magasin.etat(), 'poulet').id;
  const interrupteur = () => champ(vues.detail.rendre(magasin.etat(), S.lundi), `poste-${poulet}`);
  assert.equal(interrupteur().checked, false);
  assert.equal(magasin.etat().memoire['poulet|2'], undefined, 'rien n\'est mémorisé avant le geste');
  assert.equal(principaleDe(magasin.etat(), poulet), undefined);

  const allume = interrupteur();
  allume.checked = true;
  await allume.declencher('change');
  assert.equal(magasin.etat().composants[poulet].attribue, true);
  assert.equal(magasin.etat().memoire['poulet|2'].attribue, true, 'le choix est mémorisé par nom, sans autre geste');
  assert.equal(interrupteur().checked, true, 'la page reflète le nouvel état');
  assert.ok(principaleDe(magasin.etat(), poulet), 'le composant est pris en compte : sa production existe');
  // La saisie suivante réapplique le choix mémorisé.
  const suite = structuredClone(magasin.etat());
  definirMenu(suite, S.mardi, 2, 'poulet', h());
  assert.equal(composantNomme(suite, 'poulet', S.mardi).attribue, true);

  const eteint = interrupteur();
  eteint.checked = false;
  await eteint.declencher('change');
  assert.equal(magasin.etat().composants[poulet].attribue, false);
  assert.equal(magasin.etat().memoire['poulet|2'].attribue, false);
  assert.equal(principaleDe(magasin.etat(), poulet), undefined);
});

test('détail : un composant ajouté à la main est valide et pris en compte sans autre geste', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatSemaineSaisie());
  const noeud = vues.detail.rendre(magasin.etat(), S.lundi);
  const ajouts = boutons(noeud).filter((b) => b.textContent === 'Ajouter un composant');
  assert.equal(ajouts.length, 2, 'un bouton par menu');
  await ajouts[1].click();
  const d = panneauOuvert();
  assert.match(d.textContent, /Ajouter un composant au menu 2/);
  assert.match(d.textContent, /laisser l'application décider/);
  remplir(d, 'Nom du composant', 'courgettes');
  remplir(d, 'Catégorie', 'légume');
  assert.deepEqual(await soumettre(d), []);
  const c = composantNomme(magasin.etat(), 'courgettes');
  assert.ok(c, 'composant créé');
  assert.deepEqual([c.valide, c.attribue, c.menu], [true, true, 2], 'valide aussitôt, attribué par la règle du domaine');
  assert.ok(principaleDe(magasin.etat(), c.id), 'sa production existe');
  assert.match(vues.detail.rendre(magasin.etat(), S.lundi).textContent, /courgettes/);
  // Un choix explicite « non » est respecté.
  await boutonNomme(vues.detail.rendre(magasin.etat(), S.lundi), 'Ajouter un composant').click(); // menu 1
  const e = panneauOuvert();
  remplir(e, 'Nom du composant', 'poulet');
  remplir(e, 'Attribué au poste', 'non');
  assert.deepEqual(await soumettre(e), []);
  const p = composantNomme(magasin.etat(), 'poulet', S.lundi, 1);
  assert.deepEqual([p.valide, p.attribue], [true, false]);
  assert.equal(principaleDe(magasin.etat(), p.id), undefined, 'non attribué : pas de production');
});

test('détail : les rubriques vides sont repliées, celles qui contiennent une donnée sont ouvertes', () => {
  const ouvertes = (noeud) => noeud.tous((x) => x.balise === 'details').filter((b) => b.open).map((b) => b.attributs.id ?? b.querySelector('summary').textContent);
  magasin.remplacer(etatVide());
  const vide = vues.detail.rendre(magasin.etat(), S.lundi);
  verifierTexte(vide, 'détail base vide');
  const blocs = vide.tous((x) => x.balise === 'details').map((b) => b.attributs.id ?? 'photo');
  assert.deepEqual(blocs, ['photo', 'previsions', 'fiches', 'allergies', 'creneaux', 'apres-service']);
  assert.deepEqual(ouvertes(vide), [], 'rien de saisi : tout est replié');
  assert.equal(champ(vide, 'menus').balise, 'section', 'la rubrique des menus n\'est pas repliable');
  assert.equal(vide.tous((x) => x.balise === 'details' && x.querySelector('summary') === null).length, 0, 'chaque bloc a son résumé');

  magasin.remplacer(etatRiche().e);
  const riche = vues.detail.rendre(magasin.etat(), S.lundi);
  assert.deepEqual(ouvertes(riche), ['previsions', 'fiches', 'allergies', 'creneaux'], 'après service et photo : rien de saisi, replié');
  magasin.remplacer(etatSemaineSaisie());
  assert.deepEqual(ouvertes(vues.detail.rendre(magasin.etat(), S.mardi)), [], 'un jour sans prévision, fiche, ni vente');
  // Une vente saisie ouvre « Après service ».
  const e = etatVide();
  saisirVentes(e, S.lundi, 1, 31, h());
  magasin.remplacer(e);
  assert.deepEqual(ouvertes(vues.detail.rendre(magasin.etat(), S.lundi)), ['apres-service']);
});

test('détail : « Saisir toute la semaine » mène au lundi ; la phrase d\'aide remplace le rappel', () => {
  magasin.remplacer(etatVide());
  for (const jour of [S.lundi, S.mercredi, S.vendredi]) {
    const noeud = vues.detail.rendre(magasin.etat(), jour);
    const lien = liens(champ(noeud, 'menus'))[0];
    assert.equal(lien.textContent, 'Saisir toute la semaine', `${jour} : le lien est en tête de la rubrique des menus`);
    assert.equal(lien.attributs.href, `#/menus/${S.lundi}`);
    const texte = noeud.textContent;
    assert.match(texte, /L'application répartit seule ce qui revient au poste ; corrigez seulement une exception\./);
    assert.doesNotMatch(texte, /Rappel|attribué par défaut/);
  }
});

test('détail : « Aller aux prévisions » ouvre la rubrique repliée avant d\'y aller', async () => {
  magasin.remplacer(etatSemaineSaisie()); // menus saisis, prévisions manquantes
  const noeud = vues.detail.rendre(magasin.etat(), S.lundi);
  dom.corps.appendChild(noeud);
  try {
    assert.equal(champ(noeud, 'previsions').open, false);
    await boutonNomme(noeud, 'Aller aux prévisions').click();
    assert.equal(champ(noeud, 'previsions').open, true);
  } finally { noeud.remove(); }
});

// ---------------------------------------------------------------- composant : la portion et son origine

/**
 * Adapté B-P0 : toute cette section (portion d'un composant) utilisait le riz comme « plat sans portion connue ».
 * Le riz a maintenant un repère validé : elle utilise la polenta, famille sans repère, pour garder son intention.
 * Semaine saisie : « polenta » (menu 2, garniture) avec une prévision de 20 portions.
 */
function etatPourPortion() {
  const e = etatSemaineSaisie();
  definirMenu(e, S.lundi, 2, 'poulet, polenta, carottes', h());
  prevision(e, S.lundi, 2, 20);
  return e;
}
const pageComposant = (nom = 'polenta') => vues.composant.rendre(magasin.etat(), composantNomme(magasin.etat(), nom).id);

test('composant : la portion affiche son état de poids et son origine, pour chaque origine', async () => {
  const portionDe = (e, nom = 'polenta') => { magasin.remplacer(e); return portionAffichee(pageComposant(nom)); };
  const origineDe = (e, nom = 'polenta') => grammageEffectif(e, composantNomme(e, nom)).origine;

  // 4. standard de base (repère de la base métier) : utilisé directement, étiqueté, jamais « à valider » (adapté le 2026-10-04)
  await avecReperes([{ ...R.familleRiz, produit: 'polenta' }], () => {
    const e = etatPourPortion();
    assert.equal(origineDe(e), 'standard_base');
    assert.equal(portionDe(e), 'Portion : 50 g, poids sec, standard de base (modifiable dans Réglages, votre valeur passe devant)');
    assert.ok(!pastilleTexte(pageComposant(), LIBELLE_ESTIMATION_A_VALIDER), 'un standard de base n\'est pas « à valider »');
    // 3. le standard maison passe avant la base
    definirStandard(e, 'polenta', 'garniture', ST.cruNet, h());
    assert.equal(portionDe(e), 'Portion : 150 g, poids cru net, standard maison');
  });
  // 3. standard maison, sans base
  const e = etatPourPortion();
  definirStandard(e, 'polenta', 'garniture', ST.sec, h());
  assert.equal(portionDe(e), 'Portion : 100 g, poids sec, standard maison');
  // 2. référence mémorisée pour ce nom : elle passe avant le standard
  e.memoire.polenta = { nom: 'polenta', attribue: true, type: 'a_preciser', categorie: 'feculent', charge: null, etapes: {},
    parRole: { garniture: { grammage: { valeur: 77, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'cru_net' } } } };
  assert.equal(origineDe(e), 'reference');
  assert.equal(portionDe(e), 'Portion : 77 g, poids cru net, référence de ce nom');
  // 1. correction sur le plat : elle passe avant tout
  modifierComposant(e, composantNomme(e, 'polenta').id, { grammage: { valeur: 55, unite: 'ml', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' } }, h());
  assert.equal(origineDe(e), 'plat');
  assert.equal(portionDe(e), 'Portion : 55 ml, poids cuit, corrigée pour ce plat');
  // Une préparation maison se compte en quantité finie : pas de « poids cuit » pour une sauce.
  const riche = etatRiche();
  magasin.remplacer(riche.e);
  assert.equal(portionAffichee(vues.composant.rendre(magasin.etat(), riche.ids.prep)), 'Portion : 50 ml, quantité finie, corrigée pour ce plat');
  assert.equal(portionAffichee(vues.composant.rendre(magasin.etat(), riche.ids.sec)), 'Portion : 100 g, poids cuit, corrigée pour ce plat');
  assert.equal(portionAffichee(vues.composant.rendre(magasin.etat(), riche.ids.vague)), undefined, 'un composant générique n\'a pas de portion par produit');
  assert.doesNotMatch(vues.composant.rendre(magasin.etat(), riche.ids.vague).textContent, /Portion :/);
});

test('composant : sans portion, un encadré propose deux gestes ; avec une portion, les deux gestes restent', () => {
  magasin.remplacer(etatPourPortion());
  const absente = pageComposant();
  verifierTexte(absente, 'composant sans portion');
  const encadre = classes(absente, 'portion')[0];
  assert.ok(encadre.className.split(' ').includes('encadre-alerte'));
  assert.match(encadre.textContent, /Portion : absente/);
  assert.ok(boutonNomme(encadre, 'Corriger pour ce plat seulement'));
  const lienReglages = liens(encadre).find((a) => a.textContent === 'Régler le standard maison');
  assert.equal(lienReglages.attributs.href, '#/reglages/standards');
  assert.equal(boutonNomme(encadre, 'Revenir au standard'), undefined, 'rien à retirer : pas de correction sur ce plat');

  const e = etatPourPortion();
  definirStandard(e, 'polenta', 'garniture', ST.sec, h());
  magasin.remplacer(e);
  const connue = classes(pageComposant(), 'portion')[0];
  assert.ok(!connue.className.split(' ').includes('encadre-alerte'));
  assert.ok(boutonNomme(connue, 'Corriger pour ce plat seulement'));
  assert.ok(liens(connue).some((a) => a.attributs.href === '#/reglages/standards' && a.textContent === 'Régler le standard maison'));
  assert.equal(boutonNomme(connue, 'Revenir au standard'), undefined, 'la portion vient du standard, pas d\'une correction');
});

test('composant : corriger un plat ne modifie pas le standard maison ; « Revenir au standard » rétablit son calcul', async () => {
  nettoyerPanneaux();
  const e = etatPourPortion();
  definirStandard(e, 'polenta', 'garniture', ST.sec, h());
  magasin.remplacer(e);
  const polenta = composantNomme(magasin.etat(), 'polenta').id;
  const calc = () => calculerComposant(magasin.etat(), polenta);
  const standardsAvant = structuredClone(magasin.etat().standards);
  const quantiteStandard = calc().quantiteTravail;
  assert.equal(quantiteStandard, 2000, '20 portions × 100 g secs : la portion est déjà celle d\'avant cuisson');

  await boutonNomme(pageComposant(), 'Corriger pour ce plat seulement').click();
  const d = panneauOuvert();
  assert.match(d.textContent, /Cette correction ne vaut que pour ce plat/);
  assert.equal(controleDe(d, 'Valeur de la portion').value, '', 'la correction part de rien');
  assert.equal(choisi(d, 'État du poids'), 'sec', 'l\'état de la portion utilisée est proposé');
  assert.deepEqual(await soumettre(d), ['Saisissez la valeur de la portion.']);
  remplir(d, 'Valeur de la portion', '55,5');
  remplir(d, 'État du poids', 'cuit');
  assert.deepEqual(await soumettre(d), []);
  const c = magasin.etat().composants[polenta];
  assert.deepEqual(c.grammage, { valeur: 55.5, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' });
  assert.deepEqual(magasin.etat().standards, standardsAvant, 'le standard maison n\'a pas bougé');
  assert.equal(portionAffichee(pageComposant()), 'Portion : 55,5 g, poids cuit, corrigée pour ce plat');
  assert.notEqual(calc().quantiteTravail, quantiteStandard);
  // Un autre plat de la même famille garde le standard.
  const suite = structuredClone(magasin.etat());
  definirMenu(suite, S.mardi, 2, 'polenta', h());
  assert.equal(grammageEffectif(suite, composantNomme(suite, 'polenta', S.mardi)).origine, 'standard');
  assert.equal(grammageEffectif(suite, composantNomme(suite, 'polenta', S.mardi)).valeur, 100);

  await boutonNomme(pageComposant(), 'Revenir au standard').click();
  assert.equal(magasin.etat().composants[polenta].grammage.valeur, null, 'la correction est retirée');
  assert.deepEqual(magasin.etat().standards, standardsAvant);
  assert.equal(calc().quantiteTravail, quantiteStandard, 'le calcul du standard est rétabli');
  assert.equal(calc().dependances[0].origine, 'standard');
  assert.equal(portionAffichee(pageComposant()), 'Portion : 100 g, poids sec, standard maison');
  assert.equal(boutonNomme(pageComposant(), 'Revenir au standard'), undefined);
});

test('composant : sans portion, corriger ce plat exige l\'état du poids et rend le calcul possible', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatPourPortion());
  const polenta = composantNomme(magasin.etat(), 'polenta').id;
  assert.equal(calculerComposant(magasin.etat(), polenta).statut, 'INCONNU');
  await boutonNomme(pageComposant(), 'Corriger pour ce plat seulement').click();
  const d = panneauOuvert();
  assert.equal(choisi(d, 'État du poids'), 'choisir…');
  remplir(d, 'Valeur de la portion', '80');
  assert.deepEqual(await soumettre(d), ['Choisissez l\'état du poids : sec, cru net ou cuit.']);
  remplir(d, 'Valeur de la portion', '0');
  remplir(d, 'État du poids', 'cru net');
  assert.deepEqual(await soumettre(d), ['Le grammage doit être un nombre strictement positif (ou vide).'], 'refus du domaine, panneau ouvert');
  assert.equal(magasin.etat().composants[polenta].grammage.valeur, null, 'rien n\'est enregistré');
  remplir(d, 'Valeur de la portion', '80');
  assert.deepEqual(await soumettre(d), []);
  assert.equal(portionAffichee(pageComposant()), 'Portion : 80 g, poids cru net, corrigée pour ce plat');
  assert.equal(calculerComposant(magasin.etat(), polenta).statut, 'CALCULE');
  assert.deepEqual(magasin.etat().standards, {}, 'aucun standard créé par une correction');
});

test('composant : une étape non appliquée est signalée, avec la quantité cuite à titre d\'information', () => {
  const e = etatPourPortion();
  definirStandard(e, 'polenta', 'garniture', ST.sec, h());
  magasin.remplacer(e);
  const sec = verifierTexte(pageComposant(), 'composant en poids sec');
  assert.match(sec, /cuisson/);
  assert.match(sec, /non appliquée : la portion est déjà exprimée avant cuisson/);
  assert.match(sec, /soit environ .+ une fois cuit, à titre indicatif/);
  assert.match(sec, /poids sec/);
  assert.equal(calculerComposant(magasin.etat(), composantNomme(magasin.etat(), 'polenta').id).etapes[0].appliquee, false);

  definirStandard(e, 'polenta', 'garniture', ST.cuit, h());
  magasin.remplacer(e);
  const cuit = verifierTexte(pageComposant(), 'composant en poids cuit');
  assert.match(cuit, /cuisson/);
  assert.doesNotMatch(cuit, /non appliquée/);
  assert.doesNotMatch(cuit, /une fois cuit, à titre indicatif/);
});

test('composant : plus aucun bouton ni pastille de validation, même pour un composant resté non validé', () => {
  const e = etatPourPortion();
  composantNomme(e, 'polenta').valide = false; // donnée d'avant le lot : plus rien ne la fait valider à l'écran
  magasin.remplacer(e);
  const noeud = pageComposant();
  verifierTexte(noeud, 'composant non validé');
  assert.deepEqual(boutons(noeud).map((b) => b.textContent).filter((t) => /^Valider/.test(t)), []);
  assert.deepEqual(textes(classes(noeud, 'pastille')).filter((t) => /^(validé|à valider)$/.test(t)), []);
  assert.doesNotMatch(noeud.textContent, /Valider ce composant/);
});

test('composant : le formulaire « Modifier » garde ses champs et son grammage gagne l\'état du poids', async () => {
  nettoyerPanneaux();
  magasin.remplacer(etatPourPortion());
  const polenta = composantNomme(magasin.etat(), 'polenta').id;
  await boutonNomme(pageComposant(), 'Modifier').click();
  const d = panneauOuvert();
  for (const libelle of ['Nom', 'Nom du produit acheté', 'Catégorie', 'Type', 'Rôle dans le plat', 'Charge de travail', 'Grammage par portion',
    'Unité du grammage', 'État du poids du grammage', 'Provenance du grammage', 'Source du grammage', 'Recette liée']) {
    assert.ok(controleDe(d, libelle), libelle);
  }
  assert.equal(choisi(d, 'État du poids du grammage'), 'cuit', 'une donnée sans état se lit « cuit »');
  assert.deepEqual([...controleDe(d, 'État du poids du grammage').enfants].map((o) => o.textContent), ['sec', 'cru net', 'cuit']);
  remplir(d, 'Grammage par portion', '90');
  remplir(d, 'État du poids du grammage', 'sec');
  remplir(d, 'Provenance du grammage', 'validé restaurant');
  assert.deepEqual(await soumettre(d), []);
  const g = magasin.etat().composants[polenta].grammage;
  assert.deepEqual([g.valeur, g.etat, g.statut], [90, 'sec', 'RESTAURANT_VALIDE']);
  assert.equal(portionAffichee(pageComposant()), 'Portion : 90 g, poids sec, corrigée pour ce plat');
});
