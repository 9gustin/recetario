import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PREFS, shouldSend, type Prefs, type PushKind } from "@/lib/domain/quiet-hours";

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/** Manda un push a todos los dispositivos de la persona, respetando sus preferencias. Borra suscripciones muertas (404/410). */
export async function notifyUser(
  userId: string,
  kind: PushKind,
  payload: PushPayload,
  now: Date = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  if (!configure()) return { sent: 0, skipped: true };
  const admin = createAdminClient();
  const { data: prefRow } = await admin
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const prefs: Prefs = prefRow
    ? {
        prep: prefRow.prep,
        thaw: prefRow.thaw,
        timers: prefRow.timers,
        inbox: prefRow.inbox,
        quiet_start: prefRow.quiet_start,
        quiet_end: prefRow.quiet_end,
      }
    : DEFAULT_PREFS;
  if (!shouldSend(kind, prefs, now)) return { sent: 0, skipped: true };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } },
        JSON.stringify(payload),
        { TTL: 60 * 60 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return { sent, skipped: false };
}
