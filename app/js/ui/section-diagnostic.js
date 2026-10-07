// Réglages > Apprentissage et essais : journal de diagnostic local. Rien n'est envoyé : la propriétaire partage ou copie le fichier.

import { resumeEtat, texteDiagnostic } from '../domaine/rapport-diagnostic.js';
import { redessiner, statutStockage } from '../magasin.js';
import { VERSION_APP } from '../version.js';
import { h } from './dom.js';
import { bouton } from './elements.js';
import { pluriel } from './format.js';
import { effacerJournal, lireEvenements, photosGardees } from './journal-diagnostic.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';

const AIDE = 'Rien n\'est envoyé : vous partagez ou copiez le fichier vous-même. Il ne contient jamais votre clé. Il peut contenir le texte lu par l\'IA et '
  + 'des photos de feuilles ou de fiches (donc des noms et des allergies) : relisez avant de le transmettre. Journal effacé après 14 jours ; photos gardées en mémoire jusqu\'à la fermeture de l\'application.';

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

function texte(etat, photosJointes = 0, motifPhotos = undefined) {
  return texteDiagnostic({ environnement: environnement(), resume: resumeEtat(etat), evenements: lireEvenements(), aujourdhui: maintenant(),
    photosJointes, photosEnMemoire: photosGardees().length, motifPhotos });
}

const nomFichier = () => `sanji-diagnostic-${maintenant().slice(0, 10)}.txt`;

function telecharger(contenu) {
  const adresse = URL.createObjectURL(new Blob([contenu], { type: 'text/plain' }));
  h('a', { href: adresse, download: nomFichier() }).click();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}

/** Partage le texte et, si l'appareil accepte plusieurs fichiers, les photos gardées en mémoire ; sinon le texte seul, qui le dit. */
async function partager(etat) {
  const nav = globalThis.navigator;
  const photos = photosGardees().map((p, i) => new File([p.blob], `photo-${p.type}-${i + 1}.jpg`, { type: 'image/jpeg' }));
  const peut = (fichiers) => typeof nav?.share === 'function' && nav.canShare?.({ files: fichiers });
  try {
    if (photos.length > 0) {
      const avecPhotos = new File([texte(etat, photos.length)], nomFichier(), { type: 'text/plain' });
      if (peut([avecPhotos, ...photos])) { await nav.share({ files: [avecPhotos, ...photos], title: 'Diagnostic Sanji' }); return; }
    }
    const seul = texte(etat, 0);
    if (peut([new File([seul], nomFichier(), { type: 'text/plain' })])) await nav.share({ files: [new File([seul], nomFichier(), { type: 'text/plain' })], title: 'Diagnostic Sanji' });
    else telecharger(seul);
  } catch { /* partage annulé */ }
}

async function copier(contenu, zone) {
  try {
    await globalThis.navigator.clipboard.writeText(contenu);
    afficherMessage('Diagnostic copié. Collez-le dans la conversation.', 'ok');
  } catch {
    const champ = h('textarea', { classe: 'retour-essai-texte', rows: 10, readonly: true, 'aria-label': 'Diagnostic à copier' });
    champ.value = contenu;
    zone.replaceChildren(h('p', { classe: 'aide' }, 'Copie automatique indisponible : sélectionnez tout le texte ci-dessous, puis copiez-le.'), champ);
  }
}

export function sectionDiagnostic(etat) {
  const evenements = lireEvenements();
  const zone = h('div', { 'aria-live': 'polite' });
  return h('section', { classe: 'carte' },
    h('h2', { classe: 'section-titre' }, 'Journal de diagnostic'),
    h('p', { classe: 'aide' }, AIDE),
    h('p', null, `${pluriel(evenements.length, 'événement noté', 'événements notés')} · ${pluriel(nombreErreurs(), 'erreur', 'erreurs')}`),
    h('div', { classe: 'actions' },
      bouton('Partager le fichier', () => partager(etat), 'court'),
      bouton('Copier le diagnostic', () => copier(texte(etat, 0, 'copie de texte : utilisez « Partager le fichier » pour les joindre'), zone), 'court'),
      bouton('Effacer le journal', () => confirmer({
        titre: 'Effacer le journal de diagnostic ?', texte: 'Le journal gardé sur cet appareil sera supprimé. Vos menus ne changent pas.', libelleOk: 'Effacer', danger: true,
        action: () => { effacerJournal(); redessiner(); },
      }), 'court', { disabled: evenements.length === 0 })),
    zone);
}
