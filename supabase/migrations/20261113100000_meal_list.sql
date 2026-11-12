-- T13.2 — "Mis comidas": listado sin día ni momento, guardado solo.
-- Las comidas sin fecha viven en un plan especial por grupo (el "menú", con week_start = 2000-01-01).

alter table public.meal_plan_entries alter column date drop not null;
alter table public.meal_plan_entries alter column slot drop not null;
alter table public.meal_plan_entries add column quantity integer not null default 1 check (quantity between 1 and 20);
alter table public.meal_plan_entries add column cooked_at timestamptz;

-- Menú vigente del grupo: se crea al primer uso.
create or replace function public.get_or_create_menu(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Forbidden'; end if;
  select id into v_id from public.meal_plans
  where group_id = p_group_id and week_start = date '2000-01-01' and status <> 'archived';
  if v_id is null then
    insert into public.meal_plans (group_id, week_start, end_date, status, title, created_by, approved_by, approved_at)
    values (p_group_id, date '2000-01-01', date '2000-01-01', 'approved', 'Mis comidas', auth.uid(), auth.uid(), now())
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.get_or_create_menu(uuid) from public, anon;
grant execute on function public.get_or_create_menu(uuid) to authenticated;

-- Una comida sin momento es válida (listado "Mis comidas").
create or replace function public.check_entry_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slot is null then return new; end if;
  if not exists (
    select 1 from public.meal_plans p join public.groups g on g.id = p.group_id
    where p.id = new.plan_id and new.slot = any (g.meal_slots)
  ) then
    raise exception 'El momento % no está habilitado en este grupo', new.slot using errcode = '23514';
  end if;
  return new;
end;
$$;
