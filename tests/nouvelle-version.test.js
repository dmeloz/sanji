// Bandeau « Nouvelle version prête » (v100) : il n'apparaît que lorsqu'un nouveau service worker prend la main sur une page déjà
// pilotée par l'ancien (jamais à la première installation), propose un seul geste, et ne s'affiche qu'une fois.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';

let dom;
let mod;
before(async () => {
  dom = installerFauxDom();
  mod = await import('../app/js/ui/nouvelle-version.js');
});
after(() => dom.restaurer());

function fauxConteneur(controller) {
  const ecouteurs = {};
  return {
    controller,
    addEventListener: (nom, f) => { ecouteurs[nom] = f; },
    declencher: () => ecouteurs.controllerchange?.(),
  };
}

test('bandeau : le texte dit que la version est prête et le bouton « Mettre à jour » recharge', () => {
  let rechargee = 0;
  const b = mod.bandeauNouvelleVersion(() => { rechargee += 1; });
  assert.match(b.textContent, /Nouvelle version prête/);
  const [bouton] = b.tous((x) => x.balise === 'button');
  assert.equal(bouton.textContent, 'Mettre à jour');
  bouton.click();
  assert.equal(rechargee, 1);
});

test('surveiller : un nouveau worker qui prend la main sur une page déjà pilotée affiche le bandeau, une seule fois', () => {
  const conteneur = fauxConteneur({});
  let montre = 0;
  mod.surveillerNouvelleVersion(conteneur, () => { montre += 1; });
  conteneur.declencher();
  conteneur.declencher();
  assert.equal(montre, 1);
});

test('surveiller : première installation (aucun worker avant) ne montre rien', () => {
  const conteneur = fauxConteneur(null);
  let montre = 0;
  mod.surveillerNouvelleVersion(conteneur, () => { montre += 1; });
  conteneur.declencher();
  assert.equal(montre, 0);
});

test('surveiller : sans service worker (conteneur absent), rien ne plante', () => {
  assert.doesNotThrow(() => mod.surveillerNouvelleVersion(undefined, () => {}));
});

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };
const reponse = (texte, ok = true) => ({ ok, text: async () => texte });
const swVersion = (n) => `const VERSION = '${n}';\nconst X = 1;`;
const conteneurAvec = (echec = false) => ({ getRegistration: async () => ({ update: async () => { if (echec) throw new Error('réseau'); } }) });
const memoireFausse = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };

test('lireVersionServie : lit un nombre strict, rejette tout contenu inattendu (aucun eval)', () => {
  assert.equal(mod.lireVersionServie(swVersion(131)), 131);
  assert.equal(mod.lireVersionServie('<html>captif</html>'), null);
  assert.equal(mod.lireVersionServie("const VERSION = '12a';"), null);
  assert.equal(mod.lireVersionServie("const VERSION = process.exit();"), null);
  assert.equal(mod.lireVersionServie(undefined), null);
});

test('verifier : même version servie = a_jour ; plus récente = plus_recente ; réseau en échec ou réponse illisible = indisponible', async () => {
  const v = (texte, extra = {}) => mod.verifierMiseAJour(conteneurAvec(), { chercher: async () => reponse(texte), courante: '130', ...extra });
  assert.deepEqual(await v(swVersion(130)), { resultat: 'a_jour', servie: 130 });
  assert.deepEqual(await v(swVersion(131)), { resultat: 'plus_recente', servie: 131 });
  assert.equal((await v(swVersion(129))).resultat, 'a_jour');
  assert.equal((await v('page de connexion')).resultat, 'indisponible');
  assert.equal((await mod.verifierMiseAJour(conteneurAvec(), { chercher: async () => { throw new Error('hors ligne'); }, courante: '130' })).resultat, 'indisponible');
  assert.equal((await mod.verifierMiseAJour(conteneurAvec(), { chercher: async () => reponse('', false), courante: '130' })).resultat, 'indisponible');
});

test('verifier : le fichier est demandé sans cache et avec un paramètre anti-cache ; update() qui échoue ne décide rien', async () => {
  let appel;
  const r = await mod.verifierMiseAJour(conteneurAvec(true), { chercher: async (u, o) => { appel = { u, o }; return reponse(swVersion(130)); }, courante: '130' });
  assert.match(appel.u, /^sw\.js\?v=/);
  assert.equal(appel.o.cache, 'no-store');
  assert.equal(r.resultat, 'a_jour');
  assert.equal((await mod.verifierMiseAJour(undefined, { chercher: async () => reponse(swVersion(130)), courante: '130' })).resultat, 'a_jour');
});

function ligneAvec(verifier, extra = {}) {
  const conteneur = fauxConteneur({});
  let rechargee = 0;
  const memoire = extra.memoire ?? memoireFausse();
  const ligne = mod.ligneVerifierMiseAJour(verifier, { conteneur, recharger: () => { rechargee += 1; }, delaiMs: 60000, memoire, courante: '130', ...extra });
  return { ligne, conteneur, memoire, rechargees: () => rechargee, bouton: ligne.tous((x) => x.balise === 'button')[0] };
}

test('ligne : la version installée est visible au-dessus du bouton, avant tout clic', () => {
  const { ligne } = ligneAvec(async () => ({ resultat: 'a_jour', servie: 130 }));
  assert.match(ligne.textContent, /Version installée : 130/);
  assert.equal(ligne.tous((x) => x.balise === 'button')[0].textContent, 'Vérifier les mises à jour');
});

test('ligne : même version = « Sanji est à jour (version N) », sans rechargement', async () => {
  const { ligne, bouton, conteneur, rechargees } = ligneAvec(async () => ({ resultat: 'a_jour', servie: 130 }));
  bouton.click(); await flush(); conteneur.declencher();
  assert.match(ligne.textContent, /Sanji est à jour \(version 130\)/);
  assert.equal(rechargees(), 0);
});

test('ligne : version servie plus récente = message puis rechargement dès que le nouveau worker prend la main', async () => {
  const { ligne, bouton, conteneur, rechargees } = ligneAvec(async () => ({ resultat: 'plus_recente', servie: 131 }));
  bouton.click(); await flush();
  assert.match(ligne.textContent, /Version 131 disponible : Sanji va se relancer/);
  assert.equal(rechargees(), 0);
  conteneur.declencher();
  assert.equal(rechargees(), 1);
});

test('ligne : sans controllerchange, le délai relance quand même, une seule fois', async () => {
  const { bouton, rechargees } = ligneAvec(async () => ({ resultat: 'plus_recente', servie: 131 }), { delaiMs: 5 });
  bouton.click(); await flush();
  const garde = setInterval(() => {}, 1000); // le faux DOM détache les minuteries : on garde la boucle en vie
  await new Promise((r) => setTimeout(r, 30));
  clearInterval(garde);
  assert.equal(rechargees(), 1);
});

test('ligne : réseau en échec = message avec la version courante, sans rechargement', async () => {
  const { ligne, bouton, conteneur, rechargees } = ligneAvec(async () => ({ resultat: 'indisponible', servie: null }));
  bouton.click(); await flush(); conteneur.declencher();
  assert.match(ligne.textContent, /Impossible de vérifier \(réseau ou hors ligne\)\. Vous êtes en version 130\./);
  assert.equal(rechargees(), 0);
});

test('ligne : pas de boucle, une seconde fois avec la même version servie ne recharge pas', async () => {
  const memoire = memoireFausse();
  const verifier = async () => ({ resultat: 'plus_recente', servie: 131 });
  const a = ligneAvec(verifier, { memoire });
  a.bouton.click(); await flush(); a.conteneur.declencher();
  assert.equal(a.rechargees(), 1);
  const b = ligneAvec(verifier, { memoire });
  b.bouton.click(); await flush(); b.conteneur.declencher();
  assert.equal(b.rechargees(), 0);
  assert.match(b.ligne.textContent, /131/);
  assert.match(b.ligne.textContent, /fermez/i);
});

test('ligne : une mémoire inutilisable (sessionStorage absent ou qui lève) ne casse rien', async () => {
  const cassee = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  const { bouton, conteneur, rechargees } = ligneAvec(async () => ({ resultat: 'plus_recente', servie: 131 }), { memoire: cassee });
  bouton.click(); await flush(); conteneur.declencher();
  assert.equal(rechargees(), 1);
});

test('bandeau : donne aussi la version en cours', () => {
  assert.match(mod.bandeauNouvelleVersion(() => {}, '130').textContent, /version 130/);
});

test('nouvelle-version.js : un seul chargement réseau, sur sw.js (même origine), aucun autre domaine', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/js/ui/nouvelle-version.js', import.meta.url), 'utf8');
  assert.match(src, /const FICHIER_VERSION = 'sw\.js';/);
  assert.equal((src.match(/\bfetch\b/g) || []).length, 1, 'un seul fetch');
  const appels = src.match(/\bchercher\(/g) || [];
  assert.equal(appels.length, 1, 'un seul appel de chargement');
  assert.match(src, /chercher\(`\$\{FICHIER_VERSION\}\?v=\$\{maintenant\(\)\}`/);
  assert.equal(/https?:|\/\/[a-z0-9-]+\.[a-z]{2,}|anthropic/i.test(src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '')), false, 'aucun domaine');
  assert.equal(/\beval\s*\(|new\s+Function\b/.test(src), false, 'ni eval ni new Function');
});
