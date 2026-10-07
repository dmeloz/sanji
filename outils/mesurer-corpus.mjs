// Mesure de la lecture des feuilles sur le corpus réel (corpus/, local, hors Git). Lecture seule.
// Usage : node outils/mesurer-corpus.mjs  (ne fait rien si corpus/menus-marche/ est absent).
// Entrée simulée : titre imprimé (omis s'il est masqué) + jour + plats + prix, sans annotations manuscrites.
// Les semaines de TEST ne servent qu'à mesurer, jamais à régler le lecteur.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyserFeuille } from '../app/js/domaine/feuille.js';
import { lirePlat } from '../app/js/domaine/analyse-menu.js';

const dossier = fileURLToPath(new URL('../corpus/menus-marche/', import.meta.url));
const TEST = new Set(['IMG_0351', 'IMG_0355']);
if (!existsSync(dossier)) { console.log('Pas de corpus : rien à mesurer.'); process.exit(0); }

const pages = readdirSync(dossier).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(dossier + f, 'utf8')))
  // une photo qui répète une photo antérieure (même page) ne compte pas deux fois
  .filter((j) => !(j.doublonProbable && /^IMG_\d+/.test(j.doublonProbable) && j.doublonProbable.slice(0, 8) < j.photo.slice(0, 8)));

const mesure = { apprentissage: [], test: [] };
for (const j of pages) {
  const id = j.photo.replace('.jpeg', '');
  const lignes = j.titreMasque ? [] : [j.titre];
  for (const d of j.jours) lignes.push(d.jour, `${d.menu1.texte} ${d.menu1.prix ?? ''}`, `${d.menu2.texte} ${d.menu2.prix ?? ''}`);
  const a = analyserFeuille(lignes.join('\n'));
  let aPreciser = 0; let plats = 0;
  for (const d of j.jours) for (const [menu, p] of [[1, d.menu1], [2, d.menu2]]) {
    plats += 1; aPreciser += (lirePlat(p.texte, menu).elements ?? []).filter((e) => e.categorie === 'a_preciser').length;
  }
  (TEST.has(id) ? mesure.test : mesure.apprentissage).push({ id, repartie: a.avertissements.length === 0 && a.jours.length === 5, aPreciser, plats, avert: a.avertissements });
}
for (const [nom, l] of Object.entries(mesure)) {
  const ok = l.filter((x) => x.repartie).length;
  const mots = l.reduce((s, x) => s + x.aPreciser, 0); const plats = l.reduce((s, x) => s + x.plats, 0);
  console.log(`${nom.toUpperCase()} : pages réparties ${ok}/${l.length} ; éléments à préciser ${mots} sur ${plats} plats`);
  for (const x of l.filter((y) => !y.repartie)) console.log(`  - ${x.id} : ${x.avert[0]?.slice(0, 90) ?? 'non réparti'}`);
}
