// Réglages > Apprentissage et essais : ce que Sanji a appris (lecture seule) et les retours d'essai (locaux, rien n'est envoyé).

import { libelleJour } from '../domaine/dates.js';
import { rapportApprentissage } from '../domaine/rapport-apprentissage.js';
import { texteRapport } from '../domaine/retour-essai.js';
import { redessiner } from '../magasin.js';
import { VERSION_APP } from '../version.js';
import { h } from './dom.js';
import { bouton, ligneVide } from './elements.js';
import { pluriel } from './format.js';
import { afficherMessage } from './messages.js';
import { confirmer } from './panneau.js';
import { effacerRetours, lireRetours } from './retours-essai.js';

const carte = (titre, ...contenu) => h('section', { classe: 'carte' }, h('h2', { classe: 'section-titre' }, titre), contenu);

export const resumeApprentissage = (etat) => {
  const n = rapportApprentissage(etat).motsRetenus;
  return `${pluriel(n, 'mot retenu', 'mots retenus')} · ${pluriel(lireRetours().length, 'retour d\'essai', 'retours d\'essai')}`;
};

function sectionAppris(etat) {
  const r = rapportApprentissage(etat);
  return carte('Ce que Sanji a appris',
    h('p', null, `${pluriel(r.motsRetenus, 'mot retenu', 'mots retenus')}${r.motsRetenus > r.mots.length ? ` (les ${r.mots.length} premiers sont listés)` : ''}.`),
    r.mots.length === 0 ? ligneVide('Aucun mot retenu pour l\'instant.')
      : h('ul', { classe: 'liste-simple' }, r.mots.map((m) => h('li', null, `${m.nom}${m.menu ? ` (menu ${m.menu})` : ''} · ${m.categorie}`))),
    h('h3', { classe: 'retour-essai-sous-titre' }, 'À préciser par semaine'),
    r.semaines.length === 0 ? ligneVide('Aucune semaine avec des composants.')
      : h('ul', { classe: 'liste-simple' }, r.semaines.map((s) => h('li', null, `Semaine du ${libelleJour(s.lundi)} : ${s.aPreciser} à préciser sur ${s.composants}`))));
}

/** Copie le rapport ; sans presse-papiers, l'affiche dans une zone de texte à sélectionner. */
async function copier(texte, zone) {
  try {
    await globalThis.navigator.clipboard.writeText(texte);
    afficherMessage('Rapport copié. Collez-le dans la conversation.', 'ok');
  } catch {
    const champ = h('textarea', { classe: 'retour-essai-texte', rows: 10, readonly: true, 'aria-label': 'Rapport à copier' });
    champ.value = texte;
    zone.replaceChildren(h('p', { classe: 'aide' }, 'Copie automatique indisponible : sélectionnez tout le texte ci-dessous, puis copiez-le.'), champ);
  }
}

function sectionRetours() {
  const retours = lireRetours();
  const rapport = () => texteRapport(lireRetours(), { version: VERSION_APP, date: new Date().toISOString() });
  const zone = h('div', { 'aria-live': 'polite' });
  const peutPartager = typeof globalThis.navigator?.share === 'function';
  return carte('Retours d\'essai',
    h('p', { classe: 'aide' }, 'Rien n\'est envoyé : vous copiez le rapport et vous me le transmettez vous-même. Les retours de fiche peuvent contenir des noms, des allergies et des remarques : relisez le rapport avant de le coller. Les retours sont effacés après 14 jours.'),
    h('p', null, pluriel(retours.length, 'retour noté', 'retours notés')),
    h('div', { classe: 'actions' },
      bouton('Copier le rapport', () => copier(rapport(), zone), 'court', { disabled: retours.length === 0 }),
      peutPartager ? bouton('Partager', async () => { try { await globalThis.navigator.share({ title: 'Rapport d\'essai Sanji', text: rapport() }); } catch { /* annulé */ } }, 'court', { disabled: retours.length === 0 }) : null,
      bouton('Effacer les retours', () => confirmer({
        titre: 'Effacer les retours d\'essai ?', texte: 'Les retours gardés sur cet appareil seront supprimés. Vos menus ne changent pas.', libelleOk: 'Effacer', danger: true,
        action: () => { effacerRetours(); redessiner(); },
      }), 'court', { disabled: retours.length === 0 })),
    zone);
}

export const sectionsApprentissage = (etat) => [sectionAppris(etat), sectionRetours()];
