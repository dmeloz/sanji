// Import des menus (#/import[/date]), selon la maquette « Import » de la refonte 1.
// `param` = le lundi de la semaine (le routeur le donne). Saisie : texte collé (feuille.js) ou intitulés tapés jour par jour ;
// la photo reste une AIDE visuelle (photo.js) ; seule l'IA, si la propriétaire la demande après aperçu, en transcrit le texte. « Ce que Sanji a lu » est la lecture des intitulés
// saisis (lirePlat) : elle se met à jour pendant la frappe, sans rien enregistrer. Les morceaux de saisie, de répartition
// et d'enregistrement viennent de vue-menus.js (aucune règle métier ici).

import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { lirePlat } from '../domaine/analyse-menu.js';
import { jourOuVide } from '../domaine/etat.js';
import { tableauBlanc } from '../domaine/tableau-blanc.js';
import { lireLignesFeuille } from '../harness/lecture-photo-ia.js';
import { aujourdhui } from '../magasin.js';
import { assistantPret, fournisseurDepuisReglages } from './assistant-reglages.js';
import { h, svg } from './dom.js';
import { bouton, lien, repliable } from './elements.js';
import { pluriel } from './format.js';
import { problemeHorsLigne } from './horsligne.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';
import { garderPhotoPourDiagnostic, noter } from './journal-diagnostic.js';
import { noterRetour } from './retours-essai.js';
import { importerPhoto, photoBlob, photoEnBase64, retirerPhoto, urlPhoto } from './photo.js';
import { JOURS_A_MENU, blocJour, champSaisi, enregistrer, repartir, reprendreTexte } from './vue-menus.js';

export function titre() { return 'Import des menus'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Ce que la lecture a laissé en doute, en mots (jamais par la couleur seule). */
const MOTS_AMBIGUITE = {
  choix: 'choix à préciser',
  recette: 'recette à préciser',
  sauce: 'sauce à confirmer',
  sauce_implicite: 'sauce implicite à confirmer',
  mot_inconnu: 'mot à préciser',
  preparation: 'préparation à confirmer',
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
  return intitule === '' ? null : lirePlat(intitule, menu, { lectures: etat.lectures, memoire: etat.memoire });
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

const TEXTE_ENVOI_PHOTO = 'La photo va être envoyée à l\'IA pour transcrire le texte imprimé. Les notes écrites à la main sont ignorées. Rien d\'autre ne part. Le texte rendu par l\'IA est gardé 14 jours sur cet appareil pour le diagnostic.';
const AIDE_PHOTO_IA = 'La photo peut être lue par l\'IA, après un aperçu et à chaque fois que vous le demandez : seules les lignes imprimées reviennent, vous les relisez avant d\'enregistrer. Réduite à 1600 px, gardée sur l\'appareil, non exportée.';
const AIDE_PHOTO_SANS_IA = 'Sanji ne lit pas la photo : elle reste à côté pour que vous recopiiez les intitulés ou copiiez son texte. Réduite à 1600 px, gardée sur l\'appareil, non exportée.';

/** Décision du 2026-10-07 : la photo ne part qu'après aperçu, à chaque clic ; la réponse ne fait que remplir le champ de texte. */
async function dialogLecturePhoto(lundi, url, surLecture) {
  const attente = new AbortController();
  const envoi = panneau({
    titre: 'Lire la photo avec l\'IA',
    corps: [h('img', { classe: 'photo-grande photo-apercu', src: url, alt: 'Photo de la feuille qui sera envoyée' }), h('p', null, TEXTE_ENVOI_PHOTO)],
    libelleEnregistrer: 'Envoyer',
    // Une erreur est levée : le panneau reste ouvert avec le message, « Envoyer » permet de réessayer.
    surEnregistrer: async () => {
      const fournisseur = fournisseurDepuisReglages();
      if (!fournisseur.disponible() || typeof fournisseur.demanderLecturePhoto !== 'function') {
        throw new Error('L\'assistant IA n\'est pas activé : rien n\'est envoyé.');
      }
      const image = await photoEnBase64(lundi);
      if (!image) throw new Error('La photo n\'est plus sur cet appareil : rien n\'est envoyé.');
      garderPhotoPourDiagnostic('feuille', await photoBlob(lundi)); // en mémoire seulement, pour le fichier de diagnostic
      envoi.addEventListener('close', () => attente.abort());
      let lecture;
      try {
        lecture = lireLignesFeuille(await fournisseur.demanderLecturePhoto(image, { signal: attente.signal }));
      } catch (e) {
        if (!envoi.open) return; // annulé pendant l'attente : rien à dire
        throw new Error(`L'IA n'a pas répondu : ${e?.message ?? e}`);
      }
      if (!envoi.open) return; // fermé pendant l'attente : la réponse est ignorée
      if (!lecture || lecture.lignes.length === 0) throw new Error('Réponse de l\'IA inexploitable : rien n\'est modifié.');
      surLecture(lecture);
    },
  });
}

let apercuOuvert = false; // un seul aperçu à la fois, quel que soit le bouton qui l'ouvre

const ICONE_APPAREIL = 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z';

/** « Scanner la feuille » : photo puis aperçu (l'envoi reste un clic sur « Envoyer »). Sans assistant prêt, une ligne pour l'activer. */
function blocScanner(lundi, surLecture) {
  if (!assistantPret()) {
    return h('p', { classe: 'aide imp-scanner' }, 'Pour scanner la feuille, activez l\'assistant IA dans ', lien('#/reglages/assistant-ia', 'Réglages'), '.');
  }
  const entree = h('input', {
    type: 'file', accept: 'image/*', id: 'scanner-feuille', classe: 'cache',
    onChange: async (evenement) => {
      const fichier = evenement.target.files?.[0];
      evenement.target.value = '';
      if (!fichier || apercuOuvert) return;
      apercuOuvert = true;
      try {
        const conservee = await importerPhoto(lundi, fichier);
        if (!conservee) afficherMessage('Photo gardée en mémoire seulement : elle sera perdue à la fermeture.', 'alerte');
        const url = await urlPhoto(lundi);
        if (url) dialogLecturePhoto(lundi, url, surLecture);
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
      } finally { apercuOuvert = false; }
    },
  });
  return h('div', { classe: 'imp-scanner' },
    h('label', { classe: 'btn btn-principal btn-scanner' },
      svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': 'true', focusable: 'false', width: 24, height: 24 }, [svg('path', { d: ICONE_APPAREIL })]),
      'Scanner la feuille', entree),
    h('p', { classe: 'aide' }, 'Prenez la feuille en photo : un aperçu s\'ouvre, rien ne part sans « Envoyer ». Vous relisez ensuite avant d\'enregistrer.'));
}

/** Photo du menu papier : gardée sur l'appareil, non exportée. `surLecture` reçoit les lignes que l'IA a transcrites. */
function blocPhoto(lundi, surLecture) {
  const zone = h('div', { classe: 'photo-zone' }, h('p', { classe: 'vide' }, 'Aucune photo.'));
  const retirer = bouton('Retirer la photo', () => confirmer({
    titre: 'Retirer la photo ?', texte: 'La photo sera supprimée de cet appareil.', libelleOk: 'Retirer', danger: true,
    action: async () => { await retirerPhoto(lundi); montrer(null); },
  }), 'court', { hidden: true });
  const lirePhotoIA = assistantPret()
    ? bouton('Lire la photo avec l\'IA', async () => {
      if (apercuOuvert) return; // un seul aperçu à la fois : le deuxième clic pendant la lecture de la photo est ignoré
      apercuOuvert = true;
      try {
        const url = await urlPhoto(lundi);
        if (url) dialogLecturePhoto(lundi, url, surLecture);
      } finally { apercuOuvert = false; }
    }, 'court', { hidden: true })
    : null;
  function montrer(url) {
    retirer.hidden = !url;
    if (lirePhotoIA) lirePhotoIA.hidden = !url;
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
    h('p', { classe: 'aide' }, lirePhotoIA ? AIDE_PHOTO_IA : AIDE_PHOTO_SANS_IA),
    zone,
    h('div', { classe: 'actions' }, h('label', { classe: 'btn btn-court' }, 'Prendre ou importer une photo', entree), lirePhotoIA, retirer),
  ], { classe: 'imp-section-plate imp-photo' });
  urlPhoto(lundi).then((url) => { if (url) { montrer(url); bloc.open = true; } }).catch(() => {});
  return bloc;
}

export function rendre(etat, lundi) {
  const champs = new Map();
  const ouverts = new Map();
  const reprise = reprendreTexte();
  const dates = JOURS_A_MENU.map((decalage) => ajouterJours(lundi, decalage));
  const numero = tableauBlanc(etat, aujourdhui(), lundi).bord.entete.semaine;
  const racine = h('div', { classe: 'vue vue-import vue-menus' });

  racine.appendChild(lien(`#/semaine/${lundi}/tableau`, '‹ Semaine', 'imp-retour'));
  // Changer de semaine : deux flèches de part et d'autre de l'en-tête, comme sur l'écran Semaine.
  racine.appendChild(h('div', { classe: 'bord-semaine-nav imp-semaine-nav' },
    h('a', { href: `#/import/${ajouterJours(lundi, -7)}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine précédente' }, '‹'),
    h('header', { classe: 'imp-tete bord-semaine' },
      h('p', { classe: 'imp-legende' }, [`Semaine ${numero} · du ${libelleJour(lundi)}`, problemeHorsLigne() ? ` · ${problemeHorsLigne()}` : ''].join('')),
      h('h1', { classe: 'page-titre' }, 'Importer les menus')),
    h('a', { href: `#/import/${ajouterJours(lundi, 7)}`, classe: 'btn btn-fleche', 'aria-label': 'Semaine suivante' }, '›')));

  const dejaSaisie = dates.some((date) => [1, 2].some((menu) => jourOuVide(etat, date).menus[menu].intitule.trim() !== ''));
  const zoneLecture = h('div', { classe: 'imp-lecture-jours' });
  const majLecture = () => zoneLecture.replaceChildren(...dates.map((date) => ligneLectureJour(etat, champs, date, ouverts)));
  const repartirEtLire = () => { repartir(champs, lundi, { enregistrerLeLu: () => enregistrerEtNoter() }); majLecture(); };
  // Les lignes de l'IA remplacent le champ de texte puis passent par la même répartition que le bouton ; rien n'est enregistré.
  let lignesIA = null; // lignes lues par l'IA sur cette page : sert au retour d'essai (local, rien n'est envoyé)
  const intitulesDeLaPage = () => Object.fromEntries(dates.map((date) => [date, {
    menu1: String(champs.get(`menu-${date}-1`).value ?? '').replace(/\s+/g, ' ').trim(),
    menu2: String(champs.get(`menu-${date}-2`).value ?? '').replace(/\s+/g, ' ').trim(),
  }]));
  let retourNote = false; // un double clic ne note qu'un retour
  const enregistrerEtNoter = () => {
    const final = intitulesDeLaPage();
    if (!enregistrer(champs, etat, lundi)) return;
    const jours = Object.values(final).filter((j) => j.menu1 !== '' || j.menu2 !== '').length;
    noter('import_enregistre', { jours, aApresIA: lignesIA !== null });
    if (lignesIA && !retourNote) { retourNote = true; noterRetour({ type: 'menu', lu: lignesIA, final }); }
  };
  const signaler = () => panneau({
    titre: 'Signaler un problème de lecture',
    corps: [h('p', { classe: 'aide' }, 'Rien n\'est envoyé : la remarque est gardée sur cet appareil, avec ce que l\'IA a lu et ce qui est dans les champs.'),
      h('label', { pour: 'remarque-lecture', classe: 'saisie-libelle' }, 'Qu\'est-ce qui ne va pas ?'),
      champSaisi(champs, 'textarea', { id: 'remarque-lecture', rows: 4, value: '' })],
    surEnregistrer: () => {
      noterRetour({ type: 'menu', lu: lignesIA, final: intitulesDeLaPage(), remarque: String(champs.get('remarque-lecture').value ?? '').trim() });
      afficherMessage('Retour noté sur cet appareil (Réglages > Apprentissage et essais).', 'ok');
    },
  });
  const lienSignaler = bouton('Signaler un problème de lecture', signaler, 'court', { hidden: true });
  const surLecturePhoto = ({ lignes, illisibles }) => {
    lignesIA = [...lignes];
    lienSignaler.hidden = false;
    const remplace = champs.get('feuille-texte').value.trim() !== '';
    champs.get('feuille-texte').value = lignes.join('\n');
    sectionFeuille.open = true;
    repartirEtLire();
    afficherMessage(`L'IA a lu ${pluriel(lignes.length, 'ligne')}. Relisez « Ce que Sanji a lu » avant d'enregistrer.${remplace ? ' Le texte collé précédemment a été remplacé.' : ''}${illisibles > 0 ? ` ${pluriel(illisibles, 'ligne illisible', 'lignes illisibles')} : complétez à la main.` : ''}`);
  };
  racine.appendChild(blocScanner(lundi, surLecturePhoto));
  racine.appendChild(blocPhoto(lundi, surLecturePhoto));
  racine.appendChild(h('p', { classe: 'aide retour-essai-lien' }, lienSignaler));
  const sectionFeuille = repliable(h('h2', { classe: 'imp-titre-section', id: 'titre-feuille' }, 'Coller le texte de la feuille'), !dejaSaisie || reprise !== null, [
      h('p', { classe: 'aide' }, 'Sur iPhone ou iPad : ouvrez la photo de la feuille, appuyez sur le texte, choisissez « Tout sélectionner » puis « Copier », et collez ici. Les prix, le titre et les annotations sont laissés de côté.'),
      h('label', { pour: 'feuille-texte', classe: 'saisie-libelle' }, 'Texte de la feuille'),
      champSaisi(champs, 'textarea', { id: 'feuille-texte', rows: 6, placeholder: 'texte copié depuis la photo de la feuille', value: '' }),
      h('div', { classe: 'actions' }, bouton('Répartir dans la semaine', repartirEtLire)),
      champSaisi(champs, 'div', { id: 'feuille-retour', classe: 'saisie-retour', 'aria-live': 'polite' }),
    ]);
  racine.appendChild(h('section', { classe: 'imp-section-plate' }, sectionFeuille));

  racine.appendChild(h('h2', { classe: 'imp-titre-section imp-titre-hors' }, 'Ou taper jour par jour'));
  for (const date of dates) racine.appendChild(blocJour(champs, etat, date, { repliable: true }));
  // La lecture suit la frappe ; les champs n'enregistrent rien avant « Enregistrer la semaine ».
  for (const date of dates) for (const menu of [1, 2]) champs.get(`menu-${date}-${menu}`).addEventListener('input', majLecture);

  racine.appendChild(h('section', { classe: 'imp-section-plate imp-lecture', 'aria-labelledby': 'titre-lecture' },
    h('h2', { classe: 'imp-titre-section', id: 'titre-lecture' }, 'Ce que Sanji a lu · vérifie'),
    h('p', { classe: 'aide' }, 'Lecture des intitulés ci-dessus. Corrigez l\'intitulé dans son champ si la lecture est fausse : elle se met à jour.'),
    zoneLecture));
  majLecture();

  racine.appendChild(h('div', { classe: 'barre-enregistrer' },
    lien(`#/semaine/${lundi}/tableau`, 'Annuler', 'btn'),
    bouton('Enregistrer la semaine', enregistrerEtNoter, 'principal')));
  if (reprise !== null) {
    champs.get('feuille-texte').value = reprise.texte;
    repartir(champs, lundi, { deplaceeDepuis: reprise.depuis });
    majLecture();
  }
  return racine;
}
