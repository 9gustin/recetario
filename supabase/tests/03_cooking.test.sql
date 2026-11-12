-- T3.1 — RLS de sesiones de cocina y recipe_last_cooked.

\set QUIET 1

begin;
select plan(8);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
  perform tests.create_user('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@test.com', 'C');
end $$;

select personal_group_id as id from public.profiles
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_

-- B también es miembro del grupo de A (como si lo hubieran invitado).
insert into public.group_members (group_id, user_id, role)
values (:'a_pg_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select (public.save_recipe(jsonb_build_object(
  'group_id', :'a_pg_id', 'title', 'Pollo', 'servings', 2,
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'pollo', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.'))
)) ->> 'id') as id \gset rec_

-- 1) A crea y termina una sesión propia.
insert into public.cooking_sessions (recipe_id, recipe_version, servings, current_step)
values (:'rec_id', 1, 2, 3) returning id as id \gset ses_

select ok(
  (select user_id from public.cooking_sessions where id = :'ses_id') = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'la sesión queda a nombre de quien la crea'
);

update public.cooking_sessions set finished_at = now(), rating = 4, note = 'menos sal' where id = :'ses_id';
select is((select rating from public.cooking_sessions where id = :'ses_id'), 4::smallint, 'A actualiza su sesión');

-- 2) A no puede crear una sesión a nombre de otra persona.
select throws_ok(
  format('insert into public.cooking_sessions (recipe_id, recipe_version, servings, user_id) values (%L, 1, 2, %L)',
         :'rec_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '42501', null, 'no se puede crear una sesión a nombre de otro'
);

-- 3) B (miembro del grupo) no ve la tabla de A, pero sí el resumen.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select ok(not exists (select 1 from public.cooking_sessions), 'B no ve las sesiones de A (ni sus notas)');
select is((select rating from public.recipe_last_cooked(:'rec_id')), 4::smallint, 'B ve el puntaje de la última vez');
select is((select cooked_by from public.recipe_last_cooked(:'rec_id')), 'A', 'B ve quién cocinó');

-- 4) B puede cocinarla (es miembro) y no puede tocar la sesión de A.
select lives_ok(
  format('insert into public.cooking_sessions (recipe_id, recipe_version, servings) values (%L, 1, 2)', :'rec_id'),
  'B crea su propia sesión'
);

-- 5) C (otro grupo) no ve nada ni puede cocinar la receta.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
select is((select count(*) from public.recipe_last_cooked(:'rec_id')), 0::bigint, 'C no ve el resumen de una receta ajena');

select * from finish();
rollback;
