-- T7.1 — Planes: RLS, momentos del grupo, approve_plan y duplicate_plan.

\set QUIET 1

begin;
select plan(13);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- Recetas: una activa, una borrador usada en el plan y otra borrador que la IA propuso y quedó fuera.
select (public.save_recipe(jsonb_build_object('group_id', :'a_pg_id', 'title', 'Activa', 'servings', 2,
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'pollo', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.')))) ->> 'id') as id \gset act_
select (public.save_recipe(jsonb_build_object('group_id', :'a_pg_id', 'title', 'Nueva usada', 'servings', 2, 'status', 'draft',
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'arroz', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.')))) ->> 'id') as id \gset used_
select (public.save_recipe(jsonb_build_object('group_id', :'a_pg_id', 'title', 'Nueva descartada', 'servings', 2, 'status', 'draft',
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'fideos', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.')))) ->> 'id') as id \gset drop_

insert into public.meal_plans (group_id, week_start) values (:'a_pg_id', '2026-11-16') returning id as id \gset plan_
update public.recipes set draft_for_plan_id = :'plan_id' where id in (:'used_id', :'drop_id');

insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, servings, position)
values (:'plan_id', '2026-11-16', 'lunch', :'act_id', 2, 0) returning id as id \gset e1_
insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, is_new_recipe, position)
values (:'plan_id', '2026-11-17', 'dinner', :'used_id', true, 0);
insert into public.meal_plan_entries (plan_id, date, slot, free_text, leftovers_of_entry_id, cook_date, position)
values (:'plan_id', '2026-11-18', 'lunch', 'Sobras del lunes', :'e1_id', '2026-11-16', 0);

select is((select count(*) from public.meal_plan_entries where plan_id = :'plan_id'), 3::bigint, 'A arma un plan con entradas');

-- Reglas de datos.
select throws_ok(
  format($f$insert into public.meal_plan_entries (plan_id, date, slot, free_text) values (%L, '2026-11-16', 'brunch', 'x')$f$, :'plan_id'),
  '23514', null, 'no se admite un momento inexistente'
);
select throws_ok(
  format($f$insert into public.meal_plan_entries (plan_id, date, slot) values (%L, '2026-11-16', 'dinner')$f$, :'plan_id'),
  '23514', null, 'una entrada necesita receta o texto libre'
);
select throws_ok(
  format($f$insert into public.meal_plans (group_id, week_start) values (%L, '2026-11-16')$f$, :'a_pg_id'),
  '23505', null, 'no puede haber dos planes vigentes para la misma semana'
);

-- Un grupo puede ocultar momentos: la entrada de un momento deshabilitado se rechaza.
reset role;
update public.groups set meal_slots = '{lunch,dinner}' where id = :'a_pg_id';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok(
  format($f$insert into public.meal_plan_entries (plan_id, date, slot, free_text) values (%L, '2026-11-16', 'snack', 'x')$f$, :'plan_id'),
  '23514', null, 'respeta los momentos que el grupo habilitó'
);

-- approve_plan: promueve las recetas usadas y borra las propuestas que quedaron fuera.
select public.approve_plan(:'plan_id');
select is((select status from public.meal_plans where id = :'plan_id'), 'approved', 'el plan queda aprobado');
select ok((select approved_by is not null and approved_at is not null from public.meal_plans where id = :'plan_id'), 'registra quién y cuándo aprobó');
select is((select status from public.recipes where id = :'used_id'), 'active', 'la receta nueva usada pasa a activa');
select ok(not exists (select 1 from public.recipes where id = :'drop_id'), 'la receta propuesta que quedó fuera se borra');

-- duplicate_plan: fechas corridas y sobras reenlazadas.
select public.duplicate_plan(:'plan_id', '2026-11-23') as id \gset dup_
select is(
  (select array_agg(date order by date) from public.meal_plan_entries where plan_id = :'dup_id'),
  array['2026-11-23', '2026-11-24', '2026-11-25']::date[], 'duplicar corre las fechas una semana'
);
select is(
  (select e.recipe_id from public.meal_plan_entries l
     join public.meal_plan_entries e on e.id = l.leftovers_of_entry_id
   where l.plan_id = :'dup_id' and l.free_text = 'Sobras del lunes'),
  :'act_id'::uuid, 'la sobra apunta a la entrada nueva equivalente (no a la vieja)'
);

-- B (otro grupo) no ve nada del plan.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.meal_plans) + (select count(*) from public.meal_plan_entries), 0::bigint, 'B no ve los planes de otro grupo');
select throws_ok(format($f$select public.approve_plan(%L)$f$, :'plan_id'), 'P0001', 'Forbidden', 'B no puede aprobar el plan de otro grupo');

select * from finish();
rollback;
