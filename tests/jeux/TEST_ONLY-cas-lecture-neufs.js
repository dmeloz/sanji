// JEU DE TEST — TEST_ONLY. Cas neufs écrits sans lire le lecteur, pour mesurer la généralisation ; à valider par la propriétaire

const TABLEAU = [
  { numero: 1, intitule: "Fusilli aux courgettes et menthe", menu: 1, auPoste: ["fusilli","courgettes","menthe"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 2, intitule: "Casarecce au chèvre frais et roquette", menu: 1, auPoste: ["casarecce","chèvre","roquette"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 3, intitule: "Linguine aux palourdes", menu: 1, auPoste: ["linguine","palourdes"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 4, intitule: "Risotto aux cèpes et parmesan", menu: 1, auPoste: ["riz","cèpes","parmesan"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 5, intitule: "Penne à la crème et aux lardons", menu: 1, auPoste: ["penne","crème","lardons"], horsPoste: [], aConfirmer: [], note: "" },
  { numero: 6, intitule: "Rigatoni au pesto", menu: 1, auPoste: ["rigatoni","pesto"], horsPoste: [], aConfirmer: [], note: "Pesto compté comme sauce écrite." },
  { numero: 7, intitule: "Tagliolini à la truffe", menu: 1, auPoste: ["tagliolini","truffe"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 8, intitule: "Risotto aux petits pois et menthe", menu: 1, auPoste: ["riz","petits pois","menthe"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 9, intitule: "Spaghetti aux sardines et fenouil", menu: 1, auPoste: ["spaghetti","sardines","fenouil"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 10, intitule: "Orecchiette aux brocolis et anchois", menu: 1, auPoste: ["orecchiette","brocolis","anchois"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 11, intitule: "Risotto au chorizo et poivrons", menu: 1, auPoste: ["riz","chorizo","poivrons"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 12, intitule: "Farfalle au poulet sauce tomate", menu: 1, auPoste: ["farfalle","poulet","sauce tomate"], horsPoste: [], aConfirmer: [], note: "" },
  { numero: 13, intitule: "Risotto aux noix de Saint-Jacques et safran", menu: 1, auPoste: ["riz","saint-jacques","safran"], horsPoste: [], aConfirmer: ["sauce"], note: "Douteux : la forme de « noix de saint-jacques » comme un seul élément." },
  { numero: 14, intitule: "Fettuccine au saumon et à l'aneth", menu: 1, auPoste: ["fettuccine","saumon","aneth"], horsPoste: [], aConfirmer: ["sauce"], note: "" },
  { numero: 15, intitule: "Filet de cabillaud, riz basmati et haricots verts", menu: 2, auPoste: ["riz basmati","haricots verts"], horsPoste: ["cabillaud"], aConfirmer: [], note: "" },
  { numero: 16, intitule: "Magret de canard, gratin dauphinois et choux de Bruxelles", menu: 2, auPoste: ["gratin dauphinois","choux de bruxelles"], horsPoste: ["canard"], aConfirmer: [], note: "Douteux : « magret » peut être attendu tel quel dans horsPoste." },
  { numero: 17, intitule: "Côtelettes d'agneau, polenta et ratatouille", menu: 2, auPoste: ["polenta","ratatouille"], horsPoste: ["agneau"], aConfirmer: [], note: "Douteux : ratatouille est un légume composé, accepté comme un élément." },
  { numero: 18, intitule: "Escalope de veau, purée de pommes de terre et épinards", menu: 2, auPoste: ["purée","épinards"], horsPoste: ["veau"], aConfirmer: [], note: "" },
  { numero: 19, intitule: "Saumon rôti, pommes vapeur ou riz pilaf", menu: 2, auPoste: ["pommes vapeur","riz pilaf"], horsPoste: ["saumon"], aConfirmer: ["choix"], note: "Douteux : « ou » = choix à confirmer ; les règles ne le disent pas." },
  { numero: 20, intitule: "Filets de truite meunière, pommes nature et carottes glacées", menu: 2, auPoste: ["pommes nature","carottes glacées"], horsPoste: ["truite"], aConfirmer: [], note: "" },
  { numero: 21, intitule: "Jambon braisé sauce madère, gratin de pâtes et brocoli", menu: 2, auPoste: ["gratin de pâtes","brocoli"], horsPoste: ["jambon","sauce madère"], aConfirmer: [], note: "" },
  { numero: 22, intitule: "Cuisse de canard confite, lentilles et pommes sautées", menu: 2, auPoste: ["lentilles","pommes sautées"], horsPoste: ["canard"], aConfirmer: [], note: "Douteux : lentilles = féculent ou légume ; au poste dans les deux cas." },
  { numero: 23, intitule: "Longe de porc rôtie, spätzli et chou rouge", menu: 2, auPoste: ["spätzli","chou rouge"], horsPoste: ["porc"], aConfirmer: [], note: "" },
  { numero: 24, intitule: "Joue de bœuf braisée, polenta crémeuse et carottes", menu: 2, auPoste: ["polenta","carottes"], horsPoste: ["bœuf"], aConfirmer: [], note: "" },
  { numero: 25, intitule: "Dos de lieu noir riz sauvage et poireaux", menu: 2, auPoste: ["riz sauvage","poireaux"], horsPoste: ["lieu noir"], aConfirmer: [], note: "Sans virgule." },
  { numero: 26, intitule: "Poulet rôti, frites, haricots et carottes", menu: 2, auPoste: ["frites","haricots","carottes"], horsPoste: ["poulet"], aConfirmer: [], note: "" },
  { numero: 27, intitule: "Blanquette de veau, riz pilaf", menu: 2, auPoste: ["riz pilaf"], horsPoste: ["blanquette"], aConfirmer: [], note: "Piège : plat composé (veau + sauce), hors poste. Douteux : « veau » aussi acceptable." },
  { numero: 28, intitule: "Pot-au-feu de bœuf, pommes de terre et légumes", menu: 2, auPoste: ["pommes de terre","légumes"], horsPoste: ["pot-au-feu"], aConfirmer: [], note: "Piège : plat composé ; les légumes du pot-au-feu pourraient être dans le plat. Douteux." },
  { numero: 29, intitule: "Longeole, rösti et chou", menu: 2, auPoste: ["rösti","chou"], horsPoste: ["longeole"], aConfirmer: [], note: "Piège : forme régionale (rösti) et mot rare (longeole)." },
  { numero: 30, intitule: "Daurade façon thaï, riz gluant et pak-choï", menu: 2, auPoste: ["riz gluant","pak-choï"], horsPoste: ["daurade"], aConfirmer: ["thaï"], note: "Piège : « façon thaï » = préparation inconnue, à préciser." },
];

TABLEAU.forEach(cas => Object.freeze(cas));
TABLEAU.etiquette = 'TEST_ONLY';

export const CAS_NEUFS = Object.freeze(TABLEAU);
