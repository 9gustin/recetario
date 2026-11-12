import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RecipeQuestion = { conversationId: string; title: string; asked_at: string };

/** Mis preguntas anteriores que citan esta receta (la RLS deja solo las propias). */
export async function getRecipeQuestions(recipeId: string): Promise<RecipeQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_messages")
    .select("conversation_id, created_at, content, ai_conversations!inner(id)")
    .contains("mentions", [recipeId])
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(30);
  const seen = new Set<string>();
  const out: RecipeQuestion[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.conversation_id)) continue;
    seen.add(row.conversation_id);
    const text = (row.content as { text?: string } | null)?.text ?? "Pregunta";
    out.push({
      conversationId: row.conversation_id,
      title: text.slice(0, 80),
      asked_at: row.created_at,
    });
    if (out.length === 5) break;
  }
  return out;
}
