-- Etapa 1 · T1.1 — Identidad y grupos: profiles, groups, group_members, group_invites.
-- Funciones de ayuda (security definer), trigger de alta de usuario, RLS y RPCs.

-- ---------------------------------------------------------------------------
-- Función genérica de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas (§5.2)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text not null default 'es-AR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  image_url text,
  is_personal boolean not null default false,
  meal_slots text[] not null default '{breakfast,lunch,merienda,dinner,snack}',
  week_starts_on smallint not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cierra la referencia circular profiles <-> groups.
alter table public.profiles
  add column personal_group_id uuid references public.groups (id) on delete set null;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger group_invites_updated_at before update on public.group_invites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones de ayuda (security definer, stable)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.group_role(gid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.group_members
  where group_id = gid and user_id = auth.uid();
$$;

-- Complementa is_group_member para la policy de profiles: ¿el usuario actual
-- comparte algún grupo con p_user_id? (security definer evita recursión de RLS).
create or replace function public.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- profiles: ver el propio o el de quien comparte grupo; editar solo el propio.
create policy "profiles_select_self_or_shared" on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id));
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- groups
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id));
create policy "groups_insert_creator" on public.groups
  for insert with check (created_by = auth.uid());
create policy "groups_update_owner_admin" on public.groups
  for update using (public.group_role(id) in ('owner', 'admin'));

-- group_members: insert solo vía RPC (no hay policy de insert).
create policy "group_members_select_member" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "group_members_delete_self_or_admin" on public.group_members
  for delete using (user_id = auth.uid() or public.group_role(group_id) in ('owner', 'admin'));

-- group_invites
create policy "group_invites_select_owner_admin" on public.group_invites
  for select using (public.group_role(group_id) in ('owner', 'admin'));
create policy "group_invites_insert_owner_admin" on public.group_invites
  for insert with check (public.group_role(group_id) in ('owner', 'admin'));
create policy "group_invites_update_owner_admin" on public.group_invites
  for update using (public.group_role(group_id) in ('owner', 'admin'))
  with check (public.group_role(group_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- RPCs (security definer)
-- ---------------------------------------------------------------------------

-- Crea el grupo y su owner en una transacción.
create or replace function public.create_group(p_name text, p_emoji text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Name is required';
  end if;

  insert into public.groups (name, emoji, created_by)
  values (p_name, p_emoji, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'owner');

  return v_group_id;
end;
$$;

-- Valida la invitación y une al usuario (idempotente si ya es miembro).
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.group_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.group_invites
  where token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'Invalid invite';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Invite revoked';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'Invite has no remaining uses';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = v_invite.group_id and user_id = v_uid
  ) then
    return v_invite.group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_uid, 'member');

  update public.group_invites
  set uses = uses + 1
  where id = v_invite.id;

  return v_invite.group_id;
end;
$$;

-- Vista previa de la invitación para la pantalla "Te invitaron a…". Accesible a anon.
create or replace function public.get_invite_preview(p_token text)
returns table (
  group_id uuid,
  group_name text,
  group_emoji text,
  inviter_name text,
  member_count bigint,
  is_valid boolean,
  is_expired boolean,
  is_revoked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.emoji,
    p.display_name,
    (select count(*) from public.group_members gm where gm.group_id = g.id),
    (gi.revoked_at is null and (gi.expires_at is null or gi.expires_at >= now())),
    (gi.expires_at is not null and gi.expires_at < now()),
    (gi.revoked_at is not null)
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  left join public.profiles p on p.id = gi.created_by
  where gi.token = p_token;
$$;

-- Sale del grupo; si era el último owner, promueve al admin más antiguo o al miembro
-- más antiguo; si queda vacío, archiva el grupo. No se puede salir del grupo personal.
create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_role text;
  v_owner_count integer;
  v_promo uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_group from public.groups where id = gid;
  if v_group.id is null then
    raise exception 'Group not found';
  end if;
  if v_group.is_personal then
    raise exception 'Cannot leave personal group';
  end if;

  select role into v_role from public.group_members
  where group_id = gid and user_id = v_uid;
  if v_role is null then
    raise exception 'Not a member';
  end if;

  delete from public.group_members where group_id = gid and user_id = v_uid;

  if not exists (select 1 from public.group_members where group_id = gid) then
    update public.groups set archived_at = now() where id = gid;
  else
    select count(*) into v_owner_count from public.group_members
    where group_id = gid and role = 'owner';
    if v_owner_count = 0 then
      select user_id into v_promo
      from public.group_members
      where group_id = gid
      order by case when role = 'admin' then 0 else 1 end, joined_at asc
      limit 1;
      update public.group_members set role = 'owner'
      where group_id = gid and user_id = v_promo;
    end if;
  end if;
end;
$$;

-- Expulsa a un miembro: solo owner/admin; un admin no puede sacar a un owner.
create or replace function public.remove_member(gid uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_target_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_my_role from public.group_members
  where group_id = gid and user_id = v_uid;
  if v_my_role not in ('owner', 'admin') then
    raise exception 'Forbidden';
  end if;

  select role into v_target_role from public.group_members
  where group_id = gid and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Target is not a member';
  end if;
  if v_my_role = 'admin' and v_target_role = 'owner' then
    raise exception 'Cannot remove an owner';
  end if;

  delete from public.group_members where group_id = gid and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta de usuario: crea profile, grupo personal "Mis recetas" y membresía owner.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.groups (name, emoji, is_personal, created_by)
  values ('Mis recetas', null, true, new.id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, new.id, 'owner');

  update public.profiles set personal_group_id = v_group_id where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Solo get_invite_preview queda accesible a anon; el resto requiere sesión.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_group(text, text) from anon;
revoke execute on function public.accept_invite(text) from anon;
revoke execute on function public.leave_group(uuid) from anon;
revoke execute on function public.remove_member(uuid, uuid) from anon;
