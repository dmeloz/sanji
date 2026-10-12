// Le verbe d'une ligne de Production (« Cuire », « Sauter »…), choisi par la propriétaire (v129) : une ligne « Verbe : Cuire › »
// dans la feuille du « ⋯ », qui ouvre la liste des verbes et « Aucun verbe ». L'enregistrement est `definirVerbe`.
// Aucune logique métier ici.

import { definirVerbe } from '../domaine/actions-fiches.js';
import { AUCUN_VERBE, VERBES } from '../domaine/fiches-retenues.js';
import { verbeDe } from '../domaine/mise-en-place.js';
import { agir } from '../magasin.js';
import { h } from './dom.js';
import { ouvrirFeuilleLecture } from './elements.js';
import { afficherMessage } from './messages.js';

/** La ligne « Verbe : … › » d'un élément au poste, ou null (un élément hors poste n'a pas de fiche où retenir un verbe). */
export function ligneVerbe(etat, composantId) {
  const c = etat.composants?.[composantId];
  if (c?.attribue !== true) return null;
  const actuel = verbeDe(c, etat);
  return h('button', {
    type: 'button', classe: 'ligne-feuille', 'aria-label': `Verbe de ${c.nom} : ${actuel ?? 'aucun'}`,
    onClick: () => ouvrirChoix(c, actuel),
  }, h('span', { classe: 'ligne-feuille-texte' }, h('strong', null, `Verbe : ${actuel ?? 'aucun'}`)),
  h('span', { classe: 'reglage-fleche', 'aria-hidden': 'true' }, '›'));
}

function ouvrirChoix(c, actuel) {
  const choisir = (verbe) => {
    const r = agir((e, t) => definirVerbe(e, c.id, verbe, t), { afficher: false });
    if (r.ok) afficherMessage(verbe === AUCUN_VERBE ? `${c.nom} : aucun verbe.` : `${c.nom} : ${verbe}.`, 'ok');
    else afficherMessage(r.erreur, 'erreur');
  };
  const option = (verbe, texte) => {
    const courant = texte === (actuel ?? 'Aucun verbe');
    return h('button', {
      type: 'button', classe: `btn btn-court${courant ? ' btn-principal' : ''}`,
      'aria-pressed': courant ? 'true' : 'false', onClick: () => choisir(verbe),
    }, courant ? `✓ ${texte}` : texte);
  };
  ouvrirFeuilleLecture(`Verbe : ${c.nom}`, [h('div', { classe: 'actions' }, [...VERBES.map((v) => option(v, v)), option(AUCUN_VERBE, 'Aucun verbe')])]);
}
