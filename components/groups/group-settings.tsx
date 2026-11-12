"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/shared/pill-button";
import { EmojiGrid } from "./emoji-grid";
import { InviteSheet } from "./invite-sheet";
import { ROLE_LABELS } from "@/lib/groups/constants";
import {
  leaveGroup,
  removeMember,
  renameGroup,
  setGroupEmoji,
  setMemberRole,
} from "@/lib/groups/actions";

export type GroupMember = {
  user_id: string;
  role: string;
  display_name: string | null;
};

type Props = {
  group: { id: string; name: string; emoji: string | null; is_personal: boolean };
  members: GroupMember[];
  myRole: string;
  myUserId: string;
  invites: { id: string; token: string; expires_at: string | null }[];
};

export function GroupSettings({ group, members, myRole, myUserId, invites }: Props) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState<string | null>(group.emoji);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canEdit = myRole === "owner" || myRole === "admin";

  function canRemove(targetRole: string) {
    if (myRole === "owner") return true;
    if (myRole === "admin") return targetRole === "member";
    return false;
  }

  function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r1 = await renameGroup({ groupId: group.id, name });
      if (!r1.ok) {
        toast.error(r1.error);
        return;
      }
      const r2 = await setGroupEmoji({ groupId: group.id, emoji });
      if (!r2.ok) {
        toast.error(r2.error);
        return;
      }
      toast.success("Grupo guardado");
    });
  }

  function changeRole(userId: string, role: string) {
    startTransition(async () => {
      const res = await setMemberRole({ groupId: group.id, userId, role });
      if (res.ok) toast.success("Rol actualizado");
      else toast.error(res.error);
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      const res = await removeMember({ groupId: group.id, userId });
      setConfirmRemoveId(null);
      if (res.ok) toast.success("Miembro sacado del grupo");
      else toast.error(res.error);
    });
  }

  function doLeave() {
    startTransition(async () => {
      const res = await leaveGroup({ groupId: group.id });
      if (res.ok) router.replace("/");
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? (
        <form onSubmit={saveDetails} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Nombre</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Emoji</span>
            <EmojiGrid value={emoji} onSelect={setEmoji} />
          </div>
          <PillButton type="submit" disabled={isPending || !name.trim()}>
            {isPending ? "Guardando…" : "Guardar"}
          </PillButton>
        </form>
      ) : (
        <header className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-2xl">
            {group.emoji ?? "🏠"}
          </span>
          <h1 className="font-display text-[28px] leading-none font-normal">{group.name}</h1>
        </header>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-[12px] font-bold tracking-[0.1em] text-muted uppercase">
          Miembros · {members.length}
        </h2>
        {members.map((m) => {
          const initial = (m.display_name?.trim().charAt(0) ?? "?").toUpperCase();
          const isSelf = m.user_id === myUserId;
          return (
            <div
              key={m.user_id}
              className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-full bg-accent font-display text-lg text-accent-foreground">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {m.display_name ?? "Sin nombre"}
                </p>
                <p className="text-[13px] text-muted">{ROLE_LABELS[m.role] ?? m.role}</p>
              </div>

              {isSelf ? (
                <span className="text-[13px] text-muted">Vos</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {myRole === "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}
                      aria-label={`Rol de ${m.display_name ?? "miembro"}`}
                      className="h-9 max-w-[110px] rounded-lg border border-border bg-background px-2 text-[13px]"
                    >
                      <option value="owner">Dueño/a</option>
                      <option value="admin">Admin</option>
                      <option value="member">Miembro</option>
                    </select>
                  ) : null}

                  {canRemove(m.role) ? (
                    confirmRemoveId === m.user_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => remove(m.user_id)}
                          className="min-h-9 rounded-lg bg-danger-soft/15 px-2.5 text-[13px] font-semibold text-danger-soft"
                        >
                          Sí, sacar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="min-h-9 rounded-lg border border-border px-2.5 text-[13px]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(m.user_id)}
                        className="min-h-9 rounded-lg border border-border px-2.5 text-[13px] font-semibold"
                      >
                        Sacar
                      </button>
                    )
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!group.is_personal && (myRole === "owner" || myRole === "admin") ? (
        <InviteSheet groupId={group.id} groupName={group.name} initialInvites={invites} />
      ) : null}

      {group.is_personal ? (
        <p className="text-sm text-muted">
          Para compartir con otras personas, creá un grupo.
        </p>
      ) : confirmLeave ? (
        <div className="flex items-center gap-2">
          <PillButton type="button" variant="outline" onClick={() => setConfirmLeave(false)}>
            Cancelar
          </PillButton>
          <PillButton type="button" variant="soft" onClick={doLeave} disabled={isPending}>
            {isPending ? "Saliendo…" : "Salir del grupo"}
          </PillButton>
        </div>
      ) : (
        <PillButton type="button" variant="outline" fullWidth onClick={() => setConfirmLeave(true)}>
          Salir del grupo
        </PillButton>
      )}
    </div>
  );
}
