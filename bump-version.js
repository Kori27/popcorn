// Popcorn · Release helper: gives every CSS/JS link a new ?v= number and renames the service worker cache,
// so browsers always load matching HTML, CSS and JS after an update (GitHub Pages may cache files for minutes).
// Usage: node bump-version.js
'use strict';
const fs = require('fs'), path = require('path');
const root = __dirname;
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const current = +(sw.match(/popcorn-v(\d+)/) || [0, 0])[1];
const v = current + 1;

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=\d+)?"/g, (m, attr, file) => `${attr}="${file}?v=${v}"`);
fs.writeFileSync(path.join(root, 'index.html'), html);

let out = sw.replace(/popcorn-v\d+/, `popcorn-v${v}`)
  .replace(/'((?:css|js)\/[^'?]+\.(?:css|js))(?:\?v=\d+)?'/g, (m, file) => `'${file}?v=${v}'`);
fs.writeFileSync(path.join(root, 'sw.js'), out);
console.log('version', v);
