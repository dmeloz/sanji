// Standards de base (décision du 2026-10-04, « Standards de base et ajustement terrain ») : choix de la valeur de base
// entre le référentiel culinaire et la base métier, borne prudente pour l'hygiène, provenance et écart toujours gardés.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGLES_GENERALES, USAGES, rattachementsDe, rendementDeBase, reperesAide, reperesConservation, reperesCuisson,
  standardDeBase, texteProvenance,
} from '../app/js/domaine/standards-base.js';
import { FAMILLES } from '../app/js/domaine/savoir.js';
import { SAVOIR_CULINAIRE } from '../app/js/donnees/savoir-culinaire.js';

test('nombre d\'entrées rattachées par usage (choisies à la main)', () => {
  const compte = Object.fromEntries(USAGES.map((u) => [u, rattachementsDe(u).length]));
  assert.deepEqual(compte, {
    rendement_parage: 6, rendement_cuisson: 5, conservation: 6, cuisson_temps: 6, temperature: 8, buffet_couvert: 2,
    refroidissement: 1, limite_duree: 2, duree_stockage: 3, allergene: 3,
  });
  assert.equal(SAVOIR_CULINAIRE.filter((x) => x.aide).length, SAVOIR_CULINAIRE.length - 42, 'tout le reste sert d\'aide');
});

test('rendement : le référentiel confirmé à la source prime, l\'écart avec la base métier reste visible', () => {
  const carottes = rendementDeBase('carottes', 'parage');
  assert.deepEqual([carottes.origine, carottes.valeur, carottes.unite, carottes.coefficient, carottes.statut],
    ['referentiel', 18.5, '%', 0.815, 'STANDARD_BASE'], 'milieu de 12–25 % de perte');
  assert.deepEqual(carottes.fourchette, { min: 12, max: 25 });
  assert.deepEqual(carottes.ecart, { referentiel: { min: 12, max: 25 }, base_metier: { min: 12, max: 15 } });
  assert.deepEqual([carottes.provenance.id, carottes.provenance.verification], ['legumes.parage.carotte', 'confirmee']);
  assert.equal(texteProvenance(carottes), 'standard de base, référentiel culinaire : 12–25 % de perte du poids brut (legumes.parage.carotte, confirmé à la source)');
  const pates = rendementDeBase('pates_seches', 'cuisson');
  assert.deepEqual([pates.origine, pates.valeur, pates.unite, pates.coefficient], ['referentiel', 2.65, 'x', 2.65]);
});

test('rendement : sans confirmation à la source, la base métier prime ; l\'écart est gardé s\'il existe', () => {
  const semoule = rendementDeBase('semoule', 'cuisson');
  assert.deepEqual([semoule.origine, semoule.coefficient, semoule.provenance.table], ['base_metier', 2.25, '11.2']);
  assert.deepEqual(semoule.ecart, { referentiel: { min: 2, max: 2.55 }, base_metier: { min: 2, max: 2.5 } });
  const panais = rendementDeBase('panais', 'parage');
  assert.deepEqual([panais.origine, panais.ecart], ['base_metier', null], 'même fourchette : pas d\'écart');
  const navets = rendementDeBase('navets', 'parage');
  assert.deepEqual([navets.origine, navets.valeur, navets.unite, navets.coefficient, navets.ecart], ['base_metier', 17.5, '%', 0.825, null]);
  assert.equal(texteProvenance(navets), 'standard de base, base métier : Navets 15–20 %');
  const poireaux = rendementDeBase('poireaux', 'parage');
  assert.deepEqual([poireaux.origine, poireaux.ecart], ['referentiel', null], 'confirmé et identique : référentiel, sans écart');
});

test('rien n\'est inventé : pas de standard sans donnée, coefficient toujours tiré de la source', () => {
  assert.equal(rendementDeBase('orge', 'cuisson'), null, 'ni ligne de base ni rattachement');
  assert.equal(rendementDeBase('riz', 'parage'), null);
  assert.equal(rendementDeBase('riz', 'portionnement'), null);
  assert.equal(standardDeBase('famille_inconnue', 'conservation'), null);
  assert.equal(standardDeBase('riz', 'usage_invente'), null);
  assert.equal(standardDeBase(null, 'temperature'), null, 'une règle générale se lit en la nommant');
  for (const f of FAMILLES) {
    for (const t of ['parage', 'cuisson']) {
      const r = rendementDeBase(f.cle, t);
      if (!r) continue;
      assert.ok(f.etapes.some((x) => x.etape === t), `${f.cle} : rendement sans étape déclarée dans le lexique`);
      const { min, max } = r.fourchette;
      assert.ok(r.valeur >= min && r.valeur <= max, `${f.cle} ${t} : valeur dans la fourchette`);
      assert.ok(r.coefficient > 0);
    }
  }
});

test('hygiène : borne prudente ; conservation au minimum, seuil seul pris tel quel', () => {
  const pates = standardDeBase('pates_seches', 'conservation', { etatPoids: 'cuit' });
  assert.deepEqual([pates.valeur, pates.fourchette, pates.sens, pates.unite], [1, { min: 1, max: 4 }, 'prudent_min', 'jours'], '1 à 4 jours : 1');
  assert.equal(standardDeBase('riz', 'conservation', { etatPoids: 'cuit' }).valeur, 1);
  // Carottes cuites : pas de valeur propre, la règle « pâtes, riz et légumes cuits » (au plus 2 jours) vaut pour le groupe.
  const carottes = standardDeBase('carottes', 'conservation', { etatPoids: 'cuit' });
  assert.deepEqual([carottes.valeur, carottes.fourchette, carottes.provenance.id], [2, { min: null, max: 2 }, 'hygiene.duree.feculents-legumes-cuits']);
  assert.equal(standardDeBase('carottes', 'conservation', { etatPoids: 'cru_net' }), null, 'la règle des cuits ne vaut pas pour le cru');
  const leg = standardDeBase('legumineuses', 'conservation', { etatPoids: 'cuit' });
  assert.deepEqual([leg.valeur, leg.fourchette, leg.provenance.id], [3, { min: 3, max: 4 }, 'feculents.leg.conservation.cuites'], 'légumineuses cuites : 3 à 4 jours, minimum');
  // Durées en heures, semaines, mois : unités normalisées, jamais converties.
  const froid = standardDeBase(null, 'refroidissement', { regle: 'refroidissement' });
  assert.deepEqual([froid.valeur, froid.unite, froid.fourchette, froid.sens, froid.provenance.id], [2, 'h', { min: null, max: 2 }, 'prudent_max', 'hygiene.temperature.refroidissement']);
  assert.equal(standardDeBase(null, 'limite_duree', { regle: 'maintien_chaud' }).valeur, 3);
  assert.equal(standardDeBase(null, 'limite_duree', { regle: 'hors_froid' }).unite, 'h');
  const sec = standardDeBase('pates_seches', 'duree_stockage', { etatPoids: 'sec' });
  assert.deepEqual([sec.valeur, sec.unite], [12, 'mois']);
  assert.deepEqual(['semaines', 2], [standardDeBase('pommes_de_terre', 'duree_stockage').unite, standardDeBase('pommes_de_terre', 'duree_stockage').valeur]);
  assert.equal(standardDeBase('carottes', 'duree_stockage', { etatPoids: 'cru_net' }).unite, 'h');
  assert.ok(reperesConservation('pates_seches').every((x) => x.unite === 'jours'), 'la conservation reste en jours');
  assert.equal(standardDeBase('categorie:sauce', 'conservation', { etatPoids: 'cuit' }).valeur, 2, 'sauces cuites : 2 à 4 jours, prudence 2');
  // Températures : seuils seuls, et sens prudent sur une fourchette.
  assert.equal(standardDeBase(null, 'temperature', { regle: 'cuisson_coeur' }).valeur, 70);
  assert.equal(standardDeBase(null, 'temperature', { regle: 'stockage_froid' }).valeur, 5);
  assert.equal(standardDeBase(null, 'temperature', { regle: 'surgeles' }).valeur, -18);
  assert.equal(standardDeBase('riz', 'temperature', { regle: 'maintien_chaud' }).valeur, 65, 'règle universelle nommée, pour une famille');
  assert.equal(standardDeBase('riz', 'temperature', { regle: 'viandes_cuites' }), null, 'règle hors portée de la famille');
  // Plage à respecter des deux côtés (sens « plage ») : valeur par défaut au milieu.
  const pdt = standardDeBase('pommes_de_terre', 'temperature');
  assert.deepEqual([pdt.valeur, pdt.sens], [8, 'plage'], 'stockage des pommes de terre : 6 à 10 °C, milieu');
});

test('quantités et temps : milieu de la fourchette ; buffet par couvert', () => {
  assert.deepEqual(reperesCuisson('polenta').map((s) => [s.usage, s.valeur, s.unite, s.origine]),
    [['rendement_cuisson', 3.5, 'x', 'base_metier'], ['cuisson_temps', 50, 'min', 'referentiel']]);
  assert.equal(standardDeBase('brocoli', 'cuisson_temps').valeur, 3);
  const buffet = standardDeBase('riz', 'buffet_couvert');
  assert.deepEqual([buffet.valeur, buffet.unite, buffet.etatPoids, buffet.cible], [55, 'g/couvert', 'sec', { groupe: 'cereales' }]);
  assert.equal(standardDeBase('categorie:proteine', 'buffet_couvert').valeur, 225);
  assert.equal(standardDeBase('carottes', 'buffet_couvert'), null);
});

test('reperesConservation : de la plus précise à la plus générale', () => {
  assert.deepEqual(reperesConservation('pates_seches').map((s) => [s.provenance.id, s.valeur]),
    [['feculents.pates.conservation.cuites', 1], ['hygiene.duree.feculents-legumes-cuits', 2]]);
  assert.deepEqual(reperesConservation('legumineuses').map((s) => [s.provenance.id, s.valeur]),
    [['feculents.leg.conservation.cuites', 3]], 'seule règle propre : hors du groupe des féculents et légumes de la règle générale');
  assert.deepEqual(reperesConservation(null), []);
});

test('reperesAide : par famille quand c\'est évident, sinon par thème ; jamais une entrée rattachée', () => {
  const riz = reperesAide('riz');
  assert.ok(riz.length >= 10 && riz.every((x) => x.aide.famille === 'riz' && x.rattachement === null));
  assert.ok(riz.some((x) => x.id === 'feculents.risotto.duree'));
  const hygiene = reperesAide('hygiene');
  assert.ok(hygiene.length > 0 && hygiene.every((x) => x.theme === 'hygiene' && x.rattachement === null));
  assert.ok(!hygiene.some((x) => x.id === 'hygiene.temperature.cuisson-coeur'), 'rattachée : pas une aide');
  assert.deepEqual(reperesAide('famille_inconnue'), []);
});

test('règles générales : un lexique sans chiffre ; les allergènes sont rattachés sans valeur', () => {
  for (const r of REGLES_GENERALES) {
    assert.deepEqual(Object.keys(r).filter((k) => !['cle', 'libelle', 'groupes', 'categories'].includes(k)), [], r.cle);
  }
  assert.deepEqual(rattachementsDe('allergene').map((x) => [x.valeur, x.rattachement.unite]), [[null, null], [null, null], [null, null]]);
});
