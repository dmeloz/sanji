// Confidentialité du contexte envoyé au modèle : un nom bloqué (allergie, nom propre, trop long) ne part nulle part.
// Données TEST_ONLY ; aucun réseau.

import test from 'node:test';
import assert from 'node:assert/strict';
import { construireContexte } from '../app/js/harness/contexte.js';
import { construireCorps } from '../app/js/ui/fournisseur-web.js';
import { JEU_COMPOSANTS as J } from './jeux/TEST_ONLY-composants.js';
import { JEU_SEMAINE as S } from './jeux/TEST_ONLY-semaine.js';
import { composantValide, etatVide, prevision } from './aide.js';

const INCONNU = { valeur: null, unite: 'g', statut: 'INCONNU', source: '' };
const NOMS_BLOQUES = ['PLAT_TEST sans gluten allergique', 'PLAT_TEST pour Mme DUPONT_TEST', `PLAT_LONG_TEST ${'x'.repeat(80)}`];

test('contexte : un nom bloqué n\'apparaît ni dans les entrées, ni dans « manquantes », ni dans le corps de la requête', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  // Un grammage inconnu : la quantité est inconnue, d'où une ligne « manquantes ».
  for (const nom of NOMS_BLOQUES) composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { nom, grammage: INCONNU });
  const contexte = construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.lundi, aujourdhui: S.lundi });
  assert.ok(contexte.donnees.manquantes.some((m) => m.type === 'quantite'), 'le cas « quantité inconnue » est bien exercé');
  const corps = JSON.stringify(construireCorps({ contexte, brouillonDeterministe: {} }, { modele: 'claude-sonnet-5-5', maxTokens: 1, effort: 'low' }));
  for (const sortie of [JSON.stringify(contexte), corps]) {
    for (const nom of NOMS_BLOQUES) assert.ok(!sortie.includes(nom), `« ${nom.slice(0, 20)}… » ne doit pas partir`);
    assert.ok(!/DUPONT_TEST|allergique|x{61}/.test(sortie));
  }
  assert.ok(contexte.donnees.manquantes.every((m) => m.type !== 'quantite' || /^un composant : quantité inconnue$/.test(m.texte)));
});

test('contexte : un nom ordinaire reste dans le texte « quantité inconnue »', () => {
  const e = etatVide();
  prevision(e, S.lundi, 1, 40);
  composantValide(e, S.lundi, 1, J.PRODUIT_SEC_TEST, { grammage: INCONNU });
  const contexte = construireContexte(e, { tache: 'planning', dateDebut: S.lundi, dateFin: S.lundi, aujourdhui: S.lundi });
  assert.ok(contexte.donnees.manquantes.some((m) => m.texte === 'PRODUIT_SEC_TEST : quantité inconnue'));
});
