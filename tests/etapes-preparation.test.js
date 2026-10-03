// Étapes à avance propre (B-P2) : une préparation a des étapes, chacune avec sa propre avance maximale.
// Aucune étape ni durée par défaut : tout vient de la règle que la propriétaire définit (jeu de test neutre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import {
  assurerProductions, definirPrevision, definirRegle, marquerFait, planifier, supprimerRegle,
} from '../app/js/domaine/actions.js';
import { exporter, importer, productionVide, regleVide } from '../app/js/domaine/etat.js';
import {
  avancesPossibles, etapesComposant, evaluationProduction, feuilleDuJour, regleDe,
} from '../app/js/domaine/planification.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

const SAMEDI = '2026-10-03T09:00:00.000Z';
const ETAPES = [
  { libelle: 'Couper', avanceMaxJours: 3 },
  { libelle: 'Blanchir', avanceMaxJours: 1 },
  { libelle: 'Finir', avanceMaxJours: 0 },
];

/** Menu du lundi saisi le vendredi, règle à trois étapes pour « carottes ». */
function scenario(etapes = ETAPES) {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  definirRegle(e, { nom: 'carottes', etapes }, h());
  return { e, c };
}
const etape = (e, c, cle) => Object.values(e.productions).find((p) => p.composantId === c && p.etapeCle === cle);

test('modèle : une règle vide n\'a aucune étape, une production vide n\'a ni etapeCle ni ordre', () => {
  assert.deepEqual(regleVide('r').etapes, []);
  assert.equal(productionVide('p').etapeCle, null);
  assert.equal(productionVide('p').ordre, null);
});

test('definirRegle : validation des étapes', () => {
  const e = etatVide();
  const regle = (etapes) => () => definirRegle(e, { nom: 'x', etapes }, h());
  assert.throws(regle([{ libelle: '  ', avanceMaxJours: 1 }]), /libellé/);
  assert.throws(regle([{ libelle: 'A', avanceMaxJours: -1 }]), /Avance/);
  assert.throws(regle([{ libelle: 'A', avanceMaxJours: 1.5 }]), /Avance/);
  assert.throws(regle([{ libelle: 'A', cle: 'a' }, { libelle: 'B', cle: 'a' }]), /unique/);
  assert.throws(regle([{ libelle: 'A', cle: 'é' }]), /accent|caractère/);
  assert.throws(regle([1, 2, 3, 4, 5, 6, 7].map((n) => ({ libelle: `E${n}` }))), /6 étapes/);
  const id = definirRegle(e, { nom: 'x', etapes: [{ libelle: 'Étuver', avanceMaxJours: null }, { libelle: 'Finir' }] }, h());
  assert.deepEqual(e.regles[id].etapes, [
    { cle: 'etuver', libelle: 'Étuver', avanceMaxJours: null }, { cle: 'finir', libelle: 'Finir', avanceMaxJours: null },
  ]);
  definirRegle(e, { id, nom: 'x', note: 'n' }, h());
  assert.equal(e.regles[id].etapes.length, 2, 'sans champ etapes, les étapes existantes sont conservées');
});

test('assurerProductions : une préparatoire par étape sauf la dernière, idempotent, la principale est la finition', () => {
  const { e, c } = scenario();
  const prods = Object.values(e.productions).filter((p) => p.composantId === c);
  assert.equal(prods.length, 3);
  const couper = etape(e, c, 'couper');
  assert.equal(couper.genre, 'preparatoire');
  assert.equal(couper.ordre, 0);
  assert.equal(couper.libelle, 'Couper : carottes');
  assert.equal(couper.dateService, S.lundi);
  assert.equal(etape(e, c, 'blanchir').libelle, 'Blanchir : carottes');
  const principale = e.productions[principaleDe(e, c)];
  assert.equal(principale.etapeCle, 'finir');
  assert.equal(principale.ordre, 2);
  const ids = Object.keys(e.productions).sort();
  assurerProductions(e);
  assurerProductions(e);
  assert.deepEqual(Object.keys(e.productions).sort(), ids);
});

test('sans règle d\'étapes : une seule production principale, règle du nom inchangée', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'carottes' });
  const idRegle = definirRegle(e, { nom: 'carottes', avanceMaxJours: 3, limiteUtilisationJours: 3 }, h());
  const prods = Object.values(e.productions).filter((p) => p.composantId === c);
  assert.equal(prods.length, 1);
  assert.equal(prods[0].etapeCle, null);
  assert.equal(regleDe(e, e.composants[c], 'couper'), e.regles[idRegle]);
  assert.deepEqual(etapesComposant(e, c), []);
  definirRegle(e, { nom: 'carottes', etapes: [{ libelle: 'Seule' }] }, h());
  assert.equal(Object.values(e.productions).filter((p) => p.composantId === c).length, 1, 'une seule étape : pas d\'étapes');
  assert.equal(e.regles[idRegle].etapes.length, 1);
});

test('scénario du lundi : couper le samedi autorisé, blanchir le samedi hors règle, le dimanche impossible, le lundi autorisé', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  const blanchir = etape(e, c, 'blanchir');
  const r1 = planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  assert.equal(r1.evaluation.autorisee, true);
  assert.equal(r1.evaluation.jours, 2);
  const r2 = planifier(e, blanchir.id, S.samediPrecedent, 'apres_midi', h());
  assert.equal(r2.evaluation.autorisee, false);
  assert.match(r2.evaluation.alertes.join(' '), /hors règle/);
  assert.throws(() => planifier(e, blanchir.id, S.dimanchePrecedent, 'avant_midi', h()), /dimanche/i);
  const r3 = planifier(e, blanchir.id, S.lundi, 'avant_midi', h());
  assert.equal(r3.evaluation.autorisee, true);
  assert.equal(evaluationProduction(e, couper.id).autorisee, true);
});

test('une étape ne se planifie pas après l\'étape suivante, ni avant la précédente', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  const blanchir = etape(e, c, 'blanchir');
  planifier(e, blanchir.id, S.samediPrecedent, 'avant_midi', h());
  assert.throws(() => planifier(e, couper.id, S.lundi, 'avant_midi', h()), /après l'étape suivante/);
  assert.equal(couper.jourDecide, null, 'rien n\'a été décidé');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  assert.throws(() => planifier(e, blanchir.id, S.veille, 'avant_midi', h()), /avant l'étape précédente/);
});

test('« Fait » respecte l\'ordre des étapes', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  const blanchir = etape(e, c, 'blanchir');
  assert.throws(() => marquerFait(e, blanchir.id, null, SAMEDI), /doit être faite avant/);
  assert.throws(() => marquerFait(e, principaleDe(e, c), 40, SAMEDI), /doit être faite avant/);
  assert.equal(blanchir.etat, 'a_faire');
  marquerFait(e, couper.id, null, SAMEDI);
  marquerFait(e, blanchir.id, null, SAMEDI);
  assert.equal(blanchir.etat, 'fait');
});

test('une étape faite le samedi n\'est ni recréée ni supprimée quand la prévision change', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e, couper.id, null, SAMEDI);
  const avant = Object.keys(e.productions).sort();
  definirPrevision(e, S.lundi, 1, 46, h(5));
  assert.deepEqual(Object.keys(e.productions).sort(), avant);
  assert.equal(etape(e, c, 'couper').id, couper.id);
  assert.equal(etape(e, c, 'couper').etat, 'fait');
  // Même si la règle perd cette étape, l'étape faite n'est jamais supprimée.
  definirRegle(e, { nom: 'carottes', etapes: [] }, h(6));
  assert.equal(etape(e, c, 'couper')?.etat, 'fait');
  assert.equal(etape(e, c, 'blanchir'), undefined, 'les étapes non faites sont retirées');
});

test('un changement de règle retire les étapes non faites et le journal les nomme', () => {
  const { e, c } = scenario();
  definirRegle(e, { nom: 'carottes', etapes: [{ libelle: 'Couper', avanceMaxJours: 3 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h(2));
  assert.equal(etape(e, c, 'blanchir'), undefined);
  assert.ok(etape(e, c, 'couper'));
  const texte = e.journal.map((l) => `${l.action} ${l.detail}`).join('\n');
  assert.match(texte, /retir.*Blanchir : carottes/);
  // Un libellé renommé met à jour la production non faite sans la dupliquer.
  definirRegle(e, { nom: 'carottes', etapes: [{ cle: 'couper', libelle: 'Tailler', avanceMaxJours: 3 }, { libelle: 'Finir' }] }, h(3));
  assert.equal(etape(e, c, 'couper').libelle, 'Tailler : carottes');
  assert.equal(Object.values(e.productions).filter((p) => p.composantId === c).length, 2);
  // Supprimer la règle retire aussi les étapes non faites, et le dit.
  const id = Object.keys(e.regles)[0];
  supprimerRegle(e, id, h(4));
  assert.equal(Object.values(e.productions).filter((p) => p.composantId === c).length, 1);
  assert.match(e.journal.map((l) => l.detail).join('\n'), /Tailler : carottes/);
  assert.equal(e.productions[principaleDe(e, c)].etapeCle, null);
});

test('étape sans avance définie : conservation à confirmer, jamais autorisée au-delà de deux jours', () => {
  const { e, c } = scenario([{ libelle: 'Couper' }, { libelle: 'Blanchir' }, { libelle: 'Finir' }]);
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  const ev2 = evaluationProduction(e, couper.id);
  assert.equal(ev2.autorisee, true);
  assert.equal(ev2.conservation, 'a_confirmer');
  planifier(e, couper.id, S.veille, 'avant_midi', h());
  const ev3 = evaluationProduction(e, couper.id);
  assert.equal(ev3.autorisee, false);
  assert.match(ev3.alertes.join(' '), /hors règle/);
});

test('la finition a 0 jour d\'avance par défaut et avancesPossibles suit chaque étape', () => {
  const { e, c } = scenario();
  const possibles = avancesPossibles(e, S.samediPrecedent).filter((a) => a.composantId === c);
  const parCle = Object.fromEntries(possibles.map((a) => [a.libelle, a.evaluation.autorisee]));
  assert.equal(parCle['Couper : carottes'], true);
  assert.equal(parCle['Blanchir : carottes'], false);
  assert.equal(parCle.carottes, false, 'la finition ne s\'avance pas');
});

test('etapesComposant : états ordonnés pour l\'affichage', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e, couper.id, null, SAMEDI);
  const liste = etapesComposant(e, c);
  assert.deepEqual(liste.map((x) => [x.etapeCle, x.libelle, x.ordre, x.etat]), [
    ['couper', 'Couper', 0, 'fait'], ['blanchir', 'Blanchir', 1, 'a_planifier'], ['finir', 'Finir', 2, 'a_planifier'],
  ]);
  assert.equal(liste[0].faitLe, '2026-10-03');
  assert.equal(liste[0].jourDecide, S.samediPrecedent);
  assert.equal(liste[1].faitLe, null);
});

test('export et import conservent les étapes ; une ancienne règle sans étapes reste lisible', () => {
  const { e } = scenario();
  const relu = importer(exporter(e, h()));
  const regle = Object.values(relu.regles)[0];
  assert.equal(regle.etapes.length, 3);
  assert.deepEqual(regle.etapes[1], { cle: 'blanchir', libelle: 'Blanchir', avanceMaxJours: 1 });
  const ancien = JSON.parse(exporter(e, h()));
  for (const r of Object.values(ancien.etat.regles)) delete r.etapes;
  for (const p of Object.values(ancien.etat.productions)) { delete p.etapeCle; delete p.ordre; }
  const vieux = importer(JSON.stringify(ancien));
  assert.deepEqual(Object.values(vieux.regles)[0].etapes, []);
  assert.equal(Object.values(vieux.productions)[0].etapeCle, null);
});

test('feuille Jour du lundi : l\'étape faite le samedi est dans « faites », la suivante reste à faire', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e, couper.id, null, SAMEDI);
  const feuille = feuilleDuJour(e, S.lundi);
  assert.ok(feuille.lecture.faites.some((l) => l.productionId === couper.id));
  const aFaire = feuille.lecture.autres.map((l) => l.libelle);
  assert.ok(aFaire.includes('Blanchir : carottes'));
  assert.ok(!aFaire.includes('Couper : carottes'));
});

let dom;
let magasin;
let vueJour;
let vueComposant;
let vueReglages;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueJour = await import('../app/js/ui/vue-jour.js');
  vueComposant = await import('../app/js/ui/vue-composant.js');
  vueReglages = await import('../app/js/ui/vue-reglages.js');
});
after(() => dom.restaurer());

test('vues : Jour montre « déjà avancé sam. », Composant liste les étapes', () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e, couper.id, null, SAMEDI);
  magasin.remplacer(e);
  const jour = vueJour.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(jour, /déjà avancé sam\./);
  const composant = vueComposant.rendre(magasin.etat(), c).textContent;
  assert.match(composant, /Étapes de préparation/);
  assert.match(composant, /Couper/);
  assert.match(composant, /Blanchir/);
  assert.match(composant, /déjà avancé sam\./);
});

test('vue Composant : aucun bloc d\'étapes sans règle d\'étapes', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'pates' });
  magasin.remplacer(e);
  assert.doesNotMatch(vueComposant.rendre(magasin.etat(), c).textContent, /Étapes de préparation/);
});

test('Réglages : la règle affiche ses étapes et dit que l\'avance n\'est pas une conservation', () => {
  const { e } = scenario();
  magasin.remplacer(e);
  assert.equal(typeof vueReglages.rendre, 'function');
  const texte = vueReglages.rendre(magasin.etat(), 'organisation').textContent;
  assert.match(texte, /Couper/);
  assert.match(texte, /pas une durée de conservation/);
});

test('Réglages : l\'éditeur d\'étapes enregistre une règle à trois étapes, avances vides = non définies', async () => {
  magasin.remplacer(etatVide());
  const noeud = vueReglages.rendre(magasin.etat(), 'organisation');
  await boutons(noeud).find((b) => b.textContent === 'Ajouter une règle').click();
  const [dialogue] = panneauxOuverts(dom.corps);
  assert.match(dialogue.textContent, /pas une durée de conservation/);
  const champsTexte = dialogue.tous((x) => x.balise === 'input');
  assert.equal(champsTexte.length, 3 + 12, 'nom, avance, limite, puis six lignes de deux champs');
  const saisie = ['carottes', '', '', 'Couper', '3', 'Blanchir', '', 'Finir', ''];
  saisie.forEach((v, i) => { champsTexte[i].value = v; });
  await dialogue.enfants[0].declencher('submit');
  const regle = Object.values(magasin.etat().regles)[0];
  assert.deepEqual(regle.etapes, [
    { cle: 'couper', libelle: 'Couper', avanceMaxJours: 3 },
    { cle: 'blanchir', libelle: 'Blanchir', avanceMaxJours: null },
    { cle: 'finir', libelle: 'Finir', avanceMaxJours: null },
  ]);
  if (dialogue.open) dialogue.close();
});

test('Réglages : renommer « Couper » en « Tailler » garde la clé, la production et son état « fait »', async () => {
  const { e, c } = scenario();
  const couper = etape(e, c, 'couper');
  planifier(e, couper.id, S.samediPrecedent, 'avant_midi', h());
  marquerFait(e, couper.id, null, SAMEDI);
  magasin.remplacer(e);
  const noeud = vueReglages.rendre(magasin.etat(), 'organisation');
  const tous = boutons(noeud);
  await tous[tous.findIndex((b) => b.textContent === 'Supprimer') - 1].click();
  const [dialogue] = panneauxOuverts(dom.corps);
  const champsTexte = dialogue.tous((x) => x.balise === 'input');
  champsTexte[3].value = 'Tailler';
  // Une nouvelle ligne (4e étape) reçoit une clé nouvelle et unique, même si son libellé ressemble à une clé existante.
  champsTexte[9].value = 'Couper';
  await dialogue.enfants[0].declencher('submit');
  const regle = Object.values(magasin.etat().regles)[0];
  assert.deepEqual(regle.etapes.map((x) => x.cle).slice(0, 3), ['couper', 'blanchir', 'finir']);
  assert.equal(regle.etapes[0].libelle, 'Tailler');
  assert.equal(new Set(regle.etapes.map((x) => x.cle)).size, regle.etapes.length, 'clés uniques');
  const prods = Object.values(magasin.etat().productions).filter((p) => p.composantId === c);
  const tailler = prods.filter((p) => p.etapeCle === 'couper');
  assert.equal(tailler.length, 1, 'pas de doublon');
  assert.equal(tailler[0].id, couper.id);
  assert.equal(tailler[0].etat, 'fait');
  if (dialogue.open) dialogue.close();
});
