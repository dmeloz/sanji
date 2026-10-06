// Constructeur de champs de formulaire pour les panneaux <dialog>.
// Types : texte, zone, nombre, entier, date, choix, case, cases (liste), radio.
// `lire()` renvoie un objet { cle: valeur } ; un nombre illisible lève une Error en français.

import { h } from './dom.js';
import { formaterNombre, parseEntier, parseNombre } from './format.js';

let compteur = 0;

/**
 * @param {{cle:string, libelle?:string, type:string, valeur?:any, aide?:string, placeholder?:string,
 *   options?:[any,string][], cache?:boolean}[]} definitions
 */
export function champs(definitions) {
  const parCle = new Map();
  const noeuds = [];

  for (const def of definitions) {
    compteur += 1;
    const id = `champ-${compteur}`;
    const entree = { def, id, envelope: null, controle: null, controles: [] };
    parCle.set(def.cle, entree);
    construire(entree);
    noeuds.push(entree.envelope);
  }

  function construire(entree) {
    const { def, id } = entree;
    const aide = def.aide ? h('p', { classe: 'aide', id: `${id}-aide` }, def.aide) : null;
    const decrit = def.aide ? { 'aria-describedby': `${id}-aide` } : {};
    let corps;
    switch (def.type) {
      case 'zone':
        entree.controle = h('textarea', { id, rows: 4, placeholder: def.placeholder, ...decrit });
        entree.controle.value = def.valeur ?? '';
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
        break;
      case 'nombre':
      case 'entier':
        entree.controle = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: def.placeholder, ...decrit });
        entree.controle.value = formaterNombre(def.valeur);
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
        break;
      case 'date':
        entree.controle = h('input', { id, type: 'date', ...decrit });
        entree.controle.value = def.valeur ?? '';
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
        break;
      case 'choix':
        entree.controle = h('select', { id, ...decrit });
        remplirOptions(entree, def.options ?? [], def.valeur);
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
        break;
      case 'case':
        entree.controle = h('input', { id, type: 'checkbox', ...decrit });
        entree.controle.checked = Boolean(def.valeur);
        corps = [h('label', { classe: 'case', pour: id }, entree.controle, h('span', null, def.libelle))];
        break;
      case 'cases':
        entree.controles = (def.options ?? []).map(([valeur, libelle], i) => {
          const c = h('input', { id: `${id}-${i}`, type: 'checkbox' });
          c.checked = Array.isArray(def.valeur) && def.valeur.includes(valeur);
          c.dataset.valeur = String(valeur);
          return c;
        });
        corps = [h('fieldset', null, h('legend', null, def.libelle),
          (def.options ?? []).map(([, libelle], i) => h('label', { classe: 'case', pour: `${id}-${i}` }, entree.controles[i], h('span', null, libelle))))];
        break;
      case 'radio':
        entree.controles = (def.options ?? []).map(([valeur], i) => {
          const r = h('input', { id: `${id}-${i}`, type: 'radio', name: id });
          r.checked = valeur === def.valeur;
          return r;
        });
        corps = [h('fieldset', null, h('legend', null, def.libelle),
          (def.options ?? []).map(([, libelle, detail], i) => h('label', { classe: 'case', pour: `${id}-${i}` }, entree.controles[i],
            h('span', null, libelle, detail ? h('small', { classe: 'aide' }, detail) : null))))];
        break;
      case 'motdepasse':
        // Saisie masquée (clé d'API) : jamais de correction automatique, de majuscule ni de mémorisation par le navigateur.
        entree.controle = h('input', { id, type: 'password', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, placeholder: def.placeholder, ...decrit });
        entree.controle.value = def.valeur ?? '';
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
        break;
      default:
        entree.controle = h('input', { id, type: 'text', autocomplete: 'off', placeholder: def.placeholder, ...decrit });
        entree.controle.value = def.valeur ?? '';
        corps = [h('label', { pour: id }, def.libelle), entree.controle];
    }
    entree.envelope = h('div', { classe: 'champ', hidden: Boolean(def.cache) }, corps, aide);
  }

  function remplirOptions(entree, options, valeur) {
    entree.options = options;
    entree.controle.replaceChildren(...options.map(([, libelle], i) => h('option', { value: String(i) }, libelle)));
    const index = options.findIndex(([v]) => v === valeur);
    entree.controle.value = String(index >= 0 ? index : 0);
  }

  const obtenir = (cle) => {
    const e = parCle.get(cle);
    if (!e) throw new Error(`Champ inconnu : ${cle}`);
    return e;
  };

  function lireUn(entree) {
    const { def, controle, controles } = entree;
    switch (def.type) {
      case 'nombre': return parseNombre(controle.value, def.libelle);
      case 'entier': return parseEntier(controle.value, def.libelle);
      case 'choix': return entree.options[Number(controle.value)]?.[0] ?? null;
      case 'case': return controle.checked;
      case 'cases': return controles.filter((c) => c.checked).map((c) => c.dataset.valeur);
      case 'radio': {
        const i = controles.findIndex((c) => c.checked);
        return i >= 0 ? def.options[i][0] : null;
      }
      case 'zone':
      case 'texte':
      case 'date':
      default: return controle.value;
    }
  }

  return {
    noeuds,
    /** Valeurs de tous les champs (même masqués). */
    lire() {
      const res = {};
      for (const [cle, entree] of parCle) res[cle] = lireUn(entree);
      return res;
    },
    /** Valeur d'un seul champ. */
    valeur: (cle) => lireUn(obtenir(cle)),
    controle: (cle) => obtenir(cle).controle,
    /** Remplit un champ sans rien enregistrer (nombre, texte, date, choix par valeur, case). */
    fixer(cle, valeur) {
      const e = obtenir(cle);
      if (e.def.type === 'nombre' || e.def.type === 'entier') e.controle.value = formaterNombre(valeur);
      else if (e.def.type === 'choix') {
        const i = e.options.findIndex(([v]) => v === valeur);
        if (i >= 0) e.controle.value = String(i);
      } else if (e.def.type === 'case') e.controle.checked = Boolean(valeur);
      else e.controle.value = valeur ?? '';
    },
    montrer(cle, visible) { obtenir(cle).envelope.hidden = !visible; },
    /** Change l'intitulé affiché d'un champ (texte, nombre, choix, date, zone). */
    changerLibelle(cle, texte) {
      const label = obtenir(cle).envelope.querySelector('label');
      if (label) label.textContent = texte;
    },
    remplacerOptions(cle, options, valeur) { remplirOptions(obtenir(cle), options, valeur); },
    surChangement(cle, fonction) {
      const e = obtenir(cle);
      const cibles = e.controle ? [e.controle] : e.controles;
      for (const c of cibles) { c.addEventListener('change', fonction); c.addEventListener('input', fonction); }
    },
  };
}
