// Fabrique un fichier de restauration pour l'app (Réglages > Sauvegarde > Restaurer) : un état propre contenant les menus
// des semaines du corpus d'entraînement (corpus/menus-marche/, local, hors Git), en lecture de l'imprimé seulement.
// Usage : node outils/creer-restauration-corpus.mjs [sortie.json]. Rien n'est écrit dans app/ ; aucune annotation manuscrite.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { exporter, etatInitial, importer } from '../app/js/domaine/etat.js';
import { saisirMenusSemaine } from '../app/js/domaine/actions.js';
import { ajouterJours, jourSemaine } from '../app/js/domaine/dates.js';
import { historiqueSemaines } from '../app/js/domaine/historique.js';

const dossier = fileURLToPath(new URL('../corpus/menus-marche/', import.meta.url));
const sortie = process.argv[2] ?? `${homedir()}/Atelier-Claude/Imports/sanji-restauration-2026-10-07.json`;
const AUJOURDHUI = '2026-10-07';
const H = `${AUJOURDHUI}T12:00:00`;
const MOIS = { janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', août: '08', septembre: '09', octobre: '10' };
if (!existsSync(dossier)) { console.error('Pas de corpus : rien à restaurer.'); process.exit(1); }

// « [illisible]ortecce » : la première lettre cachée par un doigt ; « Cortecce » figure tel quel sur les feuilles voisines.
const propre = (t) => String(t ?? '').replace('[illisible]ortecce', 'Cortecce').replace(/\[[^\]]*illisible[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();

const parLundi = new Map();
for (const f of readdirSync(dossier).filter((x) => x.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(dossier + f, 'utf8'));
  const m = /(\d+)\s+(\p{L}+)/u.exec(j.jours[0].jour);
  const lundi = `2026-${MOIS[m[2].toLowerCase()]}-${String(m[1]).padStart(2, '0')}`;
  if (jourSemaine(lundi) !== 1) throw new Error(`${f} : ${lundi} n'est pas un lundi`);
  if (!parLundi.has(lundi)) parLundi.set(lundi, j.jours.map((d) => ({ menu1: propre(d.menu1.texte), menu2: propre(d.menu2.texte) })));
}

const etat = etatInitial();
for (const [lundi, jours] of [...parLundi].sort()) {
  const saisie = {};
  jours.slice(0, 5).forEach((jour, i) => { saisie[ajouterJours(lundi, i)] = jour; });
  saisirMenusSemaine(etat, lundi, saisie, H);
}
const texte = exporter(etat, H);
const relu = importer(texte, AUJOURDHUI); // la même lecture que l'app : doit passer sans erreur
writeFileSync(sortie, texte);
const composants = Object.values(relu.composants);
console.log(`${parLundi.size} semaines, ${Object.keys(relu.jours).length} jours, ${composants.length} composants (à préciser : ${composants.filter((c) => c.categorie === 'a_preciser').length})`);
console.log(`Historique (semaines passées) : ${historiqueSemaines(relu, AUJOURDHUI).length} ; semaine en cours : ${[...parLundi.keys()].includes('2026-10-05') ? 'chargée' : 'ABSENTE'}`);
console.log(`Écrit : ${sortie}`);
