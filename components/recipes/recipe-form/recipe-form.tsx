"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PillButton } from "@/components/shared/pill-button";
import { cn } from "@/lib/utils";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { saveRecipe, uploadRecipeImage } from "@/lib/recipes/actions";

const DURATIONS = [1, 5, 10, 15, 20, 30] as const;
const SUGGESTED_TAGS = ["low carb", "rápida", "freezable", "vianda", "vegetariana", "sin TACC"];

const formSchema = z.object({
  title: z.string().trim().min(1, "Poné un título").max(120),
  description: z.string().max(2000).optional(),
  servings: z.number().positive("Porciones mayores a 0"),
  prep_minutes: z.number().int().min(0).optional(),
  cook_minutes: z.number().int().min(0).optional(),
  difficulty: z.enum(["facil", "media", "dificil"]).optional(),
  tags: z.array(z.string()),
  steps: z
    .array(
      z.object({
        instruction: z.string().trim().min(1, "Escribí el paso"),
        duration_seconds: z.number().int().positive().nullable().optional(),
        timer_kind: z.enum(["active", "passive"]).nullable().optional(),
        tip: z.string().optional(),
      }),
    )
    .min(1, "Agregá al menos un paso"),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  groupId: string;
  recipe?: {
    id: string;
    title: string;
    description: string | null;
    servings: number;
    prep_minutes: number | null;
    cook_minutes: number | null;
    difficulty: string | null;
    tags: string[];
    image_url: string | null;
    ingredients: { raw_text: string | null }[];
    steps: {
      instruction: string;
      duration_seconds: number | null;
      timer_kind: string | null;
      tip: string | null;
    }[];
  };
};

export function RecipeForm({ groupId, recipe }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ingredientsInitial = (recipe?.ingredients ?? []).map((i) => i.raw_text ?? "").join("\n");

  const [ingredientsText, setIngredientsText] = useState(ingredientsInitial);
  const [imageUrl, setImageUrl] = useState<string | null>(recipe?.image_url ?? null);
  const [changeNote, setChangeNote] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: recipe?.title ?? "",
      description: recipe?.description ?? "",
      servings: recipe?.servings ?? 2,
      prep_minutes: recipe?.prep_minutes ?? undefined,
      cook_minutes: recipe?.cook_minutes ?? undefined,
      difficulty: (recipe?.difficulty as FormValues["difficulty"]) ?? undefined,
      tags: recipe?.tags ?? [],
      steps: (
        recipe?.steps ?? [{ instruction: "", duration_seconds: null, timer_kind: null, tip: "" }]
      ).map((s) => ({
        instruction: s.instruction,
        duration_seconds: s.duration_seconds ?? null,
        timer_kind: (s.timer_kind as "active" | "passive" | null) ?? null,
        tip: s.tip ?? "",
      })),
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  const servings = watch("servings");
  const prep = watch("prep_minutes");
  const cook = watch("cook_minutes");
  const tags = watch("tags");

  const parsedIngredients = ingredientsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseIngredientLine);

  const totalMinutes = (prep ?? 0) + (cook ?? 0);

  function toggleTag(tag: string) {
    const current = tags ?? [];
    setValue("tags", current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.set("groupId", groupId);
    fd.set("recipeId", recipe?.id ?? "pending");
    fd.set("file", compressed, file.name.replace(/\.[^.]+$/, ".webp"));
    if (recipe?.id) {
      startTransition(async () => {
        const res = await uploadRecipeImage(fd);
        if (res.ok) setImageUrl(res.data.imageUrl);
        else setError(res.error);
      });
    }
    e.target.value = "";
  }

  function onSubmit(values: FormValues) {
    setError(null);
    if (parsedIngredients.length === 0) {
      setError("Agregá al menos un ingrediente.");
      return;
    }

    const ingredients = parsedIngredients.map((p, i) => ({
      raw_text:
        ingredientsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)[i] ?? "",
      quantity: p.quantity,
      unit: p.unit,
      preparation: p.preparation,
      section: null,
      optional: p.optional,
      position: i,
    }));

    const total = totalMinutes > 0 ? totalMinutes : null;

    startTransition(async () => {
      const res = await saveRecipe({
        id: recipe?.id,
        group_id: groupId,
        title: values.title,
        description: values.description || null,
        image_url: imageUrl,
        servings: values.servings,
        prep_minutes: values.prep_minutes || null,
        cook_minutes: values.cook_minutes || null,
        total_minutes: total,
        difficulty: values.difficulty ?? null,
        tags: values.tags,
        ingredients,
        steps: values.steps.map((s, i) => ({
          position: i,
          instruction: s.instruction,
          duration_seconds: s.duration_seconds ?? null,
          timer_kind: s.timer_kind ?? null,
          tip: s.tip || null,
          ingredient_ids: [],
        })),
        change_note: changeNote || null,
      });

      if (res.ok) router.push(`/g/${groupId}/recetas/${res.data.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="Ej: Pollo al limón"
          className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
        />
        {errors.title ? <p className="text-sm text-danger-soft">{errors.title.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Un comentario corto sobre la receta"
          className="min-h-24 rounded-2xl border-border bg-surface px-4 py-3 text-base"
        />
      </div>

      {/* Foto */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm leading-none font-medium">Foto</span>
        {imageUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="size-20 rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="text-sm text-danger-soft"
            >
              Quitar
            </button>
          </div>
        ) : null}
        <Input
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          className="min-h-[44px] rounded-2xl border-border bg-surface px-4 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2"
        />
      </div>

      {/* Porciones y tiempos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="servings">Porciones</Label>
          <Input
            id="servings"
            type="number"
            inputMode="numeric"
            {...register("servings", { setValueAs: (v) => (v === "" ? 0 : Number(v)) })}
            className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
          />
          {errors.servings ? (
            <p className="text-sm text-danger-soft">{errors.servings.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prep">Prep (min)</Label>
          <Input
            id="prep"
            type="number"
            inputMode="numeric"
            {...register("prep_minutes", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cook">Cocción (min)</Label>
          <Input
            id="cook"
            type="number"
            inputMode="numeric"
            {...register("cook_minutes", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
          />
        </div>
      </div>
      {totalMinutes > 0 ? <p className="text-sm text-muted">Total: {totalMinutes} min</p> : null}

      {/* Dificultad */}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium">Dificultad</span>
        <div className="flex gap-2">
          {(["facil", "media", "dificil"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValue("difficulty", d)}
              className={cn(
                "min-h-11 flex-1 rounded-full border text-sm font-semibold",
                watch("difficulty") === d
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {d === "facil" ? "Fácil" : d === "media" ? "Media" : "Difícil"}
            </button>
          ))}
        </div>
      </div>

      {/* Etiquetas */}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium">Etiquetas</span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm font-medium",
                (tags ?? []).includes(tag)
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredientes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="ingredients">Ingredientes</Label>
        <p className="text-[13px] text-muted">
          Uno por línea. Ej: &quot;200 g de pechuga de pollo, en cubos&quot;.
        </p>
        <Textarea
          id="ingredients"
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          placeholder={"2 pechugas de pollo\n1 cebolla\nsal a gusto"}
          className="min-h-32 rounded-2xl border-border bg-surface px-4 py-3 text-base"
        />
        {parsedIngredients.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {parsedIngredients.map((p, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[13px]"
              >
                {p.quantity !== null ? (
                  <span className="font-semibold">
                    {p.quantity} {p.unit ?? ""}
                  </span>
                ) : null}
                <span>{p.name}</span>
                {p.preparation ? <span className="text-muted">· {p.preparation}</span> : null}
                {p.optional ? <span className="text-muted">· opcional</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Pasos */}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium">Pasos</span>
        {errors.steps?.message ? (
          <p className="text-sm text-danger-soft">{errors.steps.message}</p>
        ) : null}
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {index + 1}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label="Subir paso"
                    className="flex size-9 items-center justify-center rounded-full bg-surface-2 disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label="Bajar paso"
                    className="flex size-9 items-center justify-center rounded-full bg-surface-2 disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Eliminar paso"
                    className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-danger-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <Textarea
                {...register(`steps.${index}.instruction`)}
                placeholder="Qué hay que hacer en este paso"
                className="min-h-20 rounded-xl border-border bg-background px-3 py-2 text-base"
              />
              {errors.steps?.[index]?.instruction ? (
                <p className="text-sm text-danger-soft">
                  {errors.steps[index].instruction.message}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue(`steps.${index}.duration_seconds`, d * 60)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-[13px] font-medium",
                      watch(`steps.${index}.duration_seconds`) === d * 60
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border text-muted",
                    )}
                  >
                    {d} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      `steps.${index}.timer_kind`,
                      watch(`steps.${index}.timer_kind`) === "passive" ? "active" : "passive",
                    )
                  }
                  className={cn(
                    "min-h-8 rounded-full border px-3 text-[13px] font-medium",
                    watch(`steps.${index}.timer_kind`) === "passive"
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted",
                  )}
                >
                  Esperar (horno, reposo)
                </button>
              </div>
              <Input
                {...register(`steps.${index}.tip`)}
                placeholder="Tip (opcional)"
                className="min-h-11 rounded-xl border-border bg-background px-3 text-sm"
              />
            </div>
          ))}
        </div>
        <PillButton
          type="button"
          variant="soft"
          onClick={() =>
            append({ instruction: "", duration_seconds: null, timer_kind: null, tip: "" })
          }
        >
          <Plus className="size-4" /> Agregar paso
        </PillButton>
      </div>

      {recipe ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="change-note">¿Qué cambiaste? (opcional)</Label>
          <Input
            id="change-note"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Ej: le agregué romero"
            className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-danger-soft">{error}</p> : null}

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] pb-2">
        <PillButton type="submit" fullWidth disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </PillButton>
      </div>
    </form>
  );
}

/** Comprime a webp con máx. 1600 px antes de subir. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/webp", 0.82));
}
