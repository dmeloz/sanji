// Feuille Jour : les avances hors règle (plus de deux jours) restent visibles dans « Après service » (plus aucune liste à
// dérouler, refonte du 2026-10-09) ; chaque ligne dit sa cause.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';
import { definirMenu, definirPrevision, definirRegle, definirStandard } from '../app/js/domaine/actions.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let vueJour;
before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  vueJour = await import('../app/js/ui/vue-production.js');
});
after(() => dom.restaurer());

function semaine() {
  const e = etatVide();
  definirMenu(e, S.lundi, 1, 'riz', h());     // 2 jours depuis le samedi : dans la règle
  definirMenu(e, S.mardi, 1, 'carottes', h()); // 3 jours : hors règle
  definirMenu(e, S.mercredi, 1, 'quinoa', h()); // 4 jours : hors règle
  for (const jour of [S.lundi, S.mardi, S.mercredi]) definirPrevision(e, jour, 1, 20, h());
  // Riz et quinoa (base féculent du menu 1) ne s'avancent que par exception validée : ici, une avance maximale de 4 jours.
  for (const nom of ['riz', 'quinoa']) definirRegle(e, { nom, avanceMaxJours: 4 }, h());
  definirStandard(e, 'riz', 'plat_principal', { valeur: 70, unite: 'g', etat: 'sec' }, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirStandard(e, 'quinoa', 'plat_principal', { valeur: 60, unite: 'g', etat: 'sec' }, h());
  return e;
}

test('jour : les avances dans la règle et hors règle sont dans une liste « Après service » toujours visible, chaque ligne dit sa cause', () => {
  magasin.remplacer(semaine());
  const noeud = vueJour.rendre(magasin.etat(), S.samediPrecedent);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0, 'aucune liste à dérouler');
  const apres = noeud.tous((x) => x.balise === 'section' && x.querySelector('h2')?.textContent === 'Après service')[0];
  assert.ok(apres, 'section « Après service » visible');
  const lignes = apres.tous((x) => x.className.split(' ').includes('mep-ligne'));
  const texte = (l) => l.textContent;
  const hors = lignes.filter((l) => /hors règle/.test(texte(l)));
  assert.equal(hors.length, 2, 'deux avances hors règle, dites sur leur ligne');
  assert.ok(hors.every((l) => /plus de deux jours d'avance/.test(texte(l))), 'chaque ligne dit sa cause');
  assert.match(texte(hors[0]) + texte(hors[1]), /carottes/);
  assert.match(texte(hors[0]) + texte(hors[1]), /quinoa/);
  assert.ok(lignes.some((l) => /riz/.test(texte(l)) && !/hors règle/.test(texte(l))), 'le riz du lundi est dans la règle');
  assert.ok(/hors règle/.test(texte(lignes[0])) && /hors règle/.test(texte(lignes[1])), 'les avances hors règle sont en tête');
});

test('jour : le changement de jour se fait par flèches ‹ › (jour précédent / suivant), le dimanche est sauté', () => {
  magasin.remplacer(semaine());
  const noeud = vueJour.rendre(magasin.etat(), S.samediPrecedent);
  const fleches = noeud.tous((x) => x.balise === 'a' && ['Jour précédent', 'Jour suivant'].includes(x.attributs['aria-label']));
  assert.equal(fleches.length, 2);
  assert.equal(fleches.find((a) => a.attributs['aria-label'] === 'Jour suivant').attributs.href, `#/production/${S.lundi}`, 'après le samedi : le lundi');
});

test('jour : une avance d\'un jour hors règle dit sa cause sur sa ligne', async () => {
  const { planifier } = await import('../app/js/domaine/actions.js');
  const e = etatVide();
  definirMenu(e, S.mardi, 1, 'carottes', h());
  definirPrevision(e, S.mardi, 1, 20, h());
  definirStandard(e, 'carottes', 'plat_principal', { valeur: 120, unite: 'g', etat: 'cru_net' }, h());
  definirRegle(e, { nom: 'carottes', etapes: [{ libelle: 'Couper', avanceMaxJours: 0 }, { libelle: 'Finir', avanceMaxJours: 0 }] }, h());
  const couper = Object.values(e.productions).find((p) => p.etapeCle === 'couper');
  planifier(e, couper.id, S.lundi, h());
  magasin.remplacer(e);
  const noeud = vueJour.rendre(magasin.etat(), S.lundi);
  assert.equal(noeud.tous((x) => x.balise === 'details').length, 0);
  const ligne = noeud.tous((x) => x.className.split(' ').includes('mep-ligne')).find((l) => /hors règle/.test(l.textContent));
  assert.ok(ligne, 'une avance à J+1 hors règle est sur une ligne visible');
  assert.match(ligne.textContent, /au-delà du maximum de l'étape/);
  assert.doesNotMatch(ligne.textContent, /plus de deux jours/);
});
