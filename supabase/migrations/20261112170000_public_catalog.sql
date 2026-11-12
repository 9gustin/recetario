-- T12.1 — Modelo público: recetas públicas, catálogo del sistema, colecciones y planes compartidos.
-- Lo público se lee SOLO a través de RPCs (security definer): las tablas siguen cerradas para anon.

alter table public.recipes
  add column visibility text not null default 'private' check (visibility in ('private', 'public')),
  add column slug text,
  add column is_catalog boolean not null default false,
  add column published_at timestamptz;
create unique index recipes_slug_idx on public.recipes (slug) where slug is not null;
create index recipes_public_idx on public.recipes (visibility, is_catalog) where visibility = 'public';

-- Grupo del sistema "Catálogo": nadie es miembro, así que nadie lo edita desde la app.
insert into public.groups (id, name, emoji, is_personal)
values ('00000000-0000-4000-8000-00000000ca7a', 'Catálogo', '📚', false)
on conflict (id) do nothing;

create table public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 600),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  slug text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipe_collections_slug_idx on public.recipe_collections (slug) where slug is not null;
create trigger recipe_collections_updated_at before update on public.recipe_collections
  for each row execute function public.set_updated_at();

create table public.recipe_collection_items (
  collection_id uuid not null references public.recipe_collections (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, recipe_id)
);

-- Un plan semanal publicado como plantilla (solo comidas; sin comensales ni datos del grupo).
create table public.plan_shares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 600),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (plan_id)
);

alter table public.recipe_collections enable row level security;
alter table public.recipe_collection_items enable row level security;
alter table public.plan_shares enable row level security;

create policy "collections_member_all" on public.recipe_collections
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "collection_items_member_all" on public.recipe_collection_items
  for all using (public.is_group_member((select group_id from public.recipe_collections c where c.id = collection_id)))
  with check (public.is_group_member((select group_id from public.recipe_collections c where c.id = collection_id)));
create policy "plan_shares_member_all" on public.plan_shares
  for all using (public.is_group_member(public.plan_group_id(plan_id)))
  with check (public.is_group_member(public.plan_group_id(plan_id)));

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
create or replace function public._slugify(p_text text, p_id uuid)
returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(translate(p_text,
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g')), ''), 'receta')
    || '-' || substr(replace(p_id::text, '-', ''), 1, 6)
$$;

-- ---------------------------------------------------------------------------
-- Publicar / despublicar (solo miembros del grupo dueño)
-- ---------------------------------------------------------------------------
create or replace function public.set_recipe_visibility(p_recipe_id uuid, p_public boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_r public.recipes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_r from public.recipes where id = p_recipe_id and deleted_at is null;
  if not found or not public.is_group_member(v_r.group_id) then raise exception 'Forbidden'; end if;
  if v_r.is_catalog then raise exception 'Forbidden'; end if;
  if p_public and v_r.status <> 'active' then raise exception 'Solo se publican recetas confirmadas'; end if;
  update public.recipes set
    visibility = case when p_public then 'public' else 'private' end,
    slug = case when p_public then coalesce(slug, public._slugify(title, id)) else slug end,
    published_at = case when p_public then coalesce(published_at, now()) else null end
  where id = p_recipe_id
  returning slug into v_r.slug;
  return v_r.slug;
end;
$$;

create or replace function public.set_collection_visibility(p_collection_id uuid, p_public boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_c public.recipe_collections;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_c from public.recipe_collections where id = p_collection_id;
  if not found or not public.is_group_member(v_c.group_id) then raise exception 'Forbidden'; end if;
  update public.recipe_collections set
    visibility = case when p_public then 'public' else 'private' end,
    slug = case when p_public then coalesce(slug, public._slugify(title, id)) else slug end,
    published_at = case when p_public then coalesce(published_at, now()) else null end
  where id = p_collection_id
  returning slug into v_c.slug;
  -- Publicar una colección publica sus recetas (si no, el link mostraría huecos).
  if p_public then
    update public.recipes r set
      visibility = 'public', slug = coalesce(r.slug, public._slugify(r.title, r.id)), published_at = coalesce(r.published_at, now())
    where r.id in (select recipe_id from public.recipe_collection_items where collection_id = p_collection_id)
      and r.deleted_at is null and r.status = 'active' and not r.is_catalog;
  end if;
  return v_c.slug;
end;
$$;

create or replace function public.publish_plan(p_plan_id uuid, p_title text, p_description text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select group_id into v_group from public.meal_plans where id = p_plan_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'Forbidden'; end if;
  v_slug := public._slugify(p_title, p_plan_id);
  insert into public.plan_shares (plan_id, slug, title, description)
  values (p_plan_id, v_slug, p_title, p_description)
  on conflict (plan_id) do update set title = excluded.title, description = excluded.description
  returning slug into v_slug;
  -- Las recetas del plan se publican para que quien lo vea pueda abrirlas.
  update public.recipes r set
    visibility = 'public', slug = coalesce(r.slug, public._slugify(r.title, r.id)), published_at = coalesce(r.published_at, now())
  where r.id in (select recipe_id from public.meal_plan_entries where plan_id = p_plan_id and recipe_id is not null)
    and r.deleted_at is null and r.status = 'active' and not r.is_catalog;
  return v_slug;
end;
$$;

create or replace function public.unpublish_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_group_member(public.plan_group_id(p_plan_id)) then raise exception 'Forbidden'; end if;
  delete from public.plan_shares where plan_id = p_plan_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lectura pública (anon): búsqueda y fichas
-- ---------------------------------------------------------------------------
create or replace function public.search_public_recipes(
  p_q text default null,
  p_max_minutes integer default null,
  p_tag text default null,
  p_catalog text default 'all',          -- 'all' | 'catalog' | 'community'
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, description text, image_url text, total_minutes integer,
  servings numeric, tags text[], is_catalog boolean, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with q as (
    select case when nullif(trim(p_q), '') is null then null
           else websearch_to_tsquery('spanish_unaccent', p_q) end as tsq
  ), base as (
    select r.*, (select tsq from q) as tsq
    from public.recipes r
    where r.visibility = 'public' and r.status = 'active' and r.deleted_at is null and r.slug is not null
      and (p_max_minutes is null or (r.total_minutes is not null and r.total_minutes <= p_max_minutes))
      and (p_tag is null or p_tag = any (r.tags))
      and (p_catalog = 'all' or (p_catalog = 'catalog' and r.is_catalog) or (p_catalog = 'community' and not r.is_catalog))
      and ((select tsq from q) is null or r.search_tsv @@ (select tsq from q))
  )
  select b.id, b.slug, b.title, b.description, b.image_url, b.total_minutes, b.servings, b.tags, b.is_catalog,
         count(*) over () as total_count
  from base b
  order by
    case when b.tsq is null then 0 else ts_rank(b.search_tsv, b.tsq) end desc,
    b.is_catalog asc,                         -- primero lo de la comunidad, después el catálogo
    b.published_at desc nulls last,
    b.title
  limit greatest(1, least(p_limit, 60)) offset greatest(0, p_offset)
$$;

create or replace function public.get_published_recipe(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'description', r.description, 'image_url', r.image_url,
    'servings', r.servings, 'prep_minutes', r.prep_minutes, 'cook_minutes', r.cook_minutes,
    'total_minutes', r.total_minutes, 'difficulty', r.difficulty, 'tags', to_jsonb(r.tags),
    'is_catalog', r.is_catalog, 'storage_info', r.storage_info, 'published_at', r.published_at,
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object('raw_text', i.raw_text, 'quantity', i.quantity, 'unit', i.unit,
        'preparation', i.preparation, 'section', i.section, 'optional', i.optional, 'position', i.position)
        order by i.position)
      from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('position', s.position, 'instruction', s.instruction,
        'duration_seconds', s.duration_seconds, 'timer_kind', s.timer_kind, 'tip', s.tip)
        order by s.position)
      from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r
  where r.slug = p_slug and r.visibility = 'public' and r.status = 'active' and r.deleted_at is null
$$;

create or replace function public.get_public_collection(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description,
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.slug, 'title', r.title, 'description', r.description,
        'image_url', r.image_url, 'total_minutes', r.total_minutes, 'tags', to_jsonb(r.tags)) order by i.position)
      from public.recipe_collection_items i
      join public.recipes r on r.id = i.recipe_id
      where i.collection_id = c.id and r.visibility = 'public' and r.status = 'active' and r.deleted_at is null), '[]'::jsonb)
  )
  from public.recipe_collections c
  where c.slug = p_slug and c.visibility = 'public'
$$;

create or replace function public.get_public_plan(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', s.slug, 'title', s.title, 'description', s.description,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', (e.date - p.week_start), 'slot', e.slot, 'free_text', e.free_text,
        'recipe', case when r.id is not null and r.visibility = 'public' then
          jsonb_build_object('slug', r.slug, 'title', r.title, 'image_url', r.image_url, 'total_minutes', r.total_minutes)
          else null end,
        'recipe_title', case when r.id is not null and r.visibility <> 'public' then r.title else null end
      ) order by e.date, e.position)
      from public.meal_plan_entries e
      left join public.recipes r on r.id = e.recipe_id
      where e.plan_id = p.id), '[]'::jsonb)
  )
  from public.plan_shares s join public.meal_plans p on p.id = s.plan_id
  where s.slug = p_slug
$$;

create or replace function public.list_public_slugs()
returns table (kind text, slug text, updated timestamptz)
language sql stable security definer set search_path = public as $$
  select 'receta', slug, coalesce(published_at, created_at) from public.recipes
    where visibility = 'public' and status = 'active' and deleted_at is null and slug is not null
  union all
  select 'coleccion', slug, coalesce(published_at, created_at) from public.recipe_collections where visibility = 'public' and slug is not null
  union all
  select 'plan', slug, created_at from public.plan_shares
$$;

-- ---------------------------------------------------------------------------
-- Guardar / usar (requiere sesión)
-- ---------------------------------------------------------------------------
create or replace function public.fork_published_recipe(p_recipe_id uuid, p_target_group_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.recipes where id = p_recipe_id and visibility = 'public' and status = 'active' and deleted_at is null) then
    raise exception 'Recipe not found';
  end if;
  return public._fork_recipe_core(p_recipe_id, p_target_group_id);
end;
$$;

-- Copia un plan público a una semana de mi grupo: guarda en mi recetario cada receta y arma el borrador.
create or replace function public.copy_public_plan(p_slug text, p_group_id uuid, p_week_start date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src uuid;
  v_week date;
  v_plan uuid;
  v_map jsonb := '{}'::jsonb;
  v_e record;
  v_new uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Forbidden'; end if;
  select s.plan_id, p.week_start into v_src, v_week from public.plan_shares s join public.meal_plans p on p.id = s.plan_id where s.slug = p_slug;
  if v_src is null then raise exception 'Plan not found'; end if;

  insert into public.meal_plans (group_id, week_start, status, created_by) values (p_group_id, p_week_start, 'draft', auth.uid())
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

revoke all on function public.set_recipe_visibility(uuid, boolean) from public, anon;
revoke all on function public.set_collection_visibility(uuid, boolean) from public, anon;
revoke all on function public.publish_plan(uuid, text, text) from public, anon;
revoke all on function public.unpublish_plan(uuid) from public, anon;
revoke all on function public.fork_published_recipe(uuid, uuid) from public, anon;
revoke all on function public.copy_public_plan(text, uuid, date) from public, anon;
grant execute on function public.set_recipe_visibility(uuid, boolean) to authenticated;
grant execute on function public.set_collection_visibility(uuid, boolean) to authenticated;
grant execute on function public.publish_plan(uuid, text, text) to authenticated;
grant execute on function public.unpublish_plan(uuid) to authenticated;
grant execute on function public.fork_published_recipe(uuid, uuid) to authenticated;
grant execute on function public.copy_public_plan(text, uuid, date) to authenticated;
grant execute on function public.search_public_recipes(text, integer, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_published_recipe(text) to anon, authenticated;
grant execute on function public.get_public_collection(text) to anon, authenticated;
grant execute on function public.get_public_plan(text) to anon, authenticated;
grant execute on function public.list_public_slugs() to anon, authenticated;
