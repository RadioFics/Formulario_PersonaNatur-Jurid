/**
 * static-server.js — Servidor de archivos estáticos para previsualizar la DEMO.
 *
 * Sirve la carpeta public/ SIN backend ni base de datos, igual que lo haría un
 * hosting estático (Netlify, Vercel, GitHub Pages). Útil para verificar el
 * "modo demo" localmente antes de publicar.
 *
 *   node scripts/static-server.js          → http://localhost:5057
 *   node scripts/static-server.js 8080      → puerto personalizado
 *
 * NO usa la base de datos: las peticiones /api/* devuelven 404, lo que activa
 * el interceptor public/js/static-mode.js.
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.argv[2]) || 5057;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 — no encontrado</h1>');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`DEMO estática en http://localhost:${PORT}  (sirviendo ${ROOT})`);
});
