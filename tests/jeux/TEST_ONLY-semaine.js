// JEU DE TEST — TEST_ONLY. Dates arbitraires de test ; aucune donnée de restaurant.
// Ne jamais importer ce fichier depuis app/ ni dans des données réelles.

export const JEU_SEMAINE = Object.freeze({
  etiquette: 'TEST_ONLY',
  note: 'Dates de test uniquement. 2026-09-28 est un lundi : la semaine chevauche septembre et octobre.',
  veille: '2026-10-02', // vendredi
  samediPrecedent: '2026-10-03',
  dimanchePrecedent: '2026-10-04',
  lundi: '2026-10-05',
  mardi: '2026-10-06',
  mercredi: '2026-10-07',
  jeudi: '2026-10-08',
  vendredi: '2026-10-09',
  samedi: '2026-10-10',
  dimanche: '2026-10-11',
  lundiSuivant: '2026-10-12',
  mardiSuivant: '2026-10-13',
  lundiChevauchement: '2026-09-28',
});
