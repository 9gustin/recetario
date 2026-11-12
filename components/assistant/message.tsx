import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hooks/use-assistant-chat";
import type { Proposal } from "@/lib/ai/assistant/events";
import { ProposalCard } from "./proposal-card";

type Props = {
  message: ChatMessage;
  groupId: string;
  onApplyInSession?: (proposal: Extract<Proposal, { kind: "recipe_change" }>) => void;
};

/** Burbuja del chat: la del usuario (con las recetas citadas como chips) o la del asistente (con propuestas). */
export function Message({ message, groupId, onApplyInSession }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex max-w-[84%] flex-col items-start gap-1.5 self-end rounded-[18px_18px_4px_18px] bg-hero px-3.5 py-2.5 text-sm leading-[1.45]">
        {message.mentions.map((m) => (
          <Link
            key={m.id}
            href={`/g/${groupId}/recetas/${m.id}`}
            className="inline-flex min-h-7 max-w-full items-center rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-foreground"
          >
            <span className="truncate">{m.title}</span>
          </Link>
        ))}
        <span className="whitespace-pre-wrap">{message.text}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex max-w-[92%] flex-col gap-2 rounded-[18px_18px_18px_4px] bg-surface px-3.5 py-3 text-sm leading-[1.5]",
        message.failed && "border border-danger-soft/60",
      )}
    >
      {message.text ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
      {message.working ? (
        <p className="flex items-center gap-2 text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {message.working}
        </p>
      ) : null}
      {message.proposals.map((p, i) => (
        <ProposalCard key={i} proposal={p} groupId={groupId} onApplyInSession={onApplyInSession} />
      ))}
    </div>
  );
}
