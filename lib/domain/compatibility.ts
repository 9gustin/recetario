/**
 * Compatibilidad receta ↔ perfil alimentario. Lógica pura, sin DB ni IA.
 * Las restricciones alimentarias se validan SIEMPRE por código (nunca solo por prompt).
 */
import { CATEGORY_FAMILIES } from "./food-families";
import { nameKey } from "./ingredient-match";

export type Severity = "forbidden" | "limit";

export type CheckRestriction = {
  /** Ingrediente ("cebolla"), familia del catálogo ("allium") o categoría ("harinas refinadas"). */
  target: string;
  type: "ingredient" | "family" | "category";
  severity: Severity;
  limit?: string;
  /** Miembros de la familia que la persona confirmó que también están prohibidos. */
  includes?: string[];
};

export type RecipeIngredientForCheck = {
  /** null si el ingrediente no está vinculado al catálogo. */
  ingredientId: string | null;
  name: string;
  aliases?: string[];
  families: string[];
  optional: boolean;
};

export type CompatStatus = "ok" | "limit" | "forbidden" | "unknown";

export type CompatReason = {
  ingredient: string;
  restriction: string;
  severity: Severity | "unknown";
  note?: string;
};

export type CompatResult = { status: CompatStatus; reasons: CompatReason[] };

export type MemberDiet = {
  userId: string;
  displayName: string | null;
  restrictions: CheckRestriction[];
};
export type MemberCompat = CompatResult & { userId: string; displayName: string | null };

const names = (i: RecipeIngredientForCheck) =>
  [i.name, ...(i.aliases ?? [])].map(nameKey).filter(Boolean);

/**
 * ¿El nombre del ingrediente es el objetivo o una variedad de él? "cebolla" cubre "cebolla morada",
 * pero NO "cebolla de verdeo" (otro alimento: la persona lo confirma aparte en `includes`).
 */
function nameMatches(candidate: string, target: string): boolean {
  if (candidate === target) return true;
  if (!candidate.startsWith(`${target} `)) return false;
  const rest = candidate.slice(target.length + 1);
  return !(rest.startsWith("de ") || rest.startsWith("del "));
}

function matchesRestriction(ing: RecipeIngredientForCheck, r: CheckRestriction): boolean {
  const candidates = names(ing);
  const targets = [nameKey(r.target)];

  if (r.type === "family") return ing.families.includes(r.target.toLowerCase().trim());

  if (r.type === "category") {
    const families = CATEGORY_FAMILIES[r.target.toLowerCase().trim()];
    if (families?.some((f) => ing.families.includes(f))) return true;
    // Sin familias conocidas: se compara por texto como último recurso.
    return candidates.some((c) => c.includes(targets[0]!));
  }

  // type === "ingredient": el objetivo y los miembros de la familia confirmados.
  const wanted = [...targets, ...(r.includes ?? []).map(nameKey)];
  return candidates.some((c) => wanted.some((w) => nameMatches(c, w)));
}

const RANK: Record<CompatStatus, number> = { ok: 0, unknown: 1, limit: 2, forbidden: 3 };

/** Revisa una receta contra las restricciones de UNA persona. Prioridad: forbidden > limit > unknown > ok. */
export function checkRecipe(
  ingredients: RecipeIngredientForCheck[],
  restrictions: CheckRestriction[],
): CompatResult {
  if (restrictions.length === 0) return { status: "ok", reasons: [] };

  const reasons: CompatReason[] = [];
  let status: CompatStatus = "ok";
  const raise = (next: CompatStatus) => {
    if (RANK[next] > RANK[status]) status = next;
  };

  for (const ing of ingredients) {
    let matched = false;
    for (const r of restrictions) {
      if (!matchesRestriction(ing, r)) continue;
      matched = true;
      if (r.severity === "forbidden" && ing.optional) {
        // Un ingrediente opcional prohibido no impide la receta: se puede sacar.
        reasons.push({
          ingredient: ing.name,
          restriction: r.target,
          severity: "limit",
          note: "es opcional, sacalo",
        });
        raise("limit");
      } else {
        reasons.push({
          ingredient: ing.name,
          restriction: r.target,
          severity: r.severity,
          note: r.limit,
        });
        raise(r.severity);
      }
    }
    // Sin vínculo al catálogo y sin coincidencia por texto: no se puede asegurar nada → "revisar".
    if (!matched && ing.ingredientId === null) {
      reasons.push({
        ingredient: ing.name,
        restriction: "",
        severity: "unknown",
        note: "no está en el catálogo: revisalo",
      });
      raise("unknown");
    }
  }
  return { status, reasons };
}

/** Resultado por cada persona del grupo que tiene perfil. */
export function checkRecipeForGroup(
  ingredients: RecipeIngredientForCheck[],
  diets: MemberDiet[],
): MemberCompat[] {
  return diets.map((d) => ({
    userId: d.userId,
    displayName: d.displayName,
    ...checkRecipe(ingredients, d.restrictions),
  }));
}
