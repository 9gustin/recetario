/** Diferencias entre dos versiones (snapshots) de una receta. Lógica pura, sin DB ni IA. */

export type SnapshotIngredient = {
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  section: string | null;
  optional: boolean;
  position: number;
  ingredient_id: string | null;
};

export type SnapshotStep = {
  position: number;
  instruction: string;
  duration_seconds: number | null;
  timer_kind: string | null;
  tip: string | null;
  ingredient_ids: string[];
};

export type RecipeSnapshot = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  tags: string[];
  ingredients: SnapshotIngredient[];
  steps: SnapshotStep[];
};

export const EMPTY_SNAPSHOT: RecipeSnapshot = {
  title: "",
  description: null,
  servings: null,
  prep_minutes: null,
  cook_minutes: null,
  total_minutes: null,
  difficulty: null,
  tags: [],
  ingredients: [],
  steps: [],
};

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v !== "" && !isNaN(Number(v))
      ? Number(v)
      : null;
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Lee el jsonb guardado en `recipe_versions.snapshot` de forma tolerante. */
export function parseSnapshot(raw: unknown): RecipeSnapshot {
  const s = rec(raw);
  const ingredients = (Array.isArray(s.ingredients) ? s.ingredients : []).map((x, i) => {
    const r = rec(x);
    return {
      raw_text: str(r.raw_text),
      quantity: num(r.quantity),
      unit: str(r.unit),
      preparation: str(r.preparation),
      section: str(r.section),
      optional: r.optional === true,
      position: num(r.position) ?? i,
      ingredient_id: str(r.ingredient_id),
    };
  });
  const steps = (Array.isArray(s.steps) ? s.steps : []).map((x, i) => {
    const r = rec(x);
    return {
      position: num(r.position) ?? i,
      instruction: str(r.instruction) ?? "",
      duration_seconds: num(r.duration_seconds),
      timer_kind: str(r.timer_kind),
      tip: str(r.tip),
      ingredient_ids: Array.isArray(r.ingredient_ids)
        ? r.ingredient_ids.filter((v): v is string => typeof v === "string")
        : [],
    };
  });
  return {
    title: str(s.title) ?? "",
    description: str(s.description),
    servings: num(s.servings),
    prep_minutes: num(s.prep_minutes),
    cook_minutes: num(s.cook_minutes),
    total_minutes: num(s.total_minutes),
    difficulty: str(s.difficulty),
    tags: Array.isArray(s.tags) ? s.tags.filter((v): v is string => typeof v === "string") : [],
    ingredients: ingredients.sort((a, b) => a.position - b.position),
    steps: steps.sort((a, b) => a.position - b.position),
  };
}

export type FieldKey =
  | "title"
  | "description"
  | "servings"
  | "prep_minutes"
  | "cook_minutes"
  | "total_minutes"
  | "difficulty"
  | "tags";

export type FieldChange = {
  field: FieldKey;
  from: string | number | null;
  to: string | number | null;
};

export type RecipeDiff = {
  fields: FieldChange[];
  ingredients: {
    added: SnapshotIngredient[];
    removed: SnapshotIngredient[];
    changed: { before: SnapshotIngredient; after: SnapshotIngredient }[];
  };
  steps: {
    added: { position: number; instruction: string }[];
    removed: { position: number; instruction: string }[];
    changed: { position: number; before: string; after: string }[];
  };
};

/** Texto legible de un ingrediente, tal como se tipeó. */
export function ingredientLabel(i: SnapshotIngredient): string {
  if (i.raw_text) return i.raw_text;
  return (
    [i.quantity, i.unit, i.preparation].filter((p) => p !== null && p !== "").join(" ") ||
    "Ingrediente"
  );
}

const normalize = (s: string | null) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Identifica un ingrediente: su id del catálogo o, si no tiene, su texto normalizado. */
function keyed(list: SnapshotIngredient[]): Map<string, SnapshotIngredient> {
  const seen = new Map<string, number>();
  const out = new Map<string, SnapshotIngredient>();
  for (const i of list) {
    const base = i.ingredient_id ?? `t:${normalize(i.raw_text)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(`${base}#${n}`, i);
  }
  return out;
}

const signature = (i: SnapshotIngredient) =>
  [i.raw_text, i.quantity, i.unit, i.preparation, i.section, i.optional]
    .map((v) => String(v ?? ""))
    .join("|");

const FIELDS: FieldKey[] = [
  "title",
  "description",
  "servings",
  "prep_minutes",
  "cook_minutes",
  "total_minutes",
  "difficulty",
  "tags",
];

/** Compara `next` contra `prev` (si no hay versión anterior, todo es nuevo). */
export function diffSnapshots(prev: RecipeSnapshot | null, next: RecipeSnapshot): RecipeDiff {
  const before = prev ?? EMPTY_SNAPSHOT;

  const fields: FieldChange[] = [];
  for (const field of FIELDS) {
    const a = field === "tags" ? before.tags.join(", ") || null : before[field];
    const b = field === "tags" ? next.tags.join(", ") || null : next[field];
    if (a !== b) fields.push({ field, from: a, to: b });
  }

  const prevIng = keyed(before.ingredients);
  const nextIng = keyed(next.ingredients);
  const ingredients: RecipeDiff["ingredients"] = { added: [], removed: [], changed: [] };
  for (const [k, after] of nextIng) {
    const old = prevIng.get(k);
    if (!old) ingredients.added.push(after);
    else if (signature(old) !== signature(after)) ingredients.changed.push({ before: old, after });
  }
  for (const [k, old] of prevIng) if (!nextIng.has(k)) ingredients.removed.push(old);

  const steps: RecipeDiff["steps"] = { added: [], removed: [], changed: [] };
  const max = Math.max(before.steps.length, next.steps.length);
  for (let i = 0; i < max; i++) {
    const a = before.steps[i];
    const b = next.steps[i];
    if (a && b) {
      if (
        a.instruction !== b.instruction ||
        a.duration_seconds !== b.duration_seconds ||
        a.tip !== b.tip
      ) {
        steps.changed.push({ position: i + 1, before: a.instruction, after: b.instruction });
      }
    } else if (b) steps.added.push({ position: i + 1, instruction: b.instruction });
    else if (a) steps.removed.push({ position: i + 1, instruction: a.instruction });
  }

  return { fields, ingredients, steps };
}

export function isEmptyDiff(d: RecipeDiff): boolean {
  return (
    d.fields.length === 0 &&
    d.ingredients.added.length === 0 &&
    d.ingredients.removed.length === 0 &&
    d.ingredients.changed.length === 0 &&
    d.steps.added.length === 0 &&
    d.steps.removed.length === 0 &&
    d.steps.changed.length === 0
  );
}
