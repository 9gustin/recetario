-- T13.1 — Planes por rango: un plan puede cubrir 1 a 14 días (la semana sigue siendo el caso común).

alter table public.meal_plans add column end_date date;
update public.meal_plans set end_date = week_start + 6;

create or replace function public.meal_plans_default_end()
returns trigger language plpgsql as $$
begin
  if new.end_date is null then new.end_date := new.week_start + 6; end if;
  return new;
end;
$$;
create trigger meal_plans_default_end before insert on public.meal_plans
  for each row execute function public.meal_plans_default_end();

alter table public.meal_plans alter column end_date set not null;
alter table public.meal_plans add constraint meal_plans_range_check
  check (end_date >= week_start and end_date <= week_start + 13);

-- duplicar conserva la duración del plan original
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
    raise exception 'Ya hay un plan para esa fecha' using errcode = '23505';
  end if;

  v_shift := p_week_start - v_src.week_start;
  insert into public.meal_plans (group_id, week_start, end_date, status, title, notes, created_by)
  values (v_src.group_id, p_week_start, v_src.end_date + v_shift, 'draft', v_src.title, v_src.notes, auth.uid())
  returning id into v_new;

  for e in select * from public.meal_plan_entries where plan_id = p_plan_id order by date, position loop
    insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, free_text, servings, diner_ids, cook_date, is_new_recipe, position)
    values (v_new, e.date + v_shift, e.slot, e.recipe_id, e.free_text, e.servings, e.diner_ids,
            case when e.cook_date is null then null else e.cook_date + v_shift end, false, e.position)
    returning id into v_new_entry;
    v_map := v_map || jsonb_build_object(e.id::text, v_new_entry::text);
  end loop;

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

create or replace function public.copy_public_plan(p_slug text, p_group_id uuid, p_week_start date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_len date;
  v_src uuid;
  v_week date;
  v_plan uuid;
  v_map jsonb := '{}'::jsonb;
  v_e record;
  v_new uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Forbidden'; end if;
  select s.plan_id, p.week_start, p.end_date into v_src, v_week, v_len from public.plan_shares s join public.meal_plans p on p.id = s.plan_id where s.slug = p_slug;
  if v_src is null then raise exception 'Plan not found'; end if;

  insert into public.meal_plans (group_id, week_start, end_date, status, created_by) values (p_group_id, p_week_start, p_week_start + (v_len - v_week), 'draft', auth.uid())
  returning id into v_plan;

  for v_e in
    select e.*, r.visibility as rvis from public.meal_plan_entries e
    left join public.recipes r on r.id = e.recipe_id
    where e.plan_id = v_src order by e.date, e.position
  loop
    v_new := null;
    if v_e.recipe_id is not null and v_e.rvis = 'public' then
      if v_map ? v_e.recipe_id::text then
        v_new := (v_map ->> v_e.recipe_id::text)::uuid;
      else
        v_new := public._fork_recipe_core(v_e.recipe_id, p_group_id);
        v_map := v_map || jsonb_build_object(v_e.recipe_id::text, v_new);
      end if;
    end if;
    -- Solo se copia lo que el grupo usa; el momento tiene que estar habilitado.
    if exists (select 1 from public.groups g where g.id = p_group_id and v_e.slot = any (g.meal_slots)) then
      insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, free_text, position)
      values (v_plan, p_week_start + (v_e.date - v_week), v_e.slot, v_new,
              case when v_new is null then coalesce(v_e.free_text, 'Comida') else null end, v_e.position);
    end if;
  end loop;
  return v_plan;
end;
$$;
