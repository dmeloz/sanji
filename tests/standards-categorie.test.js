// Standards maison par grande catégorie (décision du 2026-10-03) et légume sans famille connue.
// Jeux TEST_ONLY : mots de catégorie génériques, nombres arbitraires.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirMenu, definirStandard, supprimerStandard } from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { composantVide, etatInitial } from '../app/js/domaine/etat.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import {
  appliquerSavoir, cleStandardGroupe, grammageEffectif, lignesStandards, lignesStandardsGroupes,
} from '../app/js/domaine/savoir.js';
import { tableauBlanc } from '../app/js/domaine/tableau-blanc.js';
import { JEU_REPERES as R, JEU_STANDARDS as ST } from './jeux/TEST_ONLY-savoir.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, prevision } from './aide.js';

const composant = (champs) => ({ ...composantVide('c_test'), date: '2026-10-05', menu: 2, ...champs });
const std = (valeur, etat = 'sec') => ({ valeur, unite: 'g', etat, h: null });

test('clé de standard de catégorie : « groupe: » suivi de la clé du groupe', () => {
  assert.equal(cleStandardGroupe('cereales'), 'groupe:cereales');
});

test('portion : la famille avant la catégorie, la catégorie avant la base, la correction du plat avant tout', () => {
  const etat = etatInitial();
  const c = appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'feculent' }));
  const reperes = [R.groupeCereales];
  assert.equal(grammageEffectif(etat, c, reperes).origine, 'standard_base');

  etat.standards = { [cleStandardGroupe('cereales')]: { garniture: std(80) } };
  assert.deepEqual(grammageEffectif(etat, c, reperes), {
    valeur: 80, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE',
    source: 'standard maison de la catégorie « Pâtes, riz, céréales »', origine: 'standard',
  }, 'la catégorie passe avant le repère de la base');

  etat.standards.riz = { garniture: std(55, 'cuit') };
  assert.deepEqual(
    [grammageEffectif(etat, c, reperes).valeur, grammageEffectif(etat, c, reperes).source],
    [55, 'standard maison'], 'le standard de la famille passe avant celui de la catégorie');

  delete etat.standards.riz;
  c.role = 'plat_principal';
  assert.equal(grammageEffectif(etat, c, []), null, 'le rôle compte aussi pour la catégorie');
  c.role = 'garniture';

  etat.memoire = { riz: { parRole: { garniture: { grammage: { valeur: 77, unite: 'g', statut: 'SAISI_SERVICE', source: 'pesée', etat: 'cru_net' } } } } };
  assert.equal(grammageEffectif(etat, c, reperes).origine, 'reference', 'la référence du nom passe avant la catégorie');
  delete etat.memoire.riz;
  c.grammage = { valeur: 40, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', etat: 'sec' };
  assert.equal(grammageEffectif(etat, c, reperes).valeur, 40, 'la correction du plat passe avant tout');
});

test('une famille ne prend jamais le standard d\'une autre catégorie', () => {
  const etat = etatInitial();
  etat.standards = { [cleStandardGroupe('legumes')]: { garniture: std(120, 'cru_net') } };
  const c = appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'feculent' }));
  assert.equal(grammageEffectif(etat, c, []), null);
});

test('légume sans famille : il prend le standard « Légumes » s\'il existe, sinon aucune portion inventée', () => {
  const etat = etatInitial();
  const c = appliquerSavoir(etat, composant({ nom: 'tomates', categorie: 'legume' }));
  assert.equal(c.famille, null);
  assert.equal(grammageEffectif(etat, c, []), null, 'rien de réglé : pas de poids');
  etat.standards = { [cleStandardGroupe('legumes')]: { garniture: std(120, 'cru_net') } };
  assert.deepEqual(grammageEffectif(etat, c, []), {
    valeur: 120, unite: 'g', etat: 'cru_net', statut: 'RESTAURANT_VALIDE',
    source: 'standard maison de la catégorie « Légumes »', origine: 'standard',
  });
  // Un féculent sans famille (gnocchis…) n'a pas de catégorie de portion : rien n'est deviné.
  const g = appliquerSavoir(etat, composant({ nom: 'gnocchi', categorie: 'feculent' }));
  assert.equal(grammageEffectif(etat, g, []), null);
  // Une préparation maison reste en quantité finie : un standard en cru net ne lui est pas appliqué.
  c.type = 'preparation_maison';
  assert.equal(grammageEffectif(etat, c, []), null);
});

test('actions : définir, refuser et supprimer un standard de catégorie', () => {
  const e = etatVide();
  const cle = cleStandardGroupe('legumes');
  const s = definirStandard(e, cle, 'garniture', { valeur: 130, unite: 'g', etat: 'cru_net' }, h());
  assert.equal(s.valeur, 130);
  assert.equal(e.standards[cle].garniture.etat, 'cru_net');
  assert.throws(() => definirStandard(e, 'groupe:inconnu', 'garniture', { valeur: 1, unite: 'g', etat: 'sec' }, h()), /Famille de produits inconnue/);
  assert.throws(() => definirStandard(e, cle, 'role_inconnu', { valeur: 1, unite: 'g', etat: 'sec' }, h()), /Rôle/);
  const journal = JSON.stringify(e.journal);
  assert.match(journal, /Légumes \(catégorie\) garniture : 130 g/, 'le journal parle en clair');
  assert.doesNotMatch(journal, /groupe:/);
  assert.equal(supprimerStandard(e, cle, 'garniture', h()), true);
  assert.equal(Object.hasOwn(e.standards, cle), false);
  assert.equal(supprimerStandard(e, cle, 'garniture', h()), false);
});

test('export puis import : le standard de catégorie survit', () => {
  const e = etatVide();
  definirStandard(e, cleStandardGroupe('cereales'), 'garniture', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  const relu = importer(JSON.parse(JSON.stringify(exporter(e))));
  assert.equal(relu.standards[cleStandardGroupe('cereales')].garniture.valeur, 70);
});

test('lignes de l\'écran Réglages : une ligne par catégorie et par rôle, avec son repère de la base', () => {
  const e = etatVide();
  definirStandard(e, cleStandardGroupe('legumes'), 'garniture', { valeur: 130, unite: 'g', etat: 'cru_net' }, h());
  const lignes = lignesStandardsGroupes(e, [R.groupeLegumes]);
  assert.deepEqual([...new Set(lignes.map((l) => l.groupe))], ['cereales', 'pommes_de_terre', 'legumineuses', 'legumes']);
  const l = lignes.find((x) => x.groupe === 'legumes' && x.role === 'garniture');
  assert.equal(l.cleFamille, 'groupe:legumes');
  assert.equal(l.libelle, 'Légumes (toute la catégorie)');
  assert.equal(l.standard.valeur, 130);
  assert.equal(l.repereBase.min, 120);
  assert.equal(lignes.find((x) => x.groupe === 'legumes' && x.role === 'plat_principal').standard, null);
  // Les lignes par famille ne changent pas.
  assert.ok(lignesStandards(e).every((x) => !x.cleFamille.startsWith('groupe:')));
});

test('calcul : un légume sans famille chiffré par le standard de catégorie, sans perte inventée', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'poulet, tomates', h());
  prevision(e, S.lundi, 2, 20);
  const t = Object.values(e.composants).find((c) => c.nom === 'tomates');
  assert.equal(t.type, 'generique');
  assert.equal(calculerComposant(e, t.id).libelleQuantite, 'portions, composition à définir');

  definirStandard(e, cleStandardGroupe('legumes'), 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  const r = calculerComposant(e, t.id);
  assert.equal(r.statut, 'CALCULE');
  assert.equal(r.quantiteTravail, 2000);
  assert.equal(r.uniteTravail, 'g');
  assert.equal(r.aValider, true, 'sans famille, la perte de parage reste inconnue');
  assert.match(r.formule, /20 portions × 100 g = 2 000 g/);
  assert.match(r.formule, /perte de parage inconnue/);
});

test('tableau : un légume sans famille et sans standard est une portion à régler dans « Légumes »', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'poulet, tomates', h());
  const ligne = (tb) => tb.contexte.lignes.find((l) => /portion/.test(l.texte) && /régler/.test(l.texte));
  const avant = ligne(tableauBlanc(e, S.lundi));
  assert.ok(avant, 'la portion à régler est signalée');
  assert.match(avant.detail, /Légumes en garniture/);
  assert.equal(avant.lien, '#/reglages');
  definirStandard(e, cleStandardGroupe('legumes'), 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  assert.equal(ligne(tableauBlanc(e, S.lundi)), undefined, 'réglé : le besoin disparaît');
});
