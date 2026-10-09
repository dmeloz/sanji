// Réglages > Apprentissage et essais : journal de diagnostic local. Rien n'est envoyé : la propriétaire partage le fichier.

import { clePhoto, notesPourEnvoi, nouveautes, resumeEtat, texteDiagnostic } from '../domaine/rapport-diagnostic.js';
import { texteRapport } from '../domaine/retour-essai.js';
import { redessiner, statutStockage } from '../magasin.js';
import { VERSION_APP } from '../version.js';
import { h } from './dom.js';
import { bouton, pastille } from './elements.js';
import { pluriel } from './format.js';
import { effacerJournal, lireEvenements, photosGardees } from './journal-diagnostic.js';
import { lireNotes } from './notes-dev.js';
import { lireRetours } from './retours-essai.js';
import { lireRepere, marquerEnvoi } from './dernier-envoi.js';
import { confirmer } from './panneau.js';

const AIDE = 'Un seul geste : « Partager le fichier » envoie ce qui est nouveau depuis le dernier envoi (journal, texte lu par l\'IA, retours d\'essai, notes de test, photos). Rien n\'est envoyé automatiquement. '
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

/** Tout ce qui est lu à un instant : le journal, les notes, les retours et les photos, filtrés selon le repère du dernier envoi. */
async function preparer() {
  const repere = lireRepere();
  const photos = await photosGardees();
  return { repere, photos, nv: nouveautes({ evenements: lireEvenements(), notes: lireNotes(), retours: lireRetours(), photos }, repere) };
}

function texte(etat, { repere, nv }, date, photosJointes = 0, motifPhotos = undefined, photosGardeesN = 0) {
  const meta = { version: VERSION_APP, date };
  return texteDiagnostic({ environnement: environnement(), resume: resumeEtat(etat), evenements: nv.evenements, aujourdhui: date,
    photosJointes, photosEnMemoire: photosGardeesN, motifPhotos, repere, notesNouvelles: nv.notes.length,
    retoursTexte: nv.retours.length > 0 ? texteRapport(nv.retours, meta) : '',
    notesTexte: notesPourEnvoi(nv, meta) });
}

const nomFichier = () => `sanji-diagnostic-${maintenant().slice(0, 10)}.txt`;

function telecharger(contenu) {
  const adresse = URL.createObjectURL(new Blob([contenu], { type: 'text/plain' }));
  h('a', { href: adresse, download: nomFichier() }).click();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}

const DUREE_CONFIRMATION_MS = 4000;

/**
 * Partage ce qui est nouveau depuis le dernier envoi (texte, plus les photos nouvelles si l'appareil accepte plusieurs fichiers).
 * Le repère n'avance qu'après un vrai partage réussi ; un partage annulé ou un simple téléchargement de repli ne marque rien.
 * @returns {Promise<'envoye'|'telecharge'|false>}
 */
async function partager(etat) {
  const nav = globalThis.navigator;
  const date = maintenant();
  const lot = await preparer();
  const { photos: gardees } = lot.nv;
  const photos = gardees.map((p, i) => new File([p.blob], `photo-${p.type}-${i + 1}.jpg`, { type: 'image/jpeg' }));
  const peut = (fichiers) => typeof nav?.share === 'function' && nav.canShare?.({ files: fichiers });
  // Les notes marquées sont celles du fichier (pas celles créées pendant la feuille de partage).
  const marquer = (photosJointes) => marquerEnvoi({ h: date, notes: lot.nv.notes.map((n) => n.id), photos: photosJointes.map(clePhoto) });
  try {
    if (photos.length > 0) {
      const avecPhotos = new File([texte(etat, lot, date, photos.length, undefined, gardees.length)], nomFichier(), { type: 'text/plain' });
      if (peut([avecPhotos, ...photos])) { await nav.share({ files: [avecPhotos, ...photos], title: 'Diagnostic Sanji' }); marquer(gardees); return 'envoye'; }
    }
    const seul = texte(etat, lot, date, 0, undefined, gardees.length);
    const fichier = new File([seul], nomFichier(), { type: 'text/plain' });
    if (!peut([fichier])) { telecharger(seul); return 'telecharge'; } // rien n'est parti : le repère n'avance pas
    await nav.share({ files: [fichier], title: 'Diagnostic Sanji' });
    marquer([]);
    return 'envoye';
  } catch { return false; /* partage annulé : rien n'est marqué */ }
}

/** Phrase « Prochain envoi : N événements et M notes nouvelles. » */
const prochainEnvoi = () => {
  const nv = nouveautes({ evenements: lireEvenements(), notes: lireNotes(), retours: [], photos: [] }, lireRepere());
  return `Prochain envoi : ${pluriel(nv.evenements.length, 'événement', 'événements')} et ${pluriel(nv.notes.length, 'note nouvelle', 'notes nouvelles')}.`;
};

/**
 * Le bouton d'envoi (« Partager le fichier », seul), la ligne « Prochain envoi » et une zone d'état DANS la feuille :
 * le message global est caché derrière une feuille ouverte, donc « Envoyé ✓ » s'affiche ici (effacé après quelques secondes).
 */
export function boutonsEnvoi(etat) {
  const statut = h('div', { role: 'status', classe: 'envoi-statut' });
  const info = h('p', { classe: 'aide' }, prochainEnvoi());
  let minuteur = null;
  const effacer = () => { clearTimeout(minuteur); statut.replaceChildren(); };
  const surPartager = async () => {
    effacer();
    const issue = await partager(etat);
    if (!issue) return;
    info.textContent = prochainEnvoi();
    statut.replaceChildren(pastille(issue === 'envoye' ? 'Envoyé ✓' : 'Fichier téléchargé', 'vert'));
    minuteur = setTimeout(effacer, DUREE_CONFIRMATION_MS);
  };
  return h('div', null, h('div', { classe: 'actions' }, bouton('Partager le fichier', surPartager, 'court principal')), info, statut);
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
