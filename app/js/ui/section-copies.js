// Réglages > Données : « Copies automatiques ». Une copie par jour (7 gardées sur l'appareil) ; un toucher ouvre la
// confirmation de restauration, comme celle d'un fichier. La liste se remplit après la lecture d'IndexedDB.

import { exporter, importer } from '../domaine/etat.js';
import { aujourdhui, etat, maintenant, redessiner, remplacer } from '../magasin.js';
import { CLE_AVANT_IMPORT_ECARTE, CLE_AVANT_REMISE_PRECEDENTE, garderAvantRestauration, listerCopies, lireAvantRemiseANeuf, lireAvantRestauration, lireCopie, supprimerAvantRemiseANeuf } from '../sauvegarde-auto.js';
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

const restaurerAvantRemise = (magasin, cle, libelle) => async () => {
  const texte = await lireAvantRemiseANeuf(magasin, cle);
  if (texte === null) { afficherMessage('Aucun état de sécurité gardé.', 'erreur'); return; }
  await proposerRestauration(texte, `l'état d'avant ${libelle}`, `état avant ${libelle}`);
};

async function restaurerAvant() {
  const texte = await lireAvantRestauration();
  if (texte === null) { afficherMessage('Aucun état gardé avant une restauration.', 'erreur'); return; }
  await proposerRestauration(texte, "l'état d'avant la dernière restauration", 'état avant la dernière restauration');
}

const supprimerCopieNeuf = (magasin, cle = undefined, quoi = 'la remise à neuf') => () => confirmer({
  titre: 'Supprimer la copie de sécurité ?',
  texte: `La copie d'avant ${quoi} sera supprimée de cet appareil. C'est irréversible : les anciennes données ne pourront plus être retrouvées.`,
  libelleOk: 'Supprimer cette copie', danger: true,
  action: async () => { await supprimerAvantRemiseANeuf(magasin, cle); afficherMessage('Copie de sécurité supprimée.', 'ok'); redessiner(); },
});

const ligne = (titre, meta, onClick) => h('li', null, h('button', { type: 'button', classe: 'reglage-rubrique', onClick },
  h('span', { classe: 'reglage-rubrique-texte' }, h('strong', null, titre), h('span', { classe: 'meta' }, meta)),
  h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›')));

/** `magasin` : injectable pour les tests (le vrai magasin IndexedDB par défaut). */
export function sectionCopies(magasin) {
  const liste = h('ul', { classe: 'liste' });
  const info = h('p', { classe: 'aide' }, 'Lecture des copies…');
  Promise.all([listerCopies(magasin), lireAvantRestauration(magasin), lireAvantRemiseANeuf(magasin), lireAvantRemiseANeuf(magasin, CLE_AVANT_REMISE_PRECEDENTE), lireAvantRemiseANeuf(magasin, CLE_AVANT_IMPORT_ECARTE)])
    .then(([dates, avant, avantNeuf, avantNeufPrecedent, avantEcarte]) => {
    info.textContent = dates.length === 0
      ? 'Aucune copie pour l\'instant : la première est faite à l\'ouverture si des données existent, sinon au premier enregistrement.'
      : 'Une copie par jour, les 7 dernières, gardées sur cet appareil (sans les photos).';
    for (const date of dates) liste.appendChild(ligne(majuscule(libelleJour(date)), date, () => restaurerCopie(date)));
    if (avantNeuf !== null) {
      liste.appendChild(ligne('État avant la remise à neuf', 'copie de sécurité gardée avant « Repartir à neuf »', restaurerAvantRemise(magasin, undefined, 'la remise à neuf')));
      liste.appendChild(ligne('Supprimer aussi cette copie de sécurité', 'irréversible : les anciennes données seront perdues', supprimerCopieNeuf(magasin)));
    }
    if (avantNeufPrecedent !== null) {
      liste.appendChild(ligne('État avant la remise à neuf précédente', 'l\'avant-dernière copie de sécurité', restaurerAvantRemise(magasin, CLE_AVANT_REMISE_PRECEDENTE, 'la remise à neuf précédente')));
      liste.appendChild(ligne('Supprimer aussi la copie précédente', 'irréversible : les anciennes données seront perdues', supprimerCopieNeuf(magasin, CLE_AVANT_REMISE_PRECEDENTE)));
    }
    if (avantEcarte !== null) {
      liste.appendChild(ligne("État avant l'import écarté", "copie gardée quand des éléments abîmés ont été écartés à l'ouverture", restaurerAvantRemise(magasin, CLE_AVANT_IMPORT_ECARTE, "l'import écarté")));
      liste.appendChild(ligne('Supprimer aussi cette copie', 'irréversible : les éléments abîmés ne pourront plus être retrouvés', supprimerCopieNeuf(magasin, CLE_AVANT_IMPORT_ECARTE, "l'import écarté")));
    }
    if (avant !== null) liste.appendChild(ligne('État avant la dernière restauration', 'gardé avant le dernier remplacement', restaurerAvant));
    }).catch(() => { info.textContent = 'Les copies ne sont pas lisibles sur cet appareil.'; });
  return h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, 'Copies automatiques'), info, liste);
}
