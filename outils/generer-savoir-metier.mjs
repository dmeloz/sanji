#!/usr/bin/env node
// Génère app/js/donnees/savoir-metier.js à partir de connaissances/savoir-metier.json (source versionnée,
// validée par la propriétaire). Aucune moyenne n'est calculée ici : min et max restent séparés.
// Usage : node outils/generer-savoir-metier.mjs [source.json] [sortie.js]   (ou : npm run savoir)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_PAR_DEFAUT = resolve(RACINE, 'connaissances/savoir-metier.json');
export const SORTIE_PAR_DEFAUT = resolve(RACINE, 'app/js/donnees/savoir-metier.js');

/** Texte du module généré pour une source déjà lue : { version, reperes }. */
export function genererFichier({ version, reperes }) {
  const corps = reperes.map((r) => '  ' + JSON.stringify(r)).join(',\n');
  return `// FICHIER GÉNÉRÉ : NE PAS ÉDITER À LA MAIN.
// Produit par outils/generer-savoir-metier.mjs (commande : npm run savoir) à partir de
// connaissances/savoir-metier.json.
//
// Repères de portion VALIDÉS par la propriétaire (statut « valide_chef »). Une fourchette est donnée par min et max,
// jamais par une moyenne. \`appliquee: false\` : validé, mais pas encore branché sur le calcul.

export const VERSION_SAVOIR = ${JSON.stringify(version)};

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    Object.values(valeur).forEach(geler);
    Object.freeze(valeur);
  }
  return valeur;
}

export const REPERES_VALIDES = geler([
${corps},
]);
`;
}

function principal() {
  const source = process.argv[2] ? resolve(process.argv[2]) : SOURCE_PAR_DEFAUT;
  const sortie = process.argv[3] ? resolve(process.argv[3]) : SORTIE_PAR_DEFAUT;
  const donnees = JSON.parse(readFileSync(source, 'utf8'));
  if (!Array.isArray(donnees.reperes)) throw new Error('Source invalide : « reperes » doit être un tableau.');
  writeFileSync(sortie, genererFichier(donnees), 'utf8');
  console.log(`${donnees.reperes.length} repère(s) écrit(s) dans ${sortie} (version ${donnees.version})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) principal();
