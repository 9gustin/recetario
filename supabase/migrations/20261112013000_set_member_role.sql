-- Etapa 1 · T1.5 — Cambiar rol de un miembro (solo owner).

create or replace function public.set_member_role(gid uuid, p_user_id uuid, p_role text)
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
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'Invalid role';
  end if;

  select role into v_my_role from public.group_members
  where group_id = gid and user_id = v_uid;
  if v_my_role is distinct from 'owner' then
    raise exception 'Forbidden';
  end if;

  if p_user_id = v_uid then
    raise exception 'Cannot change own role';
  end if;

  select role into v_target_role from public.group_members
  where group_id = gid and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Target is not a member';
  end if;

  update public.group_members set role = p_role
  where group_id = gid and user_id = p_user_id;
end;
$$;

revoke execute on function public.set_member_role(uuid, uuid, text) from anon;
