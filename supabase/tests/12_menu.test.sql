-- T13.2 — El menú ("Mis comidas"): uno por grupo, solo para miembros, comidas sin fecha.

\set QUIET 1

begin;
select plan(5);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select public.get_or_create_menu(:'a_pg_id') as id \gset menu_
select is(public.get_or_create_menu(:'a_pg_id'), :'menu_id'::uuid, 'el menú es único por grupo');

select lives_ok(
  format($f$insert into public.meal_plan_entries (plan_id, free_text, quantity) values (%L, 'Tarta de pollo', 3)$f$, :'menu_id'),
  'se agrega una comida sin fecha ni momento');
select is((select count(*)::int from public.meal_plan_entries where plan_id = :'menu_id'::uuid and date is null and slot is null), 1, 'queda sin fecha');
select throws_ok(
  format($f$insert into public.meal_plan_entries (plan_id, free_text, quantity) values (%L, 'x', 0)$f$, :'menu_id'),
  '23514', null, 'la cantidad tiene que ser al menos 1');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok(format($f$select public.get_or_create_menu(%L)$f$, :'a_pg_id'), 'P0001', 'Forbidden', 'un no miembro no accede al menú');

select * from finish();
rollback;
