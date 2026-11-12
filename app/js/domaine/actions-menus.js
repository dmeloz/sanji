// Actions sur les menus et les composants.
// Découpé depuis actions.js (étape 3 de la refonte) : le code est inchangé, `actions.js` réexporte tout.
// Chaque action prend l'horodatage ISO `h` en DERNIER argument. Une saisie invalide lève une Error en français.

import { retenirReglage } from './actions-productions.js';
import { CLES_INTERDITES, exigerComposant, exigerRecette, libelleCourant, normaliserEtapes, normaliserGrammage, terminer, verifierDans, verifierEntierOuNul, verifierH, verifierLundi, verifierMenuDuJour, verifierSemaineModifiable } from './actions-socle.js';
import { categoriePropose, cleMemoire, lireMemoire, proposerComposants } from './analyse-menu.js';
import { datesDeLaSemaine } from './dates.js';
import { assurerJour, composantVide, estSauceAConfirmer, memoireVide, normaliser, nouvelId } from './etat.js';
import { ficheEnMemoire, nomCorrect, reprendreFiche } from './fiches-retenues.js';
import { appliquerSavoir } from './savoir.js';
import { CATEGORIE, CHARGE, ROLE, TYPE_COMPOSANT } from './statuts.js';

// ---------------------------------------------------------------- menus et composants

function creerComposant(etat, date, menu, champs) {
  const id = nouvelId('comp');
  const c = { ...composantVide(id), date, menu, nom: champs.nom, categorie: champs.categorie ?? 'a_preciser',
    attribue: champs.attribue ?? true, type: champs.type ?? 'a_preciser', valide: champs.valide ?? false };
  // Sauce issue de la lecture implicite (« à confirmer ») : on garde le NOM D'ORIGINE (« sauce à confirmer » ou « base de risotto à confirmer »)
  // pour ne conserver une sauce confirmée que si le plat reste de même nature. `true` = ancien marqueur, origine inconnue.
  if (champs.suggestion) c.suggestion = champs.suggestion; // lecture : complément inconnu proposé « à confirmer » (sauce)
  if (champs.implicite) c.implicite = typeof champs.implicite === 'string' ? champs.implicite : normaliser(champs.nom ?? '') || true;
  etat.composants[id] = c;
  return c;
}

/**
 * Régénère les composants d'un menu à partir de son intitulé, en FUSIONNANT : un composant dont le nom normalisé
 * est inchangé est conservé (réglages et productions compris) ; un composant disparu de l'intitulé est supprimé,
 * sauf s'il a une production faite ; un nom nouveau crée un composant « valide » qui reçoit le savoir de
 * l'application (appliquerSavoir). Aucune validation manuelle. Retourne les identifiants créés.
 */
/** `retires` (facultatif) reçoit { nom, taches } pour chaque composant retiré : le journal doit dire ce qui disparaît. */
function fusionnerComposants(etat, date, menu, retires = []) {
  const m = etat.jours[date].menus[menu];
  const propositions = proposerComposants(m.intitule, menu, etat.memoire, undefined, etat.mots, { noms: etat.noms, fiches: etat.fiches_retenues });
  const voulus = new Set(propositions.map((p) => normaliser(p.nom)));
  const duMenu = () => Object.values(etat.composants).filter((c) => c.date === date && c.menu === menu);
  // Une sauce issue de la lecture implicite et déjà confirmée (renommée) reste tant que l'intitulé n'écrit pas de sauce :
  // la lecture propose alors encore une sauce implicite, qui n'est pas recréée par-dessus.
  const implicitePropose = propositions.find((p) => p.implicite);
  const confirmee = (c) => Boolean(c.implicite) && c.categorie === 'sauce' && !estSauceAConfirmer(c);
  // Gardée seulement si le plat reste de même nature (la sauce d'un plat de pâtes ne devient pas la base d'un risotto).
  const memeNature = (c) => c.implicite === true || c.implicite === normaliser(implicitePropose.nom);
  const gardeeConfirmee = implicitePropose ? duMenu().find((c) => confirmee(c) && memeNature(c)) : undefined;
  for (const c of duMenu()) {
    if (voulus.has(normaliser(c.nom)) || c === gardeeConfirmee) {
      c.valide = true; // plus de validation manuelle : un composant resté non validé par l'ancien parcours l'est désormais
      continue;
    }
    const aProductionFaite = Object.values(etat.productions).some((p) => p.composantId === c.id && p.etat === 'fait');
    if (!aProductionFaite) {
      retires.push({ nom: c.nom, taches: Object.values(etat.productions).filter((p) => p.composantId === c.id).length,
        sauceConfirmee: confirmee(c) ? (propositions.some((p) => p.categorie === 'sauce' && !p.implicite) ? 'ecrite' : 'nature') : null });
      delete etat.composants[c.id];
    }
  }
  const presents = new Set(duMenu().map((c) => normaliser(c.nom)));
  const ids = [];
  for (const p of propositions) {
    const cle = normaliser(p.nom);
    if (presents.has(cle)) continue;
    if (p.implicite && gardeeConfirmee) continue;
    presents.add(cle);
    const c = creerComposant(etat, date, menu, { ...p, valide: true });
    appliquerSavoir(c);
    reprendreFiche(etat, c, true); // rôle et portion retenus pour ce nom (le rôle n'a été posé que par défaut)
    ids.push(c.id);
  }
  const saisi = m.intitule.trim() !== '';
  m.transcriptionValidee = saisi;
  return ids;
}

/**
 * Enregistre l'intitulé d'un menu (sans journal). Les composants sont régénérés par fusion si l'intitulé a changé, ou
 * s'il est saisi mais pas encore validé (donnée d'avant la section 16) ; un intitulé identique ne change rien.
 */
function enregistrerMenu(etat, date, menu, texte, retires = []) {
  const m = assurerJour(etat, date).menus[menu];
  const change = m.intitule !== texte;
  m.intitule = texte;
  if (change || (texte.trim() !== '' && !m.transcriptionValidee)) fusionnerComposants(etat, date, menu, retires);
  return m;
}

/** « , retiré : carottes (1 tâche) » : ce qu'une modification de menu a fait disparaître, pour le journal. */
function texteRetires(retires) {
  if (retires.length === 0) return '';
  const liste = retires.map((r) => `${r.nom}${r.taches > 0 ? ` (${r.taches} tâche${r.taches > 1 ? 's' : ''})` : ''}${r.sauceConfirmee === 'ecrite' ? ' (sauce confirmée, remplacée par la sauce écrite dans l\'intitulé)' : r.sauceConfirmee === 'nature' ? ' (sauce confirmée, retirée : le plat a changé de nature)' : ''}`).join(', ');
  return ` : retiré ${liste}`;
}

/**
 * Saisit l'intitulé complet d'un menu (transcription exacte). L'intitulé enregistré vaut transcription validée
 * (`transcriptionValidee` : vrai) et les composants du menu sont régénérés par fusion.
 * Un intitulé identique à l'enregistré ne change rien.
 */
export function definirMenu(etat, date, menu, intitule, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierSemaineModifiable(date, h);
  const retires = [];
  const m = enregistrerMenu(etat, date, menu, String(intitule ?? ''), retires);
  return terminer(etat, h, 'definirMenu', `${date} menu ${menu}${texteRetires(retires)}`, m);
}

/**
 * Saisie des menus d'une semaine d'un coup : `saisie = { [date]: { menu1, menu2, prevision1, prevision2 } }`, avec des
 * dates du lundi au vendredi de la semaine. Intitulé : chaîne vide ou absent = ne rien changer, null = effacer ;
 * les composants sont régénérés par fusion (comme definirMenu). Prévision : entier ≥ 0 ; null ou absent = ne rien
 * changer. Tout est vérifié avant la première modification ; une seule ligne de journal.
 * @returns {{menus:number, previsions:number}} nombre d'intitulés et de prévisions enregistrés
 */
export function saisirMenusSemaine(etat, lundi, saisie, h) {
  verifierH(h);
  verifierLundi(lundi);
  verifierSemaineModifiable(lundi, h);
  if (saisie === null || typeof saisie !== 'object' || Array.isArray(saisie)) throw new Error('Saisie de la semaine invalide.');
  const jours = datesDeLaSemaine(lundi).slice(0, 5);
  const horsSemaine = Object.keys(saisie).filter((d) => !jours.includes(d));
  if (horsSemaine.length > 0) throw new Error(`Date hors de la semaine du ${lundi} (lundi au vendredi) : ${horsSemaine.join(', ')}.`);
  for (const date of jours) {
    if (!Object.hasOwn(saisie, date)) continue;
    const j = saisie[date];
    if (j === null || typeof j !== 'object') throw new Error(`Saisie du ${date} invalide.`);
    for (const menu of [1, 2]) {
      const intitule = j[`menu${menu}`];
      if (intitule !== undefined && intitule !== null && typeof intitule !== 'string') throw new Error(`Menu ${menu} du ${date} : texte attendu.`);
      const prevision = j[`prevision${menu}`];
      if (prevision !== undefined) verifierEntierOuNul(prevision, `Prévision du menu ${menu} du ${date}`);
    }
  }
  let menus = 0;
  let previsions = 0;
  const retires = [];
  for (const date of jours) {
    if (!Object.hasOwn(saisie, date)) continue;
    for (const menu of [1, 2]) {
      const intitule = saisie[date][`menu${menu}`];
      if (typeof intitule === 'string' && intitule.trim() !== '') {
        enregistrerMenu(etat, date, menu, intitule.trim(), retires);
        menus += 1;
      } else if (intitule === null && etat.jours[date] && etat.jours[date].menus[menu].intitule !== '') {
        enregistrerMenu(etat, date, menu, '', retires);
        menus += 1;
      }
      const prevision = saisie[date][`prevision${menu}`];
      if (Number.isInteger(prevision)) {
        const jourImporte = assurerJour(etat, date);
        jourImporte.previsions[menu] = { portions: prevision, h };
        jourImporte.couverts = null; // les prévisions importées ne sont plus le total saisi dans Couverts midi
        previsions += 1;
      }
    }
  }
  return terminer(etat, h, 'saisirMenusSemaine', `${lundi} : ${menus} menu(s), ${previsions} prévision(s)${texteRetires(retires).replace(' : retiré', ' ; retiré')}`, { menus, previsions });
}

/** Ajoute un composant à la main (non validé). champs : nom, categorie, attribue, type. */
export function ajouterComposant(etat, date, menu, champs, h) {
  verifierH(h);
  verifierMenuDuJour(date, menu);
  verifierSemaineModifiable(date, h);
  if (typeof champs?.nom !== 'string' || champs.nom.trim() === '') throw new Error('Le nom du composant est obligatoire.');
  if (champs.categorie !== undefined) verifierDans(champs.categorie, CATEGORIE, 'Catégorie');
  if (champs.type !== undefined) verifierDans(champs.type, TYPE_COMPOSANT, 'Type');
  // Sans catégorie donnée, l'application la déduit du nom ; une exception mémorisée pour ce nom prime sur la règle du menu.
  const nomPropre = nomCorrect(etat.noms, champs.nom.trim()) ?? champs.nom.trim();
  const memorise = lireMemoire(etat.memoire, nomPropre, menu) ?? ficheEnMemoire(etat.fiches_retenues, nomPropre, menu);
  const memorisee = Object.hasOwn(CATEGORIE, memorise?.categorie) && memorise.categorie !== 'a_preciser' ? memorise.categorie : null;
  const categorie = champs.categorie ?? memorisee ?? categoriePropose(nomPropre);
  const attribue = typeof champs.attribue === 'boolean' ? champs.attribue
    : typeof memorise?.attribue === 'boolean' ? memorise.attribue
      : menu === 1 || categorie === 'legume' || categorie === 'feculent';
  // Plus de validation manuelle (conception, section 16) : le composant est valide d'emblée et reçoit le savoir
  // de l'application (famille, rôle, type, étapes de la base), comme un composant issu de l'intitulé.
  const c = creerComposant(etat, date, menu, { ...champs, nom: nomPropre, categorie, attribue, valide: true });
  appliquerSavoir(c);
  reprendreFiche(etat, c, true); // le rôle n'a été posé que par défaut
  assurerJour(etat, date);
  return terminer(etat, h, 'ajouterComposant', `${c.nom} (${date} menu ${menu})`, c.id);
}

const CHAMPS_COMPOSANT = ['nom', 'categorie', 'attribue', 'type', 'role', 'produitNom', 'grammage', 'etapes', 'recetteId', 'charge', 'allergenes'];

/** Mémorise par nom, sans geste supplémentaire, l'attribution et la catégorie choisies par le chef (rien d'autre). */
function memoriserAttribution(etat, c) {
  const nom = normaliser(c.nom);
  if (nom === '' || CLES_INTERDITES.has(nom)) return;
  const cle = cleMemoire(c.nom, c.menu); // par menu : un choix fait en menu 1 ne vaut pas pour le menu 2
  const m = Object.hasOwn(etat.memoire, cle) ? etat.memoire[cle] : memoireVide();
  Object.assign(m, { nom: c.nom, attribue: c.attribue, categorie: c.categorie });
  etat.memoire[cle] = m;
}

/**
 * Modifie un composant. Champs acceptés : nom, categorie, attribue, type, role, produitNom, grammage
 * ({valeur, unite, statut, source, etat}, fusionné avec l'existant), etapes (liste complète, remplace l'existante),
 * recetteId, charge, allergenes ({statut, liste}). Le champ `valide` n'est pas modifiable (un composant créé est valide d'emblée).
 * Une étape en double, un coefficient nul ou négatif sont refusés.
 * Seul un changement d'attribution (au poste ou non) ou de catégorie est mémorisé, par nom, et réappliqué à la saisie
 * suivante. Une correction de portion, de type ou d'étape reste sur ce plat : ni standard, ni base, ni autre plat.
 */
export function modifierComposant(etat, composantId, champs, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  const inconnus = Object.keys(champs ?? {}).filter((k) => !CHAMPS_COMPOSANT.includes(k));
  if (inconnus.length > 0) throw new Error(`Champ non modifiable : ${inconnus.join(', ')}.`);
  const maj = {};
  if ('nom' in champs) {
    if (typeof champs.nom !== 'string' || champs.nom.trim() === '') throw new Error('Le nom du composant est obligatoire.');
    maj.nom = champs.nom.trim();
  }
  if ('categorie' in champs) maj.categorie = verifierDans(champs.categorie, CATEGORIE, 'Catégorie');
  if ('attribue' in champs) {
    if (typeof champs.attribue !== 'boolean') throw new Error("« attribue » doit être vrai ou faux.");
    maj.attribue = champs.attribue;
  }
  if ('type' in champs) maj.type = verifierDans(champs.type, TYPE_COMPOSANT, 'Type');
  if ('role' in champs) maj.role = champs.role === null ? null : verifierDans(champs.role, ROLE, 'Rôle');
  if ('produitNom' in champs) maj.produitNom = String(champs.produitNom ?? '');
  if ('grammage' in champs) maj.grammage = normaliserGrammage(champs.grammage, c.grammage);
  if ('etapes' in champs) maj.etapes = normaliserEtapes(champs.etapes);
  if ('charge' in champs) maj.charge = champs.charge === null ? null : verifierDans(champs.charge, CHARGE, 'Charge');
  if ('recetteId' in champs) {
    if (champs.recetteId === null) { maj.recetteId = null; maj.recetteVersion = null; } else {
      maj.recetteId = champs.recetteId;
      maj.recetteVersion = exigerRecette(etat, champs.recetteId).version;
    }
  }
  if ('allergenes' in champs) {
    const a = { ...c.allergenes, ...champs.allergenes };
    if (!['a_confirmer', 'valide'].includes(a.statut)) throw new Error("Statut d'allergènes inconnu.");
    if (!Array.isArray(a.liste)) throw new Error("La liste d'allergènes est invalide.");
    maj.allergenes = { statut: a.statut, liste: [...a.liste], h: a.statut === 'valide' ? h : null };
  }
  const attributionChangee = ('attribue' in maj && maj.attribue !== c.attribue)
    || ('categorie' in maj && maj.categorie !== c.categorie);
  const sauceChoisie = 'nom' in maj && estSauceAConfirmer(c); // la propriétaire nomme la sauce implicite : c'est une confirmation
  Object.assign(c, maj);
  // Un composant renommé (sauce choisie…) : ses productions portent le nom courant, jamais l'ancien.
  for (const p of Object.values(etat.productions)) {
    if (p.composantId === c.id && (p.genre === 'principale' || p.genre === 'complement')) p.libelle = libelleCourant(etat, p);
  }
  if (attributionChangee) memoriserAttribution(etat, c);
  if ((attributionChangee || 'role' in maj || sauceChoisie) && !estSauceAConfirmer(c)) retenirReglage(etat, c, h);
  return terminer(etat, h, 'modifierComposant', `${c.nom} : ${Object.keys(maj).join(', ')}`, c);
}

/**
 * La propriétaire classe un composant « à préciser » : au poste ou hors poste. Le choix est toujours mémorisé par nom
 * (même quand il confirme l'attribution actuelle), ce qui retire le point « à classer ».
 */
export function confirmerAttribution(etat, composantId, attribue, h) {
  modifierComposant(etat, composantId, { attribue }, h);
  memoriserAttribution(etat, exigerComposant(etat, composantId));
  return etat.composants[composantId];
}

/** Supprime un composant et ses productions non faites (les productions faites sont conservées). */
export function supprimerComposant(etat, composantId, h) {
  verifierH(h);
  const c = exigerComposant(etat, composantId);
  verifierSemaineModifiable(c.date, h);
  delete etat.composants[composantId];
  return terminer(etat, h, 'supprimerComposant', c.nom, true);
}
