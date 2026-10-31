// In-browser stand-in for server.js so the UI can be demoed as a single static page.
// Data lives in localStorage; "Reset demo" in the footer restores the mock season.
(function () {
  var KEY = 'race-todo-demo-v1';
  var SEED = window.RACE_SEED;
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return ymd(d); }
  function fresh() {
    var db = { seq: 1, template: [], events: [], tasks: [] };
    SEED.TEMPLATE.forEach(function (t, i) { db.template.push({ id: db.seq++, category: t[0], offset_days: t[1], title: t[2], owner: t[3] || '', notes: '', sort_order: i }); });
    var today = ymd(new Date()), soon = addDays(today, 21);
    SEED.DEMO_EVENTS.forEach(function (e, ei) {
      var ev = { id: db.seq++, name: e.name, event_date: addDays(today, e.inDays), location: e.location, notes: e.notes, archived: 0 };
      db.events.push(ev);
      db.template.forEach(function (t, i) {
        var due = addDays(ev.event_date, t.offset_days), hsh = (ei * 31 + i * 17) % 100;
        var done = due < today ? hsh < e.done * 100 : (due < soon && hsh < 25);
        db.tasks.push({ id: db.seq++, event_id: ev.id, title: t.title, category: t.category, due_date: due, owner: t.owner, notes: '', sort_order: i, done: done ? 1 : 0, done_at: done ? new Date().toISOString() : null });
      });
    });
    return db;
  }
  var db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!db) db = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  save();
  window.RACE_DEMO_RESET = function () { db = fresh(); save(); location.hash = ''; location.reload(); };

  function byDue(a, b) { return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : (a.due_date || '9999') > (b.due_date || '9999') ? 1 : a.sort_order - b.sort_order; }
  function evName(t) { var e = db.events.find(function (x) { return x.id === t.event_id; }); return Object.assign({}, t, { event_name: e.name, event_date: e.event_date }); }
  function pick(o, b, k) { return b[k] !== undefined ? b[k] : o[k]; }
  function copyTemplate(ev, onlyMissing) {
    var have = new Set(db.tasks.filter(function (t) { return t.event_id === ev.id; }).map(function (t) { return t.title.toLowerCase(); }));
    var added = 0;
    db.template.slice().sort(function (a, b) { return a.offset_days - b.offset_days; }).forEach(function (t, i) {
      if (onlyMissing && have.has(t.title.toLowerCase())) return;
      db.tasks.push({ id: db.seq++, event_id: ev.id, title: t.title, category: t.category, due_date: addDays(ev.event_date, t.offset_days), owner: t.owner, notes: t.notes, sort_order: i, done: 0, done_at: null });
      added++;
    });
    return added;
  }

  function handle(method, url, b) {
    b = b || {};
    var m, id;
    if (url === '/api/me') return { authed: true, passwordRequired: false, title: 'USF Pro Championships · Event Readiness (demo)' };
    if (url === '/api/state') return {
      events: db.events.slice().sort(function (a, c) { return a.archived - c.archived || (a.event_date < c.event_date ? -1 : 1); }),
      tasks: db.tasks.slice().sort(byDue).map(evName),
      template: db.template.slice().sort(function (a, c) { return a.offset_days - c.offset_days || a.sort_order - c.sort_order; }),
    };
    if (method === 'POST' && url === '/api/events') {
      if (!b.name || !b.event_date) throw new Error('Name and event date are required');
      var ev = { id: db.seq++, name: b.name, event_date: b.event_date, location: b.location || '', notes: b.notes || '', archived: 0 };
      db.events.push(ev);
      if (b.apply_template !== false) copyTemplate(ev, false);
      return ev;
    }
    if ((m = url.match(/^\/api\/events\/(\d+)$/))) {
      id = +m[1];
      var e = db.events.find(function (x) { return x.id === id; });
      if (method === 'DELETE') { db.events = db.events.filter(function (x) { return x.id !== id; }); db.tasks = db.tasks.filter(function (t) { return t.event_id !== id; }); return { ok: true }; }
      var old = e.event_date;
      ['name', 'location', 'notes'].forEach(function (k) { e[k] = pick(e, b, k); });
      if (b.event_date) e.event_date = b.event_date;
      if (b.archived !== undefined) e.archived = b.archived ? 1 : 0;
      if (b.shift_tasks && old !== e.event_date) {
        var delta = Math.round((Date.parse(e.event_date) - Date.parse(old)) / 864e5);
        db.tasks.forEach(function (t) { if (t.event_id === id && !t.done && t.due_date) t.due_date = addDays(t.due_date, delta); });
      }
      return e;
    }
    if ((m = url.match(/^\/api\/events\/(\d+)\/tasks$/))) {
      var t = { id: db.seq++, event_id: +m[1], title: b.title, category: b.category || 'General', due_date: b.due_date || null, owner: b.owner || '', notes: b.notes || '', sort_order: 999, done: 0, done_at: null };
      db.tasks.push(t); return t;
    }
    if ((m = url.match(/^\/api\/events\/(\d+)\/apply-template$/))) {
      return { added: copyTemplate(db.events.find(function (x) { return x.id === +m[1]; }), true) };
    }
    if ((m = url.match(/^\/api\/tasks\/(\d+)$/))) {
      id = +m[1];
      if (method === 'DELETE') { db.tasks = db.tasks.filter(function (x) { return x.id !== id; }); return { ok: true }; }
      var tk = db.tasks.find(function (x) { return x.id === id; });
      ['title', 'category', 'owner', 'notes'].forEach(function (k) { tk[k] = pick(tk, b, k); });
      if (b.due_date !== undefined) tk.due_date = b.due_date || null;
      if (b.done !== undefined) { tk.done_at = b.done ? (tk.done ? tk.done_at : new Date().toISOString()) : null; tk.done = b.done ? 1 : 0; }
      return tk;
    }
    if (method === 'POST' && url === '/api/template') {
      var nt = { id: db.seq++, title: b.title, category: b.category || 'General', offset_days: parseInt(b.offset_days, 10) || 0, owner: b.owner || '', notes: '', sort_order: 999 };
      db.template.push(nt); return nt;
    }
    if ((m = url.match(/^\/api\/template\/(\d+)$/))) {
      id = +m[1];
      if (method === 'DELETE') { db.template = db.template.filter(function (x) { return x.id !== id; }); return { ok: true }; }
      var tt = db.template.find(function (x) { return x.id === id; });
      ['title', 'category', 'owner', 'notes'].forEach(function (k) { tt[k] = pick(tt, b, k); });
      if (b.offset_days !== undefined) tt.offset_days = parseInt(b.offset_days, 10) || 0;
      return tt;
    }
    if (url === '/api/logout') return { ok: true };
    throw new Error('Not available in demo');
  }

  window.RACE_DEMO_API = function (method, url, body) {
    return new Promise(function (resolve, reject) {
      try { var out = handle(method, url, body); save(); resolve(JSON.parse(JSON.stringify(out))); }
      catch (e) { reject(e); }
    });
  };
})();
