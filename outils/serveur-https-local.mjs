// Sert app/ en HTTPS sur le réseau local, pour essayer Sanji sur un iPhone ou un iPad. Rien n'est publié.
//  - https://<IP du Mac>:5443 : l'application ;
//  - http://<IP du Mac>:5174/ca.crt : le certificat de l'autorité locale, à installer une fois sur l'appareil ;
//  - http://<IP du Mac>:5174/semaine-test.json : la sauvegarde d'essai fabriquée par outils/creer-semaine-test.mjs (si elle existe).
// Prérequis : sh outils/creer-certificat-local.sh. Arrêt : Ctrl+C.
import { createServer as http } from 'node:http';
import { createServer as https } from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(fileURLToPath(new URL('..', import.meta.url)));
const app = join(racine, 'app');
const certs = join(racine, '.certificats-locaux');
if (!existsSync(join(certs, 'serveur.crt'))) {
  console.error('Certificat introuvable : lancez d\'abord « sh outils/creer-certificat-local.sh ».');
  process.exit(1);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon' };

function servir(req, rep) {
  let chemin;
  try {
    chemin = decodeURIComponent(new URL(req.url, 'https://x').pathname);
  } catch {
    rep.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    rep.end('Adresse illisible');
    return;
  }
  let fichier = normalize(join(app, chemin === '/' ? 'index.html' : chemin));
  if (!(fichier === app || fichier.startsWith(app + sep)) || !existsSync(fichier) || statSync(fichier).isDirectory()) {
    rep.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    rep.end('Introuvable');
    return;
  }
  rep.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  rep.end(readFileSync(fichier));
}

https({ key: readFileSync(join(certs, 'serveur.key')), cert: readFileSync(join(certs, 'serveur.crt')) }, servir).listen(5443);
http((req, rep) => {
  if (req.url === '/ca.crt') {
    rep.writeHead(200, { 'content-type': 'application/x-x509-ca-cert', 'content-disposition': 'attachment; filename="sanji-essai-local.crt"' });
    rep.end(readFileSync(join(certs, 'ca.crt')));
  } else if (req.url === '/semaine-test.json' && existsSync(join(racine, 'outils', 'sorties', 'semaine-test.json'))) {
    rep.writeHead(200, { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="sanji-semaine-test.json"' });
    rep.end(readFileSync(join(racine, 'outils', 'sorties', 'semaine-test.json')));
  } else {
    rep.writeHead(404);
    rep.end();
  }
}).listen(5174);
console.log('Application : https://<IP du Mac>:5443   Certificat à installer : http://<IP du Mac>:5174/ca.crt');
