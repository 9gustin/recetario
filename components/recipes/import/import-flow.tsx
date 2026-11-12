"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Camera, ImagePlus, Loader2 } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { RecipeForm } from "@/components/recipes/recipe-form/recipe-form";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image/compress";
import type { RecipeDraft } from "@/lib/schemas/recipe";
import { createClient } from "@/lib/supabase/client";

export type ImportMode = "texto" | "foto" | "dictar";

type Source =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "image"; paths: string[] }
  | { kind: "voice"; transcript: string };

type Phase =
  | { name: "input" }
  | { name: "processing" }
  | { name: "error"; message: string }
  | {
      name: "review";
      draft: RecipeDraft;
      newIngredients: string[];
      sourceType: "text" | "url" | "photo" | "voice";
    };

const WORKING_MESSAGES = [
  "Leyendo tu receta…",
  "Separando los pasos…",
  "Estimando los tiempos…",
  "Buscando los ingredientes…",
];

const MIN_TEXT = 20;
const MAX_PHOTOS = 4;
const isUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

function Processing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % WORKING_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="flex flex-col items-center gap-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-12 animate-spin text-accent" aria-hidden="true" />
      <p className="font-display text-[24px]">{WORKING_MESSAGES[i]}</p>
      <p className="max-w-[260px] text-sm text-muted">
        Puede tardar unos segundos. Después la revisás antes de guardarla.
      </p>
    </div>
  );
}

/** Pantalla de importación: texto o link, foto o dictado → borrador → formulario para revisar. */
export function ImportFlow({ groupId, mode }: { groupId: string; mode: ImportMode }) {
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [lastSource, setLastSource] = useState<Source | null>(null);

  async function run(source: Source) {
    setLastSource(source);
    setPhase({ name: "processing" });
    try {
      const res = await fetch("/api/ai/recipes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, source }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        draft?: RecipeDraft;
        newIngredients?: string[];
        error?: string;
      };
      if (!res.ok || !body.draft) {
        setPhase({
          name: "error",
          message: body.error ?? "No pudimos armar la receta. Probá de nuevo.",
        });
        return;
      }
      const sourceType = source.kind === "image" ? "photo" : source.kind;
      setPhase({
        name: "review",
        draft: body.draft,
        newIngredients: body.newIngredients ?? [],
        sourceType,
      });
    } catch {
      setPhase({
        name: "error",
        message: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.",
      });
    }
  }

  async function submitPhotos() {
    setPhase({ name: "processing" });
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const file of files) {
        const blob = await compressImage(file);
        const path = `${groupId}/imports/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from("recipe-images")
          .upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        paths.push(path);
      }
      await run({ kind: "image", paths });
    } catch {
      setPhase({
        name: "error",
        message: "No pudimos subir la foto. Revisá tu conexión y probá de nuevo.",
      });
    }
  }

  if (phase.name === "processing") return <Processing />;

  if (phase.name === "review") {
    const { draft } = phase;
    return (
      <RecipeForm
        groupId={groupId}
        notice="Revisá que esté todo bien antes de guardar."
        source={{ type: phase.sourceType, url: draft.source_url }}
        highlightNames={phase.newIngredients}
        recipe={{
          title: draft.title ?? "",
          description: draft.description ?? null,
          servings: draft.servings ?? 2,
          prep_minutes: draft.prep_minutes ?? null,
          cook_minutes: draft.cook_minutes ?? null,
          difficulty: draft.difficulty ?? null,
          tags: draft.tags ?? [],
          image_url: draft.image_url ?? null,
          ingredients: (draft.ingredients ?? []).map((i) => ({ raw_text: i.raw_text })),
          steps: (draft.steps ?? []).map((s) => ({
            instruction: s.instruction,
            duration_seconds: s.duration_seconds ?? null,
            timer_kind: s.timer_kind ?? null,
            tip: s.tip ?? null,
          })),
        }}
      />
    );
  }

  const error = phase.name === "error" ? phase.message : null;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <p className="flex items-start gap-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 flex-none text-danger-soft" aria-hidden="true" />{" "}
            {error}
          </p>
          <div className="flex flex-wrap gap-2">
            {lastSource && mode !== "foto" ? (
              <PillButton size="md" onClick={() => run(lastSource)}>
                Reintentar
              </PillButton>
            ) : null}
            <PillButton asChild size="md" variant="outline">
              <Link href={`/g/${groupId}/recetas/nueva`}>Cargarla a mano</Link>
            </PillButton>
          </div>
        </div>
      ) : null}

      {mode === "texto" ? (
        <>
          <label htmlFor="import-text" className="text-sm font-medium">
            Pegá la receta o un link
          </label>
          <Textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej.: https://… o el texto con los ingredientes y los pasos"
            className="min-h-48 text-base"
          />
          <PillButton
            fullWidth
            disabled={!isUrl(text) && text.trim().length < MIN_TEXT}
            onClick={() =>
              run(
                isUrl(text)
                  ? { kind: "url", url: text.trim() }
                  : { kind: "text", text: text.trim() },
              )
            }
          >
            Armar la receta
          </PillButton>
        </>
      ) : null}

      {mode === "foto" ? (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            aria-label="Foto de la receta"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          />
          <PillButton variant="soft" fullWidth onClick={() => fileInput.current?.click()}>
            {files.length ? <ImagePlus /> : <Camera />}
            {files.length ? "Cambiar las fotos" : "Sacar o elegir una foto"}
          </PillButton>
          <p className="text-sm text-muted">
            {files.length
              ? `${files.length} ${files.length === 1 ? "foto lista" : "fotos listas"}.`
              : `Podés subir hasta ${MAX_PHOTOS} fotos si la receta ocupa más de una hoja.`}
          </p>
          <PillButton fullWidth disabled={files.length === 0} onClick={() => void submitPhotos()}>
            Leer la receta
          </PillButton>
        </>
      ) : null}

      {mode === "dictar" ? (
        <VoiceRecorder
          confirmLabel="Armar la receta"
          idleLabel="Tocá y contame la receta"
          onTranscript={(transcript) => run({ kind: "voice", transcript })}
        />
      ) : null}
    </div>
  );
}
