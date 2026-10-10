// Rapport de diagnostic : texte lisible à transmettre. PUR. Types d'événements, nombres, libellés de boutons (qui peuvent
// nommer un plat), messages techniques bornés et, depuis l'accord du 2026-10-07, le texte rendu par l'IA : jamais la clé.

import { lundiDe } from './dates.js';
import { etatNote, texteNotes } from './notes-dev.js';

export const MAX_TEXTE = 200;
export const MAX_LIBELLE = 40;
const MAX_EVENEMENTS_RAPPORT = 150;
const MAX_ERREURS_RAPPORT = 30;
const MAX_ACTIONS = 20;
const MAX_EVENEMENTS_DEPUIS_ENVOI = 60;
const MAX_AGENT = 120;
const MOTIF_CLE = /sk-ant-[A-Za-z0-9_-]*/g;
export const MAX_CONTENU = 2000;
// Règle assouplie par la propriétaire le 2026-10-07 : le contenu lu par l'IA et des photos peuvent figurer, jamais la clé.
const PHRASE_CONFIDENTIALITE = 'Ce fichier ne contient jamais votre clé. Il contient le texte lu par l\'IA, les retours d\'essai et des photos de feuilles ou de fiches '
  + '(noms et allergies possibles). Rien n\'est envoyé automatiquement.';

/** Texte borné, motifs de clé masqués. Une valeur qui n'est ni texte, ni nombre fini, ni booléen est refusée (undefined). */
export function nettoyer(valeur, max = MAX_TEXTE) {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : undefined;
  if (typeof valeur === 'boolean') return valeur;
  if (typeof valeur !== 'string') return undefined;
  const propre = valeur.replace(MOTIF_CLE, '[clé masquée]').replace(/\s+/g, ' ').trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
}

const heureCourte = (h) => (typeof h === 'string' ? h.slice(0, 19).replace('T', ' ') : '?');

/** Nombres seulement, plus le nom et l'heure des dernières actions du journal d'état (jamais leur détail). */
export function resumeEtat(etat) {
  const jours = Object.values(etat?.jours ?? {});
  const avecMenu = jours.filter((j) => [1, 2].some((m) => String(j?.menus?.[m]?.intitule ?? '').trim() !== ''));
  const composants = Object.values(etat?.composants ?? {});
  return {
    semainesAvecMenus: new Set(avecMenu.filter((j) => typeof j.date === 'string').map((j) => lundiDe(j.date))).size,
    joursAvecMenu: avecMenu.length,
    composants: composants.length,
    composantsAPreciser: composants.filter((c) => c?.categorie === 'a_preciser').length,
    fichesActives: Object.values(etat?.fiches ?? {}).filter((f) => f?.statut === 'active').length,
    motsRetenus: Object.keys(etat?.memoire ?? {}).length,
    dernieresActions: (Array.isArray(etat?.journal) ? etat.journal : []).slice(-MAX_ACTIONS).reverse()
      .map((l) => ({ h: nettoyer(String(l?.h ?? ''), 30), action: nettoyer(String(l?.action ?? ''), MAX_LIBELLE) })),
  };
}

const details = (e) => Object.entries(e)
  .filter(([cle]) => cle !== 'h' && cle !== 'type' && cle !== 'contenu')
  .map(([cle, v]) => [cle.replace(/[^A-Za-z0-9_]/g, '').slice(0, 30), nettoyer(v)])
  .filter(([cle, v]) => cle && v !== undefined)
  .map(([cle, v]) => `${cle}=${v}`).join(' ');

const ligne = (e) => `${heureCourte(e.h)} · ${nettoyer(String(e.type), 30)} · ${details(e)}`;

function synthese(evenements) {
  const erreurs = evenements.filter((e) => e.type === 'erreur');
  const ia = evenements.filter((e) => e.type === 'ia');
  const reussis = ia.filter((e) => e.ok === true);
  const echoues = ia.filter((e) => e.ok !== true);
  const statuts = (liste) => [...new Set(liste.map((e) => nettoyer(e.statut, 20)))].join(', ') || '-';
  const derniere = erreurs[erreurs.length - 1];
  return [
    `Erreurs : ${erreurs.length}`,
    `Appels IA réussis : ${reussis.length} (statuts : ${statuts(reussis)})`,
    `Appels IA échoués : ${echoues.length} (statuts : ${statuts(echoues)})`,
    `Dernière erreur : ${derniere ? `${heureCourte(derniere.h)} · ${nettoyer(derniere.message ?? '', MAX_TEXTE)}` : 'aucune'}`,
  ];
}

/** Ce que l'IA a rendu pour chaque appel (clé masquée, borné) : c'est ce qui permet de voir pourquoi une lecture est fausse. */
function contenusIA(recents) {
  const lignes = recents.filter((e) => e.type === 'ia' && typeof e.contenu === 'string' && e.contenu !== '').slice(0, 10)
    .map((e) => `${heureCourte(e.h)} · ${nettoyer(String(e.outil ?? '?'), 30)} · ${nettoyer(e.contenu, MAX_CONTENU)}`);
  return lignes.length ? lignes : ['aucun'];
}

const apresRepere = (repere, h) => !repere?.h || String(h ?? '') > repere.h;

/** Les navigations consécutives vers la même route ne font qu'une ligne « ×N » (du plus récent au plus ancien). */
function regrouperNavigations(recents) {
  const sortie = [];
  let precedent = null;
  for (const e of recents) {
    const cle = e.type === 'navigation' ? `nav|${e.route}` : null;
    if (cle && cle === precedent) { sortie[sortie.length - 1].n += 1; continue; }
    sortie.push({ e, n: 1 });
    precedent = cle;
  }
  return sortie.map(({ e, n }) => (n > 1 ? `${ligne(e)} ×${n}` : ligne(e)));
}

export const clePhoto = (p) => `diag|${p.h}|${p.type}`;

/** Ce qui n'a pas encore été envoyé, selon le repère (null = premier envoi : tout). Les notes : seules les nouvelles partent ; les transmises et réglées sont comptées. */
export function nouveautes({ evenements = [], notes = [], retours = [], photos = [] }, repere) {
  const envoyees = new Set(repere?.notesEnvoyees ?? []);
  const photosVues = new Set(repere?.photosEnvoyees ?? []);
  const valides = notes.filter((n) => n && typeof n === 'object');
  const parEtat = (etat) => valides.filter((n) => etatNote(n, envoyees) === etat);
  return {
    evenements: evenements.filter((e) => e && apresRepere(repere, e.h)),
    retours: retours.filter((r) => r && apresRepere(repere, r.h)),
    photos: photos.filter((p) => !photosVues.has(clePhoto(p))),
    notes: parEtat('nouvelle'),
    notesTransmises: parEtat('transmise'),
    notesReglees: parEtat('reglee'),
  };
}

/** Bloc des notes à envoyer : les nouvelles en détail, puis les comptes des transmises (non répétées) et des réglées. Jamais le texte d'une note déjà transmise. */
export function notesPourEnvoi({ notes, notesTransmises = [], notesReglees = [] }, meta) {
  return [
    texteNotes(notes, meta),
    notesTransmises.length > 0 ? `${notesTransmises.length} notes déjà transmises : non répétées.` : '',
    notesReglees.length > 0 ? `${notesReglees.length} notes réglées.` : '',
  ].filter(Boolean).join('\n');
}

/** `evenements` dans l'ordre chronologique (le plus ancien d'abord). `aujourdhui` : date ISO fournie par l'appelant. */
export function texteDiagnostic({ environnement = {}, resume = {}, evenements = [], aujourdhui = '', photosJointes = 0, photosEnMemoire = 0,
  motifPhotos = 'partage de fichiers multiples indisponible', retoursTexte = '', notesTexte = '', repere = null, notesNouvelles = 0 }) {
  const liste = evenements.filter((e) => e && typeof e === 'object' && apresRepere(repere, e.h));
  const recents = [...liste].reverse();
  const actions = (resume.dernieresActions ?? []).map((a) => `  ${heureCourte(a.h)} · ${a.action}`);
  const lignesEvenements = regrouperNavigations(recents).slice(0, repere?.h ? MAX_EVENEMENTS_DEPUIS_ENVOI : MAX_EVENEMENTS_RAPPORT);
  return [
    'Diagnostic Sanji',
    PHRASE_CONFIDENTIALITE,
    ...(repere?.h ? [`Depuis le dernier envoi (${heureCourte(repere.h)}) : ${liste.length} événements, ${notesNouvelles} notes nouvelles`] : []),
    '',
    'ENVIRONNEMENT',
    `Version : ${nettoyer(String(environnement.version ?? '?'), 30)}`,
    `Date : ${nettoyer(String(aujourdhui), 40)}`,
    `Application installée (standalone) : ${environnement.standalone === true ? 'oui' : 'non'}`,
    `En ligne : ${environnement.enLigne === false ? 'non' : 'oui'}`,
    `Agent utilisateur : ${nettoyer(String(environnement.agent ?? '?'), MAX_AGENT)}`,
    `Stockage persistant : ${environnement.persistant === true ? 'oui' : environnement.persistant === false ? 'non' : 'inconnu'}`,
    `Photos jointes : ${Number(photosJointes) || 0} (les 5 dernières, gardées 14 jours sur l'appareil)`
      + (photosEnMemoire > photosJointes ? ` ; ${photosEnMemoire - photosJointes} photo(s) gardées non jointes (${nettoyer(String(motifPhotos), 120)})` : ''),
    '',
    'ÉTAT (nombres seulement)',
    `Semaines avec menus : ${resume.semainesAvecMenus ?? 0}`,
    `Jours avec menu : ${resume.joursAvecMenu ?? 0}`,
    `Composants : ${resume.composants ?? 0} (à préciser : ${resume.composantsAPreciser ?? 0})`,
    `Fiches actives : ${resume.fichesActives ?? 0}`,
    `Mots retenus : ${resume.motsRetenus ?? 0}`,
    ...(repere?.h ? [] : ['Dernières actions :', ...(actions.length ? actions : ['  aucune'])]),
    '',
    'SYNTHÈSE',
    ...synthese(liste),
    '',
    'ERREURS',
    ...(recents.filter((e) => e.type === 'erreur').slice(0, MAX_ERREURS_RAPPORT).map(ligne)),
    ...(liste.some((e) => e.type === 'erreur') ? [] : ['aucune']),
    '',
    'CONTENU LU PAR L\'IA (du plus récent au plus ancien)',
    ...contenusIA(recents),
    '',
    ...(retoursTexte ? ['RETOURS D\'ESSAI (ce que l\'IA a lu, ce que vous avez enregistré)', retoursTexte, ''] : []),
    ...(notesTexte ? [notesTexte, ''] : []),
    `ÉVÉNEMENTS (du plus récent au plus ancien, ${lignesEvenements.length} lignes pour ${liste.length} événements)`,
    ...lignesEvenements,
    '',
  ].join('\n');
}
