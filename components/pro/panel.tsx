"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Copy, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import { createPatientLink } from "@/lib/pro/actions";
import type { ProLink, ProPlanRow } from "@/lib/pro/queries";

const STATUS = { invited: "Invitación enviada", active: "Activo", revoked: "Terminado" } as const;

export function ProPanel({ links, plans }: { links: ProLink[]; plans: ProPlanRow[] }) {
  const [label, setLabel] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const urlFor = (token: string) => `${window.location.origin}/p/${token}`;

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createPatientLink({ label });
      if (!res.ok) return void toast.error(res.error);
      setLabel("");
      setInvite(res.data.token);
      void copy(res.data.token);
    });
  }

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      <section aria-label="Pacientes" className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-normal">Pacientes</h2>
        <form onSubmit={create} className="flex items-center gap-2">
          <label htmlFor="patient-label" className="sr-only">
            Nombre del paciente
          </label>
          <Input
            id="patient-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre del paciente"
          />
          <PillButton type="submit" size="md" disabled={pending || !label.trim()}>
            Invitar
          </PillButton>
        </form>
        {invite ? (
          <p role="status" className="rounded-2xl bg-hero px-4 py-3 text-sm">
            Copiamos el link de invitación. Mandáselo a tu paciente:
            <button
              type="button"
              onClick={() => void copy(invite)}
              className="mt-1 flex min-h-11 items-center gap-2 font-semibold underline"
            >
              <Copy className="size-4" aria-hidden="true" /> Copiar de nuevo
            </button>
          </p>
        ) : null}
        {links.length === 0 ? (
          <p className="text-sm text-muted">Todavía no invitaste pacientes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/pro/pacientes/${l.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
                >
                  <UserRound className="size-5" aria-hidden="true" />
                  <span className="flex-1 text-[15px] font-semibold">{l.label}</span>
                  <span className="text-xs text-muted">{STATUS[l.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Mis planes" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-normal">Mis planes</h2>
          <PillButton asChild size="md" variant="outline">
            <Link href="/pro/planes/nuevo">
              <Plus /> Nuevo
            </Link>
          </PillButton>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-muted">Armá tu primer plan con recetas del catálogo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pro/planes/${p.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
                >
                  <ClipboardList className="size-5" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                    {p.goal ? (
                      <span className="block truncate text-xs text-muted">{p.goal}</span>
                    ) : null}
                  </span>
                  {p.is_template ? <span className="text-xs text-muted">Plantilla</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
