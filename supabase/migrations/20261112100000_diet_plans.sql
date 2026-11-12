-- T8B.1 — Plan vivo: plan de la nutricionista digitalizado, reemplazos, versiones y registro diario.
-- Todo es privado del usuario; al grupo solo llega la fórmula por momento (get_group_meal_rules).

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null default 'Mi plan',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  starts_on date,
  ends_on date,
  next_checkup date,
  rules jsonb not null default '[]'::jsonb,
  allowances jsonb not null default '{}'::jsonb,
  summary text,
  version integer not null default 1,
  source_input_ids uuid[] not null default '{}',
  open_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index diet_plans_one_active_idx on public.diet_plans (user_id) where status = 'active';
create index diet_plans_user_idx on public.diet_plans (user_id, status);
create trigger diet_plans_updated_at before update on public.diet_plans
  for each row execute function public.set_updated_at();

create table public.diet_plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'merienda', 'dinner', 'snack')),
  days smallint[],
  formula text,
  components jsonb not null default '[]'::jsonb,
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0
);
create index diet_plan_meals_plan_idx on public.diet_plan_meals (plan_id, position);

create table public.diet_plan_swaps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  meal_id uuid references public.diet_plan_meals (id) on delete set null,
  original text not null,
  replacement text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.diet_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  plan_id uuid references public.diet_plans (id) on delete set null,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'merienda', 'dinner', 'snack')),
  status text not null check (status in ('followed', 'changed', 'allowance', 'skipped')),
  note text,
  ai_suggested_status text,
  plan_entry_id uuid references public.meal_plan_entries (id) on delete set null,
  cooking_session_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, date, slot)
);
create index meal_logs_user_date_idx on public.meal_logs (user_id, date);

create or replace function public.diet_plan_owner(p_plan_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.diet_plans where id = p_plan_id
$$;

alter table public.diet_plans enable row level security;
alter table public.diet_plan_meals enable row level security;
alter table public.diet_plan_swaps enable row level security;
alter table public.diet_plan_versions enable row level security;
alter table public.meal_logs enable row level security;

create policy "diet_plans_own" on public.diet_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "diet_plan_meals_own" on public.diet_plan_meals
  for all using (public.diet_plan_owner(plan_id) = auth.uid())
  with check (public.diet_plan_owner(plan_id) = auth.uid());
create policy "diet_plan_swaps_own" on public.diet_plan_swaps
  for all using (public.diet_plan_owner(plan_id) = auth.uid())
  with check (public.diet_plan_owner(plan_id) = auth.uid());
create policy "diet_plan_versions_own" on public.diet_plan_versions
  for all using (public.diet_plan_owner(plan_id) = auth.uid())
  with check (public.diet_plan_owner(plan_id) = auth.uid());
create policy "meal_logs_own" on public.meal_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reemplaza las comidas del plan, sube la versión y guarda un snapshot. Transaccional.
-- p_plan: { id?, title, starts_on, ends_on, next_checkup, rules, allowances, summary, source_input_ids, open_questions,
--           meals: [{ slot, days, formula, components, options }] }
create or replace function public.save_diet_plan(p_plan jsonb, p_change_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_version integer;
  v_meal jsonb;
  v_pos integer := 0;
  v_snapshot jsonb;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_id := nullif(p_plan ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.diet_plans (user_id, title, starts_on, ends_on, next_checkup, rules, allowances, summary, source_input_ids, open_questions)
    values (
      v_user,
      coalesce(p_plan ->> 'title', 'Mi plan'),
      nullif(p_plan ->> 'starts_on', '')::date,
      nullif(p_plan ->> 'ends_on', '')::date,
      nullif(p_plan ->> 'next_checkup', '')::date,
      coalesce(p_plan -> 'rules', '[]'::jsonb),
      coalesce(p_plan -> 'allowances', '{}'::jsonb),
      p_plan ->> 'summary',
      coalesce(array(select jsonb_array_elements_text(coalesce(p_plan -> 'source_input_ids', '[]'::jsonb)))::uuid[], '{}'),
      coalesce(p_plan -> 'open_questions', '[]'::jsonb)
    ) returning id, version into v_id, v_version;
  else
    if not exists (select 1 from public.diet_plans where id = v_id and user_id = v_user) then
      raise exception 'Forbidden';
    end if;
    update public.diet_plans set
      title = coalesce(p_plan ->> 'title', title),
      starts_on = case when p_plan ? 'starts_on' then nullif(p_plan ->> 'starts_on', '')::date else starts_on end,
      ends_on = case when p_plan ? 'ends_on' then nullif(p_plan ->> 'ends_on', '')::date else ends_on end,
      next_checkup = case when p_plan ? 'next_checkup' then nullif(p_plan ->> 'next_checkup', '')::date else next_checkup end,
      rules = coalesce(p_plan -> 'rules', rules),
      allowances = coalesce(p_plan -> 'allowances', allowances),
      summary = coalesce(p_plan ->> 'summary', summary),
      open_questions = coalesce(p_plan -> 'open_questions', open_questions),
      version = version + 1
    where id = v_id
    returning version into v_version;
  end if;

  if p_plan ? 'meals' then
    delete from public.diet_plan_meals where plan_id = v_id;
    for v_meal in select * from jsonb_array_elements(p_plan -> 'meals') loop
      insert into public.diet_plan_meals (plan_id, slot, days, formula, components, options, position)
      values (
        v_id,
        v_meal ->> 'slot',
        case when v_meal ? 'days' and jsonb_typeof(v_meal -> 'days') = 'array'
          then array(select jsonb_array_elements_text(v_meal -> 'days')::smallint) else null end,
        v_meal ->> 'formula',
        coalesce(v_meal -> 'components', '[]'::jsonb),
        coalesce(v_meal -> 'options', '[]'::jsonb),
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  select jsonb_build_object(
    'plan', to_jsonb(p) - 'user_id',
    'meals', coalesce((select jsonb_agg(to_jsonb(m) - 'plan_id' order by m.position) from public.diet_plan_meals m where m.plan_id = p.id), '[]'::jsonb)
  ) into v_snapshot
  from public.diet_plans p where p.id = v_id;

  insert into public.diet_plan_versions (plan_id, version, snapshot, change_note)
  values (v_id, v_version, v_snapshot, p_change_note);

  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;
revoke all on function public.save_diet_plan(jsonb, text) from public;
grant execute on function public.save_diet_plan(jsonb, text) to authenticated;

-- Activa un borrador y archiva el plan activo anterior de la misma persona.
create or replace function public.activate_diet_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.diet_plans where id = p_plan_id and user_id = auth.uid()) then
    raise exception 'Forbidden';
  end if;
  update public.diet_plans set status = 'archived' where user_id = auth.uid() and status = 'active' and id <> p_plan_id;
  update public.diet_plans set status = 'active' where id = p_plan_id;
end;
$$;
revoke all on function public.activate_diet_plan(uuid) from public;
grant execute on function public.activate_diet_plan(uuid) to authenticated;

-- Lo único que ve el grupo del plan vivo: slot, fórmula y componentes. Nunca registros, reemplazos ni archivos.
create or replace function public.get_group_meal_rules(p_group_id uuid)
returns table (user_id uuid, display_name text, slot text, days smallint[], formula text, components jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Forbidden'; end if;
  return query
    select p.user_id, pr.display_name, m.slot, m.days, m.formula, m.components
    from public.diet_plans p
    join public.group_members gm on gm.user_id = p.user_id and gm.group_id = p_group_id
    join public.profiles pr on pr.id = p.user_id
    join public.diet_plan_meals m on m.plan_id = p.id
    where p.status = 'active'
    order by p.user_id, m.position;
end;
$$;
revoke all on function public.get_group_meal_rules(uuid) from public;
grant execute on function public.get_group_meal_rules(uuid) to authenticated;

-- Registro de una comida: un registro por (usuario, fecha, momento).
create or replace function public.log_meal(p_date date, p_slot text, p_status text, p_note text default null,
  p_plan_entry_id uuid default null, p_ai_suggested text default null)
returns public.meal_logs
language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_log public.meal_logs;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_plan from public.diet_plans where user_id = auth.uid() and status = 'active';
  insert into public.meal_logs (user_id, plan_id, date, slot, status, note, plan_entry_id, ai_suggested_status)
  values (auth.uid(), v_plan, p_date, p_slot, p_status, p_note, p_plan_entry_id, p_ai_suggested)
  on conflict (user_id, date, slot) do update
    set status = excluded.status, note = excluded.note, plan_id = excluded.plan_id,
        plan_entry_id = coalesce(excluded.plan_entry_id, public.meal_logs.plan_entry_id),
        ai_suggested_status = excluded.ai_suggested_status
  returning * into v_log;
  return v_log;
end;
$$;
revoke all on function public.log_meal(date, text, text, text, uuid, text) from public;
grant execute on function public.log_meal(date, text, text, text, uuid, text) to authenticated;
