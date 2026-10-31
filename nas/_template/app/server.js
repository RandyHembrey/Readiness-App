// Starter app for the Hembrey apps stack. Zero dependencies, Node >= 22.
// Data goes in DATA_DIR (/data in the container); APP_PASSWORD gates access.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PASSWORD = process.env.APP_PASSWORD || '';
fs.mkdirSync(DATA_DIR, { recursive: true });
const secretFile = path.join(DATA_DIR, '.session-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const token = () => { const v = String(Date.now() + 30 * 864e5); return v + '.' + sign(v); };
const valid = (t) => { if (!t) return false; const [v, s] = t.split('.'); return s === sign(v) && Number(v) > Date.now(); };
const cookie = (req, k) => (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find((c) => c[0] === k)?.[1];
const authed = (req) => !PASSWORD || valid(cookie(req, 'app_session'));

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') return res.end('ok');
  if (url.pathname === '/login' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    return req.on('end', () => {
      const pw = new URLSearchParams(body).get('password') || '';
      const ok = PASSWORD && pw.length === PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PASSWORD));
      res.writeHead(303, ok ? { Location: '/', 'Set-Cookie': `app_session=${token()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` } : { Location: '/?wrong=1' });
      res.end();
    });
  }
  if (!authed(req)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Sign in</title>
<form method=post action=/login style="font:16px system-ui;max-width:280px;margin:20vh auto;display:grid;gap:10px">
<b>__APP_TITLE__</b>${url.searchParams.has('wrong') ? '<span style=color:#d03b3b>Wrong password</span>' : ''}
<input type=password name=password placeholder=Password autofocus style="padding:8px"><button style="padding:8px">Sign in</button></form>`);
  }
  // ---- your app starts here ----
  const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('listening on', PORT));
