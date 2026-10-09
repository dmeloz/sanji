// Glissement horizontal pour changer de jour (feuille du jour). Les liens « Jour précédent / suivant » restent.

const DISTANCE_MIN = 80;
const DUREE_MAX_MS = 700;
const CIBLES_DE_SAISIE = 'input, textarea, select, button';
const RAPPORT_HORIZONTAL = 2; // le geste doit être au moins deux fois plus horizontal que vertical

/** @returns {'suivant'|'precedent'|null} Fonction pure : décide si un geste est un feuilletage. */
export function directionDuGeste({ dx, dy, dt }) {
  if (Math.abs(dx) < DISTANCE_MIN || dt > DUREE_MAX_MS) return null;
  if (Math.abs(dx) < RAPPORT_HORIZONTAL * Math.abs(dy)) return null;
  return dx < 0 ? 'suivant' : 'precedent';
}

/**
 * Branche le geste sur un élément (`decider` : règle du geste, `directionDuGeste` par défaut). Après un geste reconnu, les clics sont ignorés un instant (un doigt qui glisse
 * ne doit pas cocher ou ouvrir ce qu'il survole).
 */
export function activerGlisser(element, { suivant, precedent, decider = directionDuGeste }) {
  let depart = null;
  let bloqueJusqua = 0;
  element.addEventListener('touchstart', (e) => {
    const t = e.touches?.[0];
    // Un geste qui commence sur un champ ou un bouton est une saisie (sélection de texte, curseur) : jamais un feuilletage.
    depart = t && !e.target?.closest?.(CIBLES_DE_SAISIE) ? { x: t.clientX, y: t.clientY, h: Date.now() } : null;
  }, { passive: true });
  element.addEventListener('touchend', (e) => {
    const t = e.changedTouches?.[0];
    if (!depart || !t) return;
    const sens = decider({ dx: t.clientX - depart.x, dy: t.clientY - depart.y, dt: Date.now() - depart.h });
    depart = null;
    if (!sens) return;
    bloqueJusqua = Date.now() + 350;
    (sens === 'suivant' ? suivant : precedent)();
  }, { passive: true });
  element.addEventListener('click', (e) => {
    if (Date.now() < bloqueJusqua) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

// ---------------------------------------------------------------- fermer une feuille vers le bas

const SEUIL_FERMETURE_PX = 80;
const DISTANCE_RAPIDE_MIN_PX = 30; // un geste vif ferme aussi, mais pas un simple frémissement du doigt
const VITESSE_FERMETURE_PX_MS = 0.5;
const DUREE_RETOUR_MS = 160;

/** Fonction pure : un glissement vers le bas (`dy` en px, `dt` en ms) ferme-t-il la feuille ? Assez long, ou assez vif. */
export function fermerParGlisse({ dy, dt }) {
  if (!(dy > 0)) return false;
  if (dy >= SEUIL_FERMETURE_PX) return true;
  return dy >= DISTANCE_RAPIDE_MIN_PX && dt > 0 && dy / dt >= VITESSE_FERMETURE_PX_MS;
}

const mouvementReduit = () => { try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; } };

/**
 * Branche la fermeture par glissement vers le bas sur des `zones` (poignée, titre) d'une feuille : le contenu défilant n'en fait
 * jamais partie. La feuille suit le doigt, puis se ferme par `dialogue.close()` (comme « Annuler ») ou revient en place.
 * Mouvement réduit : la feuille ne suit pas le doigt et ne s'anime pas.
 */
export function activerFermetureParGlisse(dialogue, zones) {
  let depart = null;
  const place = (px, avecDuree) => {
    const style = dialogue.style;
    if (!style) return;
    style.transition = avecDuree && !mouvementReduit() ? `transform ${DUREE_RETOUR_MS}ms ease-out` : 'none';
    style.transform = px > 0 ? `translateY(${px}px)` : '';
  };
  for (const zone of zones) {
    zone.addEventListener('touchstart', (e) => {
      const t = e.touches?.[0];
      depart = t ? { y: t.clientY, h: Date.now() } : null;
    }, { passive: true });
    zone.addEventListener('touchmove', (e) => {
      const t = e.touches?.[0];
      if (depart && t && !mouvementReduit()) place(Math.max(0, t.clientY - depart.y), false);
    }, { passive: true });
    zone.addEventListener('touchend', (e) => {
      const t = e.changedTouches?.[0];
      const geste = depart && t ? { dy: t.clientY - depart.y, dt: Date.now() - depart.h } : null;
      depart = null;
      if (geste && fermerParGlisse(geste)) dialogue.close();
      else place(0, true);
    }, { passive: true });
    zone.addEventListener('touchcancel', () => { depart = null; place(0, true); }, { passive: true });
  }
}
