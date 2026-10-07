import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserFeuille, repartirSurSemaine, semaineDetectee } from '../app/js/domaine/feuille.js';

// Jeu TEST_ONLY : mots de catégorie assemblés pour le test, aucun intitulé de vrai menu.
const DEUX_JOURS_DATE_ENTRE = `Menu du marché
riz et carottes
Lundi 05 octobre
poulet, riz, carottes
19.-
24.-
pâtes aux courgettes
Mardi 06 octobre
poisson sauce TEST, pommes vapeur, poireaux
19.–
24.–`;

test('feuille : date entre les deux lignes, prix et titre écartés', () => {
  const r = analyserFeuille(DEUX_JOURS_DATE_ENTRE);
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.jours, [
    { jourSemaine: 1, numero: 5, mois: 10, menu1: 'riz et carottes', menu2: 'poulet, riz, carottes' },
    { jourSemaine: 2, numero: 6, mois: 10, menu1: 'pâtes aux courgettes', menu2: 'poisson sauce TEST, pommes vapeur, poireaux' },
  ]);
  assert.deepEqual(r.ignorees, ['Menu du marché', '19.-', '24.-', '19.–', '24.–']);
});

test('feuille : date avant ou après les deux lignes, même résultat', () => {
  const avant = analyserFeuille('lundi 5 octobre\nriz et carottes\npoulet, riz\nmardi 6 octobre\npâtes\npoisson, riz');
  const apres = analyserFeuille('riz et carottes\npoulet, riz\nlundi 5 octobre\npâtes\npoisson, riz\nmardi 6 octobre');
  for (const r of [avant, apres]) {
    assert.deepEqual(r.avertissements, []);
    assert.deepEqual(r.jours.map((j) => [j.jourSemaine, j.menu1, j.menu2]),
      [[1, 'riz et carottes', 'poulet, riz'], [2, 'pâtes', 'poisson, riz']]);
  }
});

test('feuille : date collée à une ligne de plat, prix collé en fin de ligne, « 1er », année, majuscules', () => {
  const r = analyserFeuille('Riz et carottes LUNDI 1er JUIN 2026\npoulet, riz, carottes 24.-');
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.jours, [{ jourSemaine: 1, numero: 1, mois: 6, menu1: 'Riz et carottes', menu2: 'poulet, riz, carottes' }]);
});

test('feuille : annotations manuscrites et restes de lecture écartés', () => {
  const r = analyserFeuille('√\n√ riz et carottes\n30\n+ note au stylo\nlundi 5 octobre\n8h\n40\n- poulet, riz\n30 + note');
  assert.deepEqual(r.avertissements, []);
  // La coche et le tiret en tête sont retirés, le texte du plat est gardé.
  assert.deepEqual(r.jours.map((j) => [j.menu1, j.menu2]), [['riz et carottes', 'poulet, riz']]);
  assert.deepEqual(r.ignorees, ['30', '+ note au stylo', '8h', '40', '30 + note']);
});

test('feuille : nombre de lignes incohérent = avertissement, rien de réparti', () => {
  const r = analyserFeuille('lundi 5 octobre\nriz et carottes\nmardi 6 octobre\npâtes\npoisson, riz');
  assert.equal(r.avertissements.length, 1);
  assert.match(r.avertissements[0], /2 jour\(s\) reconnu\(s\) mais 3 ligne\(s\)/);
  assert.ok(r.jours.every((j) => j.menu1 === '' && j.menu2 === ''));
  assert.deepEqual(r.lignes, ['riz et carottes', 'pâtes', 'poisson, riz']);
});

test('feuille : aucun jour, jour répété, texte vide', () => {
  assert.match(analyserFeuille('riz et carottes\npoulet, riz').avertissements[0], /Aucun jour reconnu/);
  assert.match(analyserFeuille('lundi 5 octobre\nriz\npoulet\nlundi 12 octobre\npâtes\npoisson').avertissements[0], /deux fois/);
  assert.deepEqual(analyserFeuille('').jours, []);
  assert.deepEqual(analyserFeuille(null).lignes, []);
});

test('feuille : un mot contenant un nom de jour ne déclenche pas une date', () => {
  const r = analyserFeuille('lundi 5 octobre\nsalade mardigras 3 couleurs et riz\npoulet, riz');
  assert.deepEqual(r.jours.length, 1);
  assert.equal(r.jours[0].menu1, 'salade mardigras 3 couleurs et riz');
});

test('semaine : répartition sur les dates du lundi au vendredi', () => {
  const r = repartirSurSemaine(analyserFeuille(DEUX_JOURS_DATE_ENTRE), '2026-10-05');
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.saisie, {
    '2026-10-05': { menu1: 'riz et carottes', menu2: 'poulet, riz, carottes' },
    '2026-10-06': { menu1: 'pâtes aux courgettes', menu2: 'poisson sauce TEST, pommes vapeur, poireaux' },
  });
});

test('semaine : mauvaise semaine signalée, samedi ignoré, lundi exigé', () => {
  const r = repartirSurSemaine(analyserFeuille(DEUX_JOURS_DATE_ENTRE), '2026-10-12');
  assert.equal(r.avertissements.length, 2);
  assert.match(r.avertissements[0], /indique le 5 pour lundi, la semaine affichée donne le 12/);
  assert.deepEqual(Object.keys(r.saisie), ['2026-10-12', '2026-10-13']);
  const samedi = repartirSurSemaine(analyserFeuille('samedi 10 octobre\nriz\npoulet'), '2026-10-05');
  assert.deepEqual(samedi.saisie, {});
  assert.match(samedi.avertissements[0], /samedi ni le dimanche/);
  assert.throws(() => repartirSurSemaine(analyserFeuille(''), '2026-10-06'), /lundi/);
});

// ---------------------------------------------------------------- feuille réaliste (2026-10-03)

const FEUILLE_REALISTE = `LE BISTROT TEST
Menu du marché
Lundi 05 octobre
Menu 1 19.50
poulet, riz, carottes
Menu 2 24.50
pâtes aux courgettes
Mardi 06 octobre
Menu 1 19.50
poisson, pommes vapeur, poireaux
Menu 2 24.50
risotto, courgettes
Bon appétit !`;

test('feuille : nom de l\'établissement, étiquettes « Menu N » avec prix et formule de politesse sont écartés', () => {
  const r = analyserFeuille(FEUILLE_REALISTE);
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.jours.map((j) => [j.menu1, j.menu2]), [
    ['poulet, riz, carottes', 'pâtes aux courgettes'],
    ['poisson, pommes vapeur, poireaux', 'risotto, courgettes'],
  ]);
  assert.ok(r.ignorees.includes('LE BISTROT TEST'));
  assert.ok(r.ignorees.includes('Menu 1 19.50'));
  assert.ok(r.ignorees.includes('Bon appétit !'));
});

test('feuille : un prix décimal en fin de plat est retiré, sans toucher au reste du nom', () => {
  const r = analyserFeuille('lundi 5 octobre\npoulet, riz 19.50\npâtes 24,50\nmardi 6 octobre\nsoupe de 2 légumes\npoisson 18.-');
  assert.deepEqual(r.jours.map((j) => [j.menu1, j.menu2]), [['poulet, riz', 'pâtes'], ['soupe de 2 légumes', 'poisson']]);
});

test('feuille : un enseigne en deuxième ligne ou un plat en majuscules après une date reste un plat', () => {
  const r = analyserFeuille('lundi 5 octobre\nPOULET RÔTI\nriz');
  assert.deepEqual(r.jours.map((j) => [j.menu1, j.menu2]), [['POULET RÔTI', 'riz']]);
});

test('feuille : la date reste obligatoire, « lundi » seul n\'est pas reconnu', () => {
  const r = analyserFeuille('lundi\nriz\npoulet');
  assert.equal(r.jours.length, 0);
  assert.match(r.avertissements[0], /Aucun jour reconnu/);
});

test('feuille : un titre avec son sous-titre de service est écarté, un plat reste un plat', () => {
  const titres = ['Menu du marché (à midi uniquement)', 'Menu du marché A midi uniquement',
    'Menu du marché / A midi uniquement', 'Menu du marché [midi uniquement]', 'Menus de la semaine à midi uniquement'];
  for (const titre of titres) {
    const r = analyserFeuille(`${titre}\nlundi 5 octobre\nPenne au pesto 19.-\nSauté de volaille, riz 24.-`);
    assert.deepEqual(r.ignorees, [titre], titre);
    assert.deepEqual(r.avertissements, [], titre);
    assert.equal(r.jours[0].menu1, 'Penne au pesto', titre);
  }
  const plat = analyserFeuille('lundi 5 octobre\nMenu du chef au beurre blanc 19.-\nSauté de volaille, riz 24.-');
  assert.equal(plat.jours[0].menu1, 'Menu du chef au beurre blanc');
});

test('feuille : une date collée à son mois (« 11mars ») est lue en entier', () => {
  const r = analyserFeuille('Mercredi 11mars\nPenne au pesto\nSauté de veau, riz');
  assert.deepEqual(r.jours.map((j) => [j.jourSemaine, j.numero, j.mois]), [[3, 11, 3]]);
  assert.deepEqual(r.ignorees, []);
});

const SEMAINE_MARS = (mois) => ['Lundi 9', 'Mardi 10', 'Mercredi 11', 'Jeudi 12', 'Vendredi 13']
  .map((j, i) => `${j}${mois}\nPlat ${i} menu 1\nPlat ${i} menu 2`).join('\n');

test('semaine détectée : par les dates du texte, avec ou sans mois, la plus proche de la semaine affichée', () => {
  const avecMois = semaineDetectee(analyserFeuille(SEMAINE_MARS(' mars')), '2026-10-05');
  assert.deepEqual([avecMois.lundi, avecMois.accord], ['2026-03-09', 5]);
  const sansMois = semaineDetectee(analyserFeuille(SEMAINE_MARS('')), '2026-03-02');
  assert.equal(sansMois.lundi, '2026-03-09');
  assert.equal(semaineDetectee(analyserFeuille('riz\npoulet'), '2026-10-05'), null);
});

test('semaine détectée : un jour dont la date ne tombe pas sur son jour ne vote pas', () => {
  // Janvier 2026 : le 5 est un lundi, le 6 un mardi ; « mercredi 8 », « jeudi 7 » et « vendredi 8 » sont impossibles.
  const texte = ['Lundi 5 janvier', 'a', 'b', 'Mardi 6 janvier', 'c', 'd', 'Mercredi 8 janvier', 'e', 'f',
    'Jeudi 7 janvier', 'g', 'h', 'Vendredi 8 janvier', 'i', 'j'].join('\n');
  const d = semaineDetectee(analyserFeuille(texte), '2026-01-05');
  assert.deepEqual([d.lundi, d.accord, d.total], ['2026-01-05', 2, 5]);
});

test('semaine : des dates fausses dans la bonne semaine sont corrigées et dites, sans avertissement', () => {
  const texte = ['Lundi 5 janvier', 'Penne au pesto', 'Sauté de volaille', 'Mardi 6 janvier', 'Casarecce au jambon', 'Dos de lieu',
    'Mercredi 8 janvier', 'Risotto aux aubergines', 'Onglet de bœuf', 'Jeudi 7 janvier', 'Mafalda à la coppa', 'Blanquette de veau',
    'Vendredi 8 janvier', 'Orecchiette au bleu', 'Filet de rascasse'].join('\n');
  const r = repartirSurSemaine(analyserFeuille(texte), '2026-01-05');
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.corrections.map((c) => [c.jourSemaine, c.imprime, c.corrige]), [[3, 8, 7], [4, 7, 8], [5, 8, 9]]);
  assert.deepEqual(Object.keys(r.saisie), ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']);
  assert.equal(r.saisie['2026-01-07'].menu1, 'Risotto aux aubergines'); // le plat reste sous son jour de la semaine
});

test('semaine : un texte d\'une autre semaine garde ses avertissements et rend la semaine détectée', () => {
  const r = repartirSurSemaine(analyserFeuille(SEMAINE_MARS(' mars')), '2026-10-05');
  assert.equal(r.semaine.lundi, '2026-03-09');
  assert.deepEqual(r.corrections, []);
  assert.ok(r.avertissements.length > 0);
});
