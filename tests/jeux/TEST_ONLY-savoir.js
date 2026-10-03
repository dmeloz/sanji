// JEU DE TEST — TEST_ONLY. Mots de catégorie génériques (riz, carottes, poulet…) et nombres arbitraires choisis pour
// vérifier l'arithmétique. AUCUNE de ces valeurs n'est une portion, un grammage ou un coefficient de référence ;
// aucune ne doit devenir une valeur par défaut, et aucun intitulé n'est recopié d'un vrai menu.
// Ne jamais importer ce fichier depuis app/ ni dans des données réelles.

const ligne = (produit, role, etat, min, max, unite = 'g') => ({
  produit, role, etat, min, max, unite, texte: `${min === max ? min : `${min}–${max}`} ${unite}`, sources: '', note: '',
});

/** Intitulés génériques : un mot de catégorie par composant. */
export const JEU_MENUS = Object.freeze({
  etiquette: 'TEST_ONLY',
  unSeul: 'riz',
  garnitures: 'riz, carottes, poulet',
  garnituresSansPoulet: 'riz, carottes',
  autreSemaine: 'riz, courgettes, poulet',
  principal: 'poulet, carottes',
  inconnu: 'ELEMENT_INCONNU_TEST',
  doublon: 'riz, carottes, riz',
});

/** Standards maison de test : portions arbitraires, avec l'état de leur poids. */
export const JEU_STANDARDS = Object.freeze({
  etiquette: 'TEST_ONLY',
  sec: Object.freeze({ valeur: 100, unite: 'g', etat: 'sec' }),
  cuit: Object.freeze({ valeur: 100, unite: 'g', etat: 'cuit' }),
  cruNet: Object.freeze({ valeur: 150, unite: 'g', etat: 'cru_net' }),
});

/**
 * Repères de portion de test, à injecter à la place de PORTIONS_BASE (qui est vide aujourd'hui).
 * Une ligne de groupe porte le libellé du groupe ; une ligne de famille porte le libellé de la famille.
 */
export const JEU_REPERES = Object.freeze({
  etiquette: 'TEST_ONLY',
  groupeCereales: ligne('Pâtes, riz, céréales', 'garniture', 'sec', 60, 80),
  groupeCerealesPrincipal: ligne('Pâtes, riz, céréales', 'plat_principal', 'sec', 90, 110),
  groupeLegumes: ligne('Légumes', 'garniture', 'cru_net', 120, 160),
  groupeLegumesCuit: ligne('Légumes', 'garniture', 'cuit', 100, 100),
  familleRiz: ligne('riz', 'garniture', 'sec', 50, 50),
  familleCarottes: ligne('Carottes', 'garniture', 'cru_net', 200, 240),
});
