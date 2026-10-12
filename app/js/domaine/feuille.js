// Analyse du texte collé d'une feuille de menus de la semaine (logique pure, sans DOM).
// Rien n'est deviné : en cas de doute, la fonction renvoie un avertissement et laisse les champs vides.

import { ajouterJours, joursEntre, jourSemaine } from './dates.js';
import { cleLigne } from './lignes-ignorees.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre',
  'novembre', 'decembre'];

const MOIS_ACCENTUES = { fevrier: 'février', aout: 'août', decembre: 'décembre' };
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// « lundi 05 octobre », « Mardi 1er juin 2026 » : jour, numéro, mois facultatif, année facultative.
const MOTIF_DATE = new RegExp(
  `(?:^|[^a-z])(${JOURS.join('|')})\\s+(\\d{1,2})(?:er)?(?:\\s*(${MOIS.join('|')}))?(?:\\s+\\d{4})?(?![a-z])`, 'i');

// Prix en fin ou en début de ligne : « 19.- », « 24.– », « CHF 19.50 », « 21 fr. ».
const PRIX = '(?:chf\\s*)?\\d{1,3}(?:[.,]\\d{1,2})?\\s*(?:\\.?\\s*[-–—]+|chf|fr\\.?|francs?)';
// Un prix décimal sans devise (« 19.50 », « 24,50 ») compte aussi : il n'a pas sa place dans un intitulé.
const PRIX_DECIMAL = '\\d{1,3}[.,]\\d{2}';
const MOTIF_PRIX_SEUL = new RegExp(`^(?:(?:${PRIX}|${PRIX_DECIMAL})\\s*)+$`, 'i');
const MOTIF_PRIX_FIN = new RegExp(`\\s+(?:${PRIX}|${PRIX_DECIMAL})\\s*$`, 'i');
// Étiquette de rang : « Menu 1 », « Menu 2 19.50 » : ce n'est pas un plat.
const MOTIF_ETIQUETTE = new RegExp(`^menus?\\s*\\d+\\s*[:.\\-–]?\\s*(?:(?:${PRIX}|${PRIX_DECIMAL})\\s*)*$`, 'i');
// Formules de politesse ou de service en pied de feuille.
const MOTIF_POLITESSE = /^(?:bon appetit|bonne (?:degustation|journee)|merci|a votre service|sur place|a emporter)\b/;
// Nom de l'établissement : seulement en toute première ligne, en capitales ou précédé d'un mot d'enseigne.
const MOTIF_ENSEIGNE = /^(?:restaurant|brasserie|bistrot|bistro|cafe|auberge|hotel|chez)\b/;
function estEnseigne(ligne) {
  if (MOTIF_ENSEIGNE.test(sansAccent(ligne))) return true;
  const lettres = (ligne.match(/\p{L}/gu) ?? []).length;
  return lettres >= 3 && !/\p{Ll}/u.test(ligne) && !ligne.includes(',') && ligne.split(' ').length <= 5;
}

// Titre de la feuille : « Menu du marché », « Menus de la semaine »…, avec son sous-titre de service facultatif :
// « (à midi uniquement) », « / A midi uniquement », « [midi uniquement] ».
const MOTIF_TITRE = /^menus?\s+(?:du|de la|de|des)\s+\S+(?:\s+\S+)?(?:\s*[(/[–-]?\s*(?:[aà]\s+)?(?:midi|soir)\b[^)\]]*[)\]]?)?$/i;

/** Sous-titre de service entre parenthèses (« (À midi uniquement) ») : court, jamais un plat. */
const MOTIF_SOUS_TITRE = /^[(\[][^)\]]{1,40}[)\]]$/;

/** Une annotation manuscrite ou un reste de lecture : trop court, ou un nombre suivi de peu de chose. */
function estAnnotation(ligne) {
  const lettres = (ligne.match(/\p{L}/gu) ?? []).length;
  if (lettres < 3) return true;
  if (/^\d/.test(ligne) && !ligne.includes(',') && ligne.length <= 14) return true;
  return false;
}

/**
 * Découpe le texte collé d'une feuille de menus.
 * Chaque ligne de plat va au dernier jour rencontré. Si un plat précède le premier jour (date écrite entre ou après les plats),
 * la répartition est l'ancienne : deux par jour dans l'ordre, ou rien. Sinon, un jour qui a
 * exactement deux plats est réparti (le premier est le menu 1, le second le menu 2) ; un autre nombre n'est pas réparti :
 * le jour est signalé (`avertissements`, `aVerifier` avec ses lignes) sans gêner les autres. Un même jour deux fois bloque tout.
 * @param {string} texte
 * @param {object|null} [lignesIgnorees] `etat.lignes_ignorees` : une ligne apprise est écartée (listée dans `ignorees` et `apprises`)
 * @returns {{jours:{jourSemaine:number, numero:number, mois:number|null, menu1:string, menu2:string}[],
 *   lignes:string[], ignorees:string[], apprises:string[], nonComprises:string[], avertissements:string[],
 *   aVerifier:{jourSemaine:number, libelle:string, plats:string[]}[]}}
 */
export function analyserFeuille(texte, lignesIgnorees = null) {
  const jours = [];
  const lignes = [];
  const ignorees = [];
  const apprises = []; // sous-ensemble de `ignorees` : lignes que la propriétaire a écartées (`lignesIgnorees`), à garder visibles
  const nonComprises = []; // sous-ensemble de `ignorees` : annotations et restes que rien ne reconnaît (ni prix, ni titre, ni enseigne)
  const avertissements = [];
  const aVerifier = [];
  const platsDuJour = []; // platsDuJour[i] : les lignes de plat rangées sous jours[i]
  let platAvantJour = false;
  let premiere = true;
  for (const brute of String(texte ?? '').split(/\r?\n/)) {
    // Forme composée (NFC) : une lettre accentuée compte pour un caractère, comme dans le texte sans accent.
    let ligne = brute.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (ligne === '') continue;
    const estPremiere = premiere;
    premiere = false;
    const date = MOTIF_DATE.exec(sansAccent(ligne));
    if (!date && estPremiere && estEnseigne(ligne)) { ignorees.push(ligne); continue; }
    if (date) {
      const debut = date.index + date[0].length - date[0].replace(/^[^a-z]/i, '').length;
      const longueur = date[0].replace(/^[^a-z]/i, '').length;
      jours.push({
        jourSemaine: JOURS.indexOf(date[1].toLowerCase()) + 1,
        numero: Number(date[2]),
        mois: date[3] ? MOIS.indexOf(date[3].toLowerCase()) + 1 : null,
        menu1: '', menu2: '',
      });
      platsDuJour.push([]);
      // La date peut être collée à une ligne de plat : on garde le reste de la ligne.
      ligne = `${ligne.slice(0, debut)} ${ligne.slice(debut + longueur)}`.replace(/\s+/g, ' ').trim();
      if (ligne === '') continue;
    }
    // Une ligne imprimée ne commence pas par « + », « = » ou une flèche : c'est une annotation.
    if (/^[+=→>]/.test(ligne)) { ignorees.push(ligne); nonComprises.push(ligne); continue; }
    if (MOTIF_SOUS_TITRE.test(ligne)) { ignorees.push(ligne); continue; } // avant le retrait des marques : la parenthèse en tête en est une
    // Coche, puce ou tiret en tête de ligne : on retire la marque, on garde le texte.
    ligne = ligne.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    if (ligne === '') continue;
    if (MOTIF_PRIX_SEUL.test(ligne) || MOTIF_ETIQUETTE.test(ligne) || MOTIF_POLITESSE.test(sansAccent(ligne))) {
      ignorees.push(ligne);
      continue;
    }
    while (MOTIF_PRIX_FIN.test(ligne)) ligne = ligne.replace(MOTIF_PRIX_FIN, '').trim();
    if (MOTIF_TITRE.test(ligne)) { ignorees.push(ligne); continue; }
    if (estAnnotation(ligne)) { ignorees.push(ligne); nonComprises.push(ligne); continue; }
    if (lignesIgnorees && Object.hasOwn(lignesIgnorees, cleLigne(ligne))) { ignorees.push(ligne); apprises.push(ligne); continue; }
    lignes.push(ligne);
    if (jours.length === 0) platAvantJour = true; else platsDuJour[jours.length - 1].push(ligne);
  }
  if (jours.length === 0) {
    avertissements.push('Aucun jour reconnu dans le texte : écrivez les jours sous la forme « lundi 5 octobre ».');
    return { jours, lignes, ignorees, nonComprises, apprises, avertissements, aVerifier };
  }
  const repetes = jours.map((j) => j.jourSemaine).filter((j, i, tous) => tous.indexOf(j) !== i);
  if (repetes.length > 0) {
    avertissements.push('Un même jour apparaît deux fois dans le texte : les menus ne sont pas répartis.');
    return { jours, lignes, ignorees, nonComprises, apprises, avertissements, aVerifier };
  }
  if (platAvantJour) {
    // La date est écrite entre ou après les plats : le rangement par jour n'est plus possible, on répartit deux par deux
    // dans l'ordre (comportement historique), ou tout est signalé.
    if (lignes.length !== jours.length * 2) {
      avertissements.push(`${jours.length} jour(s) reconnu(s) mais ${lignes.length} ligne(s) de menu : il en faut deux par jour. `
        + 'Les menus ne sont pas répartis ; placez les lignes à la main.');
      return { jours, lignes, ignorees, nonComprises, apprises, avertissements, aVerifier };
    }
    jours.forEach((jour, i) => { jour.menu1 = lignes[2 * i]; jour.menu2 = lignes[2 * i + 1]; });
    return { jours, lignes, ignorees, nonComprises, apprises, avertissements, aVerifier };
  }
  jours.forEach((jour, i) => {
    const plats = platsDuJour[i];
    if (plats.length === 2) { [jour.menu1, jour.menu2] = plats; return; }
    if (jour.jourSemaine > 5 && plats.length === 0) return;
    const libelle = `${majuscule(JOURS[jour.jourSemaine - 1])} ${jour.numero}${jour.mois ? ` ${MOIS_ACCENTUES[MOIS[jour.mois - 1]] ?? MOIS[jour.mois - 1]}` : ''}`;
    aVerifier.push({ jourSemaine: jour.jourSemaine, libelle, plats });
    avertissements.push(`${libelle} : ${plats.length} ligne${plats.length > 1 ? 's' : ''} de menu au lieu de 2, à placer à la main.`);
  });
  return { jours, lignes, ignorees, nonComprises, apprises, avertissements, aVerifier };
}

/**
 * La date la plus proche de la semaine affichée dont le jour de la semaine, le quantième et (s'il est écrit) le mois
 * correspondent à ce que dit la feuille ; null si la feuille se trompe (« mercredi 8 » quand le 8 est un jeudi).
 */
function dateDuJour({ jourSemaine: js, numero, mois }, lundiAffiche) {
  let meilleure = null;
  for (let d = -366; d <= 366; d += 1) {
    const date = ajouterJours(lundiAffiche, d);
    if (Number(date.slice(8)) !== numero || jourSemaine(date) !== js) continue;
    if (mois !== null && Number(date.slice(5, 7)) !== mois) continue;
    if (meilleure === null || Math.abs(d) < Math.abs(meilleure.d)) meilleure = { date, d };
  }
  return meilleure?.date ?? null;
}

/**
 * La semaine que décrivent les dates de la feuille : chaque jour dont la date est possible vote pour son lundi ; le lundi
 * le plus voté l'emporte (à égalité, le plus proche de la semaine affichée). Un jour impossible ne vote pas.
 * @param {ReturnType<typeof analyserFeuille>} analyse
 * @param {string} lundiAffiche AAAA-MM-JJ
 * @returns {{lundi:string, accord:number, total:number}|null} accord = nombre de jours d'accord, total = jours lus
 */
export function semaineDetectee(analyse, lundiAffiche) {
  const votes = new Map();
  for (const jour of analyse.jours) {
    const date = dateDuJour(jour, lundiAffiche);
    if (date === null) continue;
    const lundi = ajouterJours(date, 1 - jour.jourSemaine);
    votes.set(lundi, (votes.get(lundi) ?? 0) + 1);
  }
  const ecart = (lundi) => Math.abs(joursEntre(lundiAffiche, lundi));
  const [gagnant] = [...votes.entries()].sort((a, b) => b[1] - a[1] || ecart(a[0]) - ecart(b[0]));
  return gagnant ? { lundi: gagnant[0], accord: gagnant[1], total: analyse.jours.length } : null;
}

/**
 * Place le résultat de `analyserFeuille` sur les dates d'une semaine (lundi à vendredi).
 * Une date fausse sur une feuille qui est bien celle de la semaine est corrigée (le plat reste sous son jour de la
 * semaine) et rendue dans `corrections` ; si la feuille semble d'une autre semaine, la date reste un avertissement et
 * `semaine` donne la semaine détectée, que l'écran peut proposer.
 * @param {ReturnType<typeof analyserFeuille>} analyse
 * @param {string} lundi date du lundi, AAAA-MM-JJ
 * @returns {{saisie:Object<string,{menu1:string, menu2:string}>, avertissements:string[],
 *   corrections:{jourSemaine:number, imprime:number, corrige:number}[], semaine:{lundi:string, accord:number, total:number}|null}}
 */
export function repartirSurSemaine(analyse, lundi) {
  if (jourSemaine(lundi) !== 1) throw new Error('La semaine doit commencer un lundi.');
  const saisie = {};
  const avertissements = [...analyse.avertissements];
  const corrections = [];
  const semaine = semaineDetectee(analyse, lundi);
  const bonneSemaine = semaine?.lundi === lundi;
  for (const jour of analyse.jours) {
    if (jour.jourSemaine > 5) {
      if (jour.menu1 || jour.menu2) avertissements.push('Pas de menu du jour le samedi ni le dimanche : ce jour est ignoré.');
      continue;
    }
    if (!jour.menu1 && !jour.menu2) continue;
    const date = ajouterJours(lundi, jour.jourSemaine - 1);
    const numeroAttendu = Number(date.slice(8));
    const moisAttendu = Number(date.slice(5, 7));
    if (jour.numero !== numeroAttendu || (jour.mois !== null && jour.mois !== moisAttendu)) {
      if (bonneSemaine) {
        corrections.push({ jourSemaine: jour.jourSemaine, imprime: jour.numero, corrige: numeroAttendu });
      } else {
        avertissements.push(`La feuille indique le ${jour.numero} pour ${JOURS[jour.jourSemaine - 1]}, `
          + `la semaine affichée donne le ${numeroAttendu} : vérifiez que c'est la bonne semaine.`);
      }
    }
    saisie[date] = { menu1: jour.menu1, menu2: jour.menu2 };
  }
  return { saisie, avertissements, corrections, semaine };
}
