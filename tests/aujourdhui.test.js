// Écran Aujourd'hui (tableau de bord, refonte 2) sous faux DOM : menus sur 3 jours, cases Production et Couverts midi, « À avancer »,
// fiche de fonction, « À confirmer », carte « Prochaine » fixe ; les données de couverts avec certitude restent au domaine.
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
/** Le point « semaine type à confirmer » est global et existant : on le règle pour isoler ce que chaque test vérifie. */
const calme = (e) => { e.reglages.semaineTypeConfirmee = true; return e; };
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

/** Le jeudi : du riz au menu 2, fait le mardi (J-2 : le repère du référentiel avertit, sans bloquer). */
function jeudiAvecRizAvance() {
  const e = etatVide();
  definirMenu(e, S.jeudi, 2, 'riz, carottes', h());
  definirPrevision(e, S.jeudi, 2, 10, h());
  definirStandard(e, 'riz', 'garniture', { valeur: 60, unite: 'g', etat: 'sec' }, h());
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
  assert.match(texte, /Aucune tâche décidée/);
  assert.match(texte, /menu à importer/, 'un jour sans menu est dit, en pointillés');
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

test('couverts : le domaine garde la certitude écrite de chaque menu et des fiches ; la case « Couverts midi » dit le total et M1 · M2', () => {
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
  const caseCouverts = classes(p, 'tdb-case').find((c) => /Couverts midi/.test(c.textContent));
  assert.match(caseCouverts.textContent, /22/);
  assert.match(caseCouverts.textContent, /M1 10 · M2 12/);
  assert.ok(classes(caseCouverts, 'tdb-chiffre')[0], 'chiffre en police des quantités');
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
  const caseCouverts = classes(p, 'tdb-case').find((c) => /Couverts midi/.test(c.textContent));
  assert.equal(classes(caseCouverts, 'tdb-chiffre')[0].textContent, '—');
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

test('Prochaine : première tâche non faite, quantité, créneau, Ouvrir la fiche et Fait annulable', () => {
  const e = mercredi();
  for (const nom of ['Tagliatelles', 'riz']) planifier(e, prodDe(e, nom), S.mercredi, 'avant_midi', h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.ok(d.maintenant);
  assert.equal(d.avancement.total, 2);
  const p = page(S.mercredi, e);
  const carte = classes(p, 'prochaine')[0];
  assert.match(carte.textContent, /Prochaine/);
  assert.match(carte.textContent, new RegExp(d.maintenant.nom));
  assert.match(carte.textContent, /avant le service de midi/);
  assert.match(carte.textContent, /menu [12]/);
  assert.ok(classes(carte, 'prochaine-qte')[0].className.includes('au-qte'), 'quantité en police des quantités');
  assert.match(classes(carte, 'prochaine-qte')[0].textContent, /\d/);
  assert.equal(classes(p, 'tdb-chiffre')[0].textContent, '0/2', 'la case Production compte les tâches du jour');
  // Rien de planifié : comme sur Production, les lignes de travail sont comptées.
  const brut = aujourdhuiDe(mercredi(), S.mercredi);
  assert.equal(brut.avancement.total, 0);
  assert.ok(brut.avancementJour.total >= 2);
  assert.deepEqual(hrefs(carte), [`#/fiche/${d.maintenant.composantId}`]);
  const fait = parTexte(carte, /^Fait$/);
  assert.ok(fait);

  fait.click();
  const apres = magasin.etat().productions[d.maintenant.productionId];
  assert.equal(apres.etat, 'fait', 'même action que la feuille Jour : marquée faite');
  assert.ok(Number.isFinite(apres.quantiteReelle));
  const message = dom.document.getElementById('messages');
  const annuler = parTexte(message, /Annuler/);
  assert.ok(annuler, 'depuis Aujourd\'hui, pas de case à retoucher : le geste reste annulable');
  annuler.click();
  assert.equal(magasin.etat().productions[d.maintenant.productionId].etat, 'a_faire');
});

test('Prochaine : une fois tout fait, la carte le dit et ne propose plus rien', () => {
  const e = mercredi();
  const principales = Object.values(e.productions).filter((x) => x.genre === 'principale' && x.dateService === S.mercredi);
  for (const x of principales) { planifier(e, x.id, S.mercredi, 'avant_midi', h()); marquerFait(e, x.id, 100, h()); }
  const p = page(S.mercredi, e);
  const carte = classes(p, 'prochaine')[0];
  assert.match(carte.textContent, /Tout est fait/);
  assert.equal(classes(p, 'tdb-chiffre')[0].textContent, `${principales.length}/${principales.length}`);
  assert.equal(boutons(carte).length, 0);
});

test('décisions : « À confirmer · N » compte comme la feuille « À décider », « Tout voir » l\'ouvre ; les lignes restent des liens', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.ok(d.decisions.total >= 1);
  const p = page(S.mercredi, e);
  const carte = classes(p, 'tdb-confirmer')[0];
  assert.ok(carte, 'carte « À confirmer » présente');
  assert.match(carte.textContent, new RegExp(`À confirmer · ${aDate(S.mercredi, () => decisionsDe(e, S.mercredi).total)}`));
  assert.ok(classes(carte, 'au-ligne').length <= 3, 'trois lignes au plus');
  // Chaque ligne reste un lien (ou un bouton pour une proposition) : rien n'a disparu.
  assert.ok(hrefs(carte).some((x) => x.startsWith('#/production/')));
  globalThis.location.hash = '#/aujourdhui';
  aDate(S.mercredi, () => parTexte(carte, /Tout voir/).click());
  assert.ok(dom.corps.tous((x) => x.balise === 'dialog' && x.open).length >= 1, 'la feuille « À décider » s\'ouvre');
  dom.corps.tous((x) => x.balise === 'dialog').forEach((dl) => dl.remove());
});

test('à consommer : le calcul du domaine reste (avertissements d\'abord, 3 au plus) ; la zone est masquée sur l\'accueil, sans lien vers les DLC', () => {
  const e = jeudiAvecRizAvance();
  // Le riz du jeudi (menu 2), fait mardi (J-2) : dans la règle des deux jours, le repère du référentiel avertit.
  const rizJeudi = Object.values(e.productions).find((p) => p.composantId === composantDe(e, 'riz').id && p.genre === 'principale');
  assert.ok(rizJeudi);
  planifier(e, rizJeudi.id, S.mardi, 'avant_midi', h());
  marquerFait(e, rizJeudi.id, 5000, `${S.mardi}T08:00:00.000Z`);
  const d = aujourdhuiDe(e, S.mercredi);
  assert.equal(d.aConsommer.total, 1);
  assert.equal(d.aConsommer.lignes[0].avanceJours, 2);
  assert.ok(d.aConsommer.lignes[0].conservation, 'le repère du référentiel avertit à J-2 pour le riz cuit');
  const p = page(S.mercredi, e);
  assert.doesNotMatch(p.textContent, /À consommer en priorité/);
  assert.ok(!hrefs(p).includes('#/stock/dlc'), 'Restes, DLC et Achats sont masqués');
  // Plusieurs avances : trois lignes au plus, les avertissements d'abord (même domaine).
  const e2 = etatVide();
  for (const j2 of [S.mardi, S.mercredi, S.jeudi, S.vendredi]) { definirMenu(e2, j2, 2, 'riz', h()); definirPrevision(e2, j2, 2, 10, h()); }
  definirStandard(e2, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  definirRegle(e2, { nom: 'riz', avanceMaxJours: 1 }, h());
  const ids = Object.values(e2.productions).filter((x) => x.genre === 'principale');
  assert.equal(ids.length, 4);
  for (const x of ids) { planifier(e2, x.id, S.samediPrecedent, 'avant_midi', h()); marquerFait(e2, x.id, 1000, `${S.samediPrecedent}T08:00:00.000Z`); }
  const d2 = aujourdhuiDe(e2, S.lundi);
  assert.equal(d2.aConsommer.total, 4);
  assert.equal(d2.aConsommer.lignes.length, 3);
  assert.ok(d2.aConsommer.lignes.every((l) => l.horsRegle || l.conservation));
});

test('« À avancer » : les avances que la règle des deux jours autorise, 3 lignes au plus, « pour mardi » et la quantité', () => {
  const e = etatVide();
  for (const j2 of [S.mardi, S.mercredi, S.jeudi]) { definirMenu(e, j2, 2, 'riz', h()); definirPrevision(e, j2, 2, 10, h()); }
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  calme(e);
  const d = aujourdhuiDe(e, S.lundi);
  assert.ok(d.aAvancer.total >= 1);
  assert.ok(d.aAvancer.lignes.length <= 3);
  const section = (noeud) => noeud.tous((x) => x.balise === 'section' && x.attributs['aria-label'] === 'À avancer')[0];
  const sec = section(page(S.lundi, e));
  assert.ok(sec, 'la section est là');
  assert.match(sec.textContent, /À avancer/);
  assert.match(sec.textContent, /pour mardi/);
  assert.ok(classes(sec, 'au-qte').length >= 1, 'quantité en police des quantités');
  assert.ok(hrefs(sec).includes(`#/production/${S.lundi}`), 'lien « Production »');
  assert.equal(section(page(S.mercredi, mercredi())), undefined, 'rien à avancer : pas de section');
});

test('menus sur trois jours : aujourd\'hui en encre, un jour sans menu « à importer » en pointillés, toucher = Semaine ou Import', () => {
  const e = mercredi();
  definirMenu(e, S.jeudi, 1, 'Poulet rôti', h());
  const d = aujourdhuiDe(calme(e), S.mercredi);
  assert.deepEqual(d.menusSurTrois.map((j) => j.date), [S.mercredi, S.jeudi, S.vendredi]);
  assert.equal(d.menusSurTrois[0].estAujourdhui, true);
  assert.equal(d.menusSurTrois[2].aImporter, true);
  const p = page(S.mercredi, e);
  const jours = classes(p, 'tdb-jour');
  assert.equal(jours.length, 3);
  assert.ok(jours[0].className.includes('tdb-jour-auj'));
  assert.equal(jours[0].attributs.href, `#/production/${S.mercredi}`);
  assert.match(jours[1].textContent, /Poulet rôti/);
  assert.ok(jours[2].className.includes('tdb-jour-vide'));
  assert.match(jours[2].textContent, /menu à importer/);
  assert.equal(jours[2].attributs.href, `#/import/${S.lundi}`);
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

test('les zones de l\'ancien tableau restent accessibles : Semaine, Production, menus de la semaine', () => {
  const liens = hrefs(page(S.mercredi, mercredi()));
  assert.ok(liens.includes(`#/production/${S.mercredi}`));
  assert.ok(liens.includes('#/semaine'));
  assert.ok(liens.includes(`#/import/${S.lundi}`));
});

test('une proposition d\'apprentissage garde son bouton dans « À confirmer » (ouvre sa feuille)', async () => {
  const { composantVide } = await import('../app/js/domaine/etat.js');
  const e = calme(etatVide());
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  const p = page(S.lundi, e);
  assert.match(classes(p, 'tdb-confirmer')[0].textContent, /À confirmer · 1/);
  const bouton = parTexte(classes(p, 'tdb-confirmer')[0], /Vous corrigez souvent riz/);
  assert.ok(bouton);
  aDate(S.lundi, () => bouton.click());
  assert.ok(dom.corps.tous((x) => x.balise === 'dialog' && x.open).length >= 1, 'la feuille de validation s\'ouvre');
  dom.corps.tous((x) => x.balise === 'dialog').forEach((d) => d.remove());
});

test('accessibilité : mots écrits pour les états, quantités en police des quantités, textes et cibles du CSS', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const debut = css.indexOf("Écran Aujourd'hui (refonte 1");
  assert.ok(debut > 0, 'bloc commenté au nom de l\'écran');
  const bloc = css.slice(debut);
  assert.match(bloc, /\.au-qte \{[^}]*var\(--police-qte\)/);
  const tailles = [...bloc.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(tailles.every((t) => t >= 13), `texte sous 13 px : ${tailles}`);
  assert.match(bloc, /\.au-btn \{[^}]*min-height: var\(--haut-bouton\)/);
  assert.match(bloc, /\.au-lien-court \{[^}]*min-height: var\(--cible\)/);
  assert.doesNotMatch(bloc, /gradient|https?:\/\//);
  // L'écran ne passe jamais un état par la couleur seule : « hors règle », « provisoire », « à décider » sont écrits.
  const src = readFileSync(new URL('../app/js/ui/vue-aujourdhui.js', import.meta.url), 'utf8');
  for (const mot of ["'hors règle'", "'à décider'", "provisoire: 'provisoire'", 'phraseConservation']) assert.ok(src.includes(mot), mot);
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
  planifier(e, couper.id, S.lundi, 'avant_midi', h());
  const dec = aDate(S.lundi, () => decisionsDe(e, S.lundi));
  assert.ok(!dec.cartes.some((c) => c.genre === 'avance_hors_regle'), 'la feuille « À décider » ne la classe pas hors règle');
  // Aujourd'hui, « Maintenant » : la ligne n'est pas marquée.
  const d = aujourdhuiDe(e, S.lundi);
  assert.equal(d.maintenant.productionId, couper.id);
  assert.equal(d.maintenant.horsRegle, false);
  assert.doesNotMatch(classes(page(S.lundi, e), 'prochaine')[0].textContent, /hors règle/);
});

test('hors règle : une vraie avance hors règle (plus de 2 jours sans règle) reste signalée partout', async () => {
  const prod = await import('../app/js/ui/vue-production.js');
  const e = calme(etatVide());
  definirMenu(e, S.vendredi, 1, 'carottes', h());
  definirPrevision(e, S.vendredi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, 'avant_midi', h());
  assert.equal(aujourdhuiDe(e, S.lundi).maintenant.horsRegle, true);
  magasin.remplacer(structuredClone(e));
  const jour = aDate(S.lundi, () => prod.rendre(magasin.etat(), S.lundi));
  assert.match(jour.textContent, /hors règle/, 'Production : la ligne le dit en toutes lettres');
  marquerFait(e, p.id, 100, h());
  const conso = aujourdhuiDe(e, S.lundi).aConsommer.lignes.find((l) => l.composantId === p.composantId);
  assert.equal(conso?.horsRegle, true, 'à consommer : même définition');
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

test('samedi : pas de menu du jour, donc pas de case « Couverts midi » ; la case Production occupe la largeur', () => {
  const p = page(S.samedi, mercredi());
  assert.equal(classes(p, 'tdb-case').filter((c) => /Couverts midi/.test(c.textContent)).length, 0);
  assert.equal(classes(p, 'tdb-chiffres-seule').length, 1);
  assert.equal(classes(p, 'tdb-case').filter((c) => /Production/.test(c.textContent)).length, 1);
  // Un jour de semaine garde les deux cases.
  const semaine = page(S.mercredi, mercredi());
  assert.equal(classes(semaine, 'tdb-case').length, 2);
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
