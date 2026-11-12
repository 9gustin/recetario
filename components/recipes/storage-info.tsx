import { Snowflake, Thermometer } from "lucide-react";
import type { StorageInfo } from "@/lib/ai/storage/generate";

/** Cuánto dura la receta cocinada y cómo recalentarla. */
export function StorageInfoCard({ info }: { info: Partial<StorageInfo> | null }) {
  if (!info || info.fridge_days === undefined) return null;
  return (
    <section
      aria-labelledby="conservacion"
      className="flex flex-col gap-2 rounded-2xl bg-surface p-4"
    >
      <h2 id="conservacion" className="font-display text-xl font-normal">
        Conservación
      </h2>
      <p className="flex items-center gap-2 text-sm">
        <Thermometer className="size-4 flex-none" aria-hidden="true" /> En la heladera: hasta{" "}
        {info.fridge_days} {info.fridge_days === 1 ? "día" : "días"}
      </p>
      {info.freezer_days ? (
        <p className="flex items-center gap-2 text-sm">
          <Snowflake className="size-4 flex-none" aria-hidden="true" /> En el freezer: hasta{" "}
          {info.freezer_days} días
        </p>
      ) : null}
      {info.reheat ? <p className="text-sm text-muted">Para recalentar: {info.reheat}</p> : null}
      {info.tip ? <p className="text-sm text-muted">{info.tip}</p> : null}
    </section>
  );
}
