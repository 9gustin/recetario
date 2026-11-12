import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { runPlanAgent } from "@/lib/ai/plan-agent/agent";
import { encodePlanSse, type PlanAgentEvent } from "@/lib/ai/plan-agent/events";
import { buildMenuSystemPrompt, buildPlanSystemPrompt } from "@/lib/ai/plan-agent/prompt";
import { menuToolDefinitions, runMenuTool } from "@/lib/ai/plan-agent/tools";
import { MODELS } from "@/lib/ai/models";
import { checkQuota } from "@/lib/ai/rate-limit";
import { sortSlots, slotLabel } from "@/lib/domain/meal-slots";
import { MENU_DATE, dayLabel, formatRangeLabel, rangeDays } from "@/lib/domain/week";
import { planChatSchema } from "@/lib/schemas/plan-chat";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const HISTORY_LIMIT = 14;

/** Chat del plan semanal: streaming SSE con herramientas que escriben el borrador (validado por código). */
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
  const { message } = parsed.data;

  // La RLS solo deja ver planes de grupos propios.
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, group_id, week_start, end_date, status, groups(meal_slots, name)")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "No encontramos el plan." }, { status: 404 });
  if (plan.status === "archived")
    return NextResponse.json({ error: "Ese plan está archivado." }, { status: 409 });

  if (!(await checkQuota(user.id, "plan_chat"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de pedidos de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  // Conversación del plan (compartida por quien la abre; privada a su dueño por RLS).
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("plan_id", planId)
      .maybeSingle();
    if (!existing)
      return NextResponse.json({ error: "No encontramos la conversación." }, { status: 404 });
  } else {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({
        group_id: plan.group_id,
        user_id: user.id,
        purpose: "plan_chat",
        plan_id: planId,
        title: message.slice(0, 60),
      })
      .select("id")
      .single();
    if (error || !created)
      return NextResponse.json({ error: "No pudimos empezar la conversación." }, { status: 500 });
    conversationId = created.id;
  }
  const convId = conversationId;

  const { data: past } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history: Anthropic.Messages.MessageParam[] = (past ?? []).reverse().flatMap((m) => {
    const t = (m.content as { text?: string } | null)?.text;
    return t && (m.role === "user" || m.role === "assistant") ? [{ role: m.role, content: t }] : [];
  });
  await supabase
    .from("ai_messages")
    .insert({ conversation_id: convId, role: "user", content: { text: message } });

  const slots = sortSlots(plan.groups?.meal_slots ?? []);
  const isMenu = plan.week_start === MENU_DATE;
  const context = isMenu
    ? "Listado: Mis comidas (sin días ni momentos)."
    : [
        `Plan: ${formatRangeLabel(plan.week_start, plan.end_date)} (del ${plan.week_start} al ${plan.end_date}). Cubrí solo estos días y solo los momentos que pida la persona; si no aclara, preguntá o asumí los habituales.`,
        `Días: ${rangeDays(plan.week_start, plan.end_date)
          .map((d) => `${d} (${dayLabel(d)})`)
          .join(", ")}.`,
        `Momentos habilitados: ${slots.map((s) => `${s} (${slotLabel(s)})`).join(", ")}.`,
      ].join("\n");

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (event: PlanAgentEvent) =>
        controller.enqueue(encoder.encode(encodePlanSse(event)));
      try {
        const result = await runPlanAgent(
          {
            model: MODELS.smart,
            system: isMenu ? buildMenuSystemPrompt() : buildPlanSystemPrompt(),
            tools: isMenu ? menuToolDefinitions() : undefined,
            history,
            userContent: `${context}\n\n---\n${message}`,
            toolCtx: {
              supabase,
              userId: user.id,
              groupId: plan.group_id,
              planId,
              weekStart: plan.week_start,
              endDate: plan.end_date,
              slots,
              emit,
            },
            emit,
          },
          isMenu ? { executeTool: runMenuTool } : undefined,
        );
        if (result.ok) {
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: { text: result.text },
          });
          await supabase
            .from("ai_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", convId);
          emit({ type: "done", conversationId: convId });
        } else {
          emit({ type: "error", message: result.error });
        }
      } catch {
        emit({
          type: "error",
          message: "No pudimos armar el plan en este momento. Probá de nuevo.",
        });
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
