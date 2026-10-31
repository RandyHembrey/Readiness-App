// Builds a single self-contained demo page: node demo/build-demo.js [out.html]
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const inline = (f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '\n</script>\n';
const footer = '<div style="max-width:1100px;margin:-40px auto 30px;padding:0 16px;font-size:.78rem;color:var(--muted)">Demo with mock data, saved in this browser only. <a href="#" onclick="event.preventDefault();RACE_DEMO_RESET()">Reset demo data</a></div>\n';
const out = html
  .replace('<div id="app"></div>', '<div id="app"></div>\n' + footer)
  .replace('<script>\n"use strict";', inline('seed.js') + inline('demo/demo-api.js') + '<script>\n"use strict";')
  .replace('<title>Race Event To-Do</title>', '<title>USF Pro Championships · Event Readiness (demo)</title>');
const dest = process.argv[2] || path.join(root, 'demo/race-todo-demo.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest);
