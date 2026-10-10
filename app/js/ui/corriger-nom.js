// « Corriger le nom » sur la fiche d'un élément : le nom est corrigé, l'ancienne orthographe est retenue (domaine/actions-fiches.js)
// et les éléments des semaines à venir sont corrigés d'un coup. Aucune logique métier ici.

import { corrigerNom } from '../domaine/actions-fiches.js';
import { agir } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { afficherMessage } from './messages.js';

/** Le bloc de la fiche : un champ prérempli avec le nom actuel et « Enregistrer ». */
export function blocCorrigerNom(c) {
  const f = champs([{ cle: 'nom', type: 'texte', libelle: 'Corriger le nom', valeur: c.nom }]);
  const enregistrer = () => {
    const nom = String(f.valeur('nom') ?? '').trim();
    if (nom === c.nom) return;
    const r = agir((e, t) => corrigerNom(e, c.id, nom, t));
    if (!r.ok) return;
    const { ancien, nom: corrige, retenue } = r.valeur;
    afficherMessage(retenue
      ? `Retenu : ${ancien} s'écrira ${corrige} ; ${corrige} reprendra ce que vous avez réglé.`
      : `Nom corrigé : ${corrige}.`, 'ok');
  };
  return h('div', { classe: 'corriger-nom' }, ...f.noeuds,
    h('div', { classe: 'actions' }, h('button', { type: 'button', classe: 'btn btn-court', onClick: enregistrer, 'aria-label': 'Enregistrer le nom corrigé' }, 'Enregistrer')));
}
