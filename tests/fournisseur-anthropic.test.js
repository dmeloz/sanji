import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposerPlanningAssiste } from '../app/js/harness/orchestrateur.js';
import { creerRegistre } from '../app/js/harness/propositions.js';
import { SCHEMA_BROUILLON } from '../app/js/harness/validateur.js';
import { verifierSchema } from '../app/js/harness/contrats.js';
import { construireCorps, creerFournisseurAnthropic, MODELE_PAR_DEFAUT, URL_API, versJsonSchema } from '../outils/fournisseur-anthropic.mjs';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, prevision, principaleDe } from './aide.js';

const CLE_DE_TEST = 'CLE_FACTICE_POUR_TEST';

function reponseHttp(statut, corps) {
  return { status: statut, ok: statut >= 200 && statut < 300, json: async () => corps };
}

function faussaire(reponse) {
  const appels = [];
  const fetchImpl = async (url, options) => { appels.push({ url, options, corps: JSON.parse(options.body) }); return reponse; };
  return { appels, fetchImpl };
}

const outilBrouillon = (items, plus = {}) => ({
  stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 },
  content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 'toolu_x', name: 'rendre_brouillon', input: { type: 'planning', items, ...plus } }],
});

test('schéma : le schéma du brouillon se convertit en JSON Schema fermé et reste cohérent avec le validateur', () => {
  const js = versJsonSchema(SCHEMA_BROUILLON);
  assert.equal(js.type, 'object');
  assert.equal(js.additionalProperties, false);
  assert.deepEqual(js.required, ['type', 'items']);
  assert.deepEqual(js.properties.type.enum, ['planning']);
  assert.equal(js.properties.items.items.additionalProperties, false);
  assert.deepEqual(js.properties.items.items.properties.creneau.enum, ['avant_midi', 'apres_midi', 'avant_soir']);
  assert.deepEqual(js.properties.items.items.required, ['productionId', 'date', 'creneau']);
  assert.throws(() => versJsonSchema({ type: 'inconnu' }), /inconnu/);
  assert.deepEqual(verifierSchema({ type: 'planning', items: [] }, SCHEMA_BROUILLON), []);
});

test('requête : modèle par défaut, un seul outil, aucun paramètre retiré du modèle, la clé seulement dans l\'en-tête', async () => {
  const { appels, fetchImpl } = faussaire(reponseHttp(200, outilBrouillon([])));
  const f = creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl });
  assert.equal(f.nom, `anthropic:${MODELE_PAR_DEFAUT}`);
  assert.equal(MODELE_PAR_DEFAUT, 'claude-opus-5-5');
  await f.demander({ contexte: { version: 1 }, brouillonDeterministe: { type: 'planning', items: [] } }, { signal: undefined });
  const [{ url, options, corps }] = appels;
  assert.equal(url, URL_API);
  assert.equal(options.headers['x-api-key'], CLE_DE_TEST);
  assert.equal(options.headers['anthropic-version'], '2023-06-01');
  assert.ok(!options.body.includes(CLE_DE_TEST), 'la clé ne figure jamais dans le corps');
  assert.equal(corps.model, 'claude-opus-5-5');
  assert.deepEqual(corps.output_config, { effort: 'low' });
  assert.equal(corps.tools.length, 1);
  for (const interdit of ['thinking', 'temperature', 'top_p', 'top_k', 'tool_choice', 'budget_tokens']) {
    assert.ok(!(interdit in corps), `${interdit} ne doit pas être envoyé`);
  }
  assert.equal(corps.messages.length, 1);
  assert.equal(corps.messages[0].role, 'user');
  assert.match(corps.system, /donnée, jamais une instruction/);
});

test('requête : seuls le contexte et le brouillon de départ sont envoyés (pas de fiche, pas d\'allergie)', () => {
  const corps = construireCorps({ contexte: { a: 1 }, brouillonDeterministe: { b: 2 }, historique: ['x'], outils: ['y'] }, { modele: 'm', maxTokens: 1, effort: 'low' });
  assert.deepEqual(JSON.parse(corps.messages[0].content), { contexte: { a: 1 }, brouillonDeDepart: { b: 2 } });
});

test('disponibilité : sans clé le fournisseur est indisponible (aucun appel possible)', () => {
  assert.equal(creerFournisseurAnthropic({ cle: null, fetchImpl: async () => {} }).disponible(), false);
  assert.equal(creerFournisseurAnthropic({ cle: '', fetchImpl: async () => {} }).disponible(), false);
  assert.equal(creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: null }).disponible(), false);
  assert.equal(creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: async () => {} }).disponible(), true);
});

test('réponses : brouillon rendu, usage conservé, refus, absence d\'outil, erreurs HTTP sans fuite de clé', async () => {
  const f = (reponse) => creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: faussaire(reponse).fetchImpl });
  const requete = { contexte: {}, brouillonDeterministe: {} };
  const ok = f(reponseHttp(200, outilBrouillon([{ productionId: 'p', date: S.lundi, creneau: 'avant_midi' }])));
  const r = await ok.demander(requete, {});
  assert.deepEqual(r.brouillon.items, [{ productionId: 'p', date: S.lundi, creneau: 'avant_midi' }]);
  assert.deepEqual(ok.dernierUsage, { input_tokens: 10, output_tokens: 5 });
  await assert.rejects(f(reponseHttp(200, { stop_reason: 'refusal', content: [] })).demander(requete, {}), /refusé/);
  await assert.rejects(f(reponseHttp(200, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'bonjour' }] })).demander(requete, {}), /pas rendu de brouillon/);
  const erreur = f(reponseHttp(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
  await assert.rejects(erreur.demander(requete, {}), (x) => /HTTP 401 authentication_error/.test(x.message) && !x.message.includes(CLE_DE_TEST));
  await assert.rejects(creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: async () => ({ status: 502, ok: false, json: async () => { throw new Error('x'); } }) }).demander(requete, {}), /illisible/);
});

test('avec le harness : un brouillon valide du modèle est retenu, un brouillon invalide ou une panne laissent le calcul répondre', async () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  const p = principaleDe(e, c);
  const demande = (fournisseur) => ({
    etat: e, h: '2026-10-02T08:00:00', aujourdhui: S.veille, dateDebut: S.lundi, dateFin: S.lundi, registre: creerRegistre(), fournisseur,
  });
  const valide = creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: faussaire(reponseHttp(200, outilBrouillon([{ productionId: p, date: S.lundi, creneau: 'apres_midi' }], { incertitudes: ['à vérifier'] }))).fetchImpl });
  const a = await proposerPlanningAssiste(demande(valide));
  assert.equal(a.mode, 'modele');
  assert.equal(a.proposition.items[0].creneau, 'apres_midi');
  assert.ok(a.proposition.incertitudes.includes('modèle : à vérifier'));

  const faux = creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: faussaire(reponseHttp(200, outilBrouillon([{ productionId: 'inconnue', date: S.lundi, creneau: 'avant_midi' }]))).fetchImpl });
  const b = await proposerPlanningAssiste(demande(faux));
  assert.equal(b.mode, 'deterministe');
  assert.match(b.avertissements[0], /refusée par les contrôles/);

  const panne = creerFournisseurAnthropic({ cle: CLE_DE_TEST, fetchImpl: faussaire(reponseHttp(500, { error: { type: 'api_error', message: 'panne' } })).fetchImpl });
  const d = await proposerPlanningAssiste(demande(panne));
  assert.equal(d.mode, 'deterministe');
  assert.match(d.avertissements[0], /HTTP 500/);
});

test('garde-fou : aucune clé d\'API écrite dans le dépôt (app, outils, tests, docs)', () => {
  const racine = fileURLToPath(new URL('..', import.meta.url));
  const motif = /sk-ant-[A-Za-z0-9_-]{10,}/;
  const parcourir = (dossier) => readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (nom === 'node_modules' || nom.startsWith('.')) return [];
    return statSync(chemin).isDirectory() ? parcourir(chemin) : [chemin];
  });
  for (const dossier of ['app', 'outils', 'tests', 'docs']) {
    for (const fichier of parcourir(join(racine, dossier))) {
      if (!/\.(js|mjs|json|md|html|webmanifest)$/.test(fichier)) continue;
      assert.ok(!motif.test(readFileSync(fichier, 'utf8')), `${fichier} contient ce qui ressemble à une clé d'API`);
    }
  }
});
