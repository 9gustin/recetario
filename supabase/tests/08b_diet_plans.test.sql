-- T8B.1 — Plan vivo: privacidad, un solo plan activo, versiones, reglas del grupo y registro diario.

\set QUIET 1

begin;
select plan(11);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset g_
insert into public.group_members (group_id, user_id, role) values (:'g_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select (public.save_diet_plan('{"title":"Plan nutri","rules":[{"text":"Sin harinas de noche"}],"allowances":{"per_week":3},
  "meals":[{"slot":"dinner","formula":"Proteína + verduras, sin harinas","components":[{"group":"proteina"}]},
           {"slot":"breakfast","formula":"Lácteo + fruta","components":[]}]}'::jsonb, 'Inicial') ->> 'id') as id \gset plan_

select is((select version from public.diet_plans where id = :'plan_id'), 1, 'versión inicial 1');
select is((select count(*)::int from public.diet_plan_meals where plan_id = :'plan_id'), 2, 'guarda las comidas');
select is((public.save_diet_plan(jsonb_build_object('id', :'plan_id', 'meals', '[{"slot":"dinner","formula":"Solo verduras"}]'::jsonb), 'Ajuste') ->> 'version')::int, 2, 'sube la versión');
select is((select count(*)::int from public.diet_plan_versions where plan_id = :'plan_id'), 2, 'guarda un snapshot por versión');
select is((select count(*)::int from public.diet_plan_meals where plan_id = :'plan_id'), 1, 'reemplaza las comidas');

select public.activate_diet_plan(:'plan_id');
select (public.save_diet_plan('{"title":"Otro","meals":[]}'::jsonb) ->> 'id') as id \gset plan2_
select throws_ok(format('update public.diet_plans set status = %L where id = %L', 'active', :'plan2_id'), '23505', null, 'un solo plan activo por persona');
select public.activate_diet_plan(:'plan2_id');
select is((select status from public.diet_plans where id = :'plan_id'), 'archived', 'activar archiva el anterior');

select public.log_meal('2026-11-16', 'dinner', 'followed', null);
select is((public.log_meal('2026-11-16', 'dinner', 'changed', 'tarta')).status, 'changed', 'log_meal hace upsert por fecha y momento');

-- B (mismo grupo) no ve el plan ni los registros de A.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.diet_plans) + (select count(*)::int from public.meal_logs) + (select count(*)::int from public.diet_plan_meals), 0, 'B no lee planes ni registros de A');

-- Reglas del grupo: solo con un plan activo con comidas.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select public.save_diet_plan(jsonb_build_object('id', :'plan2_id', 'meals', '[{"slot":"dinner","formula":"Sin harinas","components":[{"group":"proteina"}]}]'::jsonb));
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select formula from public.get_group_meal_rules(:'g_id') limit 1), 'Sin harinas', 'B obtiene la fórmula de A vía RPC');
select throws_ok(format('select * from public.get_group_meal_rules(%L)', gen_random_uuid()), 'Forbidden', 'no se piden reglas de grupos ajenos');

select * from finish();
rollback;
