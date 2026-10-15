// Invariants des quantités à produire (v131), transposés des audits de calculs (balayage réduit, quelques secondes) :
// pour chaque famille de produits, chaque rôle, chaque état du poids, plusieurs couverts et répartitions.
// Les valeurs attendues viennent des coefficients que le calcul expose lui-même, jamais d'un chiffre de restaurant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouterComposant, definirStandard } from '../app/js/domaine/actions.js';
import { definirCouvertsMidi } from '../app/js/domaine/actions-couverts.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { FAMILLES } from '../app/js/domaine/savoir.js';
import { quantite } from '../app/js/ui/format.js';
import { etatVide, h } from './aide.js';

const JOUR = '2026-10-12';
const COUVERTS = [10, 20, 40];
const ROLES = ['plat_principal', 'garniture', 'sauce', 'herbe'];
const ETATS = ['sec', 'cru_net', 'cuit'];
const PORTION_TEST = 100;
const TOLERANCE = 1e-6;
const SUJETS = [...FAMILLES.map((f) => f.mots[0]), 'poulet', 'tomate', 'sauce tomate', 'persil'];
const REPARTITIONS = { defaut: () => null, moitie: (t) => ({ 1: t / 2, 2: t / 2 }) };

const modele = etatVide();
const composants = [];
for (const nom of SUJETS) for (const menu of [1, 2]) for (const role of ROLES) {
  composants.push({ nom, menu, role, id: ajouterComposant(modele, JOUR, menu, { nom, attribue: true, role }, h()) });
}

/** Une quantité par (variante, couverts, répartition, composant) : variante = standards maison, ou portion posée sur le plat. */
function balayer() {
  const sortie = new Map();
  for (const total of COUVERTS) for (const [rn, repartir] of Object.entries(REPARTITIONS)) {
    if (rn === 'moitie' && total % 2 !== 0) continue;
    for (const variante of ['base', ...ETATS.map((e) => `std:${e}`), 'plat:sec']) {
      const e = structuredClone(modele);
      definirCouvertsMidi(e, JOUR, { total, repartition: repartir(total) }, h(1));
      if (variante.startsWith('std:')) {
        for (const f of FAMILLES) for (const role of ['plat_principal', 'garniture']) {
          definirStandard(e, f.cle, role, { valeur: PORTION_TEST, unite: 'g', etat: variante.slice(4) }, h(2));
        }
      }
      for (const c of composants) {
        if (variante.startsWith('plat:')) {
          Object.assign(e.composants[c.id].grammage, { valeur: PORTION_TEST, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'test', etat: variante.slice(5) });
        }
        sortie.set([variante, total, rn, c.nom, c.role, c.menu].join('|'), { calcul: calculerComposant(e, c.id), composant: e.composants[c.id] });
      }
    }
  }
  return sortie;
}
const resultats = balayer();
const chaque = (verifier) => { for (const [cle, r] of resultats) verifier(cle, r.calcul, r.composant); };
const grammageDe = (calcul) => calcul.dependances.find((d) => d.parametre === 'grammage');
const produit = (calcul) => calcul.etapes.filter((x) => x.appliquee).reduce((p, x) => p * x.coefficient, 1);

test('la quantité est toujours finie et positive ou nulle ; elle n\'est vide que si le calcul est inconnu', () => {
  chaque((cle, c) => {
    if (c.quantiteTravail !== null) assert.ok(Number.isFinite(c.quantiteTravail) && c.quantiteTravail >= 0, `${cle} : ${c.quantiteTravail}`);
    else assert.notEqual(c.statut, 'CALCULE', `${cle} : calculé sans quantité`);
    if (c.statut === 'CALCULE') assert.notEqual(c.quantiteTravail, null, cle);
  });
});

test('chaîne : quantité = portions × portion ÷ produit des coefficients appliqués (produit simple)', () => {
  let verifies = 0;
  chaque((cle, c, composant) => {
    const g = grammageDe(c);
    if (c.statut !== 'CALCULE' || !g || composant.type !== 'produit_simple') return;
    const attendu = (c.portions.total * g.valeur) / produit(c);
    assert.ok(Math.abs(attendu - c.quantiteTravail) <= TOLERANCE * Math.max(1, attendu), `${cle} : ${attendu} ≠ ${c.quantiteTravail}`);
    verifies += 1;
  });
  assert.ok(verifies > 1000, `balayage trop pauvre : ${verifies}`);
});

test('étapes conformes à l\'état du poids : cuit = toutes les étapes, sec et cru net = le parage seul', () => {
  chaque((cle, c, composant) => {
    const g = grammageDe(c);
    if (c.statut !== 'CALCULE' || !g || composant.type !== 'produit_simple') return;
    const appliquees = c.etapes.filter((x) => x.appliquee).map((x) => x.etape);
    const voulues = c.etapes.filter((x) => g.etat === 'cuit' || x.etape === 'parage').map((x) => x.etape);
    assert.deepEqual(appliquees, voulues, `${cle} (${g.etat})`);
    assert.equal(new Set(c.etapes.map((x) => x.etape)).size, c.etapes.length, `${cle} : étape en double`);
  });
});

test('proportionnalité : 2 × la moitié du service donne le double, à répartition égale', () => {
  let verifies = 0;
  for (const [cle, r] of resultats) {
    const [variante, total, rn, nom, role, menu] = cle.split('|');
    if (rn !== 'moitie' || r.calcul.quantiteTravail === null || r.calcul.uniteTravail === 'portion') continue;
    const double = resultats.get([variante, Number(total) * 2, rn, nom, role, menu].join('|'));
    if (!double) continue;
    const attendu = 2 * r.calcul.quantiteTravail;
    assert.ok(Math.abs(double.calcul.quantiteTravail - attendu) <= TOLERANCE * Math.max(1, attendu), cle);
    verifies += 1;
  }
  assert.ok(verifies > 100, `balayage trop pauvre : ${verifies}`);
});

test('menu 1 + menu 2 = le total des couverts, pour toute répartition', () => {
  let verifies = 0;
  for (const [cle, r] of resultats) {
    const [variante, total, rn, nom, role, menu] = cle.split('|');
    if (menu !== '1' || r.calcul.portions.total === undefined) continue;
    const m2 = resultats.get([variante, total, rn, nom, role, 2].join('|'));
    assert.equal(r.calcul.portions.total + m2.calcul.portions.total, Number(total), cle);
    verifies += 1;
  }
  assert.ok(verifies > 1000);
});

test('une quantité en portions ne s\'affiche jamais en g, kg ni ml ; une quantité en g, jamais sans g ou kg', () => {
  chaque((cle, c) => {
    const affiche = quantite(c.quantiteTravail, c.uniteTravail);
    if (c.uniteTravail === 'portion') assert.doesNotMatch(affiche ?? '', /\b(g|kg|ml)\b/, cle);
    if (c.uniteTravail === 'g' && c.quantiteTravail !== null) assert.match(affiche, / (g|kg)$/, cle);
    if (c.uniteTravail === 'ml' && c.quantiteTravail !== null) assert.match(affiche, / ml$/, cle);
  });
});
