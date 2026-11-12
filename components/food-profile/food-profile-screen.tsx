"use client";

import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { discardProfileDraft } from "@/lib/food-profile/actions";
import type { ProfileScreenData } from "@/lib/food-profile/queries";
import type { FoodProfileData, FoodProfileProposal } from "@/lib/schemas/food-profile";
import { DraftReview } from "./draft-review";
import { Intake, type IntakePayload } from "./intake";
import { ProfileView } from "./profile-view";
import { SourcesList } from "./sources-list";

type Draft = { id: string; proposal: FoodProfileProposal };

const DISCLAIMER =
  "Esto te ayuda a organizarte; no reemplaza el consejo de tu médico o nutricionista.";

/** "Mi alimentación": de cero a perfil guardado hablando, o editar el perfil que ya hay. */
export function FoodProfileScreen({ initial }: { initial: ProfileScreenData }) {
  const [profile, setProfile] = useState(initial.profile);
  const [sources, setSources] = useState(initial.sources);
  const [draft, setDraft] = useState<Draft | null>(
    initial.draft
      ? {
          id: initial.draft.id,
          proposal: {
            profile: initial.draft.proposed,
            summary: initial.draft.summary ?? "",
            changes: initial.draft.changes,
            open_questions: initial.draft.open_questions,
          },
        }
      : null,
  );
  const [summary, setSummary] = useState(initial.draft?.summary ?? "");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingest(
    payload: IntakePayload & { answers?: { question: string; answer: string }[] },
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/food-profile/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, baseDraftId: draft?.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        draftId?: string;
        proposal?: FoodProfileProposal;
        error?: string;
      };
      if (!res.ok || !body.draftId || !body.proposal) {
        setError(body.error ?? "No pudimos armar tu perfil. Probá de nuevo.");
        return;
      }
      setDraft({ id: body.draftId, proposal: body.proposal });
      setSummary(body.proposal.summary);
      setMore(false);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food-profile/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, edits: { summary } }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        version?: number;
        profile?: FoodProfileData;
        error?: string;
      };
      if (!res.ok || !body.profile) {
        setError(body.error ?? "No pudimos guardar tu perfil.");
        return;
      }
      setProfile({
        data: body.profile,
        summary,
        version: body.version ?? 1,
        updated_at: new Date().toISOString(),
      });
      setDraft(null);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (draft) await discardProfileDraft({ draftId: draft.id });
    setDraft(null);
  }

  if (busy && !draft) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-16 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-12 animate-spin text-accent" aria-hidden="true" />
        <p className="font-display text-[24px]">Armando tu perfil…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {draft ? (
        <DraftReview
          proposed={draft.proposal.profile}
          summary={summary}
          changes={draft.proposal.changes}
          openQuestions={draft.proposal.open_questions}
          busy={busy}
          error={error}
          onSummaryChange={setSummary}
          onAnswer={(question, answer) => void ingest({ answers: [{ question, answer }] })}
          onSave={() => void save()}
          onDiscard={() => void discard()}
        />
      ) : !profile || more ? (
        <Intake
          hasProfile={Boolean(profile)}
          error={error}
          onSubmit={(p) => void ingest(p)}
          onCancel={profile ? () => setMore(false) : undefined}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMore(true)}
            className="flex items-center gap-3.5 rounded-[22px] bg-hero p-4 text-left"
          >
            <span className="flex size-16 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_8px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
              <Mic className="size-7" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-semibold">Contame algo más</span>
              <span className="mt-0.5 block text-[13px] leading-[1.4] text-foreground/80">
                Hablá, escribí o subí el plan de tu nutricionista.
              </span>
            </span>
          </button>
          <ProfileView
            data={profile.data}
            summary={profile.summary}
            onChanged={(data, nextSummary) =>
              setProfile({ ...profile, data, summary: nextSummary, version: profile.version + 1 })
            }
          />
        </>
      )}

      <SourcesList
        sources={sources}
        onDeleted={(id) => setSources((prev) => prev.filter((s) => s.id !== id))}
      />
      <p className="text-center text-xs text-muted">{DISCLAIMER}</p>
    </div>
  );
}
