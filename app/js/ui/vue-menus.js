// Menus de la semaine (ancienne page, toujours disponible par `rendre`) ; ses morceaux sont réutilisés par l'écran Import (vue-import.js).
// Les dix intitulés (et les prévisions) saisis en une fois, sans étape de validation.
// La page ne se redessine pas pendant la frappe : rien ne change dans l'état avant « Enregistrer la semaine ».

import { saisirMenusSemaine } from '../domaine/actions.js';
import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { analyserFeuille, repartirSurSemaine } from '../domaine/feuille.js';
import { agir } from '../magasin.js';
import { champs as construireChamps } from './champs.js';
import { h } from './dom.js';
import { bouton, encadre, lien, pastille, repliable } from './elements.js';
import { parseEntier, pluriel } from './format.js';
import { noter } from './journal-diagnostic.js';
import { afficherMessage } from './messages.js';
import { panneau } from './panneau.js';

export const JOURS_A_MENU = [0, 1, 2, 3, 4]; // lundi à vendredi

export function titre() { return 'Menus de la semaine'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Crée un champ de saisie et le range dans la table des champs, sous son identifiant. */
export function champSaisi(champs, balise, attributs) {
  const el = h(balise, attributs);
  champs.set(attributs.id, el);
  return el;
}

/** Adapte la hauteur d'un champ à son contenu (sans effet là où la mise en page n'existe pas, comme sous faux DOM). */
function ajuster(el) {
  if (!el.style) return;
  el.style.height = 'auto';
  if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
}

/** Champ d'intitulé : une ligne au départ, qui s'agrandit avec le texte. */
function champIntitule(champs, attributs) {
  const el = champSaisi(champs, 'textarea', attributs);
  el.addEventListener('input', () => ajuster(el));
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => ajuster(el));
  return el;
}

/** Un champ de menu et sa prévision, pour un jour et un numéro de menu. */
function blocMenu(champs, date, menu, jour) {
  const idMenu = `menu-${date}-${menu}`;
  const idPrevision = `prevision-${date}-${menu}`;
  const prevision = jour.previsions[menu].portions;
  return h('div', { classe: 'saisie-menu' },
    h('label', { pour: idMenu, classe: 'saisie-libelle' }, `Menu ${menu}`),
    champIntitule(champs, { id: idMenu, rows: 1, classe: 'champ-intitule', placeholder: 'intitulé du menu', autocapitalize: 'sentences',
      'aria-label': `${majuscule(libelleJour(date))}, intitulé du menu ${menu}`, value: jour.menus[menu].intitule }),
    h('div', { classe: 'saisie-prevision' },
      h('label', { pour: idPrevision }, 'Portions prévues, hors groupes'),
      champSaisi(champs, 'input', { id: idPrevision, type: 'text', inputmode: 'numeric', autocomplete: 'off', classe: 'champ-court',
        'aria-label': `${majuscule(libelleJour(date))}, menu ${menu} : portions prévues, hors groupes`,
        value: Number.isFinite(prevision) ? String(prevision) : '' })));
}

/**
 * Un jour de saisie. Avec `options.repliable` (écran Import) : un jour déjà rempli est replié sur son résumé (les deux
 * intitulés), un jour vide reste ouvert ; tous les jours restent des lignes visibles, rien n'est caché derrière un bouton.
 */
export function blocJour(champs, etat, date, options = {}) {
  const jour = jourOuVide(etat, date);
  if (options.repliable) {
    const intitules = [1, 2].map((m) => String(jour.menus[m].intitule ?? '').replace(/\s+/g, ' ').trim());
    const rempli = intitules.some(Boolean);
    const resume = rempli ? intitules.map((t, i) => (t ? `Menu ${i + 1} : ${t}` : null)).filter(Boolean).join(' · ') : 'à saisir';
    return h('details', { classe: 'carte saisie-jour saisie-jour-repliable', open: !rempli },
      h('summary', { classe: 'saisie-jour-resume' },
        h('span', { classe: 'saisie-jour-titre' }, majuscule(libelleJour(date))),
        h('span', { classe: 'saisie-jour-extrait' }, resume)),
      blocMenu(champs, date, 1, jour),
      blocMenu(champs, date, 2, jour));
  }
  return h('section', { classe: 'carte saisie-jour', 'aria-label': libelleJour(date) },
    h('h2', { classe: 'feutre saisie-jour-titre' }, majuscule(libelleJour(date))),
    blocMenu(champs, date, 1, jour),
    blocMenu(champs, date, 2, jour));
}

/** Remet une ligne laissée de côté dans l'intitulé d'un menu choisi (dans le champ seulement : rien n'est enregistré). */
function dialogRestaurer(champs, lundi, ligne) {
  const options = JOURS_A_MENU.flatMap((decalage) => [1, 2].map((menu) => {
    const date = ajouterJours(lundi, decalage);
    return [`menu-${date}-${menu}`, `${majuscule(libelleJour(date))}, menu ${menu}`];
  }));
  const f = construireChamps([{ cle: 'cible', type: 'choix', libelle: 'Ajouter à', options, valeur: options[0][0] }]);
  panneau({
    titre: `Ajouter « ${ligne} » à un menu`,
    corps: [h('p', { classe: 'aide' }, 'La ligne est ajoutée à la fin de l\'intitulé, dans le champ. Relisez-le, puis enregistrez la semaine.'), ...f.noeuds],
    libelleEnregistrer: 'Ajouter',
    surEnregistrer: () => {
      const champ = champs.get(f.valeur('cible'));
      champ.value = champ.value.trim() === '' ? ligne : `${champ.value.trim()}, ${ligne}`;
    },
  });
}

// Au moins trois jours dont la date est possible et qui désignent la même autre semaine : le texte est ouvert à sa place.
const JOURS_D_ACCORD = 3;
// Le texte collé sur une autre semaine suit la propriétaire d'un écran à l'autre (rien n'est enregistré).
let texteAReprendre = null;

/** Le texte à reprendre sur l'écran qui s'ouvre, une seule fois : { texte, depuis } ou null. */
export function reprendreTexte() {
  const reprise = texteAReprendre;
  texteAReprendre = null;
  return reprise;
}

/** G4 : ce que Sanji a lu quand des lignes ne sont pas comprises. Rien n'est deviné, rien de ces lignes n'est enregistré. */
function zoneLue(champs, lundi, saisie, nonComprises, enregistrerLeLu) {
  const etatJour = (date) => {
    const n = [saisie[date]?.menu1, saisie[date]?.menu2].filter(Boolean).length;
    return n === 2 ? '2 menus · lu' : n === 1 ? '1 à vérifier' : 'non saisi';
  };
  return h('section', { classe: 'zone-lue', 'aria-label': 'Ce que Sanji a lu' },
    h('h3', { classe: 'section-titre' }, 'Ce que Sanji a lu'),
    h('div', { classe: 'encadre encadre-alerte' },
      h('p', null, pastille(pluriel(nonComprises.length, 'ligne non comprise', 'lignes non comprises'), 'ambre')),
      h('ul', { classe: 'liste-simple' }, nonComprises.map((ligne) => h('li', null, `« ${ligne} »`))),
      h('p', { classe: 'aide' }, 'Rien n\'est deviné : ces lignes ne sont pas enregistrées.')),
    h('ul', { classe: 'liste-simple' }, JOURS_A_MENU.map((decalage) => {
      const date = ajouterJours(lundi, decalage);
      return h('li', null, h('strong', null, majuscule(libelleJour(date).split(' ')[0])), ` : ${etatJour(date)}`);
    })),
    h('div', { classe: 'actions' },
      bouton('Corriger le texte', () => champs.get('feuille-texte').focus?.()),
      enregistrerLeLu ? bouton('Enregistrer le lu', enregistrerLeLu, 'principal') : null));
}

/** Remplit les champs à partir du texte collé. N'enregistre rien. `deplaceeDepuis` : le lundi de l'écran où il a été collé. */
export function repartir(champs, lundi, { deplaceeDepuis = null, enregistrerLeLu = null } = {}) {
  const retour = champs.get('feuille-retour');
  const analyse = analyserFeuille(champs.get('feuille-texte').value);
  const { saisie, avertissements, corrections, semaine } = repartirSurSemaine(analyse, lundi);
  if (deplaceeDepuis === null && semaine && semaine.lundi !== lundi && semaine.accord >= JOURS_D_ACCORD) {
    texteAReprendre = { texte: champs.get('feuille-texte').value, depuis: lundi };
    location.hash = `#/import/${semaine.lundi}`;
    return;
  }
  const jours = Object.keys(saisie);
  // Des intitulés déjà écrits qui vont être remplacés dans les champs : on le dit (rien n'est enregistré avant « Enregistrer »).
  const remplaces = jours.filter((date) => [1, 2].some((m) => {
    const actuel = champs.get(`menu-${date}-${m}`).value.trim();
    return actuel !== '' && actuel !== saisie[date][`menu${m}`];
  }));
  for (const date of jours) {
    champs.get(`menu-${date}-1`).value = saisie[date].menu1;
    champs.get(`menu-${date}-2`).value = saisie[date].menu2;
  }
  const messages = [];
  if (deplaceeDepuis !== null) {
    messages.push(encadre('info', `Les dates de ce texte sont celles de la semaine du ${libelleJour(lundi)} : je l'ai ouverte à sa place `
      + `(vous étiez sur la semaine du ${libelleJour(deplaceeDepuis)}). Rien n'est enregistré avant « Enregistrer la semaine ».`));
  }
  if (corrections.length > 0) {
    messages.push(encadre('info', `Dates corrigées : ${corrections.map((c) => `${libelleJour(ajouterJours(lundi, c.jourSemaine - 1))} `
      + `(la feuille disait le ${c.imprime})`).join(', ')}. Les plats restent sous leur jour.`));
  }
  if (jours.length > 0) {
    messages.push(encadre('info', `${jours.length} jour${jours.length > 1 ? 's' : ''} rempli${jours.length > 1 ? 's' : ''}. `
      + 'Relisez les intitulés, puis enregistrez la semaine.'));
  }
  if (remplaces.length > 0) {
    messages.push(encadre('alerte', `Des intitulés déjà écrits ont été remplacés dans les champs (${remplaces.map(libelleJour).join(', ')}). `
      + 'Rien n\'est enregistré avant « Enregistrer la semaine » : « Annuler » garde la semaine telle qu\'elle était.'));
  }
  for (const texte of avertissements) messages.push(encadre('alerte', texte));
  if (analyse.ignorees.length > 0) {
    messages.push(h('p', { classe: 'aide' }, 'Lignes laissées de côté (prix, titre, annotations). Une ligne utile peut être remise dans un menu :'),
      h('ul', { classe: 'liste-simple lignes-ecartees' }, analyse.ignorees.map((ligne) => h('li', null,
        h('span', null, ligne),
        bouton('Ajouter à un menu', () => dialogRestaurer(champs, lundi, ligne), 'court', { 'aria-label': `Ajouter « ${ligne} » à un menu` })))));
  }
  if (analyse.nonComprises.length > 0) messages.push(zoneLue(champs, lundi, saisie, analyse.nonComprises, enregistrerLeLu));
  if (jours.length === 0 && avertissements.length === 0) messages.push(encadre('alerte', 'Aucun menu reconnu dans ce texte.'));
  // Diagnostic local : un texte collé qui ne donne aucun jour garde son contenu (borné) pour comprendre pourquoi ; jamais envoyé seul.
  if (jours.length === 0) noter('import_texte', { jours: 0, ignorees: analyse.ignorees.length, nonComprises: analyse.nonComprises.length, contenu: champs.get('feuille-texte').value });
  retour.replaceChildren(...messages);
}

/** Lit le formulaire et ne transmet que ce qui a changé. */
function lireSaisie(champs, etat, lundi) {
  const saisie = {};
  for (const decalage of JOURS_A_MENU) {
    const date = ajouterJours(lundi, decalage);
    const jour = jourOuVide(etat, date);
    const ligne = {};
    for (const menu of [1, 2]) {
      const texte = String(champs.get(`menu-${date}-${menu}`).value ?? '').replace(/\s+/g, ' ').trim();
      const actuel = jour.menus[menu].intitule;
      // Inchangé : chaîne vide (ne rien changer). Vidé : null (effacer).
      ligne[`menu${menu}`] = texte === actuel ? '' : texte === '' ? null : texte;
      const brut = String(champs.get(`prevision-${date}-${menu}`).value ?? '').trim();
      const actuelle = jour.previsions[menu].portions;
      if (brut === '') ligne[`prevision${menu}`] = null;
      else {
        const valeur = parseEntier(brut, `prévision du menu ${menu}, ${libelleJour(date)}`);
        ligne[`prevision${menu}`] = valeur === actuelle ? null : valeur;
      }
    }
    saisie[date] = ligne;
  }
  return saisie;
}

export function enregistrer(champs, etat, lundi) {
  let saisie;
  try {
    saisie = lireSaisie(champs, etat, lundi);
  } catch (erreur) {
    afficherMessage(erreur.message, 'erreur');
    return false;
  }
  const resultat = agir((copie, heure) => saisirMenusSemaine(copie, lundi, saisie, heure));
  if (resultat.ok) {
    afficherMessage('Semaine enregistrée.', 'info');
    location.hash = `#/semaine/${lundi}/tableau`;
  }
  return Boolean(resultat.ok);
}

export function rendre(etat, lundi) {
  const champs = new Map();
  const reprise = reprendreTexte();
  const racine = h('div', { classe: 'vue vue-menus' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, `Menus de la semaine du ${libelleJour(lundi)}`));
  racine.appendChild(h('nav', { classe: 'nav-periode', 'aria-label': 'Semaine' },
    lien(`#/import/${ajouterJours(lundi, -7)}`, '‹ Semaine précédente', 'btn'),
    lien(`#/import/${ajouterJours(lundi, 7)}`, 'Semaine suivante ›', 'btn')));

  // La semaine a déjà des menus : le collage est replié, on vient surtout corriger un intitulé ou saisir des prévisions.
  const dejaSaisie = JOURS_A_MENU.some((decalage) => {
    const jour = jourOuVide(etat, ajouterJours(lundi, decalage));
    return [1, 2].some((menu) => jour.menus[menu].intitule.trim() !== '');
  });
  racine.appendChild(h('section', { classe: 'imp-section-plate' },
    repliable(h('h2', { classe: 'section-titre', id: 'titre-feuille' }, 'Coller le texte de la feuille'), !dejaSaisie || reprise !== null, [
      h('p', { classe: 'aide' }, 'Sur iPhone ou iPad : ouvrez la photo de la feuille, appuyez sur le texte, choisissez « Tout sélectionner » puis « Copier », et collez ici. Les prix, le titre et les annotations sont laissés de côté.'),
      h('label', { pour: 'feuille-texte', classe: 'saisie-libelle' }, 'Texte de la feuille'),
      champSaisi(champs, 'textarea', { id: 'feuille-texte', rows: 6, placeholder: 'texte copié depuis la photo de la feuille', value: '' }),
      h('div', { classe: 'actions' }, bouton('Répartir dans la semaine', () => repartir(champs, lundi, { enregistrerLeLu: () => enregistrer(champs, etat, lundi) }))),
      champSaisi(champs, 'div', { id: 'feuille-retour', classe: 'saisie-retour', 'aria-live': 'polite' }),
    ])));

  for (const decalage of JOURS_A_MENU) racine.appendChild(blocJour(champs, etat, ajouterJours(lundi, decalage)));

  racine.appendChild(h('div', { classe: 'barre-enregistrer' },
    lien(`#/semaine/${lundi}/tableau`, 'Annuler', 'btn'),
    bouton('Enregistrer la semaine', () => enregistrer(champs, etat, lundi), 'principal')));
  if (reprise !== null) {
    champs.get('feuille-texte').value = reprise.texte;
    repartir(champs, lundi, { deplaceeDepuis: reprise.depuis });
  }
  return racine;
}
