-- T8.1 — Listas de compras: tablas, RLS por grupo, realtime y RPC de estado de ítems.

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  plan_id uuid references public.meal_plans (id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  shop_date date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_lists_group_idx on public.shopping_lists (group_id, status);
create index shopping_lists_plan_idx on public.shopping_lists (plan_id);
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  display_name text not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text,
  purchase_hint text,
  aisle text not null default 'otros',
  state text not null default 'pending' check (state in ('pending', 'bought', 'have_it')),
  state_by uuid references public.profiles (id) on delete set null,
  state_at timestamptz,
  note text,
  is_manual boolean not null default false,
  pantry_staple boolean not null default false,
  no_longer_needed boolean not null default false,
  needed_by date,
  shelf_life_warning text,
  source_entry_ids uuid[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id, aisle, position);
alter table public.shopping_list_items replica identity full;

create or replace function public.list_group_id(p_list_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.shopping_lists where id = p_list_id
$$;

alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "shopping_lists_member_all" on public.shopping_lists
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "shopping_list_items_member_all" on public.shopping_list_items
  for all using (public.is_group_member(public.list_group_id(list_id)))
  with check (public.is_group_member(public.list_group_id(list_id)));

-- Marca un ítem como comprado / ya lo tengo / pendiente, guardando quién y cuándo.
create or replace function public.set_item_state(p_item_id uuid, p_state text)
returns public.shopping_list_items
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_item public.shopping_list_items;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_state not in ('pending', 'bought', 'have_it') then raise exception 'Invalid state'; end if;
  select l.group_id into v_group
  from public.shopping_list_items i join public.shopping_lists l on l.id = i.list_id
  where i.id = p_item_id;
  if v_group is null or not public.is_group_member(v_group) then raise exception 'Forbidden'; end if;

  update public.shopping_list_items
  set state = p_state,
      state_by = case when p_state = 'pending' then null else auth.uid() end,
      state_at = case when p_state = 'pending' then null else now() end
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;
revoke all on function public.set_item_state(uuid, text) from public;
grant execute on function public.set_item_state(uuid, text) to authenticated;

alter publication supabase_realtime add table public.shopping_lists, public.shopping_list_items;
