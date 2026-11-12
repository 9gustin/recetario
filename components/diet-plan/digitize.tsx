"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Intake, type IntakePayload } from "@/components/food-profile/intake";
import { PillButton } from "@/components/shared/pill-button";
import { slotLabel } from "@/lib/domain/meal-slots";
import { activateDietPlan } from "@/lib/diet-plan/actions";
import type { DietPlanFull } from "@/lib/diet-plan/types";
import { usePlanChat } from "@/lib/hooks/use-plan-chat";
import { cn } from "@/lib/utils";

type Props = { initialPlan: DietPlanFull | null };

/** Digitalizar mi plan: 1) subir, 2) ajustar charlando, 3) confirmar. */
export function Digitize({ initialPlan }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<DietPlanFull | null>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [version, setVersion] = useState(0);
  const chat = usePlanChat({
    planId: plan?.id ?? null,
    endpoint: plan ? `/api/ai/diet-plan/${plan.id}/chat` : undefined,
    onDietUpdated: (v) => {
      setVersion(v);
      router.refresh();
    },
  });

  async function ingest(payload: IntakePayload) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/diet-plan/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { planId?: string; error?: string };
      if (!res.ok || !body.planId) throw new Error(body.error ?? "No pudimos leer el plan.");
      router.push(`/perfil/plan/digitalizar?plan=${body.planId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el plan.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    const res = await activateDietPlan({ planId: plan.id });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("¡Listo! Tu plan quedó activo.");
    router.push("/perfil/plan");
  }

  // Si el servidor trae el plan recién digitalizado (tras router.push), se toma de ahí.
  if (initialPlan && plan?.id !== initialPlan.id) setPlan(initialPlan);
  else if (initialPlan && initialPlan.version !== plan?.version) setPlan(initialPlan);

  if (!plan) {
    return (
      <div className="flex flex-col gap-4 px-5 pb-8">
        <h2 className="font-display text-[28px] leading-[1.05] font-normal">Digitalizar mi plan</h2>
        <p className="text-sm text-muted">
          1 · Subí el plan de tu nutricionista (PDF o foto), contalo o escribilo.
        </p>
        {busy ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Leyendo tu plan…
          </p>
        ) : (
          <Intake hasProfile={false} onSubmit={(p) => void ingest(p)} error={error} />
        )}
      </div>
    );
  }

  const mealCount = plan.meals.length;
  return (
    <div className="flex flex-col gap-4 px-5 pb-8" data-version={version}>
      <h2 className="font-display text-[28px] leading-[1.05] font-normal">Ajustá tu plan</h2>

      <div className="flex items-center gap-3 rounded-2xl bg-hero p-4" role="status">
        <FileText className="size-6 flex-none" aria-hidden="true" />
        <p className="text-sm">
          <span className="font-semibold">Leído</span> · {mealCount}{" "}
          {mealCount === 1 ? "comida" : "comidas"}
          {plan.rules.length ? ` · ${plan.rules.length} reglas` : ""}
          {plan.allowances.per_week ? ` · ${plan.allowances.per_week} permitidos por semana` : ""}
        </p>
      </div>
      {plan.summary ? <p className="text-sm text-muted">{plan.summary}</p> : null}

      <ul className="flex flex-col gap-2" aria-label="Comidas del plan">
        {plan.meals.map((m) => (
          <li key={m.id} className="rounded-2xl bg-surface p-3.5">
            <p className="text-[15px] font-semibold">{slotLabel(m.slot)}</p>
            <p className="text-sm text-muted">{m.formula}</p>
            {plan.swaps
              .filter((s) => s.meal_id === m.id)
              .map((s) => (
                <p key={s.id} className="mt-1 text-xs font-semibold text-accent">
                  {s.original} → {s.replacement}
                </p>
              ))}
          </li>
        ))}
      </ul>

      {plan.open_questions.length > 0 ? (
        <div className="rounded-2xl border border-border p-3.5">
          <p className="text-sm font-semibold">Quedaron dudas</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">
            {plan.open_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-label="Charla para ajustar" className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          2 · Contame qué querés cambiar. Por ejemplo: «no me gusta el yogur del desayuno».
        </p>
        {chat.messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
              m.role === "user" ? "self-end bg-hero" : "self-start bg-surface",
              m.failed && "border border-danger-soft/60",
            )}
          >
            {m.text}
            {m.working ? <span className="text-muted"> {m.working}</span> : null}
          </div>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = text.trim();
            if (!v) return;
            setText("");
            void chat.send(v);
          }}
        >
          <label htmlFor="diet-chat" className="sr-only">
            Qué querés ajustar de tu plan
          </label>
          <input
            id="diet-chat"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={chat.busy}
            placeholder="No me gusta el yogur…"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={chat.busy || !text.trim()}
            className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
          >
            <Send className="size-5" />
          </button>
        </form>
      </section>

      <PillButton fullWidth disabled={busy || chat.busy} onClick={confirm}>
        Ver cómo quedó mi plan y activarlo
      </PillButton>
    </div>
  );
}
