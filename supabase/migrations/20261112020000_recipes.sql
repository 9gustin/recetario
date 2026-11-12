-- Etapa 2 · T2.1 — Recetas e ingredientes.

-- ---------------------------------------------------------------------------
-- Configuración de búsqueda full-text en español sin acentos
-- ---------------------------------------------------------------------------
create text search configuration public.spanish_unaccent (copy = pg_catalog.spanish);
alter text search configuration public.spanish_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.spanish_stem;

-- ---------------------------------------------------------------------------
-- Catálogo global de ingredientes
-- ---------------------------------------------------------------------------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  family text[] not null default '{}',
  aisle text,
  default_unit text,
  unit_weight_g numeric,
  shelf_life jsonb,
  storage_tips text,
  nutrition_per_100g jsonb,
  created_by_ai boolean not null default false,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recetas
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  image_url text,
  servings numeric not null default 2,
  prep_minutes integer,
  cook_minutes integer,
  total_minutes integer,
  difficulty text check (difficulty in ('facil', 'media', 'dificil')),
  tags text[] not null default '{}',
  source_type text not null default 'manual'
    check (source_type in ('manual', 'text', 'url', 'photo', 'voice', 'ai_generated', 'fork')),
  source_url text,
  forked_from_recipe_id uuid references public.recipes (id) on delete set null,
  forked_from_version integer,
  current_version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'draft')),
  storage_info jsonb,
  search_tsv tsvector,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  raw_text text,
  quantity numeric,
  unit text,
  preparation text,
  section text,
  optional boolean not null default false,
  position integer not null default 0
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null default 0,
  instruction text not null,
  duration_seconds integer,
  timer_kind text check (timer_kind in ('active', 'passive')),
  tip text,
  image_url text,
  ingredient_ids uuid[]
);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_note text,
  origin text not null check (origin in ('edit', 'cooking_session', 'ai_adapt', 'restore')),
  created_at timestamptz not null default now(),
  unique (recipe_id, version)
);

create table public.recipe_favorites (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

-- ---------------------------------------------------------------------------
-- search_tsv: título (A), tags (B), descripción (C) y nombres de ingredientes (C)
-- ---------------------------------------------------------------------------
-- search_tsv completo (título + tags + descripción + nombres de ingredientes)
create or replace function public.recipes_search_tsv(p_recipe_id uuid)
returns tsvector
language sql
stable
set search_path = public
as $$
  select
    setweight(to_tsvector('public.spanish_unaccent', coalesce(r.title, '')), 'A') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(array_to_string(r.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(r.description, '')), 'C') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(
      (select string_agg(coalesce(ri.raw_text, ''), ' ')
       from public.recipe_ingredients ri where ri.recipe_id = r.id), '')), 'C')
  from public.recipes r where r.id = p_recipe_id;
$$;

-- Al insertar/editar la receta: search_tsv desde sus propias columnas (los ingredientes
-- se suman en el trigger de recipe_ingredients, cuando ya existen).
create or replace function public.recipes_search_trigger_fn()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('public.spanish_unaccent', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

create trigger recipes_search_trigger
  before insert or update of title, tags, description on public.recipes
  for each row execute function public.recipes_search_trigger_fn();

-- Al cambiar los ingredientes: refresca el search_tsv del padre (con ingredientes).
create or replace function public.recipe_ingredients_search_trigger_fn()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.recipe_id, old.recipe_id);
begin
  update public.recipes r set search_tsv = public.recipes_search_tsv(r.id) where r.id = v_id;
  return coalesce(new, old);
end;
$$;

create trigger recipe_ingredients_search_trigger
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.recipe_ingredients_search_trigger_fn();

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index recipes_search_tsv_idx on public.recipes using gin (search_tsv);
create index ingredients_name_trgm_idx on public.ingredients using gin (name extensions.gin_trgm_ops);
create index recipes_group_id_idx on public.recipes (group_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);
create index recipe_versions_recipe_id_idx on public.recipe_versions (recipe_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_favorites enable row level security;

-- ¿Es miembro del grupo dueño de una receta? (evita recursión de RLS)
create or replace function public.is_recipe_member(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recipes r
    join public.group_members gm on gm.group_id = r.group_id
    where r.id = p_recipe_id and gm.user_id = auth.uid()
  );
$$;

-- ingredients: lectura pública; escritura solo service role (sin policies de insert/update/delete).
create policy "ingredients_select" on public.ingredients
  for select using (true);

-- recipes
create policy "recipes_select_member" on public.recipes
  for select using (public.is_group_member(group_id));
create policy "recipes_insert_member" on public.recipes
  for insert with check (public.is_group_member(group_id));
create policy "recipes_update_member" on public.recipes
  for update using (public.is_group_member(group_id));
create policy "recipes_delete_member" on public.recipes
  for delete using (public.is_group_member(group_id));

-- recipe_ingredients
create policy "recipe_ingredients_select_member" on public.recipe_ingredients
  for select using (public.is_recipe_member(recipe_id));
create policy "recipe_ingredients_insert_member" on public.recipe_ingredients
  for insert with check (public.is_recipe_member(recipe_id));
create policy "recipe_ingredients_update_member" on public.recipe_ingredients
  for update using (public.is_recipe_member(recipe_id));
create policy "recipe_ingredients_delete_member" on public.recipe_ingredients
  for delete using (public.is_recipe_member(recipe_id));

-- recipe_steps
create policy "recipe_steps_select_member" on public.recipe_steps
  for select using (public.is_recipe_member(recipe_id));
create policy "recipe_steps_insert_member" on public.recipe_steps
  for insert with check (public.is_recipe_member(recipe_id));
create policy "recipe_steps_update_member" on public.recipe_steps
  for update using (public.is_recipe_member(recipe_id));
create policy "recipe_steps_delete_member" on public.recipe_steps
  for delete using (public.is_recipe_member(recipe_id));

-- recipe_versions
create policy "recipe_versions_select_member" on public.recipe_versions
  for select using (public.is_recipe_member(recipe_id));
create policy "recipe_versions_insert_member" on public.recipe_versions
  for insert with check (public.is_recipe_member(recipe_id));

-- recipe_favorites: solo el propio usuario
create policy "recipe_favorites_select_own" on public.recipe_favorites
  for select using (user_id = auth.uid());
create policy "recipe_favorites_insert_own" on public.recipe_favorites
  for insert with check (user_id = auth.uid());
create policy "recipe_favorites_delete_own" on public.recipe_favorites
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: guardar receta (crear/actualizar + reemplazar ingredientes y pasos + snapshot)
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(p_recipe jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid := nullif(p_recipe ->> 'group_id', '')::uuid;
  v_recipe_id uuid := nullif(p_recipe ->> 'id', '')::uuid;
  v_new_version integer;
  v_ingredients jsonb;
  v_steps jsonb;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_group_id is null then raise exception 'Missing group'; end if;
  if not exists (select 1 from public.group_members where group_id = v_group_id and user_id = v_uid) then
    raise exception 'Forbidden';
  end if;

  if v_recipe_id is null then
    insert into public.recipes (
      group_id, created_by, title, description, servings, prep_minutes, cook_minutes,
      total_minutes, difficulty, tags, source_type, source_url, image_url, status, current_version
    ) values (
      v_group_id, v_uid,
      nullif(p_recipe ->> 'title', ''),
      nullif(p_recipe ->> 'description', ''),
      coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 2),
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      nullif(p_recipe ->> 'cook_minutes', '')::integer,
      nullif(p_recipe ->> 'total_minutes', '')::integer,
      nullif(p_recipe ->> 'difficulty', ''),
      ARRAY(SELECT jsonb_array_elements_text(p_recipe -> 'tags')),
      coalesce(p_recipe ->> 'source_type', 'manual'),
      nullif(p_recipe ->> 'source_url', ''),
      nullif(p_recipe ->> 'image_url', ''),
      coalesce(p_recipe ->> 'status', 'active'),
      1
    )
    returning id into v_recipe_id;
    v_new_version := 1;
  else
    perform 1 from public.recipes
    where id = v_recipe_id and group_id = v_group_id and deleted_at is null
    for update;
    if not found then raise exception 'Recipe not found'; end if;

    update public.recipes set
      title = coalesce(nullif(p_recipe ->> 'title', ''), title),
      description = nullif(p_recipe ->> 'description', ''),
      servings = coalesce(nullif(p_recipe ->> 'servings', '')::numeric, servings),
      prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
      cook_minutes = nullif(p_recipe ->> 'cook_minutes', '')::integer,
      total_minutes = nullif(p_recipe ->> 'total_minutes', '')::integer,
      difficulty = nullif(p_recipe ->> 'difficulty', ''),
      tags = ARRAY(SELECT jsonb_array_elements_text(p_recipe -> 'tags')),
      source_url = nullif(p_recipe ->> 'source_url', ''),
      image_url = coalesce(nullif(p_recipe ->> 'image_url', ''), image_url),
      status = coalesce(p_recipe ->> 'status', status),
      current_version = current_version + 1
    where id = v_recipe_id
    returning current_version into v_new_version;
  end if;

  -- Reemplazar ingredientes.
  delete from public.recipe_ingredients where recipe_id = v_recipe_id;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, raw_text, quantity, unit, preparation, section, optional, position)
  select
    v_recipe_id,
    nullif(i ->> 'ingredient_id', '')::uuid,
    i ->> 'raw_text',
    nullif(i ->> 'quantity', '')::numeric,
    nullif(i ->> 'unit', ''),
    nullif(i ->> 'preparation', ''),
    nullif(i ->> 'section', ''),
    coalesce((i ->> 'optional')::boolean, false),
    coalesce((i ->> 'position')::integer, 0)
  from jsonb_array_elements(coalesce(p_recipe -> 'ingredients', '[]'::jsonb)) as i;

  -- Reemplazar pasos.
  delete from public.recipe_steps where recipe_id = v_recipe_id;
  insert into public.recipe_steps (recipe_id, position, instruction, duration_seconds, timer_kind, tip, ingredient_ids)
  select
    v_recipe_id,
    coalesce((s ->> 'position')::integer, 0),
    s ->> 'instruction',
    nullif(s ->> 'duration_seconds', '')::integer,
    nullif(s ->> 'timer_kind', ''),
    nullif(s ->> 'tip', ''),
    ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(s -> 'ingredient_ids') x)
  from jsonb_array_elements(coalesce(p_recipe -> 'steps', '[]'::jsonb)) as s;

  -- Snapshot de la versión.
  select jsonb_agg(jsonb_build_object(
    'raw_text', ri.raw_text, 'quantity', ri.quantity, 'unit', ri.unit,
    'preparation', ri.preparation, 'section', ri.section, 'optional', ri.optional,
    'position', ri.position, 'ingredient_id', ri.ingredient_id
  ) order by ri.position) into v_ingredients
  from public.recipe_ingredients ri where ri.recipe_id = v_recipe_id;

  select jsonb_agg(jsonb_build_object(
    'position', rs.position, 'instruction', rs.instruction,
    'duration_seconds', rs.duration_seconds, 'timer_kind', rs.timer_kind,
    'tip', rs.tip, 'ingredient_ids', rs.ingredient_ids
  ) order by rs.position) into v_steps
  from public.recipe_steps rs where rs.recipe_id = v_recipe_id;

  select jsonb_build_object(
    'title', r.title, 'description', r.description, 'servings', r.servings,
    'prep_minutes', r.prep_minutes, 'cook_minutes', r.cook_minutes, 'total_minutes', r.total_minutes,
    'difficulty', r.difficulty, 'tags', r.tags,
    'ingredients', coalesce(v_ingredients, '[]'::jsonb),
    'steps', coalesce(v_steps, '[]'::jsonb)
  ) into v_snapshot
  from public.recipes r where r.id = v_recipe_id;

  insert into public.recipe_versions (recipe_id, version, snapshot, changed_by, change_note, origin)
  values (v_recipe_id, v_new_version, v_snapshot, v_uid, p_recipe ->> 'change_note',
          coalesce(p_recipe ->> 'origin', 'edit'));

  return jsonb_build_object('id', v_recipe_id, 'current_version', v_new_version);
end;
$$;

revoke execute on function public.save_recipe(jsonb) from anon;

-- ---------------------------------------------------------------------------
-- RPC: buscar ingredientes (trigram + aliases)
-- ---------------------------------------------------------------------------
create or replace function public.search_ingredients(q text, lim int default 10)
returns table (id uuid, name text, aliases text[], similarity real)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.name, i.aliases,
         greatest(
           extensions.similarity(i.name, q),
           coalesce((select max(extensions.similarity(a, q)) from unnest(i.aliases) a), 0)
         )::real as similarity
  from public.ingredients i
  where extensions.similarity(i.name, q) > 0.2
     or exists (select 1 from unnest(i.aliases) a where extensions.similarity(a, q) > 0.2)
  order by similarity desc
  limit greatest(lim, 1);
$$;

-- ---------------------------------------------------------------------------
-- Storage: bucket de imágenes de recetas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create or replace function public.is_storage_group_member(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_group_member(nullif(split_part(p_path, '/', 1), '')::uuid);
$$;

create policy "recipe_images_public_read" on storage.objects
  for select using (bucket_id = 'recipe-images');
create policy "recipe_images_member_insert" on storage.objects
  for insert with check (bucket_id = 'recipe-images' and public.is_storage_group_member(name));
create policy "recipe_images_member_update" on storage.objects
  for update using (bucket_id = 'recipe-images' and public.is_storage_group_member(name));
create policy "recipe_images_member_delete" on storage.objects
  for delete using (bucket_id = 'recipe-images' and public.is_storage_group_member(name));
