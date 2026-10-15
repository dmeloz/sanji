// Cohérence d'une semaine entière (v131, transposé de l'audit) : les besoins produits sont la somme des composants, la liste
// Articles reprend les besoins, la cible de production est la quantité calculée arrondie. Menus réalistes, standards maison posés.

import test from 'node:test';
import assert from 'node:assert/strict';
import { assurerProductions, definirMenu, definirStandard } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { arrondirQuantite, calculerComposant } from '../app/js/domaine/calcul.js';
import { articlesDuPoste } from '../app/js/domaine/articles.js';
import { cibleProduction } from '../app/js/domaine/planification.js';
import { besoinsProduits } from '../app/js/domaine/produits.js';
import { FAMILLES } from '../app/js/domaine/savoir.js';
import { etatVide, h } from './aide.js';

const LUNDI = '2026-10-12';
const LUNDI_SUIVANT = '2026-10-19';
const TOLERANCE = 1e-6;
const PORTION_FECULENT = { plat_principal: 90, garniture: 60 };
const PORTION_AUTRE = 120;
const MENUS = [
  ['Trofie au saumon fumé et à l’aneth', 'Suprême de poulet, purée mousseline, carottes étuvées'],
  ['Risotto aux bolets', 'Filet de bœuf, pommes de terre grenailles, haricots verts'],
  ['Tagliatelles aux morilles', 'Escalope de veau, polenta, blettes'],
  ['Penne aux crevettes sauce curry', 'Filet de bar, riz, brocoli'],
  ['Spaghetti carbonara', 'Saumon, quinoa, fenouil'],
];

function semaine() {
  const e = etatVide();
  MENUS.forEach(([m1, m2], i) => {
    const date = `2026-10-${12 + i}`;
    definirMenu(e, date, 1, m1, h());
    definirMenu(e, date, 2, m2, h());
    definirCouvertsMidi(e, date, { total: 20 + i * 10, repartition: null }, h(1));
  });
  for (const f of FAMILLES) {
    for (const role of ['plat_principal', 'garniture']) {
      const feculent = f.categorie === 'feculent';
      definirStandard(e, f.cle, role, { valeur: feculent ? PORTION_FECULENT[role] : PORTION_AUTRE, unite: 'g', etat: feculent ? 'sec' : 'cru_net' }, h(2));
    }
  }
  assurerProductions(e, h(3));
  return e;
}

const cle = (nom, unite) => `${nom}|${unite}`;

test('les besoins produits sont la somme des composants chiffrés', () => {
  const e = semaine();
  const attendu = {};
  for (const c of Object.values(e.composants)) {
    const r = calculerComposant(e, c.id);
    if (r.statut === 'CALCULE' && c.type === 'produit_simple' && c.attribue) {
      const k = cle(c.produitNom || c.nom, r.uniteTravail);
      attendu[k] = (attendu[k] ?? 0) + r.brut;
    }
  }
  const lignes = besoinsProduits(e, LUNDI).lignes;
  assert.ok(lignes.length > 5);
  for (const l of lignes) assert.ok(Math.abs((attendu[cle(l.nom, l.unite)] ?? 0) - l.besoinBrut) <= TOLERANCE, cle(l.nom, l.unite));
});

test('Articles (deux semaines) = les besoins des deux semaines, produit par produit', () => {
  const e = semaine();
  const articles = {};
  for (const jour of articlesDuPoste(e, LUNDI).jours) for (const a of jour.articles) {
    if (a.quantite !== null) articles[cle(a.nom, a.unite)] = (articles[cle(a.nom, a.unite)] ?? 0) + a.quantite;
  }
  const besoins = {};
  for (const lundi of [LUNDI, LUNDI_SUIVANT]) for (const l of besoinsProduits(e, lundi).lignes) besoins[cle(l.nom, l.unite)] = (besoins[cle(l.nom, l.unite)] ?? 0) + l.besoinBrut;
  for (const k of new Set([...Object.keys(articles), ...Object.keys(besoins)])) {
    assert.ok(Math.abs((articles[k] ?? 0) - (besoins[k] ?? 0)) <= TOLERANCE, k);
  }
});

test('la cible d\'une production principale est la quantité calculée, arrondie', () => {
  const e = semaine();
  let verifiees = 0;
  for (const p of Object.values(e.productions)) {
    if (p.genre !== 'principale') continue;
    const r = calculerComposant(e, p.composantId);
    const attendu = r.statut === 'CALCULE' ? arrondirQuantite(r.quantiteTravail, r.uniteTravail) : null;
    assert.equal(cibleProduction(e, p.id), attendu, p.id);
    verifiees += 1;
  }
  assert.ok(verifiees > 5);
});
