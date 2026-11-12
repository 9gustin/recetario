-- T12.1 — Lo público: solo se lee lo publicado, por RPC; publicar exige ser miembro.

\set QUIET 1

begin;
select plan(12);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_
select personal_group_id as id from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' \gset b_pg_

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select (public.save_recipe(jsonb_build_object('group_id', :'a_pg_id', 'title', 'Tarta Zq9xk única', 'servings', 4, 'total_minutes', 30,
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', '3 zapallitos', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Horneá.')))) ->> 'id') as id \gset pub_
select (public.save_recipe(jsonb_build_object('group_id', :'a_pg_id', 'title', 'Receta privada', 'servings', 2,
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'papa', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Hervir.')))) ->> 'id') as id \gset priv_

select ok(public.set_recipe_visibility(:'pub_id', true) ~ '^tarta-zq9xk-unica-', 'publicar devuelve un slug legible');

-- Colección y plan.
insert into public.recipe_collections (group_id, title) values (:'a_pg_id', 'Rápidas') returning id as id \gset col_
insert into public.recipe_collection_items (collection_id, recipe_id) values (:'col_id', :'priv_id');
select isnt(public.set_collection_visibility(:'col_id', true), null, 'publicar una colección devuelve slug');
select is((select visibility from public.recipes where id = :'priv_id'), 'public', 'publicar la colección publica sus recetas');

insert into public.meal_plans (group_id, week_start) values (:'a_pg_id', '2026-11-16') returning id as id \gset plan_
insert into public.meal_plan_entries (plan_id, date, slot, recipe_id, diner_ids) values (:'plan_id', '2026-11-18', 'dinner', :'pub_id', array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']::uuid[]);
select public.publish_plan(:'plan_id', 'Semana rápida', 'Cenas fáciles') as slug \gset plan_

-- Anónimo: lee por RPC, no por tabla.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.search_public_recipes('zq9xk')), 1, 'anon busca recetas públicas');
select is((public.get_published_recipe((select slug from public.search_public_recipes('zq9xk') limit 1)) ->> 'title'), 'Tarta Zq9xk única', 'anon abre la ficha con ingredientes y pasos');
select is(jsonb_array_length(public.get_public_plan(:'plan_slug') -> 'entries'), 1, 'anon ve el plan compartido');
select is((public.get_public_plan(:'plan_slug') -> 'entries' -> 0 ? 'diner_ids'), false, 'el plan público no expone comensales');
select is((select count(*)::int from public.recipes), 0, 'anon no lee la tabla de recetas (solo las RPC)');

-- Otra persona: no publica lo ajeno, pero guarda y copia lo público.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok(format('select public.set_recipe_visibility(%L, false)', :'pub_id'), 'Forbidden', 'B no despublica recetas de A');
select isnt(public.fork_published_recipe(:'pub_id', :'b_pg_id'), null, 'B guarda una receta pública en su grupo');
select isnt(public.copy_public_plan(:'plan_slug', :'b_pg_id', '2026-12-07'), null, 'B copia el plan público a su grupo');
select is((select count(*)::int from public.meal_plan_entries e join public.meal_plans p on p.id = e.plan_id where p.group_id = :'b_pg_id' and e.recipe_id is not null), 1, 'el plan copiado trae la receta guardada');

select * from finish();
rollback;
