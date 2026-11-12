"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FAMILY_LABELS } from "@/lib/domain/food-families";
import { saveProfileEdits } from "@/lib/food-profile/actions";
import { searchIngredientSuggestions } from "@/lib/recipes/actions";
import type { FoodProfileData, Restriction } from "@/lib/schemas/food-profile";
import { Chip } from "./chips";

type Props = {
  data: FoodProfileData;
  summary: string | null;
  onChanged: (data: FoodProfileData, summary: string | null) => void;
};

type Suggestion = { label: string; target: string; type: Restriction["type"] };

/** Buscador del catálogo (ingredientes y familias) para sumar una restricción a mano. */
function AddRestriction({ onAdd }: { onAdd: (r: Restriction) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Restriction["severity"]>("forbidden");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  async function search(q: string) {
    setQuery(q);
    const norm = q.trim().toLowerCase();
    if (norm.length < 2) return setSuggestions([]);
    const families = Object.entries(FAMILY_LABELS)
      .filter(([key, label]) => key.includes(norm) || label.toLowerCase().includes(norm))
      .map(([key, label]) => ({
        label: `Familia: ${label}`,
        target: key,
        type: "family" as const,
      }));
    const res = await searchIngredientSuggestions({ q: norm });
    const ingredients = res.ok
      ? res.data.map((i) => ({ label: i.name, target: i.name, type: "ingredient" as const }))
      : [];
    setSuggestions([...ingredients, ...families].slice(0, 6));
  }

  function add(s: Suggestion) {
    onAdd({ target: s.target, type: s.type, severity });
    setOpen(false);
    setQuery("");
    setSuggestions([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 rounded-full border border-dashed border-border px-3 text-sm text-muted"
      >
        + agregar
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de restricción">
        <PillButton
          size="md"
          variant={severity === "forbidden" ? "primary" : "outline"}
          onClick={() => setSeverity("forbidden")}
          role="radio"
          aria-checked={severity === "forbidden"}
        >
          No como
        </PillButton>
        <PillButton
          size="md"
          variant={severity === "limit" ? "primary" : "outline"}
          onClick={() => setSeverity("limit")}
          role="radio"
          aria-checked={severity === "limit"}
        >
          Limito
        </PillButton>
      </div>
      <Input
        aria-label="Buscar ingrediente o familia"
        value={query}
        onChange={(e) => void search(e.target.value)}
        placeholder="Buscá un ingrediente o una familia…"
        className="min-h-12 text-base"
      />
      {suggestions.map((s) => (
        <button
          key={`${s.type}:${s.target}`}
          type="button"
          onClick={() => add(s)}
          className="min-h-11 rounded-xl px-3 text-left text-[15px] hover:bg-surface-2"
        >
          {s.label}
        </button>
      ))}
      {query.trim().length >= 2 && suggestions.length === 0 ? (
        <button
          type="button"
          onClick={() => add({ label: query, target: query.trim(), type: "category" })}
          className="min-h-11 rounded-xl px-3 text-left text-[15px] hover:bg-surface-2"
        >
          Agregar “{query.trim()}” tal cual
        </button>
      ) : null}
      <PillButton variant="outline" size="md" onClick={() => setOpen(false)}>
        Cancelar
      </PillButton>
    </div>
  );
}

/** Perfil guardado: resumen editable y restricciones, gustos y demás como chips que se pueden sacar. */
export function ProfileView({ data, summary, onChanged }: Props) {
  const [text, setText] = useState(summary ?? "");
  const [pending, start] = useTransition();

  function save(patch: Partial<FoodProfileData>, nextSummary?: string) {
    start(async () => {
      const res = await saveProfileEdits({ patch, summary: nextSummary });
      if (!res.ok) return void toast.error(res.error);
      onChanged({ ...data, ...patch }, nextSummary ?? summary);
    });
  }

  const forbidden = data.restrictions.filter((r) => r.severity === "forbidden");
  const limited = data.restrictions.filter((r) => r.severity === "limit");
  const removeRestriction = (target: Restriction) =>
    save({
      restrictions: data.restrictions.filter(
        (r) => !(r.target === target.target && r.type === target.type),
      ),
    });
  const label = (r: Restriction) => {
    const base = r.type === "family" ? (FAMILY_LABELS[r.target] ?? r.target) : r.target;
    const extra = r.includes?.length
      ? ` (+ ${r.includes.join(", ")})`
      : r.limit
        ? ` · ${r.limit}`
        : "";
    return `${base}${extra}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-2">
        <label
          htmlFor="profile-summary-edit"
          className="text-xs font-bold tracking-[0.1em] text-muted"
        >
          RESUMEN
        </label>
        <Textarea
          id="profile-summary-edit"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-24 text-base"
        />
        {text !== (summary ?? "") ? (
          <PillButton size="md" disabled={pending} onClick={() => save({}, text)}>
            Guardar resumen
          </PillButton>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-[0.1em] text-muted">NO COMÉS</h2>
        <div className="flex flex-wrap gap-2">
          {forbidden.map((r) => (
            <Chip
              key={`${r.type}:${r.target}`}
              tone="forbidden"
              label={label(r)}
              title={r.reason}
              onRemove={() => removeRestriction(r)}
            />
          ))}
          <AddRestriction onAdd={(r) => save({ restrictions: [...data.restrictions, r] })} />
        </div>
        <h2 className="mt-1 text-xs font-bold tracking-[0.1em] text-muted">LIMITÁS</h2>
        <div className="flex flex-wrap gap-2">
          {limited.length === 0 ? (
            <span className="text-sm text-muted">Nada por ahora.</span>
          ) : null}
          {limited.map((r) => (
            <Chip
              key={`${r.type}:${r.target}`}
              tone="limit"
              label={label(r)}
              onRemove={() => removeRestriction(r)}
            />
          ))}
        </div>
      </section>

      {data.goals.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-[0.1em] text-muted">OBJETIVOS</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.goals.map((g, i) => (
              <li key={i} className="rounded-xl bg-surface px-3 py-2">
                <strong className="font-semibold">{g.kind}</strong>
                {g.detail ? <span className="text-muted"> · {g.detail}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {[
        ["LE GUSTA", "likes", data.likes],
        ["NO LE GUSTA", "dislikes", data.dislikes],
        ["EQUIPAMIENTO", "equipment", data.equipment],
      ].map(([title, key, items]) =>
        (items as string[]).length > 0 ? (
          <section key={key as string} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-[0.1em] text-muted">{title as string}</h2>
            <div className="flex flex-wrap gap-2">
              {(items as string[]).map((item) => (
                <Chip
                  key={item}
                  tone="neutral"
                  label={item}
                  onRemove={() =>
                    save({
                      [key as string]: (items as string[]).filter((x) => x !== item),
                    } as Partial<FoodProfileData>)
                  }
                />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {data.schedule.weekday_cook_minutes_max ||
      data.schedule.weekend_cook_minutes_max ||
      data.valid_until ? (
        <section className="flex flex-col gap-1 text-sm text-muted">
          {data.schedule.weekday_cook_minutes_max ? (
            <p>En la semana cocinás hasta {data.schedule.weekday_cook_minutes_max} min.</p>
          ) : null}
          {data.schedule.weekend_cook_minutes_max ? (
            <p>El fin de semana, hasta {data.schedule.weekend_cook_minutes_max} min.</p>
          ) : null}
          {data.valid_until ? <p>Este plan vale hasta el {data.valid_until}.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
