-- T7.1 — Planes semanales: plan, entradas por día y momento, y tareas de preparación.

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  title text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  generation_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un solo plan vigente por grupo y semana (los archivados no cuentan).
create unique index meal_plans_group_week_idx on public.meal_plans (group_id, week_start) where status <> 'archived';
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'merienda', 'dinner', 'snack')),
  recipe_id uuid references public.recipes (id) on delete set null,
  free_text text,
  servings numeric check (servings is null or servings > 0),
  diner_ids uuid[] not null default '{}',
  cook_date date,
  leftovers_of_entry_id uuid references public.meal_plan_entries (id) on delete set null,
  is_new_recipe boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_id is not null or free_text is not null)
);
create index meal_plan_entries_plan_idx on public.meal_plan_entries (plan_id, date, slot);
create trigger meal_plan_entries_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();
alter table public.meal_plan_entries replica identity full;

create table public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  title text not null,
  details text,
  suggested_date date,
  duration_minutes integer,
  kind text not null check (kind in ('batch_cook', 'cut', 'marinate', 'thaw', 'wash', 'portion')),
  related_entry_ids uuid[] not null default '{}',
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  remind_at timestamptz,
  created_at timestamptz not null default now()
);
create index prep_tasks_plan_idx on public.prep_tasks (plan_id, suggested_date);

-- Las recetas que propone la IA nacen en borrador y quedan atadas al plan que las propuso.
alter table public.recipes add column draft_for_plan_id uuid references public.meal_plans (id) on delete set null;

-- El momento tiene que estar entre los que el grupo usa (groups.meal_slots).
create or replace function public.check_entry_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.meal_plans p join public.groups g on g.id = p.group_id
    where p.id = new.plan_id and new.slot = any (g.meal_slots)
  ) then
    raise exception 'El momento % no está habilitado en este grupo', new.slot using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger meal_plan_entries_check_slot before insert or update of slot on public.meal_plan_entries
  for each row execute function public.check_entry_slot();

-- ---------------------------------------------------------------------------
-- RLS por grupo (las entradas y tareas, a través del plan)
-- ---------------------------------------------------------------------------
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.prep_tasks enable row level security;

create or replace function public.plan_group_id(p_plan_id uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select group_id from public.meal_plans where id = p_plan_id $$;

create policy "meal_plans_member_all" on public.meal_plans
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "meal_plan_entries_member_all" on public.meal_plan_entries
  for all using (public.is_group_member(public.plan_group_id(plan_id)))
  with check (public.is_group_member(public.plan_group_id(plan_id)));
create policy "prep_tasks_member_all" on public.prep_tasks
  for all using (public.is_group_member(public.plan_group_id(plan_id)))
  with check (public.is_group_member(public.plan_group_id(plan_id)));

-- Tiempo real entre las personas del grupo.
alter publication supabase_realtime add table public.meal_plans, public.meal_plan_entries;

-- ---------------------------------------------------------------------------
-- RPC: aprobar el plan
-- ---------------------------------------------------------------------------
create or replace function public.approve_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select group_id into v_group from public.meal_plans where id = p_plan_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'Forbidden'; end if;

  update public.meal_plans
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_plan_id;

  -- Las recetas nuevas que quedaron en el plan pasan a formar parte del recetario…
  update public.recipes set status = 'active', draft_for_plan_id = null
  where status = 'draft'
    and id in (select recipe_id from public.meal_plan_entries where plan_id = p_plan_id and recipe_id is not null);

  -- …y las que la IA propuso y quedaron fuera se borran.
  delete from public.recipes
  where status = 'draft' and draft_for_plan_id = p_plan_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: duplicar un plan a otra semana (fechas corridas, sobras reenlazadas)
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_plan(p_plan_id uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.meal_plans;
  v_new uuid;
  v_shift integer;
  e record;
  v_new_entry uuid;
  v_map jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_src from public.meal_plans where id = p_plan_id;
  if v_src.id is null or not public.is_group_member(v_src.group_id) then raise exception 'Forbidden'; end if;
  if exists (select 1 from public.meal_plans where group_id = v_src.group_id and week_start = p_week_start and status <> 'archived') then
    raise exception 'Ya hay un plan para esa semana' using errcode = '23505';
  end if;

  v_shift := p_week_start - v_src.week_start;
  insert into public.meal_plans (group_id, week_start, status, title, notes, created_by)
  values (v_src.group_id, p_week_start, 'draft', v_src.title, v_src.notes, auth.uid())
  returning id into v_new;

  for e in select * from public.meal_plan_entries where plan_id = p_plan_id order by date, position loop
    insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, free_text, servings, diner_ids, cook_date, is_new_recipe, position)
    values (v_new, e.date + v_shift, e.slot, e.recipe_id, e.free_text, e.servings, e.diner_ids,
            case when e.cook_date is null then null else e.cook_date + v_shift end, false, e.position)
    returning id into v_new_entry;
    v_map := v_map || jsonb_build_object(e.id::text, v_new_entry::text);
  end loop;

  -- Las sobras apuntan a la entrada nueva equivalente.
  update public.meal_plan_entries n
  set leftovers_of_entry_id = (v_map ->> o.leftovers_of_entry_id::text)::uuid
  from public.meal_plan_entries o
  where n.plan_id = v_new
    and o.plan_id = p_plan_id
    and o.leftovers_of_entry_id is not null
    and (v_map ->> o.id::text)::uuid = n.id;

  return v_new;
end;
$$;

revoke execute on function public.approve_plan(uuid) from public, anon;
revoke execute on function public.duplicate_plan(uuid, date) from public, anon;
grant execute on function public.approve_plan(uuid) to authenticated;
grant execute on function public.duplicate_plan(uuid, date) to authenticated;
