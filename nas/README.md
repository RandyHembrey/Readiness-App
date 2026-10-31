# Hembrey home apps (Synology NAS / Docker)

```
Internet ──► GoDaddy DNS ──► home router :80/:443 ──► NAS :8080/:8443 ──► Caddy
                                                                           ├─ apps.hembrey.com  → apps portal (static)
                                                                           └─ races.hembrey.com → race-todo:3000
```

| Path | What it is |
|---|---|
| `race-todo/` | Race Event To-Do portal for Susanne (Node 24 + SQLite, no dependencies) |
| `apps-portal/html/` | `apps.hembrey.com` landing page. Edit `apps.json` to list apps |
| `caddy/Caddyfile` | Reverse proxy with automatic Let's Encrypt HTTPS |
| `docker-compose.yml` | The whole stack |

## Race Event To-Do: what it does

- **Dashboard:** active events, days to the next race, % complete, overdue count, tasks due in the
  next 7 days, an "open tasks by due week" chart (12 weeks plus an overdue bar), a
  "needs attention" list you can check off, and a progress bar for each event.
- **Events:** each new event starts as a copy of the standard checklist. Due dates are counted
  from race day (for example, −90 means 90 days before). You can add one-off tasks with a due date,
  category and owner, filter by open/overdue/due soon/done and by category, archive events, and
  move the race date. Moving the date shifts the open tasks' due dates with it.
- **Standard checklist:** edit the default task list (about 30 race-director tasks are seeded:
  permits, insurance certificate, timing, EMS, volunteers, awards, post-event report and so on).
  To pull newly added tasks into an existing event, use "Sync standard list" on that event.
- Protected by one shared password (`RACE_TODO_PASSWORD`), with a 30-day sign-in cookie and a
  limit on login attempts.
- Data: `volumes/race-todo/race-todo.db` (SQLite). Back up that folder with Hyper Backup.

Run it locally: `cd race-todo && APP_PASSWORD=test node server.js` and open http://localhost:3000.

## Deploy on the NAS

1. **Copy files:** copy this `nas/` folder to `/volume1/docker/hembrey-apps/` (File Station, or
   `git clone` over SSH).
2. **Configure:** in that folder, copy `.env.example` to `.env` and set `ACME_EMAIL` and a strong
   `RACE_TODO_PASSWORD`.
3. **Create the project:** Container Manager → Project → Create → name `hembrey-apps` → path
   `/docker/hembrey-apps` → use the existing `docker-compose.yml` → Build. You can also run
   `sudo docker compose up -d --build` over SSH.
4. **Router port forwards:** forward WAN TCP 80 to 192.168.10.72:8080, and WAN TCP+UDP 443 to
   192.168.10.72:8443. (DSM already uses ports 80 and 443 on the NAS.) Let's Encrypt needs
   port 80 reachable to issue certificates.
5. **GoDaddy DNS:** in hembrey.com → DNS → Records:
   - **Static home IP:** add `A` records for `apps` and `races`, each pointing to your public IP.
   - **Dynamic home IP (most home connections):** in DSM → External Access → DDNS, create a
     free `yourname.synology.me` hostname. Then add `CNAME` records for `apps` and `races`, each
     pointing to `yourname.synology.me`. GoDaddy no longer offers its DNS API to most accounts,
     so a CNAME to Synology DDNS is the reliable way to keep the records current.
6. **Check:** open https://apps.hembrey.com, then click through to Race Event To-Do.
   Certificates are issued within a minute of the first request. If a certificate fails, check the
   `caddy` container log; usually port 80 isn't forwarded yet.

### Adding another app later
1. Add the service to `docker-compose.yml`. It doesn't need to publish any ports.
2. Add a `newapp.hembrey.com { import common; reverse_proxy newapp:PORT }` block to the Caddyfile.
3. Add an entry to `apps-portal/html/apps.json`.
4. Add an `A` or `CNAME` record for `newapp` in GoDaddy.

## Alternative: Cloudflare Tunnel (no open router ports)

The NAS already runs `cloudflared`. If you're willing to move hembrey.com's **nameservers**
(not the registration) from GoDaddy to Cloudflare's free plan, you can skip both the port
forwards and the DDNS. In Cloudflare Zero Trust → Tunnels → your tunnel → Public hostnames,
add `apps.hembrey.com` → `http://caddy:80` and `races.hembrey.com` → `http://caddy:80`.
Then make two changes:
- Attach the `cloudflared` container to the `hembrey-apps_default` network.
- In the Caddyfile, prefix both site addresses with `http://` so that Cloudflare handles TLS.

Cloudflare Tunnel hostnames need the zone on Cloudflare DNS. Keeping DNS at GoDaddy rules this
option out, which is why the main setup above uses Caddy.
