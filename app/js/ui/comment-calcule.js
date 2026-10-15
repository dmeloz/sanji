// « Comment c'est calculé » (v132) : la quantité d'un élément en toutes lettres, avec l'origine de la portion, l'alerte si l'état du
// poids paraît faux, et le geste « Corriger le poids : sec / cru / cuit » (choix-poids.js) qui s'applique à la source de la portion.
// Aucun chiffre ni règle ici : tout vient de `expliquerQuantite` (domaine/poids-portion.js).

import { definirEtatPoidsPortion, expliquerQuantite } from '../domaine/poids-portion.js';
import { choixEtatPoids } from './choix-poids.js';
import { h } from './dom.js';
import { agir } from '../magasin.js';
import { bouton, pastille } from './elements.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';

function feuilleCorrection(composantId, x) {
  panneau({
    titre: 'Corriger le poids de la portion', lectureSeule: true,
    corps: (api) => {
      const poids = choixEtatPoids(x.etatPoids);
      const appliquer = () => {
        const r = agir((e, t) => definirEtatPoidsPortion(e, x.lieu, poids.valeur(), t), { afficher: false });
        if (!r.ok) { api.erreur(r.erreur); return; }
        api.fermer();
        afficherMessage('État du poids corrigé : la valeur de la portion ne change pas.', 'ok');
      };
      return h('div', null,
        h('p', null, 'Seul l\'état du poids change, jamais la valeur de la portion. Tapez ensuite une autre valeur si besoin.'),
        poids.noeud, bouton('Appliquer', appliquer, 'principal', { 'aria-label': 'Appliquer cet état du poids' }));
    },
  });
}

/** Bloc « Comment c'est calculé » d'un élément, ou null quand la quantité est inconnue. */
export function blocCommentCalcule(etat, composantId) {
  const x = expliquerQuantite(etat, composantId);
  if (!x.texte) return null;
  return h('section', { classe: 'comment-calcule', 'aria-label': "Comment c'est calculé" },
    h('p', { classe: 'fiche-legende' }, "Comment c'est calculé"),
    h('p', { classe: 'comment-calcule-texte' }, x.texte),
    x.avertissement ? h('p', { classe: 'comment-calcule-alerte' }, pastille('poids à vérifier', 'ambre'), ` ${x.avertissement}`) : null,
    x.lieu ? bouton('Corriger le poids : sec / cru / cuit', () => feuilleCorrection(composantId, x), 'court') : null);
}
