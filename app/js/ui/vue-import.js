// Import des menus (#/import[/date]), selon la maquette « Import » de la refonte 1.
// `param` = le lundi de la semaine (le routeur le donne). Saisie : texte collé (feuille.js) ou intitulés tapés jour par jour ;
// la photo reste une AIDE visuelle (photo.js), jamais lue par Sanji. « Ce que Sanji a lu » est la lecture des intitulés
// saisis (lirePlat) : elle se met à jour pendant la frappe, sans rien enregistrer. Les morceaux de saisie, de répartition
// et d'enregistrement viennent de vue-menus.js (aucune règle métier ici).

import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { lirePlat } from '../domaine/analyse-menu.js';
import { jourOuVide } from '../domaine/etat.js';
import { tableauBlanc } from '../domaine/tableau-blanc.js';
import { aujourdhui } from '../magasin.js';
import { h } from './dom.js';
import { bouton, lien, repliable } from './elements.js';
import { pluriel } from './format.js';
import { libelleHorsLigne } from './horsligne.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { importerPhoto, retirerPhoto, urlPhoto } from './photo.js';
import { JOURS_A_MENU, blocJour, champSaisi, enregistrer, repartir } from './vue-menus.js';

export function titre() { return 'Import des menus'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Ce que la lecture a laissé en doute, en mots (jamais par la couleur seule). */
const MOTS_AMBIGUITE = {
  choix: 'choix à préciser',
  recette: 'recette à préciser',
  sauce: 'sauce à confirmer',
  sauce_implicite: 'sauce implicite à confirmer',
  mot_inconnu: 'mot à préciser',
};

const motAmbiguite = (a) => `${MOTS_AMBIGUITE[a.type] ?? 'à vérifier'} : ${a.texte}`;

/** Étiquette d'un élément lu : seulement ce que la lecture dit (hors poste, à confirmer). */
function etiquetteElement(element) {
  if (element.statut === 'a_confirmer' || element.propriete === 'a_confirmer') return 'à confirmer';
  if (element.propriete === 'hors_poste') return 'hors poste';
  return null;
}

/** La lecture d'un intitulé : null si le champ est vide. */
function lire(etat, texte, menu) {
  const intitule = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return intitule === '' ? null : lirePlat(intitule, menu, { lectures: etat.lectures });
}

function blocLectureMenu(menu, lecture) {
  if (!lecture) {
    return h('div', { classe: 'imp-menu' },
      h('span', { classe: 'imp-menu-nom' }, `Menu ${menu}`),
      h('p', { classe: 'imp-neutre' }, 'non saisi'));
  }
  const doute = lecture.ambiguites.length > 0;
  return h('div', { classe: `imp-menu${doute ? ' imp-menu-doute' : ''}` },
    h('span', { classe: 'imp-menu-nom' }, doute ? `Menu ${menu} · à vérifier` : `Menu ${menu}`),
    h('ul', { classe: 'imp-elements' }, lecture.elements.map((e) => h('li', null,
      h('span', null, e.nom),
      etiquetteElement(e) ? h('span', { classe: 'imp-etiquette' }, etiquetteElement(e)) : null))),
    doute ? h('ul', { classe: 'imp-doutes' }, lecture.ambiguites.map((a) => h('li', null, motAmbiguite(a)))) : null);
}

/** Une ligne par jour : « 2 menus · lu » ou « 1 à vérifier » ; dépliée quand il y a un doute. */
function ligneLectureJour(etat, champs, date, ouverts) {
  const lectures = [1, 2].map((menu) => lire(etat, champs.get(`menu-${date}-${menu}`).value, menu));
  const saisis = lectures.filter(Boolean);
  const doutes = saisis.reduce((n, l) => n + l.ambiguites.length, 0);
  const verifier = doutes > 0;
  const etatTexte = saisis.length === 0 ? 'non saisi' : verifier ? `${doutes} à vérifier` : `${pluriel(saisis.length, 'menu')} · lu`;
  const details = repliable(
    h('span', { classe: 'imp-jour-tete' },
      h('span', { classe: 'imp-jour-nom' }, majuscule(libelleJour(date))),
      h('span', { classe: verifier ? 'imp-jour-etat imp-jour-etat-doute' : 'imp-jour-etat' }, etatTexte)),
    ouverts.get(date) ?? verifier,
    saisis.length === 0 ? h('p', { classe: 'imp-neutre' }, 'Aucun menu saisi ce jour-là.')
      : h('div', { classe: 'imp-jour-corps' }, blocLectureMenu(1, lectures[0]), blocLectureMenu(2, lectures[1])),
    { classe: 'imp-jour' });
  details.addEventListener('toggle', () => ouverts.set(date, details.open));
  return details;
}

/** Photo du menu papier : une aide pour recopier ou copier le texte, jamais lue. Gardée sur l'appareil, non exportée. */
function blocPhoto(lundi) {
  const zone = h('div', { classe: 'photo-zone' }, h('p', { classe: 'vide' }, 'Aucune photo.'));
  const retirer = bouton('Retirer la photo', () => confirmer({
    titre: 'Retirer la photo ?', texte: 'La photo sera supprimée de cet appareil.', libelleOk: 'Retirer', danger: true,
    action: async () => { await retirerPhoto(lundi); montrer(null); },
  }), 'court', { hidden: true });
  function montrer(url) {
    retirer.hidden = !url;
    if (!url) { zone.replaceChildren(h('p', { classe: 'vide' }, 'Aucune photo.')); return; }
    zone.replaceChildren(h('button', { type: 'button', classe: 'photo-miniature', 'aria-label': 'Agrandir la photo du menu papier',
      onClick: () => panneau({ titre: 'Menu papier', lectureSeule: true, corps: [h('img', { classe: 'photo-grande', src: url, alt: 'Photo du menu papier' })] }) },
    h('img', { src: url, alt: 'Photo du menu papier (aide à la saisie)' })));
  }
  const entree = h('input', {
    type: 'file', accept: 'image/*', classe: 'cache',
    onChange: async (evenement) => {
      const fichier = evenement.target.files?.[0];
      evenement.target.value = '';
      if (!fichier) return;
      try {
        const conservee = await importerPhoto(lundi, fichier);
        afficherMessage(conservee ? 'Photo enregistrée sur cet appareil.' : 'Photo gardée en mémoire seulement : elle sera perdue à la fermeture.', conservee ? 'ok' : 'alerte');
        montrer(await urlPhoto(lundi));
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
      }
    },
  });
  const bloc = repliable(h('h2', { classe: 'imp-titre-section' }, 'Photo du menu (aide visuelle)'), false, [
    h('p', { classe: 'aide' }, 'Sanji ne lit pas la photo : elle reste à côté pour que vous recopiiez les intitulés ou copiiez son texte. Réduite à 1600 px, gardée sur l\'appareil, non exportée.'),
    zone,
    h('div', { classe: 'actions' }, h('label', { classe: 'btn btn-court' }, 'Prendre ou importer une photo', entree), retirer),
  ], { classe: 'carte imp-photo' });
  urlPhoto(lundi).then((url) => { if (url) { montrer(url); bloc.open = true; } }).catch(() => {});
  return bloc;
}

export function rendre(etat, lundi) {
  const champs = new Map();
  const ouverts = new Map();
  const dates = JOURS_A_MENU.map((decalage) => ajouterJours(lundi, decalage));
  const numero = tableauBlanc(etat, aujourdhui(), lundi).bord.entete.semaine;
  const racine = h('div', { classe: 'vue vue-import vue-menus' });

  racine.appendChild(lien(`#/semaine/${lundi}/tableau`, '‹ Semaine', 'imp-retour'));
  // Changer de semaine : deux flèches de part et d'autre de l'en-tête, comme sur l'écran Semaine.
  racine.appendChild(h('div', { classe: 'bord-semaine-nav imp-semaine-nav' },
    h('a', { href: `#/import/${ajouterJours(lundi, -7)}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
    h('header', { classe: 'imp-tete bord-semaine' },
      h('p', { classe: 'imp-legende' }, `Semaine ${numero} · du ${libelleJour(lundi)} · ${libelleHorsLigne()}`),
      h('h1', { classe: 'page-titre' }, 'Importer les menus')),
    h('a', { href: `#/import/${ajouterJours(lundi, 7)}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine suivante' }, '›')));

  racine.appendChild(blocPhoto(lundi));

  const dejaSaisie = dates.some((date) => [1, 2].some((menu) => jourOuVide(etat, date).menus[menu].intitule.trim() !== ''));
  const zoneLecture = h('div', { classe: 'imp-lecture-jours' });
  const majLecture = () => zoneLecture.replaceChildren(...dates.map((date) => ligneLectureJour(etat, champs, date, ouverts)));
  const repartirEtLire = () => { repartir(champs, lundi); majLecture(); };

  racine.appendChild(h('section', { classe: 'carte' },
    repliable(h('h2', { classe: 'imp-titre-section', id: 'titre-feuille' }, 'Coller le texte de la feuille'), !dejaSaisie, [
      h('p', { classe: 'aide' }, 'Sur iPhone ou iPad : ouvrez la photo de la feuille, appuyez sur le texte, choisissez « Tout sélectionner » puis « Copier », et collez ici. Les prix, le titre et les annotations sont laissés de côté.'),
      h('label', { pour: 'feuille-texte', classe: 'saisie-libelle' }, 'Texte de la feuille'),
      champSaisi(champs, 'textarea', { id: 'feuille-texte', rows: 6, placeholder: 'texte copié depuis la photo de la feuille', value: '' }),
      h('div', { classe: 'actions' }, bouton('Répartir dans la semaine', repartirEtLire)),
      champSaisi(champs, 'div', { id: 'feuille-retour', classe: 'saisie-retour', 'aria-live': 'polite' }),
    ])));

  racine.appendChild(h('h2', { classe: 'imp-titre-section imp-titre-hors' }, 'Ou taper jour par jour'));
  for (const date of dates) racine.appendChild(blocJour(champs, etat, date, { repliable: true }));
  // La lecture suit la frappe ; les champs n'enregistrent rien avant « Enregistrer la semaine ».
  for (const date of dates) for (const menu of [1, 2]) champs.get(`menu-${date}-${menu}`).addEventListener('input', majLecture);

  racine.appendChild(h('section', { classe: 'carte imp-lecture', 'aria-labelledby': 'titre-lecture' },
    h('h2', { classe: 'imp-titre-section', id: 'titre-lecture' }, 'Ce que Sanji a lu · vérifie'),
    h('p', { classe: 'aide' }, 'Lecture des intitulés ci-dessus. Corrigez l\'intitulé dans son champ si la lecture est fausse : elle se met à jour.'),
    zoneLecture));
  majLecture();

  racine.appendChild(h('div', { classe: 'barre-enregistrer' },
    lien(`#/semaine/${lundi}/tableau`, 'Annuler', 'btn'),
    bouton('Enregistrer la semaine', () => enregistrer(champs, etat, lundi), 'principal')));
  return racine;
}
