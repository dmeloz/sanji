// Menus de la semaine : les dix intitulés (et les prévisions) saisis en une fois, sans étape de validation.
// La page ne se redessine pas pendant la frappe : rien ne change dans l'état avant « Enregistrer la semaine ».

import { saisirMenusSemaine } from '../domaine/actions.js';
import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { analyserFeuille, repartirSurSemaine } from '../domaine/feuille.js';
import { agir } from '../magasin.js';
import { h } from './dom.js';
import { bouton, encadre, lien, repliable } from './elements.js';
import { parseEntier } from './format.js';
import { afficherMessage } from './messages.js';

const JOURS_A_MENU = [0, 1, 2, 3, 4]; // lundi à vendredi

export function titre() { return 'Menus de la semaine'; }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Crée un champ de saisie et le range dans la table des champs, sous son identifiant. */
function champSaisi(champs, balise, attributs) {
  const el = h(balise, attributs);
  champs.set(attributs.id, el);
  return el;
}

/** Un champ de menu et sa prévision, pour un jour et un numéro de menu. */
function blocMenu(champs, date, menu, jour) {
  const idMenu = `menu-${date}-${menu}`;
  const idPrevision = `prevision-${date}-${menu}`;
  const prevision = jour.previsions[menu].portions;
  return h('div', { classe: 'saisie-menu' },
    h('label', { pour: idMenu, classe: 'saisie-libelle' }, `Menu ${menu}`),
    champSaisi(champs, 'textarea', { id: idMenu, rows: 3, placeholder: 'intitulé du menu', autocapitalize: 'sentences',
      'aria-label': `${majuscule(libelleJour(date))}, intitulé du menu ${menu}`, value: jour.menus[menu].intitule }),
    h('div', { classe: 'saisie-prevision' },
      h('label', { pour: idPrevision }, 'Portions prévues, hors groupes'),
      champSaisi(champs, 'input', { id: idPrevision, type: 'text', inputmode: 'numeric', autocomplete: 'off', classe: 'champ-court',
        'aria-label': `${majuscule(libelleJour(date))}, menu ${menu} : portions prévues, hors groupes`,
        value: Number.isFinite(prevision) ? String(prevision) : '' })));
}

function blocJour(champs, etat, date) {
  const jour = jourOuVide(etat, date);
  return h('section', { classe: 'carte saisie-jour', 'aria-label': libelleJour(date) },
    h('h2', { classe: 'feutre saisie-jour-titre' }, majuscule(libelleJour(date))),
    blocMenu(champs, date, 1, jour),
    blocMenu(champs, date, 2, jour));
}

/** Remplit les champs à partir du texte collé. N'enregistre rien. */
function repartir(champs, lundi) {
  const retour = champs.get('feuille-retour');
  const analyse = analyserFeuille(champs.get('feuille-texte').value);
  const { saisie, avertissements } = repartirSurSemaine(analyse, lundi);
  const jours = Object.keys(saisie);
  for (const date of jours) {
    champs.get(`menu-${date}-1`).value = saisie[date].menu1;
    champs.get(`menu-${date}-2`).value = saisie[date].menu2;
  }
  const messages = [];
  if (jours.length > 0) {
    messages.push(encadre('info', `${jours.length} jour${jours.length > 1 ? 's' : ''} rempli${jours.length > 1 ? 's' : ''}. `
      + 'Relisez les intitulés, puis enregistrez la semaine.'));
  }
  for (const texte of avertissements) messages.push(encadre('alerte', texte));
  if (analyse.ignorees.length > 0) {
    messages.push(h('p', { classe: 'aide' }, `Lignes laissées de côté (prix, titre, annotations) : ${analyse.ignorees.join(' ; ')}`));
  }
  if (jours.length === 0 && avertissements.length === 0) messages.push(encadre('alerte', 'Aucun menu reconnu dans ce texte.'));
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

function enregistrer(champs, etat, lundi) {
  let saisie;
  try {
    saisie = lireSaisie(champs, etat, lundi);
  } catch (erreur) {
    afficherMessage(erreur.message, 'erreur');
    return;
  }
  const resultat = agir((copie, heure) => saisirMenusSemaine(copie, lundi, saisie, heure));
  if (resultat.ok) {
    afficherMessage('Semaine enregistrée.', 'info');
    location.hash = `#/tableau/${lundi}`;
  }
}

export function rendre(etat, lundi) {
  const champs = new Map();
  const racine = h('div', { classe: 'vue vue-menus' });
  racine.appendChild(h('h1', { classe: 'page-titre' }, `Menus de la semaine du ${libelleJour(lundi)}`));
  racine.appendChild(h('nav', { classe: 'nav-periode', 'aria-label': 'Semaine' },
    lien(`#/menus/${ajouterJours(lundi, -7)}`, '‹ Semaine précédente', 'btn'),
    lien(`#/menus/${ajouterJours(lundi, 7)}`, 'Semaine suivante ›', 'btn')));

  // La semaine a déjà des menus : le collage est replié, on vient surtout corriger un intitulé ou saisir des prévisions.
  const dejaSaisie = JOURS_A_MENU.some((decalage) => {
    const jour = jourOuVide(etat, ajouterJours(lundi, decalage));
    return [1, 2].some((menu) => jour.menus[menu].intitule.trim() !== '');
  });
  racine.appendChild(h('section', { classe: 'carte' },
    repliable(h('h2', { classe: 'section-titre', id: 'titre-feuille' }, 'Coller le texte de la feuille'), !dejaSaisie, [
      h('p', { classe: 'aide' }, 'Sur iPhone ou iPad : ouvrez la photo de la feuille, appuyez sur le texte, choisissez « Tout sélectionner » puis « Copier », et collez ici. Les prix, le titre et les annotations sont laissés de côté.'),
      h('label', { pour: 'feuille-texte', classe: 'saisie-libelle' }, 'Texte de la feuille'),
      champSaisi(champs, 'textarea', { id: 'feuille-texte', rows: 6, placeholder: 'texte copié depuis la photo de la feuille', value: '' }),
      h('div', { classe: 'actions' }, bouton('Répartir dans la semaine', () => repartir(champs, lundi))),
      champSaisi(champs, 'div', { id: 'feuille-retour', classe: 'saisie-retour', 'aria-live': 'polite' }),
    ])));

  for (const decalage of JOURS_A_MENU) racine.appendChild(blocJour(champs, etat, ajouterJours(lundi, decalage)));

  racine.appendChild(h('div', { classe: 'barre-enregistrer' },
    lien(`#/tableau/${lundi}`, 'Annuler', 'btn'),
    bouton('Enregistrer la semaine', () => enregistrer(champs, etat, lundi), 'principal')));
  return racine;
}
