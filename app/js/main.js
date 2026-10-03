// Point d'entrée : charge l'état local, branche le routeur et prépare le mode hors ligne.
// Ce module peut être importé sous Node : `demarrer()` n'est appelée que dans un navigateur.

import { abonnerHorsLigne, preparerHorsLigne } from './ui/horsligne.js';
import { afficherMessage } from './ui/messages.js';
import { charger, redessiner, surMessage } from './magasin.js';
import { demarrerRouteur } from './ui/routeur.js';

export async function demarrer() {
  surMessage(afficherMessage);
  await charger();
  demarrerRouteur();
  abonnerHorsLigne(redessiner);
  preparerHorsLigne();
}

if (typeof document !== 'undefined') {
  demarrer();
}
