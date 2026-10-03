// FICHIER GÉNÉRÉ : NE PAS ÉDITER À LA MAIN.
// Produit par outils/generer-savoir-metier.mjs (commande : npm run savoir) à partir de
// connaissances/savoir-metier.json.
//
// Repères de portion VALIDÉS par la propriétaire (statut « valide_chef »). Une fourchette est donnée par min et max,
// jamais par une moyenne. `appliquee: false` : validé, mais pas encore branché sur le calcul.

export const VERSION_SAVOIR = "2026-10-03";

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    Object.values(valeur).forEach(geler);
    Object.freeze(valeur);
  }
  return valeur;
}

export const REPERES_VALIDES = geler([
  {"produit":"pâtes sèches","role":"garniture","etat":"sec","min":50,"max":75,"unite":"g","texte":"50–75 g","sources":[{"titre":"Société Suisse de Nutrition 2024"},{"titre":"Migusto 2024"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":true,"note":""},
  {"produit":"pâtes sèches","role":"plat_principal","etat":"sec","min":80,"max":100,"unite":"g","texte":"80–100 g","sources":[{"titre":"Migusto 2024"},{"titre":"Swissmilk"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":true,"note":""},
  {"produit":"riz","role":"garniture","etat":"sec","min":50,"max":70,"unite":"g","texte":"50–70 g","sources":[{"titre":"Société Suisse de Nutrition 2024"},{"titre":"Migusto 2024"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":true,"note":""},
  {"produit":"légumineuses sèches","role":"garniture","etat":"sec","min":60,"max":70,"unite":"g","texte":"60–70 g","sources":[{"titre":"Société Suisse de Nutrition 2024"},{"titre":"Migusto 2024"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":true,"note":""},
  {"produit":"viande sans os (émincé, escalope, ragoût)","role":"plat_principal","etat":"cru_net","min":100,"max":120,"unite":"g","texte":"100–120 g","sources":[{"titre":"Migusto 2024"},{"titre":"Swissmilk"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":false,"note":"Pas encore de famille protéine dans l’application : validé mais sans effet sur le calcul."},
  {"produit":"œufs","role":"plat_principal","etat":"cru_net","min":2,"max":3,"unite":"piece","texte":"2–3 pièces","sources":[{"titre":"Société Suisse de Nutrition 2024"},{"titre":"GEM-RCN 2015"}],"validation":"valide_chef","validePar":"propriétaire","valideLe":"2026-10-03","appliquee":false,"note":"Pas encore de famille protéine dans l’application : validé mais sans effet sur le calcul."},
]);
