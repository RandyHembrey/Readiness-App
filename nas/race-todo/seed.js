// Standard checklist + demo data for the USF Pro Championships business-manager portal.
// Shared by server.js (Node) and the static demo page (browser).
(function (root) {
  // [category, days relative to race weekend, task, default owner]
  var TEMPLATE = [
    // Venue contract & bilateral deliverables (promoter/operator <-> race track)
    ['Venue Contract', -240, 'Negotiate & execute venue promoter agreement', 'Susanne'],
    ['Venue Contract', -210, 'Confirm track rental dates & on-track session blocks with venue', 'Susanne'],
    ['Venue Contract', -180, 'Exchange certificates of insurance (promoter <-> venue)', 'Susanne'],
    ['Venue Contract', -150, 'Confirm paddock, garage & transporter parking allocation', 'Susanne'],
    ['Venue Contract', -120, 'Agree hospitality, suites, tickets & credential allocations', 'Susanne'],
    ['Venue Contract', -90, 'Mid-point review of bilateral deliverables matrix with venue', 'Susanne'],
    ['Venue Contract', -30, 'Venue deliverable confirmed: safety, medical, fire/rescue & corner workers', 'Susanne'],
    ['Venue Contract', -30, 'Venue deliverable confirmed: series signage placements & track branding', 'Susanne'],
    ['Venue Contract', -21, 'Promoter deliverables sent: schedule, entry list, logos, sanction docs', 'Susanne'],
    ['Venue Contract', -14, 'Final walk-through call with venue operations', 'Susanne'],
    ['Venue Contract', 3, 'Post-event venue debrief & deliverables compliance review', 'Susanne'],
    ['Venue Contract', 30, 'Venue financial settlement & contract close-out', 'Susanne'],
    // Pre-event information distribution
    ['Info Distribution', -90, 'Publish supplemental regulations to competitors', 'Susanne'],
    ['Info Distribution', -60, 'Send hotel & travel information to staff', 'Susanne'],
    ['Info Distribution', -45, 'Distribute partner activation brief to sponsors/partners', 'Susanne'],
    ['Info Distribution', -30, 'Publish schedule of events (staff, competitors, partners)', 'Susanne'],
    ['Info Distribution', -21, 'Publish paddock map, load-in plan & parking info', 'Susanne'],
    ['Info Distribution', -14, 'Send credential instructions to competitors, staff & partners', 'Susanne'],
    ['Info Distribution', -10, 'Staff travel memo & duty roster', 'Susanne'],
    ['Info Distribution', -7, 'Final competitor bulletin', 'Susanne'],
    ['Info Distribution', -3, 'Distribute race-weekend contact sheet', 'Susanne'],
    // Banking
    ['Banking', -230, 'Pay venue contract deposit', 'Susanne'],
    ['Banking', -120, 'Open event budget & cost codes', 'Susanne'],
    ['Banking', -60, 'Reconcile entry fees received vs. entry list', 'Susanne'],
    ['Banking', -30, 'Wire venue balance per contract terms', 'Susanne'],
    ['Banking', -14, 'Fund prize & point-fund account', 'Susanne'],
    ['Banking', -7, 'Order race-weekend cash float', 'Susanne'],
    ['Banking', 7, 'Pay vendor & venue invoices', 'Susanne'],
    ['Banking', 14, 'Distribute prize money & awards payments', 'Susanne'],
    ['Banking', 21, 'Reconcile event P&L and staff expense reports', 'Susanne'],
    // Department readiness
    ['Dept Readiness', -60, 'Technical: tech inspection plan, scales & fuel confirmed', 'Technical'],
    ['Dept Readiness', -30, 'Logistics: transporter & freight schedule confirmed', 'Logistics'],
    ['Dept Readiness', -30, 'Marketing: broadcast/streaming & content plan confirmed', 'Marketing'],
    ['Dept Readiness', -21, 'Marketing: partner signage & assets delivered to venue', 'Marketing'],
    ['Dept Readiness', -14, 'Logistics: hospitality & catering confirmed', 'Logistics'],
    ['Dept Readiness', -7, 'Technical readiness sign-off', 'Technical'],
    ['Dept Readiness', -7, 'Logistics readiness sign-off', 'Logistics'],
    ['Dept Readiness', -7, 'Marketing readiness sign-off', 'Marketing'],
    ['Dept Readiness', -2, 'All-department go / no-go readiness meeting', 'Susanne'],
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

  var api = { TEMPLATE: TEMPLATE, DEMO_EVENTS: DEMO_EVENTS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RACE_SEED = api;
})(this);
