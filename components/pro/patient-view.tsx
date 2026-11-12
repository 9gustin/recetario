"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { RecipePicker } from "@/components/pro/recipe-picker";
import { Textarea } from "@/components/ui/textarea";
import { slotLabel, type MealSlot } from "@/lib/domain/meal-slots";
import { dayLabel, rangeDays } from "@/lib/domain/week";
import { endLink, sendPlanToPatient, sendRecipesToPatient } from "@/lib/pro/actions";
import type { DeliveryRow, PatientLog, ProLink, ProPlanRow } from "@/lib/pro/queries";

const STATUS_LABEL: Record<string, string> = {
  followed: "Lo siguió",
  changed: "Lo cambió",
  allowance: "Se dio un gusto",
  skipped: "No comió",
};

export function PatientView({
  link,
  plans,
  deliveries,
  log,
  from,
  to,
}: {
  link: ProLink;
  plans: ProPlanRow[];
  deliveries: DeliveryRow[];
  log: PatientLog | null;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<{ id: string; title: string }[]>([]);
  const [pending, start] = useTransition();

  const active = link.status === "active";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${link.token}`);
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function sendPlan() {
    start(async () => {
      const res = await sendPlanToPatient({ linkId: link.id, planId, message });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Plan enviado.");
      setMessage("");
      router.refresh();
    });
  }

  function sendRecipes() {
    start(async () => {
      const res = await sendRecipesToPatient({
        linkId: link.id,
        recipeIds: picked.map((p) => p.id),
        message,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Recetas enviadas.");
      setPicked([]);
      setMessage("");
      router.refresh();
    });
  }

  function end() {
    if (!window.confirm("¿Terminar el vínculo? Se corta el acceso al seguimiento.")) return;
    start(async () => {
      const res = await endLink({ linkId: link.id });
      if (!res.ok) return void toast.error(res.error);
      router.push("/pro");
    });
  }

  const days = rangeDays(from, to).reverse();
  const byDay = new Map<string, { slot: string; status: string; note: string | null }[]>();
  for (const l of log?.logs ?? []) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  const cookedByDay = new Map<string, string[]>();
  for (const c of log?.cooked ?? [])
    cookedByDay.set(c.date, [...(cookedByDay.get(c.date) ?? []), c.title]);

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      {!active ? (
        <section className="flex flex-col gap-2 rounded-[20px] bg-hero p-4">
          <p className="text-sm">
            {link.status === "invited"
              ? "Todavía no aceptó la invitación. Mandale este link:"
              : "El vínculo terminó."}
          </p>
          {link.status === "invited" ? (
            <PillButton size="md" onClick={() => void copyInvite()}>
              <Copy /> Copiar link de invitación
            </PillButton>
          ) : null}
        </section>
      ) : (
        <>
          <section aria-label="Enviar" className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-normal">Enviar</h2>
            <label htmlFor="send-message" className="text-sm font-medium">
              Mensaje (opcional)
            </label>
            <Textarea
              id="send-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej.: probá estas comidas esta semana"
            />
            {plans.length > 0 ? (
              <div className="flex items-center gap-2">
                <label htmlFor="send-plan" className="sr-only">
                  Plan a enviar
                </label>
                <select
                  id="send-plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <PillButton size="md" disabled={pending || !planId} onClick={sendPlan}>
                  Enviar plan
                </PillButton>
              </div>
            ) : (
              <p className="text-sm text-muted">Armá un plan en tu panel para poder enviarlo.</p>
            )}

            <h3 className="pt-2 text-sm font-bold">O un grupo de recetas</h3>
            {picked.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-[13px] font-semibold"
                  >
                    {p.title}
                    <button
                      type="button"
                      aria-label={`Quitar ${p.title}`}
                      onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}
                      className="flex size-9 items-center justify-center rounded-full"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <RecipePicker
              onPick={(r) => setPicked((x) => (x.some((y) => y.id === r.id) ? x : [...x, r]))}
            />
            <PillButton
              variant="outline"
              size="md"
              disabled={pending || picked.length === 0}
              onClick={sendRecipes}
            >
              Enviar {picked.length > 0 ? `${picked.length} recetas` : "recetas"}
            </PillButton>
          </section>

          <section aria-label="Seguimiento" className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-normal">Seguimiento</h2>
            {!log ? (
              <p className="rounded-2xl bg-hero px-4 py-3 text-sm">
                {link.label} todavía no te compartió su registro de comidas. Lo puede activar cuando
                quiera desde su perfil.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {days.map((d) => {
                  const entries = byDay.get(d) ?? [];
                  const cooked = cookedByDay.get(d) ?? [];
                  const empty = entries.length === 0 && cooked.length === 0;
                  return (
                    <li
                      key={d}
                      className="flex flex-col gap-0.5 rounded-2xl border border-border bg-surface px-3 py-2"
                    >
                      <span className="text-xs font-bold text-muted">{dayLabel(d)}</span>
                      {empty ? (
                        <span className="text-sm text-muted">Sin registro</span>
                      ) : (
                        <>
                          {entries.map((e) => (
                            <span key={e.slot} className="text-sm">
                              <strong>{slotLabel(e.slot as MealSlot)}:</strong>{" "}
                              {STATUS_LABEL[e.status] ?? e.status}
                              {e.note ? ` · ${e.note}` : ""}
                            </span>
                          ))}
                          {cooked.map((t) => (
                            <span key={t} className="text-sm text-muted">
                              Cocinó: {t}
                            </span>
                          ))}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {deliveries.length > 0 ? (
        <section aria-label="Envíos" className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-normal">Envíos</h2>
          <ul className="flex flex-col gap-1.5">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2.5"
              >
                <span className="text-[15px] font-semibold">{d.title}</span>
                <span className="text-xs text-muted">
                  {d.status === "pending"
                    ? "Pendiente"
                    : d.status === "accepted"
                      ? "Aceptado"
                      : "Descartado"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {link.status !== "revoked" ? (
        <PillButton variant="outline" size="md" disabled={pending} onClick={end}>
          Terminar vínculo
        </PillButton>
      ) : null}
    </div>
  );
}
