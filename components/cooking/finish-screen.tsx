"use client";

import { useRef, useState } from "react";
import { Camera, PartyPopper, Star } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FinishPayload = {
  rating?: number;
  note?: string;
  photo: File | null;
  useAsCover: boolean;
  saveToRecipe: boolean;
};

type Props = {
  recipeTitle: string;
  /** Cuándo tocó "Empezar" (ms), para mostrar cuánto tardó. */
  startedAt: number | null;
  /** Una línea por ajuste hecho cocinando (vacío si no cambió nada). */
  changes: string[];
  recipeHasPhoto: boolean;
  onFinish: (payload: FinishPayload) => Promise<void>;
};

/** Pantalla final: tiempo real, resumen de ajustes, puntaje, nota y foto del plato. */
export function FinishScreen({ recipeTitle, startedAt, changes, recipeHasPhoto, onFinish }: Props) {
  const [now] = useState(() => Date.now());
  const minutes = startedAt ? Math.max(1, Math.round((now - startedAt) / 60_000)) : null;

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [useAsCover, setUseAsCover] = useState(!recipeHasPhoto);
  const [saveChanges, setSaveChanges] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      await onFinish({
        rating: rating ?? undefined,
        note: note.trim() || undefined,
        photo,
        useAsCover: Boolean(photo) && useAsCover && !recipeHasPhoto,
        saveToRecipe: changes.length > 0 && saveChanges,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-2">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <PartyPopper className="size-12 text-accent" aria-hidden="true" />
        <h1 className="font-display text-[33px] leading-[1.1] font-normal">¡Listo!</h1>
        <p className="text-sm text-muted">
          {recipeTitle}
          {minutes ? ` · tardaste ${minutes} min` : ""}
        </p>
      </div>

      {changes.length > 0 ? (
        <section
          className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
          aria-label="Cambios que hiciste"
        >
          <p className="text-[15px] font-semibold">
            Cambiaste {changes.length === 1 ? "1 cosa" : `${changes.length} cosas`}
          </p>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {changes.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="¿Qué hacemos con los cambios?"
          >
            <button
              type="button"
              role="radio"
              aria-checked={saveChanges}
              onClick={() => setSaveChanges(true)}
              className={cn(
                "min-h-12 rounded-2xl border px-3 text-sm font-semibold",
                saveChanges ? "border-accent bg-accent/15 text-accent" : "border-border",
              )}
            >
              Guardar en la receta
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!saveChanges}
              onClick={() => setSaveChanges(false)}
              className={cn(
                "min-h-12 rounded-2xl border px-3 text-sm font-semibold",
                !saveChanges ? "border-accent bg-accent/15 text-accent" : "border-border",
              )}
            >
              Solo por esta vez
            </button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-label="Puntaje">
        <p className="text-sm font-medium">¿Cómo salió?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={rating === n}
              onClick={() => setRating((r) => (r === n ? null : n))}
              className="flex size-11 items-center justify-center"
            >
              <Star
                className={cn(
                  "size-8",
                  rating !== null && n <= rating ? "fill-accent text-accent" : "text-muted",
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <label htmlFor="cook-note" className="text-sm font-medium">
          Nota para la próxima
        </label>
        <Textarea
          id="cook-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Ej.: la próxima, menos sal"
          className="min-h-20 text-base"
        />
      </section>

      <section className="flex flex-col gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Foto del plato"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <PillButton variant="soft" size="md" onClick={() => fileInput.current?.click()}>
          <Camera /> {photo ? "Cambiar la foto" : "Foto del plato (opcional)"}
        </PillButton>
        {photo ? <p className="truncate text-sm text-muted">{photo.name}</p> : null}
        {photo && !recipeHasPhoto ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={useAsCover}
              onChange={(e) => setUseAsCover(e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            Usarla como portada de la receta
          </label>
        ) : null}
      </section>

      <PillButton
        fullWidth
        disabled={submitting}
        onClick={() => void submit()}
        className="sticky bottom-0"
      >
        {submitting ? "Guardando…" : "Terminar"}
      </PillButton>
    </div>
  );
}
