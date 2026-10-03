// Construction du DOM sans innerHTML : toute donnée saisie passe par textContent (nœuds texte).
// Aucun accès à `document` au niveau supérieur : uniquement dans les fonctions.

const PROPRIETES = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'readOnly', 'open', 'multiple', 'required']);

/** Ajoute un enfant (texte, nombre, nœud, ou tableau de ces éléments) ; null, undefined et false sont ignorés. */
export function ajouter(parent, enfant) {
  if (enfant === null || enfant === undefined || enfant === false || enfant === true) return parent;
  if (Array.isArray(enfant)) {
    for (const e of enfant) ajouter(parent, e);
  } else if (typeof enfant === 'string' || typeof enfant === 'number') {
    parent.appendChild(document.createTextNode(String(enfant)));
  } else {
    parent.appendChild(enfant);
  }
  return parent;
}

/**
 * h(balise, attributs, ...enfants) : crée un élément.
 * Attributs : `classe`, `dataset`, `pour` (attribut for), `onXxx` (écouteur), propriétés (value, checked, disabled…),
 * sinon attribut HTML. Les valeurs null, undefined et false sont ignorées.
 */
export function h(balise, attributs, ...enfants) {
  const el = document.createElement(balise);
  if (attributs) {
    for (const [cle, valeur] of Object.entries(attributs)) {
      if (valeur === null || valeur === undefined || valeur === false) continue;
      if (cle === 'classe') el.className = valeur;
      else if (cle === 'dataset') Object.assign(el.dataset, valeur);
      else if (cle === 'pour') el.setAttribute('for', valeur);
      else if (cle.length > 2 && cle.startsWith('on') && typeof valeur === 'function') el.addEventListener(cle.slice(2).toLowerCase(), valeur);
      else if (PROPRIETES.has(cle)) el[cle] = valeur;
      else el.setAttribute(cle, valeur === true ? '' : String(valeur));
    }
  }
  ajouter(el, enfants);
  return el;
}

const ESPACE_SVG = 'http://www.w3.org/2000/svg';

/**
 * svg(balise, attributs, ...enfants) : crée un élément SVG (createElementNS). Les attributs sont posés tels quels
 * (viewBox, d, fill…) ; `classe` donne l'attribut class. Valeurs null, undefined et false ignorées.
 */
export function svg(balise, attributs, ...enfants) {
  const el = document.createElementNS(ESPACE_SVG, balise);
  if (attributs) {
    for (const [cle, valeur] of Object.entries(attributs)) {
      if (valeur === null || valeur === undefined || valeur === false) continue;
      el.setAttribute(cle === 'classe' ? 'class' : cle, valeur === true ? '' : String(valeur));
    }
  }
  ajouter(el, enfants);
  return el;
}

/** Conteneur d'un identifiant (ou null hors navigateur). */
export function parId(id) {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}
