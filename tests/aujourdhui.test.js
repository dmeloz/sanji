// Écran Aujourd'hui (refonte 1, maquette Main) sous faux DOM : couverts avec certitude, carte « Maintenant », bandeau
// des décisions, « À consommer en priorité », prochaine fiche de fonction, accès aux zones de l'ancien tableau.
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
  assert.match(texte, /Mercredi 7 octobre/);
  assert.doesNotMatch(texte, /hors ligne/);
  assert.match(texte, /Aucune tâche décidée/);
  assert.match(texte, /menu non saisi/);
  assert.equal(classes(p, 'au-decisions').length, 0, 'aucune décision, aucun bandeau');
  assert.doesNotMatch(texte, /Synchronis|Midi|Soir|minuteur|en stock|frigo|chambre froide|Mon planning/i);
});

test('en-tête : « hors ligne » ne s\'affiche que s\'il y a un problème (texte de horsligne.js), jamais « prêt »', async () => {
  const { problemeHorsLigne } = await import('../app/js/ui/horsligne.js');
  // Vérification en cours : rien. Le texte du problème est produit par horsligne.js, pas par l'écran (voir lot-aujourdhui-semaine.test.js pour le cas du problème).
  assert.equal(problemeHorsLigne(), null);
  const p = page(S.mercredi, etatVide());
  assert.equal(classes(p, 'au-hors-ligne').length, 0);
  assert.doesNotMatch(p.textContent, /hors ligne prêt/);
});

test('couverts : menu 1, menu 2 et fiches, chacun avec sa certitude écrite (estimée, provisoire, confirmée)', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_FIXE', date: S.mercredi, service: 'midi', horaire: '12:00', couverts: 8, mode: 'menu_fixe', menuFixe: 1 }, h());
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  const p = page(S.mercredi, e);
  const tuiles = classes(p, 'au-tuile');
  assert.equal(tuiles.length, 3);
  const [m1, m2, fiches] = tuiles.map((t) => t.textContent);
  assert.match(m1, /Menu 1/);
  assert.match(m1, /22 couv\./, '10 prévus + 8 fiche menu fixe + 4 répartis');
  assert.match(m1, /estimée 10/);
  assert.match(m1, /provisoire 4/);
  assert.match(m1, /confirmée 8/);
  assert.match(m2, /Menu 2/);
  assert.match(m2, /14 couv\./);
  assert.match(m2, /estimée 12/);
  assert.match(m2, /provisoire 2/);
  assert.match(fiches, /14 couv\./);
  assert.match(fiches, /confirmée 8/);
  assert.match(fiches, /provisoire 6/);
  // La quantité de couverts est en police des quantités.
  assert.ok(classes(p, 'au-couverts').every((x) => x.className.includes('au-qte')));
});

test('couverts : sans prévision, aucun « 0 » inventé et aucune alerte', () => {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 1, 'Tagliatelles', h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.equal(d.menus[0].couverts, null);
  assert.equal(d.menus[0].previsionASaisir, true);
  const p = page(S.mercredi, e);
  assert.match(classes(p, 'au-tuile')[0].textContent, /prévision à saisir/);
  // La sauce implicite du menu 1 est une vraie décision de la feuille (donc du bandeau) ; la prévision absente n'en est jamais une.
  const bandeau = classes(p, 'au-decisions')[0];
  assert.match(bandeau.textContent, /2 décisions à prendre/, 'une sauce à confirmer et une valeur à valider, comme la feuille');
  assert.match(bandeau.textContent, /sauce à confirmer/);
  assert.doesNotMatch(bandeau.textContent, /prévision|quantité|portion/);
  assert.equal(d.decisions.total, 0);
});

test('dimanche : fermé, aucune tâche, aucun couvert', () => {
  const p = page(S.dimanche, mercredi());
  assert.match(p.textContent, /Fermé aujourd'hui/);
  assert.equal(classes(p, 'au-maintenant-actions').length, 0);
});

test('Maintenant : première tâche non faite, quantité, destination, jauge, Ouvrir la fiche et Fait annulable', () => {
  const e = mercredi();
  for (const nom of ['Tagliatelles', 'riz']) planifier(e, prodDe(e, nom), S.mercredi, 'avant_midi', h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.ok(d.maintenant);
  assert.equal(d.avancement.total, 2);
  const p = page(S.mercredi, e);
  const carte = classes(p, 'au-maintenant')[0];
  assert.match(carte.textContent, /Maintenant/);
  assert.match(carte.textContent, /0 \/ 2 faites/);
  assert.match(carte.textContent, new RegExp(d.maintenant.nom));
  assert.match(carte.textContent, /pour le service du jour/);
  assert.match(carte.textContent, /menu [12]/);
  assert.ok(classes(carte, 'au-maintenant-qte')[0].className.includes('au-qte'), 'quantité en police des quantités');
  assert.match(classes(carte, 'au-maintenant-qte')[0].textContent, /\d/);
  const jauge = carte.querySelector('progress');
  assert.equal(jauge.attributs.max, '2');
  assert.deepEqual(hrefs(carte), [`#/fiche/${d.maintenant.composantId}`]);
  const fait = parTexte(carte, /^Fait$/);
  assert.ok(fait);

  fait.click();
  const apres = magasin.etat().productions[d.maintenant.productionId];
  assert.equal(apres.etat, 'fait', 'même action que la feuille Jour : marquée faite');
  assert.ok(Number.isFinite(apres.quantiteReelle));
  const message = dom.document.getElementById('messages');
  const annuler = parTexte(message, /Annuler/);
  assert.ok(annuler, 'le geste reste annulable');
  annuler.click();
  assert.equal(magasin.etat().productions[d.maintenant.productionId].etat, 'a_faire');
});

test('Maintenant : une fois tout fait, la carte le dit et propose plus rien', () => {
  const e = mercredi();
  const principales = Object.values(e.productions).filter((x) => x.genre === 'principale' && x.dateService === S.mercredi);
  for (const x of principales) { planifier(e, x.id, S.mercredi, 'avant_midi', h()); marquerFait(e, x.id, 100, h()); }
  const p = page(S.mercredi, e);
  const carte = classes(p, 'au-maintenant')[0];
  assert.match(carte.textContent, /Tout est fait/);
  assert.match(carte.textContent, new RegExp(`${principales.length} / ${principales.length} faites`));
  assert.equal(boutons(carte).length, 0);
});

test('décisions : le bandeau compte les points « À confirmer » existants et appelle ouvrirDecisions ; le détail reste dans un repli', () => {
  const e = mercredi();
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.ok(d.decisions.total >= 1);
  const p = page(S.mercredi, e);
  const bandeau = classes(p, 'au-decisions')[0];
  assert.ok(bandeau, 'bandeau présent');
  // Le bandeau compte comme la feuille « À décider » (decisionsDe), le repli garde le détail des points.
  assert.match(bandeau.textContent, new RegExp(`${aDate(S.mercredi, () => decisionsDe(e, S.mercredi).total)} décisions à prendre`));
  assert.match(bandeau.textContent, /répartition provisoire/);
  const repli = classes(p, 'au-repli')[0];
  assert.equal(repli.open, false);
  globalThis.location.hash = '#/aujourdhui';
  bandeau.click();
  assert.equal(repli.open, true, 'le détail s\'ouvre');
  assert.equal(repli.attributs.id, 'bord-titre-confirmer', 'cible de ouvrirDecisions');
  // Chaque ligne du repli reste un lien (ou un bouton pour une proposition) : rien n'a disparu.
  assert.ok(hrefs(repli).some((x) => x.startsWith('#/semaine/')));
});

test('à consommer en priorité : production faite pour un service à venir, avertissement de conservation, 3 au plus, Tout voir', () => {
  const e = jeudiAvecRizAvance();
  // Le riz du jeudi (menu 2), fait mardi (J-2) : dans la règle des deux jours, le repère du référentiel avertit.
  const rizJeudi = Object.values(e.productions).find((p) => p.composantId === composantDe(e, 'riz').id && p.genre === 'principale');
  assert.ok(rizJeudi);
  planifier(e, rizJeudi.id, S.mardi, 'avant_midi', h());
  marquerFait(e, rizJeudi.id, 5000, h());
  const d = aujourdhuiDe(e, S.mercredi);
  assert.equal(d.aConsommer.total, 1);
  const l = d.aConsommer.lignes[0];
  assert.equal(l.avanceJours, 2);
  assert.ok(l.conservation, 'le repère du référentiel avertit à J-2 pour le riz cuit');
  const p = page(S.mercredi, e);
  const carte = classes(p, 'au-carte').find((c) => /À consommer en priorité/.test(c.textContent));
  assert.match(carte.textContent, /Se garde 1 jour · avance de 2 jours/);
  assert.match(carte.textContent, /standard de base/);
  assert.doesNotMatch(carte.textContent, /Attention|feculents|hygiene\.|riz\.conservation/, 'une phrase lisible, aucun identifiant technique');
  assert.match(carte.textContent, /avance J\+2/);
  assert.ok(hrefs(carte).includes('#/stock/dlc'));
  assert.match(carte.textContent, /Tout voir/);
  assert.doesNotMatch(carte.textContent, /DLC auj|frigo|chambre froide|lot/i);
});

test('à consommer : trois lignes au plus, les avertissements d\'abord ; une avance au-delà de 2 jours est « hors règle » écrit', () => {
  const e = etatVide();
  const jours = [S.mardi, S.mercredi, S.jeudi, S.vendredi];
  for (const j of jours) { definirMenu(e, j, 2, 'riz', h()); definirPrevision(e, j, 2, 10, h()); }
  definirStandard(e, 'riz', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  definirRegle(e, { nom: 'riz', avanceMaxJours: 1 }, h());
  const ids = Object.values(e.productions).filter((p) => p.genre === 'principale');
  assert.equal(ids.length, 4);
  for (const p of ids) { planifier(e, p.id, S.samediPrecedent, 'avant_midi', h()); marquerFait(e, p.id, 1000, h()); }
  const d = aujourdhuiDe(e, S.lundi);
  assert.equal(d.aConsommer.total, 4);
  assert.equal(d.aConsommer.lignes.length, 3);
  assert.ok(d.aConsommer.lignes.every((l) => l.horsRegle || l.conservation));
  const p = page(S.lundi, e);
  const carte = classes(p, 'au-carte').find((c) => /À consommer en priorité/.test(c.textContent));
  assert.equal(classes(carte, 'au-conso').length, 3);
  assert.match(carte.textContent, /hors règle/);
});

test('à consommer : rien de fait à l\'avance, ligne neutre ; une quantité absente n\'alerte pas', () => {
  const p = page(S.mercredi, mercredi());
  const carte = classes(p, 'au-carte').find((c) => /À consommer en priorité/.test(c.textContent));
  assert.match(carte.textContent, /Rien de fait à l'avance/);
  assert.ok(hrefs(carte).includes('#/stock/dlc'));
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
  assert.equal(f.attributs.href, `#/semaine/${S.jeudi}`);
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

test('une proposition d\'apprentissage garde son bouton dans le repli « À confirmer » (ouvre sa feuille)', async () => {
  const { composantVide } = await import('../app/js/domaine/etat.js');
  const e = calme(etatVide());
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  const p = page(S.lundi, e);
  assert.match(classes(p, 'au-decisions')[0].textContent, /1 décision à prendre/);
  const bouton = parTexte(classes(p, 'au-repli')[0], /Vous corrigez souvent riz/);
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
  assert.match(bloc, /\.au-decisions \{[^}]*min-height: 60px/);
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

test('hors règle : même définition partout (exception ET non autorisée) ; une étape à J-1 au-delà de son maximum n\'est pas « hors règle » sur Aujourd\'hui ni Semaine', async () => {
  const semaine = await import('../app/js/ui/vue-semaine.js');
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
  assert.doesNotMatch(classes(page(S.lundi, e), 'au-maintenant')[0].textContent, /hors règle/);
  // Semaine : aucune mention « hors règle » (jour, puces) tant que la feuille ne la classe pas ainsi.
  const e2 = calme(etatVide());
  definirMenu(e2, S.mardi, 1, 'carottes', h());
  definirPrevision(e2, S.mardi, 1, 20, h());
  definirStandard(e2, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirRegle(e2, { nom: 'carottes', etapes: [{ libelle: 'Couper', avanceMaxJours: 0 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  planifier(e2, Object.values(e2.productions).find((p) => p.etapeCle === 'couper').id, S.lundi, 'avant_midi', h());
  magasin.remplacer(e2);
  const sem = aDate(S.lundi, () => semaine.rendre(magasin.etat(), S.lundi));
  // (la légende « hors règle » des puces et le texte d'alerte du domaine restent : seuls les marqueurs dépendent de la définition)
  assert.equal(classes(sem, 'sem-prod-hors-regle').length, 0);
  assert.equal(classes(sem, 'sem-hors-regle').length, 0);
  assert.ok(classes(sem, 'sem-puce').every((p) => !/hors règle/.test(p.attributs['aria-label'] ?? '')), 'aucune puce de jour marquée');
});

test('hors règle : une vraie avance hors règle (plus de 2 jours sans règle) reste signalée partout', async () => {
  const semaine = await import('../app/js/ui/vue-semaine.js');
  const e = calme(etatVide());
  definirMenu(e, S.vendredi, 1, 'carottes', h());
  definirPrevision(e, S.vendredi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, 'avant_midi', h());
  assert.equal(aujourdhuiDe(e, S.lundi).maintenant.horsRegle, true);
  magasin.remplacer(structuredClone(e));
  const sem = aDate(S.lundi, () => semaine.rendre(magasin.etat(), S.lundi));
  assert.ok(classes(sem, 'sem-prod-hors-regle').length >= 1);
  assert.ok(classes(sem, 'sem-puce').some((x) => /hors règle/.test(x.attributs['aria-label'] ?? '')));
  marquerFait(e, p.id, 100, h());
  const conso = aujourdhuiDe(e, S.lundi).aConsommer.lignes.find((l) => l.composantId === p.composantId);
  assert.equal(conso?.horsRegle, true, 'à consommer : même définition');
});

test('bandeau : même nombre que la feuille « À décider » (sauce implicite seule, plusieurs répartitions provisoires), et accès depuis Production', async () => {
  const production = await import('../app/js/ui/vue-production.js');
  const sauce = calme(etatVide());
  definirMenu(sauce, S.mercredi, 1, 'Penne aux courgettes', h());
  const trois = calme(etatVide());
  ['F1', 'F2', 'F3'].forEach((numero) => creerFiche(trois, { numero, date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h()));
  for (const [nom, e] of [['sauce implicite', sauce], ['trois répartitions', trois]]) {
    const attendu = aDate(S.mercredi, () => decisionsDe(e, S.mercredi).total);
    assert.ok(attendu >= 1, `${nom} : la feuille a des cartes`);
    const bandeau = classes(page(S.mercredi, e), 'au-decisions')[0];
    assert.ok(bandeau, `${nom} : bandeau présent`);
    assert.match(bandeau.textContent, new RegExp(`${attendu} décisions? à prendre`), nom);
    const prod = aDate(S.mercredi, () => { magasin.remplacer(structuredClone(e)); return production.rendre(magasin.etat(), S.mercredi); });
    const acces = classes(prod, 'prod-decisions')[0];
    assert.ok(acces, `${nom} : second accès dans Production`);
    assert.match(acces.textContent, new RegExp(`${attendu} décisions? à prendre`));
    assert.equal(acces.balise, 'button');
  }
  const calmeProd = aDate(S.mercredi, () => { magasin.remplacer(calme(etatVide())); return production.rendre(magasin.etat(), S.mercredi); });
  assert.equal(classes(calmeProd, 'prod-decisions').length, 0, 'rien à décider : pas d\'accès');
});
