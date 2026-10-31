# Operations portal: tools that would help, and the UI plan

A shortlist of what to build around the readiness tracker so Susanne can run the business side of
each event from one place. Grouped by what it fixes and roughly prioritised. These are suggestions
to pick from together, not commitments.

## Phase 1: quick wins for Susanne's role

1. **Contracts & deliverables tracker:** one record per contract (venue, sponsor, vendor) holding
   the parties, key dates, payment schedule, signed PDF and a **deliverables matrix** of who owes what
   to whom and by when. Each deliverable becomes a task with an owner and lead time. Renewal and expiry
   alerts. (DocuSign is already connected in Claude, so sending and tracking signatures could plug in later.)
2. **Payments ledger:** money expected (entry fees, sponsor payments) and money owed (venue
   deposit/balance, vendors, prize money), with due dates and paid/unpaid status. Overdue receivables
   show up on the dashboard. Prize money payout lists come from the results. (It's a tracker that sits
   beside the accounting system, not a replacement for it.)
3. **Document hub and distribution log:** current versions of the supplemental regulations, schedule,
   paddock map and bulletins for each event, plus a record of **who each version went to and when**.
   This closes the loop on the Info Distribution tasks.
4. **Insurance certificate (COI) and licence/permit tracker:** every certificate the promoter
   holds or owes (venue, vendors, sanction), with expiry dates and automatic reminders.
5. **"My tasks" and season calendar feed:** each manager sees only their department's open items,
   and the calendar can be subscribed to (an .ics link) so events and key deadlines appear in everyone's
   phone calendar.

## Phase 2: data hubs (the inputs you're gathering)

6. **Entries dashboard** (from the live Google Sheets): entries per series and class, unpaid entries,
   car number conflicts and late entries, on the main dashboard and on each event.
7. **Driver compliance:** ages and licence status checked against each event's series rules; flags
   for anything expiring before race day. (Restricted access, because it includes minors.)
8. **Team directory and CRM:** owners, contacts, cars, and balances owed, linked to entries and drivers.
9. **Track database:** facilities, layouts, capacities, contacts, nearby hotels, and notes from past
   events. A new event at a known track starts pre-filled.
10. **Staff directory:** roles, departments, contacts and emergency contacts. Feeds notifications and
    distribution lists.
11. **Distribution lists:** "all competitors at Round 3 in Series X", "all staff", "partners". Built from
    the hubs above so bulletins always reach the right people.

## Phase 3: at the track (mobile-first)

12. **Race-weekend run sheet:** the schedule of events as a live, phone-friendly timeline.
13. **Issue and incident log:** capture a problem with a photo in seconds, assign it to a department,
    and it carries into the debrief.
14. **Credentials and check-in:** allocations (from the venue contract) against what has been issued,
    with quick check-in for staff and teams.
15. **Travel and lodging:** hotel blocks, room lists, flights and rental cars per person per event, with
    a cost rollup.
16. **Post-event debrief:** what went well and what didn't, with one click to turn a lesson into a new
    standard checklist task.

## Phase 4: polish and control

17. **Event budget vs actual**, rolled up for the season.
18. **Sponsor proof of performance:** logo placements, activations and hospitality delivered, compiled
    into a report for each partner.
19. **Approvals:** purchases and expenses above a threshold go to the right person to sign off.
20. **Comments, @mentions and attachments on tasks,** plus a **change history** (who changed what, when).
21. **Meeting notes to action items:** Granola is already connected, so meeting action items could be
    turned into tasks.

## Questions that shape the build

- Which systems do you use today for **registration/entries**, **accounting** (QuickBooks? Xero?),
  **documents** (Google Drive?) and **e-signature**? The portal should link to them, not duplicate them.
- Who needs access besides Susanne and the department managers: staff, teams, partners? What should
  each be able to see?
- Is offline use at tracks with poor signal a must-have? (That shapes the mobile work below.)

## UI and mobile plan

- **One clean design system:** consistent type, spacing and colour, light and dark modes, and big readable
  numbers on dashboards. The current screens are a working draft of this.
- **Navigation:** a left sidebar on desktop (Dashboard, Events, Contracts, Money, Directory, Reports,
  Settings), and a **bottom tab bar on phones**.
- **A phone "Today" screen:** your overdue items and today's tasks, a countdown to the next event,
  one-tap check-off, a quick-add button, and a quick issue log.
- **Installable phone app (PWA):** add to the home screen and open full-screen. With **offline mode**, it
  keeps working at the track and syncs when signal returns.
- **At-event ergonomics:** large tap targets, high contrast for bright sun, and readable while walking
  the paddock.
- **Role-based views:** Susanne sees everything; a department manager lands on their own department; staff
  see their assignments.
