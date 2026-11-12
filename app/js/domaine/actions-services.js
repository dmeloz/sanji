// Actions sur les prévisions, les fiches de fonction et l'après-service.
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { exigerComposant, exigerFiche, terminer, verifierDate, verifierEntierOuNul, verifierH, verifierMenuDuJour, verifierQuantiteOuNul, verifierSemaineModifiable } from './actions-socle.js';
import { assurerJour, ficheVide, nouvelId } from './etat.js';

// ---------------------------------------------------------------- prévisions et fiches

/** Prévision de portions hors groupes (entier ≥ 0, ou null pour effacer), horodatée. Ne touche jamais au réel. */
export function definirPrevision(etat, date, menu, portions, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierSemaineModifiable(date, h);
  verifierEntierOuNul(portions, 'Prévision');
  const j = assurerJour(etat, date);
  const avant = j.previsions[menu].portions;
  j.previsions[menu] = { portions, h };
  j.couverts = null; // une prévision menu par menu n'est plus le total saisi
  return terminer(etat, h, 'definirPrevision', `${date} menu ${menu} : ${avant ?? '—'} -> ${portions ?? '—'}`, j.previsions[menu]);
}

function nombreRepartition(r) {
  if (r === null || typeof r !== 'object') throw new Error('Répartition invalide.');
  const res = {};
  for (const m of [1, 2]) {
    const v = r[m] ?? 0;
    if (!Number.isInteger(v) || v < 0) throw new Error(`Répartition du menu ${m} : entier supérieur ou égal à 0 attendu.`);
    res[m] = v;
  }
  return res;
}

const CHAMPS_FICHE = ['numero', 'date', 'service', 'horaire', 'couverts', 'mode', 'menuFixe', 'repartition', 'allergies', 'remarques'];

/** Applique des champs validés à une fiche ; renvoie la liste des champs réellement modifiés. */
function appliquerChampsFiche(fiche, champs) {
  const inconnus = Object.keys(champs ?? {}).filter((k) => !CHAMPS_FICHE.includes(k));
  if (inconnus.length > 0) throw new Error(`Champ de fiche non modifiable : ${inconnus.join(', ')}.`);
  const futur = { ...fiche, ...champs };
  verifierDate(futur.date);
  if (!['midi', 'soir'].includes(futur.service)) throw new Error('Le service doit être « midi » ou « soir ».');
  if (!['menu_fixe', 'choix_libre', 'hors_menu'].includes(futur.mode)) throw new Error('Mode de fiche inconnu.');
  if (!Number.isInteger(futur.couverts) || futur.couverts < 0) throw new Error('Les couverts : entier supérieur ou égal à 0 attendu.');
  if (futur.mode === 'menu_fixe' && futur.menuFixe !== 1 && futur.menuFixe !== 2) throw new Error('Un menu fixé doit indiquer le menu 1 ou 2.');
  const repartition = nombreRepartition(futur.repartition);
  const modifies = [];
  for (const k of CHAMPS_FICHE) {
    if (!(k in (champs ?? {}))) continue;
    const valeur = k === 'repartition' ? repartition : champs[k];
    if (JSON.stringify(valeur) !== JSON.stringify(fiche[k])) { fiche[k] = valeur; modifies.push(k); }
  }
  return modifies;
}

/**
 * Crée une fiche de fonction. champs : numero, date, service ('midi'|'soir'), horaire, couverts, mode
 * ('menu_fixe'|'choix_libre'|'hors_menu'), menuFixe (1|2), repartition {1,2}, allergies, remarques.
 * Une répartition de choix libre est toujours créée « provisoire ». Retourne l'identifiant.
 */
export function creerFiche(etat, champs, h) {
  verifierH(h);
  const id = nouvelId('fiche');
  const fiche = ficheVide(id);
  appliquerChampsFiche(fiche, champs);
  verifierSemaineModifiable(fiche.date, h);
  fiche.historique.push({ version: 1, h, resume: 'création' });
  etat.fiches[id] = fiche;
  return terminer(etat, h, 'creerFiche', `${fiche.date} ${fiche.service} ${fiche.numero}`, id);
}

/**
 * Modifie une fiche active : la version augmente et l'historique garde le résumé. Une répartition modifiée
 * redevient « provisoire » tant qu'elle n'est pas confirmée par confirmerRepartition.
 */
export function modifierFiche(etat, ficheId, champs, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (f.statut === 'annulee') throw new Error('Cette fiche est annulée : elle ne se modifie plus.');
  verifierSemaineModifiable(f.date, h);
  if (champs && 'date' in champs) verifierSemaineModifiable(champs.date, h);
  const modifies = appliquerChampsFiche(f, champs);
  if (modifies.includes('repartition') || modifies.includes('mode')) f.statutRepartition = 'provisoire';
  if (modifies.length > 0) {
    f.version += 1;
    f.historique.push({ version: f.version, h, resume: `modifiée : ${modifies.join(', ')}` });
  }
  return terminer(etat, h, 'modifierFiche', `${f.numero || f.id} : ${modifies.join(', ') || 'aucun changement'}`, f);
}

/** Annule une fiche : son besoin disparaît du calcul (la fiche reste consultable). */
export function annulerFiche(etat, ficheId, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  verifierSemaineModifiable(f.date, h);
  if (f.statut !== 'annulee') {
    f.statut = 'annulee';
    f.version += 1;
    f.historique.push({ version: f.version, h, resume: 'annulée' });
  }
  return terminer(etat, h, 'annulerFiche', f.numero || f.id, f);
}

/** Confirme le choix réel d'un groupe à choix libre : la répartition confirmée remplace la provisoire. */
export function confirmerRepartition(etat, ficheId, repartition, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (f.statut === 'annulee') throw new Error('Cette fiche est annulée.');
  if (f.mode !== 'choix_libre') throw new Error('Seule une fiche à choix libre a une répartition à confirmer.');
  f.repartition = nombreRepartition(repartition);
  f.statutRepartition = 'confirmee';
  f.version += 1;
  f.historique.push({ version: f.version, h, resume: 'répartition confirmée' });
  return terminer(etat, h, 'confirmerRepartition', f.numero || f.id, f);
}

/** Trace une adaptation ou substitution confirmée par l'humain. */
export function ajouterAdaptation(etat, ficheId, texte, h) {
  verifierH(h);
  const f = exigerFiche(etat, ficheId);
  if (typeof texte !== 'string' || texte.trim() === '') throw new Error("Décrivez l'adaptation.");
  const a = { h, texte: texte.trim() };
  f.adaptations.push(a);
  return terminer(etat, h, 'ajouterAdaptation', f.numero || f.id, a);
}

// ---------------------------------------------------------------- après service

/** Ventes réelles d'un menu (repère pour les prévisions futures ; ne modifie jamais une prévision). */
export function saisirVentes(etat, date, menu, ventes, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierEntierOuNul(ventes, 'Ventes');
  const j = assurerJour(etat, date);
  j.ventes[menu] = ventes;
  j.ventes.h = h;
  return terminer(etat, h, 'saisirVentes', `${date} menu ${menu} : ${ventes ?? '—'}`, j.ventes);
}

/** Surplus utilisable, rebut et note d'un composant (le rebut n'est pas une perte normale de parage ou de cuisson). */
export function saisirApresService(etat, composantId, saisie, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  const surplus = verifierQuantiteOuNul(saisie?.surplus ?? null, 'Surplus');
  const rebut = verifierQuantiteOuNul(saisie?.rebut ?? null, 'Rebut');
  c.apresService = { surplus, rebut, note: String(saisie?.note ?? '') };
  return terminer(etat, h, 'saisirApresService', c.nom, c.apresService);
}
