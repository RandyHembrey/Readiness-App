// Builds the hosted (shared-storage) single page: node demo/build-artifact.js [out.html]
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const inline = (f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '\n</script>\n';
const footer = '<div style="max-width:1100px;margin:-40px auto 30px;padding:0 16px;font-size:.75rem;color:var(--muted)">Working mock-up for development. Shared with everyone this page is shared with; changes save automatically.</div>\n';
const out = html
  .replace('<!doctype html>', '<!DOCTYPE html>')
  .replace('<div id="app"></div>', '<div id="app"></div>\n' + footer)
  .replace('<script>\n"use strict";', '<script>window.RACE_DEFER_BACKEND = true;</script>\n' + inline('seed.js') + inline('demo/demo-api.js') + inline('demo/db-api.js') + '<script>\n"use strict";')
  .replace('<title>Race Event To-Do</title>', '<title>USF Pro Championships · Event Readiness</title>');
const dest = process.argv[2] || path.join(root, 'demo/race-todo-artifact.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest);
