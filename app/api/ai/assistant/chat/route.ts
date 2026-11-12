import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkQuota } from "@/lib/ai/rate-limit";
import { pickAssistantModel, runAssistant } from "@/lib/ai/assistant/agent";
import { loadPromptRecipes } from "@/lib/ai/assistant/context";
import { encodeSse, type AssistantEvent, type Proposal } from "@/lib/ai/assistant/events";
import { buildContextText } from "@/lib/ai/assistant/format";
import { buildSystemPrompt } from "@/lib/ai/assistant/prompt";
import { assistantChatSchema } from "@/lib/schemas/assistant";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const HISTORY_LIMIT = 12;

type StoredContent = { text?: string; proposals?: Proposal[] };

/** Chat del asistente "Preguntale": respuesta en streaming (SSE) con herramientas que solo proponen. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = assistantChatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  const { groupId, message, context } = parsed.data;
  const mentionIds = [...new Set(parsed.data.mentions)];

  const { data: member } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No encontramos el grupo." }, { status: 404 });

  // Cada receta citada tiene que ser del grupo (el cliente no es de fiar).
  const mentioned = await loadPromptRecipes(supabase, mentionIds, groupId);
  if (mentioned.length !== mentionIds.length) {
    return NextResponse.json(
      { error: "Una de las recetas citadas no es de este grupo." },
      { status: 403 },
    );
  }
  // La receta abierta o en cocina también se incluye como contexto.
  const focusId =
    context.recipeId && !mentionIds.includes(context.recipeId) ? context.recipeId : null;
  const focus = focusId ? (await loadPromptRecipes(supabase, [focusId], groupId))[0] : undefined;
  if (focusId && !focus)
    return NextResponse.json({ error: "No encontramos esa receta." }, { status: 404 });

  if (!(await checkQuota(user.id, "assistant"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de preguntas de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  // Conversación: una existente (privada, la valida RLS) o una nueva.
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (!existing)
      return NextResponse.json({ error: "No encontramos la conversación." }, { status: 404 });
  } else {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({
        group_id: groupId,
        user_id: user.id,
        purpose: "assistant",
        context,
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
    const text = (m.content as StoredContent | null)?.text;
    return text && (m.role === "user" || m.role === "assistant")
      ? [{ role: m.role, content: text }]
      : [];
  });

  await supabase.from("ai_messages").insert({
    conversation_id: convId,
    role: "user",
    content: { text: message },
    mentions: mentionIds,
  });

  const cookingRecipe =
    context.origin === "cooking"
      ? (focus ?? mentioned.find((r) => r.id === context.recipeId))
      : undefined;
  const contextText = buildContextText({
    mentioned: [...mentioned, ...(focus && context.origin === "recipe" ? [focus] : [])],
    cooking: cookingRecipe
      ? {
          recipe: cookingRecipe,
          step: context.step ?? 0,
          servings: context.servings ?? cookingRecipe.servings,
          timers: context.timers ?? [],
        }
      : null,
  });
  const userContent = contextText
    ? `${contextText}\n\n---\nPregunta de la persona: ${message}`
    : message;

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (event: AssistantEvent) => controller.enqueue(encoder.encode(encodeSse(event)));
      try {
        const result = await runAssistant({
          model: pickAssistantModel({ mentions: mentionIds.length, origin: context.origin }),
          system: buildSystemPrompt(context.origin),
          history,
          userContent,
          toolCtx: { supabase, userId: user.id, groupId },
          emit,
        });
        if (result.ok) {
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: { text: result.text, proposals: result.proposals },
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
