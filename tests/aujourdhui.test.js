// Écran Aujourd'hui (refonte, étape 4) sous faux DOM : les deux menus du jour en grand et les couverts du midi, « À confirmer »,
// « À produire » (la liste de mise en place du jour, la même que Production, « Après service » compris), fiche de fonction, rappels ;
// les données de couverts avec certitude restent au domaine.
// Faux DOM : ni mise en page ni tactile réels (à vérifier à l'écran à 390 px, clair et sombre). Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { creerFiche, definirMenu, definirPrevision, definirRegle, definirStandard, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { decisionsDe } from '../app/js/domaine/decisions.js';
import { aujourdhuiDe } from '../app/js/domaine/tableau-blanc.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h, principaleDe } from './aide.js';

let dom;
let magasin;
let routeur;
let vue;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  routeur = await import('../app/js/ui/routeur.js');
  vue = await import('../app/js/ui/vue-aujourdhui.js');
});
after(() => dom.restaurer());

function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}
const page = (iso, etat) => aDate(iso, () => { magasin.remplacer(etat); return vue.rendre(magasin.etat()); });
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const hrefs = (noeud) => noeud.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const parTexte = (noeud, re) => boutons(noeud).find((b) => re.test(b.textContent));
const calme = (e) => e;
const composantDe = (e, nom) => Object.values(e.composants).find((c) => c.nom === nom);
const prodDe = (e, nom) => principaleDe(e, composantDe(e, nom).id);

/** Le mercredi : menu 1 de tagliatelles, menu 2 de riz et carottes ; les standards donnent des quantités. */
function mercredi() {
  const e = etatVide();
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  definirMenu(e, S.mercredi, 2, 'riz, carottes', h());
  definirPrevision(e, S.mercredi, 1, 10, h());
  definirPrevision(e, S.mercredi, 2, 12, h());
  definirStandard(e, 'pates_seches', 'plat_principal', { valeur: 100, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'riz', 'garniture', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'garniture', { valeur: 100, unite: 'g', etat: 'cru_net' }, h());
  return e;
}

test('l\'écran est branché au routeur sous le nom « Aujourd\'hui »', () => {
  assert.equal(routeur.VUES.aujourdhui, vue);
  assert.equal(vue.titre(), "Aujourd'hui");
});

test('base vide : la page s\'affiche, aucun état hors ligne tant que tout est normal, rien d\'inventé', () => {
  const p = page(S.mercredi, calme(etatVide()));
  const texte = p.textContent;
  assert.match(texte, /Aujourd'hui/);
  assert.match(texte, /Mercredi 7 octobre · \d\d:\d\d/, 'jour, date et heure');
  assert.doesNotMatch(texte, /hors ligne/);
  assert.match(texte, /Rien à produire ce jour/);
  assert.match(texte, /non saisi/, 'un menu non saisi est dit');
  assert.ok(hrefs(classes(p, 'auj-menus')[0]).includes(`#/import/${S.lundi}`), 'aucun menu : lien vers l\'import');
  assert.equal(classes(p, 'tdb-confirmer').length, 0, 'aucune décision : pas de carte « À confirmer »');
  assert.doesNotMatch(texte, /Synchronis|Soir|minuteur|en stock|frigo|chambre froide|Mon planning/i); // « Couverts midi » est le mot validé le 2026-10-07
});

test('en-tête : « hors ligne » ne s\'affiche que s\'il y a un problème (texte de horsligne.js), jamais « prêt »', async () => {
  const { problemeHorsLigne } = await import('../app/js/ui/horsligne.js');
  // Vérification en cours : rien. Le texte du problème est produit par horsligne.js, pas par l'écran (voir lot-aujourdhui-semaine.test.js pour le cas du problème).
  assert.equal(problemeHorsLigne(), null);
  const p = page(S.mercredi, etatVide());
  assert.equal(classes(p, 'au-hors-ligne').length, 0);
  assert.doesNotMatch(p.textContent, /hors ligne prêt/);
});

test('couverts : le domaine garde la certitude écrite de chaque menu et des fiches ; le bouton des couverts dit le total', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_FIXE', date: S.mercredi, service: 'midi', horaire: '12:00', couverts: 8, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  const d = aujourdhuiDe(e, S.mercredi);
  const [m1, m2] = d.menus;
  assert.equal(m1.couverts, 22, '10 prévus + 8 fiche menu fixe + 4 répartis');
  assert.deepEqual(m1.certitudes, [{ certitude: 'estimee', portions: 10 }, { certitude: 'provisoire', portions: 4 }, { certitude: 'confirmee', portions: 8 }]);
  assert.equal(m2.couverts, 14);
  assert.deepEqual(m2.certitudes, [{ certitude: 'estimee', portions: 12 }, { certitude: 'provisoire', portions: 2 }]);
  assert.equal(d.fiches.total, 14);
  assert.deepEqual(d.fiches.certitudes, [{ certitude: 'provisoire', couverts: 6 }, { certitude: 'confirmee', couverts: 8 }]);
  // Les fiches de fonction ne comptent plus dans « Couverts midi » : les prévisions seules (10 + 12).
  assert.deepEqual(d.couvertsMidi, { total: 22, m1: 10, m2: 12, manuel: false, certitude: 'estimee', aSaisirVentes: false, ventes: null });
  const p = page(S.mercredi, e);
  const caseCouverts = classes(p, 'auj-couverts')[0];
  assert.equal(classes(caseCouverts, 'auj-couverts-nombre')[0].textContent, '22', 'le total, en police des quantités');
  assert.match(caseCouverts.attributs['aria-label'], /Couverts midi aujourd'hui : 22/);
  // La certitude de la fiche reste écrite sur la carte « Fiche de fonction ».
  assert.match(classes(p, 'au-fiche')[0].textContent, /répartition|menu fixe/);
});

test('couverts : sans prévision, aucun « 0 » inventé et aucune alerte', () => {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.equal(d.menus[0].couverts, null);
  assert.equal(d.menus[0].previsionASaisir, true);
  assert.deepEqual(d.couvertsMidi, { total: null, m1: null, m2: null, manuel: false, certitude: null, aSaisirVentes: false, ventes: null });
  const p = page(S.mercredi, e);
  const caseCouverts = classes(p, 'auj-couverts')[0];
  assert.equal(classes(caseCouverts, 'auj-couverts-nombre')[0].textContent, '—');
  assert.match(caseCouverts.textContent, /à saisir/);
  // La sauce implicite du menu 1 est une vraie décision de la feuille ; la prévision absente n'en est jamais une.
  const carte = classes(p, 'tdb-confirmer')[0];
  assert.match(carte.textContent, /À confirmer · 2/, 'une sauce à confirmer et une valeur à valider, comme la feuille');
  assert.doesNotMatch(carte.textContent, /prévision|quantité|portion/);
  assert.equal(d.decisions.total, 0);
});

test('dimanche : fermé, aucune tâche, aucun couvert', () => {
  const p = page(S.dimanche, mercredi());
  assert.match(p.textContent, /Fermé aujourd'hui/);
  assert.equal(classes(p, 'au-maintenant-actions').length, 0);
});

const production = (p) => classes(p, 'auj-production')[0];

test('À produire : la liste du jour est sur Aujourd\'hui, avec son compte, les quantités et la case « fait » en un toucher', () => {
  const e = mercredi();
  for (const nom of ['Tagliatelles', 'riz']) planifier(e, prodDe(e, nom), S.mercredi, h());
  const d = aujourdhuiDe(e, S.mercredi);
  const p = page(S.mercredi, e);
  const sec = production(p);
  assert.ok(sec, 'section « À produire »');
  assert.match(sec.textContent, /À produire/);
  assert.match(classes(sec, 'auj-compte')[0].textContent, new RegExp(`^0 sur ${d.avancementJour.total} fait$`), 'même compte que Production');
  assert.doesNotMatch(sec.textContent, /service de midi|service du soir|créneau/);
  const lignes = classes(sec, 'mep-ligne');
  assert.ok(lignes.length >= 2, 'une ligne par tâche du jour');
  assert.ok(classes(sec, 'mep-qte').some((q) => /\d/.test(q.textContent)), 'quantités en police des quantités');
  assert.ok(hrefs(sec).includes(`#/fiche/${composantDe(e, 'Tagliatelles').id}`), 'le nom ouvre la fiche');
  // Plus de carte « Prochaine » ni de cases de chiffres : la liste suffit.
  assert.equal(classes(p, 'prochaine').length, 0);
  assert.equal(classes(p, 'tdb-case').length, 0);
  // Rien de planifié : comme sur Production, les lignes de travail sont comptées.
  const brut = aujourdhuiDe(mercredi(), S.mercredi);
  assert.equal(brut.avancement.total, 0);
  assert.ok(brut.avancementJour.total >= 2);

  const cases = classes(sec, 'case-fait');
  assert.ok(cases.length >= 2);
  cases[0].click();
  const faites = Object.values(magasin.etat().productions).filter((x) => x.etat === 'fait');
  assert.equal(faites.length, 1, 'même action que Production : marquée faite');
});

test('À produire : quantité inconnue = « à chiffrer » qui ouvre la feuille de chiffrage, jamais « quantité à compléter »', () => {
  const e = mercredi();
  for (const nom of ['Tagliatelles', 'riz']) planifier(e, prodDe(e, nom), S.mercredi, h());
  e.jours[S.mercredi].previsions = { 1: { portions: null }, 2: { portions: null } };
  const sec = production(page(S.mercredi, e));
  assert.doesNotMatch(sec.textContent, /à compléter/);
  const bouton = classes(sec, 'prod-asaisir')[0];
  assert.ok(bouton, 'bouton « à chiffrer »');
  assert.match(bouton.textContent, /à chiffrer/);
});

test('À produire : une quantité en « portions » n\'est jamais écrite', () => {
  const e = mercredi();
  const id = prodDe(e, 'Tagliatelles');
  planifier(e, id, S.mercredi, h());
  e.productions[id].unite = 'portion';
  const d = aujourdhuiDe(e, S.mercredi, '10:00');
  assert.equal(d.maintenant.unite, 'portion');
  assert.ok(Number.isFinite(d.maintenant.cible), 'cible finie');
  const sec = production(page(S.mercredi, e));
  assert.doesNotMatch(sec.textContent, /\d portions?\b/);
});

test('À produire : une fois tout fait, le compte le dit et les lignes restent, cochées', () => {
  const e = mercredi();
  const principales = Object.values(e.productions).filter((x) => x.genre === 'principale' && x.dateService === S.mercredi);
  for (const x of principales) { planifier(e, x.id, S.mercredi, h()); marquerFait(e, x.id, 100, h()); }
  const sec = production(page(S.mercredi, e));
  assert.equal(classes(sec, 'auj-compte')[0].textContent, `${principales.length} sur ${principales.length} faits`);
  assert.equal(classes(sec, 'case-fait-ok').length, principales.length, 'toutes les cases sont cochées');
});

test('décisions : « À confirmer · N » compte comme la feuille « À décider », « Tout voir » l\'ouvre ; chaque ligne a son geste ou « Décider »', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.ok(d.decisions.total >= 1);
  const p = page(S.mercredi, e);
  const carte = classes(p, 'tdb-confirmer')[0];
  assert.ok(carte, 'carte « À confirmer » présente');
  assert.match(carte.textContent, new RegExp(`À confirmer · ${aDate(S.mercredi, () => decisionsDe(e, S.mercredi).total)}`));
  assert.equal(classes(carte, 'au-ligne').length, 1, 'une seule ligne : la liste à produire reste en vue');
  // Une ligne = un titre et ses boutons (geste d'un toucher ou « Décider ») : rien n'est un simple lien.
  for (const ligne of classes(carte, 'au-ligne')) assert.ok(boutons(ligne).length > 0);
  globalThis.location.hash = '#/aujourdhui';
  aDate(S.mercredi, () => parTexte(carte, /Tout voir/).click());
  assert.ok(dom.corps.tous((x) => x.balise === 'dialog' && x.open).length >= 1, 'la feuille « À décider » s\'ouvre');
  dom.corps.tous((x) => x.balise === 'dialog').forEach((dl) => dl.remove());
});

test('« Après service » : les avances possibles sont dans la liste du jour, avec « Pour mar. 6 » et la quantité', () => {
  const e = etatVide();
  for (const j2 of [S.mardi, S.mercredi, S.jeudi]) { definirMenu(e, j2, 2, 'riz', h()); definirPrevision(e, j2, 2, 10, h()); }
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  calme(e);
  const d = aujourdhuiDe(e, S.lundi);
  assert.ok(d.aAvancer.total >= 1);
  assert.ok(d.aAvancer.lignes.length <= 3);
  const sec = production(page(S.lundi, e));
  assert.match(sec.textContent, /Après service/);
  assert.match(sec.textContent, /Pour mar\. 6/);
  assert.ok(classes(sec, 'mep-qte').length >= 1, 'quantité en police des quantités');
  // Plus de section « À avancer » à part : une seule liste.
  assert.equal(page(S.lundi, e).tous((x) => x.balise === 'section' && x.attributs['aria-label'] === 'À avancer').length, 0);
});

test('menus du jour : les deux intitulés en grand, « non saisi » dit en toutes lettres ; les trois jours proches restent au domaine', () => {
  const e = mercredi();
  definirMenu(e, S.jeudi, 1, 'Poulet rôti', h());
  const d = aujourdhuiDe(calme(e), S.mercredi);
  assert.deepEqual(d.menusSurTrois.map((j) => j.date), [S.mercredi, S.jeudi, S.vendredi]);
  assert.equal(d.menusSurTrois[0].estAujourdhui, true);
  assert.equal(d.menusSurTrois[2].aImporter, true);
  const p = page(S.mercredi, e);
  const carte = classes(p, 'auj-menus')[0];
  assert.ok(carte, 'carte des menus du jour');
  assert.deepEqual(classes(carte, 'auj-plat').map((x) => x.textContent), ['Tagliatelles', 'riz, carottes']);
  assert.deepEqual(classes(carte, 'auj-menu-etiquette').map((x) => x.textContent), ['Menu 1', 'Menu 2']);
  assert.equal(classes(p, 'tdb-jour').length, 0, 'les jours proches se lisent dans Semaine');
  assert.doesNotMatch(p.textContent, /Poulet rôti/, 'le menu de demain n\'est pas sur Aujourd\'hui');
  // Un seul menu saisi : l'autre est dit « non saisi ».
  const un = calme(etatVide());
  definirMenu(un, S.mercredi, 1, 'Tagliatelles', h());
  const vides = classes(page(S.mercredi, un), 'auj-plat-vide');
  assert.equal(vides.length, 1);
  assert.equal(vides[0].textContent, 'non saisi');
  // Le samedi et le dimanche n'ont pas de menu du jour : on saute au lundi.
  assert.deepEqual(aujourdhuiDe(e, S.vendredi).menusSurTrois.map((j) => j.date).slice(0, 2), [S.vendredi, S.lundiSuivant]);
  assert.equal(aujourdhuiDe(e, S.vendredi).menusSurTrois.length, 3);
});

test('fiche de fonction : seulement si elle tombe aujourd\'hui ou demain', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_LOIN', date: S.vendredi, service: 'midi', horaire: '12:00', couverts: 18, mode: 'menu_fixe', menuFixe: 1 }, h());
  assert.equal(aujourdhuiDe(e, S.mercredi).ficheProche, null);
  assert.equal(classes(page(S.mercredi, e), 'au-fiche').length, 0);
  assert.equal(aujourdhuiDe(e, S.jeudi).ficheProche?.numero ?? null, 'F_LOIN', 'demain : elle apparaît');
});

test('prochaine fiche de fonction : jour, personnes, allergies écrites, certitude écrite', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_PASSEE', date: S.mardi, service: 'midi', horaire: '12:00', couverts: 5, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e, { numero: 'F_PROCHAINE', date: S.jeudi, service: 'midi', horaire: '12:00', couverts: 18, mode: 'choix_libre', repartition: { 1: 10, 2: 8 }, allergies: 'ALLERGIE_TEST' }, h());
  const p = page(S.mercredi, e);
  const f = classes(p, 'au-fiche')[0];
  assert.ok(f);
  assert.match(f.textContent, /Fiche de fonction/);
  assert.match(f.textContent, /jeudi 8 octobre/);
  assert.match(f.textContent, /18 pers\./);
  assert.match(f.textContent, /allergies : ALLERGIE_TEST/);
  assert.match(f.textContent, /provisoire/);
  // La certitude n'a pas le style « hors règle » : style neutre propre aux certitudes (classe rendue, puis CSS).
  const mot = f.tous((x) => x.balise === 'strong' && /provisoire/.test(x.textContent))[0];
  assert.ok(mot, 'certitude écrite en toutes lettres');
  assert.ok(!mot.className.split(' ').includes('au-hors-regle'), mot.className);
  assert.ok(mot.className.split(' ').includes('au-statut-certitude'), mot.className);
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const regle = css.match(/\.au-statut-certitude \{([^}]*)\}/);
  assert.ok(regle, 'style défini');
  assert.doesNotMatch(regle[1], /exception|background/, 'ni ambre ni fond d\'alerte');
  assert.doesNotMatch(f.textContent, /F_PASSEE/);
  assert.equal(f.attributs.href, `#/production/${S.jeudi}`);
});

test('prochaine fiche : sans fiche à venir, rien n\'est affiché', () => {
  assert.equal(classes(page(S.mercredi, mercredi()), 'au-fiche').length, 0);
});

test('depuis Aujourd\'hui : la fiche de chaque ligne reste à un toucher ; Réglages est dans l\'onglet Cuisine (étape 6)', () => {
  const e = mercredi();
  const liens = hrefs(page(S.mercredi, e));
  assert.ok(!liens.includes('#/reglages'), 'plus de lien Réglages dans l\'en-tête');
  assert.ok(liens.includes(`#/fiche/${composantDe(e, 'Tagliatelles').id}`));
});

test('une proposition d\'apprentissage garde ses boutons Oui / Non dans « À confirmer »', async () => {
  const { composantVide } = await import('../app/js/domaine/etat.js');
  const e = calme(etatVide());
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  const p = page(S.lundi, e);
  assert.match(classes(p, 'tdb-confirmer')[0].textContent, /À confirmer · 1/);
  const ligne = classes(classes(p, 'tdb-confirmer')[0], 'au-ligne')[0];
  assert.match(ligne.textContent, /Vous corrigez souvent riz/);
  assert.ok(parTexte(ligne, /^Oui$/) && parTexte(ligne, /^Non$/), 'geste d\'un toucher : Oui ou Non');
  dom.corps.tous((x) => x.balise === 'dialog').forEach((d) => d.remove());
});

test('accessibilité : mots écrits pour les états, quantités en police des quantités, textes et cibles du CSS', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const debut = css.indexOf("Écran Aujourd'hui (refonte 1");
  assert.ok(debut > 0, 'bloc commenté au nom de l\'écran');
  const bloc = css.slice(debut);
  assert.match(bloc, /\.au-qte \{[^}]*var\(--police-qte\)/);
  const tailles = [...bloc.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(tailles.every((t) => t >= 15), `texte sous 15 px : ${tailles}`);
  assert.match(bloc, /\.au-btn \{[^}]*min-height: var\(--haut-bouton\)/);
  assert.match(bloc, /\.au-lien-court \{[^}]*min-height: var\(--cible\)/);
  assert.doesNotMatch(bloc, /gradient|https?:\/\//);
  // L'écran ne passe jamais un état par la couleur seule : « hors règle », « provisoire », « à décider » sont écrits.
  const src = readFileSync(new URL('../app/js/ui/vue-aujourdhui.js', import.meta.url), 'utf8');
  for (const mot of ["'à décider'", "provisoire: 'provisoire'", "'non saisi'", 'ventes à saisir']) assert.ok(src.includes(mot), mot);
  // « hors règle » est écrit par la liste du jour (vue-jour.js), partagée avec Production.
  assert.ok(readFileSync(new URL('../app/js/ui/vue-jour.js', import.meta.url), 'utf8').includes('hors règle'));
  // Le bloc de l'étape 4 respecte les mêmes tailles.
  const etape4 = css.slice(css.indexOf("Écran Aujourd'hui, refonte étape 4"));
  assert.ok([...etape4.matchAll(/font-size: (\d+)px/g)].every((m) => Number(m[1]) >= 15));
  assert.doesNotMatch(src, /en stock|Synchronisé|Générer le bon/);
});

test('le bloc CSS de l\'écran est en fin de fichier', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const marque = css.lastIndexOf('/* ------------------------------------------------------------ ');
  assert.match(css.slice(marque, marque + 120), /Écran Aujourd'hui/);
});

test('hors règle : même définition partout (exception ET non autorisée) ; une étape à J-1 au-delà de son maximum n\'est pas « hors règle » sur Aujourd\'hui ni Production', async () => {
  const e = calme(etatVide());
  definirMenu(e, S.mardi, 1, 'carottes', h());
  definirPrevision(e, S.mardi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirRegle(e, { nom: 'carottes', etapes: [{ libelle: 'Couper', avanceMaxJours: 0 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  const couper = Object.values(e.productions).find((p) => p.etapeCle === 'couper');
  planifier(e, couper.id, S.lundi, h());
  const dec = aDate(S.lundi, () => decisionsDe(e, S.lundi));
  assert.ok(!dec.cartes.some((c) => c.genre === 'avance_hors_regle'), 'la feuille « À décider » ne la classe pas hors règle');
  // Aujourd'hui, « Maintenant » : la ligne n'est pas marquée.
  const d = aujourdhuiDe(e, S.lundi);
  assert.equal(d.maintenant.productionId, couper.id);
  assert.equal(d.maintenant.horsRegle, false);
  // La liste du jour dit « hors règle » pour l'étape au-delà de son maximum (comme Production), jamais la règle des deux jours ;
  // sur Aujourd'hui la cause est dite une fois sous le titre du bloc, et « Planifier » est rangé dans la feuille de « ⋯ ».
  const p = page(S.lundi, e);
  assert.doesNotMatch(p.textContent, /plus de deux jours/);
  assert.equal(classes(p, 'mep-hors-regle-resume').length, 1);
  assert.match(classes(p, 'mep-hors-regle-resume')[0].textContent, /^\d avances? dépasse(nt)? ce que la règle autorise \(hors règle\)\.$/);
  assert.equal(classes(p, 'prod-directes').length, 0, 'aucun bouton « Planifier » sur les lignes');
});

test('hors règle : une vraie avance hors règle (plus de 2 jours sans règle) reste signalée partout', async () => {
  const prod = await import('../app/js/ui/vue-production.js');
  const e = calme(etatVide());
  definirMenu(e, S.vendredi, 1, 'carottes', h());
  definirPrevision(e, S.vendredi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, h());
  assert.equal(aujourdhuiDe(e, S.lundi).maintenant.horsRegle, true);
  magasin.remplacer(structuredClone(e));
  const jour = aDate(S.lundi, () => prod.rendre(magasin.etat(), S.lundi));
  assert.match(jour.textContent, /hors règle/, 'Production : la ligne le dit en toutes lettres');
});

test('bandeau : même nombre que la feuille « À décider » (sauce implicite seule, plusieurs répartitions provisoires) ; Production n\'a plus de puce', async () => {
  const production = await import('../app/js/ui/vue-production.js');
  const sauce = calme(etatVide());
  definirMenu(sauce, S.mercredi, 1, 'Penne aux courgettes', h());
  const trois = calme(etatVide());
  ['F1', 'F2', 'F3'].forEach((numero) => creerFiche(trois, { numero, date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h()));
  for (const [nom, e] of [['sauce implicite', sauce], ['trois répartitions', trois]]) {
    const attendu = aDate(S.mercredi, () => decisionsDe(e, S.mercredi).total);
    assert.ok(attendu >= 1, `${nom} : la feuille a des cartes`);
    const carte = classes(page(S.mercredi, e), 'tdb-confirmer')[0];
    assert.ok(carte, `${nom} : carte « À confirmer » présente`);
    assert.match(carte.textContent, new RegExp(`À confirmer · ${attendu}`), nom);
    // Production épurée (2026-10-09) : plus de puce « N à décider » ; les décisions se disent sur Aujourd'hui.
    const prod = aDate(S.mercredi, () => { magasin.remplacer(structuredClone(e)); return production.rendre(magasin.etat(), S.mercredi); });
    assert.equal(classes(prod, 'prod-adecider').length, 0, `${nom} : plus de puce « à décider » dans Production`);
  }
});

test('samedi : pas de menu du jour, donc ni carte des menus ni couverts du midi ; la liste du jour reste', () => {
  const p = page(S.samedi, mercredi());
  assert.equal(classes(p, 'auj-menus').length, 0);
  assert.equal(classes(p, 'auj-couverts').length, 0);
  assert.equal(classes(p, 'auj-production').length, 1);
  // Un jour de semaine a la carte des menus et son bouton de couverts.
  const semaine = page(S.mercredi, mercredi());
  assert.equal(classes(semaine, 'auj-menus').length, 1);
  assert.equal(classes(semaine, 'auj-couverts').length, 1);
});

test('Rappels : « Préparer la semaine · N à faire » mène à l\'écran quand des couverts ou des valeurs manquent, absent quand tout est fait', () => {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 2, 'riz, carottes', h());
  const n = page(S.mercredi, e);
  const ligne = n.tous((x) => x.balise === 'a' && /^Préparer la semaine · \d+ à faire$/.test(x.textContent))[0];
  assert.ok(ligne, 'ligne dans les rappels');
  assert.equal(ligne.attributs.href, `#/preparer/${S.lundi}`);
  const fait = calme(etatVide());
  const vide = page(S.mercredi, fait);
  assert.equal(vide.tous((x) => /Préparer la semaine/.test(x.textContent)).length, 0, 'rien à préparer : aucune ligne');
});
