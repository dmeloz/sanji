// Faux DOM minimal pour exécuter les vues de l'interface sous Node (ce n'est pas un test : pas de suffixe .test.js).
// Il ne remplace pas un navigateur : il sert à détecter les erreurs de code (variable absente, mauvais argument…).

class Noeud {
  constructor() { this.enfants = []; this.parent = null; }
  get parentNode() { return this.parent; }
  get textContent() { return this.enfants.map((e) => e.textContent).join(''); }
  /** Comme le vrai DOM : `children` (le code de l'application ne doit jamais lire `enfants`, propre à ce faux DOM). */
  get children() { return this.enfants; }
}

class Texte extends Noeud {
  constructor(texte) { super(); this.texte = texte; }
  get textContent() { return this.texte; }
}

export class Element extends Noeud {
  constructor(balise) {
    super();
    this.balise = balise;
    this.attributs = {};
    this.dataset = {};
    this.ecouteurs = {};
    this.className = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.open = false;
  }

  appendChild(n) {
    if (n.parent) n.parent.enfants = n.parent.enfants.filter((e) => e !== n);
    n.parent = this;
    this.enfants.push(n);
    return n;
  }

  replaceChildren(...noeuds) {
    for (const e of this.enfants) e.parent = null;
    this.enfants = [];
    for (const n of noeuds) this.appendChild(n);
  }

  set textContent(v) { this.replaceChildren(new Texte(String(v))); }
  get textContent() { return this.enfants.map((e) => e.textContent).join(''); }

  setAttribute(k, v) { this.attributs[k] = String(v); }
  getAttribute(k) { return this.attributs[k] ?? null; }
  removeAttribute(k) { delete this.attributs[k]; }
  addEventListener(type, f) { (this.ecouteurs[type] ??= []).push(f); }

  /** Déclenche les écouteurs ; renvoie les promesses éventuelles. */
  declencher(type, evenement = {}) {
    const e = { preventDefault() {}, target: this, ...evenement };
    return Promise.all((this.ecouteurs[type] ?? []).map((f) => f(e)));
  }

  click() { return this.declencher('click'); }
  remove() { if (this.parent) this.parent.enfants = this.parent.enfants.filter((e) => e !== this); this.parent = null; }
  showModal() { this.open = true; }
  close() { this.open = false; this.declencher('close'); }
  scrollIntoView() {}

  tous(predicat, res = []) {
    for (const e of this.enfants) {
      if (e instanceof Element) {
        if (predicat(e)) res.push(e);
        e.tous(predicat, res);
      }
    }
    return res;
  }

  querySelector(balise) { return this.tous((e) => e.balise === balise)[0] ?? null; }

  /** Uniquement « balise » ou « balise[open] » (un dialogue ouvert). */
  querySelectorAll(selecteur) {
    const balise = selecteur.replace(/\[open\]$/, '');
    return this.tous((e) => e.balise === balise && (!selecteur.endsWith('[open]') || e.open));
  }
}

export function installerFauxDom() {
  const corps = new Element('body');
  for (const id of ['panneaux', 'messages']) {
    const e = new Element('div');
    e.setAttribute('id', id);
    corps.appendChild(e);
  }
  const document = {
    body: corps,
    createElement: (balise) => new Element(balise),
    createElementNS: (espace, balise) => { const e = new Element(balise); e.espace = espace; return e; },
    createTextNode: (t) => new Texte(t),
    getElementById: (id) => corps.tous((e) => e.attributs.id === id)[0] ?? null,
    querySelectorAll: () => [],
  };
  globalThis.document = document;
  globalThis.window = { scrollTo() {}, scrollY: 0, addEventListener() {}, isSecureContext: true };
  globalThis.location = { hash: '' };
  // Les minuteries des messages ne doivent pas retenir le processus de test.
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (f, ms, ...a) => { const t = original(f, ms, ...a); t.unref?.(); return t; };
  return { document, corps, restaurer() {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.location;
    globalThis.setTimeout = original;
  } };
}

/** Boutons actifs d'un arbre, dans l'ordre du document. */
export const boutons = (racine) => racine.tous((e) => e.balise === 'button' && !e.disabled);
/** Panneaux <dialog> ouverts dans le faux document. */
export const panneauxOuverts = (corps) => corps.tous((e) => e.balise === 'dialog' && e.open);

/**
 * La fiche suivie du contenu de sa feuille « Plus de réglages » (la ligne ouvre une feuille : on la touche, on déplace son corps
 * à la suite de la page, on la ferme). Les gestes de la feuille gardent leurs écouteurs.
 */
export function ficheAvecReglages(corps, page) {
  const ligne = page.tous((e) => e.balise === 'button' && /Plus de réglages/.test(e.textContent))[0];
  if (!ligne) return page;
  ligne.click();
  const feuille = panneauxOuverts(corps).at(-1);
  const contenu = feuille.tous((e) => e.className.split(' ').includes('panneau-corps'))[0];
  const racine = new Element('div');
  racine.appendChild(page);
  racine.appendChild(contenu);
  feuille.close();
  return racine;
}

/**
 * Fige l'horloge locale (new Date() sans argument) à une date de la semaine de test : une semaine passée ne se modifie plus
 * (garde-fou sur le temps), il faut donc que les dates de test soient « courantes ». Renvoie la fonction qui la restaure.
 */
export function figerHorloge(iso, heure = '10:00') {
  const reelle = Date;
  globalThis.Date = class extends reelle {
    constructor(...a) { super(...(a.length ? a : [`${iso}T${heure}:00`])); }
    static now() { return new reelle(`${iso}T${heure}:00`).getTime(); }
  };
  return () => { globalThis.Date = reelle; };
}
