// Outils des tests du harness (ce n'est pas un test). Rien de tout cela n'existe dans app/.

import { h } from './aide.js';

/**
 * Exécuteur de test : même contrat que `agir` de magasin.js (copie, application, remplacement seulement en cas de
 * succès, `{ok, valeur|erreur}`), sans IndexedDB ni DOM. `ref.etat` est l'état courant.
 */
export function executeurDe(ref) {
  let minute = 100;
  return (fonction) => {
    const copie = structuredClone(ref.etat);
    try {
      const valeur = fonction(copie, h(minute++));
      ref.etat = copie;
      return { ok: true, valeur };
    } catch (erreur) {
      return { ok: false, erreur: erreur?.message ?? String(erreur) };
    }
  };
}

/**
 * Fournisseur de modèle scripté. Chaque élément de `reponses` est une réponse, une fonction (requête → réponse),
 * une `Error` (le fournisseur échoue) ou `ATTENTE` (ne répond jamais : test du délai).
 */
export const ATTENTE = Symbol('attente');

export function fournisseurScripte(reponses, { disponible = true } = {}) {
  const requetes = [];
  let i = 0;
  return {
    nom: 'scripte',
    requetes,
    disponible: () => disponible,
    demander(requete, { signal }) {
      requetes.push(requete);
      const suivante = reponses[Math.min(i, reponses.length - 1)];
      i += 1;
      const valeur = typeof suivante === 'function' ? suivante(requete) : suivante;
      if (valeur === ATTENTE) {
        return new Promise((_, rejeter) => signal.addEventListener('abort', () => rejeter(new Error('interrompu'))));
      }
      if (valeur instanceof Error) return Promise.reject(valeur);
      return Promise.resolve(valeur);
    },
  };
}
