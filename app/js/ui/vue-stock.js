// Stock (onglet 4, refonte 1) : trois vues, Restes, DLC, Achats, avec un sélecteur segmenté (liens #/stock/<vue>[/date]).
// - Restes : la saisie facultative après service (ventes par menu, surplus, rebut, note) d'un jour de la semaine ; un seul « Enregistrer ».
// - DLC : productions faites pour un service du jour ou à venir, avec date de production, avertissement et limite de conservation existants.
// - Achats : la vue Produits (vue-produits.js), restylée.
// Aucune logique métier ici : les calculs et les règles viennent du domaine. Pas de stock théorique, jamais « en stock ».
// `param` = le lundi de la semaine, `sous` = « restes », « dlc » ou « achats ».

import { saisirApresService, saisirVentes } from '../domaine/actions.js';
import { calculerComposant } from '../domaine/calcul.js';
import { ajouterJours, aMenuDuJour, libelleJour, lundiDe } from '../domaine/dates.js';
import { jourOuVide } from '../domaine/etat.js';
import { evaluationProduction, regleDe } from '../domaine/planification.js';
import { libelle } from '../domaine/statuts.js';
import { agir, aujourdhui } from '../magasin.js';
import { champs } from './champs.js';
import { h } from './dom.js';
import { bouton, ligneVide, lien, pastille } from './elements.js';
import { formaterHeure, pluriel, qteNoeuds, quantite } from './format.js';
import { problemeHorsLigne } from './horsligne.js';
import { afficherMessage } from './messages.js';
import { ligneProduction } from './taches.js';
import * as vueProduits from './vue-produits.js';

export const SOUS_VUES = ['restes', 'dlc', 'achats'];

const TITRES = { restes: 'Stock · Restes', dlc: 'Stock · DLC', achats: 'Stock · Achats' };
const LIBELLES = { restes: 'Restes', dlc: 'DLC', achats: 'Achats' };
const LEGENDES = {
  restes: 'Après le service · saisie facultative',
  dlc: 'Classé par service : aujourd\'hui, demain, plus tard',
  achats: 'Besoins de la semaine · vérifié disponible',
};

export function titre(param, sous = 'achats') { return TITRES[sous] ?? TITRES.achats; }

// ------------------------------------------------------------------ sélecteur

function selecteur(lundi, sous) {
  return h('nav', { classe: 'stock-segments', 'aria-label': 'Vue du stock' },
    SOUS_VUES.map((v) => h('a', {
      href: `#/stock/${v}/${lundi}`, classe: `stock-segment${v === sous ? ' stock-segment-actif' : ''}`,
      'aria-current': v === sous ? 'page' : null,
    }, LIBELLES[v])));
}

// ------------------------------------------------------------------ restes

/** Jour choisi pour les restes (mémorisé le temps de la session, ramené dans la semaine affichée). */
let jourChoisi = null;

function jourParDefaut(lundi, aujourd) {
  const semaine = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));
  if (jourChoisi && semaine.includes(jourChoisi)) return jourChoisi;
  return semaine.includes(aujourd) ? aujourd : lundi;
}

const nomUnite = (u) => libelle('UNITE', u);

/** Composants au poste du jour (menus 1 et 2), avec la quantité prévue quand le calcul la donne. */
function composantsDuJour(etat, date) {
  return Object.values(etat.composants)
    .filter((c) => c.date === date && (c.menu === 1 || c.menu === 2) && c.attribue)
    .sort((a, b) => a.menu - b.menu || a.nom.localeCompare(b.nom))
    .map((c) => {
      const calc = calculerComposant(etat, c.id);
      const unite = calc.uniteTravail ?? null;
      return { c, unite, prevu: calc.statut === 'CALCULE' ? quantite(calc.quantiteTravail, unite) : null };
    });
}

function formulaireRestes(etat, date) {
  const jour = jourOuVide(etat, date);
  const lignes = composantsDuJour(etat, date);
  const defs = [
    { cle: 'v1', type: 'entier', libelle: 'Ventes du menu 1 (portions)', valeur: jour.ventes[1] },
    { cle: 'v2', type: 'entier', libelle: 'Ventes du menu 2 (portions)', valeur: jour.ventes[2] },
  ];
  for (const { c, unite } of lignes) {
    const u = unite ? ` (${nomUnite(unite)})` : '';
    defs.push(
      { cle: `s:${c.id}`, type: 'nombre', libelle: `Surplus utilisable${u}`, valeur: c.apresService.surplus },
      { cle: `r:${c.id}`, type: 'nombre', libelle: `Rebut${u}`, valeur: c.apresService.rebut },
      { cle: `n:${c.id}`, type: 'zone', libelle: 'Note', valeur: c.apresService.note, placeholder: 'note facultative' });
  }
  const f = champs(defs);
  const noeuds = new Map(defs.map((d, i) => [d.cle, f.noeuds[i]]));

  const enregistrer = () => {
    let v;
    try { v = f.lire(); } catch (erreur) { afficherMessage(erreur.message, 'erreur'); return; }
    const r = agir((e, t) => {
      const avant = jourOuVide(e, date).ventes;
      if (aMenuDuJour(date)) {
        if (v.v1 !== avant[1]) saisirVentes(e, date, 1, v.v1, t);
        if (v.v2 !== avant[2]) saisirVentes(e, date, 2, v.v2, t);
      }
      for (const { c } of lignes) {
        const a = e.composants[c.id].apresService;
        const saisie = { surplus: v[`s:${c.id}`], rebut: v[`r:${c.id}`], note: v[`n:${c.id}`] };
        if (saisie.surplus !== a.surplus || saisie.rebut !== a.rebut || saisie.note !== a.note) saisirApresService(e, c.id, saisie, t);
      }
    });
    if (r.ok) afficherMessage('Restes enregistrés.', 'ok');
  };

  return h('div', { classe: 'stock-restes-corps' },
    h('section', { classe: 'stock-carte' },
      h('h2', { classe: 'stock-carte-titre' }, 'Ventes du service'),
      aMenuDuJour(date)
        ? [noeuds.get('v1'), noeuds.get('v2'),
          h('p', { classe: 'aide' }, 'Facultatif. Les ventes servent de repère pour les prévisions futures ; elles ne modifient aucune prévision.'),
          jour.ventes.h ? h('p', { classe: 'meta' }, `saisie du ${formaterHeure(jour.ventes.h)}`) : null]
        : ligneVide('Pas de menu du jour le samedi : pas de ventes par menu.')),
    lignes.length === 0
      ? ligneVide('Aucun composant au poste ce jour-là : rien à saisir pour le surplus ou le rebut.')
      : h('section', { classe: 'stock-carte' },
        h('h2', { classe: 'stock-carte-titre' }, 'Surplus et rebut'),
        lignes.map(({ c, prevu }) => h('div', { classe: 'stock-reste', role: 'group', 'aria-label': `Reste de ${c.nom}` },
          h('div', { classe: 'stock-reste-tete' },
            lien(`#/fiche/${encodeURIComponent(c.id)}`, c.nom, 'stock-reste-nom'),
            h('span', { classe: 'stock-legende' }, `menu ${c.menu} · ${prevu === null ? 'quantité prévue à préciser' : 'prévu '}`,
              prevu === null ? null : h('span', { classe: 'stock-qte' }, qteNoeuds(prevu)))),
          noeuds.get(`s:${c.id}`), noeuds.get(`r:${c.id}`), noeuds.get(`n:${c.id}`),
          h('p', { classe: 'aide' }, 'Le rebut n\'est pas une perte normale de parage ou de cuisson : il ne modifie aucun coefficient.')))),
    h('div', { classe: 'stock-valider' }, bouton('Enregistrer', enregistrer, 'principal')));
}

function corpsRestes(etat, lundi) {
  const aujourd = aujourdhui();
  const racine = h('div', { classe: 'stock-restes' });
  const zone = h('div', { classe: 'stock-restes-jour' });
  const puces = h('div', { classe: 'stock-jours', role: 'group', 'aria-label': 'Jour de la saisie' });
  const jours = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i));

  const dessiner = () => {
    const date = jourParDefaut(lundi, aujourd);
    puces.replaceChildren(...jours.map((d) => h('button', {
      type: 'button', classe: `stock-jour${d === date ? ' stock-jour-actif' : ''}`, 'aria-pressed': d === date ? 'true' : 'false',
      'aria-label': libelleJour(d),
      onClick: () => { jourChoisi = d; dessiner(); },
    }, h('span', null, libelleJour(d).split(' ')[0].slice(0, 3)), h('span', { classe: 'stock-jour-sous' }, d === aujourd ? 'auj.' : d.slice(8)))));
    zone.replaceChildren(
      h('h2', { classe: 'section-titre' }, date === aujourd ? `Aujourd'hui · ${libelleJour(date)}` : libelleJour(date)),
      formulaireRestes(etat, date));
  };
  dessiner();
  racine.appendChild(puces);
  racine.appendChild(zone);
  return racine;
}

// ------------------------------------------------------------------ DLC

/** Date de production : le jour décidé, à défaut la date du « fait » (même règle que la feuille Jour). */
const dateDeProduction = (p) => p.jourDecide ?? (p.hFait ? String(p.hFait).slice(0, 10) : null);

/** Phrases de conservation d'une évaluation d'avance, avec le mot écrit (avertissement, hors règle, dépassée). */
function mentionsConservation(etat, p, ev) {
  const mentions = [];
  if (!ev) return mentions;
  const regle = regleDe(etat, etat.composants[p.composantId], p.etapeCle ?? null);
  const limite = Number.isFinite(regle?.limiteUtilisationJours) ? regle.limiteUtilisationJours : null;
  if (ev.exception && !ev.autorisee) mentions.push({ texte: 'hors règle : avance de plus de deux jours sans règle validée', alerte: true });
  else if (ev.exception) mentions.push({ texte: 'avance de plus de deux jours autorisée par la règle', alerte: false });
  if (ev.conservation === 'referentiel' && ev.repere) {
    mentions.push({ texte: `conservation : ${ev.repere.texte}`, alerte: false });
    if (ev.repere.depasse) mentions.push({ texte: `avertissement : avance de ${pluriel(ev.jours, 'jour')}, plus longue que la durée de base`, alerte: true });
  }
  if (ev.conservation === 'validee') mentions.push({ texte: `limite d'utilisation : ${pluriel(limite, 'jour')} (validée)`, alerte: false });
  if (ev.conservation === 'depassee') mentions.push({ texte: `limite d'utilisation dépassée (${pluriel(limite, 'jour')}) : le besoin n'est pas couvert`, alerte: true });
  if (ev.conservation === 'a_confirmer') mentions.push({ texte: 'conservation à confirmer', alerte: false });
  return mentions;
}

function carteDlc(etat, p, avecService) {
  const l = ligneProduction(etat, p);
  const mentions = mentionsConservation(etat, p, evaluationProduction(etat, p.id));
  const alerte = mentions.some((m) => m.alerte);
  const produit = dateDeProduction(p);
  const preparatoire = p.genre === 'preparatoire';
  const nom = preparatoire ? `${l.libelle} · ${l.nom}` : l.nom;
  return h('li', { classe: `stock-dlc${alerte ? ' stock-dlc-alerte' : ''}` },
    h('div', { classe: 'stock-dlc-ligne' },
      h('span', { classe: 'stock-dlc-texte' },
        lien(`#/fiche/${encodeURIComponent(l.composantId)}`, nom, 'stock-dlc-nom'),
        h('span', { classe: 'stock-legende' },
          `${produit ? `produit le ${libelleJour(produit)}` : 'date de production non décidée'}${avecService ? ` · pour le service du ${libelleJour(p.dateService)}` : ''}`)),
      h('span', { classe: 'stock-qte' }, qteNoeuds(preparatoire || !Number.isFinite(p.quantiteReelle) ? 'sans quantité' : quantite(p.quantiteReelle, l.unite)))),
    mentions.map((m) => h('p', { classe: m.alerte ? 'stock-mention stock-mention-alerte' : 'stock-mention' },
      m.alerte ? pastille('à lire', 'ambre') : null, m.alerte ? ' ' : null, m.texte)));
}

function corpsDlc(etat) {
  const aujourd = aujourdhui();
  const demain = ajouterJours(aujourd, 1);
  const faites = Object.values(etat.productions ?? {})
    .filter((p) => p.etat === 'fait' && p.dateService >= aujourd && etat.composants?.[p.composantId])
    .sort((a, b) => a.dateService.localeCompare(b.dateService) || etat.composants[a.composantId].nom.localeCompare(etat.composants[b.composantId].nom));
  const groupes = [
    ["Aujourd'hui", faites.filter((p) => p.dateService === aujourd), false],
    ['Demain', faites.filter((p) => p.dateService === demain), false],
    ['Plus tard', faites.filter((p) => p.dateService > demain), true],
  ];
  const racine = h('div', { classe: 'stock-dlc-vue' });
  if (faites.length === 0) racine.appendChild(ligneVide('Aucune production faite pour un service du jour ou à venir.'));
  for (const [nom, liste, avecService] of groupes) {
    if (liste.length === 0) continue;
    racine.appendChild(h('section', { classe: 'stock-groupe' },
      h('h2', { classe: 'stock-groupe-titre' }, nom),
      h('ul', { classe: 'stock-dlc-liste' }, liste.map((p) => carteDlc(etat, p, avecService)))));
  }
  racine.appendChild(h('p', { classe: 'aide' }, 'Seules les productions marquées « Fait » apparaissent ici. Les durées de conservation sont des repères du standard de base ou la limite saisie : un avertissement ne bloque rien.'));
  return racine;
}

// ------------------------------------------------------------------ vue

export function rendre(etat, lundi, sous = 'achats') {
  const vue = SOUS_VUES.includes(sous) ? sous : 'achats';
  const semaine = lundiDe(lundi ?? aujourdhui());
  if (vue !== 'restes') jourChoisi = null; // quitter les restes oublie le jour choisi : on y revient sur aujourd'hui
  const racine = h('div', { classe: 'vue vue-stock' });
  racine.appendChild(h('header', { classe: 'stock-entete' },
    h('p', { classe: 'stock-sous' }, LEGENDES[vue], problemeHorsLigne() ? [' · ', h('span', { classe: 'stock-horsligne' }, problemeHorsLigne())] : null),
    h('h1', { classe: 'page-titre' }, 'Stock')));
  racine.appendChild(selecteur(semaine, vue));
  if (vue === 'restes') racine.appendChild(corpsRestes(etat, semaine));
  else if (vue === 'dlc') racine.appendChild(corpsDlc(etat));
  else racine.appendChild(vueProduits.rendre(etat, semaine, { integre: true }));
  return racine;
}
