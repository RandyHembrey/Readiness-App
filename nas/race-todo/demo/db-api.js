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

  var cache = { template: {}, events: {}, tasks: {}, departments: {} };
  var chains = {};
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

  // live subscriptions (once)
  var changeTimer = null, firstLoads = 0, resolveFirst;
  var firstLoad = new Promise(function (r) { resolveFirst = r; });
  var timeout = setTimeout(function () {
    window.RACE_BACKEND_NOTE = 'Shared data is taking a while to load; what you see may be incomplete.';
    resolveFirst();
  }, 10000);
  ['template', 'events', 'tasks', 'departments'].forEach(function (coll) {
    var seen = false;
    db.collection(coll).onSnapshot(function (snap) {
      var next = {};
      snap.docs.forEach(function (d) { if (d.exists) { var o = Object.assign({}, d.data()); o.id = d.id; next[d.id] = o; } });
      cache[coll] = next;
      if (!seen && !snap.metadata.fromCache) { seen = true; if (++firstLoads === 4) { clearTimeout(timeout); resolveFirst(); } }
      clearTimeout(changeTimer);
      changeTimer = setTimeout(function () { if (window.RACE_ON_REMOTE_CHANGE) window.RACE_ON_REMOTE_CHANGE(); }, 250);
    }, function (e) {
      window.RACE_BACKEND_NOTE = 'Live updates stopped (' + (e && e.code) + '). Reload the page to reconnect.';
      clearTimeout(timeout); resolveFirst();
    });
  });
  await firstLoad;

  var store = {
    all: function (c) { return Object.keys(cache[c]).map(function (k) { return Object.assign({}, cache[c][k]); }); },
    get: function (c, id) { return cache[c][id] && Object.assign({}, cache[c][id]); },
    put: put, del: del, newId: uid,
  };
  var core = window.RACE_MAKE_CORE(store, { title: 'USF Pro Championships · Event Readiness' });

  window.RACE_DEMO_API = core;
})();
