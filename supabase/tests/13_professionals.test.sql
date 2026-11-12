-- T14 — Profesionales: códigos, vínculo, envíos y seguimiento solo con permiso.

\set QUIET 1

begin;
select plan(13);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pro@test.com', 'Pro');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pac@test.com', 'Paciente');
  perform tests.create_user('cccccccc-cccc-cccc-cccc-cccccccccccc', 'otro@test.com', 'Otro');
end $$;

insert into public.professional_invites (code, max_uses) values ('CODIGO-OK', 1);
insert into public.professional_invites (code, max_uses, expires_at) values ('CODIGO-VIEJO', 1, now() - interval '1 day');

select personal_group_id as id from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' \gset b_pg_

-- Una receta pública para armar el plan.
insert into public.recipes (id, group_id, title, servings, status, visibility, slug)
values ('99999999-9999-4999-8999-999999999999', (select personal_group_id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
        'Ensalada pública', 2, 'active', 'public', 'ensalada-publica-test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select throws_ok($$select public.redeem_professional_code('CODIGO-VIEJO', 'Dra. Pro', null, null)$$, 'P0002', null, 'un código vencido se rechaza');
select throws_ok($$select public.pro_create_link('Paciente X')$$, 'P0001', 'Forbidden', 'sin código no hay herramientas profesionales');
select lives_ok($$select public.redeem_professional_code('codigo-ok', 'Dra. Pro', 'MP 123', null)$$, 'un código válido habilita al profesional');
select is(public.is_professional(), true, 'queda marcado como profesional');

insert into public.pro_plans (id, title, goal) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Plan base', 'Más verduras');
select throws_ok($$insert into public.pro_plan_items (plan_id, free_text, recipe_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'x', '00000000-0000-4000-8000-000000000123')$$, null, null, 'no se pueden usar recetas inexistentes o privadas');
insert into public.pro_plan_items (plan_id, recipe_id, quantity) values ('aaaaaaaa-0000-4000-8000-000000000001', '99999999-9999-4999-8999-999999999999', 2);

select public.pro_create_link('Paciente B') as token \gset link_

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select public.accept_pro_link(:'link_token', false, false) as id \gset l_

select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
select throws_ok(format($f$select public.accept_pro_link(%L, true, true)$f$, :'link_token'), '23505', null, 'otra persona no puede usar un link ya aceptado');

-- Sin permiso del paciente el profesional no ve el seguimiento.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok(format($f$select public.pro_patient_log(%L, current_date - 7, current_date)$f$, :'l_id'), 'P0001', 'Forbidden', 'sin permiso no hay seguimiento');

select lives_ok(format($f$select public.pro_send_plan(%L, 'aaaaaaaa-0000-4000-8000-000000000001', 'Probalo')$f$, :'l_id'), 'el profesional envía un plan');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select id as d_id from public.pro_deliveries limit 1 \gset
select is(public.accept_pro_delivery(:'d_id', :'b_pg_id', true), 1, 'el paciente acepta: se guardan las recetas');
select is((select count(*)::int from public.meal_plan_entries e join public.meal_plans p on p.id = e.plan_id
           where p.group_id = :'b_pg_id' and p.week_start = date '2000-01-01' and e.quantity = 2), 1, 'se suma a Mis comidas sin pisar nada');

-- El paciente comparte; el profesional ve y queda registrado.
select public.update_pro_link_sharing(:'l_id', true, false);
select public.log_meal(current_date, 'lunch', 'followed', null, null);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(jsonb_array_length(public.pro_patient_log(:'l_id', current_date - 7, current_date) -> 'logs'), 1, 'con permiso el profesional ve el seguimiento');

-- Revocar corta el acceso.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select public.end_pro_link(:'l_id');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok(format($f$select public.pro_patient_log(%L, current_date - 7, current_date)$f$, :'l_id'), 'P0001', 'Forbidden', 'revocado: no ve nada');
select is((select count(*)::int from public.meal_logs), 0, 'el profesional no lee las tablas del paciente directamente');

select * from finish();
rollback;
