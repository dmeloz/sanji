// Feuille « À décider ». Provisoire : mène à la section « À confirmer » existante de l'écran Aujourd'hui.

const ZONE = 'bord-titre-confirmer';

export function ouvrirDecisions() {
  if (typeof location === 'undefined') return;
  const aller = () => {
    const zone = typeof document === 'undefined' ? null : document.getElementById(ZONE);
    if (zone && zone.scrollIntoView) zone.scrollIntoView({ block: 'start' });
  };
  if (location.hash.startsWith('#/aujourdhui')) { aller(); return; }
  location.hash = '#/aujourdhui';
  setTimeout(aller, 60);
}
