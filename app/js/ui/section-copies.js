// Réglages > Données : « Copies automatiques ». Une copie par jour (7 gardées sur l'appareil) ; un toucher ouvre la
// confirmation de restauration, comme celle d'un fichier. La liste se remplit après la lecture d'IndexedDB.

import { exporter, importer } from '../domaine/etat.js';
import { aujourdhui, etat, maintenant, remplacer } from '../magasin.js';
import { garderAvantRestauration, listerCopies, lireAvantRestauration, lireCopie } from '../sauvegarde-auto.js';
import { h } from './dom.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';
import { libelleJour } from '../domaine/dates.js';

const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Confirme puis restaure `texte` ; l'état actuel est d'abord gardé dans « avant-restauration » (échec = rien n'est remplacé). */
async function proposerRestauration(texte, libelle, nom) {
  let nouvelEtat;
  try {
    nouvelEtat = importer(texte, aujourdhui());
  } catch (erreur) {
    afficherMessage(`${majuscule(libelle)} inutilisable : ${erreur.message}`, 'erreur');
    return;
  }
  confirmer({
    titre: 'Remplacer toutes les données ?',
    texte: `Les données de cet appareil seront remplacées par ${libelle}. L'état actuel sera gardé dans « État avant la dernière restauration ».`,
    libelleOk: `Remplacer mes données par ${libelle}`, danger: true,
    action: async () => {
      try {
        await garderAvantRestauration(exporter(etat(), maintenant()));
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
        return;
      }
      remplacer(nouvelEtat, nom);
      afficherMessage('Données restaurées.', 'ok');
    },
  });
}

async function restaurerCopie(date) {
  try {
    await proposerRestauration(await lireCopie(date), `la copie du ${date}`, `copie du ${date}`);
  } catch (erreur) {
    afficherMessage(`Copie du ${date} inutilisable : ${erreur.message}`, 'erreur');
  }
}

async function restaurerAvant() {
  const texte = await lireAvantRestauration();
  if (texte === null) { afficherMessage('Aucun état gardé avant une restauration.', 'erreur'); return; }
  await proposerRestauration(texte, "l'état d'avant la dernière restauration", 'état avant la dernière restauration');
}

const ligne = (titre, meta, onClick) => h('li', null, h('button', { type: 'button', classe: 'reglage-rubrique', onClick },
  h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, titre), h('span', { classe: 'meta' }, meta)),
  h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›')));

export function sectionCopies() {
  const liste = h('ul', { classe: 'liste' });
  const info = h('p', { classe: 'aide' }, 'Lecture des copies…');
  Promise.all([listerCopies(), lireAvantRestauration()]).then(([dates, avant]) => {
    info.textContent = dates.length === 0
      ? 'Aucune copie pour l\'instant : la première est faite à l\'ouverture si des données existent, sinon au premier enregistrement.'
      : 'Une copie par jour, les 7 dernières, gardées sur cet appareil (sans les photos).';
    for (const date of dates) liste.appendChild(ligne(majuscule(libelleJour(date)), date, () => restaurerCopie(date)));
    if (avant !== null) liste.appendChild(ligne('État avant la dernière restauration', 'gardé avant le dernier remplacement', restaurerAvant));
  }).catch(() => { info.textContent = 'Les copies ne sont pas lisibles sur cet appareil.'; });
  return h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, 'Copies automatiques'), info, liste);
}
