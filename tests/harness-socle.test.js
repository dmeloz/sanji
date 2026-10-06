import test from 'node:test';
import assert from 'node:assert/strict';
import { creerFiche, definirCreneau } from '../app/js/domaine/actions.js';
import { CODES, DECISIONS, ErreurHarness, NIVEAUX, ORIGINES, PROVENANCES, VERSION_CONTEXTE, verifierSchema } from '../app/js/harness/contrats.js';
import { construireContexte } from '../app/js/harness/contexte.js';
import { ATTENTE, fournisseurScripte } from './aide-harness.js';
import { fournisseurDesactive, interroger, verifierReponse } from '../app/js/harness/fournisseur.js';
import { descriptionsPourModele, executerOutil, outil, REGISTRE } from '../app/js/harness/outils.js';
import { ACTIONS_RESERVEES_AU_CHEF, evaluerPolitique, ORIGINE_CHEF } from '../app/js/harness/politiques.js';
import { evenementsHarness, tracer } from '../app/js/harness/trace.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, copie, etatVide, h, prevision, principaleDe } from './aide.js';

const AUJOURDHUI = S.veille;

function etatDeTest() {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  const c = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST);
  return { e, c, p: principaleDe(e, c) };
}

test('verifierSchema : champs inconnus, absents, types, dates réelles et valeurs fermées', () => {
  const schema = {
    type: 'objet',
    champs: {
      date: { type: 'date' }, creneau: { type: 'texte', valeurs: ['a', 'b'] }, n: { type: 'entier', optionnel: true },
      liste: { type: 'tableau', optionnel: true, elements: { type: 'texte' } },
    },
  };
  assert.deepEqual(verifierSchema({ date: '2026-10-05', creneau: 'a' }, schema), []);
  assert.match(verifierSchema({ date: '2026-02-30', creneau: 'a' }, schema)[0], /date attendu/);
  assert.match(verifierSchema({ date: '2026-10-05', creneau: 'c' }, schema)[0], /non admise/);
  assert.match(verifierSchema({ date: '2026-10-05' }, schema)[0], /obligatoire absent/);
  assert.match(verifierSchema({ date: '2026-10-05', creneau: 'a', extra: 1 }, schema)[0], /champ inconnu/);
  assert.match(verifierSchema({ date: '2026-10-05', creneau: 'a', n: 1.5 }, schema)[0], /entier attendu/);
  assert.match(verifierSchema({ date: '2026-10-05', creneau: 'a', liste: ['x', ''] }, schema)[0], /liste\[1\]/);
  assert.match(verifierSchema(null, schema)[0], /objet attendu/);
  assert.throws(() => verifierSchema(1, { type: 'inconnu' }), /inconnu/);
});

test('politiques : lecture et calcul automatiques, proposition, commande jamais depuis le modèle ni le calcul', () => {
  const lecture = { nom: 'x', niveau: NIVEAUX.LECTURE };
  const commande = { nom: 'y', niveau: NIVEAUX.COMMANDE };
  assert.equal(evaluerPolitique({ outil: lecture, origine: ORIGINES.MODELE }).decision, DECISIONS.AUTO);
  assert.equal(evaluerPolitique({ outil: { nom: 'z', niveau: NIVEAUX.PROPOSITION }, origine: ORIGINES.MODELE }).decision, DECISIONS.PROPOSITION);
  assert.equal(evaluerPolitique({ outil: commande, origine: ORIGINES.MODELE, confirmeParChef: true }).decision, DECISIONS.INTERDIT);
  assert.equal(evaluerPolitique({ outil: commande, origine: ORIGINES.DETERMINISTE, confirmeParChef: true }).decision, DECISIONS.INTERDIT);
  assert.equal(evaluerPolitique({ outil: commande, origine: ORIGINE_CHEF }).decision, DECISIONS.CONFIRMATION);
  assert.equal(evaluerPolitique({ outil: commande, origine: ORIGINE_CHEF, confirmeParChef: true }).decision, DECISIONS.AUTO);
  assert.equal(evaluerPolitique({ outil: commande, origine: 'inconnue', confirmeParChef: true }).decision, DECISIONS.INTERDIT);
  assert.equal(evaluerPolitique({ outil: { nom: 'w', niveau: 'autre' }, origine: ORIGINE_CHEF }).decision, DECISIONS.INTERDIT);
});

test('registre : figé, chaque outil a son contrat, aucune commande exposée au modèle', () => {
  assert.ok(Object.isFrozen(REGISTRE));
  for (const d of Object.values(REGISTRE)) {
    for (const cle of ['nom', 'objectif', 'niveau', 'entrees', 'sorties', 'preconditions', 'erreurs', 'effets']) {
      assert.ok(d[cle] !== undefined, `${d.nom} : ${cle} manquant`);
    }
    assert.ok(Object.values(NIVEAUX).includes(d.niveau));
  }
  const visibles = descriptionsPourModele().map((d) => d.nom);
  assert.ok(visibles.includes('lire_menus') && visibles.includes('proposer_planning'));
  assert.ok(!visibles.includes('planifier_production'));
  assert.equal(outil('constructor'), null);
  assert.equal(outil('__proto__'), null);
});

test('outils : refus des outils inconnus, des actions réservées au chef et des commandes', () => {
  const { e } = etatDeTest();
  const ctx = { etat: e, aujourdhui: AUJOURDHUI, h: h() };
  for (const nom of ['inexistant', 'toString', ...ACTIONS_RESERVEES_AU_CHEF.slice(0, 3)]) {
    assert.throws(() => executerOutil(nom, {}, ctx), (x) => x instanceof ErreurHarness && x.code === CODES.OUTIL_INCONNU, nom);
  }
  assert.throws(() => executerOutil('definirRegle', {}, ctx), /réservée au chef/);
  assert.throws(
    () => executerOutil('planifier_production', { productionId: 'a', date: S.lundi, creneau: 'avant_midi' }, ctx),
    (x) => x.code === CODES.INTERDIT,
  );
  assert.throws(() => executerOutil('lire_menus', { date: S.lundi, en_plus: 1 }, ctx), (x) => x.code === CODES.ENTREE_INVALIDE);
  assert.throws(() => executerOutil('lire_menus', { date: '2026-13-01' }, ctx), (x) => x.code === CODES.ENTREE_INVALIDE);
  assert.throws(() => executerOutil('calculer_quantites', { composantId: 'absent' }, ctx), (x) => x.code === CODES.REFERENCE_INCONNUE);
  for (const cle of ['constructor', '__proto__', 'toString']) {
    assert.throws(() => executerOutil('calculer_quantites', { composantId: cle }, ctx), (x) => x instanceof ErreurHarness && x.code === CODES.REFERENCE_INCONNUE, cle);
    assert.throws(() => executerOutil('suggerer_creneau', { productionId: cle }, ctx), (x) => x instanceof ErreurHarness && x.code === CODES.REFERENCE_INCONNUE, cle);
  }
  assert.throws(() => executerOutil('proposer_planning', { dateDebut: S.mardi, dateFin: S.lundi }, ctx), (x) => x.code === CODES.PRECONDITION);
});

test('outils : lecture et calcul réutilisent le domaine, ne modifient pas l\'état et ne rendent que des copies', () => {
  const { e, c, p } = etatDeTest();
  const avant = copie(e);
  const ctx = { etat: e, aujourdhui: AUJOURDHUI, h: h() };
  const menus = executerOutil('lire_menus', { date: S.lundi }, ctx);
  assert.equal(menus.provenance, PROVENANCES.DONNEE_IMPORTEE);
  assert.equal(menus.resultat.composants[0].id, c);
  const calcul = executerOutil('calculer_quantites', { composantId: c }, ctx);
  assert.equal(calcul.provenance, PROVENANCES.CALCUL_DETERMINISTE);
  assert.equal(calcul.resultat.statut, 'CALCULE');
  assert.ok(calcul.resultat.libelle);
  const sug = executerOutil('suggerer_creneau', { productionId: p }, ctx).resultat;
  assert.deepEqual([sug.date, sug.creneau], [S.lundi, 'avant_midi']);
  assert.equal(executerOutil('evaluer_avance', { productionId: p, date: S.lundi }, ctx).resultat.autorisee, true);
  assert.equal(executerOutil('composants_du_poste', { date: S.lundi }, ctx).resultat.length, 1);
  assert.equal(executerOutil('lire_planning', { date: S.lundi }, ctx).resultat[0].productionId, p);
  assert.equal(executerOutil('lire_previsions', { date: S.lundi }, ctx).resultat[0].prevision, 40);
  assert.equal(executerOutil('lire_regle', { composantId: c }, ctx).resultat.regle, null);
  assert.ok(executerOutil('lire_decisions_en_attente', { date: S.lundi }, ctx).resultat.cartes);
  menus.resultat.composants[0].nom = 'MODIFIE';
  executerOutil('proposer_planning', { dateDebut: S.lundi, dateFin: S.lundi }, ctx);
  assert.deepEqual(e, avant, 'aucun outil ne modifie l\'état');
});

test('contexte : séparé par certitude, versionné, sans fiche ni allergie, période bornée', () => {
  const { e } = etatDeTest();
  const id = creerFiche(e, { date: S.lundi, service: 'midi', couverts: 12, mode: 'menu_fixe', menuFixe: 1, allergies: 'ALLERGIE_TEST_SECRETE', remarques: 'REMARQUE_TEST' }, h());
  assert.ok(id);
  const ctx = construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.mardi, aujourdhui: AUJOURDHUI });
  assert.equal(ctx.version, VERSION_CONTEXTE);
  assert.ok(ctx.donnees.estimees.some((x) => x.type === 'prevision' && x.menu === 1 && x.portions === 40));
  assert.ok(ctx.donnees.confirmees.some((x) => x.type === 'groupes' && x.portions === 12));
  assert.ok(ctx.donnees.manquantes.some((x) => x.type === 'prevision' && x.date === S.mardi));
  const composant = ctx.donnees.confirmees.find((x) => x.type === 'composant');
  assert.ok(composant);
  assert.equal(composant.productionId, principaleDe(e, composant.id), 'le contexte relie chaque composant à sa production');
  const texte = JSON.stringify(ctx);
  assert.ok(!texte.includes('ALLERGIE_TEST_SECRETE') && !texte.includes('REMARQUE_TEST'));
  assert.throws(() => construireContexte(e, { tache: 'x', dateDebut: S.mardi, dateFin: S.lundi, aujourdhui: AUJOURDHUI }), /période/);
  assert.throws(() => construireContexte(e, { tache: 'x', dateDebut: S.lundi, dateFin: '2027-01-01', aujourdhui: AUJOURDHUI }), /période/);
  assert.throws(() => construireContexte(e, { tache: 'x', dateDebut: 'n/a', dateFin: S.lundi, aujourdhui: AUJOURDHUI }), /dates invalides/);
});

test('contexte : un nom long ou qui ressemble à une remarque sur une personne n\'est pas transmis au modèle', async () => {
  const { nomTransmissible } = await import('../app/js/harness/contexte.js');
  assert.equal(nomTransmissible('Riz pilaf'), 'Riz pilaf');
  for (const nom of ['x'.repeat(61), 'Purée sans lait, allergie de Mme X', 'régime sans gluten', 'plat pour Mme Dupont', '', null]) {
    assert.equal(nomTransmissible(nom), 'composant (nom non transmis)', String(nom).slice(0, 30));
  }
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom: 'Purée, allergie arachide de Mme X' });
  const texte = JSON.stringify(construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.lundi, aujourdhui: AUJOURDHUI }));
  assert.ok(!texte.includes('arachide') && !texte.includes('Mme X'));
  assert.ok(texte.includes('composant (nom non transmis)'));
});

test('contexte : un composant à quantité inconnue est « manquant », un composant non validé « provisoire »', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 10);
  const vague = composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: { valeur: null, unite: 'g', statut: 'INCONNU', source: '' } });
  const ctx = construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.lundi, aujourdhui: AUJOURDHUI });
  assert.ok(ctx.donnees.manquantes.some((x) => x.type === 'quantite' && x.composantId === vague));
});

test('trace : une ligne du journal par événement, provenance obligatoire, détail borné, lecture filtrée', () => {
  const e = etatVide();
  tracer(e, h(), 'validee', { provenance: PROVENANCES.CORRECTION_HUMAINE, propositionId: 'prop-1', resume: 'x'.repeat(500) });
  tracer(e, h(1), 'appliquee', { provenance: PROVENANCES.CALCUL_DETERMINISTE });
  assert.throws(() => tracer(e, h(), 'x', { provenance: 'magie' }), /Provenance inconnue/);
  assert.equal(e.journal.length, 2);
  assert.ok(e.journal[0].detail.length <= 240);
  assert.match(e.journal[0].detail, /^correction_humaine\|prop-1\|/);
  assert.equal(e.journal[1].action, 'harness:appliquee');
  assert.equal(evenementsHarness(e)[0].action, 'harness:appliquee');
});

test('fournisseur : désactivé par défaut, réponse invalide, échec, délai et annulation donnent des erreurs typées', async () => {
  const requete = { contexte: {}, outils: [], historique: [] };
  const code = (promesse, attendu) => assert.rejects(promesse, (x) => x instanceof ErreurHarness && x.code === attendu);
  assert.equal(fournisseurDesactive.disponible(), false);
  await code(interroger(fournisseurDesactive, requete), CODES.MODELE_INDISPONIBLE);
  await code(interroger(null, requete), CODES.MODELE_INDISPONIBLE);
  await code(interroger(fournisseurScripte([{ type: 'brouillon', brouillon: {} }], { disponible: false }), requete), CODES.MODELE_INDISPONIBLE);
  await code(interroger(fournisseurScripte([{ type: 'magie' }]), requete), CODES.PROPOSITION_INVALIDE);
  await code(interroger(fournisseurScripte([{ type: 'brouillon', brouillon: {}, extra: 1 }]), requete), CODES.PROPOSITION_INVALIDE);
  await code(interroger(fournisseurScripte([{ type: 'appel_outil', outil: 'x' }]), requete), CODES.PROPOSITION_INVALIDE);
  await code(interroger(fournisseurScripte([new Error('panne')]), requete), CODES.MODELE_INDISPONIBLE);
  await code(interroger(fournisseurScripte([ATTENTE]), requete, { delaiMs: 20 }), CODES.DELAI_DEPASSE);
  const controleur = new AbortController();
  const attente = interroger(fournisseurScripte([ATTENTE]), requete, { delaiMs: 5000, signal: controleur.signal });
  controleur.abort();
  await code(attente, CODES.ANNULE);
  await code(interroger(fournisseurScripte([{ type: 'brouillon', brouillon: {} }]), requete, { signal: AbortSignal.abort() }), CODES.ANNULE);
  const ok = await interroger(fournisseurScripte([{ type: 'brouillon', brouillon: { a: 1 } }]), requete);
  assert.equal(ok.type, 'brouillon');
  assert.throws(() => verifierReponse(null), (x) => x.code === CODES.PROPOSITION_INVALIDE);
  assert.throws(() => verifierReponse({ type: ['brouillon'], brouillon: {} }), (x) => x.code === CODES.PROPOSITION_INVALIDE);
});

test('hygiène : le harness ne touche ni au réseau, ni au DOM, ni au stockage', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dossier = new URL('../app/js/harness/', import.meta.url);
  const interdits = /\b(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|indexedDB|localStorage|document\.|window\.|innerHTML)/;
  for (const f of readdirSync(dossier)) {
    assert.ok(!interdits.test(readFileSync(new URL(f, dossier), 'utf8')), `${f} : accès interdit`);
  }
});

test('contexte, suite : le créneau chargé n\'efface pas la prévision', () => {
  const { e } = etatDeTest();
  definirCreneau(e, S.lundi, 'avant_midi', 'charge', h());
  const ctx = construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.lundi, aujourdhui: AUJOURDHUI });
  assert.ok(ctx.donnees.estimees.length > 0);
});
