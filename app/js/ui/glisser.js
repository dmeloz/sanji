// Glissement horizontal pour changer de jour (feuille du jour). Les liens « Jour précédent / suivant » restent.

const DISTANCE_MIN = 80;
const DUREE_MAX_MS = 700;
const RAPPORT_HORIZONTAL = 2; // le geste doit être au moins deux fois plus horizontal que vertical

/** @returns {'suivant'|'precedent'|null} Fonction pure : décide si un geste est un feuilletage. */
export function directionDuGeste({ dx, dy, dt }) {
  if (Math.abs(dx) < DISTANCE_MIN || dt > DUREE_MAX_MS) return null;
  if (Math.abs(dx) < RAPPORT_HORIZONTAL * Math.abs(dy)) return null;
  return dx < 0 ? 'suivant' : 'precedent';
}

/**
 * Branche le geste sur un élément. Après un geste reconnu, les clics sont ignorés un instant (un doigt qui glisse
 * ne doit pas cocher ou ouvrir ce qu'il survole).
 */
export function activerGlisser(element, { suivant, precedent }) {
  let depart = null;
  let bloqueJusqua = 0;
  element.addEventListener('touchstart', (e) => {
    const t = e.touches?.[0];
    depart = t ? { x: t.clientX, y: t.clientY, h: Date.now() } : null;
  }, { passive: true });
  element.addEventListener('touchend', (e) => {
    const t = e.changedTouches?.[0];
    if (!depart || !t) return;
    const sens = directionDuGeste({ dx: t.clientX - depart.x, dy: t.clientY - depart.y, dt: Date.now() - depart.h });
    depart = null;
    if (!sens) return;
    bloqueJusqua = Date.now() + 350;
    (sens === 'suivant' ? suivant : precedent)();
  }, { passive: true });
  element.addEventListener('click', (e) => {
    if (Date.now() < bloqueJusqua) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}
