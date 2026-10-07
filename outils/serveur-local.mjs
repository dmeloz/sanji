// Sert app/ sur http://127.0.0.1:5173, pour développer sur ce Mac seulement (npm run serve). Remplace python -m http.server, qui
// réinitialisait des connexions quand le navigateur demande une centaine de modules d'un coup. Rien n'est publié.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(fileURLToPath(new URL('../app', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

createServer(async (req, rep) => {
  try {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fichier = resolve(join(app, chemin));
    if (fichier !== app && !fichier.startsWith(app + sep)) { rep.writeHead(403).end('Interdit'); return; }
    if ((await stat(fichier).catch(() => null))?.isDirectory()) fichier = join(fichier, 'index.html');
    const contenu = await readFile(fichier);
    rep.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    rep.end(contenu);
  } catch {
    rep.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
}).listen(5173, '127.0.0.1', () => console.log('http://localhost:5173 (ce Mac seulement)'));
