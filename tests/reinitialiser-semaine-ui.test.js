// « Réinitialiser la semaine » à l'écran (faux DOM). Les dates se calculent depuis aujourd'hui (horloge réelle de l'application).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { etatVide, h } from './aide.js';

let dom; let magasin; let vueSemaine; let vueImport; let actions; let dates; let LUNDI_FUTUR; let LUNDI_COURANT;
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const parTexte = (n, t) => boutons(n).find((b) => b.textContent === t);
const dernier = () => panneauxOuverts(dom.corps).at(-1);

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueSemaine = await import('../app/js/ui/vue-semaine.js');
  vueImport = await import('../app/js/ui/vue-import.js');
  actions = await import('../app/js/domaine/actions.js');
  dates = await import('../app/js/domaine/dates.js');
  LUNDI_COURANT = dates.lundiDe(magasin.aujourdhui());
  LUNDI_FUTUR = dates.ajouterJours(LUNDI_COURANT, 7);
});
after(() => dom.restaurer());

const avecMenus = (lundi) => {
  const e = etatVide();
  actions.definirMenu(e, lundi, 1, 'riz, carottes', h());
  return e;
};

async function ouvrirActions(lundi) {
  magasin.remplacer(avecMenus(lundi));
  const page = vueSemaine.rendre(magasin.etat(), lundi, 'tableau');
  await parClasse(page, 'sa-actions')[0].click();
  return dernier();
}

test('« Réinitialiser la semaine » : visible pour une semaine à venir, cachée pour la semaine en cours', async () => {
  assert.ok(parTexte(await ouvrirActions(LUNDI_FUTUR), 'Réinitialiser la semaine'));
  assert.equal(parTexte(await ouvrirActions(LUNDI_COURANT), 'Réinitialiser la semaine'), undefined);
});

test('confirmation danger, puis semaine vidée, message et retour sur l\'import de cette semaine', async () => {
  const feuille = await ouvrirActions(LUNDI_FUTUR);
  await parTexte(feuille, 'Réinitialiser la semaine').click();
  const conf = dernier();
  assert.match(conf.textContent, /Réinitialiser la semaine du lundi \d+ \w+ ?/);
  assert.match(conf.textContent, /Les menus, couverts, préparations \(même déjà faites\) et fiches de fonction de cette semaine seront supprimés\. Les allergies saisies sur ces fiches sont perdues\. Vos standards et ce que Sanji a appris ne changent pas\./);
  assert.match(parTexte(conf, 'Réinitialiser').className, /btn-danger/);
  assert.ok(magasin.etat().jours[LUNDI_FUTUR], 'rien avant la confirmation');
  await conf.querySelector('form').declencher('submit');
  assert.equal(magasin.etat().jours[LUNDI_FUTUR], undefined);
  assert.equal(location.hash, `#/import/${LUNDI_FUTUR}`);
  assert.match(dom.document.getElementById('messages').textContent, /Semaine réinitialisée\./);
});

test('écran Import : le bouton n\'existe que pour une semaine à venir non vide', () => {
  magasin.remplacer(avecMenus(LUNDI_FUTUR));
  assert.ok(parTexte(vueImport.rendre(magasin.etat(), LUNDI_FUTUR), 'Réinitialiser la semaine'));
  magasin.remplacer(etatVide());
  assert.equal(parTexte(vueImport.rendre(magasin.etat(), LUNDI_FUTUR), 'Réinitialiser la semaine'), undefined, 'semaine vide');
  magasin.remplacer(avecMenus(LUNDI_COURANT));
  assert.equal(parTexte(vueImport.rendre(magasin.etat(), LUNDI_COURANT), 'Réinitialiser la semaine'), undefined, 'semaine en cours');
});
