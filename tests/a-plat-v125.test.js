// Lot 4 (v125) : « aucune liste à dérouler » (rien de repliable) et « un seul bouton, pas de doublon ».
// Faux DOM : ni mise en page ni tactile réels (à vérifier à l'écran à 390 px).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, Element, installerFauxDom, panneauxOuverts, figerHorloge } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { assurerJour } from '../app/js/domaine/etat.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom; let magasin; let vues;
let rendreHorloge;
before(async () => {
  rendreHorloge = figerHorloge(S.lundi);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vues = {
    tableau: await import('../app/js/ui/vue-tableau.js'),
    import: await import('../app/js/ui/vue-import.js'),
    reglages: await import('../app/js/ui/vue-reglages.js'),
    reperes: await import('../app/js/ui/reperes-metier.js'),
    historique: await import('../app/js/ui/vue-historique.js'),
    fiche: await import('../app/js/ui/vue-fiche.js'),
    planning: await import('../app/js/ui/assistant-planning.js'),
    articles: await import('../app/js/ui/vue-articles.js'),
  };
});
after(() => { dom.restaurer(); rendreHorloge(); });

const aucunRepli = (noeud, qui) => assert.equal(
  noeud.tous((x) => x.balise === 'details' || x.balise === 'summary' || x.className.split(' ').includes('repliable')).length, 0, `${qui} : aucun repli`);

function etatSemaineComplete() {
  const e = etatVide();
  ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].forEach((j, i) => {
    definirMenu(e, S[j], 1, `PLAT_M1_${i}`, h());
    definirMenu(e, S[j], 2, `PLAT_M2_${i}`, h());
  });
  return e;
}

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle { constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); } };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

// ---------------------------------------------------------------- A. à plat

test('Semaine : tout le tableau à plat, les cinq jours sont des lignes visibles', () => {
  const e = etatSemaineComplete();
  const n = aDate(S.mercredi, () => { magasin.remplacer(e); return vues.tableau.rendre(magasin.etat(), S.lundi); });
  aucunRepli(n, 'Semaine');
  assert.doesNotMatch(n.textContent, /Afficher le reste/);
  for (let i = 0; i < 5; i += 1) assert.match(n.textContent, new RegExp(`PLAT_M1_${i}`));
});

test('Import : jours, photo et texte collé à plat ; les champs restent dans la page', () => {
  const e = etatSemaineComplete();
  magasin.remplacer(e);
  const n = vues.import.rendre(magasin.etat(), S.lundi);
  aucunRepli(n, 'Import');
  const ids = n.tous((x) => x.attributs.id).map((x) => x.attributs.id);
  assert.ok(ids.includes('feuille-texte'), 'le texte collé est dans la page');
  assert.ok(ids.includes(`menu-${S.mardi}-2`), 'chaque jour a ses champs');
  assert.match(n.textContent, /Photo du menu/);
  assert.match(n.textContent, /Coller le texte de la feuille/);
  // La lecture de chaque jour reste visible avec son corps (sans toucher de repli).
  assert.match(n.textContent, /PLAT_M1_1/);
});

test('Import sur une semaine vide : tout est aussi à plat', () => {
  magasin.remplacer(etatVide());
  aucunRepli(vues.import.rendre(magasin.etat(), S.lundi), 'Import vide');
});

test('Réglages : standards maison, standards de base et repères métier sans repli', () => {
  magasin.remplacer(etatSemaineComplete());
  for (const rubrique of [null, 'standards', 'standards-base', 'reperes', 'apprentissage', 'donnees']) {
    aucunRepli(vues.reglages.rendre(magasin.etat(), rubrique), `Réglages ${rubrique}`);
  }
});

test('Repères métier : page par thème, bloc de fiche et buffet sans repli', () => {
  for (const theme of [undefined, 'legumes', 'hygiene']) {
    const c = new Element('div');
    vues.reperes.pageReperesMetier(c, { theme });
    aucunRepli(c, `page ${theme}`);
  }
  const bloc = vues.reperes.blocReperes('riz');
  if (bloc) aucunRepli(bloc, 'bloc repères');
  const buffet = vues.reperes.blocBuffet(8);
  if (buffet) aucunRepli(buffet, 'buffet');
});

test('Historique : une ligne par semaine qui ouvre une feuille avec les jours', () => {
  const e = etatVide();
  const j = assurerJour(e, '2026-09-28');
  j.menus[1].intitule = 'PLAT_C';
  j.menus[2].intitule = 'PLAT_D';
  const n = aDate(S.mercredi, () => { magasin.remplacer(e); return vues.historique.rendre(magasin.etat()); });
  aucunRepli(n, 'Historique');
  const ligne = boutons(n).find((b) => /Semaine du lundi 28 septembre/.test(b.textContent));
  assert.ok(ligne, 'la semaine est une ligne tappable');
  assert.doesNotMatch(n.textContent, /PLAT_C/, 'les jours ne sont plus déroulés dans la page');
  ligne.click();
  const [feuille] = panneauxOuverts(dom.corps);
  assert.match(feuille.textContent, /PLAT_C/);
  feuille.close();
});

test('Fiche : « Plus de réglages » est une ligne qui ouvre une feuille avec les gestes avancés', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  magasin.remplacer(e);
  const c = Object.values(magasin.etat().composants)[0];
  const n = vues.fiche.rendre(magasin.etat(), c.id);
  aucunRepli(n, 'Fiche');
  const ligne = boutons(n).find((b) => /Plus de réglages/.test(b.textContent));
  assert.ok(ligne);
  ligne.click();
  const [feuille] = panneauxOuverts(dom.corps);
  assert.ok(boutons(feuille).some((b) => b.textContent === 'Modifier'));
  feuille.close();
});

test('Assistant de planning : « Pourquoi cette proposition » à plat', () => {
  const noeuds = vues.planning.contenuProposition({ items: [], aDecider: [], sources: [], hypotheses: [], incertitudes: [], controles: [], origine: 'regles' }, { mode: 'regles', avertissements: [] });
  for (const x of noeuds) if (x?.tous) aucunRepli(x, 'planning');
  assert.ok(noeuds.some((x) => /Pourquoi cette proposition/.test(x?.textContent ?? '')));
});

test('code : aucune des vues concernées ne construit de repli', () => {
  for (const f of ['vue-tableau', 'vue-import', 'vue-menus', 'vue-reglages', 'reperes-metier', 'vue-fiche', 'vue-composant', 'assistant-planning', 'vue-historique', 'vue-jour']) {
    const src = readFileSync(new URL(`../app/js/ui/${f}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /repliable\(|'details'|'summary'|aria-expanded/, `${f}.js`);
  }
});

// ---------------------------------------------------------------- B. doublons

test('Réglages, racine : un seul lien par destination, la version n\'y est pas', () => {
  magasin.remplacer(etatVide());
  const r = vues.reglages.rendre(magasin.etat(), null);
  const hrefs = r.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
  assert.deepEqual(hrefs.filter((l, i) => hrefs.indexOf(l) !== i), [], 'aucun lien en double');
  assert.doesNotMatch(r.textContent, /Version/);
});

test('Réglages > Données : la version de l\'application est affichée une fois', () => {
  magasin.remplacer(etatVide());
  const t = vues.reglages.rendre(magasin.etat(), 'donnees').textContent;
  assert.equal(t.match(/Version de l'application/g).length, 1);
});

test('Réglages > Standards maison : pas de second lien vers les standards de base (déjà à la racine)', () => {
  magasin.remplacer(etatVide());
  const liens = vues.reglages.rendre(magasin.etat(), 'standards').tous((x) => x.balise === 'a').map((a) => a.attributs.href);
  assert.ok(!liens.includes('#/reglages/standards-base'));
});

test('Réglages > Apprentissage : ni second lien vers les fiches, ni seconde porte vers les notes (la pastille Dev suffit)', () => {
  magasin.remplacer(etatVide());
  const n = vues.reglages.rendre(magasin.etat(), 'apprentissage');
  assert.ok(!n.tous((x) => x.balise === 'a').some((a) => a.attributs.href === '#/fiches'));
  assert.ok(!boutons(n).some((b) => /Ouvrir notes et diagnostic/.test(b.textContent)));
});

// ---------------------------------------------------------------- C. partage

test('Articles : « Partager la liste » ne passe que le texte (iOS affiche titre ET texte)', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h());
  magasin.remplacer(e);
  const n = aDate(S.lundi, () => vues.articles.rendre(magasin.etat(), S.lundi));
  const partage = boutons(n).find((b) => b.textContent === 'Partager la liste');
  if (!partage) return; // pas d'article dans ce jeu : couvert par vue-articles.test.js
  const envoyes = [];
  const avant = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { share: async (d) => { envoyes.push(d); } }, configurable: true });
  try { await partage.click(); } finally { Object.defineProperty(globalThis, 'navigator', { value: avant, configurable: true }); }
  assert.equal(envoyes.length, 1);
  assert.equal('title' in envoyes[0], false);
  assert.equal(typeof envoyes[0].text, 'string');
});
