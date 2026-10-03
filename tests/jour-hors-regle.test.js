// Feuille Jour : les avances hors règle (plus de deux jours) restent visibles mais repliées en une ligne,
// pour ne pas allonger la liste de travail. Constaté sur le rendu réel à 390 px : 13 lignes hors règle empilées.

import test, { after, before } from 'node:test';
import { setTimeout as attendre } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirStandard } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let vueJour;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueJour = await import('../app/js/ui/vue-jour.js');
});
after(() => dom.restaurer());

function semaine() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());     // 2 jours depuis le samedi : dans la règle
  definirMenu(e, S.mardi, 1, 'carottes', h()); // 3 jours : hors règle
  definirMenu(e, S.mercredi, 1, 'quinoa', h()); // 4 jours : hors règle
  for (const jour of [S.lundi, S.mardi, S.mercredi]) definirPrevision(e, jour, 1, 20, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirStandard(e, 'quinoa', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  return e;
}

test('jour : les avances dans la règle sont dans la liste, les avances hors règle sont repliées avec leur compte', () => {
  magasin.remplacer(semaine());
  const noeud = vueJour.rendre(magasin.etat(), S.samediPrecedent);
  const replies = noeud.tous((x) => x.balise === 'details');
  const horsRegle = replies.find((d) => /hors règle/.test(d.querySelector('summary').textContent));
  assert.ok(horsRegle, 'une ligne repliée « hors règle » existe');
  assert.match(horsRegle.querySelector('summary').textContent, /2 avances hors règle/);
  assert.equal(horsRegle.open, false, 'repliée par défaut');
  const texteReplie = horsRegle.textContent;
  assert.match(texteReplie, /carottes/);
  assert.match(texteReplie, /quinoa/);
  assert.doesNotMatch(texteReplie, /riz/, 'le riz du lundi est dans la règle : il reste dans la liste');
  const texteTotal = noeud.textContent;
  for (const nom of ['riz', 'carottes', 'quinoa']) assert.match(texteTotal, new RegExp(nom), `${nom} reste visible quelque part`);
});

test('jour : la barre des jours amène le jour affiché à l\'écran (le samedi n\'est pas caché à droite)', async () => {
  const { Element } = await import('./aide-dom.js');
  const appels = [];
  Element.prototype.scrollIntoView = function scrollIntoView(options) { appels.push({ libelle: this.attributs['aria-label'], options }); };
  try {
    magasin.remplacer(semaine());
    vueJour.rendre(magasin.etat(), S.samediPrecedent);
    await attendre(20); // le faux DOM ne garde pas les minuteries en vie : on attend avec le minuteur de Node
  } finally { delete Element.prototype.scrollIntoView; }
  const actifs = appels.filter((a) => /jour affiché/.test(a.libelle));
  assert.ok(actifs.length >= 1, 'le jour affiché est amené à l\'écran');
  assert.ok(actifs.every((a) => /samedi 3 octobre/.test(a.libelle)), 'et c\'est bien le jour affiché');
  assert.equal(actifs.at(-1).options.inline, 'center');
});
