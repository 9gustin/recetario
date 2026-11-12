import { z } from "zod";

export const prepKind = z.enum(["batch_cook", "cut", "marinate", "thaw", "wash", "portion"]);

export const prepTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(500).default(""),
  suggested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_minutes: z.number().int().positive().max(300),
  kind: prepKind,
  related_entry_ids: z.array(z.string()).max(20).default([]),
  /** Hora local sugerida del recordatorio (HH:MM), opcional. */
  remind_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
});

export const prepOutputSchema = z.object({
  tasks: z.array(prepTaskSchema).max(30),
  tips: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
});

export type PrepTaskDraft = z.infer<typeof prepTaskSchema>;
export type PrepOutput = z.infer<typeof prepOutputSchema>;
