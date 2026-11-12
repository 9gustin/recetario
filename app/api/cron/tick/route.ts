import { NextResponse } from "next/server";
import { notifyUser } from "@/lib/push/send";
import { addDays, todayString } from "@/lib/domain/week";
import { hourAR } from "@/lib/domain/quiet-hours";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Lo llama pg_cron cada 15 minutos con `Authorization: Bearer $CRON_SECRET`: manda lo que ya venció. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();
  let sent = 0;

  // 1. Avisos programados (timers de cocina).
  const { data: due } = await admin
    .from("scheduled_pushes")
    .select("id, user_id, kind, title, body, url")
    .lte("fire_at", now.toISOString())
    .is("sent_at", null)
    .limit(200);
  for (const p of due ?? []) {
    await admin.from("scheduled_pushes").update({ sent_at: now.toISOString() }).eq("id", p.id);
    const kind = p.kind === "timer" ? "timers" : (p.kind as "prep" | "thaw" | "inbox");
    const r = await notifyUser(
      p.user_id,
      kind,
      { title: p.title, body: p.body ?? undefined, url: p.url ?? undefined },
      now,
    );
    sent += r.sent;
  }

  // 2. Preparaciones con recordatorio vencido y descongelar la noche anterior (a partir de las 20 h).
  const today = todayString(now);
  const tomorrow = addDays(today, 1);
  const { data: tasks } = await admin
    .from("prep_tasks")
    .select("id, title, kind, suggested_date, remind_at, meal_plans!inner(group_id, status)")
    .is("done_at", null)
    .is("reminded_at", null)
    .neq("meal_plans.status", "archived");
  for (const t of tasks ?? []) {
    const byRemind = t.remind_at !== null && new Date(t.remind_at) <= now;
    const thawTonight =
      t.kind === "thaw" &&
      t.remind_at === null &&
      t.suggested_date === tomorrow &&
      hourAR(now) >= 20;
    if (!byRemind && !thawTonight) continue;
    await admin.from("prep_tasks").update({ reminded_at: now.toISOString() }).eq("id", t.id);
    const { data: members } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", t.meal_plans.group_id);
    for (const m of members ?? []) {
      const r = await notifyUser(
        m.user_id,
        t.kind === "thaw" ? "thaw" : "prep",
        {
          title: t.kind === "thaw" ? "Descongelá para mañana" : "Preparación pendiente",
          body: t.title,
          url: `/g/${t.meal_plans.group_id}/hoy`,
          tag: `prep-${t.id}`,
        },
        now,
      );
      sent += r.sent;
    }
  }
  // Limpieza diaria: la actividad se guarda 90 días.
  if (now.getUTCMinutes() < 15 && hourAR(now) === 4) await admin.rpc("purge_old_activity");
  return NextResponse.json({ ok: true, sent });
}
