// Lire une fiche de fonction avec l'IA, mode essai (décision du 2026-10-07). La photo n'est jamais stockée : réduite en
// mémoire, envoyée après aperçu et avertissement, puis oubliée. La réponse ne fait que préremplir le formulaire de fiche.

import { lireChampsFiche } from '../harness/lecture-fiche-ia.js';
import { assistantPret, fournisseurDepuisReglages } from './assistant-reglages.js';
import { h } from './dom.js';
import { dialogFiche } from './fiches.js';
import { garderPhotoPourDiagnostic } from './journal-diagnostic.js';
import { noterRetour } from './retours-essai.js';
import { panneau } from './panneau.js';
import { blobEnBase64, reduireImage } from './photo.js';

const AVERTISSEMENT = 'Cette fiche peut contenir des noms et des allergies ; elle part à l\'IA. Le choix du menu et la répartition ne sont jamais proposés. La photo et le texte rendu par l\'IA sont gardés 14 jours sur l\'appareil pour le diagnostic.';

function dialogLectureFiche(date, miniature, image, blob) {
  const attente = new AbortController();
  const envoi = panneau({
    titre: 'Lire une fiche (essai)',
    corps: [h('img', { classe: 'photo-grande photo-apercu', src: miniature, alt: 'Photo de la fiche qui sera envoyée' }),
      h('p', { classe: 'alerte-texte' }, AVERTISSEMENT)],
    libelleEnregistrer: 'Envoyer',
    // Une erreur est levée : le panneau reste ouvert avec le message, « Envoyer » permet de réessayer.
    surEnregistrer: async () => {
      const fournisseur = fournisseurDepuisReglages();
      if (!fournisseur.disponible() || typeof fournisseur.demanderLectureFiche !== 'function') {
        throw new Error('L\'assistant IA n\'est pas activé : rien n\'est envoyé.');
      }
      envoi.addEventListener('close', () => attente.abort());
      garderPhotoPourDiagnostic('fiche', blob); // en mémoire seulement (jamais stockée), pour le fichier de diagnostic
      let lecture;
      try {
        lecture = lireChampsFiche(await fournisseur.demanderLectureFiche(image, { signal: attente.signal }));
      } catch (e) {
        if (!envoi.open) return; // annulé pendant l'attente : rien à dire
        throw new Error(`L'IA n'a pas répondu : ${e?.message ?? e}`);
      }
      if (!envoi.open) return; // fermé pendant l'attente : la réponse est ignorée
      if (!lecture) throw new Error('Réponse de l\'IA inexploitable : rien n\'est modifié.');
      // Retour d'essai (décision du 2026-10-07) : ce que l'IA a lu et ce que la propriétaire enregistre, notés sur l'appareil seulement.
      const doutes = lecture.illisibles + lecture.ecartes.length;
      dialogFiche(null, date, lecture.champs, { doutes, surEnregistre: (enregistre) => noterRetour({ type: 'fiche', lu: lecture.champs, final: enregistre }) });
    },
  });
  envoi.addEventListener('close', () => URL.revokeObjectURL(miniature));
}

/** Bouton « Lire une fiche avec l'IA (essai) », absent sans assistant prêt. `date` = jour affiché. */
export function boutonLireFiche(date) {
  if (!assistantPret()) return null;
  let ouverture = false;
  const entree = h('input', {
    type: 'file', accept: 'image/*', capture: 'environment', classe: 'cache',
    onChange: async (evenement) => {
      const fichier = evenement.target.files?.[0];
      evenement.target.value = '';
      if (!fichier || ouverture) return; // un seul aperçu à la fois
      ouverture = true;
      try {
        const blob = await reduireImage(fichier);
        dialogLectureFiche(date, URL.createObjectURL(blob), await blobEnBase64(blob), blob);
      } catch (erreur) {
        panneau({ titre: 'Lire une fiche (essai)', lectureSeule: true, corps: [h('p', { classe: 'alerte-texte' }, erreur.message)] });
      } finally { ouverture = false; }
    },
  });
  return h('label', { classe: 'btn btn-court' }, 'Lire une fiche avec l\'IA (essai)', entree);
}
