// Vocabulaire culinaire GÉNÉRIQUE servant à lire un intitulé de plat (analyse-menu.js : lirePlat).
// Ni chiffre, ni quantité, ni nom de plat propre à un restaurant : seulement des mots du métier.
// Les mots sont écrits au singulier, sans accent, en minuscules ; le pluriel est toléré à la comparaison.
// Ce vocabulaire complète le lexique de savoir.js (familles et mots sans famille) sans le remplacer.

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    Object.values(valeur).forEach(geler);
    Object.freeze(valeur);
  }
  return valeur;
}

/** Variantes de nom : [écriture rencontrée, écriture retenue]. Appliquées d'abord, le texte original est conservé. */
export const ALIAS = geler([
  ['cepe', 'bolet'], ['funghi', 'champignon'], ['fungi', 'champignon'], ['porcini', 'bolet'],
  ['pdt', 'pomme de terre'], ['patate', 'pomme de terre'], ['grenaille', 'pomme grenaille'],
  ['knopfli', 'spatzli'], ['spaetzli', 'spatzli'], ['spaetzle', 'spatzli'],
  ['parmigiano', 'parmesan'], ['zafferano', 'safran'], ['gamberoni', 'gambas'], ['gamberi', 'gambas'],
  ['capesante', 'noix de saint-jacques'], ['nero di seppia', 'encre de seiche'],
  ['bolognese', 'bolognaise'], ['arrabiata', 'arrabbiata'],
  // Variantes d'écriture courantes sur une feuille imprimée.
  ['artichaud', 'artichaut'], ['pack choi', 'pak choi'], ['chimichuri', 'chimichurri'],
]);

/** Formes de pâtes (et assimilées) : le féculent de base d'une recette de pâtes. */
export const FORMES_PATES = geler([
  'trofie', 'penne', 'tagliatelle', 'spaghetti', 'linguine', 'pappardelle', 'mezze maniche', 'strigoli', 'farfalle',
  'fusilli', 'rigatoni', 'macaroni', 'orecchiette', 'nouille', 'pate', 'tortiglioni', 'bucatini', 'conchiglie',
  'cavatappi', 'gnocchi', 'ravioli', 'tortellini', 'cannelloni', 'lasagne', 'spatzli', 'vermicelle', 'capellini',
  // Autres formes courantes (le menu 1 étant toujours des pâtes ou un risotto, une forme inconnue ne doit pas empêcher la lecture).
  'casarecce', 'tagliolini', 'tagliolino', 'tagliarini', 'fettuccine', 'fettucine', 'paccheri', 'gemelli', 'garganelli',
  'cavatelli', 'strozzapreti', 'trenette', 'mafalde', 'reginette', 'scialatielli', 'pici', 'bigoli', 'ditalini', 'fregola',
  'orzo', 'risoni', 'ziti', 'calamarata', 'mezzelune', 'agnolotti', 'cappelletti', 'tortelloni', 'maltagliati', 'sedanini',
  'cresta di gallo', 'radiatori', 'gnocchetti', 'malloreddus', 'chitarra', 'spaghettini', 'spaghettoni', 'rigatoncini',
]);

/** Herbes aromatiques : elles vont à la botte ou à la pièce, jamais à la portion. */
export const HERBES = geler([
  'aneth', 'basilic', 'persil', 'ciboulette', 'estragon', 'thym', 'romarin', 'sauge', 'menthe', 'coriandre', 'cerfeuil',
  'origan', 'laurier', 'citronnelle', 'herbe', 'fines herbes', 'marjolaine', 'liveche',
]);

/** Épices et aromates : traités comme les herbes (une pincée, pas une portion). */
export const EPICES = geler(['safran', 'curcuma', 'paprika', 'cumin', 'piment', 'poivre', 'muscade', 'vanille', 'cannelle']);

export const CHAMPIGNONS = geler([
  'bolet', 'morille', 'girolle', 'champignon', 'pleurote', 'cepe de bordeaux', 'trompette de la mort', 'shiitake',
  'chanterelle',
]);

/** Produits qui manquent au lexique de savoir.js : poissons, crustacés, charcuteries, fromages, divers. */
export const PRODUITS = geler({
  proteine: ['bar', 'loup', 'homard', 'langouste', 'scampi', 'crabe', 'noix de saint-jacques', 'saint-jacques', 'fruits de mer',
    'encre de seiche', 'nduja', 'chorizo', 'pancetta', 'speck', 'lardon', 'saumon fume', 'truite fumee', 'anchois', 'thon',
    'poisson', 'mozzarella', 'brochette', 'salami', 'chili con carne'],
  fromage: ['gorgonzola', 'parmesan', 'ricotta', 'ricotta salee', 'fromage', 'pecorino', 'chevre', 'feta', 'emmental',
    'gruyere', 'mascarpone', 'burrata', 'beurre'],
  legume: ['pickles', 'citron', 'roquette', 'pak choi', 'piperade'],
  feculent: ['quinotto', 'pomme paillasson', 'pomme miette'],
  autre: ['champagne', 'vin', 'vin blanc', 'vin rouge', 'bouillon', 'noix', 'pignon', 'amande'],
});

/**
 * Sauces : { cle, nom, alias, ingredients, allergenes, recette }.
 *  - `alias` : mots qui désignent la sauce quand ils se lisent seuls dans l'intitulé (liste vide = reconnue seulement
 *    après le mot « sauce »).
 *  - `ingredients` et `allergenes` : ce qui est POSSIBLE, jamais ce qui est certain ; sans aucune quantité.
 *  - `recette` : vrai quand le nom désigne une recette maison à confirmer (on n'en devine pas le contenu).
 */
export const SAUCES = geler([
  { cle: 'tomate', nom: 'sauce tomate', alias: ['napoli', 'napolitaine'], ingredients: ['tomate', 'oignon', 'ail', 'basilic'], allergenes: ['celeri'], recette: false },
  { cle: 'arrabbiata', nom: 'sauce arrabbiata', alias: ['arrabbiata'], ingredients: ['tomate', 'piment', 'ail'], allergenes: [], recette: false },
  { cle: 'pesto', nom: 'pesto', alias: ['pesto'], ingredients: ['basilic', 'pignon', 'parmesan', 'ail', 'huile'], allergenes: ['fruits a coque', 'lait'], recette: false },
  { cle: 'creme', nom: 'sauce à la crème', alias: ['creme'], ingredients: ['creme'], allergenes: ['lait'], recette: false },
  { cle: 'creme_fumet', nom: 'crème et fond de poisson', alias: [], ingredients: ['creme', 'fond de poisson'], allergenes: ['lait', 'poisson'], recette: false },
  { cle: 'champignons', nom: 'sauce aux champignons', alias: [], ingredients: ['champignon', 'morille', 'creme'], allergenes: ['lait'], recette: false },
  { cle: 'gorgonzola', nom: 'sauce gorgonzola', alias: [], ingredients: ['gorgonzola', 'creme'], allergenes: ['lait'], recette: false },
  { cle: 'carbonara', nom: 'carbonara', alias: ['carbonara'], ingredients: [], allergenes: ['oeuf', 'lait'], recette: true },
  { cle: 'amatriciana', nom: 'amatriciana', alias: ['amatriciana'], ingredients: [], allergenes: [], recette: true },
  { cle: 'bolognaise', nom: 'sauce bolognaise', alias: ['bolognaise'], ingredients: [], allergenes: ['celeri'], recette: true },
  { cle: 'beurre_blanc', nom: 'beurre blanc', alias: ['beurre blanc'], ingredients: ['beurre', 'echalote', 'vin blanc'], allergenes: ['lait', 'sulfites'], recette: false },
  { cle: 'bisque', nom: 'bisque', alias: ['bisque'], ingredients: ['crustaces', 'creme'], allergenes: ['crustaces', 'lait'], recette: false },
  { cle: 'fruits_de_mer_tomate', nom: 'sauce fruits de mer et tomate', alias: [], ingredients: ['fruits de mer', 'tomate'], allergenes: ['crustaces', 'mollusques'], recette: false },
  { cle: 'curry', nom: 'sauce curry', alias: ['curry'], ingredients: ['curry', 'lait de coco', 'creme'], allergenes: ['lait'], recette: true },
  { cle: 'safran', nom: 'sauce safran', alias: [], ingredients: ['safran', 'creme'], allergenes: ['lait'], recette: false },
  { cle: 'jus_reduit', nom: 'jus réduit', alias: ['jus reduit'], ingredients: ['jus', 'fond'], allergenes: ['celeri'], recette: false },
  { cle: 'huile_herbes', nom: 'huile d\'olive et herbes', alias: [], ingredients: ['huile d\'olive', 'herbes'], allergenes: [], recette: false },
  { cle: 'tartare', nom: 'sauce tartare', alias: ['tartare'], ingredients: ['mayonnaise', 'cornichon', 'capres'], allergenes: ['oeuf', 'moutarde'], recette: false },
  { cle: 'aigre_douce', nom: 'sauce aigre-douce', alias: ['aigre-douce'], ingredients: ['vinaigre', 'sucre'], allergenes: [], recette: false },
  { cle: 'salsa_verde', nom: 'salsa verde', alias: ['salsa verde'], ingredients: ['persil', 'capres', 'ail', 'huile'], allergenes: ['poisson'], recette: true },
  { cle: 'chimichurri', nom: 'chimichurri', alias: ['chimichurri'], ingredients: ['persil', 'ail', 'origan', 'vinaigre', 'huile'], allergenes: [], recette: true },
  { cle: 'meuniere', nom: 'beurre meunière', alias: [], ingredients: ['beurre', 'citron'], allergenes: ['lait', 'gluten'], recette: false },
]);

/** Mots de liaison : on ne coupe jamais à l'intérieur d'une expression, et on les retire au bord d'un élément. */
export const MOTS_DE_LIAISON = geler(['de', 'du', 'des', 'd', 'au', 'aux', 'a', 'la', 'le', 'les', 'l', 'en', 'et', 'e', 'sur',
  'sous', 'avec', 'alla', 'al', 'ai', 'alle', 'agli', 'all', 'dei', 'di', '&']);

const sans = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ADJECTIFS = new Set(['frais', 'fraiche', 'fin', 'fine', 'cisele', 'hache']);

/** Vrai si le texte ne nomme que des herbes ou des épices (« aneth », « basilic frais », « fines herbes »). */
export function estHerbe(texte) {
  const connus = new Set([...HERBES, ...EPICES].map(sans));
  const mots = sans(texte).replace(/[’']/g, ' ').replace(/[^a-z0-9-]+/g, ' ').trim().split(' ')
    .filter((m) => m !== '' && !MOTS_DE_LIAISON.includes(m) && !ADJECTIFS.has(m.replace(/[sx]$/, '')));
  const nu = (m) => connus.has(m) || connus.has(m.replace(/[sx]$/, '')) || m === 'fines';
  return mots.length > 0 && mots.every(nu);
}

/** Texte normalisé dont les variantes de nom sont remplacées (« cèpe » devient « bolet »). Sert à lire un nom, jamais à l'afficher. */
export function canonique(texte) {
  let t = ` ${sans(texte).replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()} `;
  for (const [de, vers] of [...ALIAS].sort((a, b) => b[0].length - a[0].length)) {
    t = t.replace(new RegExp(`(?<= )${de.split(' ').map((m) => `${m}[sx]?`).join(' ')}(?= )`, 'g'), vers);
  }
  return t.trim();
}
