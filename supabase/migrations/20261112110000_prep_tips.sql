-- T9.2 — Tips de la semana generados junto a las preparaciones.
alter table public.meal_plans add column prep_tips jsonb not null default '[]'::jsonb;
