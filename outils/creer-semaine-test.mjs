// Fabrique un fichier de sauvegarde « semaine test » à restaurer dans Sanji (Réglages > Restaurer), pour essayer
// l'application sur une semaine complète. Données d'ESSAI uniquement : menus génériques, nombres arbitraires.
// Scénario : on est le samedi 3 octobre 2026, la semaine du 5 au 9 octobre est saisie, et on a déjà pris de l'avance
// pour le début de semaine (carottes du lundi et pommes de terre du mardi déjà faites le samedi).
// Usage : node outils/creer-semaine-test.mjs   → écrit outils/sorties/semaine-test.json (hors Git).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  confirmerSemaineType, creerFiche, definirMenu, definirPrevision, definirStandard, marquerFait, planifier, saisirVentes,
} from '../app/js/domaine/actions.js';
import { etatInitial, exporter } from '../app/js/domaine/etat.js';

const SAMEDI = '2026-10-03';
const L = '2026-10-05'; const MA = '2026-10-06'; const ME = '2026-10-07'; const J = '2026-10-08'; const V = '2026-10-09';
let minute = 0;
const h = (jour = SAMEDI, heure = 9) => `${jour}T${String(heure).padStart(2, '0')}:${String(minute++ % 60).padStart(2, '0')}:00`;

const e = etatInitial();

// Menus de la semaine (menu 1 = plat complet, menu 2 = légumes et féculent).
const MENUS = {
  [L]: ['Poulet, riz, carottes', 'Risotto aux courgettes, tomates'],
  [MA]: ['Poisson, pommes de terre, épinards', 'Pâtes aux poireaux, quinoa'],
  [ME]: ['Boeuf braisé, polenta, blettes', 'Lentilles, riz pilaf, endives'],
  [J]: ['Escalope, pâtes, brocoli', 'Gnocchi, courge'],
  [V]: ['Saumon, riz, fenouil', 'Haricots blancs, carottes'],
};
for (const [date, [m1, m2]] of Object.entries(MENUS)) {
  definirMenu(e, date, 1, m1, h(SAMEDI, 8));
  definirMenu(e, date, 2, m2, h(SAMEDI, 8));
}

// Prévisions hors groupes (menu 1, menu 2).
const PREVISIONS = { [L]: [40, 25], [MA]: [35, 22], [ME]: [30, 20], [J]: [32, 20], [V]: [45, 28] };
for (const [date, [p1, p2]] of Object.entries(PREVISIONS)) {
  definirPrevision(e, date, 1, p1, h(SAMEDI, 8));
  definirPrevision(e, date, 2, p2, h(SAMEDI, 8));
}

// Standards maison de la semaine d'essai (valeurs arbitraires, états du poids explicites).
const S = (valeur, etat) => ({ valeur, unite: 'g', etat });
definirStandard(e, 'riz', 'plat_principal', S(70, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'riz', 'garniture', S(50, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'pates_seches', 'plat_principal', S(90, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'pates_seches', 'garniture', S(60, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'quinoa', 'garniture', S(50, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'polenta', 'garniture', S(50, 'sec'), h(SAMEDI, 8));
definirStandard(e, 'pommes_de_terre', 'plat_principal', S(200, 'cru_net'), h(SAMEDI, 8));
definirStandard(e, 'legumineuses', 'garniture', S(60, 'sec'), h(SAMEDI, 8));
// Un standard de catégorie « Légumes » : il sert aux légumes de toutes les familles sans standard, et à ceux sans famille.
definirStandard(e, 'groupe:legumes', 'garniture', S(120, 'cru_net'), h(SAMEDI, 8));
definirStandard(e, 'groupe:legumes', 'plat_principal', S(120, 'cru_net'), h(SAMEDI, 8));
confirmerSemaineType(e, h(SAMEDI, 8));

// Une fiche de fonction : mardi midi, 20 couverts, menu 1, une allergie.
creerFiche(e, { numero: 'F1', date: MA, service: 'midi', horaire: '12:00', couverts: 20, mode: 'menu_fixe', menuFixe: 1,
  repartition: { 1: 20, 2: 0 }, allergies: 'gluten', remarques: 'fiche d\'essai' }, h(SAMEDI, 8));

// Ventes des lundis précédents : sert de repère pour la prévision du lundi.
for (const [date, v1, v2] of [['2026-09-14', 38, 21], ['2026-09-21', 41, 26], ['2026-09-28', 36, 24]]) {
  saisirVentes(e, date, 1, v1, h(date, 22));
  saisirVentes(e, date, 2, v2, h(date, 22));
}

// Avance déjà prise le samedi pour le début de semaine :
//  - carottes du lundi : planifiées et FAITES cet après-midi (2 jours d'avance : dans la règle) ;
//  - pommes de terre du mardi : faites aussi, mais c'est 3 jours d'avance (samedi, dimanche non travaillé, lundi, mardi) :
//    hors règle, donc non couvertes et un écart à arbitrer. Cas limite voulu pour essayer l'écran ;
//  - riz du lundi : planifié pour ce soir, pas encore fait (forme un lot avec le risotto du lundi).
const production = (date, nom) => Object.values(e.productions).find((p) => {
  const c = e.composants[p.composantId];
  return p.genre === 'principale' && p.dateService === date && c?.nom === nom;
});
const carottesLundi = production(L, 'carottes');
planifier(e, carottesLundi.id, SAMEDI, 'apres_midi', h(SAMEDI, 13));
marquerFait(e, carottesLundi.id, undefined, h(SAMEDI, 15));
const pdtMardi = production(MA, 'pommes de terre');
planifier(e, pdtMardi.id, SAMEDI, 'apres_midi', h(SAMEDI, 13));
marquerFait(e, pdtMardi.id, undefined, h(SAMEDI, 16));
const rizLundi = production(L, 'riz');
planifier(e, rizLundi.id, SAMEDI, 'avant_soir', h(SAMEDI, 17));

const dossier = join(dirname(fileURLToPath(import.meta.url)), 'sorties');
mkdirSync(dossier, { recursive: true });
const sortie = join(dossier, 'semaine-test.json');
writeFileSync(sortie, exporter(e, h(SAMEDI, 18)), 'utf8');
console.log(`Semaine test écrite : ${sortie}`);
console.log(`${Object.keys(e.composants).length} composants, ${Object.keys(e.productions).length} productions, `
  + `${Object.values(e.productions).filter((p) => p.etat === 'fait').length} faites.`);
