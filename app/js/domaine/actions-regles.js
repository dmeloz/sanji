// Actions sur les réglages, les règles de préparation, les recettes et les fournisseurs.
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { cleSure, exiger, exigerComposant, exigerRecette, terminer, verifierDans, verifierEntierOuNul, verifierH, verifierQuantiteOuNul } from './actions-socle.js';
import { fournisseurVide, normaliser, nouvelId, recetteVide, regleVide } from './etat.js';
import { UNITE } from './statuts.js';

// ---------------------------------------------------------------- réglages

/**
 * Marge de sécurité (en %, entier de 0 à 50, ou null = aucune) : elle majore la seule quantité PROPOSÉE à commander
 * après une vérification chiffrée. Jamais le besoin brut, jamais la cible de production, jamais la quantité à acheter.
 */
export function definirMargeSecurite(etat, pourcent, h) {
  verifierH(h);
  if (pourcent !== null && (!Number.isInteger(pourcent) || pourcent < 0 || pourcent > 50)) {
    throw new Error('Marge de sécurité : un entier de 0 à 50 (en %) ou rien.');
  }
  etat.reglages.margeSecurite = pourcent;
  return terminer(etat, h, 'definirMargeSecurite', pourcent === null ? 'aucune' : `${pourcent} %`, pourcent);
}

/** Note la date du dernier export (pour le rappel de sauvegarde). Ne fait pas partie du fichier exporté lui-même. */
export function noterExport(etat, h) {
  verifierH(h);
  etat.reglages.dernierExport = h;
  return terminer(etat, h, 'noterExport', h, h);
}

// ---------------------------------------------------------------- règles, recettes, fournisseurs

/** Étapes d'une règle : libellés non vides, clés uniques sans accent, avances entières ≥ 0 ou nulles, 6 au plus. */
function normaliserEtapesRegle(etapes, existantes) {
  if (etapes === undefined) return structuredClone(existantes ?? []);
  if (!Array.isArray(etapes)) throw new Error('Étapes : liste attendue.');
  if (etapes.length > 6) throw new Error('Une préparation a au plus 6 étapes.');
  const vues = new Set();
  return etapes.map((x, i) => {
    const libelle = String(x?.libelle ?? '').trim();
    if (libelle === '') throw new Error(`Étape ${i + 1} : le libellé est obligatoire.`);
    let cle;
    if (x.cle !== undefined && x.cle !== null && x.cle !== '') {
      cle = String(x.cle);
      if (!/^[a-z0-9-]+$/.test(cle)) throw new Error(`Étape « ${libelle} » : la clé s'écrit sans accent, sans espace ni caractère spécial.`);
    } else {
      cle = normaliser(libelle).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (cle === '') throw new Error(`Étape « ${libelle} » : le libellé doit contenir une lettre ou un chiffre.`);
    }
    if (vues.has(cle)) throw new Error(`Les clés des étapes doivent être uniques : « ${cle} » apparaît deux fois.`);
    vues.add(cle);
    const avanceMaxJours = verifierEntierOuNul(x.avanceMaxJours ?? null, `Avance maximale de l'étape « ${libelle} »`);
    return { cle, libelle, avanceMaxJours };
  });
}

/**
 * Crée ou met à jour la règle de préparation d'un nom (clé = nom normalisé, unique). champs : nom, cle,
 * avanceMaxJours, limiteUtilisationJours, note, id (mise à jour), etapes (facultatif : absent = étapes conservées).
 * `valideLe` est renseigné quand la limite d'utilisation l'est. Retourne l'identifiant.
 */
export function definirRegle(etat, champs, h) {
  verifierH(h);
  const nom = String(champs?.nom ?? '').trim();
  if (nom === '') throw new Error('Le nom de la règle est obligatoire.');
  const cle = cleSure(normaliser(champs.cle ?? nom));
  const avanceMaxJours = verifierEntierOuNul(champs.avanceMaxJours ?? null, "Avance maximale");
  const limiteUtilisationJours = verifierEntierOuNul(champs.limiteUtilisationJours ?? null, "Limite d'utilisation");
  const existante = (champs.id && etat.regles[champs.id]) || Object.values(etat.regles).find((r) => r.cle === cle);
  const etapes = normaliserEtapesRegle(champs.etapes, existante?.etapes);
  const id = existante?.id ?? nouvelId('regle');
  etat.regles[id] = { ...regleVide(id), nom, cle, avanceMaxJours, limiteUtilisationJours,
    valideLe: limiteUtilisationJours !== null ? h : null, note: String(champs.note ?? ''), etapes };
  return terminer(etat, h, 'definirRegle', nom, id);
}

export function supprimerRegle(etat, regleId, h) {
  verifierH(h);
  const r = exiger(etat.regles, regleId, 'Règle');
  delete etat.regles[regleId];
  return terminer(etat, h, 'supprimerRegle', r.nom, true);
}

function normaliserRecette(champs, existante) {
  const nom = String(champs.nom ?? existante.nom).trim();
  if (nom === '') throw new Error('Le nom de la recette est obligatoire.');
  const rendement = { ...existante.rendement, ...(champs.rendement ?? {}) };
  if (rendement.valeur !== null && (!Number.isFinite(rendement.valeur) || rendement.valeur <= 0)) throw new Error('Le rendement doit être strictement positif (ou vide).');
  verifierDans(rendement.unite, UNITE, 'Unité du rendement');
  const ingredients = (champs.ingredients ?? existante.ingredients).map((i) => {
    if (String(i.nom ?? '').trim() === '') throw new Error("Chaque ingrédient doit avoir un nom.");
    verifierQuantiteOuNul(i.quantite ?? null, `Quantité de ${i.nom}`);
    return { nom: String(i.nom).trim(), quantite: i.quantite ?? null, unite: verifierDans(i.unite ?? 'g', UNITE, 'Unité'), fournisseurId: i.fournisseurId ?? null };
  });
  const allergenes = [...(champs.allergenes ?? existante.allergenes)];
  return { nom, rendement: { valeur: rendement.valeur, unite: rendement.unite }, ingredients, allergenes };
}

/** Crée une recette (version 1, non validée). champs : nom, rendement {valeur, unite}, ingredients, allergenes. */
export function creerRecette(etat, champs, h) {
  verifierH(h);
  const id = nouvelId('recette');
  etat.recettes[id] = { ...recetteVide(id), ...normaliserRecette(champs ?? {}, recetteVide(id)) };
  return terminer(etat, h, 'creerRecette', etat.recettes[id].nom, id);
}

/**
 * Compositeur de mélange : « 2 parts de carottes, 1 part de courgettes ». Crée une recette maison EN PARTS (rendement =
 * total des parts, en grammes), la lie au composant et le passe en préparation maison. La recette n'est pas validée : le
 * chef la valide, comme n'importe quelle recette. Les ingrédients sont des proportions de la quantité finie : la perte de
 * parage de chaque légume n'y est pas appliquée (à compléter par le chef).
 * @param {{nom:string, parts:number}[]} parts au moins deux lignes, parts strictement positives
 * @returns {string} l'identifiant de la recette
 */
export function composerMelange(etat, composantId, parts, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  if (!Array.isArray(parts) || parts.length < 2) throw new Error('Un mélange compte au moins deux composants.');
  for (const l of parts) {
    if (String(l?.nom ?? '').trim() === '') throw new Error('Chaque composant du mélange doit avoir un nom.');
    if (!Number.isFinite(l.parts) || l.parts <= 0) throw new Error(`Part de « ${l.nom} » : un nombre strictement positif est attendu.`);
  }
  const total = parts.reduce((somme, l) => somme + l.parts, 0);
  const recetteId = creerRecette(etat, {
    nom: `Mélange ${c.nom}`, rendement: { valeur: total, unite: 'g' },
    ingredients: parts.map((l) => ({ nom: String(l.nom).trim(), quantite: l.parts, unite: 'g' })),
  }, h);
  c.recetteId = recetteId;
  c.recetteVersion = etat.recettes[recetteId].version;
  c.type = 'preparation_maison';
  return terminer(etat, h, 'composerMelange', `${c.nom} : ${parts.map((l) => `${l.parts} ${l.nom}`).join(', ')}`, recetteId);
}

/** Nouvelle version : l'ancienne passe dans l'historique et la recette doit être revalidée. */
export function modifierRecette(etat, recetteId, champs, h) {
  verifierH(h);
  const r = exigerRecette(etat, recetteId);
  const maj = normaliserRecette(champs ?? {}, r);
  r.historique.push({ version: r.version, h, resume: 'version remplacée', nom: r.nom, rendement: r.rendement,
    ingredients: r.ingredients, allergenes: r.allergenes, valide: r.valide });
  Object.assign(r, maj, { version: r.version + 1, valide: false });
  return terminer(etat, h, 'modifierRecette', `${r.nom} v${r.version}`, r);
}

/** Valide la recette actuelle : rendement et quantités de tous les ingrédients doivent être renseignés. */
export function validerRecette(etat, recetteId, h) {
  verifierH(h);
  const r = exigerRecette(etat, recetteId);
  if (!Number.isFinite(r.rendement.valeur) || r.rendement.valeur <= 0) throw new Error('Validation impossible : le rendement est à renseigner.');
  if (r.ingredients.length === 0 || r.ingredients.some((i) => !Number.isFinite(i.quantite) || i.quantite <= 0)) {
    throw new Error('Validation impossible : chaque ingrédient doit avoir une quantité.');
  }
  r.valide = true;
  r.historique.push({ version: r.version, h, resume: 'validée' });
  return terminer(etat, h, 'validerRecette', `${r.nom} v${r.version}`, r);
}

/** Crée ou met à jour un fournisseur (champs : id, nom, delaiJours, heureLimite, note). Retourne l'identifiant. */
export function definirFournisseur(etat, champs, h) {
  verifierH(h);
  const nom = String(champs?.nom ?? '').trim();
  if (nom === '') throw new Error('Le nom du fournisseur est obligatoire.');
  const delaiJours = verifierEntierOuNul(champs.delaiJours ?? null, 'Délai fournisseur');
  const id = champs.id && etat.fournisseurs[champs.id] ? champs.id : nouvelId('fourn');
  etat.fournisseurs[id] = { ...fournisseurVide(id), nom, delaiJours, heureLimite: String(champs.heureLimite ?? ''), note: String(champs.note ?? '') };
  return terminer(etat, h, 'definirFournisseur', nom, id);
}

export function supprimerFournisseur(etat, fournisseurId, h) {
  verifierH(h);
  const f = exiger(etat.fournisseurs, fournisseurId, 'Fournisseur');
  delete etat.fournisseurs[fournisseurId];
  for (const s of Object.values(etat.produits)) if (s.fournisseurId === fournisseurId) s.fournisseurId = null;
  for (const r of Object.values(etat.recettes)) for (const i of r.ingredients) if (i.fournisseurId === fournisseurId) i.fournisseurId = null;
  return terminer(etat, h, 'supprimerFournisseur', f.nom, true);
}
