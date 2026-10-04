// Feuille « À décider » (refonte 1, maquette Exceptions) : données pures (domaine/decisions.js) et feuille <dialog> sous
// faux DOM. Faux DOM : ni mise en page, ni Échap réel, ni focus réel (à vérifier à l'écran à 390 px, clair et sombre).
// Jeux TEST_ONLY.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { creerFiche, deciderEcart, definirMenu, definirPrevision, definirStandard, marquerFait, planifier } from '../app/js/domaine/actions.js';
import { composantVide } from '../app/js/domaine/etat.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { decisionsDe, decisionsDuJour, POINTS_SANS_DECISION, texteDecisions } from '../app/js/domaine/decisions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let feuille;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  feuille = await import('../app/js/ui/feuille-decisions.js');
});
after(() => dom.restaurer());

const calme = (e) => { e.reglages.semaineTypeConfirmee = true; return e; };
const genres = (e, date = S.lundi) => decisionsDe(e, date).cartes.map((c) => c.genre);
const nettoyer = () => { for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove(); };
const ouverts = () => panneauxOuverts(dom.corps);
const classes = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const parTexte = (noeud, re) => boutons(noeud).find((b) => re.test(b.textContent));
const h2 = (noeuds) => {
  const p = globalThis.document.createElement('div');
  for (const n of noeuds) p.appendChild(n);
  return p;
};
function aDate(iso, fonction) {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T10:00:00`])); }
  };
  try { return fonction(); } finally { globalThis.Date = reelle; }
}

function avecRepartition() {
  const e = calme(etatVide());
  creerFiche(e, { numero: 'F_LIBRE', date: S.mercredi, service: 'midi', horaire: '12:30', couverts: 6, mode: 'choix_libre', repartition: { 1: 4, 2: 2 } }, h());
  return e;
}
function avecSauce() {
  const e = calme(etatVide());
  definirMenu(e, S.mercredi, 1, 'Penne aux courgettes', h());
  return e;
}
function avecApprentissage() {
  const e = calme(etatVide());
  [['2026-10-01', 80], ['2026-10-02', 90], ['2026-10-05', 86]].forEach(([date, valeur], i) => {
    e.composants[`c${i}`] = { ...composantVide(`c${i}`), date, menu: 2, nom: 'riz', categorie: 'feculent', famille: 'riz', role: 'garniture',
      attribue: true, valide: true, grammage: { valeur, unite: 'g', etat: 'sec', statut: 'RESTAURANT_VALIDE', source: 'corrigé pour ce plat' } };
  });
  return e;
}
/** Carottes du vendredi planifiées le lundi : 4 jours d'avance, sans règle qui le permette (hors règle). */
function avecAvanceHorsRegle() {
  const e = calme(etatVide());
  definirMenu(e, S.vendredi, 1, 'carottes', h());
  definirPrevision(e, S.vendredi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, 'avant_midi', h());
  return { e, p };
}
/** Carottes du lundi faites à une autre quantité que la cible : écart à arbitrer. */
function avecEcart() {
  const e = calme(etatVide());
  definirMenu(e, S.lundi, 1, 'carottes', h());
  definirPrevision(e, S.lundi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.lundi, 'avant_midi', h());
  marquerFait(e, p.id, 1000, h());
  return { e, p };
}

test('données : rien à décider = aucune carte', () => {
  const e = calme(etatVide());
  assert.deepEqual(decisionsDe(e, S.lundi), { total: 0, cartes: [] });
});

test('données : une quantité absente n\'est jamais une décision (portion à saisir, prévision manquante, à préciser)', () => {
  const e = calme(etatVide());
  definirMenu(e, S.lundi, 1, 'carottes', h()); // aucune prévision, aucune portion connue
  const bruts = pointsAConfirmer(e, S.lundi).map((p) => p.type);
  assert.ok(bruts.includes('prevision_manquante') || bruts.includes('grammage'), 'le cas existe bien parmi les points « À confirmer »');
  const types = decisionsDe(e, S.lundi).cartes.filter((c) => c.genre === 'point').map((c) => c.type);
  for (const t of POINTS_SANS_DECISION) assert.ok(!types.includes(t), t);
  assert.deepEqual([...POINTS_SANS_DECISION].sort(), ['composant_a_preciser', 'grammage', 'prevision_manquante']);
  for (const c of decisionsDe(e, S.lundi).cartes) assert.doesNotMatch(c.texte ?? '', /portion à saisir|prévision hors groupes|à préciser/);
});

test('données : écart, avance hors règle, sauce, répartition provisoire, apprentissage ont chacun leur carte', () => {
  const { e: ecart, p } = avecEcart();
  const c = decisionsDe(ecart, S.lundi).cartes.find((x) => x.genre === 'ecart');
  assert.ok(c, 'écart');
  assert.equal(c.productionId, p.id);
  assert.equal(c.reel, 1000);
  const { e: avance, p: pa } = avecAvanceHorsRegle();
  const a = decisionsDe(avance, S.lundi).cartes.find((x) => x.genre === 'avance_hors_regle');
  assert.ok(a, 'avance hors règle');
  assert.equal(a.productionId, pa.id);
  assert.equal(a.jours, 4);
  assert.ok(genres(avecSauce(), S.lundi).includes('sauce'));
  assert.ok(genres(avecRepartition(), S.lundi).includes('repartition'));
  assert.ok(genres(avecApprentissage(), S.lundi).includes('apprentissage'));
});

test('données : le point global « semaine type à confirmer » est une carte tant qu\'il n\'est pas réglé', () => {
  const e = etatVide();
  const c = decisionsDe(e, S.lundi).cartes.find((x) => x.type === 'semaine_type');
  assert.ok(c);
  assert.equal(c.genre, 'point');
});

test('données : l\'ordre suit les genres (sauce avant répartition)', () => {
  const e = avecRepartition();
  definirMenu(e, S.mercredi, 1, 'Penne aux courgettes', h());
  const g = genres(e);
  assert.ok(g.indexOf('sauce') < g.indexOf('repartition'));
});

test('feuille : « À décider », sous-titre, état vide « Tout est réglé », <dialog> avec Fermer et OK', () => {
  nettoyer();
  magasin.remplacer(calme(etatVide()));
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const [d] = ouverts();
  assert.ok(d, 'feuille ouverte');
  assert.equal(d.balise, 'dialog');
  assert.match(d.className, /feuille-decisions/);
  assert.equal(d.querySelector('h2').textContent, 'À décider');
  assert.match(d.textContent, /Sanji a tranché le reste\. Ici, c'est vous qui décidez\./);
  assert.match(d.textContent, /Tout est réglé/);
  assert.equal(classes(d, 'dec-carte').length, 0);
  assert.deepEqual(boutons(d).map((b) => b.textContent), ['OK', 'Fermer']);
  d.close();
});

test('feuille : une seule feuille à la fois, Fermer la ferme, on peut la rouvrir', () => {
  nettoyer();
  magasin.remplacer(calme(etatVide()));
  aDate(S.lundi, () => { feuille.ouvrirDecisions(); feuille.ouvrirDecisions(); });
  assert.equal(ouverts().length, 1);
  parTexte(ouverts()[0], /^Fermer$/).click();
  assert.equal(ouverts().length, 0);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  assert.equal(ouverts().length, 1);
  parTexte(ouverts()[0], /^Fermer$/).click();
});

test('feuille : écart à arbitrer = « Décider » ouvre le panneau Complément / Ajustement / Aucune production supplémentaire', () => {
  nettoyer();
  const { e } = avecEcart();
  magasin.remplacer(e);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const [d] = ouverts();
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'ecart');
  assert.ok(carte);
  assert.match(carte.textContent, /Écart à arbitrer/);
  assert.match(carte.textContent, /réel/);
  parTexte(carte, /^Décider$/).click();
  const ouvertsApres = ouverts();
  assert.equal(ouvertsApres.length, 2, 'le panneau de décision s\'ouvre par-dessus la feuille');
  const texte = ouvertsApres[1].textContent;
  for (const mot of ['Complément', 'Ajustement', 'Aucune production supplémentaire']) assert.match(texte, new RegExp(mot));
  ouvertsApres[1].close();
  d.close();
});

test('feuille : avance hors règle écrite « hors règle », « Replanifier » ouvre le panneau de planification existant', () => {
  nettoyer();
  const { e } = avecAvanceHorsRegle();
  magasin.remplacer(e);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const [d] = ouverts();
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'avance_hors_regle');
  assert.ok(carte);
  assert.match(carte.textContent, /Avance hors règle/);
  assert.match(carte.textContent, /hors règle : avance de 4 jours/);
  aDate(S.lundi, () => parTexte(carte, /^Replanifier$/).click());
  assert.equal(ouverts().length, 2);
  ouverts()[1].close();
  d.close();
});

test('feuille : sauce à confirmer = « Choisir la sauce » ouvre le panneau existant ; valider la sauce retire la carte', async () => {
  nettoyer();
  magasin.remplacer(avecSauce());
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const [d] = ouverts();
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'sauce');
  assert.ok(carte);
  parTexte(carte, /^Choisir la sauce$/).click();
  const panneau = ouverts()[1];
  assert.match(panneau.textContent, /Choisir la sauce/);
  const libre = panneau.tous((x) => x.balise === 'input' && x.attributs.type === 'text')[0];
  libre.value = 'sauce maison';
  aDate(S.lundi, () => {});
  await aDate(S.lundi, () => panneau.querySelector('form').declencher('submit'));
  assert.equal(classes(d, 'dec-carte').filter((c) => c.dataset.genre === 'sauce').length, 0, 'la feuille se met à jour');
  d.close();
});

test('feuille : répartition provisoire = « Confirmer la répartition » ouvre le panneau existant', () => {
  nettoyer();
  magasin.remplacer(avecRepartition());
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const d = ouverts()[0];
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'repartition');
  assert.ok(carte);
  assert.match(carte.textContent, /Répartition provisoire/);
  parTexte(carte, /^Confirmer la répartition$/).click();
  assert.equal(ouverts().length, 2);
  ouverts()[1].close();
  d.close();
});

test('feuille : apprentissage = « Examiner » ouvre la proposition ; « Non, garder » l\'écarte et la carte disparaît', () => {
  nettoyer();
  magasin.remplacer(avecApprentissage());
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const d = ouverts()[0];
  const carte = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'apprentissage');
  assert.ok(carte);
  parTexte(carte, /^Examiner$/).click();
  const proposition = ouverts()[1];
  assert.ok(parTexte(proposition, /^Non, garder$/) && parTexte(proposition, /En faire mon standard/));
  proposition.close();
  aDate(S.lundi, () => parTexte(carte, /^Non, garder$/).click());
  assert.equal(classes(d, 'dec-carte').filter((c) => c.dataset.genre === 'apprentissage').length, 0);
  assert.ok(magasin.etat().validations['apprentissage:riz|garniture'], 'la proposition est mémorisée comme écartée');
  d.close();
});

test('feuille : accessibilité (étiquette écrite, icônes cachées, zone annoncée)', () => {
  nettoyer();
  const { e } = avecAvanceHorsRegle();
  magasin.remplacer(e);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const d = ouverts()[0];
  assert.ok(classes(d, 'dec-carte').length > 0);
  for (const carte of classes(d, 'dec-carte')) {
    assert.equal(classes(carte, 'dec-etiquette').length, 1, 'étiquette écrite');
    assert.ok(carte.tous((x) => x.balise === 'svg').every((s) => s.attributs['aria-hidden'] === 'true'));
  }
  assert.equal(d.tous((x) => x.attributs['aria-live'] === 'polite').length, 1);
  d.close();
});

test('feuille : un lien ferme la feuille avant de changer de page', () => {
  nettoyer();
  const { e } = avecEcart();
  magasin.remplacer(e);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const d = ouverts()[0];
  const lien = d.tous((x) => x.balise === 'a' && /^#\/fiche\//.test(x.attributs.href))[0];
  assert.ok(lien);
  lien.click();
  assert.equal(ouverts().length, 0);
});

test('feuille : la classe RENDUE des gestes est « dec-btn » (jamais « btn-dec-btn »), le geste principal garde « btn-decision »', () => {
  for (const [nom, e, date] of [['écart', avecEcart().e, S.lundi], ['apprentissage', avecApprentissage(), S.lundi], ['sauce', avecSauce(), S.lundi],
    ['avance', avecAvanceHorsRegle().e, S.lundi], ['répartition', avecRepartition(), S.lundi]]) {
    const noeud = aDate(date, () => h2(feuille.contenuDecisions(e, date)));
    const gestes = noeud.tous((x) => x.balise === 'button' || (x.balise === 'a' && x.className.includes('dec-btn')));
    assert.ok(gestes.length > 0, nom);
    for (const g of gestes) {
      const cl = g.className.split(' ');
      assert.ok(cl.includes('dec-btn'), `${nom} : « ${g.textContent} » porte dec-btn (${g.className})`);
      assert.ok(!cl.includes('btn-dec-btn'), `${nom} : « ${g.textContent} » ne porte pas btn-dec-btn`);
    }
    assert.ok(gestes.some((g) => g.className.split(' ').includes('btn-decision')), `${nom} : un geste principal`);
  }
});

test('style et source : cibles de 44 px, quantités en police des quantités, mouvement réduit, bloc en fin de fichier', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const bloc = css.slice(css.indexOf('/* ===== Écran À décider (refonte 1'));
  assert.ok(bloc.length > 0);
  assert.match(bloc, /\.dec-btn \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.dec-qte \{[^}]*var\(--police-qte\)/);
  assert.match(bloc, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(bloc, /font-size:\s*(1[0-2]|[0-9])px/);
  const src = readFileSync(new URL('../app/js/ui/feuille-decisions.js', import.meta.url), 'utf8');
  for (const interdit of ['Plus tard', 'en stock', 'minuteur', 'température']) assert.ok(!src.includes(interdit), interdit);
  const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("'js/domaine/decisions.js'"));
});

test('B1 : le dimanche, la semaine suivante est regardée (sauces, répartitions, avances du lundi au samedi)', () => {
  const e = avecRepartition(); // fiche du mercredi 7/10
  definirMenu(e, S.lundi, 1, 'Penne aux courgettes', h()); // sauce implicite du lundi 5/10
  const g = genres(e, S.dimanchePrecedent);
  assert.ok(g.includes('sauce'), 'sauce du lundi suivant');
  assert.ok(g.includes('repartition'), 'répartition du mercredi suivant');
  const lundi = genres(e, S.lundi);
  assert.ok(lundi.includes('sauce') && lundi.includes('repartition'), 'même contenu le lundi');
  // un samedi ne regarde pas encore la semaine d'après
  const eSemaineApres = calme(etatVide());
  definirMenu(eSemaineApres, S.lundiSuivant, 1, 'Penne aux courgettes', h());
  assert.equal(genres(eSemaineApres, S.samedi ?? '2026-10-10').includes('sauce'), false);
  assert.equal(genres(eSemaineApres, S.dimanche).includes('sauce'), true);
});

test('B1 : le dimanche, une avance hors règle pour le lundi suivant apparaît', () => {
  const e = calme(etatVide());
  definirMenu(e, S.mardi, 1, 'carottes', h());
  definirPrevision(e, S.mardi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  const p = Object.values(e.productions).find((x) => x.genre === 'principale');
  planifier(e, p.id, S.veille, 'avant_midi', h());
  // même carte qu'en semaine : visible seulement si l'avance est hors règle
  const brut = pointsAConfirmer(e, S.mardi).some((x) => x.type === 'avance_hors_regle');
  assert.equal(genres(e, S.dimanchePrecedent).includes('avance_hors_regle'), brut);
});

test('B1 bis : un écart à arbitrer est une décision, aussi le dimanche et pour un jour passé ; décidé, il disparaît', () => {
  const { e, p } = avecEcart();
  for (const jour of [S.lundi, S.mardi, S.dimanche]) {
    const cartes = decisionsDe(e, jour).cartes.filter((c) => c.genre === 'ecart');
    assert.equal(cartes.length, jour === S.dimanche ? 1 : 1, jour);
  }
  assert.equal(decisionsDe(e, S.lundi).total, 1);
  deciderEcart(e, p.id, 'ajustement', h());
  assert.equal(decisionsDe(e, S.lundi).total, 0);
  assert.equal(decisionsDe(e, S.dimanche).total, 0);
});

test('un même écart n\'est jamais compté deux fois : principale et complément faites, prévision changée = une seule carte par composant, et une décision règle le composant', () => {
  const { e, p } = avecEcart();
  const { complement } = deciderEcart(e, p.id, 'complement', h());
  planifier(e, complement.id, S.lundi, 'avant_midi', h());
  marquerFait(e, complement.id, undefined, h()); // la cible du complément, soit exactement le manque
  const cartesEcart = () => decisionsDe(e, S.lundi).cartes.filter((c) => c.genre === 'ecart');
  assert.equal(cartesEcart().length, 0, 'le complément couvre le besoin');
  definirPrevision(e, S.lundi, 1, 40, h());
  const apres = cartesEcart();
  assert.equal(apres.length, 1, 'deux productions faites, un seul écart du composant');
  assert.ok(apres[0].ecart > 0);
  deciderEcart(e, apres[0].productionId, 'aucune', h());
  assert.equal(cartesEcart().length, 0, 'décider une fois règle le composant');
  assert.equal(decisionsDe(e, S.lundi).total, 0);
});

test('compte unique : decisionsDuJour = les cartes datées du jour, texteDecisions dit « décision(s) à prendre »', () => {
  const { e } = avecEcart();
  definirMenu(e, S.mercredi, 1, 'Penne aux courgettes', h());
  assert.equal(decisionsDuJour(e, S.lundi).total, 1);
  assert.equal(decisionsDuJour(e, S.mercredi).cartes[0].genre, 'sauce');
  assert.equal(decisionsDuJour(e, S.jeudi).total, 0);
  assert.equal(texteDecisions(1), '1 décision à prendre');
  assert.equal(texteDecisions(3), '3 décisions à prendre');
});

test('feuille : un écart compte, la feuille ne dit pas « Tout est réglé » ; elle reste ouverte après une décision jusqu\'à OK', () => {
  nettoyer();
  const { e } = avecEcart();
  definirMenu(e, S.lundi, 2, 'Penne aux courgettes', h());
  magasin.remplacer(e);
  aDate(S.lundi, () => feuille.ouvrirDecisions());
  const d = ouverts()[0];
  assert.doesNotMatch(d.textContent, /Tout est réglé/);
  assert.match(d.textContent, /décisions? à prendre/);
  assert.match(d.textContent, /ajustement \(/);
  // une décision (sauce choisie) : la feuille reste ouverte et se met à jour
  const sauce = classes(d, 'dec-carte').find((c) => c.dataset.genre === 'sauce');
  if (sauce) {
    magasin.agir((x) => { Object.values(x.composants).forEach((c) => { c.sauceAConfirmer = false; }); });
  }
  const p = Object.values(magasin.etat().productions).find((x) => x.genre === 'principale' && x.etat === 'fait');
  aDate(S.lundi, () => magasin.agir((x, t) => deciderEcart(x, p.id, 'aucune', t)));
  assert.equal(ouverts().length, 1, 'toujours ouverte');
  assert.equal(classes(d, 'dec-carte').filter((c) => c.dataset.genre === 'ecart').length, 0);
  parTexte(d, /^OK$/).click();
  assert.equal(ouverts().length, 0, 'OK ferme');
});
