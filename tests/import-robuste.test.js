// Robustesse de `importer` : un fichier corrompu ou édité à la main perd l'entrée abîmée, jamais l'écran ni le reste de l'état.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom, figerHorloge } from './aide-dom.js';
import { exporter, importer } from '../app/js/domaine/etat.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { etatVide, h } from './aide.js';

const AUJOURD = '2026-10-12';
const peuple = () => JSON.parse(readFileSync(new URL('./jeux/TEST_ONLY-etat-peuple.json', import.meta.url), 'utf8'));
const avec = (modifier) => { const d = peuple(); modifier(d.etat); return importer(JSON.stringify(d), AUJOURD); };
const premier = (o) => Object.keys(o)[0];

test('aller-retour : importer(exporter(x)) rend le même état (état peuplé et état construit par les actions)', () => {
  const peupleEtat = importer(JSON.stringify(peuple()), AUJOURD);
  assert.deepEqual(importer(exporter(peupleEtat, 'h'), AUJOURD), peupleEtat);
  assert.ok(Object.keys(peupleEtat.composants).length > 40, 'rien n\'est perdu à la première lecture');
  const e = etatVide();
  definirMenu(e, '2026-10-13', 1, 'Risotto aux bolets', h());
  const retour = importer(exporter(e, 'h'), AUJOURD);
  assert.deepEqual(Object.keys(retour.composants), Object.keys(e.composants));
  assert.deepEqual(retour.jours, e.jours);
});

const CAS = [
  ['date de composant illisible', (e) => { e.composants[premier(e.composants)].date = 'x'; }, (e, id) => !(id in e.composants)],
  ['dateService de production illisible', (e) => { e.productions[premier(e.productions)].dateService = 'x'; }, (e, id) => !(id in e.productions)],
  ['composant qui n\'est pas un objet', (e) => { e.composants[premier(e.composants)] = -1; }, (e, id) => !(id in e.composants)],
  ['etapes qui n\'est pas un tableau', (e) => { e.composants[premier(e.composants)].etapes = true; }, (e, id) => !(id in e.composants)],
  ['grammage négatif', (e) => { e.composants[premier(e.composants)].grammage.valeur = -1; }, (e, id) => !(id in e.composants)],
  ['id différent de la clé', (e) => { e.composants[premier(e.composants)].id = 'autre'; }, (e, id) => !(id in e.composants)],
  ['date de jour illisible', (e) => { e.jours[premier(e.jours)].date = 'x'; }, (e, id) => !(id in e.jours)],
];

for (const [nom, abimer, ecarte] of CAS) {
  test(`import : ${nom} écarte l'entrée et garde le reste`, () => {
    const d = peuple();
    const collection = nom.includes('production') ? 'productions' : nom.includes('jour') || nom.includes('intitul') ? 'jours' : 'composants';
    const id = premier(d.etat[collection]);
    const avant = Object.keys(d.etat[collection]).length;
    abimer(d.etat);
    const etat = importer(JSON.stringify(d), AUJOURD);
    assert.ok(ecarte(etat, id), 'entrée écartée');
    assert.equal(Object.keys(etat[collection]).length, avant - 1, 'une seule entrée perdue');
  });
}

test('un intitulé nul : le jour est gardé, intitulé normalisé en chaîne vide', () => {
  const id = premier(peuple().etat.jours);
  const etat = avec((e) => { e.jours[id].menus[1].intitule = null; });
  assert.equal(etat.jours[id].menus[1].intitule, '');
});

test('un grammage sans valeur (null) reste valide', () => {
  const etat = avec((e) => { e.composants[premier(e.composants)].grammage.valeur = null; });
  assert.ok(premier(peuple().etat.composants) in etat.composants);
});

test('balayage : un état abîmé ne fait lever aucune exception au rendu des écrans principaux', async () => {
  const rest = figerHorloge(AUJOURD, '10:00');
  const dom = installerFauxDom();
  try {
    const mag = await import('../app/js/magasin.js');
    const rout = await import('../app/js/ui/routeur.js');
    const base = peuple();
    let graine = 42;
    const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
    const valeurs = [null, '', 0, -1, 'x', [], {}, NaN, 1e30, true];
    const chemins = (o, p = [], res = []) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { res.push([...p, k]); chemins(o[k], [...p, k], res); } return res; };
    const tous = chemins(base.etat).filter((c) => c[0] !== 'journal');
    const routes = ['#/aujourdhui', '#/production', '#/production/2026-10-13', '#/semaine', '#/semaine/2026-10-12/tableau', '#/articles', '#/import/2026-10-12', '#/preparer/2026-10-12'];
    const crashs = [];
    for (let i = 0; i < Number(process.env.FUZZ ?? 100); i += 1) {
      const d = structuredClone(base);
      const muts = [];
      for (let j = 0; j < 1 + Math.floor(alea() * 2); j += 1) {
        const c = tous[Math.floor(alea() * tous.length)];
        let o = d.etat;
        for (const k of c.slice(0, -1)) { if (o === null || typeof o !== 'object') { o = null; break; } o = o[k]; }
        if (o && typeof o === 'object') { const v = valeurs[Math.floor(alea() * valeurs.length)]; o[c.at(-1)] = structuredClone(v); muts.push(`${c.join('.')}=${JSON.stringify(v)}`); }
      }
      let etat;
      try { etat = importer(JSON.stringify(d), AUJOURD); } catch { continue; }
      mag.remplacer(etat);
      for (const r of routes) {
        const { vue, param, sous } = rout.analyserHash(r, AUJOURD);
        try { rout.VUES[vue].rendre(mag.etat(), param, sous); } catch (e) { crashs.push(`${r} :: ${e.message.slice(0, 80)} <- ${muts.join(' ; ').slice(0, 150)}`); }
      }
    }
    assert.deepEqual([...new Set(crashs)].slice(0, 5), []);
  } finally { dom.restaurer(); rest(); }
});

test('page d\'erreur du routeur : un lien vers Aujourd\'hui et un lien vers Réglages > Données', async () => {
  const dom = installerFauxDom();
  try {
    const zone = globalThis.document.createElement('div');
    zone.setAttribute('id', 'vue');
    dom.corps.appendChild(zone);
    const mag = await import('../app/js/magasin.js');
    const rout = await import('../app/js/ui/routeur.js');
    mag.remplacer({ ...etatVide(), jours: null, composants: null }); // un état qui fait planter l'écran
    globalThis.location.hash = '#/production';
    rout.rendre();
    assert.match(zone.textContent, /n'a pas pu s'afficher/);
    const liens = zone.tous((e) => e.balise === 'a').map((a) => a.attributs.href);
    assert.deepEqual(liens, ['#/aujourdhui', '#/reglages/donnees']);
  } finally { dom.restaurer(); }
});
