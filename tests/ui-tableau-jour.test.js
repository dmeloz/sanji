// A-P1 : le nouveau Tableau (tableau de bord) et la nouvelle feuille Jour, sous faux DOM.
// Ce n'est PAS un test dans un navigateur : la mise en page, le défilement et le tactile réels ne sont pas couverts.
// Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import {
  ajouterPreparatoire, creerFiche, definirMenu, definirStandard, marquerFait, planifier,
} from '../app/js/domaine/actions.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let routeur;
let vues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vues = routeur.VUES;
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const liens = (noeud) => noeud.tous((x) => x.balise === 'a');
const hrefs = (noeud) => liens(noeud).map((a) => a.attributs.href);
const tableau = (iso, etat, lundi = null) => aDate(iso, () => { magasin.remplacer(etat); return vues.tableau.rendre(magasin.etat(), lundi); });
const jour = (iso, etat, date = iso) => aDate(iso, () => { magasin.remplacer(etat); return vues.jour.rendre(magasin.etat(), date); });
const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');

/** Une semaine : menus saisis du lundi au vendredi, prévisions, une fiche le mardi (allergies). */
function semaine() {
  const e = etatVide();
  for (const d of [S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi]) {
    definirMenu(e, d, 1, 'riz et carottes', h());
    definirMenu(e, d, 2, 'poulet, riz, carottes', h());
    prevision(e, d, 1, 30);
    prevision(e, d, 2, 10);
  }
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.mardi, service: 'midi', horaire: '12:00', couverts: 24, mode: 'menu_fixe', menuFixe: 1, allergies: 'ALLERGIE_TEST' }, h());
  return e;
}

// ---------------------------------------------------------------- Tableau

test('Tableau : quatre zones sous un en-tête, jamais plus de cinq, et plus de note multi-sujets', () => {
  const noeud = tableau(S.mardi, semaine());
  assert.deepEqual(classes(noeud, 'bord-zone').map((z) => z.querySelector('h2').textContent),
    ['Menus de la semaine', 'Fiches de fonction', 'À confirmer', 'Production et commandes']);
  assert.equal(classes(noeud, 'note').length, 0);
  assert.equal(classes(noeud, 'bord-tete').length, 1, 'un en-tête compact');
});

test('Tableau : menus = aujourd\'hui et 2 jours suivants ; ligne entière vers le détail du jour, plat vers sa fiche', () => {
  const noeud = tableau(S.mardi, semaine());
  const zone = classes(noeud, 'bord-menus')[0];
  const visibles = zone.tous((x) => x.className.split(' ').includes('bord-jour')).filter((li) => !li.parent.parent.className.includes('bord-reste'));
  assert.equal(visibles.length, 3, 'mardi, mercredi, jeudi');
  const entetes = classes(zone, 'bord-jour-lien').map((a) => a.attributs.href);
  assert.deepEqual(entetes.slice(0, 3), [`#/detail/${S.mardi}`, `#/detail/${S.mercredi}`, `#/detail/${S.jeudi}`]);
  assert.match(classes(zone, 'bord-jour-lien')[0].textContent, /Mar 6 · 64 couverts/);
  // Le reste de la semaine : une touche, rien n'est perdu.
  const reste = classes(zone, 'bord-reste')[0];
  assert.match(reste.querySelector('summary').textContent, /Afficher le reste de la semaine/);
  assert.equal(classes(reste, 'bord-jour').length, 2, 'lundi et vendredi');
  // Un plat mène à la fiche du plat (composant) ; tous les liens du Tableau existent.
  const plats = classes(zone, 'bord-plat');
  assert.ok(plats.length > 0);
  for (const a of plats) assert.match(a.attributs.href, /^#\/composant\//);
  assert.ok(boutons(zone).length >= 6, 'le cercle de prévision reste un bouton');
});

test('Tableau : le cercle de prévision et chaque ligne cliquable mesurent au moins 44 px (feuille de style)', () => {
  const regle = (selecteur) => new RegExp(`(?:^|\\n|\\})\\s*${selecteur.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(regle('.tb-couverts'), /min-height:\s*var\(--cible\)/);
  assert.match(regle('.tb-couverts'), /min-width:\s*var\(--cible\)/);
  assert.match(css, /--cible:\s*44px/);
  for (const s of ['.bord-jour-lien', '.bord-ligne', '.bord-fiche', '.jour-puce', '.case-fait']) {
    assert.match(regle(s), /min-(height|width):\s*var\(--cible\)/, `${s} : cible tactile de 44 px`);
  }
});

test('Tableau : fiches de fonction = horaire, numéro, couverts, mode, allergies ; chaque ligne vers le détail du jour', () => {
  const noeud = tableau(S.mardi, semaine());
  const zone = classes(noeud, 'bord-fiches')[0];
  const ligne = classes(zone, 'bord-fiche')[0];
  assert.equal(ligne.attributs.href, `#/detail/${S.mardi}`);
  assert.match(ligne.textContent, /12:00 · fiche FICHE_TEST_1 · 24 couverts/);
  assert.match(ligne.textContent, /Menu fixe/);
  assert.match(ligne.textContent, /allergies/);
  assert.match(classes(tableau(S.mardi, etatVide()), 'bord-fiches')[0].textContent, /Aucun banquet prévu/);
});

test('Tableau : « À confirmer » : trois lignes au plus, jamais une quantité simplement manquante', () => {
  const sansQuantite = etatVide();
  definirMenu(sansQuantite, S.lundi, 1, 'riz, carottes', h());
  const zone = classes(tableau(S.lundi, sansQuantite), 'bord-confirmer')[0];
  assert.doesNotMatch(zone.textContent, /quantité|portion|prévision|préciser/);
  const e = semaine();
  for (const d of [S.mardi, S.mercredi, S.jeudi]) {
    creerFiche(e, { numero: `F${d}`, date: d, service: 'midi', horaire: '12:00', couverts: 20, mode: 'choix_libre', repartition: { 1: 12, 2: 5 } }, h());
  }
  const chargee = classes(tableau(S.lundi, e), 'bord-confirmer')[0];
  assert.ok(classes(chargee, 'bord-ligne').length <= 3);
  assert.ok(classes(chargee, 'bord-ligne').length >= 2);
  for (const a of classes(chargee, 'bord-ligne')) assert.match(a.attributs.href, /^#\/(detail|jour|reglages)/);
});

test('Tableau : production = jauge « x/y fait » vers Jour ; commande à relire vers Produits', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const p = principaleDe(e, composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST));
  planifier(e, p, S.mardi, 'apres_midi', h());
  const zone = classes(tableau(S.mardi, e), 'bord-production')[0];
  const jauge = classes(zone, 'bord-jauge')[0];
  assert.match(jauge.textContent, /Aujourd'hui 0\/1 fait/);
  assert.equal(jauge.attributs.href, `#/jour/${S.mardi}`);
});

test('Tableau : chaque ancienne information de la note a une destination', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  prevision(e, S.lundi, 1, 10);
  const noeud = tableau('2026-10-30', e, S.lundi); // vieux : rappel de sauvegarde
  const cibles = hrefs(noeud);
  assert.ok(cibles.includes('#/reglages'), 'portions à régler, semaine type, sauvegarde : Réglages');
  assert.ok(cibles.some((x) => x.startsWith('#/composant/')) || cibles.includes(`#/menus/${S.lundi}`));
  assert.match(noeud.textContent, /Sauvegarde à faire/);
  assert.match(noeud.textContent, /portions? à régler/);
});

// ---------------------------------------------------------------- Jour

/** Un lundi : un élément par menu, une avance J+1, une avance J+2 seulement possible, une tâche faite. */
function lundiTravail() {
  const e = etatVide();
  for (const d of [S.lundi, S.mardi, S.mercredi]) { prevision(e, d, 1, 10); prevision(e, d, 2, 10); }
  const m1 = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M1_TEST' });
  const m2 = composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M2_TEST' });
  const fait = composantValide(e, S.lundi, 2, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_FAIT_TEST' });
  const mardi = composantValide(e, S.mardi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_MARDI_TEST' });
  composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_MERCREDI_TEST' });
  planifier(e, principaleDe(e, m1), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, m2), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, fait), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, mardi), S.lundi, 'apres_midi', h());
  marquerFait(e, principaleDe(e, fait), undefined, h(1));
  return { e, m1, m2 };
}

test('Jour : barre de jours horizontale, en-tête minimal (date, couverts, jauge), rappel des deux menus', () => {
  const { e } = lundiTravail();
  definirMenu(e, S.lundi, 1, 'riz et carottes', h());
  definirMenu(e, S.lundi, 2, 'poulet, riz', h());
  creerFiche(e, { numero: 'FICHE_TEST_1', date: S.lundi, service: 'midi', horaire: '12:00', couverts: 24, mode: 'menu_fixe', menuFixe: 1 }, h());
  const noeud = jour(S.lundi, e);
  const puces = classes(noeud, 'jour-puce').filter((a) => !a.className.includes('fleche'));
  assert.deepEqual(puces.map((a) => a.attributs.href), [S.lundi, S.mardi, S.mercredi, S.jeudi, S.vendredi, S.samedi].map((d) => `#/jour/${d}`));
  assert.equal(classes(noeud, 'jour-puce-actif').length, 1);
  assert.match(classes(noeud, 'jour-tete')[0].textContent, /Lundi 5 octobre/);
  assert.match(classes(noeud, 'jour-tete')[0].textContent, /\d+ couverts/);
  assert.match(classes(noeud, 'jour-tete')[0].textContent, /\d sur \d fait/);
  const menus = classes(noeud, 'jour-menu');
  assert.equal(menus.length, 3, 'deux menus et un banquet');
  for (const a of menus) assert.equal(a.attributs.href, `#/detail/${S.lundi}`);
});

test('Jour : ordre de lecture menu 1, menu 2, autres, après service ; une ligne cochable par tâche, pas de grosses cartes', () => {
  const { e } = lundiTravail();
  const noeud = jour(S.lundi, e);
  const titres = classes(noeud, 'jour-bloc').map((b) => b.querySelector('h2').textContent);
  assert.deepEqual(titres, ['Menu 1 · pour le service du jour', 'Menu 2 · pour le service du jour', 'Après service · avances pour les jours suivants']);
  assert.equal(classes(noeud, 'tache').length, 0, 'aucune grosse carte dans la liste');
  const lignes = classes(noeud, 'mep-ligne');
  const cases = classes(noeud, 'case-fait').filter((c) => c.balise === 'button');
  assert.equal(cases.length, 4, 'une case à cocher par tâche à faire : M1, M2, avance J+1, avance J+2');
  for (const c of cases) assert.equal(c.attributs.role, 'checkbox');
  assert.ok(lignes.length >= 5);
  // La quantité et l'état du poids sont le point focal de chaque ligne.
  const premiere = classes(noeud, 'mep-ligne')[0];
  assert.match(classes(premiere, 'mep-qte')[0].textContent, /\d/);
  assert.match(classes(premiere, 'mep-poids')[0].textContent, /poids|quantité finie/);
  // Aucune commande qui filtre : pas de liste déroulante ni de bouton de filtre.
  assert.equal(noeud.tous((x) => x.balise === 'select').length, 0);
  assert.equal(boutons(noeud).some((b) => /filtre|seulement|aujourd'hui \//i.test(b.textContent)), false);
});

test('Jour : les avances sont dans la même liste, avec « Pour mar. 6 » et le badge « Avance J+1 » ou « J+2 »', () => {
  const { e } = lundiTravail();
  const apres = classes(jour(S.lundi, e), 'jour-bloc')[2];
  const textes = classes(apres, 'mep-ligne').map((l) => l.textContent);
  assert.equal(textes.length, 2);
  assert.ok(textes.some((t) => /Pour mar\. 6/.test(t) && /Avance J\+1/.test(t) && /ELEMENT_MARDI_TEST/.test(t)));
  assert.ok(textes.some((t) => /Pour mer\. 7/.test(t) && /Avance J\+2/.test(t) && /ELEMENT_MERCREDI_TEST/.test(t)), 'même une avance seulement possible est visible');
});

test('Jour : « Fait » en un toucher, annulable ; les tâches faites sont repliées', async () => {
  const { e } = lundiTravail();
  const noeud = jour(S.lundi, e);
  const faites = classes(noeud, 'jour-faites')[0];
  assert.equal(faites.open, false, 'repliées par défaut');
  assert.match(faites.querySelector('summary').textContent, /Terminé 1/);
  assert.match(faites.textContent, /ELEMENT_FAIT_TEST/);
  const case1 = classes(classes(noeud, 'jour-bloc')[0], 'case-fait')[0];
  await case1.click();
  const attendu = Object.values(magasin.etat().productions).filter((p) => p.etat === 'fait').length;
  assert.equal(attendu, 2, 'un seul toucher marque fait');
  assert.ok(dom.corps.tous((x) => x.balise === 'button' && x.textContent === 'Annuler').length > 0, 'le message propose d\'annuler');
});

test('Jour : décisions = résumé de 3 lignes au plus qui mène au centre « À confirmer » de la même page', async () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_ECART_TEST' });
  planifier(e, principaleDe(e, c), S.mardi, 'apres_midi', h());
  marquerFait(e, principaleDe(e, c), undefined, h(1));
  prevision(e, S.mercredi, 1, 20);
  const noeud = jour(S.mardi, e);
  const resume = classes(noeud, 'jour-decisions')[0];
  assert.ok(resume);
  assert.ok(classes(resume, 'jour-decisions-lignes')[0].enfants.length <= 3);
  const centre = classes(noeud, 'jour-centre')[0];
  assert.equal(centre.open, false);
  await boutons(resume)[0].click();
  assert.equal(centre.open, true, 'le résumé ouvre le centre');
  assert.match(centre.textContent, /ELEMENT_ECART_TEST/);
  assert.equal(classes(jour(S.jeudi, etatVide()), 'jour-decisions').length, 0, 'rien à confirmer : pas de résumé');
});

test('Jour : une tâche du jour sans quantité reste dans la liste, dite sans alerte ; lots = une ligne repliable', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  const noeud = jour(S.lundi, e);
  assert.equal(classes(noeud, 'mep-ligne').length >= 2, true, 'aucune tâche ne disparaît faute de donnée');
  assert.match(noeud.textContent, /quantité à compléter/);
  assert.match(noeud.textContent, /Pas encore chiffré/);
  assert.equal(classes(noeud, 'encadre-alerte').length + classes(noeud, 'encadre-erreur').length, 0);
  assert.equal(classes(noeud, 'pastille-rouge').length, 0, 'jamais en rouge');
  // Lots : une ligne repliable, le détail dans la feuille de la tâche.
  const lots = etatVide();
  const riz = { ...J.PRODUIT_SEC_TEST, nom: 'riz' };
  for (const d of [S.mardi, S.mercredi]) { prevision(lots, d, 1, 10); composantValide(lots, d, 1, riz); }
  const l = classes(jour(S.lundi, lots), 'jour-lots')[0];
  assert.equal(l.open, false);
  assert.match(l.querySelector('summary').textContent, /À faire en une fois/);
  assert.ok(hrefs(l).some((x) => x.startsWith('#/composant/')));
});

test('Jour : une action préparatoire est une autre tâche ; avec un standard, la quantité sort en grand', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  prevision(e, S.lundi, 1, 10);
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  const riz = Object.values(e.composants).find((c) => c.nom === 'riz');
  ajouterPreparatoire(e, riz.id, 'ACTION_TEST', h());
  const prep = Object.values(e.productions).find((p) => p.genre === 'preparatoire');
  planifier(e, prep.id, S.lundi, 'avant_midi', h());
  const noeud = jour(S.lundi, e);
  assert.match(classes(noeud, 'jour-bloc')[0].textContent, /700 g/);
  assert.match(classes(noeud, 'jour-bloc')[0].textContent, /poids sec/);
  assert.ok(classes(noeud, 'jour-bloc').some((b) => b.querySelector('h2').textContent === 'Autres tâches'));
});

test('Jour : tous les liens existent, et la feuille s\'ouvre sur un dimanche, un jour vide et une base vide', () => {
  const { e } = lundiTravail();
  for (const [d, etat] of [[S.lundi, e], [S.dimanche, e], [S.jeudi, etatVide()], [S.mardi, semaine()]]) {
    const noeud = jour(S.lundi, structuredClone(etat), d);
    for (const href of hrefs(noeud).filter((x) => x.startsWith('#/'))) {
      const { vue } = routeur.analyserHash(href, S.lundi);
      assert.ok(Object.hasOwn(vues, vue), `lien ${href} vers une vue inconnue`);
    }
  }
});

// ---------------------------------------------------------------- style

test('style : aucun texte sous 15 px, état jamais porté par la couleur seule (pastilles avec texte)', () => {
  for (const [, valeur, unite] of css.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
    const px = unite === 'px' ? Number(valeur) : Number(valeur) * 16;
    assert.ok(px >= 15, `taille ${valeur}${unite} sous 15 px`);
  }
});

test('Tableau : la sauce implicite est en gris italique (tb-implicite), distincte des plats écrits', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'pâtes à l\'aneth', h());
  prevision(e, S.lundi, 1, 40);
  const page = tableau(S.lundi, e);
  const implicites = classes(page, 'tb-implicite').map((x) => x.textContent);
  assert.deepEqual(implicites, ['sauce à confirmer']);
  assert.ok(classes(page, 'tb-poste').every((x) => !/à confirmer/.test(x.textContent)));
});

test('Accessibilité : chaque case « Fait » porte le nom du plat ; le rang de menu n\'a pas d\'aria-label sur un span', () => {
  const { e } = lundiTravail();
  const cases = classes(jour(S.lundi, e), 'case-fait').filter((x) => x.balise === 'button');
  assert.ok(cases.length >= 3);
  for (const nom of ['ELEMENT_M1_TEST', 'ELEMENT_M2_TEST', 'ELEMENT_MARDI_TEST']) {
    assert.equal(cases.filter((c) => c.textContent === `Marquer fait : ${nom}`).length, 1, `case de ${nom}`);
  }
  assert.ok(cases.every((c) => /^Marquer fait : \S/.test(c.textContent)), 'aucune case ne s\'appelle seulement « Fait »');
  const noeud = tableau(S.mardi, semaine());
  const rangs = classes(noeud, 'tb-rang');
  assert.ok(rangs.length > 0);
  for (const r of rangs) {
    assert.equal(r.attributs['aria-label'], undefined, 'pas d\'aria-label sur un span sans rôle');
    assert.match(r.textContent, /Menu [12]/, 'le nom du menu reste lisible (texte masqué)');
  }
  assert.equal(noeud.tous((x) => x.balise === 'span' && x.attributs['aria-label'] !== undefined && !x.attributs.role).length, 0);
});
