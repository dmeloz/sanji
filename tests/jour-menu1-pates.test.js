// Pâtes et risotto du menu 1 : jour même, jamais d'avance par défaut (sauf règle explicite) ; ordre de lecture des menus
// par rôle. Jeux TEST_ONLY, mots génériques.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirRegle, definirStandard, planifier } from '../app/js/domaine/actions.js';
import { avancesPossibles, feuilleDuJour, lotsPossibles } from '../app/js/domaine/planification.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { composantValide, etatVide, h, principaleDe } from './aide.js';

let dom;
let magasin;
let vueJour;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueJour = await import('../app/js/ui/vue-production.js');
});
after(() => dom.restaurer());

/** Le mercredi : menu 1 de tagliatelles, menu 2 de poulet et carottes. Vu le lundi. */
function mercredi() {
  const e = etatVide();
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  definirMenu(e, S.mercredi, 2, 'poulet, carottes', h());
  definirPrevision(e, S.mercredi, 1, 10, h());
  definirPrevision(e, S.mercredi, 2, 10, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  return e;
}
const nomsAvances = (e) => avancesPossibles(e, S.lundi).map((a) => a.nom);

test('menu 1 : les pâtes du mercredi ne sont pas proposées en avance le lundi, la garniture du menu 2 l\'est', () => {
  const e = mercredi();
  const noms = nomsAvances(e);
  assert.equal(noms.includes('Tagliatelles'), false);
  assert.equal(noms.includes('carottes'), true);
  const { lecture, aAvancer } = feuilleDuJour(e, S.lundi);
  assert.equal(aAvancer.some((a) => a.nom === 'Tagliatelles'), false);
  assert.equal(lecture.apres.some((l) => l.nom === 'Tagliatelles'), false, 'absent de « Après service »');
  assert.equal(lecture.decisions.some((d) => d.nom === 'Tagliatelles'), false, 'pas non plus une décision à prendre ce jour-là');
});

test('menu 1 : le jour de leur service, les pâtes sont dans la liste du menu 1', () => {
  const { lecture } = feuilleDuJour(mercredi(), S.mercredi);
  assert.equal(lecture.service1.some((l) => l.nom === 'Tagliatelles'), true);
});

test('menu 1 : une règle explicite d\'avance sur le nom de la pâte la rend avançable', () => {
  const e = mercredi();
  definirRegle(e, { nom: 'Tagliatelles', avanceMaxJours: 2 }, h());
  assert.equal(nomsAvances(e).includes('Tagliatelles'), true);
  assert.equal(feuilleDuJour(e, S.lundi).lecture.apres.some((l) => l.nom === 'Tagliatelles'), true);
});

test('menu 1 : une règle sans avance (0) ne la rend pas avançable', () => {
  const e = mercredi();
  definirRegle(e, { nom: 'Tagliatelles', avanceMaxJours: 0 }, h());
  assert.equal(nomsAvances(e).includes('Tagliatelles'), false);
});

test('menu 1 : une production déjà planifiée à l\'avance à la main reste affichée, avec son évaluation', () => {
  const e = mercredi();
  const p = Object.values(e.productions).find((x) => x.dateService === S.mercredi && e.composants[x.composantId].nom === 'Tagliatelles');
  planifier(e, p.id, S.lundi, 'apres_midi', h());
  const avance = avancesPossibles(e, S.lundi).find((a) => a.nom === 'Tagliatelles');
  assert.ok(avance, 'jamais cachée');
  assert.equal(avance.evaluation.jours, 2);
  const apres = feuilleDuJour(e, S.lundi).lecture.apres.find((l) => l.nom === 'Tagliatelles');
  assert.ok(apres);
  assert.equal(apres.avanceJours, 2);
});

test('menu 1 : deux pâtes de jours voisins ne forment pas un lot sans règle explicite', () => {
  const e = mercredi();
  definirMenu(e, S.mardi, 1, 'Spaghetti', h());
  definirPrevision(e, S.mardi, 1, 10, h());
  assert.equal(lotsPossibles(e, S.lundi).some((l) => l.famille === 'pates_seches'), false);
  definirRegle(e, { nom: 'Tagliatelles', avanceMaxJours: 2 }, h());
  definirRegle(e, { nom: 'Spaghetti', avanceMaxJours: 2 }, h());
  const lot = lotsPossibles(e, S.lundi).find((l) => l.famille === 'pates_seches');
  assert.equal(lot?.productions.length, 2);
});

/** Un jeudi : « Trofie au saumon fumé et à l'aneth » et un menu 2, sans quantité. */
function jeudi() {
  const e = etatVide();
  definirMenu(e, S.jeudi, 1, 'Trofie au saumon fumé et à l\'aneth', h());
  definirMenu(e, S.jeudi, 2, 'poulet, carottes, riz', h());
  return e;
}

test('lecture : la pâte vient avant le saumon, l\'aneth et la sauce', () => {
  const { lecture } = feuilleDuJour(jeudi(), S.jeudi);
  const noms = lecture.service1.map((l) => l.nom);
  assert.equal(noms[0], 'Trofie');
  assert.ok(noms.indexOf('saumon fumé') > 0 && noms.indexOf('Trofie') < noms.indexOf('saumon fumé'));
  assert.ok(noms.indexOf('saumon fumé') < noms.indexOf('aneth'));
  assert.ok(noms.indexOf('aneth') < noms.indexOf('sauce à confirmer'));
});

test('lecture : menu 2, garnitures féculent puis légumes (la protéine est hors poste), quel que soit l\'ordre de l\'intitulé', () => {
  const noms = feuilleDuJour(jeudi(), S.jeudi).lecture.service2.map((l) => l.nom);
  assert.deepEqual(noms, ['riz', 'carottes']);
});

test('vue Jour : les pâtes du menu 1 ne sont pas dans « Après service » le lundi', () => {
  magasin.remplacer(mercredi());
  const texte = vueJour.rendre(magasin.etat(), S.lundi).textContent;
  assert.match(texte, /carottes/);
  assert.doesNotMatch(texte, /Tagliatelles/);
});

test('vue Jour : au-delà de 8 lignes, la suite d\'un bloc se replie sous « Voir les N autres », rien n\'est caché', () => {
  const e = etatVide();
  definirPrevision(e, S.lundi, 2, 10, h());
  for (let i = 1; i <= 11; i += 1) {
    const id = composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: `ELEMENT_${String(i).padStart(2, '0')}_TEST` });
    planifier(e, principaleDe(e, id), S.lundi, 'avant_midi', h());
  }
  magasin.remplacer(e);
  const noeud = vueJour.rendre(magasin.etat(), S.lundi);
  const repli = noeud.tous((x) => x.balise === 'details').find((d) => /Voir les 3 autres/.test(d.querySelector('summary').textContent));
  assert.ok(repli, '11 lignes : 8 visibles et « Voir les 3 autres »');
  assert.equal(repli.open, false);
  for (let i = 1; i <= 11; i += 1) assert.match(noeud.textContent, new RegExp(`ELEMENT_${String(i).padStart(2, '0')}_TEST`));
});
