-- T3.1 — Sesiones de cocina (modo cocinar).

create table public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  recipe_version integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  plan_entry_id uuid,
  servings numeric not null check (servings > 0),
  current_step integer not null default 0 check (current_step >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rating smallint check (rating between 1 and 5),
  note text,
  photo_url text,
  pending_edits jsonb not null default '[]'::jsonb
);

create index cooking_sessions_recipe_idx on public.cooking_sessions (recipe_id, finished_at desc);
create index cooking_sessions_user_idx on public.cooking_sessions (user_id, finished_at);

alter table public.cooking_sessions enable row level security;

-- Cada persona ve y toca solo sus sesiones; el resto del grupo accede a un resumen vía
-- `recipe_last_cooked` (la tabla incluye notas y fotos que no se comparten).
create policy "cooking_sessions_select_own" on public.cooking_sessions
  for select using (user_id = auth.uid());

create policy "cooking_sessions_insert_own" on public.cooking_sessions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.is_group_member(r.group_id)
    )
  );

create policy "cooking_sessions_update_own" on public.cooking_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cooking_sessions_delete_own" on public.cooking_sessions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: última vez que alguien del grupo cocinó la receta (solo fecha, puntaje y quién).
-- ---------------------------------------------------------------------------
create or replace function public.recipe_last_cooked(p_recipe_id uuid)
returns table (finished_at timestamptz, rating smallint, cooked_by text)
language sql
stable
security definer
set search_path = public
as $$
  select s.finished_at, s.rating, p.display_name
  from public.cooking_sessions s
  join public.recipes r on r.id = s.recipe_id
  left join public.profiles p on p.id = s.user_id
  where s.recipe_id = p_recipe_id
    and s.finished_at is not null
    and public.is_group_member(r.group_id)
  order by s.finished_at desc
  limit 1;
$$;

revoke execute on function public.recipe_last_cooked(uuid) from public, anon;
grant execute on function public.recipe_last_cooked(uuid) to authenticated;
