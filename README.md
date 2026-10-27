# Pre-Event Readiness Checklist — standalone rebuild

A standalone version of the Pre-Event Readiness Checklist, backed by Supabase
instead of Claude's artifact database, meant to be hosted on Cloudflare Pages
from a GitHub repo.

Supabase project already created: `usac-pre-event-readiness`
(project ref `htddvcyexenhrfndhgwp`, org "USAC Road Racing").
Tables, RLS policies, and all of today's real roster/series-profile data
have already been migrated in. What's still needed from you is below —
these are gated behind Claude's own permission system as sensitive actions,
so they need to be done by hand rather than by Claude.

## 1. Run this SQL in the Supabase SQL Editor

Project dashboard → SQL Editor → paste and run:

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when lower(new.email) in ('randy@usacnation.com') then 'admin' else 'contributor' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null references events(slug) on delete cascade,
  dept_key text not null,
  text text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checklist_items_event_dept_idx on checklist_items(event_slug, dept_key);

alter table checklist_items enable row level security;
create policy "read_all_checklist_items" on checklist_items for select using (auth.role() = 'authenticated');
create policy "write_checklist_items_contributor" on checklist_items for insert with check (auth.role() = 'authenticated');
create policy "update_checklist_items_contributor" on checklist_items for update using (auth.role() = 'authenticated');
create policy "delete_checklist_items_contributor" on checklist_items for delete using (auth.role() = 'authenticated');

create or replace function public.enforce_checklist_before_ready() returns trigger
language plpgsql as $$
declare
  total int;
  remaining int;
begin
  if new.status = 'thumbsup' and (old.status is distinct from 'thumbsup') then
    select count(*), count(*) filter (where not done)
      into total, remaining
      from checklist_items
      where event_slug = new.event_slug and dept_key = new.dept_key;
    if total = 0 then
      raise exception 'Cannot mark % ready on % -- no checklist items have been created yet', new.dept_key, new.event_slug;
    end if;
    if remaining > 0 then
      raise exception 'Cannot mark % ready on % -- % checklist item(s) still unchecked', new.dept_key, new.event_slug, remaining;
    end if;
  end if;
  return new;
end;
$$;

create trigger checkpoints_enforce_checklist
  before update on checkpoints
  for each row execute procedure public.enforce_checklist_before_ready();
```

This also needs to run once after sign-in: the very first time you sign in
to the app, it creates your `app_users` row and makes `randy@usacnation.com`
an admin automatically. Everyone else who signs in becomes a contributor
(department head) by default — promote anyone else to admin later with:

```sql
update app_users set role = 'admin' where id = (select id from auth.users where email = 'someone@usacnation.com');
```

## 2. Enable email sign-in

Supabase dashboard → Authentication → Providers → make sure Email is on,
and under Authentication → URL Configuration, add the site URL you'll
deploy to (e.g. `https://readiness.usacnation.com`) so sign-in links point
to the right place.

## 3. Set the SMTP secrets for the daily nudge function

The `daily-nudges` Edge Function is already deployed, but it has no mail
credentials yet. Dashboard → Edge Functions → daily-nudges → Secrets
(or `supabase secrets set --project-ref htddvcyexenhrfndhgwp KEY=value`):

- `SMTP_USER` — the dedicated sending mailbox's address
- `SMTP_PASSWORD` — an app password for that mailbox (Google Workspace:
  create one at myaccount.google.com/apppasswords on that mailbox, or use
  Workspace's SMTP relay service if your admin prefers that)
- `SMTP_FROM` — usually the same as SMTP_USER
- `APP_URL` — the URL the app ends up at (for links in nudge emails)

Defaults assume `smtp.gmail.com:465`; set `SMTP_HOST` / `SMTP_PORT` too if
your mailbox uses something else.

## 4. Schedule the daily run

In the SQL Editor, once `pg_cron` and `pg_net` are enabled (Database →
Extensions):

```sql
select cron.schedule(
  'daily-nudges',
  '13 11 * * *', -- 7:13am US/Eastern, in UTC -- adjust for DST as needed
  $$
  select net.http_post(
    url := 'https://htddvcyexenhrfndhgwp.supabase.co/functions/v1/daily-nudges',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
  );
  $$
);
```

Get the service role key from Project Settings → API — keep it secret,
it bypasses RLS.

## 5. Put the code on GitHub

Create a new empty repo, then on its page use "Add file → Upload files"
and drag in everything in this folder (`index.html` and the `supabase/`
folder), committing straight to `main`.

## 6. Host it on Cloudflare Pages

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git →
pick the new repo. No build command; output directory `/`. Deploy —
Cloudflare gives it a `*.pages.dev` address immediately and redeploys on
every push after that.

To use your own domain via Route 53: Pages → your project → Custom domains
→ add the hostname, then add the CNAME record Cloudflare shows you in
Route 53. This works for a subdomain (e.g. `readiness.usacnation.com`);
a bare root domain needs Cloudflare's nameservers instead of a CNAME.
