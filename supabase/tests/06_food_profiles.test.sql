-- T6.1 — Privacidad del perfil alimentario.

\set QUIET 1

begin;
select plan(10);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'Ana');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'Beto');
  perform tests.create_user('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@test.com', 'Cami');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_
insert into public.group_members (group_id, user_id, role)
values (:'a_pg_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into public.food_profiles (user_id, summary, data)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Resumen con info médica',
        '{"restrictions":[{"target":"cebolla","type":"ingredient","severity":"forbidden","reason":"tratamiento"}],"goals":[{"kind":"low_carb"}],"likes":["pollo"]}');
insert into public.food_profile_inputs (user_id, kind, transcript) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'text', 'no puedo comer cebolla');
insert into public.food_profile_drafts (user_id, proposed) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}');

select is((select count(*) from public.food_profiles), 1::bigint, 'A lee su propio perfil');
select is((select count(*) from public.get_group_diet(:'a_pg_id')), 1::bigint, 'A ve su propia fila en get_group_diet');

-- No puede crear un perfil a nombre de otra persona.
select throws_ok(
  $$insert into public.food_profiles (user_id, data) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{}')$$,
  '42501', null, 'no se puede crear el perfil de otra persona'
);

-- B (mismo grupo): ve restricciones y objetivos por la RPC, pero nada más.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select restrictions -> 0 ->> 'target' from public.get_group_diet(:'a_pg_id') where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'cebolla', 'B obtiene las restricciones de A vía la RPC'
);
select is(
  (select goals -> 0 ->> 'kind' from public.get_group_diet(:'a_pg_id') where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'low_carb', 'B obtiene los objetivos de A'
);
select is((select count(*) from public.food_profiles), 0::bigint, 'B no puede leer food_profiles de A');
select is((select count(*) from public.food_profile_inputs), 0::bigint, 'B no puede leer las fuentes de A');
select is((select count(*) from public.food_profile_drafts), 0::bigint, 'B no puede leer los borradores de A');

-- La RPC no devuelve el resumen ni las fuentes (solo estas cuatro columnas).
select is(
  (select proargnames from pg_proc where proname = 'get_group_diet' and pronamespace = 'public'::regnamespace),
  array['p_group_id', 'user_id', 'display_name', 'restrictions', 'goals'],
  'la RPC devuelve solo user_id, display_name, restrictions y goals (nunca el resumen ni las fuentes)'
);

-- C (otro grupo) no obtiene nada.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
select is((select count(*) from public.get_group_diet(:'a_pg_id')), 0::bigint, 'C no obtiene nada de un grupo ajeno');

select * from finish();
rollback;
