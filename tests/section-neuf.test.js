// « Repartir à neuf » (Réglages > Données) sous faux DOM : confirmation par le mot NEUF, copies automatiques.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installerFauxDom, panneauxOuverts } from './aide-dom.js';
import { CLE_AVANT_REMISE_A_NEUF, CLE_AVANT_REMISE_PRECEDENTE, CLE_AVANT_RESTAURATION, PREFIXE_COPIE } from '../app/js/sauvegarde-auto.js';

let dom;
let neuf;
let copies;
before(async () => {
  dom = installerFauxDom();
  neuf = await import('../app/js/ui/section-neuf.js');
  copies = await import('../app/js/ui/section-copies.js');
});
after(() => dom.restaurer());

const attendre = () => new Promise((r) => setImmediate(r));
const boutonDe = (n, motif) => n.tous((e) => e.balise === 'button' && motif.test(e.textContent))[0];

test('la section est une ligne tappable danger « Repartir à neuf », avec une icône', () => {
  const s = neuf.sectionNeuf(async () => ({ avertissements: [] }), async () => null);
  const ligne = boutonDe(s, /Repartir à neuf/);
  assert.ok(ligne);
  assert.ok(ligne.className.split(' ').includes('reglage-danger'));
  assert.ok(ligne.tous((e) => e.attributs['aria-hidden'] === 'true').length >= 1, 'icône décorative');
});

test('la confirmation liste ce qui part et ce qui reste, Tout effacer reste inactif sans le mot NEUF', async () => {
  const appels = [];
  const s = neuf.sectionNeuf(async () => { appels.push(1); return { avertissements: [] }; }, async () => null);
  boutonDe(s, /Repartir à neuf/).click();
  await attendre();
  const [f] = panneauxOuverts(dom.corps);
  const t = f.textContent;
  for (const mot of ['menus', 'semaines', 'fiches de fonction', 'standards maison', 'lignes écartées', 'ventes', 'cases cochées', 'photos de menus', 'copie de sécurité']) assert.match(t, new RegExp(mot), mot);
  assert.match(t, /clé de l'assistant IA/);
  const ok = boutonDe(f, /Tout effacer et repartir à neuf/);
  assert.ok(ok.disabled);
  const champ = f.querySelector('input');
  champ.value = 'neu';
  champ.declencher('input');
  assert.ok(ok.disabled);
  await f.querySelector('form').declencher('submit');
  assert.equal(appels.length, 0, 'refusé tant que le mot n\'est pas tapé');
  assert.ok(ok.disabled, 'le bouton reste inactif après un refus');
  champ.value = ' neuf ';
  champ.declencher('input');
  assert.equal(ok.disabled, false);
  await f.querySelector('form').declencher('submit');
  assert.equal(appels.length, 1);
  assert.equal(f.open, false);
  f.close();
});

test('la confirmation dit ce que la copie ne garde pas, la date de la copie remplacée et le sort de « avant-restauration »', async () => {
  const existante = JSON.stringify({ exporteLe: '2026-09-30T08:00:00' });
  const s = neuf.sectionNeuf(async () => ({ avertissements: [] }), async () => existante);
  boutonDe(s, /Repartir à neuf/).click();
  await attendre();
  const f = panneauxOuverts(dom.corps).at(-1);
  const t = f.textContent;
  assert.match(t, /PAS les photos de menus/);
  assert.match(t, /notes de test/);
  assert.match(t, /journal/);
  assert.match(t, /2026-09-30/);
  assert.match(t, /avant-dernière|précédente/);
  assert.match(t, /avant la dernière restauration/);
  f.close();
});

test('Entrée (soumission) sans le mot NEUF est refusée', async () => {
  const appels = [];
  const s = neuf.sectionNeuf(async () => { appels.push(1); return { avertissements: [] }; }, async () => null);
  boutonDe(s, /Repartir à neuf/).click();
  await attendre();
  const f = panneauxOuverts(dom.corps).at(-1);
  await f.querySelector('form').declencher('submit');
  assert.equal(appels.length, 0);
  assert.equal(f.open, true);
  f.close();
});

test('une copie de sécurité impossible laisse la confirmation ouverte avec le message', async () => {
  const s = neuf.sectionNeuf(async () => { throw new Error("Impossible de garder une copie de sécurité : rien n'a été effacé."); }, async () => null);
  boutonDe(s, /Repartir à neuf/).click();
  await attendre();
  const f = panneauxOuverts(dom.corps).at(-1);
  const champ = f.querySelector('input');
  champ.value = 'NEUF';
  champ.declencher('input');
  await f.querySelector('form').declencher('submit');
  assert.equal(f.open, true);
  assert.match(f.textContent, /rien n'a été effacé/);
  f.close();
});

test('Copies automatiques : lignes « avant la remise à neuf » et « Supprimer aussi cette copie »', async () => {
  const donnees = new Map([[`${PREFIXE_COPIE}2026-10-15`, 'x'], [CLE_AVANT_REMISE_A_NEUF, 'texte']]);
  const magasin = { lister: async () => [...donnees.keys()], lire: async (c) => donnees.get(c) ?? null,
    ecrire: async (c, v) => { donnees.set(c, v); }, supprimer: async (c) => { donnees.delete(c); } };
  const s = copies.sectionCopies(magasin);
  await attendre();
  assert.match(s.textContent, /État avant la remise à neuf/);
  const suppr = boutonDe(s, /Supprimer aussi cette copie de sécurité/);
  assert.ok(suppr);
  suppr.click();
  const f = panneauxOuverts(dom.corps).at(-1);
  assert.match(f.textContent, /irréversible/);
  await f.querySelector('form').declencher('submit');
  assert.equal(donnees.has(CLE_AVANT_REMISE_A_NEUF), false);
  assert.equal(donnees.has(`${PREFIXE_COPIE}2026-10-15`), true);
});

test('Copies automatiques : ligne « remise à neuf précédente » avec restauration et suppression', async () => {
  const donnees = new Map([[CLE_AVANT_REMISE_PRECEDENTE, 'texte']]);
  const magasin = { lister: async () => [...donnees.keys()], lire: async (c) => donnees.get(c) ?? null,
    ecrire: async (c, v) => { donnees.set(c, v); }, supprimer: async (c) => { donnees.delete(c); } };
  const s = copies.sectionCopies(magasin);
  await attendre();
  assert.match(s.textContent, /État avant la remise à neuf précédente/);
  boutonDe(s, /Supprimer aussi la copie précédente/).click();
  const f = panneauxOuverts(dom.corps).at(-1);
  await f.querySelector('form').declencher('submit');
  assert.equal(donnees.has(CLE_AVANT_REMISE_PRECEDENTE), false);
});

test('sans copie de remise à neuf, aucune de ces deux lignes', async () => {
  const magasin = { lister: async () => [CLE_AVANT_RESTAURATION], lire: async () => null, ecrire: async () => {}, supprimer: async () => {} };
  const s = copies.sectionCopies(magasin);
  await attendre();
  assert.doesNotMatch(s.textContent, /remise à neuf/);
});

test('hygiène : la remise à neuf ne touche ni à la clé API ni aux réglages de l\'appareil', () => {
  for (const f of ['app/js/ui/section-neuf.js', 'app/js/remise-a-neuf.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /assistant-reglages|effacerReglagesIA|reglerPastille|sanji-assistant-ia|sanji-pastille-dev/, f);
  }
});
