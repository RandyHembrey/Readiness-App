// Shared-storage backend for the hosted (claude.ai artifact) version.
// Same API surface as server.js, backed by the artifact's realtime document store,
// so everyone the artifact is shared with sees the same events and checklist live.
// Collections: template/{id}, events/{id}, tasks/{id}. Falls back to the
// browser-only demo when shared storage isn't available (e.g. signed out).
window.RACE_DEFER_BACKEND = true;
window.RACE_BACKEND_READY = (async function () {
  var db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
  if (!db) {
    window.RACE_DEMO_API = window.RACE_MAKE_LOCAL_API();
    window.RACE_BACKEND_NOTE = 'Offline demo: shared storage is unavailable here, so changes stay in this browser only.';
    return;
  }

  var cache = { template: {}, events: {}, tasks: {} };
  var chains = {};
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return ymd(d); }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clean(o) { var r = {}; for (var k in o) if (k !== 'id' && k !== 'event_name') r[k] = o[k] === undefined ? null : o[k]; return r; }

  function serial(path, fn) {
    var p = (chains[path] || Promise.resolve()).catch(function () {}).then(fn);
    chains[path] = p;
    return p;
  }
  function writeErr(e) {
    var code = e && e.code;
    if (code === 'invalid_argument') throw new Error('You have view-only access to this tracker.');
    if (code === 'quota_exceeded') throw new Error('Storage is full; delete old events to make room.');
    throw new Error('Could not save (' + (code || 'error') + '). Please try again.');
  }
  // optimistic local update, then one serialized write per document
  function put(coll, row) {
    cache[coll][row.id] = row;
    var body = clean(row);
    return serial(coll + '/' + row.id, function () { return db.doc(coll + '/' + row.id).set(body); }).catch(writeErr);
  }
  function del(coll, id) {
    delete cache[coll][id];
    return serial(coll + '/' + id, function () { return db.doc(coll + '/' + id).delete(); }).catch(writeErr);
  }
  async function inBatches(items, n, fn) { for (var i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(fn)); }

  // live subscriptions (once)
  var changeTimer = null, firstLoads = 0, resolveFirst;
  var firstLoad = new Promise(function (r) { resolveFirst = r; });
  var timeout = setTimeout(function () {
    window.RACE_BACKEND_NOTE = 'Shared data is taking a while to load; what you see may be incomplete.';
    resolveFirst();
  }, 10000);
  ['template', 'events', 'tasks'].forEach(function (coll) {
    var seen = false;
    db.collection(coll).onSnapshot(function (snap) {
      var next = {};
      snap.docs.forEach(function (d) { if (d.exists) { var o = Object.assign({}, d.data()); o.id = d.id; next[d.id] = o; } });
      cache[coll] = next;
      if (!seen && !snap.metadata.fromCache) { seen = true; if (++firstLoads === 3) { clearTimeout(timeout); resolveFirst(); } }
      clearTimeout(changeTimer);
      changeTimer = setTimeout(function () { if (window.RACE_ON_REMOTE_CHANGE) window.RACE_ON_REMOTE_CHANGE(); }, 250);
    }, function (e) {
      window.RACE_BACKEND_NOTE = 'Live updates stopped (' + (e && e.code) + '). Reload the page to reconnect.';
      clearTimeout(timeout); resolveFirst();
    });
  });
  await firstLoad;

  function vals(c) { return Object.keys(cache[c]).map(function (k) { return cache[c][k]; }); }
  function byDue(a, b) { var x = a.due_date || '9999', y = b.due_date || '9999'; return x < y ? -1 : x > y ? 1 : (a.sort_order || 0) - (b.sort_order || 0); }
  function sortedTemplate() { return vals('template').sort(function (a, b) { return a.offset_days - b.offset_days || (a.sort_order || 0) - (b.sort_order || 0); }); }
  function pick(o, b, k) { return b[k] !== undefined ? b[k] : o[k]; }
  async function copyTemplate(ev, onlyMissing) {
    var have = new Set(vals('tasks').filter(function (t) { return t.event_id === ev.id; }).map(function (t) { return String(t.title).toLowerCase(); }));
    var rows = sortedTemplate().filter(function (t) { return !onlyMissing || !have.has(String(t.title).toLowerCase()); }).map(function (t, i) {
      return { id: uid('t'), event_id: ev.id, title: t.title, category: t.category, due_date: addDays(ev.event_date, t.offset_days), owner: t.owner || '', notes: t.notes || '', sort_order: i, done: 0, done_at: null };
    });
    await inBatches(rows, 8, function (r) { return put('tasks', r); });
    return rows.length;
  }

  async function handle(method, url, b) {
    b = b || {};
    var m;
    if (url === '/api/me') return { authed: true, passwordRequired: false, title: 'USF Pro Championships · Event Readiness' };
    if (url === '/api/logout') return { ok: true };
    if (url === '/api/state') {
      var evs = vals('events');
      var names = {}; evs.forEach(function (e) { names[e.id] = e; });
      return {
        events: evs.sort(function (a, c) { return (a.archived || 0) - (c.archived || 0) || (a.event_date < c.event_date ? -1 : 1); }),
        tasks: vals('tasks').filter(function (t) { return names[t.event_id]; }).sort(byDue).map(function (t) { return Object.assign({}, t, { event_name: names[t.event_id].name, event_date: names[t.event_id].event_date }); }),
        template: sortedTemplate(),
      };
    }
    if (method === 'POST' && url === '/api/events') {
      if (!b.name || !b.event_date) throw new Error('Name and event date are required');
      var ev = { id: uid('e'), name: String(b.name).slice(0, 200), event_date: b.event_date, location: b.location || '', notes: b.notes || '', archived: 0, created_at: new Date().toISOString() };
      await put('events', ev);
      if (b.apply_template !== false) await copyTemplate(ev, false);
      return ev;
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)\/tasks$/))) {
      var t = { id: uid('t'), event_id: m[1], title: String(b.title || '').slice(0, 300), category: b.category || 'General', due_date: b.due_date || null, owner: b.owner || '', notes: b.notes || '', sort_order: 999, done: 0, done_at: null };
      if (!t.title) throw new Error('Title is required');
      await put('tasks', t); return t;
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)\/apply-template$/))) {
      return { added: await copyTemplate(cache.events[m[1]], true) };
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)$/))) {
      var id = m[1], e = cache.events[id];
      if (method === 'DELETE') {
        var mine = vals('tasks').filter(function (x) { return x.event_id === id; });
        await del('events', id);
        await inBatches(mine, 8, function (x) { return del('tasks', x.id); });
        return { ok: true };
      }
      var n = Object.assign({}, e), old = e.event_date;
      ['name', 'location', 'notes'].forEach(function (k) { n[k] = pick(e, b, k); });
      if (b.event_date) n.event_date = b.event_date;
      if (b.archived !== undefined) n.archived = b.archived ? 1 : 0;
      await put('events', n);
      if (b.shift_tasks && old !== n.event_date) {
        var delta = Math.round((Date.parse(n.event_date) - Date.parse(old)) / 864e5);
        var open = vals('tasks').filter(function (x) { return x.event_id === id && !x.done && x.due_date; });
        await inBatches(open, 8, function (x) { return put('tasks', Object.assign({}, x, { due_date: addDays(x.due_date, delta) })); });
      }
      return n;
    }
    if ((m = url.match(/^\/api\/tasks\/([\w-]+)$/))) {
      var tk = cache.tasks[m[1]];
      if (method === 'DELETE') { await del('tasks', m[1]); return { ok: true }; }
      var nt = Object.assign({}, tk);
      ['title', 'category', 'owner', 'notes'].forEach(function (k) { nt[k] = pick(tk, b, k); });
      if (b.due_date !== undefined) nt.due_date = b.due_date || null;
      if (b.done !== undefined) { nt.done_at = b.done ? (tk.done ? tk.done_at : new Date().toISOString()) : null; nt.done = b.done ? 1 : 0; }
      await put('tasks', nt); return nt;
    }
    if (method === 'POST' && url === '/api/template') {
      var tt = { id: uid('s'), title: String(b.title || '').slice(0, 300), category: b.category || 'General', offset_days: parseInt(b.offset_days, 10) || 0, owner: b.owner || '', notes: '', sort_order: 999 };
      if (!tt.title) throw new Error('Title is required');
      await put('template', tt); return tt;
    }
    if ((m = url.match(/^\/api\/template\/([\w-]+)$/))) {
      if (method === 'DELETE') { await del('template', m[1]); return { ok: true }; }
      var o = cache.template[m[1]], nn = Object.assign({}, o);
      ['title', 'category', 'owner', 'notes'].forEach(function (k) { nn[k] = pick(o, b, k); });
      if (b.offset_days !== undefined) nn.offset_days = parseInt(b.offset_days, 10) || 0;
      await put('template', nn); return nn;
    }
    throw new Error('Not supported');
  }

  window.RACE_DEMO_API = function (method, url, body) {
    return handle(method, url, body).then(function (out) { return JSON.parse(JSON.stringify(out)); });
  };
})();
