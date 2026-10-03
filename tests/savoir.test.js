// Savoir culinaire (savoir.js) : familles, groupes, lexique unique, application aux composants, portion effective
// et standards. Aucune valeur n'est une référence métier : les repères de la base sont injectés depuis un jeu TEST_ONLY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_METIER } from '../app/js/donnees/base-metier.js';
import { categoriePropose } from '../app/js/domaine/analyse-menu.js';
import { composantVide, etatInitial, normaliser } from '../app/js/domaine/etat.js';
import {
  FAMILLES, GROUPES, MOTS_SANS_FAMILLE, ROLES_STANDARD, appliquerSavoir, familleDe, familleParCle, grammageEffectif,
  lignesStandards, lireNom,
} from '../app/js/domaine/savoir.js';
import { CATEGORIE, ETAT_POIDS, ROLE } from '../app/js/domaine/statuts.js';
import { JEU_REPERES as R } from './jeux/TEST_ONLY-savoir.js';

/** Lexique de analyse-menu.js avant la section 16 : garde-fou contre la perte d'un mot ou d'une catégorie. */
const ANCIEN_LEXIQUE = {
  feculent: [
    'riz', 'pate', 'spaghetti', 'tagliatelle', 'penne', 'nouille', 'pomme de terre', 'puree', 'frite', 'gnocchi',
    'semoule', 'couscous', 'boulgour', 'quinoa', 'polenta', 'lentille', 'pois chiche', 'haricot blanc',
    'haricot rouge', 'orge', 'epeautre', 'risotto', 'croquette', 'dauphine', 'rosti', 'patate douce', 'ble',
    'trofie', 'mafalda', 'fusilli', 'cortecce', 'rigatoni', 'linguine', 'farfalle', 'orecchiette', 'macaroni',
    'ravioli', 'lasagne', 'tortellini', 'cannelloni', 'spatzli', 'knopfli', 'gratin dauphinois', 'pomme mousseline',
    'pomme au beurre', 'pomme vapeur', 'pomme nature', 'pomme puree', 'pomme rissolee', 'pomme sautee',
    'pomme duchesse', 'pomme fondante', 'pomme noisette', 'pomme allumette', 'pomme frite', 'pomme boulangere',
    'pomme grenaille', 'pomme nouvelle', 'pomme rosti'],
  legume: [
    'carotte', 'courgette', 'aubergine', 'poivron', 'tomate', 'haricot vert', 'epinard', 'brocoli', 'chou',
    'poireau', 'fenouil', 'endive', 'petit pois', 'asperge', 'legume', 'ratatouille', 'navet', 'betterave', 'panais',
    'celeri', 'courge', 'potiron', 'butternut', 'oignon', 'echalote', 'champignon', 'salade', 'artichaut', 'blette',
    'bette', 'cote de bette', 'cote de blette', 'radis', 'concombre', 'mais', 'jardiniere', 'macedoine', 'chicoree',
    'cardon', 'salsifi', 'topinambour', 'colrave', 'bolet', 'olive'],
  proteine: [
    'poulet', 'volaille', 'boeuf', 'veau', 'porc', 'agneau', 'canard', 'dinde', 'lapin', 'pintade', 'poisson',
    'saumon', 'cabillaud', 'colin', 'thon', 'lotte', 'merlu', 'truite', 'dorade', 'sole', 'crevette', 'gambas',
    'langoustine', 'moule', 'calamar', 'seiche', 'oeuf', 'jambon', 'saucisse', 'steak', 'escalope', 'magret',
    'filet', 'cuisse', 'gigot', 'roti', 'tofu', 'lieu', 'merlan', 'lard', 'boudin', 'entrecote', 'bavette', 'cote',
    'cotelette', 'carre', 'cerf', 'chevreuil', 'sanglier', 'lievre', 'atriau', 'fletan', 'perche', 'fera', 'omble',
    'sandre', 'brochet'],
  sauce: [
    'sauce', 'jus', 'veloute', 'coulis', 'vinaigrette', 'mayonnaise', 'bearnaise', 'hollandaise', 'beurre blanc',
    'emulsion', 'fumet', 'bisque', 'reduction', 'pesto', 'fond'],
};
const composant = (champs) => ({ ...composantVide('c_test'), date: '2026-10-05', menu: 2, ...champs });
const ligneBase = (etape, produit) => BASE_METIER.find((l) => l.etape === etape && l.produit === produit);
const milieu = (l) => (l.coefMin + l.coefMax) / 2;
const aucunNombre = (valeur) => {
  if (typeof valeur === 'number') return false;
  if (valeur !== null && typeof valeur === 'object') return Object.values(valeur).every(aucunNombre);
  return true;
};

test('FAMILLES : forme, clés uniques, catégories, groupes et étapes du vocabulaire fermé', () => {
  assert.ok(FAMILLES.length >= 20);
  assert.equal(new Set(FAMILLES.map((f) => f.cle)).size, FAMILLES.length, 'clés uniques');
  assert.ok(Object.isFrozen(FAMILLES) && Object.isFrozen(FAMILLES[0]));
  const cles = GROUPES.map((g) => g.cle);
  for (const f of FAMILLES) {
    assert.match(f.cle, /^[a-z_]+$/, f.cle);
    assert.ok(f.libelle.length > 0, f.cle);
    assert.ok(Object.values(CATEGORIE).includes(f.categorie) && f.categorie !== 'a_preciser', `${f.cle} : catégorie`);
    assert.ok(cles.includes(f.groupe), `${f.cle} : groupe « ${f.groupe} »`);
    assert.ok(f.mots.length > 0, f.cle);
    for (const mot of f.mots) assert.equal(mot, normaliser(mot), `${f.cle} : « ${mot} » doit être normalisé`);
    assert.equal(new Set(f.etapes.map((e) => e.etape)).size, f.etapes.length, `${f.cle} : une étape ne figure qu'une fois`);
    for (const e of f.etapes) assert.ok(['parage', 'cuisson'].includes(e.etape), `${f.cle} : étape ${e.etape}`);
  }
  assert.equal(familleParCle('riz').libelle, 'riz');
  assert.equal(familleParCle('inconnue'), null);
  assert.equal(familleParCle('constructor'), null);
});

test('chaque produitBase de FAMILLES existe dans BASE_METIER pour la bonne étape, sans ambiguïté', () => {
  let nbLignes = 0;
  for (const f of FAMILLES) {
    for (const { etape, produitBase } of f.etapes) {
      const trouvees = BASE_METIER.filter((l) => l.etape === etape && l.produit === produitBase);
      assert.equal(trouvees.length, 1, `${f.cle} : « ${produitBase} » (${etape}) doit désigner une ligne de la base`);
      nbLignes += 1;
    }
  }
  assert.ok(nbLignes >= 15);
  // Gain de cuisson pour pâtes, riz, polenta, quinoa, semoule, légumineuses ; perte de parage pour les légumes racines et feuilles.
  for (const cle of ['pates_seches', 'riz', 'polenta', 'quinoa', 'semoule', 'legumineuses']) {
    assert.deepEqual(familleParCle(cle).etapes.map((e) => e.etape), ['cuisson'], cle);
  }
  for (const cle of ['pommes_de_terre', 'carottes', 'endives', 'blettes', 'poireaux', 'fenouil', 'courgettes']) {
    assert.deepEqual(familleParCle(cle).etapes.map((e) => e.etape), ['parage'], cle);
  }
});

test('la table ne contient aucun chiffre : ni nombre, ni chiffre dans un libellé', () => {
  for (const [nom, table] of [['FAMILLES', FAMILLES], ['GROUPES', GROUPES], ['MOTS_SANS_FAMILLE', MOTS_SANS_FAMILLE]]) {
    assert.equal(/\d/.test(JSON.stringify(table)), false, `${nom} : chiffre`);
    assert.equal(aucunNombre(table), true, `${nom} : nombre`);
  }
  assert.ok(Object.isFrozen(GROUPES) && Object.isFrozen(MOTS_SANS_FAMILLE));
});

test('groupes : libellés, chaque famille a un groupe, chaque groupe sert au moins une famille', () => {
  assert.deepEqual(GROUPES, [
    { cle: 'cereales', libelle: 'Pâtes, riz, céréales' },
    { cle: 'pommes_de_terre', libelle: 'Pommes de terre' },
    { cle: 'legumineuses', libelle: 'Légumineuses' },
    { cle: 'legumes', libelle: 'Légumes' },
  ]);
  for (const g of GROUPES) assert.ok(FAMILLES.some((f) => f.groupe === g.cle), `groupe sans famille : ${g.cle}`);
  const de = (cle) => familleParCle(cle).groupe;
  for (const cle of ['pates_seches', 'riz', 'polenta', 'quinoa', 'semoule', 'ble', 'orge', 'epeautre']) assert.equal(de(cle), 'cereales', cle);
  assert.equal(de('pommes_de_terre'), 'pommes_de_terre');
  assert.equal(de('legumineuses'), 'legumineuses');
  for (const cle of ['carottes', 'endives', 'blettes', 'poireaux', 'fenouil', 'courgettes']) assert.equal(de(cle), 'legumes', cle);
});

test('un seul lexique : aucun mot de l\'ancien lexique n\'est perdu et chaque mot garde sa catégorie', () => {
  const connus = new Set([...FAMILLES.flatMap((f) => f.mots), ...Object.values(MOTS_SANS_FAMILLE).flat()]);
  let total = 0;
  for (const [categorie, mots] of Object.entries(ANCIEN_LEXIQUE)) {
    for (const mot of mots) {
      total += 1;
      assert.ok(connus.has(mot), `mot perdu : ${mot}`);
      assert.equal(categoriePropose(mot), categorie, `${mot} (singulier)`);
      assert.equal(categoriePropose(`${mot}s`), categorie, `${mot} (pluriel)`);
    }
  }
  assert.equal(total, 175);
  // analyse-menu.js s'appuie sur savoir.js : il ne garde aucune liste de mots.
  const src = readFileSync(new URL('../app/js/domaine/analyse-menu.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/savoir\.js'/);
  assert.equal(/'(poulet|carotte|spaghetti)'/.test(src), false);
  assert.equal(categoriePropose('Pommes de terre'), lireNom('Pommes de terre').categorie);
});

test('chaque mot d\'une famille se lit comme cette famille, au singulier comme au pluriel', () => {
  for (const f of FAMILLES) {
    for (const mot of f.mots) {
      for (const forme of [mot, `${mot}s`]) {
        const lu = lireNom(forme);
        assert.equal(lu.famille?.cle, f.cle, `${forme} -> ${f.cle}`);
        assert.equal(lu.categorie, f.categorie, forme);
      }
    }
  }
});

test('familleDe : même règle de lecture que categoriePropose (premier mot, expression la plus longue, mot de forme)', () => {
  const cle = (nom) => familleDe(nom)?.cle ?? null;
  assert.equal(cle('riz'), 'riz');
  assert.equal(cle('Risotto aux champignons'), 'riz');
  for (const nom of ['pâtes', 'Spaghetti', 'tagliatelles', 'Macaroni gratinés']) assert.equal(cle(nom), 'pates_seches', nom);
  for (const nom of ['pommes vapeur', 'Pomme mousseline', 'pommes de terre', 'purée de pommes de terre']) assert.equal(cle(nom), 'pommes_de_terre', nom);
  assert.equal(cle('purée de carottes'), 'carottes', 'le mot de forme laisse décider le produit nommé ensuite');
  assert.equal(cle('purée'), null, 'sans produit nommé : pas de famille');
  assert.equal(cle('tagliatelle de légumes'), null);
  assert.equal(cle('tagliatelles'), 'pates_seches');
  assert.equal(cle('carottes rôties'), 'carottes');
  assert.equal(cle('poulet aux carottes'), null, 'le premier mot reconnu décide');
  assert.equal(cle('côte de bettes'), 'blettes', 'l\'expression la plus longue l\'emporte');
  assert.equal(cle('côte de porc'), null);
  for (const nom of ['lentilles', 'haricots blancs', 'pois chiches']) assert.equal(cle(nom), 'legumineuses', nom);
  assert.equal(cle('haricots verts'), null);
  // Les choux : une famille par chou nommé ; « chou » seul reste sans famille.
  assert.equal(cle('choux-fleurs'), 'chou_fleur');
  assert.equal(cle('chou rouge'), 'chou_blanc_rouge');
  assert.equal(cle('choux de Bruxelles'), 'choux_de_bruxelles');
  assert.equal(cle('brocoli'), 'brocoli');
  assert.equal(cle('chou'), null);
  assert.equal(categoriePropose('chou'), 'legume');
  // Une perte conditionnelle n'est pas appliquée d'office : tomates et poivrons n'ont pas de famille.
  assert.equal(cle('tomates'), null);
  assert.equal(cle('poivrons'), null);
  assert.equal(categoriePropose('tomates'), 'legume');
  // « pâté » et « pâte » ne sont pas des pâtes alimentaires : catégorie inchangée, pas de famille.
  assert.equal(cle('pâté en croûte'), null);
  assert.equal(cle('pâte feuilletée'), null);
  assert.equal(categoriePropose('pâté en croûte'), 'feculent');
  assert.equal(cle('ELEMENT_INCONNU_TEST'), null);
  assert.equal(cle(''), null);
  assert.equal(cle(null), null);
  assert.deepEqual(lireNom('rien de connu ici'), { categorie: 'a_preciser', famille: null });
  assert.equal(lireNom('riz').famille, FAMILLES.find((f) => f.cle === 'riz'));
});

test('appliquerSavoir : remplit famille, produit, rôle, type et étapes (milieu de la base), jamais le grammage', () => {
  const etat = etatInitial();
  etat.standards = { riz: { garniture: { valeur: 100, unite: 'g', etat: 'sec', h: null } } };
  const c = composant({ nom: 'riz', categorie: 'feculent' });
  assert.equal(appliquerSavoir(etat, c), c, 'renvoie le composant modifié');
  assert.equal(c.famille, 'riz');
  assert.equal(c.produitNom, 'riz');
  assert.equal(c.role, 'garniture');
  assert.equal(c.type, 'produit_simple');
  const ligne = ligneBase('cuisson', 'Riz');
  assert.deepEqual(c.etapes, [{ etape: 'cuisson', coefficient: milieu(ligne), statut: 'BASE_METIER_ESTIMATION', source: `base métier : ${ligne.texte}` }]);
  assert.deepEqual(c.grammage, composantVide('x').grammage, 'le grammage n\'est pas copié, même avec un standard défini');
  // Parage : une famille de légumes.
  const carottes = appliquerSavoir(etat, composant({ nom: 'Carottes', categorie: 'legume' }));
  assert.deepEqual(carottes.etapes.map((e) => [e.etape, e.coefficient, e.statut]), [['parage', milieu(ligneBase('parage', 'Carottes')), 'BASE_METIER_ESTIMATION']]);
  // Rôles : menu 1 -> plat principal ; menu 2 -> garniture, ou sauce pour une sauce.
  assert.equal(appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'feculent', menu: 1 })).role, 'plat_principal');
  assert.equal(appliquerSavoir(etat, composant({ nom: 'sauce TEST', categorie: 'sauce', menu: 2 })).role, 'sauce');
  // Type : générique si la catégorie est connue sans famille ; à préciser sinon.
  const poulet = appliquerSavoir(etat, composant({ nom: 'poulet', categorie: 'proteine' }));
  assert.deepEqual([poulet.type, poulet.famille, poulet.produitNom, poulet.etapes], ['generique', null, '', []]);
  assert.equal(appliquerSavoir(etat, composant({ nom: 'ELEMENT_INCONNU_TEST', categorie: 'a_preciser' })).type, 'a_preciser');
  // Une famille sans ligne de cuisson dans la base est reconnue, sans étape inventée.
  const orge = appliquerSavoir(etat, composant({ nom: 'orge', categorie: 'feculent' }));
  assert.deepEqual([orge.famille, orge.type, orge.etapes], ['orge', 'produit_simple', []]);
  // Toutes les familles : une étape par ligne de base trouvée.
  for (const f of FAMILLES) {
    const x = appliquerSavoir(etat, composant({ nom: f.mots[0], categorie: f.categorie }));
    assert.equal(x.famille, f.cle);
    assert.deepEqual(x.etapes.map((e) => e.etape), f.etapes.map((e) => e.etape), f.cle);
    assert.ok(x.etapes.every((e) => e.statut === 'BASE_METIER_ESTIMATION' && /^base métier : /.test(e.source)));
  }
});

test('appliquerSavoir : ne remplit que les champs vides, et respecte une catégorie corrigée par le chef', () => {
  const etat = etatInitial();
  const etapeChef = { etape: 'cuisson', coefficient: 5, statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' };
  const c = composant({ nom: 'riz', categorie: 'feculent', famille: 'carottes', produitNom: 'PRODUIT_CHEF_TEST', role: 'autre',
    type: 'preparation_maison', etapes: [etapeChef] });
  appliquerSavoir(etat, c);
  assert.deepEqual([c.famille, c.produitNom, c.role, c.type, c.etapes], ['carottes', 'PRODUIT_CHEF_TEST', 'autre', 'preparation_maison', [etapeChef]]);
  // Champs partiellement remplis : seuls les vides le sont.
  const d = composant({ nom: 'riz', categorie: 'feculent', role: 'plat_principal' });
  appliquerSavoir(etat, d);
  assert.deepEqual([d.role, d.famille, d.type], ['plat_principal', 'riz', 'produit_simple']);
  // Idempotent.
  const avant = structuredClone(d);
  appliquerSavoir(etat, d);
  assert.deepEqual(d, avant);
  // Catégorie corrigée par le chef : elle l'emporte sur la famille lue dans le nom.
  const e = appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'autre' }));
  assert.deepEqual([e.famille, e.type, e.etapes], [null, 'generique', []]);
});

test('grammageEffectif : plat, référence du nom, standard maison, base, sinon null (dans cet ordre)', () => {
  const etat = etatInitial();
  const c = appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'feculent' }));
  const reperes = [R.groupeCereales];
  assert.equal(grammageEffectif(etat, c), null, 'aucune source : null, rien n\'est inventé');
  assert.equal(grammageEffectif(etat, c, []), null);
  // 4. repère de la base : milieu de la fourchette, estimation.
  assert.deepEqual(grammageEffectif(etat, c, reperes), {
    valeur: 70, unite: 'g', etat: 'sec', statut: 'BASE_METIER_ESTIMATION',
    source: 'base métier : 60–80 g (repère du groupe « Pâtes, riz, céréales »)', origine: 'base',
  });
  // 3. standard maison : avant la base ; il reprend l'état de son poids.
  etat.standards = { riz: { garniture: { valeur: 90, unite: 'g', etat: 'cuit', h: null } } };
  assert.deepEqual(grammageEffectif(etat, c, reperes), {
    valeur: 90, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'standard maison', origine: 'standard',
  });
  // 2. référence mémorisée pour ce nom et ce rôle : avant le standard.
  etat.memoire = { riz: { parRole: { garniture: { grammage: { valeur: 77, unite: 'g', statut: 'SAISI_SERVICE', source: 'pesée', etat: 'cru_net' } } } } };
  assert.deepEqual(grammageEffectif(etat, c, reperes), {
    valeur: 77, unite: 'g', etat: 'cru_net', statut: 'SAISI_SERVICE', source: 'pesée', origine: 'reference',
  });
  c.role = 'plat_principal';
  assert.equal(grammageEffectif(etat, c, reperes), null, 'le rôle compte : ni référence, ni standard, ni repère pour un autre rôle');
  c.role = 'garniture';
  // 1. correction faite sur le plat : avant tout le reste ; sans état connu, la portion se lit « cuit ».
  c.grammage = { valeur: 55, unite: 'g', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY' };
  assert.deepEqual(grammageEffectif(etat, c, reperes), {
    valeur: 55, unite: 'g', etat: 'cuit', statut: 'RESTAURANT_VALIDE', source: 'TEST_ONLY', origine: 'plat',
  });
  c.grammage.etat = 'sec';
  assert.equal(grammageEffectif(etat, c, reperes).etat, 'sec');
  // Retour en arrière : supprimer chaque couche retombe sur la suivante.
  c.grammage.valeur = null;
  assert.equal(grammageEffectif(etat, c, reperes).origine, 'reference');
  delete etat.memoire.riz;
  assert.equal(grammageEffectif(etat, c, reperes).origine, 'standard');
  delete etat.standards.riz;
  assert.equal(grammageEffectif(etat, c, reperes).origine, 'base');
});

test('grammageEffectif : sources invalides ignorées, état ancien sans standards, clés dangereuses', () => {
  const etat = etatInitial();
  const c = appliquerSavoir(etat, composant({ nom: 'riz', categorie: 'feculent' }));
  for (const standard of [{ valeur: 0, unite: 'g', etat: 'sec' }, { valeur: -5, unite: 'g', etat: 'sec' },
    { valeur: '100', unite: 'g', etat: 'sec' }, { valeur: 100, unite: 'kg', etat: 'sec' }, null, 'texte']) {
    etat.standards = { riz: { garniture: standard } };
    assert.equal(grammageEffectif(etat, c), null, JSON.stringify(standard));
  }
  // Un standard sans état connu se lit « cuit ».
  etat.standards = { riz: { garniture: { valeur: 100, unite: 'g' } } };
  assert.equal(grammageEffectif(etat, c).etat, 'cuit');
  // Un repère invalide est ignoré.
  const mauvais = [{ ...R.groupeCereales, min: 0 }, { ...R.groupeCereales, min: 90, max: 80 }, { ...R.groupeCereales, unite: 'kg' },
    { ...R.groupeCereales, etat: 'inconnu' }];
  delete etat.standards;
  for (const ligne of mauvais) assert.equal(grammageEffectif(etat, c, [ligne]), null, JSON.stringify(ligne));
  // État sans `standards` ni `memoire` (ancien état) : pas d'erreur.
  assert.equal(grammageEffectif({}, c), null);
  assert.equal(grammageEffectif(null, c), null);
  assert.equal(grammageEffectif(etat, null), null);
  // Un nom comme « constructor » ou « __proto__ » ne lit rien dans l'héritage des objets.
  for (const nom of ['constructor', '__proto__', 'toString']) {
    assert.equal(grammageEffectif(etatInitial(), composant({ nom, role: 'garniture', famille: nom })), null, nom);
  }
});

test('grammageEffectif : une préparation maison se compte en quantité finie, état toujours « cuit »', () => {
  const etat = etatInitial();
  const prep = (champs) => composant({ nom: 'riz', categorie: 'feculent', type: 'preparation_maison', famille: 'riz', role: 'garniture', ...champs });
  // Le plat lui-même : l'état « sec » saisi n'a pas de sens pour une préparation.
  const a = prep({ grammage: { valeur: 60, unite: 'g', statut: 'RESTAURANT_VALIDE', source: '', etat: 'sec' } });
  assert.equal(grammageEffectif(etat, a).etat, 'cuit');
  // Un standard ou un repère en poids sec ou cru net n'est pas appliqué à une préparation ; en « cuit », oui.
  etat.standards = { riz: { garniture: { valeur: 100, unite: 'g', etat: 'sec', h: null } } };
  assert.equal(grammageEffectif(etat, prep({}), [R.groupeCereales]), null);
  assert.equal(grammageEffectif(etat, prep({ famille: 'carottes' }), [R.groupeLegumes]), null);
  etat.standards.riz.garniture.etat = 'cuit';
  assert.equal(grammageEffectif(etat, prep({}), [R.groupeCereales]).origine, 'standard');
  delete etat.standards.riz;
  assert.equal(grammageEffectif(etat, prep({ famille: 'carottes' }), [R.groupeLegumesCuit]).origine, 'base');
});

test('repères de la base par groupe : une ligne de groupe sert toutes les familles du groupe, la ligne de famille passe avant', () => {
  const etat = etatInitial();
  const plat = (cle, role = 'garniture') => appliquerSavoir(etat, composant({ nom: familleParCle(cle).mots[0], categorie: familleParCle(cle).categorie, menu: role === 'garniture' ? 2 : 1 }));
  // Ligne de groupe seule (rôle garniture) : toutes les familles du groupe « Pâtes, riz, céréales » la reçoivent.
  const groupe = [R.groupeCereales];
  const cereales = FAMILLES.filter((f) => f.groupe === 'cereales');
  assert.ok(cereales.length >= 8);
  for (const f of cereales) {
    const g = grammageEffectif(etat, plat(f.cle), groupe);
    assert.deepEqual([g.valeur, g.etat, g.origine, g.statut], [70, 'sec', 'base', 'BASE_METIER_ESTIMATION'], f.cle);
    assert.match(g.source, /groupe « Pâtes, riz, céréales »/);
  }
  // Une famille d'un autre groupe, ou un autre rôle, ne la reçoit pas.
  assert.equal(grammageEffectif(etat, plat('carottes'), groupe), null);
  assert.equal(grammageEffectif(etat, plat('riz', 'plat_principal'), groupe), null);
  // Ligne de famille ET ligne de groupe : la famille passe avant, même placée après dans la table.
  const deux = [R.groupeCereales, R.familleRiz];
  const riz = grammageEffectif(etat, plat('riz'), deux);
  assert.deepEqual([riz.valeur, riz.origine, riz.source], [50, 'base', 'base métier : 50 g']);
  assert.equal(grammageEffectif(etat, plat('semoule'), deux).valeur, 70, 'les autres familles du groupe gardent la ligne de groupe');
  assert.equal(grammageEffectif(etat, plat('pates_seches'), deux).valeur, 70);
  // Le rôle plat principal a sa propre ligne de groupe.
  assert.equal(grammageEffectif(etat, plat('riz', 'plat_principal'), [R.groupeCereales, R.groupeCerealesPrincipal]).valeur, 100);
  // Les légumes : ligne de groupe pour toutes, ligne de famille (« Carottes » : comparaison sans casse) pour les carottes.
  const legumes = [R.groupeLegumes, R.familleCarottes];
  assert.equal(grammageEffectif(etat, plat('courgettes'), legumes).valeur, 140);
  assert.equal(grammageEffectif(etat, plat('carottes'), legumes).valeur, 220);
  assert.equal(grammageEffectif(etat, plat('carottes'), legumes).etat, 'cru_net');
  // Le standard maison reste par famille et par rôle, et passe avant les deux niveaux de la base.
  etat.standards = { courgettes: { garniture: { valeur: 33, unite: 'g', etat: 'cuit', h: null } } };
  assert.deepEqual([grammageEffectif(etat, plat('courgettes'), legumes).origine, grammageEffectif(etat, plat('courgettes'), legumes).valeur], ['standard', 33]);
  assert.equal(grammageEffectif(etat, plat('carottes'), legumes).origine, 'base', 'le standard d\'une famille ne sert pas aux autres');
  // Libellé comparé sans accent ni casse ; une ligne dont le produit n'est ni une famille ni un groupe n'est jamais prise.
  assert.equal(grammageEffectif(etatInitial(), plat('riz'), [{ ...R.groupeCereales, produit: '  PATES, riz, CEREALES ' }]).valeur, 70);
  assert.equal(grammageEffectif(etatInitial(), plat('riz'), [{ ...R.groupeCereales, produit: 'Céréales' }]), null);
});

test('lignesStandards : une ligne par famille et par rôle utile, avec groupe, standard et repère de la base', () => {
  const etat = etatInitial();
  assert.deepEqual(ROLES_STANDARD, [ROLE.plat_principal, ROLE.garniture]);
  const vide = lignesStandards(etat, []);
  assert.equal(vide.length, FAMILLES.length * ROLES_STANDARD.length);
  assert.deepEqual(Object.keys(vide[0]), ['cleFamille', 'libelle', 'categorie', 'groupe', 'role', 'standard', 'repereBase']);
  assert.deepEqual([vide[0].cleFamille, vide[0].role, vide[1].cleFamille, vide[1].role], [FAMILLES[0].cle, 'plat_principal', FAMILLES[0].cle, 'garniture']);
  for (const l of vide) {
    const f = familleParCle(l.cleFamille);
    assert.deepEqual([l.libelle, l.categorie, l.groupe], [f.libelle, f.categorie, f.groupe]);
    assert.deepEqual([l.standard, l.repereBase], [null, null]);
  }
  assert.deepEqual(new Set(vide.map((l) => l.groupe)), new Set(GROUPES.map((g) => g.cle)));
  // Standard enregistré : copie de la valeur, de l'unité, de l'état et de l'horodatage. Un standard invalide est ignoré.
  etat.standards = {
    riz: { garniture: { valeur: 100, unite: 'g', etat: 'sec', h: '2026-10-01T08:00:00.000Z' }, plat_principal: { valeur: 0, unite: 'g', etat: 'sec', h: null } },
    carottes: { sauce: { valeur: 10, unite: 'g', etat: 'cuit', h: null } },
  };
  const lignes = lignesStandards(etat, []);
  const trouver = (cle, role) => lignes.find((l) => l.cleFamille === cle && l.role === role);
  assert.deepEqual(trouver('riz', 'garniture').standard, { valeur: 100, unite: 'g', etat: 'sec', h: '2026-10-01T08:00:00.000Z' });
  assert.equal(trouver('riz', 'plat_principal').standard, null, 'valeur nulle : ignorée');
  assert.equal(lignes.some((l) => l.role === 'sauce'), false, 'seuls plat principal et garniture sont listés');
  // Repère de la base : la ligne de la famille, à défaut la ligne du groupe (même recherche que grammageEffectif).
  const avecBase = lignesStandards(etat, [R.groupeCereales, R.familleRiz, R.groupeLegumes]);
  const rizBase = avecBase.find((l) => l.cleFamille === 'riz' && l.role === 'garniture').repereBase;
  assert.deepEqual([rizBase.portee, rizBase.valeur, rizBase.etat, rizBase.texte, rizBase.produit], ['famille', 50, 'sec', '50 g', 'riz']);
  const semouleBase = avecBase.find((l) => l.cleFamille === 'semoule' && l.role === 'garniture').repereBase;
  assert.deepEqual([semouleBase.portee, semouleBase.groupe, semouleBase.valeur, semouleBase.min, semouleBase.max], ['groupe', 'cereales', 70, 60, 80]);
  assert.equal(avecBase.find((l) => l.cleFamille === 'semoule' && l.role === 'plat_principal').repereBase, null, 'autre rôle : pas de repère');
  assert.equal(avecBase.find((l) => l.cleFamille === 'carottes' && l.role === 'garniture').repereBase.valeur, 140);
  assert.equal(avecBase.find((l) => l.cleFamille === 'pommes_de_terre' && l.role === 'garniture').repereBase, null);
  // Par défaut, les repères viennent de PORTIONS_BASE : la fonction ne plante pas sur l'état initial.
  assert.equal(lignesStandards(etatInitial()).length, vide.length);
  assert.equal(ETAT_POIDS.sec, 'sec');
});
