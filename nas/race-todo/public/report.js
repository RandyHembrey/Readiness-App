// Weekly status report + reminder builder, shared by the browser UI and the NAS server.
// state: { events, tasks, template, departments } as returned by /api/state.
(function (root) {
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function fmt(s) { return s ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'no date'; }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }

  // Tasks grouped for one department (or all when dept is null).
  function collect(state, dept, today, horizon) {
    var live = {}; state.events.forEach(function (e) { if (!e.archived) live[e.id] = e; });
    var mine = state.tasks.filter(function (t) { return live[t.event_id] && (!dept || t.owner === dept.name); });
    var weekAgo = addDays(today, -7), until = addDays(today, horizon || 14);
    return {
      overdue: mine.filter(function (t) { return !t.done && t.due_date && t.due_date < today; }),
      upcoming: mine.filter(function (t) { return !t.done && t.due_date && t.due_date >= today && t.due_date <= until; }),
      completed: mine.filter(function (t) { return t.done && t.done_at && t.done_at.slice(0, 10) >= weekAgo; }),
      open: mine.filter(function (t) { return !t.done; }).length,
      total: mine.length,
      events: live,
    };
  }
  function line(t, ev, today, showOwner) {
    var d = t.due_date ? daysBetween(today, t.due_date) : null;
    var when = d == null ? '' : d < 0 ? ' (' + -d + 'd overdue)' : d === 0 ? ' (today)' : '';
    return '  - ' + fmt(t.due_date) + ' · ' + t.title + when + '  [' + (ev ? ev.name : '') + (showOwner && t.owner ? ' · ' + t.owner : '') + ']';
  }
  function section(title, rows, c, today, showOwner) {
    if (!rows.length) return [];
    return [title + ' (' + rows.length + ')'].concat(rows.slice().sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; })
      .map(function (t) { return line(t, c.events[t.event_id], today, showOwner); }), ['']);
  }

  // Weekly report for one department (dept) or the whole program (dept null).
  function weeklyReport(state, dept, opts) {
    opts = opts || {};
    var today = opts.today || ymd(new Date()), c = collect(state, dept, today, 14);
    var who = dept ? dept.name + (dept.manager ? ' — ' + dept.manager : '') : 'All departments';
    var title = (opts.program || 'Event readiness') + ' · weekly status · ' + who;
    var next = Object.keys(c.events).map(function (k) { return c.events[k]; }).filter(function (e) { return e.event_date >= today; })
      .sort(function (a, b) { return a.event_date < b.event_date ? -1 : 1; })[0];
    var out = [title, 'Week of ' + fmt(today), ''];
    if (next) out.push('Next event: ' + next.name + (next.location ? ' — ' + next.location : '') + ', ' + fmt(next.event_date) + ' (' + daysBetween(today, next.event_date) + ' days)', '');
    out.push('Summary: ' + c.overdue.length + ' overdue · ' + c.upcoming.length + ' due in the next 2 weeks · ' + c.completed.length + ' completed last week · ' + c.open + ' open in total', '');
    if (!dept) {
      out.push('By department');
      (state.departments || []).forEach(function (d) {
        var dc = collect(state, d, today, 14);
        out.push('  - ' + d.name + (d.manager ? ' (' + d.manager + ')' : '') + ': ' + dc.overdue.length + ' overdue, ' + dc.upcoming.length + ' due soon, ' + dc.completed.length + ' done last week');
      });
      out.push('');
    }
    out = out.concat(section('OVERDUE', c.overdue, c, today, !dept), section('DUE IN THE NEXT 2 WEEKS', c.upcoming, c, today, !dept), section('COMPLETED LAST WEEK', c.completed, c, today, !dept));
    if (!c.overdue.length && !c.upcoming.length && !c.completed.length) out.push('Nothing due or completed this period.', '');
    if (opts.appUrl) out.push('Open the tracker: ' + opts.appUrl);
    return { subject: title, text: out.join('\n').trim() + '\n', counts: { overdue: c.overdue.length, upcoming: c.upcoming.length, completed: c.completed.length } };
  }

  // Daily reminder: tasks due today or tomorrow, plus anything overdue. Null when there is nothing to say.
  function dailyReminder(state, dept, opts) {
    opts = opts || {};
    var today = opts.today || ymd(new Date()), c = collect(state, dept, today, 1);
    if (!c.overdue.length && !c.upcoming.length) return null;
    var title = (opts.program || 'Event readiness') + ' · ' + (c.upcoming.length ? c.upcoming.length + ' due today/tomorrow' : '') +
      (c.upcoming.length && c.overdue.length ? ', ' : '') + (c.overdue.length ? c.overdue.length + ' overdue' : '') + ' · ' + dept.name;
    var out = ['Hi ' + (dept.manager || dept.name) + ',', ''].concat(section('DUE TODAY / TOMORROW', c.upcoming, c, today), section('OVERDUE', c.overdue, c, today));
    if (opts.appUrl) out.push('Open the tracker: ' + opts.appUrl);
    return { subject: title, text: out.join('\n').trim() + '\n' };
  }

  var api = { weeklyReport: weeklyReport, dailyReminder: dailyReminder };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.RACE_REPORT = api;
})(this);
