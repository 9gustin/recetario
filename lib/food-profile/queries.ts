import "server-only";
import {
  emptyProfile,
  foodProfileDataSchema,
  profileChangeSchema,
  type FoodProfileData,
  type ProfileChange,
} from "@/lib/schemas/food-profile";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type ProfileSource = {
  id: string;
  kind: string;
  text: string | null;
  hasFile: boolean;
  created_at: string;
};

export type ProfileScreenData = {
  profile: {
    data: FoodProfileData;
    summary: string | null;
    version: number;
    updated_at: string;
  } | null;
  draft: {
    id: string;
    proposed: FoodProfileData;
    summary: string | null;
    changes: ProfileChange[];
    open_questions: string[];
  } | null;
  sources: ProfileSource[];
};

/** Todo lo que necesita la pantalla "Mi alimentación" (la RLS limita todo a la propia persona). */
export async function getProfileScreenData(userId: string): Promise<ProfileScreenData> {
  const supabase = await createClient();
  const [{ data: row }, { data: draft }, { data: inputs }] = await Promise.all([
    supabase
      .from("food_profiles")
      .select("data, summary, version, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("food_profile_drafts")
      .select("id, proposed, summary, changes, open_questions")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("food_profile_inputs")
      .select("id, kind, transcript, storage_path, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    profile: row
      ? {
          data: foodProfileDataSchema.safeParse(row.data).data ?? emptyProfile(),
          summary: row.summary,
          version: row.version,
          updated_at: row.updated_at,
        }
      : null,
    draft: draft
      ? {
          id: draft.id,
          proposed: foodProfileDataSchema.safeParse(draft.proposed).data ?? emptyProfile(),
          summary: draft.summary,
          changes: z.array(profileChangeSchema).safeParse(draft.changes).data ?? [],
          open_questions: z.array(z.string()).safeParse(draft.open_questions).data ?? [],
        }
      : null,
    sources: (inputs ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      text: i.transcript,
      hasFile: Boolean(i.storage_path),
      created_at: i.created_at,
    })),
  };
}
