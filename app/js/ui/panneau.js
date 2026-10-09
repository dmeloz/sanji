// Panneau de saisie <dialog> : « Enregistrer » et « Annuler ». Toute saisie de l'application passe par ici.
// Une erreur levée par `surEnregistrer` s'affiche dans le panneau, qui reste ouvert ; l'état n'est pas touché.

import { h, parId } from './dom.js';
import { activerFermetureParGlisse } from './glisser.js';

/**
 * @param {object} options
 * @param {string} options.titre
 * @param {Node[]|((api:{fermer:Function, erreur:Function})=>Node[])} options.corps
 * @param {(api)=>any} [options.surEnregistrer] peut être asynchrone ; lever une Error pour refuser
 * @param {string} [options.libelleEnregistrer] « Enregistrer » par défaut
 * @param {string} [options.libelleAnnuler] « Annuler » par défaut
 * @param {boolean} [options.lectureSeule] un seul bouton « Fermer »
 * @param {boolean} [options.danger] bouton principal en rouge
 * @param {boolean} [options.annulerEnLien] « Annuler » discret, en lien (moins de boutons visibles)
 * @param {{libelle:string, action:(api)=>any}[]} [options.extras] boutons supplémentaires
 */
export function panneau(options) {
  const { titre, corps, surEnregistrer, libelleEnregistrer = 'Enregistrer', libelleAnnuler = 'Annuler',
    lectureSeule = false, danger = false, extras = [], annulerEnLien = false } = options;
  const dialogue = h('dialog', { classe: 'panneau', 'aria-labelledby': 'panneau-titre' });
  const zoneErreur = h('p', { classe: 'panneau-erreur', role: 'alert', hidden: true });
  const api = {
    fermer: () => dialogue.close(),
    erreur(texte) { zoneErreur.textContent = texte; zoneErreur.hidden = !texte; },
  };
  const contenu = typeof corps === 'function' ? corps(api) : corps;
  const boutonOk = lectureSeule ? null
    : h('button', { type: 'submit', classe: danger ? 'btn btn-danger' : 'btn btn-principal' }, libelleEnregistrer);
  const boutons = [
    ...extras.map((x) => h('button', {
      type: 'button', classe: 'btn',
      onClick: async () => {
        api.erreur('');
        try { await x.action(api); } catch (e) { api.erreur(e?.message ?? String(e)); }
      },
    }, x.libelle)),
    h('button', { type: 'button', classe: annulerEnLien && !lectureSeule ? 'btn btn-lien' : 'btn', onClick: () => dialogue.close() }, lectureSeule ? 'Fermer' : libelleAnnuler),
    boutonOk,
  ];
  const poignee = h('span', { classe: 'panneau-poignee', 'aria-hidden': 'true' });
  const enTete = h('h2', { id: 'panneau-titre', classe: 'panneau-titre' }, titre);
  activerFermetureParGlisse(dialogue, [poignee, enTete]);
  let enCours = false;
  const formulaire = h('form', {
    novalidate: true,
    onSubmit: async (evenement) => {
      evenement.preventDefault();
      if (lectureSeule || enCours) return;
      enCours = true;
      boutonOk.disabled = true;
      api.erreur('');
      try {
        await surEnregistrer?.(api);
        dialogue.close();
      } catch (e) {
        api.erreur(e?.message ?? String(e));
      } finally {
        enCours = false;
        boutonOk.disabled = false;
      }
    },
  },
  poignee,
  enTete,
  h('div', { classe: 'panneau-corps' }, contenu),
  zoneErreur,
  h('div', { classe: 'panneau-actions' }, boutons));
  // Poignée de la feuille montante (premier enfant du formulaire) : tirer la poignée ou le titre vers le bas ferme la feuille (comme « Annuler »).
  dialogue.appendChild(formulaire);
  dialogue.addEventListener('close', () => dialogue.remove());
  (parId('panneaux') ?? document.body).appendChild(dialogue);
  dialogue.showModal();
  return dialogue;
}

/** Confirmation explicite avant une action irréversible ou lourde. `action` peut lever une Error. */
export function confirmer({ titre, texte, libelleOk = 'Confirmer', danger = false, action }) {
  return panneau({
    titre,
    corps: [h('p', null, texte)],
    libelleEnregistrer: libelleOk,
    danger,
    surEnregistrer: action,
  });
}
