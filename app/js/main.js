// Point d'entrée : charge l'état local, branche le routeur et prépare le mode hors ligne.
// Ce module peut être importé sous Node : `demarrer()` n'est appelée que dans un navigateur.

import { h, parId } from './ui/dom.js';
import { bouton, encadre } from './ui/elements.js';
import { abonnerHorsLigne, preparerHorsLigne } from './ui/horsligne.js';
import { installerJournal } from './ui/journal-diagnostic.js';
import { afficherMessage } from './ui/messages.js';
import { charger, redessiner, surMessage } from './magasin.js';
import { demarrerRouteur } from './ui/routeur.js';

/** Au-delà, la lecture des données locales est jugée bloquée (autre fenêtre Sanji mal fermée, navigateur figé). */
export const DELAI_LECTURE_MS = 15000;

/** Attend la promesse, au plus `delai` ms : sinon rejette avec `raison` (jamais une attente sans fin). */
export function attendreAuPlus(promesse, delai, raison) {
  return new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error(raison)), delai);
    promesse.then((v) => { clearTimeout(minuteur); resoudre(v); }, (e) => { clearTimeout(minuteur); rejeter(e); });
  });
}

/** Remplace « Chargement… » par une explication et un bouton de reprise : jamais une page muette. */
export function afficherEchecDemarrage(racine, erreur) {
  const cause = erreur?.message ?? 'cause inconnue';
  racine.replaceChildren(h('div', { classe: 'vue' },
    encadre('erreur', `Sanji n'a pas pu démarrer : ${cause}. Fermez les autres fenêtres Sanji ouvertes, puis rechargez. Vos données ne sont pas modifiées.`),
    h('p', null, bouton('Recharger', () => location.reload(), 'principal'))));
}

export async function demarrer() {
  surMessage(afficherMessage);
  await attendreAuPlus(charger(), DELAI_LECTURE_MS, 'la lecture des données de cet appareil est trop longue');
  demarrerRouteur();
  abonnerHorsLigne(redessiner);
  preparerHorsLigne();
  installerJournal(); // après le chargement ; ne lève jamais
}

if (typeof document !== 'undefined') {
  demarrer().catch((erreur) => {
    const racine = parId('vue');
    if (racine) afficherEchecDemarrage(racine, erreur);
  });
}
