/** Validación de las preparaciones anticipadas que propone la IA. Lógica pura, sin DB ni IA. */
import { daysBetween } from "./week";

export type PrepTaskInput = {
  title: string;
  details?: string;
  suggested_date: string;
  kind: "batch_cook" | "cut" | "marinate" | "thaw" | "wash" | "portion";
  related_entry_ids: string[];
};

export type PrepEntryInfo = {
  id: string;
  /** Día en que se usa (o se cocina). */
  useDate: string;
  /** Días que aguanta en heladera lo más perecedero de la comida (null = sin dato). */
  shelfDays: number | null;
};

export type PrepRejection = { task: PrepTaskInput; reason: string };

const isFreezing = (t: PrepTaskInput) =>
  t.kind === "portion" && /freez|congel/i.test(`${t.title} ${t.details ?? ""}`);

/**
 * Ninguna tarea antes de la compra; ninguna después del uso; lo preparado no puede superar su vida útil
 * (salvo que se congele); descongelar 0–1 día antes del uso (12–24 h).
 */
export function validatePrep(
  tasks: PrepTaskInput[],
  entries: PrepEntryInfo[],
  purchaseDate: string,
): { valid: PrepTaskInput[]; rejected: PrepRejection[] } {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const valid: PrepTaskInput[] = [];
  const rejected: PrepRejection[] = [];

  for (const task of tasks) {
    const related = task.related_entry_ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const reject = (reason: string) => rejected.push({ task, reason });

    if (task.related_entry_ids.length > 0 && related.length === 0) {
      reject("Se refiere a comidas que no están en el plan.");
      continue;
    }
    if (task.suggested_date < purchaseDate) {
      reject("Está antes de la compra de los ingredientes.");
      continue;
    }
    if (related.length === 0) {
      valid.push(task);
      continue;
    }
    const firstUse = related.map((e) => e.useDate).sort()[0]!;
    if (task.suggested_date > firstUse) {
      reject("Está después del día en que se usa.");
      continue;
    }
    const gap = daysBetween(task.suggested_date, firstUse);
    if (task.kind === "thaw") {
      if (gap > 1) {
        reject("Descongelar tiene que ser el día anterior (12 a 24 horas antes).");
        continue;
      }
    } else if (!isFreezing(task)) {
      const shelf = Math.min(...related.map((e) => e.shelfDays ?? Infinity));
      if (gap > shelf) {
        reject(
          `Lo preparado no aguanta ${gap} días en la heladera (dura ${shelf}): conviene congelarlo.`,
        );
        continue;
      }
    }
    valid.push(task);
  }
  return { valid, rejected };
}
