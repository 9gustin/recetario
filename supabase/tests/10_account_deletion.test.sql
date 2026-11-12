-- T10.6 — Borrar cuenta: no queda nada personal y los grupos compartidos siguen con otro dueño.

\set QUIET 1

begin;
select plan(8);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

-- A es dueña de un grupo compartido con B, y de otro donde está sola.
insert into public.groups (id, name, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Compartido', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'Solo A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.group_members (group_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner');
insert into public.recipes (group_id, title, created_by, status) values
  ('11111111-1111-1111-1111-111111111111', 'Receta compartida', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active');
insert into public.food_profiles (user_id, data) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}');
insert into public.diet_plans (user_id, title) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Plan');
insert into public.meal_logs (user_id, date, slot, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-16', 'dinner', 'followed');

select public.prepare_account_deletion('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select is((select role from public.group_members where group_id = '11111111-1111-1111-1111-111111111111' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 'owner', 'B hereda el grupo compartido');
select is((select count(*)::int from public.group_members where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'A ya no es miembro de nada');
select is((select count(*)::int from public.groups where id = '22222222-2222-2222-2222-222222222222'), 0, 'el grupo donde estaba sola se borra');
select is((select count(*)::int from public.recipes where title = 'Receta compartida'), 1, 'las recetas de grupos compartidos quedan');
select is((select count(*)::int from public.food_profiles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'se borra el perfil alimentario');
select is((select count(*)::int from public.diet_plans where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') + (select count(*)::int from public.meal_logs where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'se borran planes y registros');
select is((select personal_group_id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), null, 'se suelta el grupo personal');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$select public.prepare_account_deletion('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$, '42501', null, 'un usuario no puede llamar a la función');

select * from finish();
rollback;
