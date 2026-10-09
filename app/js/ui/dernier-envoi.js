// Repère du dernier envoi réussi du fichier de diagnostic : stockage local, HORS de l'état et de la sauvegarde.
// { h, notesEnvoyees: [ids], photosEnvoyees: [clés] } ; rien n'est envoyé.

const CLE = 'sanji-dernier-envoi';
let memoire = null;
let repli = false; // le stockage local a refusé une écriture : la mémoire fait foi

function stockage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const liste = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/** Le repère, ou null (aucun envoi encore : tout part). */
export function lireRepere() {
  let brut = memoire;
  const s = stockage();
  if (s && !repli) {
    try { brut = JSON.parse(s.getItem(CLE) ?? 'null'); } catch { brut = memoire; }
  }
  if (!brut || typeof brut.h !== 'string' || Number.isNaN(Date.parse(brut.h))) return null;
  return { h: brut.h, notesEnvoyees: liste(brut.notesEnvoyees), photosEnvoyees: liste(brut.photosEnvoyees) };
}

/** À appeler seulement après un envoi réussi. `h` : l'instant où le texte a été fabriqué. Cumule avec le repère précédent. */
export function marquerEnvoi({ h, notes = [], photos = [] }) {
  const avant = lireRepere();
  const repere = {
    h,
    notesEnvoyees: [...new Set([...(avant?.notesEnvoyees ?? []), ...notes])],
    photosEnvoyees: [...new Set([...(avant?.photosEnvoyees ?? []), ...photos])],
  };
  memoire = repere;
  try { stockage()?.setItem(CLE, JSON.stringify(repere)); } catch { repli = true; }
  return repere;
}

export function effacerRepere() {
  memoire = null;
  repli = false;
  try { stockage()?.removeItem(CLE); } catch { /* rien à retirer */ }
}
