// Race Event To-Do portal — zero-dependency Node server backed by SQLite.
// Requires Node >= 22.13 (built-in node:sqlite).
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_DAYS = 30;
const APP_TITLE = process.env.APP_TITLE || 'Race Event To-Do';
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- secret for signing session cookies (persisted so restarts keep you logged in)
const secretFile = path.join(DATA_DIR, '.session-secret');
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  SECRET = fs.readFileSync(secretFile, 'utf8').trim();
}

// ---------- database
const db = new DatabaseSync(path.join(DATA_DIR, 'race-todo.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS template_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  offset_days INTEGER NOT NULL DEFAULT 0,   -- days relative to event date (negative = before)
  notes TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,                  -- YYYY-MM-DD
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS event_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  due_date TEXT,                             -- YYYY-MM-DD
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  owner TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_tasks_event_idx ON event_tasks(event_id);
`);

const hasCol = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c);
if (!hasCol('template_tasks', 'owner')) db.exec("ALTER TABLE template_tasks ADD COLUMN owner TEXT NOT NULL DEFAULT ''");
// Lead time: offset_days relative to race day (NULL = fixed due date). template_id NULL = ad-hoc task.
if (!hasCol('event_tasks', 'offset_days')) db.exec('ALTER TABLE event_tasks ADD COLUMN offset_days INTEGER');
if (!hasCol('event_tasks', 'template_id')) db.exec('ALTER TABLE event_tasks ADD COLUMN template_id INTEGER');

// Seed the standard checklist the first time the app starts.
const { TEMPLATE, DEMO_EVENTS } = require('./seed');
if (db.prepare('SELECT COUNT(*) AS n FROM template_tasks').get().n === 0) {
  const ins = db.prepare('INSERT INTO template_tasks (category, offset_days, title, owner, sort_order) VALUES (?,?,?,?,?)');
  TEMPLATE.forEach((s, i) => ins.run(s[0], s[1], s[2], s[3] || '', i));
}

// ---------- helpers
const addDays = (ymd, n) => {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
};
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v, max = 2000) => (v == null ? '' : String(v)).slice(0, max).trim();

function sign(v) { return crypto.createHmac('sha256', SECRET).update(v).digest('base64url'); }
function makeSession() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const v = `u.${exp}`;
  return `${v}.${sign(v)}`;
}
function validSession(tok) {
  if (!tok) return false;
  const i = tok.lastIndexOf('.');
  const v = tok.slice(0, i), sig = tok.slice(i + 1);
  const good = sign(v);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(v.split('.')[1]) > Date.now();
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function authed(req) { return !APP_PASSWORD || validSession(cookies(req).rt_session); }

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

// naive login rate limiting per IP
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  attempts.set(ip, a);
  return a.length >= 10;
}

// Optional mock season for demos: DEMO_DATA=1 and an empty database.
if (process.env.DEMO_DATA === '1' && db.prepare('SELECT COUNT(*) AS n FROM events').get().n === 0) {
  const today = new Date().toISOString().slice(0, 10);
  const tmpl = db.prepare('SELECT * FROM template_tasks ORDER BY offset_days, sort_order, id').all();
  const insE = db.prepare('INSERT INTO events (name, event_date, location, notes) VALUES (?,?,?,?)');
  const insT = db.prepare('INSERT INTO event_tasks (event_id, title, category, due_date, owner, notes, sort_order, done, done_at, offset_days, template_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  DEMO_EVENTS.forEach((e, ei) => {
    const date = addDays(today, e.inDays);
    const id = insE.run(e.name, date, e.location, e.notes).lastInsertRowid;
    tmpl.forEach((t, i) => {
      const due = addDays(date, t.offset_days);
      // deterministic: most past-due tasks done, a few left open (overdue); a few early finishers
      const h = (ei * 31 + i * 17) % 100;
      const done = due < today ? h < e.done * 100 : (due < addDays(today, 21) && h < 25);
      insT.run(id, t.title, t.category, due, t.owner, '', i, done ? 1 : 0, done ? new Date().toISOString() : null, t.offset_days, t.id);
    });
  });
}

// ---------- API
function eventWithTasks(id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  ev.tasks = db.prepare('SELECT * FROM event_tasks WHERE event_id = ? ORDER BY due_date IS NULL, due_date, sort_order, id').all(id);
  return ev;
}

const intOrNull = (v) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);
const TEMPLATE_ORDER = 'SELECT * FROM template_tasks ORDER BY offset_days, sort_order, id';
const insertTask = db.prepare(`INSERT INTO event_tasks (event_id, title, category, due_date, owner, notes, sort_order, offset_days, template_id)
                               VALUES (?,?,?,?,?,?,?,?,?)`);
function addFromTemplate(ev, t, i) {
  return insertTask.run(ev.id, t.title, t.category, addDays(ev.event_date, t.offset_days), t.owner, t.notes, i, t.offset_days, t.id);
}
// A task counts as "from" a standard task if it is linked by id, or (older data) has the same title.
function templateMatch(tasks, t) {
  return tasks.filter((x) => x.template_id === t.id || (x.template_id == null && x.title.toLowerCase() === t.title.toLowerCase()));
}
// Add standard tasks the event is missing (optionally only some), and optionally refresh linked open tasks.
function syncEvent(ev, { templateIds = null, updateExisting = false } = {}) {
  const tasks = db.prepare('SELECT * FROM event_tasks WHERE event_id = ?').all(ev.id);
  const upd = db.prepare('UPDATE event_tasks SET title=?, category=?, owner=?, offset_days=?, due_date=?, template_id=? WHERE id=?');
  let added = 0, updated = 0;
  db.prepare(TEMPLATE_ORDER).all().forEach((t, i) => {
    if (templateIds && !templateIds.includes(t.id)) return;
    const linked = templateMatch(tasks, t);
    if (!linked.length) { addFromTemplate(ev, t, i); added++; return; }
    if (!updateExisting) return;
    linked.filter((x) => !x.done).forEach((x) => {
      const due = addDays(ev.event_date, t.offset_days);
      if (x.title !== t.title || x.category !== t.category || x.owner !== t.owner || x.offset_days !== t.offset_days || x.due_date !== due || x.template_id !== t.id) {
        upd.run(t.title, t.category, t.owner, t.offset_days, due, t.id, x.id); updated++;
      }
    });
  });
  return { added, updated };
}
function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

const routes = {
  'GET /api/state': () => {
    const events = db.prepare('SELECT * FROM events ORDER BY archived, event_date').all();
    const tasks = db.prepare(`SELECT t.*, e.name AS event_name, e.event_date FROM event_tasks t JOIN events e ON e.id = t.event_id
                              ORDER BY t.due_date IS NULL, t.due_date, t.sort_order, t.id`).all();
    const template = db.prepare(TEMPLATE_ORDER).all();
    return { events, tasks, template };
  },

  'POST /api/events': async (req) => {
    const b = await readJson(req);
    const name = str(b.name, 200);
    if (!name || !isYmd(b.event_date)) return [400, { error: 'Name and event date are required' }];
    return tx(() => {
      const { lastInsertRowid: id } = db.prepare('INSERT INTO events (name, event_date, location, notes) VALUES (?,?,?,?)')
        .run(name, b.event_date, str(b.location, 200), str(b.notes));
      if (b.apply_template !== false) {
        const ev = { id, event_date: b.event_date };
        db.prepare(TEMPLATE_ORDER).all().forEach((t, i) => addFromTemplate(ev, t, i));
      }
      return eventWithTasks(id);
    });
  },

  'PATCH /api/events/:id': async (req, id) => {
    const b = await readJson(req);
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!ev) return [404, { error: 'Not found' }];
    const next = {
      name: b.name !== undefined ? str(b.name, 200) || ev.name : ev.name,
      event_date: isYmd(b.event_date) ? b.event_date : ev.event_date,
      location: b.location !== undefined ? str(b.location, 200) : ev.location,
      notes: b.notes !== undefined ? str(b.notes) : ev.notes,
      archived: b.archived !== undefined ? (b.archived ? 1 : 0) : ev.archived,
    };
    tx(() => {
      db.prepare('UPDATE events SET name=?, event_date=?, location=?, notes=?, archived=? WHERE id=?')
        .run(next.name, next.event_date, next.location, next.notes, next.archived, id);
      if (next.event_date !== ev.event_date) {
        const upd = db.prepare('UPDATE event_tasks SET due_date = ? WHERE id = ?');
        const open = db.prepare('SELECT id, due_date, offset_days FROM event_tasks WHERE event_id = ? AND done = 0').all(id);
        const delta = Math.round((Date.parse(next.event_date) - Date.parse(ev.event_date)) / 864e5);
        open.forEach((r) => {
          if (r.offset_days != null) upd.run(addDays(next.event_date, r.offset_days), r.id);          // lead-time tasks always follow race day
          else if (b.shift_tasks && r.due_date) upd.run(addDays(r.due_date, delta), r.id);             // fixed dates move only if asked
        });
      }
    });
    return eventWithTasks(id);
  },

  'DELETE /api/events/:id': (req, id) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    return { ok: true };
  },

  // body: title, category, owner, notes, and either offset_days (lead time) or due_date (fixed)
  'POST /api/events/:id/tasks': async (req, id) => {
    const b = await readJson(req);
    const title = str(b.title, 300);
    if (!title) return [400, { error: 'Title is required' }];
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!ev) return [404, { error: 'Event not found' }];
    const off = intOrNull(b.offset_days);
    const due = off != null ? addDays(ev.event_date, off) : isYmd(b.due_date) ? b.due_date : null;
    const { lastInsertRowid } = insertTask.run(id, title, str(b.category, 80) || 'General', due, str(b.owner, 100), str(b.notes), 999, off, null);
    return db.prepare('SELECT * FROM event_tasks WHERE id = ?').get(lastInsertRowid);
  },

  'PATCH /api/tasks/:id': async (req, id) => {
    const b = await readJson(req);
    const t = db.prepare('SELECT t.*, e.event_date FROM event_tasks t JOIN events e ON e.id = t.event_id WHERE t.id = ?').get(id);
    if (!t) return [404, { error: 'Not found' }];
    const done = b.done !== undefined ? (b.done ? 1 : 0) : t.done;
    const doneAt = done ? (t.done ? t.done_at : new Date().toISOString()) : null;
    let off = t.offset_days, due = t.due_date;
    if (b.offset_days !== undefined && intOrNull(b.offset_days) != null) { off = intOrNull(b.offset_days); due = addDays(t.event_date, off); }
    else if (b.offset_days !== undefined || b.due_date !== undefined) { off = null; due = b.due_date !== undefined ? (isYmd(b.due_date) ? b.due_date : null) : due; }
    db.prepare('UPDATE event_tasks SET title=?, category=?, due_date=?, offset_days=?, owner=?, notes=?, done=?, done_at=? WHERE id=?').run(
      b.title !== undefined ? str(b.title, 300) || t.title : t.title,
      b.category !== undefined ? str(b.category, 80) || 'General' : t.category,
      due, off,
      b.owner !== undefined ? str(b.owner, 100) : t.owner,
      b.notes !== undefined ? str(b.notes) : t.notes,
      done, doneAt, id);
    return db.prepare('SELECT * FROM event_tasks WHERE id = ?').get(id);
  },

  'DELETE /api/tasks/:id': (req, id) => {
    db.prepare('DELETE FROM event_tasks WHERE id = ?').run(id);
    return { ok: true };
  },

  'POST /api/template': async (req) => {
    const b = await readJson(req);
    const title = str(b.title, 300);
    if (!title) return [400, { error: 'Title is required' }];
    const { lastInsertRowid } = db.prepare('INSERT INTO template_tasks (title, category, offset_days, owner, notes, sort_order) VALUES (?,?,?,?,?,?)')
      .run(title, str(b.category, 80) || 'General', intOrNull(b.offset_days) ?? 0, str(b.owner, 100), str(b.notes), 999);
    return db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(lastInsertRowid);
  },

  'PATCH /api/template/:id': async (req, id) => {
    const b = await readJson(req);
    const t = db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(id);
    if (!t) return [404, { error: 'Not found' }];
    db.prepare('UPDATE template_tasks SET title=?, category=?, offset_days=?, owner=?, notes=? WHERE id=?').run(
      b.title !== undefined ? str(b.title, 300) || t.title : t.title,
      b.category !== undefined ? str(b.category, 80) || 'General' : t.category,
      b.offset_days !== undefined ? intOrNull(b.offset_days) ?? 0 : t.offset_days,
      b.owner !== undefined ? str(b.owner, 100) : t.owner,
      b.notes !== undefined ? str(b.notes) : t.notes, id);
    return db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(id);
  },

  'DELETE /api/template/:id': (req, id) => {
    db.prepare('DELETE FROM template_tasks WHERE id = ?').run(id);
    return { ok: true };
  },

  // body: { template_ids?: [ids] (default: all), update_existing?: bool }
  'POST /api/events/:id/apply-template': async (req, id) => {
    const b = await readJson(req);
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!ev) return [404, { error: 'Not found' }];
    const ids = Array.isArray(b.template_ids) ? b.template_ids.map(Number) : null;
    return tx(() => syncEvent(ev, { templateIds: ids, updateExisting: !!b.update_existing }));
  },
};

function match(method, url) {
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const re = new RegExp('^' + pattern.replace(':id', '(\\d+)') + '$');
    const hit = url.match(re);
    if (hit) return { fn: routes[key], id: hit[1] ? Number(hit[1]) : undefined };
  }
  return null;
}

// ---------- static files
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ---------- server
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname === '/healthz') return send(res, 200, 'ok');

    if (pathname === '/api/login' && req.method === 'POST') {
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
      if (tooMany(ip)) return send(res, 429, { error: 'Too many attempts, try again later' });
      const b = await readJson(req);
      const given = Buffer.from(String(b.password || ''));
      const want = Buffer.from(APP_PASSWORD);
      if (!APP_PASSWORD || (given.length === want.length && crypto.timingSafeEqual(given, want))) {
        const secure = (req.headers['x-forwarded-proto'] || '') === 'https' ? '; Secure' : '';
        return send(res, 200, { ok: true }, {
          'Set-Cookie': `rt_session=${makeSession()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`,
        });
      }
      attempts.get(ip).push(Date.now());
      return send(res, 401, { error: 'Wrong password' });
    }
    if (pathname === '/api/logout') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'rt_session=; HttpOnly; Path=/; Max-Age=0' });
    }
    if (pathname === '/api/me') return send(res, 200, { authed: authed(req), passwordRequired: !!APP_PASSWORD, title: APP_TITLE });

    if (pathname.startsWith('/api/')) {
      if (!authed(req)) return send(res, 401, { error: 'Not signed in' });
      const r = match(req.method, pathname);
      if (!r) return send(res, 404, { error: 'Not found' });
      const out = await r.fn(req, r.id);
      if (Array.isArray(out)) return send(res, out[0], out[1]);
      return send(res, 200, out);
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Race To-Do listening on :${PORT}${APP_PASSWORD ? '' : ' (WARNING: no APP_PASSWORD set — open access)'}`));
