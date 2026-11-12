-- T14.1–T14.4 — Nutricionistas: códigos de invitación, planes, vínculo con pacientes, envíos y seguimiento.
-- Datos de salud: todo se comparte solo con vínculo aceptado y permisos del paciente (revocables).

alter table public.profiles add column is_professional boolean not null default false;

-- Códigos de invitación (los genera el administrador por SQL/script; sin policies: nadie los lista).
create table public.professional_invites (
  code text primary key check (code = upper(code) and length(code) between 6 and 40),
  note text,
  max_uses integer not null default 1 check (max_uses >= 1),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.professional_invites enable row level security;

create table public.professional_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  license text check (license is null or length(license) <= 40),
  bio text check (bio is null or length(bio) <= 500),
  invite_code text,
  created_at timestamptz not null default now()
);
alter table public.professional_profiles enable row level security;
create policy "pro_profiles_own" on public.professional_profiles
  for select using (user_id = auth.uid());
create policy "pro_profiles_update_own" on public.professional_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_professional()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_professional from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.redeem_professional_code(p_code text, p_name text, p_license text, p_bio text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.professional_invites;
  v_code text := upper(trim(p_code));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if public.is_professional() then raise exception 'Ya sos profesional' using errcode = '23505'; end if;
  select * into v_inv from public.professional_invites where code = v_code for update;
  if v_inv.code is null
     or v_inv.uses >= v_inv.max_uses
     or (v_inv.expires_at is not null and v_inv.expires_at < now()) then
    raise exception 'Código inválido o vencido' using errcode = 'P0002';
  end if;
  update public.professional_invites set uses = uses + 1 where code = v_code;
  update public.profiles set is_professional = true where id = auth.uid();
  insert into public.professional_profiles (user_id, display_name, license, bio, invite_code)
  values (auth.uid(), trim(p_name), nullif(trim(p_license), ''), nullif(trim(p_bio), ''), v_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- Planes del profesional
-- ---------------------------------------------------------------------------
create table public.pro_plans (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 120),
  goal text check (goal is null or length(goal) <= 300),
  goal_tags text[] not null default '{}',
  notes text check (notes is null or length(notes) <= 2000),
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pro_plans_pro_idx on public.pro_plans (pro_id);
create trigger pro_plans_updated_at before update on public.pro_plans
  for each row execute function public.set_updated_at();

create table public.pro_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pro_plans (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete set null,
  title text check (title is null or length(title) <= 200),
  free_text text check (free_text is null or length(free_text) <= 200),
  quantity integer not null default 1 check (quantity between 1 and 20),
  note text check (note is null or length(note) <= 300),
  position integer not null default 0,
  check (recipe_id is not null or free_text is not null)
);
create index pro_plan_items_plan_idx on public.pro_plan_items (plan_id, position);

-- Solo se pueden usar recetas públicas (catálogo o de la comunidad).
create or replace function public.check_pro_item_recipe()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipe_id is not null and not exists (
    select 1 from public.recipes where id = new.recipe_id and visibility = 'public' and status = 'active' and deleted_at is null
  ) then
    raise exception 'Solo se pueden usar recetas públicas' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pro_plan_items_check_recipe before insert or update of recipe_id on public.pro_plan_items
  for each row execute function public.check_pro_item_recipe();

alter table public.pro_plans enable row level security;
alter table public.pro_plan_items enable row level security;
create policy "pro_plans_own" on public.pro_plans
  for all using (pro_id = auth.uid() and public.is_professional())
  with check (pro_id = auth.uid() and public.is_professional());
create policy "pro_plan_items_own" on public.pro_plan_items
  for all using (exists (select 1 from public.pro_plans p where p.id = plan_id and p.pro_id = auth.uid()))
  with check (exists (select 1 from public.pro_plans p where p.id = plan_id and p.pro_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Vínculo profesional ↔ paciente
-- ---------------------------------------------------------------------------
create table public.pro_links (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid references public.profiles (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 80),
  pro_name text not null default '',
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  share_meals boolean not null default false,
  share_notes boolean not null default false,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (pro_id <> patient_id)
);
create index pro_links_pro_idx on public.pro_links (pro_id, status);
create index pro_links_patient_idx on public.pro_links (patient_id, status);
alter table public.pro_links enable row level security;
-- Se leen directamente; todo cambio pasa por RPC.
create policy "pro_links_read" on public.pro_links
  for select using (pro_id = auth.uid() or patient_id = auth.uid());

create table public.pro_deliveries (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.pro_links (id) on delete cascade,
  kind text not null check (kind in ('plan', 'recipes')),
  title text not null,
  pro_plan_id uuid references public.pro_plans (id) on delete set null,
  recipe_ids uuid[] not null default '{}',
  -- Foto del contenido al momento del envío (el plan puede cambiar después).
  items jsonb not null default '[]'::jsonb,
  message text check (message is null or length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index pro_deliveries_link_idx on public.pro_deliveries (link_id, created_at desc);
alter table public.pro_deliveries enable row level security;
create policy "pro_deliveries_read" on public.pro_deliveries
  for select using (exists (
    select 1 from public.pro_links l where l.id = link_id and (l.pro_id = auth.uid() or l.patient_id = auth.uid())
  ));

-- Cada vez que el profesional mira el seguimiento queda registrado (el paciente lo puede ver).
create table public.pro_access_log (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.pro_links (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  range_from date,
  range_to date
);
alter table public.pro_access_log enable row level security;
create policy "pro_access_log_patient_read" on public.pro_access_log
  for select using (exists (select 1 from public.pro_links l where l.id = link_id and l.patient_id = auth.uid()));

-- Aviso en la bandeja del paciente.
alter table public.inbox_items drop constraint inbox_items_kind_check;
alter table public.inbox_items
  add constraint inbox_items_kind_check
  check (kind in ('recipe_shared', 'group_invite', 'plan_approved', 'member_joined', 'list_done', 'pro_delivery'));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.pro_create_link(p_label text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.is_professional() then raise exception 'Forbidden'; end if;
  -- Límite contra abuso: hasta 30 invitaciones sin aceptar.
  if (select count(*) from public.pro_links where pro_id = auth.uid() and status = 'invited') >= 30 then
    raise exception 'Demasiadas invitaciones pendientes' using errcode = '23514';
  end if;
  insert into public.pro_links (pro_id, label, pro_name)
  values (auth.uid(), trim(p_label), (select display_name from public.professional_profiles where user_id = auth.uid()))
  returning token into v_token;
  return v_token;
end;
$$;

-- Lo que ve quien abre el link de invitación (antes de aceptar).
create or replace function public.get_pro_link_invite(p_token text)
returns table (link_id uuid, status text, pro_name text, pro_license text, mine boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.status, pp.display_name, pp.license, l.patient_id = auth.uid()
  from public.pro_links l join public.professional_profiles pp on pp.user_id = l.pro_id
  where l.token = p_token and auth.uid() is not null
$$;

create or replace function public.accept_pro_link(p_token text, p_share_meals boolean, p_share_notes boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_l public.pro_links;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_l from public.pro_links where token = p_token for update;
  if v_l.id is null or v_l.status = 'revoked' then raise exception 'Invitación inválida' using errcode = 'P0002'; end if;
  if v_l.pro_id = auth.uid() then raise exception 'No podés ser tu propio paciente' using errcode = '23514'; end if;
  if v_l.patient_id is not null and v_l.patient_id <> auth.uid() then
    raise exception 'Esta invitación ya fue usada' using errcode = '23505';
  end if;
  update public.pro_links
  set patient_id = auth.uid(), status = 'active', accepted_at = coalesce(accepted_at, now()),
      share_meals = p_share_meals, share_notes = p_share_meals and p_share_notes
  where id = v_l.id;
  return v_l.id;
end;
$$;

create or replace function public.update_pro_link_sharing(p_link_id uuid, p_share_meals boolean, p_share_notes boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pro_links
  set share_meals = p_share_meals, share_notes = p_share_meals and p_share_notes
  where id = p_link_id and patient_id = auth.uid() and status = 'active';
  if not found then raise exception 'Forbidden'; end if;
end;
$$;

-- Cualquiera de las dos partes puede terminar el vínculo; deja de compartirse todo.
create or replace function public.end_pro_link(p_link_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pro_links
  set status = 'revoked', revoked_at = now(), share_meals = false, share_notes = false
  where id = p_link_id and (pro_id = auth.uid() or patient_id = auth.uid()) and status <> 'revoked';
  if not found then raise exception 'Forbidden'; end if;
end;
$$;

create or replace function public._pro_notify(p_link public.pro_links, p_title text, p_delivery uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.inbox_items (user_id, kind, payload, from_user_id)
  values (p_link.patient_id, 'pro_delivery', jsonb_build_object('deliveryId', p_delivery, 'title', p_title,
    'message', coalesce(nullif(p_link.pro_name, ''), 'Tu profesional') || ' te envió ' || p_title, 'url', '/perfil/profesional'),
    p_link.pro_id);
end;
$$;

create or replace function public.pro_send_plan(p_link_id uuid, p_plan_id uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_l public.pro_links;
  v_p public.pro_plans;
  v_id uuid;
  v_items jsonb;
begin
  select * into v_l from public.pro_links where id = p_link_id and pro_id = auth.uid() and status = 'active';
  if v_l.id is null then raise exception 'Forbidden'; end if;
  select * into v_p from public.pro_plans where id = p_plan_id and pro_id = auth.uid();
  if v_p.id is null then raise exception 'Forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'recipe_id', i.recipe_id, 'free_text', i.free_text, 'quantity', i.quantity, 'note', i.note,
      'title', coalesce(r.title, i.free_text)) order by i.position), '[]'::jsonb)
  into v_items
  from public.pro_plan_items i left join public.recipes r on r.id = i.recipe_id
  where i.plan_id = p_plan_id;
  if jsonb_array_length(v_items) = 0 then raise exception 'El plan está vacío' using errcode = '23514'; end if;
  insert into public.pro_deliveries (link_id, kind, title, pro_plan_id, items, message)
  values (v_l.id, 'plan', v_p.title, v_p.id, v_items, nullif(trim(p_message), ''))
  returning id into v_id;
  perform public._pro_notify(v_l, v_p.title, v_id);
  return v_id;
end;
$$;

create or replace function public.pro_send_recipes(p_link_id uuid, p_title text, p_recipe_ids uuid[], p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_l public.pro_links;
  v_id uuid;
  v_items jsonb;
begin
  select * into v_l from public.pro_links where id = p_link_id and pro_id = auth.uid() and status = 'active';
  if v_l.id is null then raise exception 'Forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('recipe_id', r.id, 'title', r.title, 'quantity', 1)), '[]'::jsonb)
  into v_items
  from public.recipes r
  where r.id = any (p_recipe_ids) and r.visibility = 'public' and r.status = 'active' and r.deleted_at is null;
  if jsonb_array_length(v_items) = 0 then raise exception 'Elegí al menos una receta pública' using errcode = '23514'; end if;
  insert into public.pro_deliveries (link_id, kind, title, recipe_ids, items, message)
  values (v_l.id, 'recipes', coalesce(nullif(trim(p_title), ''), 'Recetas para vos'), p_recipe_ids, v_items, nullif(trim(p_message), ''))
  returning id into v_id;
  perform public._pro_notify(v_l, coalesce(nullif(trim(p_title), ''), 'Recetas para vos'), v_id);
  return v_id;
end;
$$;

-- El paciente acepta: las recetas se guardan en su recetario; un plan suma sus comidas a "Mis comidas"
-- (nunca pisa lo que ya tiene).
create or replace function public.accept_pro_delivery(p_delivery_id uuid, p_group_id uuid, p_add_to_menu boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_d public.pro_deliveries;
  v_l public.pro_links;
  v_it jsonb;
  v_rid uuid;
  v_menu uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select d.* into v_d from public.pro_deliveries d
  join public.pro_links l on l.id = d.link_id
  where d.id = p_delivery_id and l.patient_id = auth.uid() and l.status = 'active' and d.status = 'pending';
  if v_d.id is null then raise exception 'Forbidden'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Forbidden'; end if;
  if p_add_to_menu and v_d.kind = 'plan' then v_menu := public.get_or_create_menu(p_group_id); end if;

  for v_it in select * from jsonb_array_elements(v_d.items) loop
    v_rid := null;
    if v_it ->> 'recipe_id' is not null then
      v_rid := public._fork_recipe_core((v_it ->> 'recipe_id')::uuid, p_group_id);
      v_count := v_count + 1;
    end if;
    if v_menu is not null then
      insert into public.meal_plan_entries (plan_id, recipe_id, free_text, quantity)
      values (v_menu, v_rid, case when v_rid is null then v_it ->> 'free_text' else null end,
              coalesce((v_it ->> 'quantity')::integer, 1));
    end if;
  end loop;
  update public.pro_deliveries set status = 'accepted', resolved_at = now() where id = v_d.id;
  update public.inbox_items set resolved_at = now()
    where user_id = auth.uid() and kind = 'pro_delivery' and payload ->> 'deliveryId' = v_d.id::text;
  return v_count;
end;
$$;

create or replace function public.dismiss_pro_delivery(p_delivery_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pro_deliveries d set status = 'dismissed', resolved_at = now()
  from public.pro_links l
  where d.id = p_delivery_id and l.id = d.link_id and l.patient_id = auth.uid() and d.status = 'pending';
  if not found then raise exception 'Forbidden'; end if;
  update public.inbox_items set resolved_at = now()
    where user_id = auth.uid() and kind = 'pro_delivery' and payload ->> 'deliveryId' = p_delivery_id::text;
end;
$$;

-- Seguimiento: solo con vínculo activo y permiso del paciente. Cada lectura queda registrada.
create or replace function public.pro_patient_log(p_link_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_l public.pro_links;
  v_logs jsonb;
  v_cooked jsonb;
begin
  select * into v_l from public.pro_links
  where id = p_link_id and pro_id = auth.uid() and status = 'active' and share_meals;
  if v_l.id is null then raise exception 'Forbidden'; end if;
  if p_to - p_from > 92 then raise exception 'Rango demasiado largo' using errcode = '23514'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', m.date, 'slot', m.slot, 'status', m.status,
    'note', case when v_l.share_notes then m.note else null end) order by m.date, m.slot), '[]'::jsonb)
  into v_logs
  from public.meal_logs m
  where m.user_id = v_l.patient_id and m.date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', (s.finished_at at time zone 'America/Argentina/Buenos_Aires')::date,
    'title', r.title,
    'rating', s.rating) order by s.finished_at), '[]'::jsonb)
  into v_cooked
  from public.cooking_sessions s join public.recipes r on r.id = s.recipe_id
  where s.user_id = v_l.patient_id and s.finished_at is not null
    and (s.finished_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to;

  insert into public.pro_access_log (link_id, range_from, range_to) values (v_l.id, p_from, p_to);
  return jsonb_build_object('logs', v_logs, 'cooked', v_cooked, 'share_notes', v_l.share_notes);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'redeem_professional_code(text, text, text, text)', 'pro_create_link(text)', 'get_pro_link_invite(text)',
    'accept_pro_link(text, boolean, boolean)', 'update_pro_link_sharing(uuid, boolean, boolean)', 'end_pro_link(uuid)',
    'pro_send_plan(uuid, uuid, text)', 'pro_send_recipes(uuid, text, uuid[], text)',
    'accept_pro_delivery(uuid, uuid, boolean)', 'dismiss_pro_delivery(uuid)', 'pro_patient_log(uuid, date, date)',
    'is_professional()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public._pro_notify(public.pro_links, text, uuid) from public, anon, authenticated';
end $$;
