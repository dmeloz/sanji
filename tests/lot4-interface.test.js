// Lot 4 — hiérarchie des feuilles Services, Détail du jour, Planifier et brouillon.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { figerHorloge, installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { importer } from '../app/js/domaine/etat.js';

const AUJOURD = '2026-10-12';
const peuple = () => importer(readFileSync(new URL('./jeux/TEST_ONLY-etat-peuple.json', import.meta.url), 'utf8'), AUJOURD);
let dom; let restore; let magasin; let services; let taches; let planning;
before(async () => {
  restore = figerHorloge(AUJOURD);
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  services = await import('../app/js/ui/feuille-services.js');
  taches = await import('../app/js/ui/taches.js');
  planning = await import('../app/js/ui/assistant-planning.js');
});
after(() => { dom.restaurer(); restore(); });
const parClasse = (n, c) => n.tous((x) => x.className.split(' ').includes(c));
const ouvrir = (fonction) => { fonction(); return panneauxOuverts(dom.corps).at(-1); };
const fermer = () => { for (const d of panneauxOuverts(dom.corps)) { d.close(); d.remove(); } };

test('Services du jour : couverts, menus et fiches se lisent comme trois rubriques ordonnées', () => {
  fermer(); magasin.remplacer(peuple());
  const feuille = ouvrir(() => services.ouvrirServices(AUJOURD));
  const etapes = parClasse(feuille, 'services-etape');
  assert.equal(etapes.length, 3);
  assert.match(etapes[0].textContent, /Couverts midi/);
  assert.match(etapes[1].textContent, /Menus/);
  assert.match(etapes[2].textContent, /Fiches de fonction/);
  assert.ok(feuille.textContent.indexOf('Couverts midi') < feuille.textContent.indexOf('Menus'));
  assert.ok(feuille.textContent.indexOf('Menus') < feuille.textContent.indexOf('Fiches de fonction'));
  fermer();
});

test('Détail du jour : la date vient avant les rubriques et le panneau garde les rubriques entières', () => {
  fermer(); magasin.remplacer(peuple());
  const feuille = ouvrir(() => services.ouvrirDetailDuJour(AUJOURD));
  const entete = parClasse(feuille, 'detail-jour-entete')[0];
  assert.ok(entete);
  assert.match(entete.textContent, /lundi 12 octobre/i);
  const noeuds = feuille.tous(() => true);
  assert.ok(noeuds.indexOf(entete) < noeuds.findIndex((x) => x.attributs.id === 'menus'));
  fermer();
});

test('Planifier : suggestion, jour choisi et évaluation sont trois zones visibles dans cet ordre', () => {
  fermer(); magasin.remplacer(peuple());
  const prod = Object.values(magasin.etat().productions).find((p) => p.genre === 'principale' && p.etat !== 'fait' && p.dateService > AUJOURD && !p.jourDecide);
  taches.dialogPlanifier(prod.id, 'planifier');
  const feuille = panneauxOuverts(dom.corps).at(-1);
  const etapes = parClasse(feuille, 'planifier-etape');
  assert.deepEqual(etapes.map((x) => x.className.split(' ').find((c) => /^planifier-etape-/.test(c))), [
    'planifier-etape-suggestion', 'planifier-etape-jour', 'planifier-etape-evaluation',
  ]);
  assert.match(feuille.textContent, /Utiliser la suggestion/);
  assert.match(feuille.textContent, /Jour/);
  assert.match(feuille.textContent, /Service :/);
  assert.equal(feuille.tous((x) => x.balise === 'input' && x.attributs.type === 'date').length, 1);
  fermer();
});

test('Brouillon : provenance, préparations, décisions et explication sont séparées, sans supprimer le message de non-enregistrement', async () => {
  const resultat = await (async () => {
    const { proposerPlanningAssiste } = await import('../app/js/harness/orchestrateur.js');
    const { creerRegistre } = await import('../app/js/harness/propositions.js');
    return proposerPlanningAssiste({ etat: peuple(), h: `${AUJOURD}T07:00:00`, aujourdhui: AUJOURD, dateDebut: AUJOURD, dateFin: '2026-10-17', registre: creerRegistre() });
  })();
  const racine = dom.document.createElement('div');
  for (const noeud of planning.contenuProposition(resultat.proposition, resultat)) racine.appendChild(noeud);
  const etapes = parClasse(racine, 'ia-etape');
  assert.equal(etapes.length, 4);
  assert.match(etapes[0].textContent, /calculé par Sanji|proposé par l'IA/);
  assert.match(etapes[1].textContent, /préparation|Préparations/i);
  assert.match(etapes[2].textContent, /À décider/);
  assert.match(etapes[3].textContent, /Pourquoi cette proposition/);
  assert.match(racine.textContent, /Rien n'est enregistré avant votre validation/);
});
