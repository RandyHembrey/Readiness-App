// Daily Pre-Event Readiness nudge job.
// Scheduled via pg_cron -> net.http_post against this function's URL (see
// migration_03_cron.sql). Mirrors the original Claude-automation logic:
//   - T-14 days before an event's start_date: nudge every department that
//     is active for that event's series and isn't marked Ready yet.
//   - T-10 days before: send Randy a results summary of what's still open.
// Departments inactive for an event's series (per series_profiles) are
// skipped entirely, not counted as "missing roster".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const DEPTS = [
  { key: "operations-competition", label: "Program Management" },
  { key: "operations", label: "Operations" },
  { key: "race-control", label: "Race Control & Competition" },
  { key: "safety-medical", label: "Safety & Medical" },
  { key: "logistics-equipment", label: "Logistics & Equipment" },
  { key: "entries-credentials", label: "Entries & Credentials" },
  { key: "technical", label: "Technical", dynamicOwner: "technicalManager" },
  { key: "staffing", label: "Staffing", dynamicOwner: "seriesManager" },
  { key: "customer-experience", label: "Customer Experience" },
  { key: "event-prep-complete", label: "Event Prep Complete", final: true },
];

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const start = new Date(dateStr + "T00:00:00Z");
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

function activeDeptsForEvent(series: string[], profiles: any[]) {
  return DEPTS.filter((d) => {
    if (d.final) return true;
    if (!series.length) return true;
    return series.some((s) => {
      const p = profiles.find((x) => x.series === s);
      if (!p || !Array.isArray(p.active_depts)) return true;
      return p.active_depts.includes(d.key);
    });
  });
}

function resolvePeople(series: string[], roster: any[]) {
  const out: { name: string; email: string }[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    const m = roster.find((x) => x.series === s);
    if (m && m.name && !seen.has(m.name.trim().toLowerCase())) {
      seen.add(m.name.trim().toLowerCase());
      out.push(m);
    }
  }
  return out;
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
    port: Number(Deno.env.get("SMTP_PORT") || 465),
    secure: true,
    auth: {
      user: Deno.env.get("SMTP_USER"),
      pass: Deno.env.get("SMTP_PASSWORD"),
    },
  });
  const fromAddress = Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER");

  const [{ data: events }, { data: deptHeads }, { data: seriesManagers },
    { data: technicalManagers }, { data: seriesProfiles }] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("department_heads").select("*"),
    supabase.from("series_managers").select("*"),
    supabase.from("technical_managers").select("*"),
    supabase.from("series_profiles").select("*"),
  ]);

  const log: string[] = [];
  let nudgesSent = 0;

  for (const ev of events || []) {
    const diff = daysUntil(ev.start_date);
    const series: string[] = Array.isArray(ev.series) ? ev.series.filter(Boolean) : [];
    const activeDepts = activeDeptsForEvent(series, seriesProfiles || []).filter((d) => !d.final);

    if (diff === 14) {
      const { data: checkpoints } = await supabase.from("checkpoints").select("*").eq("event_slug", ev.slug);
      const { data: items } = await supabase.from("checklist_items").select("*").eq("event_slug", ev.slug);

      for (const dept of activeDepts) {
        const cp = (checkpoints || []).find((c: any) => c.dept_key === dept.key);
        if (cp && cp.status === "thumbsup") continue; // already ready

        let recipients: { name: string; email: string }[] = [];
        if (dept.dynamicOwner === "seriesManager") recipients = resolvePeople(series, seriesManagers || []);
        else if (dept.dynamicOwner === "technicalManager") recipients = resolvePeople(series, technicalManagers || []);
        else {
          const h = (deptHeads || []).find((x: any) => x.dept_key === dept.key);
          if (h && h.name) recipients = [h];
        }
        recipients = recipients.filter((r) => r.email);

        const deptItems = (items || []).filter((i: any) => i.dept_key === dept.key);
        const itemsLine = deptItems.length
          ? `Checklist: ${deptItems.filter((i: any) => i.done).length}/${deptItems.length} items checked off so far.`
          : `No checklist has been created yet for this department on this event -- it can't be marked Ready until one exists.`;

        if (!recipients.length) {
          log.push(`SKIP (no roster contact) ${ev.slug} / ${dept.key}`);
          continue;
        }
        for (const r of recipients) {
          await transporter.sendMail({
            from: fromAddress,
            to: r.email,
            subject: `[T-14] ${dept.label} readiness needed -- ${ev.name}`,
            text: `Hi ${r.name},\n\n${ev.name} (${ev.location || ""}) starts ${ev.start_date} -- 14 days out.\n\n` +
              `${dept.label} isn't marked Ready yet. ${itemsLine}\n\n` +
              `Open the checklist to update it: ${Deno.env.get("APP_URL") || ""}/#${ev.slug}\n\n- Pre-Event Readiness automation`,
          });
          nudgesSent++;
          log.push(`NUDGE SENT ${ev.slug} / ${dept.key} -> ${r.email}`);
        }
      }
    }

    if (diff === 10) {
      const { data: checkpoints } = await supabase.from("checkpoints").select("*").eq("event_slug", ev.slug);
      const lines = activeDepts.map((d) => {
        const cp = (checkpoints || []).find((c: any) => c.dept_key === d.key);
        const status = cp && cp.status === "thumbsup" ? "READY" : cp && cp.status === "flag" ? "FLAGGED" : "NOT READY";
        return `  - ${d.label}: ${status}`;
      });
      const adminEmail = (deptHeads || []).find((h: any) => h.dept_key === "operations-competition")?.email;
      if (adminEmail) {
        await transporter.sendMail({
          from: fromAddress,
          to: adminEmail,
          subject: `[T-10] Readiness summary -- ${ev.name}`,
          text: `${ev.name} starts ${ev.start_date} -- 10 days out.\n\n${lines.join("\n")}\n\n- Pre-Event Readiness automation`,
        });
        log.push(`SUMMARY SENT ${ev.slug} -> ${adminEmail}`);
      }
    }
  }

  return new Response(JSON.stringify({ nudgesSent, log }), { headers: { "Content-Type": "application/json" } });
});
