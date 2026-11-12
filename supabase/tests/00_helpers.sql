-- Helpers compartidos de los tests pgTAP (corre antes que los *.test.sql).
-- Sin BEGIN/ROLLBACK: las funciones quedan creadas para los tests siguientes.

\set QUIET 1

create schema if not exists tests;

-- Crea un usuario en auth.users con un id fijo; el trigger on_auth_user_created
-- genera su profile, grupo personal "Mis recetas" y membresía owner.
create or replace function tests.create_user(p_id uuid, p_email text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auth.users (
    id, email, aud, role, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) values (
    p_id,
    p_email,
    'authenticated',
    'authenticated',
    'test-password',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('display_name', coalesce(nullif(p_name, ''), split_part(p_email, '@', 1))),
    false,
    false
  );
  return p_id;
end;
$$;

-- Un test trivial para que pg_prove vea un plan válido en este archivo.
select plan(1);
select ok(true, 'helpers de tests cargados');
select * from finish();
