// Browser implementation of the server.js API, over a pluggable document store.
// Used by the offline demo (localStorage) and the hosted mock-up (shared realtime store).
// store: { all(coll) -> rows, get(coll, id) -> row|undefined, put(coll, row) -> Promise, del(coll, id) -> Promise, newId(prefix) }
// Collections: template, events, tasks. Task lead time: offset_days relative to race day (null = fixed due_date);
// template_id null = ad-hoc task.
window.RACE_MAKE_CORE = function (store, opts) {
  opts = opts || {};
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return ymd(d); }
  function intOrNull(v) { return v === null || v === '' || v === undefined || !isFinite(Number(v)) ? null : Math.trunc(Number(v)); }
  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function str(v, n) { return (v == null ? '' : String(v)).slice(0, n || 2000).trim(); }
  function pick(o, b, k) { return b[k] !== undefined ? b[k] : o[k]; }
  function byDue(a, b) { var x = a.due_date || '9999', y = b.due_date || '9999'; return x < y ? -1 : x > y ? 1 : (a.sort_order || 0) - (b.sort_order || 0); }
  function template() { return store.all('template').sort(function (a, b) { return a.offset_days - b.offset_days || (a.sort_order || 0) - (b.sort_order || 0); }); }
  function tasksOf(evId) { return store.all('tasks').filter(function (t) { return t.event_id === evId; }); }
  async function inBatches(items, n, fn) { for (var i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(fn)); }
  function fromTemplate(ev, t, i) {
    return { id: store.newId('t'), event_id: ev.id, title: t.title, category: t.category, due_date: addDays(ev.event_date, t.offset_days),
      offset_days: t.offset_days, template_id: t.id, owner: t.owner || '', notes: t.notes || '', sort_order: i, done: 0, done_at: null };
  }
  function linked(tasks, t) {
    return tasks.filter(function (x) { return x.template_id === t.id || (x.template_id == null && String(x.title).toLowerCase() === String(t.title).toLowerCase()); });
  }
  async function syncEvent(ev, templateIds, updateExisting) {
    var tasks = tasksOf(ev.id), adds = [], ups = [];
    template().forEach(function (t, i) {
      if (templateIds && templateIds.indexOf(t.id) === -1) return;
      var l = linked(tasks, t);
      if (!l.length) { adds.push(fromTemplate(ev, t, i)); return; }
      if (!updateExisting) return;
      l.filter(function (x) { return !x.done; }).forEach(function (x) {
        var due = addDays(ev.event_date, t.offset_days);
        if (x.title !== t.title || x.category !== t.category || x.owner !== (t.owner || '') || x.offset_days !== t.offset_days || x.due_date !== due || x.template_id !== t.id)
          ups.push(Object.assign({}, x, { title: t.title, category: t.category, owner: t.owner || '', offset_days: t.offset_days, due_date: due, template_id: t.id }));
      });
    });
    await inBatches(adds.concat(ups), 8, function (r) { return store.put('tasks', r); });
    return { added: adds.length, updated: ups.length };
  }

  async function handle(method, url, b) {
    b = b || {};
    var m;
    if (url === '/api/me') return { authed: true, passwordRequired: false, title: opts.title || 'Race Event To-Do' };
    if (url === '/api/logout') return { ok: true };
    if (url === '/api/state') {
      var evs = store.all('events'), byId = {};
      evs.forEach(function (e) { byId[e.id] = e; });
      return {
        events: evs.sort(function (a, c) { return (a.archived || 0) - (c.archived || 0) || (a.event_date < c.event_date ? -1 : 1); }),
        tasks: store.all('tasks').filter(function (t) { return byId[t.event_id]; }).sort(byDue)
          .map(function (t) { return Object.assign({ offset_days: null, template_id: null, notes: '', owner: '' }, t, { event_name: byId[t.event_id].name, event_date: byId[t.event_id].event_date }); }),
        template: template(),
      };
    }
    if (method === 'POST' && url === '/api/events') {
      if (!str(b.name) || !isYmd(b.event_date)) throw new Error('Name and event date are required');
      var ev = { id: store.newId('e'), name: str(b.name, 200), event_date: b.event_date, location: str(b.location, 200), notes: str(b.notes), archived: 0, created_at: new Date().toISOString() };
      await store.put('events', ev);
      if (b.apply_template !== false) await inBatches(template().map(function (t, i) { return fromTemplate(ev, t, i); }), 8, function (r) { return store.put('tasks', r); });
      return ev;
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)\/tasks$/))) {
      var e0 = store.get('events', m[1]);
      if (!e0) throw new Error('Event not found');
      if (!str(b.title)) throw new Error('Title is required');
      var off = intOrNull(b.offset_days);
      var t = { id: store.newId('t'), event_id: e0.id, title: str(b.title, 300), category: str(b.category, 80) || 'General',
        offset_days: off, due_date: off != null ? addDays(e0.event_date, off) : (isYmd(b.due_date) ? b.due_date : null),
        template_id: null, owner: str(b.owner, 100), notes: str(b.notes), sort_order: 999, done: 0, done_at: null };
      await store.put('tasks', t); return t;
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)\/apply-template$/))) {
      var ids = Array.isArray(b.template_ids) ? b.template_ids : null;
      return syncEvent(store.get('events', m[1]), ids, !!b.update_existing);
    }
    if ((m = url.match(/^\/api\/events\/([\w-]+)$/))) {
      var id = m[1], e = store.get('events', id);
      if (!e) throw new Error('Not found');
      if (method === 'DELETE') {
        var mine = tasksOf(id);
        await store.del('events', id);
        await inBatches(mine, 8, function (x) { return store.del('tasks', x.id); });
        return { ok: true };
      }
      var n = Object.assign({}, e);
      if (b.name !== undefined) n.name = str(b.name, 200) || e.name;
      if (b.location !== undefined) n.location = str(b.location, 200);
      if (b.notes !== undefined) n.notes = str(b.notes);
      if (isYmd(b.event_date)) n.event_date = b.event_date;
      if (b.archived !== undefined) n.archived = b.archived ? 1 : 0;
      await store.put('events', n);
      if (n.event_date !== e.event_date) {
        var delta = Math.round((Date.parse(n.event_date) - Date.parse(e.event_date)) / 864e5), moves = [];
        tasksOf(id).forEach(function (x) {
          if (x.done) return;
          if (x.offset_days != null) moves.push(Object.assign({}, x, { due_date: addDays(n.event_date, x.offset_days) }));
          else if (b.shift_tasks && x.due_date) moves.push(Object.assign({}, x, { due_date: addDays(x.due_date, delta) }));
        });
        await inBatches(moves, 8, function (r) { return store.put('tasks', r); });
      }
      return n;
    }
    if ((m = url.match(/^\/api\/tasks\/([\w-]+)$/))) {
      var tk = store.get('tasks', m[1]);
      if (!tk) throw new Error('Not found');
      if (method === 'DELETE') { await store.del('tasks', tk.id); return { ok: true }; }
      var ev2 = store.get('events', tk.event_id), nt = Object.assign({}, tk);
      if (b.title !== undefined) nt.title = str(b.title, 300) || tk.title;
      if (b.category !== undefined) nt.category = str(b.category, 80) || 'General';
      if (b.owner !== undefined) nt.owner = str(b.owner, 100);
      if (b.notes !== undefined) nt.notes = str(b.notes);
      if (b.offset_days !== undefined && intOrNull(b.offset_days) != null) { nt.offset_days = intOrNull(b.offset_days); nt.due_date = addDays(ev2.event_date, nt.offset_days); }
      else if (b.offset_days !== undefined || b.due_date !== undefined) { nt.offset_days = null; if (b.due_date !== undefined) nt.due_date = isYmd(b.due_date) ? b.due_date : null; }
      if (b.done !== undefined) { nt.done_at = b.done ? (tk.done ? tk.done_at : new Date().toISOString()) : null; nt.done = b.done ? 1 : 0; }
      await store.put('tasks', nt); return nt;
    }
    if (method === 'POST' && url === '/api/template') {
      if (!str(b.title)) throw new Error('Title is required');
      var tt = { id: store.newId('s'), title: str(b.title, 300), category: str(b.category, 80) || 'General', offset_days: intOrNull(b.offset_days) || 0, owner: str(b.owner, 100), notes: '', sort_order: 999 };
      await store.put('template', tt); return tt;
    }
    if ((m = url.match(/^\/api\/template\/([\w-]+)$/))) {
      var o = store.get('template', m[1]);
      if (!o) throw new Error('Not found');
      if (method === 'DELETE') { await store.del('template', o.id); return { ok: true }; }
      var nn = Object.assign({}, o);
      ['title', 'category', 'owner', 'notes'].forEach(function (k) { nn[k] = b[k] !== undefined ? str(b[k], 300) : o[k]; });
      if (!nn.title) nn.title = o.title;
      if (b.offset_days !== undefined) nn.offset_days = intOrNull(b.offset_days) || 0;
      await store.put('template', nn); return nn;
    }
    throw new Error('Not supported');
  }
  return function (method, url, body) {
    return handle(method, url, body).then(function (out) { return JSON.parse(JSON.stringify(out)); });
  };
};
