# Open items before deployment

Inputs still to come from Randy, and what each one unlocks. Nothing here is deployed yet;
the cloud mock-up keeps running in the meantime.

## From Randy

| # | Item | What it unlocks |
|---|------|-----------------|
| 1 | **Series regulations:** for each series, the rules that drive tasks and deadlines (entry/registration deadlines, tech/inspection requirements, licence and medical requirements, sanction paperwork, post-event reporting) | Series-specific standard tasks with the correct lead times |
| 2 | **Live Google Sheets (admin data):** entry lists, paid status, car numbers, classes, etc. Share access, and say which columns matter. | Entry and payment panels on the main dashboard and on each event (entries per series/class, unpaid entries, open car numbers) |
| 3 | **Which series run at each event:** the season calendar showing which series race at which round | Each event only gets the tasks and entry data for the series running there |
| 4 | **Full staff list:** name, role, department, email, phone | Real managers and owners on the Team tab; notification recipients |
| 5 | **Real season calendar:** dates and venues (the current rounds are placeholders) | Correct due dates everywhere |
| 6 | **Department list and managers confirmed:** Logistics = John, Tech & Operations = Darrel, Equipment = Julian, Business Office = Susanne, Marketing = to be named. Are there others? | Final ownership of every task |
| 7 | **Susanne's review of the standard checklist and lead times** | The checklist every event starts from |
| 9 | **Driver database:** ages (date of birth) and licence status (type, expiry), linked to entries/car numbers. Say where it lives today (a Sheet or another system). | A driver panel per event: licences expiring before race day, licences missing or invalid, and age-based eligibility flags. These can become tasks for the right department. **Note:** this is personal data that includes minors, so it needs tighter access (restricted roles, no full dates of birth in emails or reports) than the rest of the app. |
| 8 | **Venue contract deliverables:** the standard deliverables both sides commit to (a template is fine) | Venue Contract tasks matched to the real contract terms |

## Deployment prerequisites (when you're at a computer)

- [ ] Fix GitHub write access for Claude (install the Claude GitHub App with write permission), or push the bundle yourself
- [ ] NAS: create the `apps` shared folder and the least-privilege `appdev` user (see README)
- [ ] Router: forward WAN 80 and 443 to the NAS on 8080 and 8443; DSM firewall rules
- [ ] GoDaddy: Synology DDNS name, then `CNAME *` pointing to it
- [ ] Email: a sending mailbox (e.g. races@hembrey.com) with an app password, and SPF/DKIM in GoDaddy
- [ ] Decide how to read the Google Sheets from the NAS. The recommendation is a Google service account given read-only access to just those sheets, fetched by the app through a narrow outbound route like the mail relay.
- [ ] Move the NAS connector off the client's Cloudflare tunnel (e.g. Tailscale)
- [ ] Copy or export the mock-up data into the NAS version (or start fresh)

## Still to build once the inputs arrive

- A series model (series → classes) and an "event runs these series" setting, with series-specific standard tasks
- A Google Sheets sync: entries, paid/unpaid, car numbers and classes, shown on the dashboards (read-only; the Sheets stay the source of truth)
- A Staff directory: contacts and roles, linked to departments
- An export/import between the mock-up and the NAS version
