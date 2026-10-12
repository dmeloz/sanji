// Morceaux de la saisie des menus de la semaine, réutilisés par l'écran Import (vue-import.js).
// Les dix intitulés (et les prévisions) saisis en une fois, sans étape de validation.
// La page ne se redessine pas pendant la frappe : rien ne change dans l'état avant « Enregistrer la semaine ».

import { saisirMenusSemaine } from '../domaine/actions.js';
import { ajouterJours, libelleJour } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { analyserFeuille, repartirSurSemaine } from '../domaine/feuille.js';
import { ignorerLigne, oublierLigne } from '../domaine/actions-mots.js';
import { agir, etat as etatActuel } from '../magasin.js';
import { champs as construireChamps } from './champs.js';
import { h } from './dom.js';
import { bouton, encadre, pastille } from './elements.js';
import { parseEntier, pluriel } from './format.js';
import { noter } from './journal-diagnostic.js';
import { afficherMessage } from './messages.js';
import { confirmer, panneau } from './panneau.js';

export const JOURS_A_MENU = [0, 1, 2, 3, 4]; // lundi à vendredi

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

/** Un jour de saisie : ses deux menus, toujours visibles (rien n'est caché derrière un bouton). */
export function blocJour(champs, etat, date) {
  const jour = jourOuVide(etat, date);
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

/**
 * Geste sur une ligne : l'écarter ou la remettre pour toutes les semaines. L'état change, la page est redessinée (le routeur la
 * refait) : le texte collé est donc repris tel quel et réparti à nouveau, rien n'est enregistré dans la semaine.
 */
function apprendreLigne(champs, lundi, fonction) {
  // Les intitulés et portions tapés à la main sont repris aussi : la saisie gagne sur la répartition (vue-import.js).
  const valeurs = Object.fromEntries([...champs].filter(([k]) => /^(menu|prevision)-/.test(k)).map(([k, c]) => [k, c.value]));
  texteAReprendre = { texte: champs.get('feuille-texte').value, depuis: null, valeurs };
  if (!agir(fonction).ok) texteAReprendre = null;
}

/** Remplit les champs à partir du texte collé. N'enregistre rien. `deplaceeDepuis` : le lundi de l'écran où il a été collé. */
export function repartir(champs, lundi, { deplaceeDepuis = null, enregistrerLeLu = null } = {}) {
  const retour = champs.get('feuille-retour');
  const analyse = analyserFeuille(champs.get('feuille-texte').value, etatActuel()?.lignes_ignorees);
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
  // Un jour douteux garde ses lignes visibles (rien n'y est réparti) ; les autres jours sont remplis.
  for (const jour of analyse.aVerifier) {
    messages.push(h('p', { classe: 'aide' }, `${jour.libelle} : lignes lues, à placer à la main dans les menus du jour.`),
      jour.plats.length === 0 ? null : h('ul', { classe: 'liste-simple lignes-ecartees' }, jour.plats.map((ligne) => h('li', null,
        h('span', null, ligne),
        bouton('Pas un plat, l\'ignorer à l\'avenir', () => confirmer({
          titre: 'Écarter cette ligne ?',
          texte: 'Cette ligne sera écartée pour toutes les semaines. Vous pourrez la remettre ou l\'oublier dans Réglages > Apprentissage.',
          libelleOk: 'Oui',
          action: () => apprendreLigne(champs, lundi, (e, t) => ignorerLigne(e, ligne, t)),
        }), 'court',
          { 'aria-label': `Pas un plat, l'ignorer à l'avenir : ${ligne}` })))));
  }
  if (analyse.apprises.length > 0) {
    messages.push(encadre('info', `${pluriel(analyse.apprises.length, 'ligne écartée apprise', 'lignes écartées apprises')} : voir ci-dessous.`));
  }
  if (analyse.ignorees.length > 0) {
    messages.push(h('p', { classe: 'aide' }, 'Lignes laissées de côté (prix, titre, annotations). Une ligne utile peut être remise dans un menu :'),
      h('ul', { classe: 'liste-simple lignes-ecartees' }, analyse.ignorees.map((ligne) => (analyse.apprises.includes(ligne)
        ? h('li', null, h('span', null, ligne), pastille('écartée', 'gris'),
          bouton('Remettre', () => apprendreLigne(champs, lundi, (e, t) => oublierLigne(e, ligne, t)), 'court', { 'aria-label': `Remettre la ligne écartée : ${ligne}` }))
        : h('li', null,
          h('span', null, ligne),
          bouton('Ajouter à un menu', () => dialogRestaurer(champs, lundi, ligne), 'court', { 'aria-label': `Ajouter « ${ligne} » à un menu` }))))));
  }
  if (analyse.nonComprises.length > 0) messages.push(zoneLue(champs, lundi, saisie, analyse.nonComprises, enregistrerLeLu));
  if (jours.length === 0 && avertissements.length === 0) messages.push(encadre('alerte', 'Aucun menu reconnu dans ce texte.'));
  // Diagnostic local : un texte collé qui ne donne aucun jour garde son contenu (borné) pour comprendre pourquoi ; jamais envoyé seul.
  if (jours.length === 0) noter('import_texte', { jours: 0, ignorees: analyse.ignorees.length, nonComprises: analyse.nonComprises.length, contenu: champs.get('feuille-texte').value });
  retour.replaceChildren(...messages.filter(Boolean));
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

/** `destination` : adresse où aller après l'enregistrement (par défaut le tableau de la semaine). */
export function enregistrer(champs, etat, lundi, destination = `#/semaine/${lundi}/tableau`) {
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
    location.hash = destination;
  }
  return Boolean(resultat.ok);
}
