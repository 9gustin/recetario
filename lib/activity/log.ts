import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActivityKind =
  | "page_view"
  | "login"
  | "plan_approved"
  | "shopping_list_generated"
  | "cooking_finished"
  | "recipe_saved"
  | "recipe_published"
  | "ai_error"
  | "chat_question";

/** Registra algo que hizo la persona. Nunca rompe la acción que lo dispara. */
export async function logEvent(
  userId: string,
  event: {
    kind: ActivityKind;
    groupId?: string | null;
    path?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("activity_events").insert({
      user_id: userId,
      group_id: event.groupId ?? null,
      kind: event.kind,
      path: event.path?.slice(0, 300) ?? null,
      meta: (event.meta ?? {}) as never,
    });
  } catch {
    // Es un extra.
  }
}
