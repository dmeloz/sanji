// Menus sans validation manuelle : fusion des composants quand l'intitulé change, composant inconnu, portion absente,
// mémoire automatique de l'attribution (et d'elle seule), saisie d'une semaine. Intitulés génériques : jeu TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterComposant, definirMenu, definirStandard, marquerFait, memoriser, modifierComposant, planifier,
  saisirMenusSemaine, supprimerComposant, supprimerStandard,
} from '../app/js/domaine/actions.js';
import { calculerComposant } from '../app/js/domaine/calcul.js';
import { assurerJour, memoireVide } from '../app/js/domaine/etat.js';
import { cibleProduction, etatTache } from '../app/js/domaine/planification.js';
import { pointsAConfirmer } from '../app/js/domaine/points.js';
import { besoinsProduits } from '../app/js/domaine/produits.js';
import { JEU_MENUS as M, JEU_STANDARDS as ST } from './jeux/TEST_ONLY-savoir.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';

const parNom = (etat, date, nom, menu) => Object.values(etat.composants)
  .find((c) => c.date === date && c.nom === nom && (menu === undefined || c.menu === menu));
const duMenu = (etat, date, menu) => Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
const noms = (composants) => composants.map((c) => c.nom).sort();
const types = (etat, date) => pointsAConfirmer(etat, date).map((p) => p.type);

// ---------------------------------------------------------------- fusion des composants

test('fusion : un intitulé modifié garde les composants inchangés avec leurs réglages et productions, crée les nouveaux, supprime les disparus', () => {
  const e = etatVide();
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.lundi, 2, M.garnitures, h()); // riz, carottes, poulet
  const riz = parNom(e, S.lundi, 'riz');
  const carottes = parNom(e, S.lundi, 'carottes');
  const poulet = parNom(e, S.lundi, 'poulet');
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes', 'poulet', 'riz']);

  // Réglages du chef et production planifiée sur le riz.
  modifierComposant(e, riz.id, { grammage: { valeur: 120, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'sec' }, charge: 'courte' }, h());
  const prodRiz = principaleDe(e, riz.id);
  const prodCarottes = principaleDe(e, carottes.id);
  planifier(e, prodRiz, S.lundi, h());
  const rizAvant = copie(riz);
  const prodAvant = copie(e.productions[prodRiz]);

  definirMenu(e, S.lundi, 2, M.autreSemaine, h()); // riz, courgettes, poulet : les carottes disparaissent
  assert.deepEqual(e.composants[riz.id], rizAvant, 'composant inchangé : conservé tel quel (réglages compris)');
  assert.deepEqual(e.productions[prodRiz], prodAvant, 'et sa production aussi');
  assert.equal(e.composants[poulet.id], poulet);
  assert.equal(e.composants[carottes.id], undefined, 'composant disparu : supprimé');
  assert.equal(e.productions[prodCarottes], undefined, 'avec sa production non faite');
  const courgettes = parNom(e, S.lundi, 'courgettes');
  assert.deepEqual([courgettes.valide, courgettes.famille, courgettes.type, courgettes.role, courgettes.attribue, courgettes.produitNom],
    [true, 'courgettes', 'produit_simple', 'garniture', true, 'courgettes'], 'nouveau composant : valide d\'emblée, savoir appliqué');
  assert.deepEqual(courgettes.etapes.map((x) => [x.etape, x.statut]), [['parage', 'STANDARD_BASE']]);
  assert.ok(principaleDe(e, courgettes.id), 'attribué : il reçoit sa production');
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['courgettes', 'poulet', 'riz']);
  assert.equal(e.jours[S.lundi].menus[2].transcriptionValidee, true);
  // L'autre menu du jour n'est pas touché.
  definirMenu(e, S.lundi, 1, M.principal, h());
  definirMenu(e, S.lundi, 2, M.unSeul, h());
  assert.deepEqual(noms(duMenu(e, S.lundi, 1)), ['carottes', 'poulet']);
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['riz']);
});

test('fusion : un composant disparu qui a une production faite est conservé avec sa production', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, M.garnitures, h());
  const carottes = parNom(e, S.lundi, 'carottes');
  const poulet = parNom(e, S.lundi, 'poulet');
  const prod = principaleDe(e, carottes.id);
  marquerFait(e, prod, 1234, h(1));
  const fait = copie(e.productions[prod]);
  definirMenu(e, S.lundi, 2, M.unSeul, h(2)); // il ne reste que le riz
  assert.ok(e.composants[carottes.id], 'production faite : le composant reste');
  assert.deepEqual(e.productions[prod], fait, 'et la production n\'est pas touchée');
  assert.equal(e.composants[poulet.id], undefined, 'sans production faite : supprimé');
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes', 'riz']);
  // Intitulé vidé : tout disparaît, sauf ce qui a été fait.
  definirMenu(e, S.lundi, 2, '', h(3));
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes']);
  assert.deepEqual(e.productions[prod], fait);
});

test('fusion : nom comparé sans accent ni casse, doublon d\'intitulé ignoré, intitulé identique sans effet', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, M.doublon, h()); // riz, carottes, riz
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes', 'riz'], 'un seul composant par nom');
  const ids = duMenu(e, S.lundi, 2).map((c) => c.id).sort();
  definirMenu(e, S.lundi, 2, ' Riz , CAROTTES ', h());
  assert.deepEqual(duMenu(e, S.lundi, 2).map((c) => c.id).sort(), ids, 'même nom normalisé : mêmes composants');
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes', 'riz'], 'le nom d\'origine est conservé');
  // Un intitulé identique ne change rien : une suppression faite à la main est respectée ; un intitulé modifié la recrée.
  const carottes = parNom(e, S.lundi, 'carottes');
  supprimerComposant(e, carottes.id, h());
  definirMenu(e, S.lundi, 2, ' Riz , CAROTTES ', h());
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['riz']);
  definirMenu(e, S.lundi, 2, 'Riz, CAROTTES', h());
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)).sort(), ['CAROTTES', 'riz']);
  definirMenu(e, S.lundi, 2, ' Riz , CAROTTES ', h());
  // Un composant ajouté à la main survit à l'enregistrement d'un intitulé identique, mais pas à un intitulé qui change.
  const main = ajouterComposant(e, S.lundi, 2, { nom: 'ELEMENT_MANUEL_TEST', categorie: 'legume' }, h());
  definirMenu(e, S.lundi, 2, ' Riz , CAROTTES ', h());
  assert.ok(e.composants[main]);
  definirMenu(e, S.lundi, 2, 'riz', h());
  assert.equal(e.composants[main], undefined, 'absent de l\'intitulé : supprimé comme tout composant disparu');
  // Un menu sans intitulé enregistré à nouveau vide ne supprime rien (rien n'a changé).
  const manuel = ajouterComposant(e, S.mardi, 1, { nom: 'ELEMENT_MANUEL_TEST', categorie: 'legume' }, h());
  definirMenu(e, S.mardi, 1, '', h());
  assert.ok(e.composants[manuel]);
  // Donnée d'avant la section 16 : intitulé saisi mais non validé, composant non valide → l'enregistrement le régularise.
  const ancien = etatVide();
  assurerJour(ancien, S.lundi).menus[1] = { intitule: 'riz', transcriptionValidee: false };
  const herite = ajouterComposant(ancien, S.lundi, 1, { nom: 'riz', categorie: 'feculent' }, h());
  ancien.composants[herite].valide = false; // tel qu'il était enregistré par l'ancien parcours
  definirMenu(ancien, S.lundi, 1, 'riz', h());
  assert.deepEqual([ancien.composants[herite].valide, ancien.jours[S.lundi].menus[1].transcriptionValidee], [true, true]);
  assert.equal(Object.values(ancien.composants).length, 1, 'le composant existant est gardé, non dupliqué');
});

test('composants créés par l\'analyse : valides d\'emblée, attribués selon le menu, savoir appliqué, sans validation', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, M.principal, h()); // poulet, carottes
  definirMenu(e, S.lundi, 2, M.garnitures, h()); // riz, carottes, poulet
  assert.ok(Object.values(e.composants).every((c) => c.valide === true));
  assert.deepEqual(duMenu(e, S.lundi, 1).map((c) => [c.nom, c.attribue, c.role]), [['poulet', true, 'composant_recette'], ['carottes', true, 'plat_principal']]);
  assert.deepEqual(duMenu(e, S.lundi, 2).map((c) => [c.nom, c.attribue, c.role]), [['riz', true, 'garniture'], ['carottes', true, 'garniture'], ['poulet', false, 'garniture']]);
  assert.deepEqual(duMenu(e, S.lundi, 1).map((c) => c.type), ['generique', 'produit_simple']);
  // Une production pour chaque composant attribué, aucune pour le non attribué.
  assert.equal(Object.keys(e.productions).length, 4);
  assert.equal(principaleDe(e, parNom(e, S.lundi, 'poulet', 2).id), undefined);
  // Aucun point de validation n'existe plus.
  assert.equal(types(e, S.lundi).some((t) => t === 'transcription' || t === 'composants'), false);
});

// ---------------------------------------------------------------- points : composant inconnu, grammage

test('composant inconnu : point « à classer », jusqu\'au choix du chef, mémorisé par nom', () => {
  const e = etatVide();
  prevision(e, S.lundi, 2, 10);
  definirMenu(e, S.lundi, 2, M.inconnu, h());
  const inconnu = parNom(e, S.lundi, 'ELEMENT_INCONNU_TEST');
  assert.deepEqual([inconnu.type, inconnu.categorie, inconnu.attribue, inconnu.famille, inconnu.valide], ['a_preciser', 'a_preciser', false, null, true]);
  const points = pointsAConfirmer(e, S.lundi);
  assert.deepEqual(points.map((p) => [p.type, p.composantId]), [['composant_inconnu', inconnu.id]]);
  assert.match(points[0].texte, /ELEMENT_INCONNU_TEST : à classer : au poste ou non \?/);

  // Le chef dit « pas au poste » : plus de point, le choix est mémorisé, rien d'autre n'est mémorisé.
  modifierComposant(e, inconnu.id, { categorie: 'autre' }, h());
  assert.deepEqual(types(e, S.lundi), []);
  assert.deepEqual(e.memoire['element_inconnu_test|2'], { ...memoireVide(), nom: 'ELEMENT_INCONNU_TEST', attribue: false, categorie: 'autre' });

  // Même nom, autre jour : le point ne revient pas, la catégorie mémorisée est reprise, le type devient générique.
  prevision(e, S.mardi, 2, 10);
  definirMenu(e, S.mardi, 2, M.inconnu, h());
  const encore = parNom(e, S.mardi, 'ELEMENT_INCONNU_TEST');
  assert.deepEqual([encore.categorie, encore.attribue, encore.type], ['autre', false, 'generique']);
  assert.deepEqual(types(e, S.mardi), []);
});

test('composant inconnu : en menu 1 il est au poste ; le chef peut aussi le désattribuer ; un autre nom reste à classer', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  definirMenu(e, S.lundi, 1, `${M.inconnu}, AUTRE_ELEMENT_TEST`, h());
  const a = parNom(e, S.lundi, 'ELEMENT_INCONNU_TEST');
  const b = parNom(e, S.lundi, 'AUTRE_ELEMENT_TEST');
  assert.deepEqual([a.attribue, b.attribue], [true, true]);
  assert.deepEqual(pointsAConfirmer(e, S.lundi).map((p) => p.type), ['composant_inconnu', 'composant_inconnu'], 'un seul point par composant inconnu');
  modifierComposant(e, a.id, { attribue: false }, h());
  assert.deepEqual(pointsAConfirmer(e, S.lundi).map((p) => p.composantId), [b.id]);
  assert.equal(principaleDe(e, a.id), undefined, 'plus au poste : plus de production');
  // Catégorie connue mais type non déterminé : le point devient « composant à préciser ».
  modifierComposant(e, b.id, { categorie: 'legume' }, h());
  assert.deepEqual(pointsAConfirmer(e, S.lundi).map((p) => [p.type, p.composantId]), [['composant_a_preciser', b.id]]);
  modifierComposant(e, b.id, { type: 'generique' }, h());
  assert.deepEqual(types(e, S.lundi), []);
});

// Adapté B-P0 : la polenta (famille sans repère) remplace le riz, qui a maintenant un repère validé : l'intention
// « portion absente = point grammage, aucune quantité inventée » est conservée.
test('portion absente : point « grammage » et aucune quantité inventée', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  prevision(e, S.lundi, 2, 40);
  definirMenu(e, S.lundi, 2, 'polenta, carottes, poulet', h()); // polenta et carottes : familles connues ; poulet : générique (non au poste)
  definirMenu(e, S.lundi, 1, M.principal, h()); // poulet : générique au poste ; carottes
  const polenta = parNom(e, S.lundi, 'polenta');
  const carottes2 = parNom(e, S.lundi, 'carottes', 2);
  const poulet1 = parNom(e, S.lundi, 'poulet', 1);
  assert.equal(poulet1.type, 'generique');
  const grammage = pointsAConfirmer(e, S.lundi).filter((p) => p.type === 'grammage');
  assert.deepEqual(grammage.map((p) => p.composantId).sort(), [polenta.id, carottes2.id, parNom(e, S.lundi, 'carottes', 1).id].sort());
  assert.ok(grammage.every((p) => /portion à saisir/.test(p.texte)));
  assert.equal(grammage.some((p) => p.composantId === poulet1.id), false, 'hors générique : un composant générique n\'a pas de point grammage');
  // Aucune quantité inventée : ni calcul, ni cible, ni besoin chiffré.
  const c = calculerComposant(e, polenta.id);
  assert.deepEqual([c.statut, c.quantiteTravail, c.brut, c.quantiteServie, c.ingredients], ['INCONNU', null, null, null, null]);
  assert.match(c.formule, /il manque grammage/);
  assert.equal(cibleProduction(e, principaleDe(e, polenta.id)), null);
  assert.equal(etatTache(e, principaleDe(e, polenta.id)), 'a_preciser');
  const besoins = besoinsProduits(e, S.lundi);
  assert.equal(besoins.lignes.length, 0, 'aucune ligne chiffrée à commander');
  assert.ok(besoins.nonChiffrables.some((x) => x.composantId === polenta.id && /grammage/.test(x.raison)));
  // Le chef saisit un standard : le point disparaît et la quantité apparaît ; sans standard, il revient.
  definirStandard(e, 'polenta', 'garniture', ST.sec, h());
  assert.equal(pointsAConfirmer(e, S.lundi).some((p) => p.composantId === polenta.id && p.type === 'grammage'), false);
  assert.equal(calculerComposant(e, polenta.id).quantiteTravail, 4000);
  supprimerStandard(e, 'polenta', 'garniture', h());
  assert.equal(pointsAConfirmer(e, S.lundi).some((p) => p.composantId === polenta.id && p.type === 'grammage'), true);
  // Un composant déjà dans l'ancien parcours avec un grammage saisi n'a pas de point.
  const saisi = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  assert.equal(pointsAConfirmer(e, S.lundi).some((p) => p.composantId === saisi), false);
});

// ---------------------------------------------------------------- mémoire automatique : l'attribution seulement

test('mémoire automatique : une attribution corrigée par le chef est mémorisée par nom et réappliquée à la saisie suivante', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, M.garnitures, h());
  const poulet = parNom(e, S.lundi, 'poulet');
  assert.equal(poulet.attribue, false);
  assert.deepEqual(e.memoire, {}, 'rien n\'est mémorisé tant que le chef ne corrige rien');
  modifierComposant(e, poulet.id, { attribue: true }, h());
  assert.deepEqual(e.memoire['poulet|2'], { ...memoireVide(), nom: 'poulet', attribue: true, categorie: 'proteine' });
  assert.ok(principaleDe(e, poulet.id));
  // Saisie suivante : le même nom (casse et accents ignorés) reçoit le choix, sans geste.
  definirMenu(e, S.mardi, 2, 'Riz, POULET', h());
  assert.deepEqual([parNom(e, S.mardi, 'POULET').attribue, parNom(e, S.mardi, 'Riz').attribue], [true, true]);
  // Et l'inverse : un composant attribué par défaut que le chef retire du poste.
  modifierComposant(e, parNom(e, S.lundi, 'riz').id, { attribue: false }, h());
  definirMenu(e, S.mercredi, 2, 'riz', h());
  assert.equal(parNom(e, S.mercredi, 'riz').attribue, false);
  assert.deepEqual(Object.keys(e.memoire).sort(), ['poulet|2', 'riz|2']);
});

test('mémoire automatique : seule l\'attribution et la catégorie sont mémorisées, rien d\'autre', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, M.unSeul, h());
  const riz = parNom(e, S.lundi, 'riz');
  // Corrections de portion, de type, d'étape, de rôle, de charge, de recette… : aucune mémoire.
  modifierComposant(e, riz.id, {
    grammage: { valeur: 120, unite: 'g', statut: 'SAISI_SERVICE', source: 'TEST_ONLY', etat: 'sec' }, type: 'produit_simple', role: 'plat_principal',
    etapes: [{ etape: 'cuisson', coefficient: 3, statut: 'SAISI_SERVICE', source: 'TEST_ONLY' }], charge: 'longue', produitNom: 'PRODUIT_TEST',
  }, h());
  assert.deepEqual(e.memoire, {});
  // « Modifier » avec la valeur actuelle n'est pas un changement.
  modifierComposant(e, riz.id, { attribue: true, categorie: 'feculent' }, h());
  assert.deepEqual(e.memoire, {});
  // Un changement d'attribution crée l'entrée : nom, attribution, catégorie ; le reste garde ses valeurs vides.
  modifierComposant(e, riz.id, { attribue: false }, h());
  assert.deepEqual(e.memoire['riz|2'], { ...memoireVide(), nom: 'riz', attribue: false, categorie: 'feculent' });
  assert.deepEqual([e.memoire['riz|2'].parRole, e.memoire['riz|2'].etapes, e.memoire['riz|2'].type, e.memoire['riz|2'].charge], [{}, {}, 'a_preciser', null]);
  // Un changement de catégorie la met à jour.
  modifierComposant(e, riz.id, { categorie: 'autre' }, h());
  assert.deepEqual([e.memoire['riz|2'].attribue, e.memoire['riz|2'].categorie], [false, 'autre']);
  // Une mémoire explicite (geste « mémoriser ») garde ses autres champs quand l'attribution change ensuite.
  modifierComposant(e, riz.id, { attribue: true, categorie: 'feculent' }, h());
  memoriser(e, riz.id, h());
  assert.equal(e.memoire['riz|2'].parRole.plat_principal.grammage.valeur, 120);
  assert.equal(e.memoire['riz|2'].etapes.cuisson.coefficient, 3);
  modifierComposant(e, riz.id, { attribue: false }, h());
  assert.equal(e.memoire['riz|2'].parRole.plat_principal.grammage.valeur, 120, 'la référence mémorisée n\'est pas effacée');
  assert.equal(e.memoire['riz|2'].etapes.cuisson.coefficient, 3);
  assert.equal(e.memoire['riz|2'].attribue, false, 'attribution et référence mémorisée partagent l\'entrée du menu');
  // Un nom dangereux n'écrit rien dans l'héritage des objets.
  const dangereux = ajouterComposant(e, S.lundi, 2, { nom: 'constructor', categorie: 'legume', attribue: false }, h());
  assert.doesNotThrow(() => modifierComposant(e, dangereux, { attribue: true }, h()));
  assert.equal({}.attribue, undefined);
});

// ---------------------------------------------------------------- saisie d'une semaine

test('saisirMenusSemaine : intitulés et prévisions du lundi au vendredi, composants créés seuls, une seule ligne de journal', () => {
  const e = etatVide();
  const saisie = {
    [S.lundi]: { menu1: M.principal, menu2: M.garnitures, prevision1: 30, prevision2: 12 },
    [S.mardi]: { menu1: `  ${M.autreSemaine}  `, menu2: '', prevision1: null, prevision2: 0 },
    [S.vendredi]: { menu2: M.unSeul },
  };
  const avantJournal = e.journal.length;
  const r = saisirMenusSemaine(e, S.lundi, saisie, h(5));
  assert.deepEqual(r, { menus: 4, previsions: 3 });
  assert.equal(e.journal.length, avantJournal + 1);
  assert.deepEqual(e.journal.at(-1), { h: h(5), action: 'saisirMenusSemaine', detail: `${S.lundi} : 4 menu(s), 3 prévision(s)` });
  assert.deepEqual([e.jours[S.lundi].menus[1].intitule, e.jours[S.lundi].menus[2].intitule], [M.principal, M.garnitures]);
  assert.equal(e.jours[S.mardi].menus[1].intitule, M.autreSemaine, 'texte rogné');
  assert.equal(e.jours[S.mardi].menus[2].intitule, '', 'chaîne vide : rien n\'est changé (le menu n\'existait pas)');
  assert.equal(e.jours[S.vendredi].menus[2].intitule, M.unSeul);
  assert.deepEqual(e.jours[S.lundi].previsions, { 1: { portions: 30, h: h(5) }, 2: { portions: 12, h: h(5) } });
  assert.deepEqual(e.jours[S.mardi].previsions, { 1: { portions: null, h: null }, 2: { portions: 0, h: h(5) } }, 'null : ne rien changer ; 0 est une prévision');
  assert.equal(e.jours[S.mercredi], undefined, 'un jour absent de la saisie n\'est pas créé');
  // Les composants sont créés seuls, valides, attribués selon le menu.
  assert.deepEqual(noms(duMenu(e, S.lundi, 1)), ['carottes', 'poulet']);
  assert.deepEqual(noms(duMenu(e, S.lundi, 2)), ['carottes', 'poulet', 'riz']);
  assert.deepEqual(noms(duMenu(e, S.mardi, 1)), ['courgettes', 'poulet', 'riz']);
  assert.deepEqual(noms(duMenu(e, S.vendredi, 2)), ['riz']);
  assert.ok(Object.values(e.composants).every((c) => c.valide));
  assert.equal(parNom(e, S.lundi, 'poulet', 2).attribue, false);
  assert.equal(calculerComposant(e, parNom(e, S.lundi, 'carottes', 1).id).portions.total, 30);
});

test('saisirMenusSemaine : chaîne vide = ne rien changer, null = effacer, prévision null = ne rien changer', () => {
  const e = etatVide();
  saisirMenusSemaine(e, S.lundi, { [S.lundi]: { menu1: M.principal, menu2: M.garnitures, prevision1: 30, prevision2: 12 } }, h(1));
  const carottes1 = parNom(e, S.lundi, 'carottes', 1);
  marquerFait(e, principaleDe(e, carottes1.id), 77, h(2));
  const avantMenu2 = copie({ menu: e.jours[S.lundi].menus[2], composants: duMenu(e, S.lundi, 2) });
  const r = saisirMenusSemaine(e, S.lundi, { [S.lundi]: { menu1: null, menu2: '   ', prevision1: null, prevision2: 20 } }, h(3));
  assert.deepEqual(r, { menus: 1, previsions: 1 });
  assert.equal(e.jours[S.lundi].menus[1].intitule, '', 'null : intitulé effacé');
  assert.deepEqual(noms(duMenu(e, S.lundi, 1)), ['carottes'], 'composants supprimés, sauf celui dont la production est faite');
  assert.deepEqual({ menu: e.jours[S.lundi].menus[2], composants: duMenu(e, S.lundi, 2) }, avantMenu2, 'chaîne vide : menu 2 inchangé');
  assert.equal(e.jours[S.lundi].previsions[1].portions, 30, 'prévision null : inchangée');
  assert.deepEqual(e.jours[S.lundi].previsions[2], { portions: 20, h: h(3) });
  // Effacer un menu qui n'existe pas ne crée rien.
  const avant = copie(e.jours);
  saisirMenusSemaine(e, S.lundi, { [S.mardi]: { menu1: null, menu2: null } }, h(4));
  assert.deepEqual(e.jours, avant);
  // Enregistrer à nouveau le même texte (feuille recollée) ne recrée pas ce qui a été supprimé à la main.
  supprimerComposant(e, parNom(e, S.lundi, 'riz').id, h(5));
  saisirMenusSemaine(e, S.lundi, { [S.lundi]: { menu2: M.garnitures } }, h(6));
  assert.equal(parNom(e, S.lundi, 'riz'), undefined);
});

test('saisirMenusSemaine : refuse une saisie invalide sans rien modifier (journal compris), horodatage obligatoire', () => {
  const e = etatVide();
  saisirMenusSemaine(e, S.lundi, { [S.lundi]: { menu1: M.principal, prevision1: 30 } }, h(1));
  const avant = copie(e);
  const refus = (lundi, saisie, motif) => assert.throws(() => saisirMenusSemaine(e, lundi, saisie, h(2)), motif, JSON.stringify(saisie));
  refus(S.mardi, {}, /n'est pas un lundi/);
  refus('2026-13-45', {}, /Date invalide/);
  refus(S.lundi, null, /Saisie de la semaine invalide/);
  refus(S.lundi, [], /Saisie de la semaine invalide/);
  refus(S.lundi, { [S.samedi]: { menu1: 'riz' } }, /hors de la semaine/);
  refus(S.lundi, { [S.dimanche]: { menu1: 'riz' } }, /hors de la semaine/);
  refus(S.lundi, { [S.lundiSuivant]: { menu1: 'riz' } }, /hors de la semaine/);
  refus(S.lundi, { pasUneDate: { menu1: 'riz' } }, /hors de la semaine/);
  refus(S.lundi, { [S.lundi]: null }, /invalide/);
  refus(S.lundi, { [S.lundi]: { menu1: 42 } }, /texte attendu/);
  refus(S.lundi, { [S.lundi]: { menu2: ['riz'] } }, /texte attendu/);
  // Atomique : un jour valide placé avant le jour invalide n'est pas enregistré.
  refus(S.lundi, { [S.lundi]: { menu1: 'ELEMENT_NOUVEAU_TEST', prevision2: 5 }, [S.mardi]: { prevision1: -1 } }, /Prévision/);
  refus(S.lundi, { [S.lundi]: { menu1: 'ELEMENT_NOUVEAU_TEST' }, [S.mercredi]: { prevision2: 1.5 } }, /Prévision/);
  refus(S.lundi, { [S.mardi]: { prevision1: '12' } }, /Prévision/);
  assert.deepEqual(e, avant);
  assert.throws(() => saisirMenusSemaine(e, S.lundi, {}, 'hier'), /Horodatage/);
  assert.throws(() => saisirMenusSemaine(e, S.lundi, {}), /Horodatage/);
  assert.deepEqual(e, avant);
  // Une saisie vide est permise : une ligne de journal, rien d'autre.
  assert.deepEqual(saisirMenusSemaine(e, S.lundi, {}, h(3)), { menus: 0, previsions: 0 });
  assert.equal(e.journal.length, avant.journal.length + 1);
  assert.deepEqual({ ...e, journal: [] }, { ...avant, journal: [] });
});

test('saisirMenusSemaine : la mémoire de l\'attribution s\'applique à toute la semaine saisie', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'poulet', h());
  modifierComposant(e, parNom(e, S.lundi, 'poulet').id, { attribue: true }, h());
  saisirMenusSemaine(e, S.lundiSuivant, {
    [S.lundiSuivant]: { menu2: 'poulet, riz' },
    [S.mardiSuivant]: { menu2: 'riz, poulet' },
  }, h());
  assert.deepEqual([parNom(e, S.lundiSuivant, 'poulet').attribue, parNom(e, S.mardiSuivant, 'poulet').attribue], [true, true]);
});

test('ajout manuel : le composant est valide d\'emblée et reçoit le savoir de l\'application', () => {
  const e = etatVide();
  const id = ajouterComposant(e, S.lundi, 2, { nom: 'riz' }, h());
  const c = e.composants[id];
  assert.deepEqual([c.valide, c.famille, c.type, c.role], [true, 'riz', 'produit_simple', 'garniture']);
  assert.deepEqual(c.etapes.map((x) => [x.etape, x.statut]), [['cuisson', 'STANDARD_BASE']]);
  assert.equal(Object.values(e.productions).filter((p) => p.composantId === id).length, 1, 'sa tâche existe sans autre geste');
  // Un type demandé explicitement est respecté.
  const explicite = ajouterComposant(e, S.lundi, 1, { nom: 'ELEMENT_TEST', categorie: 'legume', type: 'preparation_maison' }, h());
  assert.equal(e.composants[explicite].type, 'preparation_maison');
});
