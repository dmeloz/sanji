// Magasin : détient l'état courant. Toute modification passe par `agir`, qui travaille sur une copie
// et ne remplace l'état que si aucune erreur n'est levée.

import { ajouterJournal, etatInitial, importerAvecBilan, exporter } from './domaine/etat.js';
import { chargerEtat, demanderPersistance, enregistrerEtat, stockageDisponible } from './stockage.js';
import { copieDuJour, garderAvantImportEcarte } from './sauvegarde-auto.js';
import { horodatageLocal } from './ui/format.js';

let etatCourant = etatInitial();
const abonnes = new Set();
const ecouteursMessages = new Set();

/** Situation du stockage : `enregistre` faux => bandeau « données non enregistrées sur cet appareil ». */
const statut = { enregistre: false, raison: 'démarrage en cours', persistant: null, illisible: false, utilisable: false };

/** Délais avant un nouvel essai d'une écriture ratée ; le dernier se répète. */
const DELAIS_NOUVEL_ESSAI_MS = [3000, 10000, 30000];

let minuteurNouvelEssai = null;
let essaisRates = 0;
let ecritureEnCours = false;
let ecritureEnAttente = false;
let jourCopieTente = null;

/** Copie de sécurité du jour, une seule tentative par jour et par session ; jamais attendue, jamais bloquante. */
function copierSiBesoin() {
  const jour = aujourdhui();
  if (jour === jourCopieTente || statut.illisible || !statut.utilisable) return;
  jourCopieTente = jour;
  try { copieDuJour(exporter(etatCourant, maintenant()), jour).catch(() => {}); } catch { /* jamais bloquant */ }
}

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

function peutEcrire() { return statut.utilisable && !statut.illisible; }

/** Écriture réussie : le bandeau se lève, le minuteur est annulé et les délais repartent du début. */
function noterReussite() {
  clearTimeout(minuteurNouvelEssai);
  minuteurNouvelEssai = null;
  essaisRates = 0;
  if (!statut.enregistre) { statut.enregistre = true; statut.raison = ''; redessiner(); }
}

/** Écriture ratée : bandeau, et un seul minuteur pour un nouvel essai (délais croissants, plafonnés). */
function noterEchec(erreur) {
  statut.enregistre = false;
  statut.raison = erreur?.message ?? 'écriture impossible';
  if (!minuteurNouvelEssai && peutEcrire()) {
    const delai = DELAIS_NOUVEL_ESSAI_MS[Math.min(essaisRates, DELAIS_NOUVEL_ESSAI_MS.length - 1)];
    essaisRates += 1;
    minuteurNouvelEssai = setTimeout(() => { minuteurNouvelEssai = null; ecrire(); }, delai);
  }
  redessiner(); // après le minuteur : un abonné qui lève ne doit pas empêcher le nouvel essai
}

async function ecrire() {
  if (!peutEcrire()) return;
  if (ecritureEnCours) { ecritureEnAttente = true; return; }
  ecritureEnCours = true;
  try {
    do {
      ecritureEnAttente = false;
      try {
        await enregistrerEtat(etatCourant);
        noterReussite();
        copierSiBesoin();
      } catch (erreur) {
        noterEchec(erreur);
      }
    } while (ecritureEnAttente);
  } finally {
    ecritureEnCours = false;
  }
}

/** Retour dans l'app : si la dernière écriture a échoué, on retente tout de suite. */
function retenterSiEchec() {
  if (statut.enregistre || !peutEcrire()) return;
  clearTimeout(minuteurNouvelEssai);
  minuteurNouvelEssai = null;
  ecrire();
}

function installerRetours() {
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pageshow', retenterSiEchec);
  if (typeof globalThis.document?.addEventListener === 'function') {
    globalThis.document.addEventListener('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'visible') retenterSiEchec();
    });
  }
}
installerRetours();

/** Des entrées abîmées ont été écartées : garde le brut d'origine avant tout enregistrement, puis le dit (une fois par copie gardée). */
async function signalerEcartes(texteBrut, nombre) {
  const ecartes = `${nombre} élément(s) abîmé(s) n'ont pas pu être relus et ont été écartés.`;
  try {
    if (await garderAvantImportEcarte(texteBrut)) signaler(`${ecartes} Une copie de l'état d'origine est gardée dans Réglages > Données.`, 'erreur');
  } catch {
    signaler(`${ecartes} La copie de l'état d'origine n'a pas pu être gardée.`, 'erreur');
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
    // Sans attendre : le navigateur peut afficher une invite et tarder, ce qui ne doit pas retarder le démarrage.
    demanderPersistance().then((persistant) => { statut.persistant = persistant; });
    if (brut) {
      try {
        const texteBrut = exporter(brut, maintenant());
        const bilan = importerAvecBilan(texteBrut, aujourdhui());
        etatCourant = bilan.etat;
        if (bilan.ecartes > 0) await signalerEcartes(texteBrut, bilan.ecartes);
        if (bilan.migrations.length > 0) { signaler('Ancienne sauvegarde mise à jour : créneaux horaires retirés.', 'info'); ecrire(); } // réenregistré : le message ne revient pas à la prochaine ouverture
      } catch (erreur) {
        statut.illisible = true;
        statut.enregistre = false;
        statut.raison = `données enregistrées illisibles : ${erreur.message}`;
        etatCourant = etatInitial();
        signaler('Les données enregistrées sur cet appareil sont illisibles. Rien ne sera écrasé : restaurez une sauvegarde pour reprendre.', 'erreur');
      }
      copierSiBesoin();
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
export function remplacer(nouvelEtat, detail = '', action = 'restaurer') {
  const copie = structuredClone(nouvelEtat);
  ajouterJournal(copie, maintenant(), action, detail);
  etatCourant = copie;
  jourCopieTente = null; // la copie du jour est refaite à ce prochain enregistrement
  if (statut.illisible) { statut.illisible = false; statut.raison = ''; statut.enregistre = true; }
  ecrire();
  redessiner();
}
