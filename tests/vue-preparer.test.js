// « Préparer la semaine » sous faux DOM (décision du 2026-10-09) : couverts à toucher, « OK », « Tout valider avec les standards »,
// fiche de production toujours accessible. Ne voit ni la mise en page ni IndexedDB : à vérifier à l'écran à 390 px.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { grammageEffectif } from '../app/js/domaine/savoir.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { composantValide, etatVide, h, prevision } from './aide.js';

let dom; let magasin; let vue; let routeur;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-preparer.js');
  routeur = await import('../app/js/ui/routeur.js');
});
after(() => dom.restaurer());

const SANS_PORTION = { valeur: null, unite: 'g', statut: 'INCONNU', source: '' };
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);
const parNom = (n, nom) => n.tous((x) => x.attributs['aria-label'] === nom)[0];
const liens = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const bilan = (n) => n.tous((x) => x.classeNom?.includes?.('prep-bilan') || x.className.split(' ').includes('prep-bilan'))[0];
const dateDuJour = (jour, fonction) => {
  const original = Date;
  const [a, m, j] = jour.split('-').map(Number);
  globalThis.Date = class extends original { constructor(...x) { super(...(x.length ? x : [a, m - 1, j, 9, 0, 0])); } };
  try { return fonction(); } finally { globalThis.Date = original; }
};

/** Lundi : riz au menu 2 (standard de base) ; mardi : un plat sans portion ni standard (INCONNU). */
function monde() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.mardi, 1, 'INTITULE_TEST', h());
  composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { grammage: SANS_PORTION });
  magasin.remplacer(e);
}
const page = () => dateDuJour(S.lundi, () => vue.rendre(magasin.etat(), S.lundi));

test('routage : #/preparer/<lundi> est connu (jour quelconque ramené au lundi), l\'ancienne route de la semaine ne change pas', () => {
  assert.equal(routeur.VUES.preparer, vue);
  assert.equal(vue.titre(), 'Préparer la semaine');
  assert.deepEqual(routeur.analyserHash(`#/preparer/${S.mercredi ?? '2026-10-07'}`, S.lundi), { vue: 'preparer', param: S.lundi });
  assert.deepEqual(routeur.analyserHash('#/preparer', S.mardi), { vue: 'preparer', param: S.lundi });
  assert.equal(routeur.ONGLET_DE_VUE.preparer, 'semaine');
  assert.deepEqual(routeur.analyserHash(`#/semaine/${S.lundi}/tableau`, S.lundi), { vue: 'semaine', param: S.lundi, sous: 'tableau' });
});

test('page : titre, couverts de chaque jour avec menu, à confirmer, fiche de production ; rien d\'autre', () => {
  monde();
  const n = page();
  const t = n.textContent;
  assert.match(t, /Préparer la semaine/);
  assert.match(t, /Couverts du midi/);
  assert.match(t, /lundi 5 octobre/i);
  assert.match(t, /mardi 6 octobre/i);
  assert.doesNotMatch(t, /dimanche/i);
  assert.match(t, /À confirmer/);
  assert.ok(parTexte(n, 'Tout valider avec les standards'));
  assert.ok(liens(n).includes(`#/semaine/${S.lundi}/tableau`), 'lien « Semaine » de retour');
  assert.doesNotMatch(t, /undefined|NaN|null/);
});

test('couverts : un toucher écrit le total par l\'action du domaine, la valeur déjà saisie reste visible et modifiable', () => {
  monde();
  dateDuJour(S.lundi, () => parNom(page(), `60 couverts le mardi 6 octobre`).click());
  assert.equal(magasin.etat().jours[S.mardi].couverts.total, 60);
  assert.equal(magasin.etat().jours[S.mardi].previsions[1].portions + magasin.etat().jours[S.mardi].previsions[2].portions, 60);
  const n = page();
  assert.equal(parNom(n, '60 couverts le mardi 6 octobre').attributs['aria-pressed'], 'true');
  dateDuJour(S.lundi, () => parNom(n, '80 couverts le mardi 6 octobre').click());
  assert.equal(magasin.etat().jours[S.mardi].couverts.total, 80, 'retoucher une autre valeur la remplace');
});

test('« OK » sur une ligne à standard valide CETTE valeur seulement', () => {
  monde();
  dateDuJour(S.lundi, () => parNom(page(), 'Valider riz · garniture avec le standard').click());
  assert.equal(magasin.etat().standards.riz.garniture.valeur, 60);
  assert.equal(grammageEffectif(magasin.etat(), Object.values(magasin.etat().composants).find((c) => c.nom === 'PRODUIT_SEC_TEST')), null, 'l\'INCONNU est intact');
  assert.doesNotMatch(page().textContent, /riz · garniture/);
});

test('ligne INCONNU : une quantité tapée valide, une saisie vide ou nulle n\'écrit rien', () => {
  monde();
  const id = Object.values(magasin.etat().composants).find((c) => c.nom === 'PRODUIT_SEC_TEST').id;
  const n = page();
  const champ = n.tous((x) => x.balise === 'input' && /PRODUIT_SEC_TEST/.test(x.attributs['aria-label'] ?? ''))[0];
  const ok = parNom(n, 'Valider PRODUIT_SEC_TEST avec la valeur tapée');
  champ.value = '';
  dateDuJour(S.lundi, () => ok.click());
  assert.equal(magasin.etat().composants[id].grammage.valeur, null);
  champ.value = '0';
  dateDuJour(S.lundi, () => ok.click());
  assert.equal(magasin.etat().composants[id].grammage.valeur, null, 'zéro refusé par le domaine');
  champ.value = '150';
  dateDuJour(S.lundi, () => ok.click());
  assert.equal(magasin.etat().composants[id].grammage.valeur, 150);
});

test('« Tout valider avec les standards » : une action, le compte est dit, les INCONNU restent à saisir', () => {
  monde();
  const journal = magasin.etat().journal.length;
  dateDuJour(S.lundi, () => parTexte(page(), 'Tout valider avec les standards').click());
  const e = magasin.etat();
  assert.equal(e.standards.riz.garniture.valeur, 60);
  assert.equal(grammageEffectif(e, Object.values(e.composants).find((c) => c.nom === 'PRODUIT_SEC_TEST')), null);
  assert.ok(e.journal.length > journal);
  const n = page();
  assert.match(bilan(n).textContent, /1 valeur validée avec les standards ; il reste 1 à saisir\./);
  assert.equal(bilan(n).attributs.role, 'status');
  assert.equal(parTexte(n, 'Tout valider avec les standards'), undefined, 'plus rien à valider en lot');
  assert.match(n.textContent, /Sans standard : à saisir/);
});

test('« Voir la fiche de production » pointe sur le premier jour à menu, jamais avant aujourd\'hui, et n\'est pas bloqué par les INCONNU', () => {
  monde();
  const lien = (n) => n.tous((x) => x.balise === 'a' && x.textContent === 'Voir la fiche de production')[0];
  assert.equal(lien(page()).attributs.href, `#/production/${S.lundi}`);
  assert.match(page().textContent, /1 valeur reste à confirmer/);
  const mardi = dateDuJour(S.mardi, () => vue.rendre(magasin.etat(), S.lundi));
  assert.equal(lien(mardi).attributs.href, `#/production/${S.mardi}`);
  const passee = dateDuJour(S.lundiSuivant, () => vue.rendre(magasin.etat(), S.lundi));
  assert.equal(lien(passee).attributs.href, `#/production/${S.lundi}`, 'semaine passée : son premier jour');
  assert.equal(lien(page()).attributs.disabled, undefined);
});

test('semaine sans menu : phrase claire, fiche de production quand même accessible', () => {
  magasin.remplacer(etatVide());
  const n = page();
  assert.match(n.textContent, /Aucun menu enregistré/);
  assert.match(n.textContent, /Rien à confirmer/);
  assert.ok(liens(n).includes(`#/production/${S.lundi}`));
});

test('« OK » sans standard dit ce qui est retenu : pour toutes les semaines, que la famille soit connue (standard maison) ou non (fiche retenue du nom)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'polenta', h());
  prevision(e, S.lundi, 1, 20, h());
  definirMenu(e, S.mardi, 1, 'INTITULE_TEST', h());
  composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { grammage: SANS_PORTION });
  magasin.remplacer(e);
  for (const [nom, valeur] of [['polenta', '150'], ['PRODUIT_SEC_TEST', '90']]) {
    const n = page();
    if (nom === 'polenta') n.tous((x) => x.balise === 'button' && x.textContent === 'Poids sec')[0].click(); // gain de cuisson sans repère : à choisir
    n.tous((x) => x.balise === 'input' && (x.attributs['aria-label'] ?? '').startsWith(nom))[0].value = valeur;
    dateDuJour(S.lundi, () => parNom(n, `Valider ${nom} avec la valeur tapée`).click());
  }
  const t = page().textContent;
  assert.match(t, /polenta : retenu pour toutes les semaines\./);
  assert.match(t, /PRODUIT_SEC_TEST : retenu pour toutes les semaines\./);
  assert.equal(magasin.etat().standards.polenta.plat_principal.valeur, 150);
});

test('ligne « à saisir » d\'un riz : choix Poids sec / cru / cuit, « sec » présélectionné, l\'état choisi est enregistré', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Risotto aux bolets', h());
  prevision(e, S.lundi, 1, 20);
  magasin.remplacer(e);
  const n = page();
  const poids = n.tous((x) => x.balise === 'button' && /^(✓ )?Poids (sec|cru|cuit)$/.test(x.textContent));
  assert.equal(poids.length, 3);
  assert.deepEqual(poids.map((b) => b.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.match(n.textContent, /choisissez le poids/);
  poids.find((b) => b.textContent.endsWith('cuit')).click();
  const champ = n.tous((x) => x.balise === 'input' && /valeur en g/.test(x.attributs['aria-label'] ?? ''))[0];
  champ.value = '200';
  n.tous((x) => /Valider Risotto avec la valeur tapée/.test(x.attributs['aria-label'] ?? ''))[0].click();
  assert.equal(magasin.etat().standards.riz.plat_principal.etat, 'cuit');
});

test('ligne « à saisir » d\'une polenta : aucun bouton enfoncé, OK refusé sans choix (message), accepté après choix', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'polenta', h());
  prevision(e, S.lundi, 1, 20, h());
  magasin.remplacer(e);
  const n = page();
  const poids = n.tous((x) => x.balise === 'button' && /^(✓ )?Poids (sec|cru|cuit)$/.test(x.textContent));
  assert.deepEqual(poids.map((b) => b.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  n.tous((x) => x.balise === 'input' && /^polenta/.test(x.attributs['aria-label'] ?? ''))[0].value = '60';
  dateDuJour(S.lundi, () => parNom(n, 'Valider polenta avec la valeur tapée').click());
  assert.equal(magasin.etat().standards?.polenta, undefined);
  poids.find((b) => b.textContent.endsWith('cru')).click();
  dateDuJour(S.lundi, () => parNom(n, 'Valider polenta avec la valeur tapée').click());
  assert.equal(magasin.etat().standards.polenta.plat_principal.etat, 'cru_net');
});
