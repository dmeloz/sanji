// Écran Stock de la refonte 1 (vue-stock.js) sous faux DOM : sélecteur, Restes, DLC, Achats.
// Faux DOM : ni mise en page ni navigateur (à vérifier à l'écran à 390 px, clair et sombre).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutons, installerFauxDom } from './aide-dom.js';
import { definirMenu, definirRegle, marquerFait } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { composantValide, etatVide, h, menuValide, prevision, principaleDe } from './aide.js';

let dom;
let magasin;
let stock;
let horsligne;

before(async () => {
  dom = installerFauxDom();
  horsligne = await import('../app/js/ui/horsligne.js');
  magasin = await import('../app/js/magasin.js');
  stock = await import('../app/js/ui/vue-stock.js');
});
after(() => dom.restaurer());

const parTexte = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const parClasse = (noeud, classe) => noeud.tous((x) => x.className.split(' ').includes(classe));
const controleDe = (racine, libelle) => {
  const etiquette = racine.tous((x) => x.balise === 'label' && x.textContent === libelle)[0];
  assert.ok(etiquette, `champ « ${libelle} » introuvable`);
  return racine.tous((x) => x.attributs.id === etiquette.attributs.for)[0];
};
const dateDuJour = (jour, fonction) => {
  const original = Date;
  const [a, m, j] = jour.split('-').map(Number);
  globalThis.Date = class extends original { constructor(...x) { super(...(x.length ? x : [a, m - 1, j, 9, 0, 0])); } };
  try { return fonction(); } finally { globalThis.Date = original; }
};
// Restes ouvre le jour courant : sans date figée, ces tests dépendent du jour où on les lance (la fixture met les menus le lundi).
const rendreRestes = () => dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'restes'));

function mondeRestes() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  magasin.remplacer(e);
  return Object.values(magasin.etat().composants).find((c) => c.famille === 'riz').id;
}

test('en-tête : titre Stock, sans état hors ligne quand tout est normal, sélecteur à trois liens, vue active marquée en texte et en attribut', () => {
  magasin.remplacer(etatVide());
  for (const sous of stock.SOUS_VUES) {
    const page = stock.rendre(magasin.etat(), S.lundi, sous);
    assert.match(page.querySelector('h1').textContent, /^Stock$/);
    // Montrer l'exception : la vérification en cours (ici) ou le « prêt » ne s'affichent pas ; seul un problème s'écrit (problemeHorsLigne).
    assert.equal(horsligne.problemeHorsLigne(), null);
    assert.equal(parClasse(page, 'stock-horsligne').length, 0);
    assert.doesNotMatch(page.textContent, /hors ligne/);
    assert.doesNotMatch(page.textContent, /synchronis|en stock/i);
    const liens = parClasse(page, 'stock-segment');
    assert.deepEqual(liens.map((a) => a.attributs.href), stock.SOUS_VUES.map((v) => `#/stock/${v}/${S.lundi}`));
    assert.deepEqual(liens.map((a) => a.textContent), ['Restes', 'DLC', 'Achats']);
    assert.deepEqual(liens.filter((a) => a.attributs['aria-current'] === 'page').map((a) => a.textContent), [{ restes: 'Restes', dlc: 'DLC', achats: 'Achats' }[sous]]);
  }
  assert.match(stock.titre(S.lundi, 'dlc'), /DLC/);
  assert.match(stock.titre(S.lundi), /Achats/);
});

test('restes : ventes par menu, surplus, rebut et note d\'un seul « Enregistrer » ; recalcul automatique, pas de « recalculer demain »', () => {
  const id = mondeRestes();
  const page = rendreRestes();
  assert.doesNotMatch(page.textContent, /recalculer|demain/i);
  assert.ok(parTexte(page, 'Enregistrer'));
  controleDe(page, 'Ventes du menu 1 (portions)').value = '31';
  controleDe(page, 'Ventes du menu 2 (portions)').value = '12';
  controleDe(page, 'Surplus utilisable (g)').value = '300';
  controleDe(page, 'Rebut (g)').value = '50';
  controleDe(page, 'Note').value = 'trop cuit';
  parTexte(page, 'Enregistrer').click();
  const e = magasin.etat();
  assert.deepEqual([e.jours[S.lundi].ventes[1], e.jours[S.lundi].ventes[2]], [31, 12]);
  assert.deepEqual(e.composants[id].apresService, { surplus: 300, rebut: 50, note: 'trop cuit' });
  const apres = rendreRestes();
  assert.equal(controleDe(apres, 'Surplus utilisable (g)').value, '300', 'la saisie enregistrée est reprise');
});

test('restes : une valeur illisible est refusée sans rien écrire ; vider un champ efface la valeur', () => {
  const id = mondeRestes();
  const page = rendreRestes();
  controleDe(page, 'Surplus utilisable (g)').value = 'beaucoup';
  parTexte(page, 'Enregistrer').click();
  assert.equal(magasin.etat().composants[id].apresService.surplus, null);
  magasin.agir((e) => { e.composants[id].apresService = { surplus: 100, rebut: null, note: '' }; });
  const p2 = rendreRestes();
  controleDe(p2, 'Surplus utilisable (g)').value = '';
  parTexte(p2, 'Enregistrer').click();
  assert.equal(magasin.etat().composants[id].apresService.surplus, null);
});

test('restes : le jour se choisit parmi lundi à samedi (cibles d\'au moins un bouton par jour), le samedi n\'a pas de ventes par menu', () => {
  mondeRestes();
  const page = rendreRestes();
  const puces = parClasse(page, 'stock-jour');
  assert.equal(puces.length, 6);
  assert.deepEqual(puces.map((b) => b.attributs['aria-pressed']), ['true', 'false', 'false', 'false', 'false', 'false']);
  puces[5].click();
  assert.match(page.textContent, /samedi 10 octobre/);
  assert.match(page.textContent, /Pas de menu du jour le samedi/);
  assert.equal(parClasse(page, 'stock-jour')[5].attributs['aria-pressed'], 'true');
  stock.rendre(magasin.etat(), S.lundi, 'achats'); // quitter les restes oublie le jour choisi
  const retour = rendreRestes();
  assert.equal(parClasse(retour, 'stock-jour')[0].attributs['aria-pressed'], 'true');
});

test('restes : aujourd\'hui est le jour par défaut quand il est dans la semaine', () => {
  mondeRestes();
  const page = dateDuJour(S.mercredi, () => stock.rendre(magasin.etat(), S.lundi, 'restes'));
  assert.match(page.textContent, /Aujourd'hui · mercredi 7 octobre/);
});

test('restes : la quantité prévue vient du calcul et se lit en mono ; une quantité absente n\'est ni une alerte ni une décision', () => {
  mondeRestes();
  const page = rendreRestes();
  assert.match(page.textContent.replace(/[\u202f\u00a0]/g, ' '), /prévu 2400 g/, 'quatre chiffres : pas de groupement des milliers');
  assert.ok(parClasse(page, 'stock-qte').length > 0);
  assert.equal(page.tous((x) => x.attributs.role === 'alert').length, 0);
  magasin.remplacer(etatVide());
  const vide = rendreRestes();
  assert.match(vide.textContent, /Aucun composant au poste/);
  assert.equal(vide.tous((x) => x.attributs.role === 'alert').length, 0);
});

test('dlc : productions faites regroupées Aujourd\'hui, Demain, Plus tard, avec date de production et conservation du référentiel', () => {
  const e = etatVide();
  menuValide(e, S.lundi, 1, 'INTITULE_TEST_1');
  prevision(e, S.lundi, 1, 40);
  menuValide(e, S.mardi, 1, 'INTITULE_TEST_1');
  prevision(e, S.mardi, 1, 40);
  menuValide(e, S.vendredi, 1, 'INTITULE_TEST_1');
  prevision(e, S.vendredi, 1, 40);
  const ids = [S.lundi, S.mardi, S.vendredi].map((d, i) => composantValide(e, d, 1, J.PRODUIT_SEC_TEST, { nom: `ELEMENT_DLC_${i}_TEST` }));
  for (const id of ids) marquerFait(e, principaleDe(e, id), 2400, h());
  magasin.remplacer(e);
  const page = dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc'));
  assert.deepEqual(parClasse(page, 'stock-groupe-titre').map((t) => t.textContent), ["Aujourd'hui", 'Demain', 'Plus tard']);
  assert.match(page.textContent, /ELEMENT_DLC_0_TEST/);
  assert.match(page.textContent, /produit le jeudi 1er octobre/);
  assert.match(parClasse(page, 'stock-groupe')[2].textContent, /pour le service du vendredi 9 octobre/);
  assert.match(page.textContent.replace(/[\u202f\u00a0]/g, ' '), /2400 g/);
  assert.doesNotMatch(page.textContent, /en stock|lot |frigo|chambre froide|température/i);
});

test('dlc : avance hors règle et limite dépassée sont dites en toutes lettres (jamais la couleur seule)', () => {
  const e = etatVide();
  menuValide(e, S.vendredi, 1, 'INTITULE_TEST_1');
  prevision(e, S.vendredi, 1, 40);
  const id = composantValide(e, S.vendredi, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_LIMITE_TEST' });
  definirRegle(e, { nom: 'ELEMENT_LIMITE_TEST', avanceMaxJours: 2, limiteUtilisationJours: 0 }, h());
  marquerFait(e, principaleDe(e, id), 2400, h());
  magasin.remplacer(e);
  const page = dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc'));
  const texte = page.textContent;
  assert.match(texte, /hors règle/);
  assert.match(texte, /limite d'utilisation dépassée/);
  assert.ok(parClasse(page, 'stock-dlc-alerte').length === 1);
});

test('dlc : sans production faite, une ligne neutre ; une production d\'hier pour un service passé n\'apparaît pas', () => {
  magasin.remplacer(etatVide());
  assert.match(dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc')).textContent, /Aucune production faite/);
  const e = etatVide();
  menuValide(e, S.veille, 1, 'INTITULE_TEST_1');
  prevision(e, S.veille, 1, 40);
  const id = composantValide(e, S.veille, 1, J.PRODUIT_SEC_TEST, { nom: 'ELEMENT_PASSE_TEST' });
  marquerFait(e, principaleDe(e, id), 2400, h());
  magasin.remplacer(e);
  assert.doesNotMatch(dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc')).textContent, /ELEMENT_PASSE_TEST/);
});

test('achats : cartes par fournisseur, « Imprimer la liste », « vérifié disponible », besoin et quantité proposée, jamais « en stock »', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  magasin.remplacer(e);
  const page = stock.rendre(magasin.etat(), S.lundi, 'achats');
  assert.ok(parTexte(page, 'Imprimer la liste'));
  assert.doesNotMatch(page.textContent, /bon de commande|en stock/i);
  const groupes = parClasse(page, 'produits-groupe');
  assert.equal(groupes.length, 1);
  assert.match(groupes[0].textContent, /Fournisseur non précisé/);
  const resume = parClasse(page, 'produit-resume')[0];
  // Adapté (audit v56) : l'état attendu ne s'écrit pas sur la ligne ; il est dit une fois dans l'en-tête.
  assert.doesNotMatch(resume.textContent, /disponible : à vérifier|suggéré|non vérifié|proposé|besoin/);
  assert.equal(parClasse(page, 'achats-regle').length, 1, 'phrase d\'en-tête une seule fois');
  assert.equal(parClasse(page, 'achats-regle')[0].textContent, 'Disponible à vérifier · quantités proposées avec la marge');
  assert.doesNotMatch(page.textContent, /vérifié disponible · /, 'plus de contradiction dans le sous-titre');
  assert.equal(parClasse(page, 'produit-marque').length, 0, 'aucun glyphe « O » sur une ligne ordinaire');
  assert.match(parClasse(page, 'stock-legende').map((x) => x.textContent).join('|'), /Aucun stock théorique, aucun approvisionnement garanti\./);
  assert.equal(parClasse(page, 'nav-semaine').length, 1, 'semaine par flèches');
  assert.deepEqual(parClasse(page, 'btn-fleche').map((a) => a.textContent), ['‹', '›']);
  const chiffre = parClasse(resume, 'produit-chiffre')[0].textContent.replace(/[\u202f\u00a0]/g, ' ');
  assert.equal(chiffre, '2400 g', 'la quantité proposée (besoin avec marge) remplace le « – »');
  assert.match(resume.textContent, /standard de base/, 'provenance inhabituelle : visible');
  assert.ok(parClasse(resume, 'produit-chiffre').length === 1);
  assert.equal(page.querySelector('h1').textContent, 'Stock', 'un seul titre de page : celui de l\'écran Stock');
  assert.equal(page.tous((x) => x.balise === 'h1').length, 1);
});

test('achats : après contrôle d\'une quantité vérifiée, la quantité proposée à commander s\'affiche à droite', async () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  prevision(e, S.lundi, 2, 40);
  const { controlerProduit } = await import('../app/js/domaine/actions.js');
  controlerProduit(e, S.lundi, 'riz', 'g', 'a_commander', 400, h());
  magasin.remplacer(e);
  const page = stock.rendre(magasin.etat(), S.lundi, 'achats');
  const resume = parClasse(page, 'produit-resume')[0];
  assert.match(resume.textContent.replace(/[\u202f\u00a0]/g, ' '), /vérifié disponible : 400 g/);
  // Le besoin (2 400 g) diffère de la quantité proposée (2 000 g) : il s'écrit, avec le disponible vérifié.
  assert.match(resume.textContent, /^riz.*besoin/);
  assert.match(resume.textContent, /standard de base/);
  assert.equal(parClasse(resume, 'produit-chiffre')[0].textContent.replace(/[\u202f\u00a0]/g, ' '), '2000 g');
  assert.match(parClasse(resume, 'produit-chiffre')[0].textContent, /g$/);
});

test('route par défaut et liens : « achats » quand la sous-vue est inconnue', () => {
  magasin.remplacer(etatVide());
  const page = stock.rendre(magasin.etat(), S.lundi, 'inconnue');
  assert.equal(parClasse(page, 'stock-segment-actif')[0].textContent, 'Achats');
});

test('CSS : le bloc Stock est en fin de fichier, annoncé par un commentaire, avec la police des quantités et des cibles de 44 px', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const i = css.indexOf('/* ===== Écran Stock (refonte 1)');
  assert.ok(i > 0);
  const bloc = css.slice(i);
  assert.match(bloc, /\.stock-qte \{[^}]*var\(--police-qte\)/);
  assert.match(bloc, /\.produit-commande \.produit-chiffre \{[^}]*var\(--police-qte\)/);
  assert.match(bloc, /\.stock-segment \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /prefers-reduced-motion/);
  assert.doesNotMatch(bloc, /#[0-9a-fA-F]{3,6}\b/, 'jetons seulement, aucune couleur écrite en dur');
  assert.doesNotMatch(bloc, /font-size: ?(1[0-4]|[0-9])px/, 'texte de 15 px au moins, légendes de 13 px au moins');
});

// ---------------------------------------------------------------- audit v56 : montrer l'exception, pas la normalité

const sansEspaceFin = (t) => t.replace(/[  ]/g, ' ');

function mondeDeuxRestes() {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz, carottes', h());
  prevision(e, S.lundi, 2, 40);
  magasin.remplacer(e);
}

function mondeRizFait(jourService) {
  const e = etatVide();
  definirMenu(e, jourService, 2, 'riz', h());
  prevision(e, jourService, 2, 40);
  const riz = Object.values(e.composants).find((c) => c.famille === 'riz');
  marquerFait(e, principaleDe(e, riz.id), 2400, h()); // fait le 1er octobre (jeu de test)
  magasin.remplacer(e);
}

test('restes : une ligne par produit, « + Surplus / rebut » ouvre les champs au toucher, l\'aide du rebut une seule fois, Enregistrer en dernier', () => {
  mondeDeuxRestes();
  const page = rendreRestes();
  const lignes = parClasse(page, 'stock-reste');
  assert.ok(lignes.length >= 2);
  const ouvrir = parClasse(page, 'stock-reste-ouvrir');
  assert.equal(ouvrir.length, lignes.length);
  assert.ok(ouvrir.every((b) => b.textContent === '+ Surplus / rebut' && b.attributs['aria-expanded'] === 'false'));
  const champs = parClasse(page, 'stock-reste-champs');
  assert.ok(champs.every((c) => c.hidden === true), 'champs repliés tant qu\'aucune saisie n\'existe');
  assert.equal(page.textContent.split('Le rebut n\'est pas une perte normale').length - 1, 1, 'aide dite une seule fois');
  ouvrir[0].click();
  assert.equal(champs[0].hidden, false);
  assert.equal(ouvrir[0].attributs['aria-expanded'], 'true');
  ouvrir[0].click();
  assert.equal(champs[0].hidden, true);
  const cartes = parClasse(page, 'stock-carte');
  assert.ok(cartes[0].textContent.includes('Ventes du service'), 'ventes par menu en haut');
  const zone = parClasse(page, 'stock-restes-corps')[0];
  assert.equal(zone.enfants.at(-1).className, 'stock-valider', 'Enregistrer en bas, collant');
});

test('restes : la note saisie est affichée dans le résumé, pas seulement le mot « note »', () => {
  const id = mondeRestes();
  magasin.agir((e) => { e.composants[id].apresService = { surplus: 300, rebut: null, note: 'trop cuit, à servir demain' }; });
  const resume = sansEspaceFin(parClasse(rendreRestes(), 'stock-reste-resume')[0].textContent);
  assert.match(resume, /surplus 300 g · note : trop cuit, à servir demain/);
  magasin.agir((e) => { e.composants[id].apresService = { surplus: null, rebut: null, note: '   ' }; });
  assert.equal(parClasse(rendreRestes(), 'stock-reste-resume').length, 0, 'une note blanche ne dit rien');
});

test('restes : une saisie existante ouvre la ligne et reste résumée (exception visible)', () => {
  const id = mondeRestes();
  magasin.agir((e) => { e.composants[id].apresService = { surplus: 300, rebut: 50, note: '' }; });
  const page = rendreRestes();
  assert.equal(parClasse(page, 'stock-reste-champs')[0].hidden, false);
  assert.match(sansEspaceFin(parClasse(page, 'stock-reste-resume')[0].textContent), /surplus 300 g · rebut 50 g/);
  assert.equal(parClasse(page, 'stock-reste-ouvrir')[0].textContent, '− Surplus / rebut');
});

test('dlc : la date limite (production + durée connue) remplace « se garde N jours » seul ; une seule pastille « à lire » par ligne', () => {
  mondeRizFait(S.vendredi);
  const page = dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc'));
  assert.match(page.textContent, /à consommer avant le [a-zéû]+ \d+(er)? [a-zéû]+ · se garde 1 jour \(standard de base\)/);
  for (const carte of parClasse(page, 'stock-dlc')) {
    assert.ok(parClasse(carte, 'pastille').filter((p) => p.textContent === 'à lire').length <= 1);
  }
  assert.ok(parClasse(page, 'stock-dlc-nom').length > 0);
});

test('dlc : hors règle et avertissement sont gardés, avec une seule pastille « à lire » pour les deux', () => {
  mondeRizFait(S.vendredi);
  const page = dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc'));
  assert.match(page.textContent, /avertissement : avance de/);
  assert.equal(parClasse(page, 'pastille').filter((p) => p.textContent === 'à lire').length, 1);
});

test('onglet Stock : sans adresse précise, DLC s\'il y a à consommer en priorité, sinon Achats ; la sous-vue choisie est gardée', () => {
  stock.oublierSousVue();
  magasin.remplacer(etatVide());
  assert.equal(parClasse(stock.rendre(magasin.etat(), S.lundi), 'stock-segment-actif')[0].textContent, 'Achats');
  assert.match(stock.titre(S.lundi), /Achats/);
  mondeRizFait(S.lundi);
  dateDuJour(S.lundi, () => {
    assert.equal(stock.aConsommerEnPriorite(magasin.etat()), true);
    assert.equal(parClasse(stock.rendre(magasin.etat(), S.lundi), 'stock-segment-actif')[0].textContent, 'DLC');
    assert.match(stock.titre(S.lundi), /DLC/);
    stock.rendre(magasin.etat(), S.lundi, 'restes'); // choix explicite : gardé ensuite
    assert.equal(parClasse(stock.rendre(magasin.etat(), S.lundi), 'stock-segment-actif')[0].textContent, 'Restes');
  });
  stock.oublierSousVue();
});

test('CSS (lot Stock et Import) : bloc commenté en fin de fichier, cibles de 44 px, mouvement réduit, jetons seulement', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  const i = css.indexOf('/* ===== Lot Stock et Import');
  assert.ok(i > 0);
  const bloc = css.slice(i);
  assert.match(bloc, /\.stock-dlc-nom, \.stock-reste-nom \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.stock-reste-ouvrir \{[^}]*min-height: var\(--cible\)/);
  assert.match(bloc, /\.stock-valider \{[^}]*position: sticky/);
  assert.match(bloc, /prefers-reduced-motion/);
  assert.doesNotMatch(bloc, /#[0-9a-fA-F]{3,6}\b/);
  assert.doesNotMatch(bloc, /font-size: ?(1[0-4]|[0-9])px/);
});

test('dlc : la date limite part du jour réel où la production a été faite, pas du jour prévu (prévue mercredi, faite lundi)', () => {
  const e = etatVide();
  definirMenu(e, S.mercredi, 2, 'riz', h());
  prevision(e, S.mercredi, 2, 40);
  const riz = Object.values(e.composants).find((c) => c.famille === 'riz');
  const p = principaleDe(e, riz.id);
  e.productions[p].jourDecide = S.mercredi;
  marquerFait(e, p, 2400, `${S.lundi}T08:00:00.000Z`);
  magasin.remplacer(e);
  const texte = dateDuJour(S.lundi, () => stock.rendre(magasin.etat(), S.lundi, 'dlc')).textContent;
  assert.match(texte, /produit le lundi 5 octobre/);
  assert.match(texte, /à consommer avant le mardi 6 octobre/);
  assert.doesNotMatch(texte, /à consommer avant le jeudi 8 octobre/);
});
