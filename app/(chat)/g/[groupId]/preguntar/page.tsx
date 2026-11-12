import { notFound } from "next/navigation";
import { AssistantChat, type ConversationSummary } from "@/components/assistant/chat";
import { requireUser } from "@/lib/auth";
import type { Proposal } from "@/lib/ai/assistant/events";
import type { ChatMessage, MentionRef } from "@/lib/hooks/use-assistant-chat";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Preguntale" };

type Stored = { text?: string; proposals?: Proposal[] };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ receta?: string; c?: string }>;
}) {
  const user = await requireUser();
  const [{ groupId }, { receta, c }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) notFound();

  const { data: convs } = await supabase
    .from("ai_conversations")
    .select("id, title, last_message_at")
    .eq("group_id", groupId)
    .eq("purpose", "assistant")
    .order("last_message_at", { ascending: false })
    .limit(15);
  const conversations: ConversationSummary[] = convs ?? [];

  // Receta citada de entrada ("Preguntar por esta receta").
  let initialMentions: MentionRef[] = [];
  let recipeId: string | undefined;
  if (receta && /^[0-9a-f-]{36}$/i.test(receta)) {
    const { data: recipe } = await supabase
      .from("recipes")
      .select("id, title")
      .eq("id", receta)
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .maybeSingle();
    if (recipe) {
      initialMentions = [{ id: recipe.id, title: recipe.title }];
      recipeId = recipe.id;
    }
  }

  // Conversación existente: se cargan sus mensajes.
  let initialMessages: ChatMessage[] = [];
  let conversationId: string | null = null;
  if (c && conversations.some((x) => x.id === c)) {
    conversationId = c;
    const { data: rows } = await supabase
      .from("ai_messages")
      .select("id, role, content, mentions")
      .eq("conversation_id", c)
      .order("created_at", { ascending: true });
    const ids = [...new Set((rows ?? []).flatMap((r) => r.mentions ?? []))];
    const { data: titles } = ids.length
      ? await supabase.from("recipes").select("id, title").in("id", ids)
      : { data: [] as { id: string; title: string }[] };
    const titleById = new Map((titles ?? []).map((t) => [t.id, t.title]));
    initialMessages = (rows ?? []).flatMap((r) =>
      r.role === "user" || r.role === "assistant"
        ? [
            {
              id: r.id,
              role: r.role,
              text: (r.content as Stored | null)?.text ?? "",
              mentions: (r.mentions ?? []).flatMap((id) =>
                titleById.has(id) ? [{ id, title: titleById.get(id)! }] : [],
              ),
              proposals: (r.content as Stored | null)?.proposals ?? [],
            } satisfies ChatMessage,
          ]
        : [],
    );
  }

  return (
    <AssistantChat
      groupId={groupId}
      context={recipeId ? { origin: "recipe", recipeId } : { origin: "home" }}
      initialMentions={initialMentions}
      initialMessages={initialMessages}
      initialConversationId={conversationId}
      conversations={conversations}
      backHref={recipeId ? `/g/${groupId}/recetas/${recipeId}` : `/g/${groupId}/hoy`}
    />
  );
}
