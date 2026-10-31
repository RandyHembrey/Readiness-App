#!/usr/bin/env node
// Register a new app on the Hembrey apps stack in one step:
//   node new-app.js <slug> "<Title>" "<Description>" [icon]
// e.g. node new-app.js recipes "Family Recipes" "Shared recipe box" 🍲
// Creates <slug>/ from _template (unless it exists), and adds:
//   - a hardened service on the internal "apps" network in docker-compose.yml
//   - a <slug>.hembrey.com block in caddy/Caddyfile
//   - a card in apps-portal/html/apps.json
//   - a <SLUG>_PASSWORD line in .env.example
// Then: set the password in .env and click Build in Container Manager (DNS is covered by the * wildcard).
'use strict';
const fs = require('fs'), path = require('path');
const [slug, title, desc = '', icon = '📦'] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{1,30}$/.test(slug || '') || !title) {
  console.error('usage: node new-app.js <slug> "<Title>" "<Description>" [icon]   (slug: lowercase letters, digits, -)');
  process.exit(1);
}
const root = __dirname, domain = process.env.APPS_DOMAIN || 'hembrey.com', host = `${slug}.${domain}`;
const envKey = slug.toUpperCase().replace(/-/g, '_') + '_PASSWORD';
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

// 1. app folder
const dir = path.join(root, slug);
if (!fs.existsSync(dir)) {
  fs.cpSync(path.join(root, '_template/app'), dir, { recursive: true });
  for (const f of ['server.js', 'public/index.html']) {
    const p = path.join(dir, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__APP_TITLE__', title).replaceAll('__APP_DESC__', desc).replaceAll('__APP_ICON__', icon));
  }
  console.log('created', slug + '/');
}

// 2. compose service
let compose = read('docker-compose.yml');
if (compose.includes(`\n  ${slug}:\n`)) console.log('compose: already has', slug);
else {
  compose = compose.trimEnd() + `

  ${slug}:
    image: node:24-alpine
    container_name: hembrey-${slug}
    restart: unless-stopped
    working_dir: /app
    command: node --watch-path=/app/server.js server.js
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATA_DIR: /data
      APP_PASSWORD: \${${envKey}:?set ${envKey} in .env}
    volumes:
      - ./${slug}:/app:ro
      - ./volumes/${slug}:/data
    networks: [apps]
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    cap_add: [DAC_OVERRIDE]
    security_opt: ["no-new-privileges:true"]
    mem_limit: 256m
`;
  write('docker-compose.yml', compose);
  console.log('compose: added service', slug);
}

// 3. Caddy route
let caddy = read('caddy/Caddyfile');
if (caddy.includes(host + ' {')) console.log('caddy: already routes', host);
else { write('caddy/Caddyfile', caddy.trimEnd() + `\n\n${host} {\n\timport common\n\treverse_proxy ${slug}:3000\n}\n`); console.log('caddy: added', host); }

// 4. portal card
const apps = JSON.parse(read('apps-portal/html/apps.json'));
if (apps.some((a) => a.url === `https://${host}`)) console.log('portal: already lists', host);
else { apps.push({ name: title, description: desc, url: `https://${host}`, icon }); write('apps-portal/html/apps.json', JSON.stringify(apps, null, 2) + '\n'); console.log('portal: added card'); }

// 5. env example
let env = read('.env.example');
if (!env.includes(envKey + '=')) { write('.env.example', env.trimEnd() + `\n# Sign-in password for ${title}\n${envKey}=change-me-long-passphrase\n`); console.log('.env.example: added', envKey); }

console.log(`\nNext:\n  1. DNS: nothing to do if the GoDaddy wildcard (*) record exists; else CNAME ${slug} -> your DDNS name\n  2. NAS .env: set ${envKey}\n  3. Container Manager -> hembrey-apps -> Build (review the compose diff first)\n  4. Open https://${host}`);
