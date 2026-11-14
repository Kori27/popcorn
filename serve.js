// Minimal static server for running Sorozatnapló locally (no dependencies).
// Usage: node serve.js            -> http://localhost:5173
//        PORT=8080 node serve.js  -> http://localhost:8080
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8'
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(process.env.PORT || 5173, function () { console.log('Sorozatnapló: http://localhost:' + this.address().port); });
