// Réglages > Apprentissage et essais : journal de diagnostic local. Rien n'est envoyé : la propriétaire partage ou copie le fichier.

import { resumeEtat, texteDiagnostic } from '../domaine/rapport-diagnostic.js';
import { texteNotes } from '../domaine/notes-dev.js';
import { texteRapport } from '../domaine/retour-essai.js';
import { redessiner, statutStockage } from '../magasin.js';
import { VERSION_APP } from '../version.js';
import { h } from './dom.js';
import { bouton, pastille } from './elements.js';
import { pluriel } from './format.js';
import { effacerJournal, lireEvenements, photosGardees } from './journal-diagnostic.js';
import { lireNotes } from './notes-dev.js';
import { lireRetours } from './retours-essai.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';

const AIDE = 'Un seul geste : « Partager le fichier » envoie tout (journal, texte lu par l\'IA, retours d\'essai, notes de test, photos). Rien n\'est envoyé automatiquement. '
  + 'Le journal et les photos (les 5 dernières) sont gardés 14 jours sur l\'appareil.';

const nombreErreurs = () => lireEvenements().filter((e) => e.type === 'erreur').length;

/** Indicateur discret en tête de rubrique ; null sans erreur. */
export function indicateurErreurs() {
  const n = nombreErreurs();
  return n === 0 ? null : h('p', { classe: 'diagnostic-indicateur' }, `${pluriel(n, 'erreur', 'erreurs')} à me transmettre`);
}

function environnement() {
  const nav = globalThis.navigator;
  let standalone = false;
  try { standalone = globalThis.matchMedia?.('(display-mode: standalone)')?.matches === true || nav?.standalone === true; } catch { /* inconnu */ }
  return { version: VERSION_APP, standalone, enLigne: nav?.onLine !== false, agent: nav?.userAgent ?? '?', persistant: statutStockage().persistant };
}

const maintenant = () => new Date().toISOString();

function texte(etat, photosJointes = 0, motifPhotos = undefined, photosGardeesN = 0) {
  const retours = lireRetours();
  const date = maintenant();
  return texteDiagnostic({ environnement: environnement(), resume: resumeEtat(etat), evenements: lireEvenements(), aujourdhui: date,
    photosJointes, photosEnMemoire: photosGardeesN, motifPhotos,
    retoursTexte: retours.length > 0 ? texteRapport(retours, { version: VERSION_APP, date }) : '',
    notesTexte: texteNotes(lireNotes(), { version: VERSION_APP, date }) });
}

const nomFichier = () => `sanji-diagnostic-${maintenant().slice(0, 10)}.txt`;

function telecharger(contenu) {
  const adresse = URL.createObjectURL(new Blob([contenu], { type: 'text/plain' }));
  h('a', { href: adresse, download: nomFichier() }).click();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}

/** Délai pendant lequel un second toucher sur « Copier » est ignoré, et durée d'affichage de « Copié ✓ ». */
const DELAI_DOUBLE_TOUCHER_MS = 1000;
const DUREE_CONFIRMATION_MS = 4000;

/** Partage le texte et, si l'appareil accepte plusieurs fichiers, les photos gardées ; sinon le texte seul, qui le dit. Vrai si c'est fait. */
async function partager(etat) {
  const nav = globalThis.navigator;
  const gardees = await photosGardees();
  const photos = gardees.map((p, i) => new File([p.blob], `photo-${p.type}-${i + 1}.jpg`, { type: 'image/jpeg' }));
  const peut = (fichiers) => typeof nav?.share === 'function' && nav.canShare?.({ files: fichiers });
  try {
    if (photos.length > 0) {
      const avecPhotos = new File([texte(etat, photos.length, undefined, gardees.length)], nomFichier(), { type: 'text/plain' });
      if (peut([avecPhotos, ...photos])) { await nav.share({ files: [avecPhotos, ...photos], title: 'Diagnostic Sanji' }); return true; }
    }
    const seul = texte(etat, 0, undefined, gardees.length);
    if (peut([new File([seul], nomFichier(), { type: 'text/plain' })])) await nav.share({ files: [new File([seul], nomFichier(), { type: 'text/plain' })], title: 'Diagnostic Sanji' });
    else telecharger(seul);
    return true;
  } catch { return false; /* partage annulé */ }
}

/** Vrai si le texte est dans le presse-papiers (sinon la zone montre le texte à copier à la main). */
async function copier(etat, zone) {
  const contenu = texte(etat, 0, 'copie de texte : utilisez « Partager le fichier » pour les joindre', (await photosGardees()).length);
  try {
    await globalThis.navigator.clipboard.writeText(contenu);
    afficherMessage('Diagnostic copié. Collez-le dans la conversation.', 'ok');
    return true;
  } catch {
    const champ = h('textarea', { classe: 'retour-essai-texte', rows: 10, readonly: true, 'aria-label': 'Diagnostic à copier' });
    champ.value = contenu;
    zone.replaceChildren(h('p', { classe: 'aide' }, 'Copie automatique indisponible : sélectionnez tout le texte ci-dessous, puis copiez-le.'), champ);
    return false;
  }
}

/**
 * Les deux boutons d'envoi (partager = principal, copier = secondaire), la zone de repli de la copie et une zone d'état
 * DANS la feuille : le message global est caché derrière une feuille ouverte, donc « Copié ✓ » s'affiche ici (effacé après
 * quelques secondes ou à la prochaine action). Un second toucher sur « Copier » dans la seconde qui suit est ignoré.
 */
export function boutonsEnvoi(etat) {
  const zone = h('div', { 'aria-live': 'polite' });
  const statut = h('div', { role: 'status', classe: 'envoi-statut' });
  let minuteur = null;
  let dernierToucher = Number.NEGATIVE_INFINITY;
  const effacer = () => { clearTimeout(minuteur); statut.replaceChildren(); };
  const confirmer = () => {
    statut.replaceChildren(pastille('Copié ✓', 'vert'));
    minuteur = setTimeout(effacer, DUREE_CONFIRMATION_MS);
  };
  const surPartager = async () => { effacer(); if (await partager(etat)) confirmer(); };
  const surCopier = async () => {
    const maintenantMs = Date.now();
    if (maintenantMs - dernierToucher < DELAI_DOUBLE_TOUCHER_MS) return;
    dernierToucher = maintenantMs;
    effacer();
    if (await copier(etat, zone)) confirmer();
  };
  return h('div', null,
    h('div', { classe: 'actions' },
      bouton('Partager le fichier', surPartager, 'court principal'),
      bouton('Copier le diagnostic', surCopier, 'court')),
    statut, zone);
}

export function sectionDiagnostic(etat) {
  const evenements = lireEvenements();
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Journal de diagnostic'),
    h('p', { classe: 'aide' }, AIDE),
    h('p', null, `${pluriel(evenements.length, 'événement noté', 'événements notés')} · ${pluriel(nombreErreurs(), 'erreur', 'erreurs')}`),
    boutonsEnvoi(etat),
    h('div', { classe: 'actions' },
      bouton('Effacer le journal', () => confirmer({
        titre: 'Effacer le journal de diagnostic ?', texte: 'Le journal gardé sur cet appareil sera supprimé. Vos menus ne changent pas.', libelleOk: 'Effacer', danger: true,
        action: () => { effacerJournal(); redessiner(); },
      }), 'court', { disabled: evenements.length === 0 })));
}
