// Les horodatages du journal, des notes et des retours sont en heure locale (comme le reste de l'app), pas en UTC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { figerHorloge, installerFauxDom } from './aide-dom.js';

const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('journal, retours et notes : h en heure locale, sans Z ; les anciennes entrées UTC restent lues', async () => {
  const dom = installerFauxDom();
  const rest = figerHorloge('2026-10-16', '23:30');
  try {
    globalThis.localStorage = faux();
    const J = await import('../app/js/ui/journal-diagnostic.js');
    const R = await import('../app/js/ui/retours-essai.js');
    const N = await import('../app/js/ui/notes-dev.js');
    J.effacerJournal();
    J.noter('clic', { libelle: 'x' });
    assert.equal(J.lireEvenements().at(-1).h, '2026-10-16T23:30:00');
    assert.equal(R.noterRetour({ type: 'menu', lu: 'a', final: 'b' }).h, '2026-10-16T23:30:00');
    assert.equal(N.ajouterNote({ type: 'idee', texte: 'une note' }).h, '2026-10-16T23:30:00');
    // ancienne entrée en UTC : toujours lue
    globalThis.localStorage.setItem('sanji-journal-diagnostic', JSON.stringify([{ type: 'clic', h: '2026-10-15T08:00:00.000Z' }]));
    assert.doesNotThrow(() => J.lireEvenements());
  } finally { rest(); dom.restaurer(); delete globalThis.localStorage; }
});
