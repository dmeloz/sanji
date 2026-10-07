// Réglages > Standards de base sous faux DOM : lignes, gestes « Changer » et « Revenir au standard », avertissement non
// bloquant. Ce n'est pas un test dans un navigateur (mise en page, tactile, IndexedDB).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { boutons, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { standardDeBase } from '../app/js/domaine/standards-base.js';
import { etatVide } from './aide.js';

let dom;
let magasin;
let reglages;
let routeur;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  reglages = await import('../app/js/ui/vue-reglages.js');
  routeur = await import('../app/js/ui/routeur.js');
});
after(() => dom.restaurer());

const nettoyer = () => {
  reglages.oublierReplis();
  for (const d of dom.corps.tous((x) => x.balise === 'dialog')) d.remove();
  for (const m of dom.corps.tous((x) => x.attributs.role === 'status' || x.attributs.role === 'alert')) m.remove();
};
const ouvert = () => panneauxOuverts(dom.corps)[0];
const page = () => reglages.rendre(magasin.etat(), 'standards-base');
const ligneDe = (racine, libelle) => racine.tous((x) => x.balise === 'li' && x.textContent.startsWith(libelle))[0];
const bouton = (noeud, texte) => boutons(noeud).find((b) => b.textContent === texte);
const controleDe = (d, debut) => {
  const etiquette = d.tous((x) => x.balise === 'label' && x.textContent.startsWith(debut))[0];
  assert.ok(etiquette, `champ « ${debut} » introuvable`);
  return d.tous((x) => x.attributs.id === etiquette.attributs.for)[0];
};
const alertes = (d) => d.tous((x) => x.attributs.role === 'alert' && !x.hidden).map((x) => x.textContent);

test('route : #/reglages/standards-base est une sous-page de Réglages, listée à la racine', () => {
  assert.ok(reglages.CLES_RUBRIQUES.includes('standards-base'));
  assert.deepEqual(routeur.analyserHash('#/reglages/standards-base', '2026-10-05'), { vue: 'reglages', param: 'standards-base' });
  assert.equal(reglages.titre('standards-base'), 'Standards de base');
  magasin.remplacer(etatVide());
  const racine = reglages.rendre(magasin.etat(), null);
  assert.ok(racine.tous((x) => x.balise === 'a').some((a) => a.attributs.href === '#/reglages/standards-base'));
});

test('page : un repli par usage, une ligne par sujet avec valeur, fourchette et provenance', () => {
  magasin.remplacer(etatVide());
  const p = page();
  const replis = p.tous((x) => x.balise === 'details');
  assert.deepEqual(replis.map((d) => d.querySelector('summary').textContent.split(' · ')[0]),
    ['Rendements de parage', 'Rendements de cuisson', 'Conservation', 'Cuisson', 'Températures']);
  const ligne = ligneDe(p, 'Carottes');
  assert.ok(ligne, 'ligne des carottes');
  const base = standardDeBase('carottes', 'rendement_parage');
  assert.match(ligne.textContent, /Fourchette : 12–25 % de perte/);
  assert.match(ligne.textContent, base.origine === 'referentiel' ? /référentiel/ : /base métier/);
  assert.ok(bouton(ligne, 'Changer'));
  assert.equal(bouton(ligne, 'Revenir au standard'), undefined, 'rien à rétablir tant que rien n\'est changé');
  assert.doesNotMatch(p.textContent, /undefined|NaN|null/);
});

test('« Changer » ouvre un panneau, enregistre la valeur ; elle passe devant et « Revenir au standard » la retire', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  bouton(ligneDe(page(), 'Carottes'), 'Changer').click();
  const d = ouvert();
  assert.ok(d, 'panneau ouvert');
  controleDe(d, 'Votre valeur').value = '33,5';
  await d.enfants[0].declencher('submit');
  assert.deepEqual(alertes(d), []);
  assert.equal(d.open, false);
  assert.equal(magasin.etat().ajustements['rendement_parage|carottes'].valeur, 33.5);

  const ligne = ligneDe(page(), 'Carottes');
  assert.match(ligne.textContent, /33,5 % de perte/);
  assert.match(ligne.textContent, /votre valeur/);
  assert.match(ligne.textContent, /Standard de base : /);
  bouton(ligne, 'Revenir au standard').click();
  assert.deepEqual(magasin.etat().ajustements, {});
  assert.doesNotMatch(ligneDe(page(), 'Carottes').textContent, /votre valeur/);
});

test('« Changer » sans valeur ou avec une valeur impossible : le panneau reste ouvert, rien n\'est écrit', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  bouton(ligneDe(page(), 'Carottes'), 'Changer').click();
  const d = ouvert();
  const champ = controleDe(d, 'Votre valeur');
  champ.value = '';
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /Saisissez la valeur/);
  champ.value = '120';
  await d.enfants[0].declencher('submit');
  assert.match(alertes(d).join(' '), /entre 0 et moins de 100/);
  assert.equal(d.open, true);
  assert.deepEqual(magasin.etat().ajustements, {});
});

test('hygiène : une valeur au-delà de la limite est enregistrée et l\'avertissement s\'affiche, sans bloquer', async () => {
  nettoyer();
  magasin.remplacer(etatVide());
  const froid = standardDeBase(null, 'temperature', { regle: 'stockage_froid' });
  const ligne = page().tous((x) => x.balise === 'li' && /Stockage au froid/.test(x.textContent))[0];
  assert.ok(ligne, 'ligne du stockage au froid');
  bouton(ligne, 'Changer').click();
  const d = ouvert();
  controleDe(d, 'Votre valeur').value = String(froid.fourchette.max + 4);
  await d.enfants[0].declencher('submit');
  assert.deepEqual(alertes(d), [], 'pas une erreur du panneau');
  assert.equal(d.open, false);
  assert.equal(magasin.etat().ajustements['temperature|regle:stockage_froid'].valeur, froid.fourchette.max + 4);
  const messages = dom.corps.tous((x) => /message-alerte/.test(x.className) || x.className === 'message message-alerte');
  assert.match(messages.map((m) => m.textContent).join(' '), /au-delà de la limite de référence.*plan d'autocontrôle/);
});

test('une ligne ajustée déplie son repli ; le titre compte les valeurs changées', () => {
  nettoyer();
  magasin.remplacer(etatVide());
  const vide = page().tous((x) => x.balise === 'details')[0];
  assert.equal(vide.open, false);
  assert.match(vide.querySelector('summary').textContent, /\d+ valeurs? de base/);
  const e = etatVide();
  e.ajustements['rendement_parage|carottes'] = { valeur: 30, unite: '%', le: null, avant: { valeur: 18.5, origine: 'referentiel' } };
  magasin.remplacer(e);
  const un = page().tous((x) => x.balise === 'details')[0];
  assert.equal(un.open, true);
  assert.match(un.querySelector('summary').textContent, /1 sur \d+ changée par vous/);
});
