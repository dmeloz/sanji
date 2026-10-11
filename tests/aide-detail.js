// Aide de test : les rubriques du « Détail du jour » (vue-detail.js) réunies dans un nœud, comme la feuille les affiche.
export function detailDuJour(vueDetail, etat, date) {
  const racine = document.createElement('div');
  for (const section of vueDetail.sectionsDuJour(etat, date)) racine.appendChild(section);
  return racine;
}
