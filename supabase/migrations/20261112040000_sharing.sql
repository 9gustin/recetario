-- T4.1 — Compartir recetas: links públicos, copias (fork) y bandeja de entrada.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.recipe_share_links (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  token text not null unique,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  view_count integer not null default 0
);
create index recipe_share_links_recipe_idx on public.recipe_share_links (recipe_id);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('recipe_shared', 'group_invite', 'plan_approved')),
  payload jsonb not null default '{}'::jsonb,
  from_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index inbox_items_user_idx on public.inbox_items (user_id, resolved_at);

-- Origen de las copias: se guarda el texto para no depender de permisos sobre el original.
alter table public.recipes
  add column forked_from_title text,
  add column forked_from_group_name text;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.recipe_share_links enable row level security;
alter table public.inbox_items enable row level security;

create policy "share_links_select_member" on public.recipe_share_links
  for select using (
    exists (select 1 from public.recipes r where r.id = recipe_id and public.is_group_member(r.group_id))
  );
create policy "share_links_insert_member" on public.recipe_share_links
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.recipes r where r.id = recipe_id and public.is_group_member(r.group_id))
  );
create policy "share_links_update_member" on public.recipe_share_links
  for update using (
    exists (select 1 from public.recipes r where r.id = recipe_id and public.is_group_member(r.group_id))
  );

-- Bandeja: solo el destinatario la ve y la actualiza; se crea únicamente vía RPC.
create policy "inbox_select_own" on public.inbox_items
  for select using (user_id = auth.uid());
create policy "inbox_update_own" on public.inbox_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Links públicos
-- ---------------------------------------------------------------------------
create or replace function public.create_share_link(p_recipe_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id and r.deleted_at is null and public.is_group_member(r.group_id)
  ) then
    raise exception 'Forbidden';
  end if;

  select token into v_token from public.recipe_share_links
  where recipe_id = p_recipe_id and revoked_at is null
  order by created_at desc limit 1;
  if v_token is not null then return v_token; end if;

  -- 18 bytes aleatorios en base64 (24 caracteres) con alfabeto seguro para URLs.
  v_token := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');
  insert into public.recipe_share_links (recipe_id, token, created_by)
  values (p_recipe_id, v_token, v_uid);
  return v_token;
end;
$$;

create or replace function public.revoke_share_link(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.recipes r where r.id = p_recipe_id and public.is_group_member(r.group_id)
  ) then
    raise exception 'Forbidden';
  end if;
  update public.recipe_share_links set revoked_at = now()
  where recipe_id = p_recipe_id and revoked_at is null;
end;
$$;

-- Receta pública por token. Sin IDs de grupo ni de usuario; cuenta la visita.
create or replace function public.get_public_recipe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.recipe_share_links;
  v_result jsonb;
begin
  select * into v_link from public.recipe_share_links
  where token = p_token and revoked_at is null;
  if not found then return null; end if;

  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'image_url', r.image_url,
    'servings', r.servings,
    'prep_minutes', r.prep_minutes,
    'cook_minutes', r.cook_minutes,
    'total_minutes', r.total_minutes,
    'difficulty', r.difficulty,
    'tags', to_jsonb(r.tags),
    'shared_by', jsonb_build_object('name', p.display_name, 'avatar_url', p.avatar_url),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'raw_text', i.raw_text, 'quantity', i.quantity, 'unit', i.unit,
        'preparation', i.preparation, 'section', i.section, 'optional', i.optional,
        'position', i.position
      ) order by i.position)
      from public.recipe_ingredients i where i.recipe_id = r.id
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', s.position, 'instruction', s.instruction,
        'duration_seconds', s.duration_seconds, 'timer_kind', s.timer_kind, 'tip', s.tip
      ) order by s.position)
      from public.recipe_steps s where s.recipe_id = r.id
    ), '[]'::jsonb)
  ) into v_result
  from public.recipes r
  left join public.profiles p on p.id = v_link.created_by
  where r.id = v_link.recipe_id and r.deleted_at is null;

  if v_result is null then return null; end if;

  update public.recipe_share_links set view_count = view_count + 1 where id = v_link.id;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copias (fork): compartir = copiar con vínculo al original
-- ---------------------------------------------------------------------------
-- Núcleo interno: lo usan los RPC de abajo después de validar el acceso. No es invocable por clientes.
create or replace function public._fork_recipe_core(p_source_id uuid, p_target_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.recipes;
  v_group_name text;
  v_payload jsonb;
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.group_members where group_id = p_target_group_id and user_id = v_uid
  ) then
    raise exception 'Forbidden';
  end if;

  select * into v_src from public.recipes where id = p_source_id and deleted_at is null;
  if not found then raise exception 'Recipe not found'; end if;
  select name into v_group_name from public.groups where id = v_src.group_id;

  v_payload := jsonb_build_object(
    'group_id', p_target_group_id,
    'title', v_src.title,
    'description', v_src.description,
    'image_url', v_src.image_url,
    'servings', v_src.servings,
    'prep_minutes', v_src.prep_minutes,
    'cook_minutes', v_src.cook_minutes,
    'total_minutes', v_src.total_minutes,
    'difficulty', v_src.difficulty,
    'tags', to_jsonb(v_src.tags),
    'source_type', 'fork',
    'source_url', v_src.source_url,
    'change_note', 'Copia de ' || v_src.title,
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ingredient_id', i.ingredient_id, 'raw_text', i.raw_text, 'quantity', i.quantity,
        'unit', i.unit, 'preparation', i.preparation, 'section', i.section,
        'optional', i.optional, 'position', i.position
      ) order by i.position)
      from public.recipe_ingredients i where i.recipe_id = v_src.id
    ), '[]'::jsonb),
    -- Los pasos pierden el vínculo a ingredientes por id (apuntaban a filas de la receta original).
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', s.position, 'instruction', s.instruction,
        'duration_seconds', s.duration_seconds, 'timer_kind', s.timer_kind, 'tip', s.tip,
        'ingredient_ids', '[]'::jsonb
      ) order by s.position)
      from public.recipe_steps s where s.recipe_id = v_src.id
    ), '[]'::jsonb)
  );

  v_new_id := (public.save_recipe(v_payload) ->> 'id')::uuid;

  update public.recipes set
    forked_from_recipe_id = v_src.id,
    forked_from_version = v_src.current_version,
    forked_from_title = v_src.title,
    forked_from_group_name = v_group_name
  where id = v_new_id;

  return v_new_id;
end;
$$;

-- Copia una receta de uno de mis grupos a otro grupo mío.
create or replace function public.fork_recipe(p_source_recipe_id uuid, p_target_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.recipes r
    where r.id = p_source_recipe_id and r.deleted_at is null and public.is_group_member(r.group_id)
  ) then
    raise exception 'Forbidden';
  end if;
  return public._fork_recipe_core(p_source_recipe_id, p_target_group_id);
end;
$$;

-- Guarda en mi grupo una receta que llegó por link público (hace falta sesión).
create or replace function public.fork_public_recipe(p_token text, p_target_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select recipe_id into v_recipe_id from public.recipe_share_links
  where token = p_token and revoked_at is null;
  if v_recipe_id is null then raise exception 'Link not available'; end if;
  return public._fork_recipe_core(v_recipe_id, p_target_group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bandeja
-- ---------------------------------------------------------------------------
create or replace function public.send_recipe_to_user(p_recipe_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recipe public.recipes;
  v_from_name text;
  v_item_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_user_id = v_uid then raise exception 'Cannot send to yourself'; end if;

  select * into v_recipe from public.recipes
  where id = p_recipe_id and deleted_at is null and public.is_group_member(group_id);
  if not found then raise exception 'Forbidden'; end if;

  -- Solo a personas con las que comparto algún grupo.
  if not exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = v_uid and b.user_id = p_user_id
  ) then
    raise exception 'No shared group';
  end if;

  select display_name into v_from_name from public.profiles where id = v_uid;

  insert into public.inbox_items (user_id, kind, payload, from_user_id)
  values (
    p_user_id, 'recipe_shared',
    jsonb_build_object(
      'recipe_id', v_recipe.id, 'title', v_recipe.title,
      'image_url', v_recipe.image_url, 'from_name', v_from_name
    ),
    v_uid
  )
  returning id into v_item_id;
  return v_item_id;
end;
$$;

create or replace function public.accept_inbox_recipe(p_inbox_id uuid, p_target_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.inbox_items;
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_item from public.inbox_items
  where id = p_inbox_id and user_id = v_uid and kind = 'recipe_shared' and resolved_at is null;
  if not found then raise exception 'Inbox item not found'; end if;

  v_new_id := public._fork_recipe_core((v_item.payload ->> 'recipe_id')::uuid, p_target_group_id);
  update public.inbox_items
  set resolved_at = now(), read_at = coalesce(read_at, now())
  where id = v_item.id;
  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke execute on function public._fork_recipe_core(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_share_link(uuid) from public, anon;
revoke execute on function public.revoke_share_link(uuid) from public, anon;
revoke execute on function public.fork_recipe(uuid, uuid) from public, anon;
revoke execute on function public.fork_public_recipe(text, uuid) from public, anon;
revoke execute on function public.send_recipe_to_user(uuid, uuid) from public, anon;
revoke execute on function public.accept_inbox_recipe(uuid, uuid) from public, anon;
revoke execute on function public.get_public_recipe(text) from public;
grant execute on function public.create_share_link(uuid) to authenticated;
grant execute on function public.revoke_share_link(uuid) to authenticated;
grant execute on function public.fork_recipe(uuid, uuid) to authenticated;
grant execute on function public.fork_public_recipe(text, uuid) to authenticated;
grant execute on function public.send_recipe_to_user(uuid, uuid) to authenticated;
grant execute on function public.accept_inbox_recipe(uuid, uuid) to authenticated;
grant execute on function public.get_public_recipe(text) to anon, authenticated;
