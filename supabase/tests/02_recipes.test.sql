-- T2.1 — Tests de RLS y versiones de recetas.

\set QUIET 1

begin;
select plan(6);

-- ── Fixtures ───────────────────────────────────────────────────────────────
do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_

-- Simular sesión como A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- 1) A crea una receta.
select (public.save_recipe(jsonb_build_object(
  'group_id', :'a_pg_id',
  'title', 'Pollo al limón',
  'servings', 2,
  'difficulty', 'facil',
  'tags', jsonb_build_array('rapida'),
  'ingredients', jsonb_build_array(
    jsonb_build_object('raw_text', '2 pechugas de pollo', 'quantity', 2, 'unit', 'unidad', 'position', 0),
    jsonb_build_object('raw_text', '1 limón', 'quantity', 1, 'unit', 'unidad', 'position', 1)
  ),
  'steps', jsonb_build_array(
    jsonb_build_object('position', 0, 'instruction', 'Cortar el pollo en cubos.', 'duration_seconds', 300, 'timer_kind', 'active')
  )
)) ->> 'id') as id \gset rec_

select ok(
  exists (select 1 from public.recipes where id = :'rec_id'::uuid),
  'save_recipe crea la receta'
);
select ok(
  (select count(*) from public.recipe_versions where recipe_id = :'rec_id'::uuid) = 1,
  'deja 1 versión'
);

-- 2) A actualiza la receta.
select public.save_recipe(jsonb_build_object(
  'id', :'rec_id',
  'group_id', :'a_pg_id',
  'title', 'Pollo al limón con romero',
  'servings', 4,
  'difficulty', 'facil',
  'tags', jsonb_build_array('rapida'),
  'ingredients', jsonb_build_array(
    jsonb_build_object('raw_text', '4 pechugas de pollo', 'quantity', 4, 'unit', 'unidad', 'position', 0)
  ),
  'steps', jsonb_build_array(
    jsonb_build_object('position', 0, 'instruction', 'Cortar el pollo.', 'duration_seconds', 600, 'timer_kind', 'active')
  )
));

select ok(
  (select count(*) from public.recipe_versions where recipe_id = :'rec_id'::uuid) = 2,
  'guardar dos veces deja 2 versiones'
);
select is(
  (select max(version) from public.recipe_versions where recipe_id = :'rec_id'::uuid),
  2,
  'la versión actual es la 2'
);

-- ── RLS cruzado entre grupos ───────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select ok(
  not exists (select 1 from public.recipes where id = :'rec_id'::uuid),
  'B no ve la receta de A'
);
select throws_ok(
  format('insert into public.recipe_ingredients (recipe_id, raw_text, position) values (%L, %L, 0)', :'rec_id', 'cebolla'),
  '42501', null,
  'B no puede insertar ingredientes de una receta ajena'
);

select * from finish();
rollback;
