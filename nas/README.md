# Hembrey home apps (Synology NAS / Docker)

Personal apps served publicly at `*.hembrey.com` from the home NAS. There's **no Cloudflare**, and
DNS stays at GoDaddy. The internet can reach Caddy and nothing else.

```
Internet ─► GoDaddy DNS ─► router: WAN 80/443 only ─► NAS :8080/:8443 ─► Caddy (HTTPS)
                                                                          │  "edge" network
                                                         ┌────────────────┘
                                                         ▼  "apps" network (internal: no LAN, no internet)
                                       apps.hembrey.com → portal (static files)
                                       races.hembrey.com → race-todo:3000
```

| Path | What it is |
|---|---|
| `race-todo/` | Event readiness portal for Susanne, USF Pro Championships business manager (Node 24 + SQLite, no dependencies) |
| `race-todo/demo/race-todo-demo.html` | Single-file clickable demo with a mock season (no server; rebuild with `node race-todo/demo/build-demo.js`) |
| `apps-portal/html/` | `apps.hembrey.com` landing page. Edit `apps.json` to list apps |
| `caddy/Caddyfile` | The only public entry point: hostnames to apps, plus automatic Let's Encrypt |
| `docker-compose.yml` | The whole stack |

## Cloud mock-up (before the NAS is ready)

There's a hosted copy for developing the app with Susanne. It's a private claude.ai artifact page,
shared from its page on claude.ai, and anyone it's shared with as Contributor or Editor edits the
same live data. Rebuild it with `node race-todo/demo/build-artifact.js`. That inlines `seed.js`,
`demo/demo-api.js` (an offline fallback) and `demo/db-api.js` (shared storage) into one page. The
UI is the same `public/index.html` the NAS serves, so moving to the NAS means deploying the stack
below and re-entering (or exporting) the data.

## How it's walled off

| Layer | Protection |
|---|---|
| Router | Forwards **only** WAN 80 and 443, to the NAS's 8080 and 8443. DSM (5000/5001), SSH, SMB and everything else stay unreachable from outside. |
| DSM firewall | Allows 8080/8443 from anywhere. Allows everything else from the LAN only. Denies the rest. |
| Caddy | Serves only the hostnames in the Caddyfile. A request for the bare IP or any other name never reaches an app. |
| Docker networks | Apps run on an `internal` network, so they have **no route to your LAN, the internet or the NAS host**. Only Caddy can reach them. A compromised app can't go anywhere. |
| Containers | Read-only root filesystem, all Linux capabilities dropped, `no-new-privileges`, memory limits, and app code mounted read-only. Each app has only its own data folder. |
| App | Password sign-in, 30-day HTTP-only cookie, login rate limit, security headers and HTTPS everywhere. |

## Race Event To-Do: what it does

- **Dashboard:** active events, days to the next race, % complete, overdue count, tasks due in the
  next 7 days, an "open tasks by due week" chart (12 weeks plus an overdue bar), a
  "needs attention" list you can check off, and a progress bar for each event.
- **Events:** each new event starts as a copy of the standard checklist. Due dates are counted
  from race day (for example, −90 means 90 days before). You can add one-off tasks with a due date,
  category and owner, filter by open/overdue/due soon/done and by category, archive events, and
  move the race date. Moving the date shifts the open tasks' due dates with it.
- **Standard checklist** (seeded from `race-todo/seed.js`, editable in the app), built around
  Susanne's role as promoter/operator business manager:
  - **Venue Contract:** promoter agreement, track dates, COI exchange, paddock and hospitality
    allocations, the bilateral deliverables matrix (what the venue owes, what the promoter owes),
    the post-event compliance review and the settlement.
  - **Info Distribution:** supplemental regulations, schedule, paddock map, credentials, travel
    memos and bulletins for staff, competitors and partners.
  - **Banking:** venue deposit and balance wire, entry-fee reconciliation, prize fund, cash float,
    invoices, and the event P&L.
  - **Dept Readiness:** Technical, Logistics and Marketing milestones and sign-offs, plus the
    all-department go/no-go meeting.
  Each task has a default owner, and the event page can filter by owner (for example, "Marketing").
  To pull newly added tasks into an existing event, use "Sync standard list" on that event.
- **Next race readiness by area:** a progress bar for each of the four areas on the dashboard.
- `DEMO_DATA=1` loads a mock six-round USF Pro season into an empty database, for demos.
- Protected by one shared password (`RACE_TODO_PASSWORD`), with a 30-day sign-in cookie and a
  limit on login attempts.
- Data: `volumes/race-todo/race-todo.db` (SQLite). Back up that folder with Hyper Backup.

Run it locally: `cd race-todo && APP_PASSWORD=test node server.js` and open http://localhost:3000.

## One-time NAS setup (Randy, as an admin)

### 1. A dedicated shared folder and a least-privilege deploy user
Using your own admin account (or the existing `vaultbot`) for app work would give the
development tooling far more access than it needs. DSM has no per-app passwords, so the
equivalent is a **dedicated, non-admin user scoped to a single folder**:

1. Go to Control Panel → Shared Folder → Create, and name it **`apps`** (`/volume1/apps`). Hide it
   from My Network Places, and turn on the Recycle Bin and snapshots if you use them.
2. Go to Control Panel → User & Group → Create a user **`appdev`**:
   - Use a long random password (a password manager's 32+ characters). This acts as the "app secret".
   - Group: `users` only. **Not** `administrators`.
   - Shared folder permissions: **`apps` = Read/Write**. Every other share = **No access**
     (tick "No access" explicitly, so it holds even if group permissions change later).
   - Application permissions: allow **File Station** only, which the file API needs. Deny
     everything else (SMB, AFP, FTP, rsync, Synology Drive and so on), unless you want to edit
     over SMB from your Mac.
   - Quota: about 5 GB on `apps`.
3. Point the NAS connector at that user. In `/docker/synology_mcp`, add it as a second NAS entry
   (for example `"apps"`, same URL, `appdev` credentials) in `secrets.json`. You could also replace
   the credentials in its `.env`. Claude can then read and write `/apps` and nothing else.

Because the user isn't an admin, it **can't** create, stop or reconfigure containers. That
is intentional: it can only change files in `/apps`. The stack reloads itself when files
change (`caddy --watch`, `node --watch`), so code, portal and Caddyfile edits go live without
Container Manager. If an edit changes `docker-compose.yml` (for example, adding a new app), it
waits for you to click **Build** in Container Manager. Review the diff first, because the compose
file controls container privileges.

### 2. Deploy the stack
1. Copy this `nas/` folder's contents to `/volume1/apps/hembrey-apps/`. Use File Station, or once
   `appdev` exists Claude can write them through the connector.
2. In that folder, copy `.env.example` to `.env`. Set `ACME_EMAIL` and a strong `RACE_TODO_PASSWORD`,
   which is what Susanne signs in with.
3. Go to Container Manager → Project → Create → name `hembrey-apps` → path `/apps/hembrey-apps` →
   use the existing `docker-compose.yml` → Next → Done. It uses stock images
   (`caddy:2-alpine`, `node:24-alpine`), so there's nothing to compile.

### 3. Router (UniFi or other): two forwards and nothing else
| Name | WAN port | Forward to | Protocol |
|---|---|---|---|
| hembrey-apps-http | 80 | 192.168.10.72:8080 | TCP |
| hembrey-apps-https | 443 | 192.168.10.72:8443 | TCP + UDP |

Also check that UPnP/NAT-PMP is **off**, and that no forwards exist for 5000, 5001, 22, 445
or 6690. Port 80 must be open for Let's Encrypt; Caddy redirects it to HTTPS.

### 4. DSM firewall
Go to Control Panel → Security → Firewall → enable it and edit the rules, in this order:
1. Allow: ports 8080, 8443 (TCP) and 8443 (UDP), from all sources.
2. Allow: all ports, from source subnet `192.168.10.0/255.255.255.0` (your LAN; adjust if it's
   different).
3. Deny: everything else (set "If no rules are matched: Deny access").

Also go to Control Panel → Security → Protection, and turn on **Auto Block** (for example, 10
failed logins in 5 minutes).

### 5. GoDaddy DNS
In hembrey.com → DNS → Records:
- **Dynamic home IP (typical):** in DSM → External Access → DDNS, add a free Synology hostname,
  for example `hembrey-apps.synology.me`. That only gives your IP a name; it opens nothing.
  In GoDaddy, add `CNAME apps → hembrey-apps.synology.me` and `CNAME races → hembrey-apps.synology.me`.
- **Static IP:** add `A apps → <public IP>` and `A races → <public IP>`.

(GoDaddy's DNS API is closed to most accounts now, so a CNAME to a Synology DDNS name is the
reliable way to follow a changing IP.)

### 6. Check
- Open https://apps.hembrey.com, then click through to the portal.
- From **outside** your network (phone on cellular), check that `https://<your-ip>:5001`,
  `http://<your-ip>:5000` and `https://<your-ip>` all fail or time out. Only the two hostnames
  should answer.

## Adding another app
1. Put its code in `/apps/hembrey-apps/<app>/`.
2. Add a service to `docker-compose.yml` on `networks: [apps]` only, with no `ports:`, and the same
   hardening block as `race-todo`. If it really needs outbound internet, it needs its own small
   egress network. Don't attach it to `edge`.
3. Add `newapp.hembrey.com { import common; reverse_proxy <service>:<port> }` to the Caddyfile.
4. Add it to `apps-portal/html/apps.json`.
5. Add a GoDaddy CNAME for `newapp`, then click Build in Container Manager.

## Backups
App data lives in `/apps/hembrey-apps/volumes/`. Include the `apps` share in Hyper Backup.
For the race portal, `race-todo.db` (SQLite, WAL mode) is safe to copy as long as the
`-wal`/`-shm` files sit beside it.

Run locally: `cd race-todo && APP_PASSWORD=test node server.js`, then open http://localhost:3000.
