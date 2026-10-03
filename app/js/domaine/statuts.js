// Vocabulaire fermé : identifiants techniques sans accent, libellés accentués pour l'écran.
// Convention : la clé de chaque énumération est égale à sa valeur (PROVENANCE.CALCULE === 'CALCULE',
// CERTITUDE.estimee === 'estimee').

const enumeration = (valeurs) => Object.freeze(Object.fromEntries(valeurs.map((v) => [v, v])));

export const PROVENANCE = enumeration(['RESTAURANT_VALIDE', 'BASE_METIER_ESTIMATION', 'SAISI_SERVICE', 'CALCULE', 'INCONNU']);
export const CERTITUDE = enumeration(['estimee', 'provisoire', 'confirmee']);
export const ETAT_TACHE = enumeration(['a_preciser', 'a_planifier', 'a_faire', 'en_cours', 'fait', 'ecart']);
export const CRENEAU = enumeration(['avant_midi', 'apres_midi', 'avant_soir']);
export const ETAT_CRENEAU = enumeration(['libre', 'charge', 'indisponible']);
export const CHARGE = enumeration(['courte', 'moyenne', 'longue']);
export const TYPE_COMPOSANT = enumeration(['produit_simple', 'preparation_maison', 'generique', 'a_preciser']);
export const CATEGORIE = enumeration(['legume', 'feculent', 'proteine', 'sauce', 'autre', 'a_preciser']);
// composant_recette : protéine, poisson ou autre ingrédient d'une recette de pâtes ou de risotto (menu 1), produit par le
// poste mais qui n'est pas « le plat principal » (un repère de portion de viande ne s'y applique pas). herbe : herbe aromatique,
// qui va à la botte ou à la pièce et non à la portion.
export const ROLE = enumeration(['plat_principal', 'garniture', 'sauce', 'autre', 'composant_recette', 'herbe']);
export const ETAPE = enumeration(['portionnement', 'cuisson', 'parage']);
/** État du poids d'une portion : sec (produit sec), cru net (cru, déjà paré) ou cuit (poids servi). */
export const ETAT_POIDS = enumeration(['sec', 'cru_net', 'cuit']);
export const UNITE = enumeration(['g', 'ml', 'piece']);
export const VERIF = enumeration(['a_verifier', 'suffisant', 'a_commander']);

/** Points de charge d'une production (1, 2, 3). Ce n'est jamais une durée. */
export const POINTS_CHARGE = Object.freeze({ courte: 1, moyenne: 2, longue: 3 });

/** Le mot « provisoire » ne désigne que la répartition d'un groupe ; ceci est le libellé d'un calcul sur estimation. */
export const LIBELLE_ESTIMATION_A_VALIDER = 'estimation à valider';

export const LIBELLES = Object.freeze({
  PROVENANCE: Object.freeze({
    RESTAURANT_VALIDE: 'validé restaurant',
    BASE_METIER_ESTIMATION: 'estimation base métier',
    SAISI_SERVICE: 'saisi au service',
    CALCULE: 'calculé',
    INCONNU: 'inconnu',
  }),
  CERTITUDE: Object.freeze({ estimee: 'estimée', provisoire: 'provisoire', confirmee: 'confirmée' }),
  ETAT_TACHE: Object.freeze({
    a_preciser: 'à préciser', a_planifier: 'à planifier', a_faire: 'à faire',
    en_cours: 'en cours', fait: 'fait', ecart: 'écart à arbitrer',
  }),
  CRENEAU: Object.freeze({
    avant_midi: 'avant le service de midi',
    apres_midi: 'après le service de midi',
    avant_soir: 'avant le service du soir',
  }),
  ETAT_CRENEAU: Object.freeze({ libre: 'libre', charge: 'chargé', indisponible: 'indisponible' }),
  CHARGE: Object.freeze({ courte: 'courte', moyenne: 'moyenne', longue: 'longue' }),
  TYPE_COMPOSANT: Object.freeze({
    produit_simple: 'produit simple', preparation_maison: 'préparation maison',
    generique: 'composant générique', a_preciser: 'à préciser',
  }),
  CATEGORIE: Object.freeze({
    legume: 'légume', feculent: 'féculent', proteine: 'protéine', sauce: 'sauce',
    autre: 'autre', a_preciser: 'à préciser',
  }),
  ROLE: Object.freeze({ plat_principal: 'plat principal', garniture: 'garniture', sauce: 'sauce', autre: 'autre', composant_recette: 'composant de la recette', herbe: 'herbe aromatique' }),
  ETAPE: Object.freeze({ portionnement: 'portionnement', cuisson: 'cuisson', parage: 'parage' }),
  ETAT_POIDS: Object.freeze({ sec: 'sec', cru_net: 'cru net', cuit: 'cuit' }),
  UNITE: Object.freeze({ g: 'g', ml: 'ml', piece: 'pièce' }),
  VERIF: Object.freeze({
    a_verifier: 'à vérifier', suffisant: 'suffisant', a_commander: 'à commander', a_reverifier: 'à revérifier',
  }),
});

/** Libellé affichable d'une valeur : libelle('ETAT_TACHE', 'ecart') -> « écart à arbitrer ». */
export function libelle(famille, valeur) {
  return LIBELLES[famille]?.[valeur] ?? String(valeur);
}
