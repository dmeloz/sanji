// Notes de test : stockage local à l'appareil (HORS de l'état et de la sauvegarde), pastille « Dev » et feuille de saisie.
// Rien n'est envoyé : les notes ne partent qu'avec le fichier de diagnostic que la propriétaire partage.

import { CATEGORIES, MAX_GESTES, MAX_NOTE, TYPES, TYPE_PAR_DEFAUT, gesteTexte, validerNote } from '../domaine/notes-dev.js';
import { VERSION_APP } from '../version.js';
import { h, parId, svg } from './dom.js';
import { lireEvenements } from './journal-diagnostic.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';

const CLE = 'sanji-notes-dev';
const CLE_PASTILLE = 'sanji-pastille-dev';
const ID_PASTILLE = 'pastille-dev';
export const MAX_NOTES = 100;
export const DUREE_MAX_MS = 60 * 24 * 3600 * 1000;
let memoire = [];
let repli = false; // le stockage local a refusé une écriture : la mémoire fait foi

function stockage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const recentes = (liste) => {
  const limite = Date.now() - DUREE_MAX_MS;
  return liste.filter((n) => n && typeof n === 'object' && typeof n.id === 'string' && Date.parse(n.h) >= limite);
};

/** Les notes de moins de 60 jours, la plus récente en tête. */
export function lireNotes() {
  const s = stockage();
  if (!s || repli) return recentes(memoire);
  try {
    const liste = JSON.parse(s.getItem(CLE) ?? '[]');
    return Array.isArray(liste) ? recentes(liste) : [];
  } catch { return recentes(memoire); }
}

function ecrire(liste) {
  memoire = liste;
  try { stockage()?.setItem(CLE, JSON.stringify(liste)); } catch { repli = true; }
}

/** Ajoute une note ouverte en tête (100 au plus). `saisie` : { type, texte, ecran, gestes }. Lève une Error si la saisie est refusée. */
export function ajouterNote({ type, texte, ecran = '', gestes = [] }) {
  const v = validerNote({ type, texte });
  if (!v.ok) throw new Error(v.erreur);
  const note = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type: v.type, categorie: v.categorie, texte: v.texte,
    ecran: String(ecran).slice(0, 80), version: VERSION_APP, h: new Date().toISOString(), etat: 'ouverte', gestes: gestes.slice(-MAX_GESTES) };
  ecrire([note, ...lireNotes()].slice(0, MAX_NOTES));
  return note;
}

/** Réglée ↔ ouverte. */
export function basculerNote(id) {
  ecrire(lireNotes().map((n) => (n.id === id ? { ...n, etat: n.etat === 'reglee' ? 'ouverte' : 'reglee' } : n)));
}

export function supprimerNote(id) {
  ecrire(lireNotes().filter((n) => n.id !== id));
}

export function effacerNotes() {
  memoire = [];
  repli = false;
  try { stockage()?.removeItem(CLE); } catch { /* rien à retirer */ }
}

// ------------------------------------------------------------ pastille

/** Activée par défaut ; la préférence reste en stockage local, hors état. */
export function pastilleActive() {
  try { return stockage()?.getItem(CLE_PASTILLE) !== 'non'; } catch { return true; }
}

export function reglerPastille(active) {
  try { stockage()?.setItem(CLE_PASTILLE, active ? 'oui' : 'non'); } catch { /* préférence non gardée */ }
  const p = parId(ID_PASTILLE);
  if (p) p.hidden = !active;
}

const ecranCourant = () => {
  const titre = String(globalThis.document?.title ?? '').replace(/\s+—\s+Sanji$/, '').trim();
  return titre || globalThis.location?.hash || '?';
};

// Les derniers gestes AVANT l'ouverture : le toucher de la pastille elle-même (libellé « Dev ») est écarté.
const derniersGestes = () => lireEvenements().filter((e) => !(e.type === 'clic' && /\bDev\b/.test(String(e.libelle ?? ''))))
  .slice(-MAX_GESTES).map(gesteTexte).filter(Boolean);

function groupeType(categorie, controles, nom) {
  return h('fieldset', { classe: 'note-dev-groupe' }, h('legend', { classe: 'note-dev-legende' }, categorie.libelle),
    categorie.types.map((type) => {
      const id = `${nom}-${type}`;
      const radio = h('input', { id, type: 'radio', name: nom, checked: type === TYPE_PAR_DEFAUT });
      controles.set(type, radio);
      return h('label', { classe: 'case', pour: id }, radio, h('span', null, TYPES[type]));
    }));
}

/** Feuille « Noter une remarque ». `contexte` : { ecran, gestes } fixés à l'ouverture. */
export function ouvrirFeuilleNote(contexte = { ecran: ecranCourant(), gestes: derniersGestes() }) {
  const controles = new Map();
  const zone = h('textarea', { id: 'note-dev-texte', rows: 5, maxlength: MAX_NOTE, autocomplete: 'off', placeholder: 'Écrivez ou dictez votre remarque' });
  return panneau({
    titre: 'Noter une remarque',
    corps: [
      h('p', { classe: 'aide' }, `Écran : ${contexte.ecran}. Rien n'est envoyé : la note reste sur cet appareil.`),
      ...CATEGORIES.map((c) => groupeType(c, controles, 'note-dev-type')),
      h('div', { classe: 'champ' }, h('label', { pour: 'note-dev-texte' }, `Votre remarque (${MAX_NOTE} caractères au plus)`), zone),
    ],
    surEnregistrer: () => {
      const type = [...controles].find(([, r]) => r.checked)?.[0];
      ajouterNote({ type, texte: zone.value, ecran: contexte.ecran, gestes: contexte.gestes });
      afficherMessage('Remarque notée. Elle reste sur cet appareil.', 'ok');
    },
  });
}

function creerPastille() {
  const icone = svg('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [svg('path', { d: 'M4 20l4-1 11-11-3-3L5 16z' }), svg('path', { d: 'M14 7l3 3' })]);
  return h('button', { type: 'button', id: ID_PASTILLE, classe: 'bouton-dev', hidden: !pastilleActive(), onClick: () => ouvrirFeuilleNote() }, icone, h('span', null, 'Dev'));
}

/** Pose la pastille sur la page, une seule fois. À appeler après `charger()`, jamais au niveau supérieur. Ne lève jamais. */
export function installerPastilleDev() {
  try {
    if (typeof document === 'undefined' || parId(ID_PASTILLE)) return;
    document.body.appendChild(creerPastille());
  } catch { /* les notes ne doivent jamais gêner le démarrage */ }
}
