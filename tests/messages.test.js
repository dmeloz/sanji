// Messages courts (toasts) : jamais une pile ; un message identique est remplacé, deux messages au plus à l'écran.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { installerFauxDom } from './aide-dom.js';

let dom;
let messages;
before(async () => {
  dom = installerFauxDom();
  const zone = globalThis.document.createElement('div');
  zone.setAttribute('id', 'messages');
  dom.corps.appendChild(zone);
  messages = await import('../app/js/ui/messages.js');
});
after(() => dom.restaurer());

const textes = () => dom.corps.tous((x) => x.className.split(' ').includes('message-texte')).map((x) => x.textContent);

test('messages : un message identique est remplacé, pas empilé', () => {
  for (let i = 0; i < 3; i += 1) messages.afficherMessage('Remis à faire', 'ok');
  assert.deepEqual(textes(), ['Remis à faire']);
});

test('messages : deux messages au plus, le plus ancien part', () => {
  for (const t of ['un', 'deux', 'trois']) messages.afficherMessage(t, 'info');
  assert.deepEqual(textes(), ['deux', 'trois']);
});
