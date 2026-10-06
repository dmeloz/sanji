// Fournisseur Anthropic pour les ESSAIS EN LOCAL : relais vers le module de l'application (une seule implémentation),
// avec la clé lue dans ANTHROPIC_API_KEY et le modèle dans SANJI_MODELE. La clé n'est jamais écrite ni journalisée.

import { creerFournisseurWeb, MODELE_PAR_DEFAUT } from '../app/js/ui/fournisseur-web.js';

export { construireCorps, MODELE_PAR_DEFAUT, URL_API, versJsonSchema } from '../app/js/ui/fournisseur-web.js';

/** @param {object} [options] mêmes options que `creerFournisseurWeb` ; `cle` et `modele` viennent de l'environnement par défaut. */
export function creerFournisseurAnthropic({
  cle = process.env.ANTHROPIC_API_KEY, modele = process.env.SANJI_MODELE ?? MODELE_PAR_DEFAUT, ...autres
} = {}) {
  return creerFournisseurWeb({ cle, modele, ...autres });
}
