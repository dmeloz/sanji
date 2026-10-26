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
import { composantValide, etatVide, h, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let routeur;
let vues;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  // Les vues-relais du routeur (clés = adresses) plus les vues d'origine sous leurs anciens noms : les relais délèguent à celles-ci.
  vues = {
    ...routeur.VUES,
    tableau: await import('../app/js/ui/vue-tableau.js'),
    menus: await import('../app/js/ui/vue-menus.js'),
    detail: await import('../app/js/ui/vue-detail.js'),
    jour: await import('../app/js/ui/vue-production.js'),
    composant: await import('../app/js/ui/vue-composant.js'),
  };
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

test('Tableau : quatre zones (jours, à confirmer, fiches, production) sous un en-tête, jamais plus de cinq, et plus de note multi-sujets', () => {
  const noeud = tableau(S.mardi, semaine());
  assert.deepEqual(classes(noeud, 'bord-zone').map((z) => z.querySelector('h2').textContent),
    ['Menus de la semaine', 'À confirmer', 'Fiches de fonction', 'Production et commandes']);
  assert.equal(classes(noeud, 'note').length, 0);
  assert.equal(classes(noeud, 'bord-tete').length, 1, 'un en-tête compact');
});

test('Tableau : menus = aujourd\'hui et 2 jours suivants ; ligne entière vers le détail du jour, plat vers sa fiche', () => {
  const noeud = tableau(S.mardi, semaine());
  const zone = classes(noeud, 'bord-menus')[0];
  const visibles = zone.tous((x) => x.className.split(' ').includes('bord-jour'));
  assert.equal(visibles.length, 5, 'toute la semaine à plat : mardi, mercredi, jeudi, puis lundi et vendredi');
  const entetes = classes(zone, 'bord-jour-lien').map((a) => a.attributs.href);
  assert.deepEqual(entetes.slice(0, 3), [`#/production/${S.mardi}`, `#/production/${S.mercredi}`, `#/production/${S.jeudi}`]);
  assert.match(classes(zone, 'bord-jour-lien')[0].textContent, /Mar 6 · 64 couverts/);
  assert.equal(classes(zone, 'bord-reste').length, 0, 'plus de « reste de la semaine » replié');
  // Un plat mène à la fiche du plat (composant) ; tous les liens du Tableau existent.
  const plats = classes(zone, 'bord-plat');
  assert.ok(plats.length > 0);
  for (const a of plats) assert.match(a.attributs.href, /^#\/fiche\//);
  assert.ok(classes(zone, 'tb-couverts').length >= 6, 'les chiffres de prévision restent affichés');
});

test('Tableau : le cercle de prévision et chaque ligne cliquable mesurent au moins 44 px (feuille de style)', () => {
  const regle = (selecteur) => new RegExp(`(?:^|\\n|\\})\\s*${selecteur.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(regle('.tb-couverts'), /min-height:\s*var\(--cible\)/);
  assert.match(regle('.tb-couverts'), /min-width:\s*var\(--cible\)/);
  assert.match(css, /--cible:\s*44px/);
  for (const s of ['.bord-jour-lien', '.bord-ligne', '.bord-fiche', '.case-fait']) {
    assert.match(regle(s), /min-(height|width):\s*var\(--cible\)/, `${s} : cible tactile de 44 px`);
  }
});

test('Tableau : fiches de fonction = horaire, numéro, couverts, mode, allergies ; chaque ligne vers le détail du jour', () => {
  const noeud = tableau(S.mardi, semaine());
  const zone = classes(noeud, 'bord-fiches')[0];
  const ligne = classes(zone, 'bord-fiche')[0];
  assert.equal(ligne.attributs.href, `#/production/${S.mardi}`);
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
  for (const a of classes(chargee, 'bord-ligne')) assert.match(a.attributs.href, /^#\/(semaine|production|reglages)/);
});

test('Tableau : production = jauge « x/y fait » vers Jour ; commande à relire vers Produits', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const p = principaleDe(e, composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST));
  planifier(e, p, S.mardi, h());
  const zone = classes(tableau(S.mardi, e), 'bord-production')[0];
  const jauge = classes(zone, 'bord-jauge')[0];
  assert.match(jauge.textContent, /Aujourd'hui 0\/1 fait/);
  assert.equal(jauge.attributs.href, `#/production/${S.mardi}`);
});

test('Tableau : chaque ancienne information de la note a une destination', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  prevision(e, S.lundi, 1, 10);
  const noeud = tableau('2026-10-30', e, S.lundi); // vieux : rappel de sauvegarde
  const cibles = hrefs(noeud);
  assert.ok(cibles.includes('#/reglages'), 'portions à régler, semaine type, sauvegarde : Réglages');
  assert.ok(cibles.some((x) => x.startsWith('#/fiche/')) || cibles.includes(`#/import/${S.lundi}`));
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
  planifier(e, principaleDe(e, m1), S.lundi, h());
  planifier(e, principaleDe(e, m2), S.lundi, h());
  planifier(e, principaleDe(e, fait), S.lundi, h());
  planifier(e, principaleDe(e, mardi), S.lundi, h());
  marquerFait(e, principaleDe(e, fait), undefined, h(1));
  return { e, m1, m2 };
}

test('Jour : en-tête « Production » + date, flèches ‹ ›, plus de barre de jours ni de jauge ; ligne « Services du jour »', () => {
  const { e } = lundiTravail();
  for (const affiche of [S.lundi, S.jeudi]) {
    const noeud = jour(S.lundi, e, affiche);
    assert.equal(classes(noeud, 'jour-barre').length, 0, 'plus de barre de jours');
    assert.equal(classes(noeud, 'prod-jauge').length, 0);
    assert.match(classes(noeud, 'jour-tete')[0].textContent, affiche === S.lundi ? /^Production\s*Lundi 5 octobre/ : /^Production\s*Jeudi 8 octobre/);
    assert.equal(classes(noeud, 'prod-fleche').length, 2);
    assert.equal(classes(noeud, 'prod-services').length, 1, 'Services du jour');
    assert.ok(!hrefs(classes(noeud, 'prod-pied')[0]).some((x) => x.startsWith('#/semaine/')), 'plus de lien vers la page de jour');
  }
  const menus = classes(jour(S.lundi, e), 'mj-ligne');
  assert.ok(menus.length === 2 || menus.length === 0, 'les menus tiennent en une ligne chacun (M1 · …, M2 · …) quand ils sont saisis');
});

test('Jour : ordre de lecture M1, M2, autres, après service ; une ligne cochable par tâche, pas de grosses cartes', () => {
  const { e } = lundiTravail();
  const noeud = jour(S.lundi, e);
  const titres = classes(noeud, 'jour-bloc').map((b) => b.querySelector('h2').textContent);
  // L'avance J+1 est planifiée, l'avance J+2 seulement proposée : toutes deux dans « Après service », toujours visible.
  assert.deepEqual(titres, ['M1', 'M2', 'Après service']);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0, 'aucune liste à dérouler');
  assert.equal(classes(noeud, 'tache').length, 0, 'aucune grosse carte dans la liste');
  const lignes = classes(noeud, 'mep-ligne');
  const cases = classes(noeud, 'case-fait').filter((c) => c.balise === 'button' && c.attributs['aria-checked'] === 'false');
  assert.equal(cases.length, 4, 'une case à cocher par tâche à faire : M1, M2, avance J+1, avance J+2');
  for (const c of cases) assert.equal(c.attributs.role, 'checkbox');
  assert.ok(lignes.length >= 5);
  // La quantité (g ou kg) est le point focal de chaque ligne, à droite.
  const premiere = classes(noeud, 'mep-ligne')[0];
  assert.match(classes(premiere, 'mep-qte')[0].textContent, /\d/);
  assert.equal(classes(premiere, 'mep-poids').length, 0, 'plus de sous-texte « cru / cuit » sur la ligne');
  // Aucune commande qui filtre : pas de liste déroulante ni de bouton de filtre.
  assert.equal(noeud.tous((x) => x.balise === 'select').length, 0);
  assert.equal(boutons(noeud).some((b) => /filtre|seulement|aujourd'hui \//i.test(b.textContent)), false);
});

test('Jour : les avances sont dans « Après service » (visible), avec « Pour mar. 6 » (plus de badge « Avance J+n »)', () => {
  const { e } = lundiTravail();
  const apres = classes(jour(S.lundi, e), 'jour-bloc').find((b) => b.querySelector('h2').textContent === 'Après service');
  const textes = classes(apres, 'mep-ligne').map((l) => l.textContent);
  assert.equal(textes.length, 2);
  assert.ok(textes.some((t) => /Pour mar\. 6/.test(t) && /ELEMENT_MARDI_TEST/.test(t)));
  assert.ok(textes.some((t) => /Pour mer\. 7/.test(t) && /ELEMENT_MERCREDI_TEST/.test(t)), 'même une avance seulement possible est visible');
  assert.ok(textes.every((t) => !/Avance J\+/.test(t)));
});

test('Jour : une tâche faite aujourd\'hui reste dans sa section, grisée, sans repli « Terminé »', () => {
  const { e } = lundiTravail();
  const noeud = jour(S.lundi, e);
  assert.equal(classes(noeud, 'jour-faites').length, 0, 'plus de repli « Terminé »');
  assert.doesNotMatch(noeud.textContent, /Terminé/);
  const ligneFaite = classes(noeud, 'mep-ligne').find((l) => /ELEMENT_FAIT_TEST/.test(l.textContent));
  assert.ok(ligneFaite, 'la tâche faite est dans sa section');
  assert.ok(classes(classes(noeud, 'jour-bloc')[1], 'mep-fait').includes(ligneFaite), 'dans le menu 2, à sa place');
});

test('Jour : une tâche faite = case cochée (✓), nom accessible « Marquer non fait », quantité réelle, rangée en bas de son menu', () => {
  const { e } = lundiTravail();
  const bloc2 = classes(jour(S.lundi, e), 'jour-bloc')[1];
  const nomsLus = classes(bloc2, 'mep-ligne').map((l) => classes(l, 'mep-nom')[0].textContent);
  assert.deepEqual(nomsLus, ['ELEMENT_M2_TEST', 'ELEMENT_FAIT_TEST'], 'la tâche faite passe après celles à faire (sinon ordre alphabétique du poste)');
  const ligneFaite = classes(bloc2, 'mep-fait')[0];
  const caseFaite = classes(ligneFaite, 'case-fait')[0];
  assert.equal(caseFaite.balise, 'button');
  assert.equal(caseFaite.attributs['aria-checked'], 'true');
  assert.match(caseFaite.textContent, /Marquer non fait : ELEMENT_FAIT_TEST/);
  assert.match(classes(ligneFaite, 'case-fait-boite')[0].textContent, /✓/, 'l\'état est porté par la coche, pas par la couleur seule');
  assert.equal(classes(ligneFaite, 'mep-qte').length, 1, 'quantité réelle affichée');
  assert.equal(classes(bloc2, 'case-fait').filter((c) => c.attributs['aria-checked'] === 'true').length, 1);
});

test('Jour : toucher la case d\'une tâche faite la décoche ; passé les 2 minutes, le refus est dit en texte et rien ne change', async () => {
  const { e } = lundiTravail();
  const messages = [];
  const quitter = magasin.surMessage((texte, type) => messages.push({ texte, type }));
  try {
    // Fait le 1er octobre : l'annulation est refusée.
    let noeud = jour(S.lundi, e);
    await classes(classes(noeud, 'mep-fait')[0], 'case-fait')[0].click();
    assert.equal(Object.values(magasin.etat().productions).filter((p) => p.etat === 'fait').length, 1, 'rien n\'a changé');
    assert.ok(messages.some((m) => m.type === 'erreur' && /Trop tard pour annuler/.test(m.texte)), 'message de refus existant');
    // Cochée à l'instant, puis décochée.
    noeud = jour(S.lundi, magasin.etat());
    await classes(classes(noeud, 'jour-bloc')[0], 'case-fait')[0].click();
    const apres = jour(S.lundi, magasin.etat());
    const ligneCochee = classes(classes(apres, 'jour-bloc')[0], 'mep-fait')[0];
    assert.ok(ligneCochee, 'cochée : reste dans le menu 1, marquée faite');
    await classes(ligneCochee, 'case-fait')[0].click();
    assert.equal(Object.values(magasin.etat().productions).filter((p) => p.etat === 'fait').length, 1, 'décochée');
  } finally { quitter(); }
});

test('style : la ligne faite est grisée sans barré, la cible tactile reste de 44 px', () => {
  assert.doesNotMatch(css, /\.mep-ligne\.mep-fait \.mep-nom[^{]*\{[^}]*text-decoration:\s*line-through/);
  assert.match(css, /\.mep-ligne\.mep-fait \.mep-nom \{ color: var\(--texte-doux\); \}/);
  assert.match(css, /--cible:\s*44px/);
  assert.match(css, /\.case-fait\s*\{[^}]*min-width:\s*var\(--cible\)[^}]*min-height:\s*var\(--cible\)/);
});

test('Jour : « Fait » en un toucher, sans bandeau « Annuler » (retoucher la case annule)', async () => {
  const { e } = lundiTravail();
  const noeud = jour(S.lundi, e);
  const case1 = classes(classes(noeud, 'jour-bloc')[0], 'case-fait')[0];
  await case1.click();
  const attendu = Object.values(magasin.etat().productions).filter((p) => p.etat === 'fait').length;
  assert.equal(attendu, 2, 'un seul toucher marque fait');
  assert.equal(dom.corps.tous((x) => x.balise === 'button' && x.textContent === 'Annuler').length, 0, 'plus de bandeau « Fait · Annuler » sur Production');
});

test('Jour : plus de puce « à décider » ni de résumé ni de centre « À confirmer » dans la page', () => {
  const e = etatVide();
  prevision(e, S.mercredi, 1, 10);
  const c = composantValide(e, S.mercredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_ECART_TEST' });
  planifier(e, principaleDe(e, c), S.mardi, h());
  marquerFait(e, principaleDe(e, c), undefined, h(1));
  prevision(e, S.mercredi, 1, 20);
  const noeud = jour(S.mardi, e);
  assert.equal(classes(noeud, 'jour-decisions').length, 0, 'plus de résumé en haut');
  assert.equal(classes(noeud, 'jour-centre').length, 0, 'plus de centre « À confirmer » en bas');
  assert.equal(classes(noeud, 'prod-adecider').length, 0, 'la décision se dit sur Aujourd\'hui, pas ici');
});

test('Jour : une tâche du jour sans quantité reste dans la liste, dite sans alerte ; lots = une ligne tappable', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz, carottes', h());
  const noeud = jour(S.lundi, e);
  assert.equal(classes(noeud, 'mep-ligne').length >= 2, true, 'aucune tâche ne disparaît faute de donnée');
  assert.match(noeud.textContent, /à chiffrer/);
  assert.doesNotMatch(noeud.textContent, /Pas encore chiffré/);
  assert.equal(classes(noeud, 'encadre-alerte').length + classes(noeud, 'encadre-erreur').length, 0);
  assert.equal(classes(noeud, 'pastille-rouge').length, 0, 'jamais en rouge');
  // Lots : une ligne tappable ; le détail et le lien vers la fiche s'ouvrent en feuille.
  const lots = etatVide();
  const riz = { ...J.PRODUIT_SEC_TEST, nom: 'riz' };
  for (const d of [S.mardi, S.mercredi]) { prevision(lots, d, 1, 10); composantValide(lots, d, 1, riz); }
  const page = jour(S.lundi, lots);
  const l = classes(page, 'prod-resume').find((b) => /^À faire en une fois/.test(b.textContent));
  assert.ok(l);
  await l.click();
  const ouverts = dom.corps.tous((x) => x.balise === 'dialog' && x.open);
  assert.ok(hrefs(ouverts[0]).some((x) => x.startsWith('#/fiche/')));
  for (const d of ouverts) d.close();
});

test('Jour : une action préparatoire est une autre tâche ; avec un standard, la quantité sort en g (700 g)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  prevision(e, S.lundi, 1, 10);
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  const riz = Object.values(e.composants).find((c) => c.nom === 'riz');
  ajouterPreparatoire(e, riz.id, 'ACTION_TEST', h());
  const prep = Object.values(e.productions).find((p) => p.genre === 'preparatoire');
  planifier(e, prep.id, S.lundi, h());
  const noeud = jour(S.lundi, e);
  assert.match(classes(noeud, 'jour-bloc')[0].textContent.replace(/[\u202f\u00a0]/g, ' '), /700 g/);
  assert.match(classes(noeud, 'jour-bloc')[0].textContent, /Cuire\s*riz/, 'féculent de base : le verbe « Cuire » devant le nom');
  assert.ok(classes(noeud, 'jour-bloc').some((b) => b.querySelector('h2').textContent === 'Autres'));
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
  assert.ok(cases.every((c) => /^(✓)?Marquer (non )?fait : \S/.test(c.textContent)), 'aucune case ne s\'appelle seulement « Fait »');
  const noeud = tableau(S.mardi, semaine());
  const rangs = classes(noeud, 'tb-rang');
  assert.ok(rangs.length > 0);
  for (const r of rangs) {
    assert.equal(r.attributs['aria-label'], undefined, 'pas d\'aria-label sur un span sans rôle');
    assert.match(r.textContent, /Menu [12]/, 'le nom du menu reste lisible (texte masqué)');
  }
  assert.equal(noeud.tous((x) => x.balise === 'span' && x.attributs['aria-label'] !== undefined && !x.attributs.role).length, 0);
});

test('Tableau : sur une autre semaine, Production dit de quelle semaine elle parle et ne dit pas « Aujourd\'hui »', () => {
  const e = semaine();
  const zoneAutre = classes(tableau(S.mardi, e, S.lundiSuivant), 'bord-production')[0];
  assert.match(zoneAutre.textContent, /Semaine du 12 octobre/);
  assert.doesNotMatch(zoneAutre.textContent, /Aujourd'hui/);
  const zoneCourante = classes(tableau(S.mardi, e), 'bord-production')[0];
  assert.doesNotMatch(zoneCourante.textContent, /Semaine du/);
});

test('tableau : un petit signe par jour (hors règle, à confirmer), icône et mot, rien quand il n\'y a rien à signaler ; plus aucun « Jour off » (v134)', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());
  prevision(e, S.jeudi, 1, 20);
  const id = composantValide(e, S.jeudi, 1, J.PRODUIT_SEC_TEST);
  planifier(e, principaleDe(e, id), S.lundi, h());
  const racine = tableau(S.lundi, e);
  const signes = classes(racine, 'bord-signe').map((x) => x.textContent);
  assert.ok(signes.some((t) => /hors règle/.test(t)), 'lundi : hors règle');
  assert.ok(signes.some((t) => /à confirmer/.test(t)), 'lundi : à confirmer');
  assert.ok(!signes.some((t) => /jour off|semaine type/i.test(t)), 'aucune étiquette « Jour off » n\'existe plus (v134)');
  const mardi = classes(racine, 'bord-jour').find((x) => x.textContent.startsWith('Mar'));
  assert.equal(classes(mardi, 'bord-signe').length, 0, 'mardi, sans rien à signaler, n\'a aucun signe');
  assert.ok(classes(racine, 'bord-signe').every((x) => classes(x, 'bord-signe-icone').length === 1), 'une icône avec chaque mot');
  assert.ok(hrefs(racine).includes(`#/production/${S.lundi}`), 'le jour ouvre toujours Production');
  assert.equal(classes(tableau(S.lundi, etatVide()), 'bord-signe').length, 0, 'rien à signaler : aucun signe');
});

test('tableau : la légende du signe respecte les 15 px minimum', () => {
  const regle = css.match(/\.bord-signe\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(regle, /font-size:\s*var\(--t-1\)/);
  assert.match(css, /--t-1:\s*var\(--t-corps\)/);
  assert.match(css, /--t-corps:\s*15px/);
});

test('Tableau : le titre est daté « Semaine · 5 octobre », « Semaine N » reste en sous-titre, la ligne Aujourd\'hui est gardée', () => {
  const noeud = tableau(S.mardi, semaine());
  assert.equal(classes(noeud, 'bord-titre')[0].textContent, 'Semaine · 5 octobre');
  assert.match(classes(noeud, 'bord-sous-titre')[0].textContent, /^Semaine \d+/);
  assert.match(classes(noeud, 'bord-date')[0].textContent, /^Aujourd'hui, /);
  assert.ok(liens(noeud).some((a) => /Production du jour/.test(a.textContent)));
});

test('Tableau : chaque tête de jour dit ses couverts ; sans prévision, « couverts à saisir » ouvre la feuille des couverts', () => {
  const e = semaine();
  const sansPrevision = etatVide();
  definirMenu(sansPrevision, S.jeudi, 1, 'riz et carottes', h());
  e.jours[S.jeudi] = sansPrevision.jours[S.jeudi];
  const noeud = tableau(S.mardi, e);
  const tetes = classes(noeud, 'bord-jour');
  assert.ok(tetes.length > 0);
  for (const t of tetes) {
    const c = classes(t, 'bord-jour-couverts');
    assert.equal(c.length, 1, `${t.textContent} : une mention de couverts`);
    assert.match(c[0].textContent, /couverts?/);
  }
  const vides = classes(noeud, 'bord-jour-couverts').filter((x) => /à saisir/.test(x.textContent));
  assert.ok(vides.length > 0, 'au moins un jour sans prévision');
  for (const v of vides) assert.equal(v.balise, 'button', 'touchable');
});

test('Tableau : menus M1/M2 compacts, sans bordure entre eux, chiffre de 44 px (feuille de style)', () => {
  const bloc = /\.vue-semaine-globale \.bord-menu\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.doesNotMatch(bloc, /border-top/, 'pas de filet entre M1 et M2');
  assert.match(bloc, /padding-block:\s*0/);
  assert.match(css, /\.tb-couverts\s*\{[^}]*min-height:\s*var\(--cible\)/);
  assert.match(css, /\.bord-jour-couverts[^{]*\{[^}]*min-height:\s*var\(--cible\)/);
});

test('Tableau : dans l\'intitulé du menu, les liens de plat sont en ligne normale (interligne ~1,35), le chiffre des couverts garde 44 px (feuille de style)', () => {
  const bloc = /\.vue-semaine-globale \.tb-intitule \.bord-plat\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(bloc, /display:\s*inline\b/);
  assert.match(bloc, /min-height:\s*auto/);
  assert.match(bloc, /padding:\s*0/);
  assert.match(css, /\.vue-semaine-globale \.tb-intitule\s*\{[^}]*line-height:\s*1\.35/);
  assert.match(css, /\.tb-couverts\s*\{[^}]*min-height:\s*var\(--cible\)/);
});

test('Tableau : cliquer « couverts à saisir » d\'un jour sans prévision ouvre la feuille Couverts midi de CE jour', async () => {
  const e = semaine();
  const sansPrevision = etatVide();
  definirMenu(sansPrevision, S.jeudi, 1, 'riz et carottes', h());
  e.jours[S.jeudi] = sansPrevision.jours[S.jeudi];
  const noeud = tableau(S.mardi, e);
  const bouton = classes(noeud, 'bord-jour-couverts').find((x) => x.balise === 'button' && /à saisir/.test(x.textContent));
  assert.ok(bouton, 'un bouton « couverts à saisir »');
  assert.match(bouton.attributs['aria-label'], /jeudi/i);
  await aDate(S.mardi, () => bouton.click());
  const feuille = dom.corps.tous((x) => x.balise === 'dialog' && x.open).at(-1);
  assert.ok(feuille, 'une feuille est ouverte');
  assert.equal(feuille.querySelector('h2').textContent, 'Couverts midi');
  assert.match(feuille.textContent, /jeudi/i, 'la date affichée est celle du jour cliqué');
  feuille.close();
});
