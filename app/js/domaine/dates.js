// Dates au format AAAA-MM-JJ, calculées en UTC pour éviter tout décalage d'heure d'été.
// Aucune fonction ne lit l'heure courante : la date du jour est toujours un argument.

const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
const MS_PAR_JOUR = 86400000;

function analyser(date) {
  const m = typeof date === 'string' ? RE_DATE.exec(date) : null;
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (d.toISOString().slice(0, 10) === date) return d;
  }
  throw new Error(`Date invalide : « ${date} » (format attendu AAAA-MM-JJ).`);
}

/** Vrai si la chaîne est une date AAAA-MM-JJ existante. */
export function estDateValide(date) {
  try { analyser(date); return true; } catch { return false; }
}

/** Ajoute n jours calendaires (n peut être négatif). */
export function ajouterJours(date, n) {
  return new Date(analyser(date).getTime() + n * MS_PAR_JOUR).toISOString().slice(0, 10);
}

/** Jour de la semaine : 1 = lundi … 7 = dimanche. */
export function jourSemaine(date) {
  const j = analyser(date).getUTCDay();
  return j === 0 ? 7 : j;
}

/** Lundi de la semaine qui contient la date. */
export function lundiDe(date) {
  return ajouterJours(date, 1 - jourSemaine(date));
}

/** Nombre de jours calendaires de a à b (b − a), dimanche compté. */
export function joursEntre(a, b) {
  return Math.round((analyser(b).getTime() - analyser(a).getTime()) / MS_PAR_JOUR);
}

/** Le restaurant est fermé le dimanche. */
export function estOuvert(date) {
  return jourSemaine(date) !== 7;
}

/** Jour ouvert suivant (sens 1) ou précédent (sens -1) : le dimanche est sauté. */
export function jourOuvertVoisin(date, sens) {
  const voisin = ajouterJours(date, sens);
  return estOuvert(voisin) ? voisin : ajouterJours(voisin, sens);
}

const SEUIL_GESTE_PX = 60;
const RAPPORT_GESTE_HORIZONTAL = 1.5;
const DUREE_MAX_GESTE_MS = 700; // un geste plus lent n'est pas un feuilletage

/**
 * Jour à ouvrir après un geste horizontal : glisser vers la gauche (dx < 0) = jour ouvert suivant, vers la droite = précédent.
 * Un geste trop court, trop lent (plus de 700 ms) ou plutôt vertical (défilement) ne change rien : null.
 */
export function jourApresGeste(date, dx, dy, seuil = SEUIL_GESTE_PX, dt = 0) {
  if (dt > DUREE_MAX_GESTE_MS) return null;
  if (Math.abs(dx) < seuil || Math.abs(dx) < RAPPORT_GESTE_HORIZONTAL * Math.abs(dy)) return null;
  return jourOuvertVoisin(date, dx < 0 ? 1 : -1);
}

/** Deux menus du jour existent du lundi au vendredi. */
export function aMenuDuJour(date) {
  return jourSemaine(date) <= 5;
}

/** Créneaux de travail du jour : lundi/mardi sans « avant_soir », dimanche aucun. */
export function creneauxDuJour(date) {
  const j = jourSemaine(date);
  if (j === 7) return [];
  if (j <= 2) return ['avant_midi', 'apres_midi'];
  return ['avant_midi', 'apres_midi', 'avant_soir'];
}

/** Créneaux d'un jour de semaine donné (1 à 7), sans date. */
export function creneauxDuJourSemaine(numeroJour) {
  if (numeroJour === 7) return [];
  return numeroJour <= 2 ? ['avant_midi', 'apres_midi'] : ['avant_midi', 'apres_midi', 'avant_soir'];
}

/** Libellé court, par exemple « lundi 5 octobre » (« 1er » pour le premier du mois). */
export function libelleJour(date) {
  const d = analyser(date);
  const jour = d.getUTCDate();
  return `${JOURS[jourSemaine(date) - 1]} ${jour === 1 ? '1er' : jour} ${MOIS[d.getUTCMonth()]}`;
}

/** Les sept dates (lundi à dimanche) de la semaine commençant à ce lundi. */
export function datesDeLaSemaine(lundi) {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ajouterJours(lundi, i));
}
