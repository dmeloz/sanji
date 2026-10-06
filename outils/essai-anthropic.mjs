// Essai de bout en bout du harness avec l'API Anthropic, sur des données de TEST uniquement (tests/jeux).
// Rien de réel n'est envoyé : noms neutres et nombres arbitraires. La clé vient de ANTHROPIC_API_KEY.
//
//   read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY && node outils/essai-anthropic.mjs
//   (ajouter --montrer pour afficher exactement ce qui est envoyé ; SANJI_MODELE change de modèle)

import { proposerPlanningAssiste } from '../app/js/harness/orchestrateur.js';
import { creerRegistre } from '../app/js/harness/propositions.js';
import { expliquer } from '../app/js/harness/trace.js';
import { composantValide, etatVide, prevision } from '../tests/aide.js';
import { JEU_COMPOSANTS as J } from '../tests/jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from '../tests/jeux/TEST_ONLY-semaine.js';
import { creerFournisseurAnthropic } from './fournisseur-anthropic.mjs';

const montrer = process.argv.includes('--montrer');

function etatDEssai() {
  const e = etatVide();
  for (const date of [S.lundi, S.mardi, S.mercredi]) {
    prevision(e, date, 1, 40);
    prevision(e, date, 2, 30);
    composantValide(e, date, 1, J.PRODUIT_SEC_TEST);
    composantValide(e, date, 2, J.PRODUIT_CRU_TEST);
  }
  return e;
}

const fetchObserve = async (url, options) => {
  if (montrer) console.log(`--- envoyé à ${url} (sans la clé) ---\n${JSON.stringify(JSON.parse(options.body), null, 2)}\n---`);
  return globalThis.fetch(url, options);
};

const fournisseur = creerFournisseurAnthropic({ fetchImpl: fetchObserve });
if (!fournisseur.disponible()) {
  console.error('ANTHROPIC_API_KEY absente de cet environnement : aucun appel fait.');
  console.error('Dans votre terminal : read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY && node outils/essai-anthropic.mjs');
  process.exit(2);
}

console.log(`Modèle : ${fournisseur.nom} — données de test uniquement.`);
const etat = etatDEssai();
const { proposition, mode, avertissements } = await proposerPlanningAssiste({
  etat, h: '2026-10-02T08:00:00', aujourdhui: S.veille, dateDebut: S.lundi, dateFin: S.mercredi,
  registre: creerRegistre(), fournisseur, delaiMs: 60000,
});
console.log(`Mode : ${mode}${mode === 'deterministe' ? " (le modèle n'a pas été retenu)" : ''}`);
for (const a of avertissements) console.log(`Avertissement : ${a}`);
for (const i of proposition.items) console.log(`  ${i.nom} (service ${i.dateService}) -> ${i.date} ${i.creneau} · ${i.quantite.libelle}`);
for (const d of proposition.aDecider) console.log(`  À décider : ${d.texte}`);
console.log(expliquer(proposition).map((l) => `  ${l}`).join('\n'));
if (fournisseur.dernierUsage) console.log(`Jetons : ${fournisseur.dernierUsage.input_tokens} en entrée, ${fournisseur.dernierUsage.output_tokens} en sortie.`);
