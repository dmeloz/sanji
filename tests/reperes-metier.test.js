// Repères métier, buffet par couvert et source légale des allergènes : affichage seul, sous faux DOM.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Element, installerFauxDom } from './aide-dom.js';
import { definirMenu } from '../app/js/domaine/actions.js';
import { ajusterStandard } from '../app/js/domaine/actions-ajustements.js';
import { ALLERGENES } from '../app/js/ui/reference.js';
import { rattachementsDe, reperesAide } from '../app/js/domaine/standards-base.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { etatVide, h } from './aide.js';

let dom;
let magasin;
let vues;
let reperes;
let reference;

before(async () => {
  dom = installerFauxDom();
  magasin = await import('../app/js/magasin.js');
  reperes = await import('../app/js/ui/reperes-metier.js');
  reference = await import('../app/js/ui/reference.js');
  vues = {
    composant: await import('../app/js/ui/vue-composant.js'),
    detail: await import('../app/js/ui/vue-detail.js'),
  };
});
after(() => dom.restaurer());

const tout = (n, balise) => n.tous((x) => x.balise === balise);

test('repères d\'une famille : cuisson, conservation, avec fourchette, standard de base et provenance', () => {
  const lignes = reperes.reperesPour('riz');
  assert.ok(lignes.length > 0);
  const rubriques = new Set(lignes.map((l) => l.rubrique));
  assert.ok(rubriques.has('Cuisson'));
  assert.ok(rubriques.has('Conservation'));
  for (const l of lignes) {
    assert.ok(l.titre && l.provenance, `${l.titre} : titre et provenance`);
    if (l.standard) assert.match(l.standard, /standard de base/);
  }
  assert.ok(lignes.some((l) => l.standard && l.fourchette), 'au moins un standard avec fourchette');
});

test('repère ajusté par la propriétaire : « votre valeur : N » en premier, puis le standard de base', () => {
  const e = etatVide();
  const avant = reperes.reperesPour('riz', e).find((l) => l.rubrique === 'Conservation' && /riz/i.test(l.titre));
  assert.equal(avant.votre, null, 'sans ajustement : rien de plus');
  ajusterStandard(e, 'riz', 'conservation', 3, h());
  const lignes = reperes.reperesPour('riz', e);
  const ligne = lignes.find((l) => l.votre);
  assert.equal(ligne.votre, 'votre valeur : 3 jours');
  assert.match(ligne.standard, /^standard de base : 1 jours?$/, 'le standard de base reste visible');
  assert.equal(lignes.filter((l) => l.votre).length, 1, 'seul le repère ajusté est concerné');
  const texte = reperes.blocReperes('riz', e).textContent;
  assert.match(texte, /votre valeur : 3 jours/);
  const ligneTexte = reperes.blocReperes('riz', e).tous((x) => x.dataset?.repere === ligne.id)[0].textContent;
  assert.ok(ligneTexte.indexOf('votre valeur : 3 jours') < ligneTexte.indexOf('standard de base : 1 jour'), 'votre valeur avant le standard de base');
  // Sans état : comme avant.
  assert.equal(reperes.reperesPour('riz').some((l) => l.votre), false);
});

test('bloc replié : fermé par défaut, provenance et « à valider localement » en texte, aucun champ de saisie', () => {
  const bloc = reperes.blocReperes('pates_seches');
  assert.equal(bloc.balise, 'details');
  assert.equal(bloc.open, false);
  const texte = bloc.textContent;
  assert.match(texte, /Repères métier/);
  assert.match(texte, /standard de base/);
  assert.match(texte, /Provenance/);
  assert.match(texte, /référentiel culinaire|base métier|Confédération|Swiss|Food|Küchen|Base officielle/i);
  assert.match(texte, /à valider localement/);
  assert.doesNotMatch(texte, /undefined|NaN|null/);
  assert.equal(tout(bloc, 'input').length + tout(bloc, 'select').length + tout(bloc, 'textarea').length, 0);
  for (const p of bloc.tous((x) => /pastille-ambre/.test(x.className))) assert.ok(p.textContent.length > 3);
});

test('aucun repère : pas de bloc ; limite par rubrique et renvoi vers la page complète', () => {
  assert.equal(reperes.blocReperes('inconnue'), null);
  assert.equal(reperes.blocReperes(null), null);
  const bloc = reperes.blocReperes('pommes_de_terre');
  assert.ok(tout(bloc, 'li').length <= 12);
  assert.match(bloc.textContent, /autres? repères?/);
});

test('page complète : pageReperesMetier(conteneur, { theme }) affiche tout le thème, provenance visible', () => {
  const cible = new Element('div');
  reperes.pageReperesMetier(cible, { theme: 'hygiene' });
  const attendu = reperesAide('hygiene').length;
  assert.ok(attendu > 0);
  assert.equal(tout(cible, 'li').filter((x) => x.dataset.repere).length, attendu);
  assert.match(cible.textContent, /Provenance/);
  assert.match(cible.textContent, /à valider localement/);
  assert.match(cible.textContent, /Repères métier/);
  reperes.pageReperesMetier(cible, {});
  assert.ok(tout(cible, 'li').length > 0, 'thème par défaut');
});

test('composant : le bloc « Repères métier » est présent, fermé, et ne touche pas l\'état', () => {
  const e = etatVide();
  definirMenu(e, S.lundi, 2, 'riz', h());
  const riz = Object.values(e.composants).find((c) => c.famille === 'riz');
  magasin.remplacer(e);
  const avant = structuredClone(magasin.etat());
  const page = vues.composant.rendre(magasin.etat(), riz.id);
  const bloc = tout(page, 'details').find((d) => d.attributs.id === 'reperes-metier');
  assert.ok(bloc, 'bloc présent');
  assert.equal(bloc.open, false);
  assert.deepEqual(magasin.etat(), avant);
  assert.match(page.textContent, /Source légale/);
});

function ficheAvec(couverts, mode = 'choix_libre') {
  const e = etatVide();
  e.fiches.f1 = {
    id: 'f1', numero: 'T1', date: S.lundi, service: 'midi', horaire: '12:00', couverts, mode, menuFixe: mode === 'menu_fixe' ? 1 : null,
    repartition: { 1: couverts, 2: 0 }, statutRepartition: 'provisoire', statut: 'active', version: 1, allergies: '', remarques: '',
    adaptations: [], historique: [],
  };
  magasin.remplacer(e);
  return e;
}
const blocBuffet = (page) => tout(page, 'details').find((d) => /buffet-couvert/.test(d.className));

test('fiche de fonction : buffet par couvert multiplié par les couverts, étiqueté, viande à état de poids non établi', () => {
  ficheAvec(40);
  const avant = structuredClone(magasin.etat());
  const page = vues.detail.rendre(magasin.etat(), S.lundi);
  const bloc = blocBuffet(page);
  assert.ok(bloc, 'bloc buffet');
  assert.equal(bloc.open, false);
  const t = bloc.textContent;
  assert.match(t, /standard de base/);
  assert.match(t, /40 couverts/);
  assert.match(t, /8 kg/, '200 g x 40 = 8 kg (borne basse viande)');
  assert.match(t, /2 kg–2,4 kg/, '50–60 g x 40 (garniture sèche)');
  assert.match(t, /État de poids non établi/);
  assert.match(t, /poids sec/);
  assert.match(t, /sans effet sur les portions du menu ni sur les commandes/);
  assert.equal(tout(bloc, 'input').length, 0);
  assert.deepEqual(magasin.etat(), avant, 'aucun champ d\'état modifié');
});

test('fiche de fonction sans couverts connus : quantités par couvert seulement', () => {
  ficheAvec(0);
  const page = vues.detail.rendre(magasin.etat(), S.lundi);
  const bloc = blocBuffet(page);
  assert.ok(bloc);
  assert.match(bloc.textContent, /Par couvert/);
  assert.doesNotMatch(bloc.textContent, /Pour 0|NaN|undefined/);
});

test('allergènes : les 14 du référentiel concordent avec ALLERGENES (une rubrique chacun)', () => {
  const entree = rattachementsDe('allergene').find((x) => x.id === 'hygiene.allergenes.liste-14');
  assert.ok(entree);
  const liste = entree.enonce.split(': ')[1].replace(/\([^)]*\)/g, '').split('.')[0].split(',').map((s) => s.trim());
  assert.equal(liste.length, 14);
  assert.equal(ALLERGENES.length, 14);
  assert.equal(new Set(ALLERGENES.map(([cle]) => cle)).size, 14);
  for (const [cle, libelle] of ALLERGENES) {
    assert.equal(liste.filter((x) => x.includes(libelle)).length, 1, `${cle} (${libelle}) : une seule rubrique du référentiel`);
  }
  for (const x of liste) assert.ok(ALLERGENES.some(([, l]) => x.includes(l)), `rubrique « ${x} » absente de ALLERGENES`);
  assert.ok(rattachementsDe('allergene').every((x) => x.theme === 'hygiene'));
});

test('source légale des allergènes : une ligne, avec « à valider localement », sans compatibilité affirmée', () => {
  const t = reference.texteSourceAllergenes();
  assert.match(t, /Source légale/);
  assert.match(t, /817\.022\.16/);
  assert.match(t, /à valider localement/);
  assert.equal(t.includes('\n'), false);
  assert.doesNotMatch(t, /compatible|sans allergène|garanti/i);
});

test('Réglages : la rubrique « Repères métier » affiche la page de consultation, sans second titre', async () => {
  const { rendre } = await import('../app/js/ui/vue-reglages.js');
  const { etatVide } = await import('./aide.js');
  const page = rendre(etatVide(), 'reperes');
  assert.equal(page.tous((x) => x.balise === 'h1').length, 1);
  assert.ok(page.tous((x) => x.balise === 'button').length >= 2, 'les thèmes sont proposés');
});
