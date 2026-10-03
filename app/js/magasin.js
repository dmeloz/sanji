// Magasin : détient l'état courant. Toute modification passe par `agir`, qui travaille sur une copie
// et ne remplace l'état que si aucune erreur n'est levée.

import { ajouterJournal, etatInitial, importer, exporter } from './domaine/etat.js';
import { chargerEtat, demanderPersistance, enregistrerEtat, stockageDisponible } from './stockage.js';
import { horodatageLocal } from './ui/format.js';

let etatCourant = etatInitial();
const abonnes = new Set();
const ecouteursMessages = new Set();

/** Situation du stockage : `enregistre` faux => bandeau « données non enregistrées sur cet appareil ». */
const statut = { enregistre: false, raison: 'démarrage en cours', persistant: null, illisible: false, utilisable: false };

let ecritureEnCours = false;
let ecritureEnAttente = false;

/** Heure locale « AAAA-MM-JJTHH:MM:SS » (sans Z). */
export function maintenant() { return horodatageLocal(new Date()); }

/** Date locale « AAAA-MM-JJ ». */
export function aujourdhui() { return maintenant().slice(0, 10); }

export function etat() { return etatCourant; }
export function statutStockage() { return { ...statut }; }

export function abonner(fonction) { abonnes.add(fonction); return () => abonnes.delete(fonction); }
export function surMessage(fonction) { ecouteursMessages.add(fonction); return () => ecouteursMessages.delete(fonction); }

/** Redessine la vue sans changer l'état (pagination, bandeaux…). */
export function redessiner() { for (const f of abonnes) f(etatCourant); }

function signaler(texte, type) { for (const f of ecouteursMessages) f(texte, type); }

async function ecrire() {
  if (!statut.utilisable || statut.illisible) return;
  if (ecritureEnCours) { ecritureEnAttente = true; return; }
  ecritureEnCours = true;
  try {
    do {
      ecritureEnAttente = false;
      try {
        await enregistrerEtat(etatCourant);
        if (!statut.enregistre) { statut.enregistre = true; statut.raison = ''; redessiner(); }
      } catch (erreur) {
        statut.enregistre = false;
        statut.raison = erreur?.message ?? 'écriture impossible';
        redessiner();
      }
    } while (ecritureEnAttente);
  } finally {
    ecritureEnCours = false;
  }
}

/**
 * Charge l'état enregistré. Sans IndexedDB (ou si la lecture échoue), l'application reste utilisable en mémoire.
 * Si les données enregistrées sont illisibles, l'écriture est suspendue pour ne pas les écraser.
 */
export async function charger() {
  statut.utilisable = false;
  if (!stockageDisponible()) {
    statut.enregistre = false;
    statut.raison = "IndexedDB n'est pas disponible sur ce navigateur";
    return etatCourant;
  }
  try {
    const brut = await chargerEtat();
    statut.utilisable = true;
    statut.enregistre = true;
    statut.raison = '';
    statut.persistant = await demanderPersistance();
    if (brut) {
      try {
        etatCourant = importer(exporter(brut, maintenant()));
      } catch (erreur) {
        statut.illisible = true;
        statut.enregistre = false;
        statut.raison = `données enregistrées illisibles : ${erreur.message}`;
        etatCourant = etatInitial();
        signaler('Les données enregistrées sur cet appareil sont illisibles. Rien ne sera écrasé : restaurez une sauvegarde pour reprendre.', 'erreur');
      }
    }
  } catch (erreur) {
    statut.enregistre = false;
    statut.raison = erreur?.message ?? 'lecture impossible';
  }
  return etatCourant;
}

/**
 * Applique `fonction(copie, h)` sur une copie de l'état. Sans erreur : la copie remplace l'état, est enregistrée
 * et la vue est redessinée. Avec une erreur : l'état reste intact et le message est affiché (sauf `afficher: false`).
 * @returns {{ok:true, valeur:any}|{ok:false, erreur:string}}
 */
export function agir(fonction, options = {}) {
  const copie = structuredClone(etatCourant);
  let valeur;
  try {
    valeur = fonction(copie, maintenant());
  } catch (erreur) {
    const texte = erreur?.message ?? String(erreur);
    if (options.afficher !== false) signaler(texte, 'erreur');
    return { ok: false, erreur: texte };
  }
  etatCourant = copie;
  ecrire();
  redessiner();
  return { ok: true, valeur };
}

/** Comme `agir`, mais renvoie la valeur ou lève l'Error (pour les panneaux, qui affichent l'erreur eux-mêmes). */
export function agirStrict(fonction) {
  const r = agir(fonction, { afficher: false });
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur;
}

/** Remplace tout l'état (restauration d'une sauvegarde déjà validée par `importer`). */
export function remplacer(nouvelEtat, detail = '') {
  const copie = structuredClone(nouvelEtat);
  ajouterJournal(copie, maintenant(), 'restaurer', detail);
  etatCourant = copie;
  if (statut.illisible) { statut.illisible = false; statut.raison = ''; statut.enregistre = true; }
  ecrire();
  redessiner();
}
