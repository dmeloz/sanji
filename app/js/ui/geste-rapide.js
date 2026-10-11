// Gestes d'un toucher (v123, principe « valider vite, en un geste ») : pour une carte de décision, le geste SÛR qui appelle
// l'action existante par `agir`. Le toucher EST le geste de la propriétaire : rien n'est choisi à sa place. Seuls genres
// concernés : valeur (valeur exacte du standard de base), apprentissage (oui / non), répartition provisoire (telle quelle, seulement si la somme des parts égale les couverts),
// composant à classer. Pas de geste pour la semaine type (le toucher ne la montre pas : elle décide des jours « off »). Allergènes, écart, avance hors règle, sauce et autres points : aucun geste (leur dialogue).
// Accepte une carte de `decisionsDe` ou un point de `pointsAConfirmer` (`type` seul). Aucune logique métier ici.

import { accepterApprentissage, ecarterApprentissage } from '../domaine/actions-apprentissage.js';
import { validerStandard } from '../domaine/actions-validation.js';
import { confirmerAttribution, confirmerRepartition } from '../domaine/actions.js';
import { libelle } from '../domaine/statuts.js';
import { agir } from '../magasin.js';
import { h } from './dom.js';
import { formaterNombre } from './format.js';

const ROLE_EN_CLAIR = { plat_principal: 'en plat principal', garniture: 'en garniture' };

/** Parts de la répartition d'une fiche, en clair : « Menu 1 : 4 · Menu 2 : 2 » (vide si inconnue). */
export function texteRepartition(etat, ficheId) {
  const r = etat?.fiches?.[ficheId]?.repartition;
  return r ? `Menu 1 : ${r[1] ?? 0} · Menu 2 : ${r[2] ?? 0}` : '';
}

/** Titre court d'une carte, pour une ligne de l'accueil. `etat` (facultatif) permet de nommer le plat et de dire la répartition. */
export function titreCarte(c, etat) {
  switch (c.genre) {
    case 'repartition': return [`Fiche ${c.numero}`, texteRepartition(etat, c.ficheId)].filter(Boolean).join(' · ');
    case 'sauce': {
      const comp = etat?.composants?.[c.composantId];
      const plat = comp ? etat.jours?.[comp.date]?.menus?.[comp.menu]?.intitule : null;
      return plat ? `${c.nom.startsWith('sauce') ? 'Sauce' : 'Base'} du ${plat} à confirmer` : (c.nom ?? '');
    }
    case 'apprentissage': return c.proposition.texte;
    case 'valeur': return `${c.valeur.libelle} ${ROLE_EN_CLAIR[c.valeur.role] ?? ''}`.trim();
    case 'point': return c.texte;
    default: return c.nom ?? '';
  }
}

const geste = (texte, aria, action) => ({ texte, aria, agir: action });

function gestesValeur(v) {
  const { min, max, unite } = v.proposition;
  const valeur = (min + max) / 2; // la valeur que le calcul prend déjà : celle qui sera enregistrée
  const poids = v.proposition.etat ? ` ${libelle('ETAT_POIDS', v.proposition.etat)}` : '';
  const dit = `${formaterNombre(valeur)} ${libelle('UNITE', unite)}${poids}`;
  return [geste(`Garder ${dit}`, `Garder ${dit} : ${titreCarte({ genre: 'valeur', valeur: v })}`,
    (e, t) => validerStandard(e, v.famille, v.role, { valeur }, t))];
}

function gestesApprentissage(p) {
  return [
    geste('Oui', `Oui, ${p.texte}`, (e, t) => accepterApprentissage(e, p.cleFamille, p.role, { valeur: p.valeur, unite: p.unite, etat: p.etatPoids }, t)),
    geste('Non', `Non, garder la valeur actuelle : ${p.libelle}`, (e, t) => ecarterApprentissage(e, p.cleFamille, p.role, t)),
  ];
}

function gestesRepartition(etat, ficheId) {
  const f = etat.fiches?.[ficheId];
  if (!f || f.mode !== 'choix_libre' || f.statut === 'annulee') return [];
  const repartition = { 1: f.repartition?.[1] ?? 0, 2: f.repartition?.[2] ?? 0 };
  // La propriétaire doit pouvoir VOIR une répartition cohérente : sinon aucun geste (elle la corrige).
  if (repartition[1] + repartition[2] !== Number(f.couverts)) return [];
  return [geste('Confirmer telle quelle', `Confirmer la répartition telle quelle : ${repartition[1]} et ${repartition[2]} portions`,
    (e, t) => confirmerRepartition(e, ficheId, repartition, t))];
}

/**
 * Gestes d'un toucher d'une carte : `[{ texte, aria, agir:(etat, h) => … }]`, vide si la carte demande un vrai choix.
 */
export function gestesRapides(etat, carte) {
  if (carte.genre === 'valeur') return gestesValeur(carte.valeur);
  if (carte.genre === 'apprentissage') return gestesApprentissage(carte.proposition);
  if (carte.genre === 'repartition' || carte.type === 'repartition_provisoire') return gestesRepartition(etat, carte.ficheId);
  if (carte.type === 'composant_inconnu' && carte.composantId) {
    const nom = etat.composants?.[carte.composantId]?.nom;
    if (!nom) return [];
    return [true, false].map((attribue) => geste(attribue ? 'Au poste' : 'Hors poste', `${attribue ? 'Au poste' : 'Hors poste'} : ${nom}`,
      (e, t) => confirmerAttribution(e, carte.composantId, attribue, t)));
  }
  return [];
}

/** Boutons des gestes d'une carte (vide : aucun noeud). Le toucher exécute l'action ; la vue se redessine par `agir`. */
export function boutonsGestes(etat, carte, classe = 'btn geste-rapide') {
  return gestesRapides(etat, carte).map((g) => h('button', { type: 'button', classe, 'aria-label': g.aria, onClick: () => { agir(g.agir); } }, g.texte));
}
