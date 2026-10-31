// Offline demo backend: the core API over localStorage, preloaded with a mock season.
window.RACE_MAKE_LOCAL_API = function () {
  var KEY = 'race-todo-demo-v3', SEED = window.RACE_SEED;
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return ymd(d); }
  var seq = 1;
  function fresh() {
    var data = { template: {}, events: {}, tasks: {}, departments: {} }, tmpl = [];
    SEED.DEPARTMENTS.forEach(function (d, i) { var r = { id: 'd' + (seq++), name: d.name, manager: d.manager || '', email: '', notify: 0, full_report: d.full_report ? 1 : 0, sort_order: i }; data.departments[r.id] = r; });
    SEED.TEMPLATE.forEach(function (t, i) { var r = { id: 's' + (seq++), category: t[0], offset_days: t[1], title: t[2], owner: t[3] || '', notes: '', sort_order: i }; data.template[r.id] = r; tmpl.push(r); });
    tmpl.sort(function (a, b) { return a.offset_days - b.offset_days || a.sort_order - b.sort_order; });
    var today = ymd(new Date()), soon = addDays(today, 21);
    SEED.DEMO_EVENTS.forEach(function (e, ei) {
      var ev = { id: 'e' + (seq++), name: e.name, event_date: addDays(today, e.inDays), location: e.location, notes: e.notes, archived: 0 };
      data.events[ev.id] = ev;
      tmpl.forEach(function (t, i) {
        var due = addDays(ev.event_date, t.offset_days), h = (ei * 31 + i * 17) % 100;
        var done = due < today ? h < e.done * 100 : (due < soon && h < 25);
        var r = { id: 't' + (seq++), event_id: ev.id, title: t.title, category: t.category, due_date: due, offset_days: t.offset_days, template_id: t.id, owner: t.owner, notes: '', sort_order: i, done: done ? 1 : 0, done_at: done ? new Date().toISOString() : null };
        data.tasks[r.id] = r;
      });
    });
    return data;
  }
  var data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!data) data = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  save();
  window.RACE_DEMO_RESET = function () { data = fresh(); save(); location.hash = ''; location.reload(); };
  var store = {
    all: function (c) { return Object.keys(data[c]).map(function (k) { return Object.assign({}, data[c][k]); }); },
    get: function (c, id) { return data[c][id] && Object.assign({}, data[c][id]); },
    put: function (c, row) { data[c][row.id] = JSON.parse(JSON.stringify(row)); save(); return Promise.resolve(); },
    del: function (c, id) { delete data[c][id]; save(); return Promise.resolve(); },
    newId: function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  };
  return window.RACE_MAKE_CORE(store, { title: 'USF Pro Championships · Event Readiness (demo)' });
};
if (!window.RACE_DEFER_BACKEND) window.RACE_DEMO_API = window.RACE_MAKE_LOCAL_API();
