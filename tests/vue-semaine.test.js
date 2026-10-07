// Écran Semaine (refonte 1, onglet 3). Faux DOM : ni mise en page ni navigateur.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { composantValide, etatVide, h, h as horo, prevision, principaleDe } from './aide.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';

let dom; let magasin; let vue; let routeur; let actions; let planif; let dates;
const { planifier } = await import('../app/js/domaine/actions.js');

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vue = await import('../app/js/ui/vue-semaine.js');
  routeur = await import('../app/js/ui/routeur.js');
  actions = await import('../app/js/domaine/actions.js');
  planif = await import('../app/js/domaine/planification.js');
  dates = await import('../app/js/domaine/dates.js');
});
after(() => dom.restaurer());

const texte = (n) => n.textContent;
const liens = (n) => n.tous((x) => x.balise === 'a').map((a) => a.attributs.href);
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const puceDe = (n, jour) => parClasse(n, 'sem-puce').find((x) => (x.attributs['aria-label'] ?? '').startsWith(jour));

/** Un lundi à menus saisis, prévision du menu 1 seulement. */
function semaine() {
  const e = etatVide();
  actions.definirMenu(e, S.lundiSuivant, 1, 'riz, carottes', horo());
  actions.definirMenu(e, S.lundiSuivant, 2, 'courgettes, quinoa', horo());
  actions.definirPrevision(e, S.lundiSuivant, 1, 40, horo());
  return e;
}

/** Les productions principales de la semaine, créées par le domaine. */
function avecProductions() {
  const e = semaine();
  actions.assurerProductions(e, horo(), S.samedi);
  return [e, Object.values(e.productions).filter((p) => p.genre === 'principale')];
}

test('titre et routage : un jour = détail, sans date ou /tableau = semaine globale', () => {
  assert.equal(vue.titre(null), 'Semaine');
  assert.equal(vue.titre(S.lundiSuivant, 'tableau'), 'Semaine');
  assert.match(vue.titre(S.lundiSuivant), /détail du jour/);
  assert.equal(routeur.VUES.semaine, vue);
});

test('jour : en-tête « Semaine n° · ouvert lun → sam », sans état hors ligne normal, import et sept puces', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.match(texte(n), /Semaine \d+ · ouvert lun → sam/);
  assert.doesNotMatch(texte(n), /hors ligne/);
  assert.ok(liens(n).includes(`#/import/${S.lundiSuivant}`));
  assert.equal(parClasse(n, 'sem-puce').length, 7);
  const actifs = parClasse(n, 'sem-puce').filter((p) => p.attributs['aria-current'] === 'date');
  assert.equal(actifs.length, 1);
  assert.match(actifs[0].attributs['aria-label'], /^Lundi/);
});

test('puces : le dimanche est fermé (écrit, sans lien) ; le samedi n\'est rien présumé', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  const ferme = parClasse(n, 'sem-puce-ferme');
  assert.equal(ferme.length, 1);
  assert.match(ferme[0].attributs['aria-label'], /^Dimanche.*, fermé$/);
  assert.match(texte(ferme[0]), /fermé/);
  assert.equal(ferme[0].balise, 'span');
  assert.doesNotMatch(puceDe(n, 'Samedi').attributs['aria-label'], /jour off|hors règle|fermé/);
});

test('puces : « jour off » seulement si la semaine type rend tous les créneaux indisponibles', () => {
  const e = semaine();
  for (const c of ['avant_midi', 'apres_midi', 'avant_soir']) actions.definirSemaineType(e, 4, c, 'indisponible', horo());
  magasin.remplacer(e);
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.match(puceDe(n, 'Jeudi').attributs['aria-label'], /jour off/);
  assert.doesNotMatch(puceDe(n, 'Mercredi').attributs['aria-label'], /jour off/);
  assert.match(texte(vue.rendre(magasin.etat(), dates.ajouterJours(S.lundiSuivant, 3))), /Jour off selon la semaine type/);
});

test('services : menus 1 et 2, couverts avec leur certitude, attribution au poste, carte sans quantité, fiche', () => {
  const e = semaine();
  actions.creerFiche(e, { date: S.lundiSuivant, service: 'midi', numero: 'F7', couverts: 12, horaire: '12:00', mode: 'menu_fixe', menuFixe: 1, allergies: 'arachides' }, horo());
  magasin.remplacer(e);
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  const t = texte(n);
  assert.match(t, /Menu 1/);
  assert.match(t, /riz, carottes/);
  assert.match(t, /Menu 2/);
  assert.match(t, /courgettes, quinoa/);
  assert.match(t, /estimée 40/);
  assert.match(t, /confirmée 12/);
  assert.match(t, /prévision à saisir/);
  assert.match(t, /Attribution au poste : \d+ sur \d+/);
  assert.ok(n.tous((x) => x.balise === 'input' && x.attributs.role === 'switch').length >= 2, 'un interrupteur « au poste » par composant');
  assert.match(t, /Carte.*contexte du service/s, 'la carte reste en contexte');
  assert.doesNotMatch(texte(parClasse(n, 'sem-carte')[0]), /aucune quantité calculée/, 'l\'aide permanente a quitté la carte (elle est dans le repli du détail)');
  assert.match(t, /Fiche F7/);
  assert.match(t, /répartition confirmée/);
  assert.match(t, /Allergies : arachides/);
  assert.match(t, /allergènes à confirmer/);
});

test('une quantité absente n\'est ni une décision ni une alerte : mention neutre, rien d\'ambre', () => {
  const [e, prods] = avecProductions();
  Object.assign(prods[0], { jourDecide: S.lundiSuivant, creneauDecide: 'avant_midi', dateService: S.lundiSuivant });
  magasin.remplacer(e);
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.ok(parClasse(n, 'sem-prod').length >= 1);
  assert.equal(parClasse(n, 'sem-prod-hors-regle').length, 0);
  assert.doesNotMatch(texte(parClasse(n, 'sem-aproduire')[0]), /hors règle/);
  assert.match(texte(parClasse(n, 'sem-aproduire')[0]), /quantité à compléter|\d/);
});

/** Lundi : un élément pour le jour même, un autre pour vendredi (avance de quatre jours, sans règle : hors règle), quantités connues. */
function lundiAvecAvance() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  prevision(e, S.vendredi, 1, 10);
  const m = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_M1_TEST' });
  const v = composantValide(e, S.vendredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_VENDREDI_TEST' });
  planifier(e, principaleDe(e, m), S.lundi, 'avant_midi', h());
  planifier(e, principaleDe(e, v), S.lundi, 'apres_midi', h());
  return { e, m, v };
}

test('« À produire ce jour » : créneau, avance, « hors règle » écrit, quantité, Fait et Déplacer', () => {
  const { e, v } = lundiAvecAvance();
  magasin.remplacer(e);
  assert.equal(planif.evaluationProduction(magasin.etat(), principaleDe(e, v)).autorisee, false, 'quatre jours sans règle : hors règle');
  const n = vue.rendre(magasin.etat(), S.lundi);
  const lignes = parClasse(n, 'sem-prod');
  assert.equal(lignes.length, 2);
  assert.match(texte(lignes[0]), /ELEMENT_M1_TEST/);
  assert.match(texte(lignes[0]), /avant le service de midi · jour même/);
  assert.match(texte(lignes[0]), /\d/, 'la quantité est affichée');
  assert.equal(parClasse(lignes[0], 'sem-qte-ligne').length, 1, 'la quantité porte la classe en police des quantités');
  assert.match(texte(lignes[1]), /hors règle/);
  assert.match(texte(lignes[1]), /J-4/);
  assert.match(texte(lignes[1]), /après le service de midi/);
  assert.equal(parClasse(n, 'sem-prod-hors-regle').length, 1);
  for (const l of lignes) {
    const mots = l.tous((x) => x.balise === 'button').map((x) => x.textContent);
    assert.ok(mots.includes('Déplacer'), 'Déplacer');
    assert.ok(mots.includes('Fait'), 'geste Fait');
  }
  assert.match(puceDe(n, 'Lundi').attributs['aria-label'], /hors règle/, 'le mot est dans l\'étiquette de la puce');
  assert.match(texte(parClasse(n, 'sem-cle')[0]), /hors règle/);
});

test('Déplacer ouvre le panneau « Reporter » ; Fait marque fait, puis « Corriger le réel » apparaît', async () => {
  const { e, m } = lundiAvecAvance();
  magasin.remplacer(e);
  let n = vue.rendre(magasin.etat(), S.lundi);
  await n.tous((x) => x.balise === 'button' && x.textContent === 'Déplacer')[0].click();
  assert.match(dom.corps.textContent, /Reporter/);
  await n.tous((x) => x.balise === 'button' && x.textContent === 'Fait')[0].click();
  assert.equal(magasin.etat().productions[principaleDe(magasin.etat(), m)].etat, 'fait');
  n = vue.rendre(magasin.etat(), S.lundi);
  assert.ok(n.tous((x) => x.balise === 'button').some((b) => b.textContent === 'Corriger le réel'));
  assert.equal(parClasse(n, 'sem-prod-fait').length, 1);
});

test('bandeau : points à confirmer existants avec « Voir » ; le mardi, la revue de mi-semaine', () => {
  magasin.remplacer(semaine());
  const lundi = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.match(texte(lundi), /\d+ points? à confirmer ce jour-là/);
  assert.ok(parClasse(lundi, 'sem-banniere-confirmer')[0].tous((x) => x.balise === 'button').some((b) => b.textContent === 'Voir'));
  assert.match(texte(vue.rendre(magasin.etat(), dates.ajouterJours(S.lundiSuivant, 1))), /revue de mi-semaine/);
});

test('dimanche : fermé, dit en texte, sans services ni production', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), dates.ajouterJours(S.lundiSuivant, 6));
  assert.match(texte(n), /Fermé/);
  assert.equal(parClasse(n, 'sem-carte').length, 0);
  assert.equal(parClasse(n, 'sem-prod').length, 0);
});

test('samedi : pas de menu du jour, la production du jour reste dite', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), dates.ajouterJours(S.lundiSuivant, 5));
  assert.match(texte(n), /Pas de menu du jour/);
  assert.match(texte(n), /Aucune production décidée ce jour-là/);
});

test('rien ne disparaît : tout le détail du jour est dans des replis, fermés sous le résumé', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  const detail = n.tous((x) => x.attributs.id === 'detail-jour')[0];
  assert.equal(detail.balise, 'details');
  assert.equal(detail.open, false);
  const t = texte(detail);
  for (const attendu of ['Menus du jour', 'Couverts midi', 'Fiches de fonction', 'Allergies du jour', 'Créneaux du jour',
    'Après service', 'Points à confirmer', 'Modifier l\'intitulé', 'Ajouter un composant', 'Nouvelle fiche']) {
    assert.ok(t.includes(attendu), attendu);
  }
  for (const id of ['menus', 'previsions', 'fiches', 'allergies', 'creneaux', 'apres-service', 'points']) {
    const bloc = detail.tous((x) => x.attributs.id === id)[0];
    assert.ok(bloc, id);
    assert.equal(bloc.balise, 'details', `${id} est un repli`);
  }
  assert.ok(liens(n).includes(`#/production/${S.lundiSuivant}`), 'la feuille du jour reste à un lien');
});

test('identifiants : le résumé et le détail ne partagent aucun identifiant', () => {
  magasin.remplacer(semaine());
  const ids = vue.rendre(magasin.etat(), S.lundiSuivant).tous((x) => x.attributs.id).map((x) => x.attributs.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('semaine globale : sans date ou /tableau, l\'ancien tableau restylé, avec le lien d\'import', () => {
  magasin.remplacer(semaine());
  for (const [param, sous] of [[null, undefined], [S.lundiSuivant, 'tableau']]) {
    const n = vue.rendre(magasin.etat(), param, sous);
    assert.equal(n.className, 'vue-semaine-globale');
    assert.match(texte(n), /Menus de la semaine/);
    assert.doesNotMatch(texte(n), /Importer les menus|Proposer un planning/, 'les actions sont dans la feuille « ⋯ »');
    assert.equal(parClasse(n, 'sa-actions')[0].attributs['aria-label'], 'Actions de la semaine');
    assert.ok(liens(n).some((l) => l.startsWith('#/semaine/')), 'les jours mènent au détail');
  }
});

test('le routeur envoie les anciennes adresses vers cet écran', () => {
  assert.deepEqual(routeur.analyserHash(`#/detail/${S.lundiSuivant}`, S.samedi), { vue: 'semaine', param: S.lundiSuivant });
  assert.equal(routeur.analyserHash(`#/semaine/${S.lundiSuivant}/tableau`, S.samedi).sous, 'tableau');
});

test('puces : « ? » à confirmer quand le jour a un point à confirmer, dit en toutes lettres pour les lecteurs d\'écran', () => {
  magasin.remplacer(semaine()); // menu 2 saisi sans prévision : un point à confirmer le lundi
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.match(puceDe(n, 'Lundi').attributs['aria-label'], /^Lundi.*à confirmer/);
  assert.deepEqual(parClasse(puceDe(n, 'Lundi'), 'sem-signe').map(texte), ['?']);
  assert.match(texte(parClasse(n, 'sem-cle')[0]), /à confirmer : point en attente/);
});

test('couverts midi saisis : la certitude est « provisoire » et ne laisse pas d\'« estimée 0 » ; une prévision estimée à 0 se dit « estimée 0 »', async () => {
  const { definirCouvertsMidi } = await import('../app/js/domaine/actions-couverts.js');
  const e = semaine();
  definirCouvertsMidi(e, S.lundiSuivant, { total: 60 }, horo());
  magasin.remplacer(e);
  const t = texte(vue.rendre(magasin.etat(), S.lundiSuivant));
  assert.match(t, /provisoire 20/);
  assert.match(t, /provisoire 40/);
  assert.doesNotMatch(t, /estimée 0/);
  const zero = semaine();
  actions.definirPrevision(zero, S.lundiSuivant, 2, 0, horo());
  magasin.remplacer(zero);
  assert.match(texte(vue.rendre(magasin.etat(), S.lundiSuivant)), /estimée 0/);
});

test('bouton « ⋯ » : la feuille propose Importer les menus et Proposer un planning', async () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  const boutons = parClasse(n, 'sa-actions');
  assert.equal(boutons.length, 1);
  assert.equal(boutons[0].textContent, '⋯');
  await boutons[0].click();
  const feuille = dom.document.body.tous((x) => x.className.split(' ').includes('sa-action'));
  assert.deepEqual(feuille.map((x) => x.textContent), ['Importer les menus', 'Proposer un planning']);
  assert.equal(feuille[0].attributs.href, `#/import/${S.lundiSuivant}`);
});

test('Semaine : couverts en lecture seule, lien « Production du jour › »', () => {
  magasin.remplacer(semaine());
  const n = vue.rendre(magasin.etat(), S.lundiSuivant);
  assert.doesNotMatch(texte(n), /Saisir les couverts|Modifier les couverts|Voir la feuille du jour/);
  assert.ok(liens(n).includes(`#/production/${S.lundiSuivant}`));
  assert.match(texte(n), /Production du jour ›/);
});
