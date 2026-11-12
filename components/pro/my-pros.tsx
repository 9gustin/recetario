"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { acceptDelivery, dismissDelivery, endLink, updateSharing } from "@/lib/pro/actions";
import type { DeliveryRow, ProLink } from "@/lib/pro/queries";

type Group = { id: string; name: string; is_personal: boolean };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function MyPros({
  links,
  deliveries,
  groups,
  access,
}: {
  links: ProLink[];
  deliveries: DeliveryRow[];
  groups: Group[];
  access: { link_id: string; accessed_at: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [groupId, setGroupId] = useState(
    groups.find((g) => !g.is_personal)?.id ?? groups[0]?.id ?? "",
  );
  const pendingDeliveries = deliveries.filter((d) => d.status === "pending");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "No se pudo.");
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-7 px-5 pb-10">
      {pendingDeliveries.length > 0 ? (
        <section aria-label="Envíos pendientes" className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-normal">Te enviaron</h2>
          {groups.length > 1 ? (
            <>
              <label htmlFor="dest-group" className="text-sm font-medium">
                ¿En qué grupo lo guardamos?
              </label>
              <select
                id="dest-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="min-h-12 rounded-full border border-border bg-surface px-4 text-[15px]"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <ul className="flex flex-col gap-3">
            {pendingDeliveries.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-4"
              >
                <p className="text-[15px] font-bold">{d.title}</p>
                {d.message ? <p className="text-sm text-muted">“{d.message}”</p> : null}
                <ul className="text-sm">
                  {d.items.slice(0, 8).map((it, i) => (
                    <li key={i}>
                      • {it.title}
                      {it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {d.kind === "plan" ? (
                    <PillButton
                      size="md"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => acceptDelivery({ deliveryId: d.id, groupId, addToMenu: true }),
                          "Sumado a Mis comidas.",
                        )
                      }
                    >
                      Sumar a mis comidas
                    </PillButton>
                  ) : null}
                  <PillButton
                    size="md"
                    variant={d.kind === "plan" ? "outline" : "primary"}
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => acceptDelivery({ deliveryId: d.id, groupId, addToMenu: false }),
                        "Recetas guardadas.",
                      )
                    }
                  >
                    Guardar solo las recetas
                  </PillButton>
                  <PillButton
                    size="md"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => dismissDelivery({ deliveryId: d.id }), "Descartado.")}
                  >
                    Descartar
                  </PillButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Conectados" className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-normal">Conectados</h2>
        {links.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no estás conectado con ningún profesional. Cuando te mande una invitación, la
            vas a ver acá.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {links.map((l) => {
              const seen = access.filter((a) => a.link_id === l.id);
              return (
                <li
                  key={l.id}
                  className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-4"
                >
                  <p className="text-[15px] font-bold">{l.pro_name || "Tu profesional"}</p>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={l.share_meals}
                      disabled={pending}
                      onChange={(e) =>
                        run(
                          () =>
                            updateSharing({
                              linkId: l.id,
                              shareMeals: e.target.checked,
                              shareNotes: e.target.checked && l.share_notes,
                            }),
                          "Listo.",
                        )
                      }
                    />
                    Compartir mi registro de comidas
                  </label>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={l.share_notes}
                      disabled={pending || !l.share_meals}
                      onChange={(e) =>
                        run(
                          () =>
                            updateSharing({
                              linkId: l.id,
                              shareMeals: true,
                              shareNotes: e.target.checked,
                            }),
                          "Listo.",
                        )
                      }
                    />
                    Incluir mis notas
                  </label>
                  {seen.length > 0 ? (
                    <p className="text-xs text-muted">
                      Último acceso a tu seguimiento:{" "}
                      {dateFmt.format(new Date(seen[0]!.accessed_at))}
                    </p>
                  ) : null}
                  <PillButton
                    size="md"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("¿Terminar el vínculo? Deja de ver tu seguimiento."))
                        run(() => endLink({ linkId: l.id }), "Vínculo terminado.");
                    }}
                  >
                    Terminar vínculo
                  </PillButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
