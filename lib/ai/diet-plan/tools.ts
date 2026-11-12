import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PlanAgentEvent } from "@/lib/ai/plan-agent/events";
import type { PlanToolOutput } from "@/lib/ai/plan-agent/tools";
import { checkRecipe, type CheckRestriction } from "@/lib/domain/compatibility";
import { matchLocal } from "@/lib/domain/ingredient-match";
import { restrictionSchema } from "@/lib/schemas/food-profile";
import { componentSchema } from "@/lib/schemas/diet-plan";
import type { Database } from "@/lib/supabase/database.types";

export type DietToolCtx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  groupId: string | null;
  planId: string;
  emit: (event: PlanAgentEvent) => void;
};

type ToolDef<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: DietToolCtx) => Promise<PlanToolOutput>;
};
const defineTool = <S extends z.ZodType>(t: ToolDef<S>) => t;
const uuid = z.string().uuid();

async function ownRestrictions(ctx: DietToolCtx): Promise<CheckRestriction[]> {
  const { data } = await ctx.supabase
    .from("food_profiles")
    .select("data")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const list = (data?.data as { restrictions?: unknown } | null)?.restrictions;
  return (z.array(restrictionSchema).safeParse(list ?? []).data ?? []) as CheckRestriction[];
}

/** ¿Este alimento está prohibido para la persona? Se busca en el catálogo para conocer sus familias. */
export async function isForbiddenFood(ctx: DietToolCtx, food: string): Promise<boolean> {
  const { data: catalog } = await ctx.supabase
    .from("ingredients")
    .select("id, name, aliases, family");
  const list = (catalog ?? []).map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] }));
  const match = matchLocal(food, list);
  const entry = (catalog ?? []).find((c) => c.id === match?.id);
  const restrictions = await ownRestrictions(ctx);
  return (
    checkRecipe(
      [
        {
          ingredientId: entry?.id ?? null,
          name: entry?.name ?? food,
          aliases: entry?.aliases ?? [],
          families: entry?.family ?? [],
          optional: false,
        },
      ],
      restrictions,
    ).status === "forbidden"
  );
}

async function bump(ctx: DietToolCtx, patch: Record<string, unknown>, note: string) {
  const { data, error } = await ctx.supabase.rpc("save_diet_plan", {
    p_plan: { id: ctx.planId, ...patch },
    p_change_note: note,
  });
  if (error) return null;
  const version = (data as { version?: number } | null)?.version ?? null;
  if (version) ctx.emit({ type: "diet_updated", version });
  return version;
}

const proposeSwaps = defineTool({
  name: "propose_swaps",
  description:
    "Valida reemplazos para un alimento que a la persona no le gusta. Pasá 3 a 6 candidatos (nombres de alimentos) que respeten los componentes de esa comida; el servidor descarta los prohibidos por su perfil y devuelve los válidos.",
  schema: z.object({
    meal_id: uuid,
    dislike: z.string().trim().min(1).max(80),
    candidates: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  }),
  async run({ meal_id, dislike, candidates }, ctx) {
    const { data: meal } = await ctx.supabase
      .from("diet_plan_meals")
      .select("slot, formula, components")
      .eq("id", meal_id)
      .eq("plan_id", ctx.planId)
      .maybeSingle();
    if (!meal) return { result: { error: "No encontré esa comida del plan." }, isError: true };
    const valid: string[] = [];
    const rejected: string[] = [];
    for (const c of candidates) {
      if (await isForbiddenFood(ctx, c)) rejected.push(c);
      else valid.push(c);
    }
    return {
      result: {
        dislike,
        meal: { slot: meal.slot, formula: meal.formula, components: meal.components },
        valid: valid.slice(0, 3),
        rejected_for_restrictions: rejected,
      },
    };
  },
});

const applySwap = defineTool({
  name: "apply_swap",
  description: "Aplica un reemplazo elegido por la persona. Crea una versión nueva del plan.",
  schema: z.object({
    meal_id: uuid.nullish(),
    original: z.string().trim().min(1).max(80),
    replacement: z.string().trim().min(1).max(80),
    reason: z.string().trim().max(200).nullish(),
  }),
  async run(input, ctx) {
    if (await isForbiddenFood(ctx, input.replacement))
      return {
        result: { error: `${input.replacement} está prohibido por el perfil de la persona.` },
        isError: true,
      };
    const { error } = await ctx.supabase.from("diet_plan_swaps").insert({
      plan_id: ctx.planId,
      meal_id: input.meal_id ?? null,
      original: input.original,
      replacement: input.replacement,
      reason: input.reason ?? null,
    });
    if (error) return { result: { error: "No se pudo guardar el reemplazo." }, isError: true };
    const version = await bump(ctx, {}, `Reemplazo: ${input.original} → ${input.replacement}`);
    return { result: { applied: true, version } };
  },
});

const updateMeal = defineTool({
  name: "update_meal",
  description: "Cambia la fórmula, los componentes o las opciones de una comida del plan.",
  schema: z.object({
    meal_id: uuid,
    formula: z.string().trim().max(300).optional(),
    components: z.array(componentSchema).max(10).optional(),
    options: z.array(z.string().trim().max(300)).max(20).optional(),
  }),
  async run({ meal_id, ...patch }, ctx) {
    const { error } = await ctx.supabase
      .from("diet_plan_meals")
      .update(patch)
      .eq("id", meal_id)
      .eq("plan_id", ctx.planId);
    if (error) return { result: { error: "No se pudo cambiar la comida." }, isError: true };
    const version = await bump(ctx, {}, "Comida ajustada");
    return { result: { applied: true, version } };
  },
});

const updateRule = defineTool({
  name: "update_rule",
  description: "Agrega, cambia o quita una regla general del plan (index empieza en 0).",
  schema: z.object({
    index: z.number().int().min(0).optional(),
    text: z.string().trim().min(1).max(300).optional(),
    remove: z.boolean().optional(),
  }),
  async run({ index, text, remove }, ctx) {
    const { data } = await ctx.supabase
      .from("diet_plans")
      .select("rules")
      .eq("id", ctx.planId)
      .single();
    const rules = [...((data?.rules as { text: string; kind?: string }[] | null) ?? [])];
    if (index === undefined) {
      if (!text) return { result: { error: "Falta el texto de la regla." }, isError: true };
      rules.push({ text });
    } else if (index >= rules.length) {
      return { result: { error: "No existe esa regla." }, isError: true };
    } else if (remove) {
      rules.splice(index, 1);
    } else if (text) {
      rules[index] = { ...rules[index]!, text };
    }
    const version = await bump(ctx, { rules }, "Regla ajustada");
    return { result: { applied: true, version } };
  },
});

const answerQuestion = defineTool({
  name: "answer_question",
  description:
    "Registra la respuesta de la persona a una pregunta abierta del plan (index empieza en 0).",
  schema: z.object({ index: z.number().int().min(0), answer: z.string().trim().min(1).max(300) }),
  async run({ index, answer }, ctx) {
    const { data } = await ctx.supabase
      .from("diet_plans")
      .select("open_questions, rules")
      .eq("id", ctx.planId)
      .single();
    const questions = [...((data?.open_questions as string[] | null) ?? [])];
    if (index >= questions.length)
      return { result: { error: "No existe esa pregunta." }, isError: true };
    const [question] = questions.splice(index, 1);
    const rules = [
      ...((data?.rules as { text: string }[] | null) ?? []),
      { text: `${question} → ${answer}` },
    ];
    const version = await bump(ctx, { open_questions: questions, rules }, "Pregunta respondida");
    return { result: { applied: true, version } };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DIET_TOOLS: ToolDef<any>[] = [
  proposeSwaps,
  applySwap,
  updateMeal,
  updateRule,
  answerQuestion,
];

export function dietToolDefinitions(): Anthropic.Messages.Tool[] {
  return DIET_TOOLS.map((t) => {
    const { $schema: _ignored, ...input_schema } = z.toJSONSchema(t.schema) as Record<
      string,
      unknown
    >;
    void _ignored;
    return {
      name: t.name,
      description: t.description,
      input_schema: input_schema as Anthropic.Messages.Tool.InputSchema,
    };
  });
}

export async function runDietTool(
  name: string,
  input: unknown,
  ctx: DietToolCtx,
): Promise<PlanToolOutput> {
  const tool = DIET_TOOLS.find((t) => t.name === name);
  if (!tool) return { result: { error: `Herramienta desconocida: ${name}` }, isError: true };
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success)
    return {
      result: {
        error: `Entrada inválida: ${parsed.error.issues.map((i: { message: string }) => i.message).join("; ")}`,
      },
      isError: true,
    };
  return tool.run(parsed.data, ctx);
}
