-- T10.6 — Borrar cuenta: transfiere la propiedad de los grupos y borra lo personal, de forma transaccional.
-- Solo la puede llamar el servidor (service role); el usuario de Auth se borra después desde la app.

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_heir uuid;
  v_personal uuid;
begin
  select personal_group_id into v_personal from public.profiles where id = p_user_id;

  for v_group in
    select gm.group_id, gm.role from public.group_members gm
    where gm.user_id = p_user_id and gm.group_id is distinct from v_personal
  loop
    if v_group.role = 'owner' then
      -- Hereda quien tiene más jerarquía y más antigüedad; si no queda nadie, se borra el grupo.
      select user_id into v_heir from public.group_members
      where group_id = v_group.group_id and user_id <> p_user_id
      order by case role when 'admin' then 0 else 1 end, joined_at
      limit 1;
      if v_heir is null then
        delete from public.groups where id = v_group.group_id;
        continue;
      end if;
      update public.group_members set role = 'owner' where group_id = v_group.group_id and user_id = v_heir;
    end if;
    delete from public.group_members where group_id = v_group.group_id and user_id = p_user_id;
  end loop;

  -- Lo personal: perfil alimentario, fuentes, planes de alimentación, registros, avisos y bandeja.
  delete from public.food_profile_drafts where user_id = p_user_id;
  delete from public.food_profile_inputs where user_id = p_user_id;
  delete from public.food_profiles where user_id = p_user_id;
  delete from public.diet_plans where user_id = p_user_id;
  delete from public.meal_logs where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.notification_prefs where user_id = p_user_id;
  delete from public.scheduled_pushes where user_id = p_user_id;
  delete from public.inbox_items where user_id = p_user_id;
  delete from public.ai_conversations where user_id = p_user_id;

  -- El grupo personal ("Mis recetas") se va con sus recetas.
  if v_personal is not null then
    update public.profiles set personal_group_id = null where id = p_user_id;
    delete from public.groups where id = v_personal;
  end if;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
