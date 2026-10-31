// Standard checklist + demo data for the USF Pro Championships business-manager portal.
// Shared by server.js (Node) and the static demo page (browser).
(function (root) {
  // [category, days relative to race weekend, task, default owner]
  var TEMPLATE = [
    // Venue contract & bilateral deliverables (promoter/operator <-> race track)
    ['Venue Contract', -240, 'Negotiate & execute venue promoter agreement', 'Business Office'],
    ['Venue Contract', -210, 'Confirm track rental dates & on-track session blocks with venue', 'Business Office'],
    ['Venue Contract', -180, 'Exchange certificates of insurance (promoter <-> venue)', 'Business Office'],
    ['Venue Contract', -150, 'Confirm paddock, garage & transporter parking allocation', 'Business Office'],
    ['Venue Contract', -120, 'Agree hospitality, suites, tickets & credential allocations', 'Business Office'],
    ['Venue Contract', -90, 'Mid-point review of bilateral deliverables matrix with venue', 'Business Office'],
    ['Venue Contract', -30, 'Venue deliverable confirmed: safety, medical, fire/rescue & corner workers', 'Business Office'],
    ['Venue Contract', -30, 'Venue deliverable confirmed: series signage placements & track branding', 'Business Office'],
    ['Venue Contract', -21, 'Promoter deliverables sent: schedule, entry list, logos, sanction docs', 'Business Office'],
    ['Venue Contract', -14, 'Final walk-through call with venue operations', 'Business Office'],
    ['Venue Contract', 3, 'Post-event venue debrief & deliverables compliance review', 'Business Office'],
    ['Venue Contract', 30, 'Venue financial settlement & contract close-out', 'Business Office'],
    // Pre-event information distribution
    ['Info Distribution', -90, 'Publish supplemental regulations to competitors', 'Business Office'],
    ['Info Distribution', -60, 'Send hotel & travel information to staff', 'Business Office'],
    ['Info Distribution', -45, 'Distribute partner activation brief to sponsors/partners', 'Business Office'],
    ['Info Distribution', -30, 'Publish schedule of events (staff, competitors, partners)', 'Business Office'],
    ['Info Distribution', -21, 'Publish paddock map, load-in plan & parking info', 'Business Office'],
    ['Info Distribution', -14, 'Send credential instructions to competitors, staff & partners', 'Business Office'],
    ['Info Distribution', -10, 'Staff travel memo & duty roster', 'Business Office'],
    ['Info Distribution', -7, 'Final competitor bulletin', 'Business Office'],
    ['Info Distribution', -3, 'Distribute race-weekend contact sheet', 'Business Office'],
    // Banking
    ['Banking', -230, 'Pay venue contract deposit', 'Business Office'],
    ['Banking', -120, 'Open event budget & cost codes', 'Business Office'],
    ['Banking', -60, 'Reconcile entry fees received vs. entry list', 'Business Office'],
    ['Banking', -30, 'Wire venue balance per contract terms', 'Business Office'],
    ['Banking', -14, 'Fund prize & point-fund account', 'Business Office'],
    ['Banking', -7, 'Order race-weekend cash float', 'Business Office'],
    ['Banking', 7, 'Pay vendor & venue invoices', 'Business Office'],
    ['Banking', 14, 'Distribute prize money & awards payments', 'Business Office'],
    ['Banking', 21, 'Reconcile event P&L and staff expense reports', 'Business Office'],
    // Department readiness
    ['Dept Readiness', -60, 'Tech & Ops: tech inspection plan, scales & fuel confirmed', 'Tech & Operations'],
    ['Dept Readiness', -30, 'Equipment: inventory spares, tools & radios; ship to venue', 'Equipment'],
    ['Dept Readiness', -14, 'Equipment: timing & scoring hardware tested', 'Equipment'],
    ['Dept Readiness', -30, 'Logistics: transporter & freight schedule confirmed', 'Logistics'],
    ['Dept Readiness', -30, 'Marketing: broadcast/streaming & content plan confirmed', 'Marketing'],
    ['Dept Readiness', -21, 'Marketing: partner signage & assets delivered to venue', 'Marketing'],
    ['Dept Readiness', -14, 'Logistics: hospitality & catering confirmed', 'Logistics'],
    ['Dept Readiness', -7, 'Tech & Operations readiness sign-off', 'Tech & Operations'],
    ['Dept Readiness', -7, 'Equipment readiness sign-off', 'Equipment'],
    ['Dept Readiness', -7, 'Logistics readiness sign-off', 'Logistics'],
    ['Dept Readiness', -7, 'Marketing readiness sign-off', 'Marketing'],
    ['Dept Readiness', -2, 'All-department go / no-go readiness meeting', 'Business Office'],
  ];

  // Departments own tasks; each has a responsible manager who gets reports and reminders.
  // Placeholder names until roles are firmed up; emails are filled in at deployment.
  var DEPARTMENTS = [
    { name: 'Business Office', manager: 'Susanne', full_report: 1 },
    { name: 'Logistics', manager: 'John' },
    { name: 'Tech & Operations', manager: 'Darrel' },
    { name: 'Equipment', manager: 'Julian' },
    { name: 'Marketing', manager: '' },
  ];

  // Mock season. Dates are relative to "today" so the demo always looks live.
  // done: fraction of past-due tasks already completed (the rest show as overdue).
  var DEMO_EVENTS = [
    { name: 'USF Pro Championships - Round 1', location: 'Sebring International Raceway', inDays: 26, done: 0.85,
      notes: 'Season opener. Venue contract countersigned; awaiting venue COI renewal.' },
    { name: 'USF Pro Championships - Round 2', location: 'NOLA Motorsports Park', inDays: 61, done: 0.8, notes: '' },
    { name: 'USF Pro Championships - Round 3', location: 'Barber Motorsports Park', inDays: 103, done: 0.9, notes: '' },
    { name: 'USF Pro Championships - Round 4', location: 'Indianapolis Motor Speedway (Road Course)', inDays: 138, done: 0.75, notes: 'Joint weekend: hospitality allocation shared with headline series.' },
    { name: 'USF Pro Championships - Round 5', location: 'Road America', inDays: 187, done: 1, notes: '' },
    { name: 'USF Pro Championships - Round 6', location: 'Mid-Ohio Sports Car Course', inDays: 222, done: 1, notes: '' },
  ];

  var api = { TEMPLATE: TEMPLATE, DEMO_EVENTS: DEMO_EVENTS, DEPARTMENTS: DEPARTMENTS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RACE_SEED = api;
})(this);
