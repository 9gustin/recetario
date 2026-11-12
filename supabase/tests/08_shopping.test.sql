-- T8.1 — Listas de compras: RLS por grupo y set_item_state.

\set QUIET 1

begin;
select plan(7);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into public.shopping_lists (group_id, name) values (:'a_pg_id', 'Compra del lunes') returning id as id \gset list_
insert into public.shopping_list_items (list_id, display_name, quantity, unit, aisle)
  values (:'list_id', 'Pechuga de pollo', 800, 'g', 'carniceria') returning id as id \gset item_

select is((select count(*)::int from public.shopping_list_items), 1, 'A ve los ítems de su grupo');

select is((public.set_item_state(:'item_id', 'bought')).state, 'bought', 'set_item_state marca comprado');
select is((select state_by from public.shopping_list_items where id = :'item_id'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'guarda quién lo tachó');
select isnt((select state_at from public.shopping_list_items where id = :'item_id'), null, 'guarda cuándo');
select is((public.set_item_state(:'item_id', 'pending')).state_by, null, 'volver a pendiente limpia state_by');

select throws_ok(format('select public.set_item_state(%L, %L)', :'item_id', 'otro'), 'Invalid state', 'rechaza estados inválidos');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.shopping_list_items), 0, 'B (de otro grupo) no ve nada');

select * from finish();
rollback;
