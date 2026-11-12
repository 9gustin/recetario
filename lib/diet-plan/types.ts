export type DietMealRow = {
  id: string;
  slot: string;
  days: number[] | null;
  formula: string | null;
  components: { group: string; portion?: string; allowed?: boolean }[];
  options: string[];
  position: number;
};

export type DietSwapRow = {
  id: string;
  meal_id: string | null;
  original: string;
  replacement: string;
  reason: string | null;
};

export type DietPlanFull = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  summary: string | null;
  starts_on: string | null;
  ends_on: string | null;
  next_checkup: string | null;
  rules: { text: string; kind?: string }[];
  allowances: { per_week?: number; definition?: string };
  open_questions: string[];
  version: number;
  meals: DietMealRow[];
  swaps: DietSwapRow[];
};
