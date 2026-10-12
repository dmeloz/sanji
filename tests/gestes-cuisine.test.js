// Lot 7 (v129) : verbes appris par fiche (principe 12) et premières valeurs d'une famille sans standard (principe 13).
// Données TEST_ONLY. Rien n'est appliqué sans geste de la propriétaire.

import test from 'node:test';
import assert from 'node:assert/strict';
import { definirStandard } from '../app/js/domaine/actions.js';
import { definirVerbe } from '../app/js/domaine/actions-fiches.js';
import { accepterApprentissage, ecarterApprentissage } from '../app/js/domaine/actions-apprentissage.js';
import { propositionsApprentissage } from '../app/js/domaine/apprentissage.js';
import { composantVide, etatInitial, exporter, importer } from '../app/js/domaine/etat.js';
import { VERBES, retenirFiche } from '../app/js/domaine/fiches-retenues.js';
import { verbeDe } from '../app/js/domaine/mise-en-place.js';
import { h } from './aide.js';

const AUJOURDHUI = '2026-10-06';
const aller = (e) => importer(exporter(e, h(0)), AUJOURDHUI);

function poser(e, id, nom, { attribue = true, categorie = 'feculent', famille = 'pates_seches', role = 'plat_principal' } = {}) {
  e.composants[id] = { ...composantVide(id), date: '2026-10-05', menu: 1, nom, categorie, famille, role, attribue, valide: true, type: 'produit_simple' };
  return id;
}

// ------------------------------------------------------------------ P12 : verbes

test('verbeDe lit le verbe de la fiche retenue avant le comportement par défaut', () => {
  const e = etatInitial();
  const c = { nom: 'courgettes', categorie: 'legume', famille: 'courgettes', type: 'produit_simple' };
  assert.equal(verbeDe(c, e), null);
  retenirFiche(e, 'courgettes', { verbe: 'Sauter' }, h(1));
  assert.equal(verbeDe(c, e), 'Sauter');
  retenirFiche(e, 'fusilli', { verbe: 'aucun' }, h(1));
  assert.equal(verbeDe({ nom: 'fusilli', categorie: 'feculent', famille: 'pates_seches', type: 'produit_simple' }, e), null, 'aucun verbe : même un féculent');
  assert.equal(verbeDe({ nom: 'riz', categorie: 'feculent', famille: 'riz', type: 'produit_simple' }, e), 'Cuire', 'défaut inchangé sans fiche');
});

test('une fiche qui ne contient qu\'un verbe est gardée, aller-retour exporter / importer compris', () => {
  const e = etatInitial();
  poser(e, 'c1', 'courgettes', { categorie: 'legume', famille: 'courgettes', role: 'garniture' });
  definirVerbe(e, 'c1', 'Rôtir', h(1));
  assert.equal(e.fiches_retenues.courgettes.verbe, 'Rôtir');
  const e2 = aller(e);
  assert.equal(e2.fiches_retenues.courgettes.verbe, 'Rôtir');
  assert.equal(verbeDe(e2.composants.c1, e2), 'Rôtir');
});

test('importer rejette un verbe hors liste ; un ancien état sans verbe s\'importe', () => {
  const e = etatInitial();
  retenirFiche(e, 'courgettes', { categorie: 'legume', role: 'garniture' }, h(1));
  const doc = JSON.parse(exporter(e, h(0)));
  assert.equal(aller(e).fiches_retenues.courgettes.verbe, undefined);
  doc.etat.fiches_retenues.courgettes.verbe = 'Danser';
  doc.etat.fiches_retenues.seul = { verbe: 'Manger', h: h(1) };
  doc.etat.fiches_retenues.autre = { verbe: 'Cuire', h: h(1) };
  const e2 = importer(JSON.stringify(doc), AUJOURDHUI);
  assert.equal(e2.fiches_retenues.courgettes.verbe, undefined);
  assert.equal(e2.fiches_retenues.seul, undefined, 'une fiche au seul verbe invalide ne retient rien');
  assert.equal(e2.fiches_retenues.autre.verbe, 'Cuire');
  assert.ok(VERBES.includes('Cuire') && VERBES.includes('Gratiner'));
});

test('definirVerbe : élément hors poste refusé (pas de fiche), verbe hors liste refusé', () => {
  const e = etatInitial();
  poser(e, 'c1', 'courgettes', { attribue: false, categorie: 'legume', famille: 'courgettes', role: 'garniture' });
  assert.throws(() => definirVerbe(e, 'c1', 'Sauter', h(1)), /poste/);
  assert.deepEqual(e.fiches_retenues, {});
  e.composants.c1.attribue = true;
  assert.throws(() => definirVerbe(e, 'c1', 'Danser', h(1)), /verbe/i);
  assert.throws(() => definirVerbe(e, 'c1', 'Sauter', 'pas une date'), /Horodatage/);
});

// ------------------------------------------------------------------ P13 : premières valeurs

let n = 0;
function corriger(e, date, valeur, { nom = 'polenta', famille = 'polenta', etat = 'cuit' } = {}) {
  n += 1;
  const id = `p_${n}`;
  e.composants[id] = { ...composantVide(id), date, menu: 1, nom, categorie: 'feculent', famille, role: 'garniture', attribue: true, valide: true,
    grammage: { valeur, unite: 'g', etat, statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  return id;
}

test('première valeur : après 2 valeurs concordantes, pas avant ; médiane arrondie ; rien appliqué', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 150, { nom: 'polenta crémeuse' });
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), []);
  corriger(e, '2026-10-02', 155, { nom: 'polenta grillée' });
  const [p, ...autres] = propositionsApprentissage(e, AUJOURDHUI);
  assert.equal(autres.length, 0);
  assert.deepEqual([p.cleFamille, p.role, p.valeur, p.nombre, p.premiereValeur, p.actuelle], ['polenta', 'garniture', 153, 2, true, null]);
  assert.match(p.texte, /polenta/);
  assert.deepEqual(e.standards, {}, 'rien n\'est appliqué');
});

test('première valeur : les fiches retenues de la même famille comptent ; une valeur future jamais', () => {
  const e = etatInitial();
  retenirFiche(e, 'quinoa rouge', { categorie: 'feculent', role: 'garniture', famille: 'quinoa', grammage: { valeur: 100, unite: 'g', etat: 'cuit' } }, h(1));
  retenirFiche(e, 'quinoa blanc', { categorie: 'feculent', role: 'garniture', famille: 'quinoa', grammage: { valeur: 105, unite: 'g', etat: 'cuit' } }, '2026-12-01T08:00:00.000Z');
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), [], 'la seconde est dans le futur');
  retenirFiche(e, 'quinoa blanc', { categorie: 'feculent', role: 'garniture', famille: 'quinoa', grammage: { valeur: 105, unite: 'g', etat: 'cuit' } }, h(5));
  assert.equal(propositionsApprentissage(e, AUJOURDHUI)[0].valeur, 103);
});

test('première valeur : valeurs divergentes de plus de 10 %, états du poids différents, ou famille déjà munie d\'un standard : rien', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 100, { nom: 'polenta a' });
  corriger(e, '2026-10-02', 130, { nom: 'polenta b' });
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), []);
  const e2 = etatInitial();
  corriger(e2, '2026-10-01', 100, { nom: 'polenta a', etat: 'cru_net' });
  corriger(e2, '2026-10-02', 100, { nom: 'polenta b', etat: 'cuit' });
  assert.deepEqual(propositionsApprentissage(e2, AUJOURDHUI), []);
  const e3 = etatInitial();
  definirStandard(e3, 'polenta', 'garniture', { valeur: 90, unite: 'g', etat: 'cuit' }, h(1));
  corriger(e3, '2026-10-01', 150, { nom: 'polenta a' });
  corriger(e3, '2026-10-02', 152, { nom: 'polenta b' });
  assert.deepEqual(propositionsApprentissage(e3, AUJOURDHUI).filter((x) => x.premiereValeur), []);
});

test('première valeur : un même plat compte une fois', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 150);
  corriger(e, '2026-10-02', 150);
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), []);
});

test('première valeur : accepter pose le standard maison ; écarter se tait 30 jours', () => {
  const e = etatInitial();
  corriger(e, '2026-10-01', 150, { nom: 'polenta a' });
  corriger(e, '2026-10-02', 150, { nom: 'polenta b' });
  const e2 = structuredClone(e);
  accepterApprentissage(e, 'polenta', 'garniture', { valeur: 150, unite: 'g', etat: 'cuit' }, `${AUJOURDHUI}T08:00:00.000Z`);
  assert.equal(e.standards.polenta.garniture.valeur, 150);
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), []);
  ecarterApprentissage(e2, 'polenta', 'garniture', `${AUJOURDHUI}T08:00:00.000Z`);
  assert.deepEqual(e2.standards, {});
  assert.deepEqual(propositionsApprentissage(e2, '2026-10-20'), [], 'silence');
  const e3 = aller(e2);
  assert.deepEqual(propositionsApprentissage(e3, '2026-10-20'), [], 'silence conservé à l\'import');
});

test('verbe : définir le verbe d\'un élément déjà fiché garde portion, rôle et catégorie ; un retenirFiche ultérieur garde le verbe', () => {
  const e = etatInitial();
  poser(e, 'c1', 'quinoa', { famille: 'quinoa', role: 'garniture' });
  retenirFiche(e, 'quinoa', { categorie: 'feculent', role: 'garniture', famille: 'quinoa', grammage: { valeur: 100, unite: 'g', etat: 'cuit' } }, h(1));
  definirVerbe(e, 'c1', 'Sauter', h(2));
  const f = e.fiches_retenues.quinoa;
  assert.deepEqual([f.verbe, f.grammage.valeur, f.role, f.categorie], ['Sauter', 100, 'garniture', 'feculent']);
  retenirFiche(e, 'quinoa', { role: 'garniture', grammage: { valeur: 110, unite: 'g', etat: 'cuit' } }, h(3));
  assert.deepEqual([e.fiches_retenues.quinoa.verbe, e.fiches_retenues.quinoa.grammage.valeur], ['Sauter', 110]);
});

test('verbe : régler seulement le verbe ne rajeunit pas une portion de 60 jours (aucune « première valeur »)', () => {
  const e = etatInitial();
  const ancien = '2026-08-07T08:00:00.000Z';
  for (const nom of ['quinoa rouge', 'quinoa blanc']) {
    retenirFiche(e, nom, { categorie: 'feculent', role: 'garniture', famille: 'quinoa', grammage: { valeur: 100, unite: 'g', etat: 'cuit' } }, ancien);
  }
  poser(e, 'c1', 'quinoa rouge', { famille: 'quinoa', role: 'garniture' });
  poser(e, 'c2', 'quinoa blanc', { famille: 'quinoa', role: 'garniture' });
  definirVerbe(e, 'c1', 'Sauter', h(5));
  definirVerbe(e, 'c2', 'Sauter', h(5));
  assert.equal(e.fiches_retenues['quinoa rouge'].h, ancien);
  assert.deepEqual(propositionsApprentissage(e, AUJOURDHUI), []);
});

test('première valeur : le texte dit le vrai nombre de valeurs', () => {
  const e = etatInitial();
  for (const [i, nom] of ['a', 'b', 'c'].entries()) corriger(e, `2026-10-0${i + 1}`, 150, { nom: `polenta ${nom}` });
  const [p] = propositionsApprentissage(e, AUJOURDHUI);
  assert.equal(p.nombre, 3);
  assert.match(p.texte, /tapé 3 fois/);
});

test('importer : une fiche hors poste (attribue:false) qui n\'a qu\'un verbe n\'est pas conservée', () => {
  const e = etatInitial();
  const doc = JSON.parse(exporter(e, h(0)));
  doc.etat.fiches_retenues.courgettes = { nom: 'courgettes', attribue: false, verbe: 'Sauter', h: h(1) };
  const e2 = importer(JSON.stringify(doc), AUJOURDHUI);
  assert.equal(e2.fiches_retenues.courgettes, undefined);
});
