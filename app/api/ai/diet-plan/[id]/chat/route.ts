import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { dietToolDefinitions, runDietTool, type DietToolCtx } from "@/lib/ai/diet-plan/tools";
import { buildDietChatPrompt } from "@/lib/ai/diet-plan/prompt";
import { MODELS } from "@/lib/ai/models";
import { runPlanAgent } from "@/lib/ai/plan-agent/agent";
import { encodePlanSse, type PlanAgentEvent } from "@/lib/ai/plan-agent/events";
import { checkQuota } from "@/lib/ai/rate-limit";
import { planChatSchema } from "@/lib/schemas/plan-chat";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/** Chat para ajustar el plan de alimentación (reemplazos, reglas). Streaming SSE; todo es privado del usuario. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = planChatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });

  const { data: plan } = await supabase
    .from("diet_plans")
    .select(
      "id, title, summary, rules, allowances, open_questions, diet_plan_meals(id, slot, days, formula, components, options, position), diet_plan_swaps(original, replacement)",
    )
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "No encontramos el plan." }, { status: 404 });

  if (!(await checkQuota(user.id, "food_profile")))
    return NextResponse.json(
      { error: "Llegaste al límite de hoy. Probá mañana." },
      { status: 429 },
    );

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (event: PlanAgentEvent) =>
        controller.enqueue(encoder.encode(encodePlanSse(event)));
      try {
        const context = `PLAN ACTUAL (JSON):\n${JSON.stringify({
          title: plan.title,
          summary: plan.summary,
          rules: plan.rules,
          allowances: plan.allowances,
          open_questions: plan.open_questions,
          meals: [...(plan.diet_plan_meals ?? [])].sort((a, b) => a.position - b.position),
          swaps: plan.diet_plan_swaps,
        })}`;
        const result = await runPlanAgent<DietToolCtx>(
          {
            model: MODELS.smart,
            system: buildDietChatPrompt(),
            history: [] as Anthropic.Messages.MessageParam[],
            userContent: `${context}\n\n---\n${parsed.data.message}`,
            toolCtx: { supabase, userId: user.id, groupId: null, planId, emit },
            tools: dietToolDefinitions(),
            feature: "diet_plan_chat",
            emit,
            maxIterations: 8,
          },
          { executeTool: runDietTool },
        );
        if (result.ok) emit({ type: "done", conversationId: planId });
        else emit({ type: "error", message: result.error });
      } catch {
        emit({ type: "error", message: "No pudimos responder en este momento. Probá de nuevo." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
