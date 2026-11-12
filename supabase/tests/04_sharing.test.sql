-- T4.1 — Links públicos, copias (fork) y bandeja.

\set QUIET 1

begin;
select plan(20);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'Agus');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'Beto');
  perform tests.create_user('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@test.com', 'Cami');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_
select personal_group_id as id from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' \gset b_pg_
select personal_group_id as id from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' \gset c_pg_

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select (public.save_recipe(jsonb_build_object(
  'group_id', :'a_pg_id', 'title', 'Pollo al limón', 'servings', 2, 'tags', jsonb_build_array('rapida'),
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', '2 pechugas', 'quantity', 2, 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.', 'duration_seconds', 600))
)) ->> 'id') as id \gset rec_

-- ── Links públicos ────────────────────────────────────────────────────────
select public.create_share_link(:'rec_id') as token \gset link_
select ok(:'link_token' ~ '^[A-Za-z0-9_-]{24}$', 'el token es URL-safe y de 24 caracteres');
select is(public.create_share_link(:'rec_id'), :'link_token', 'reutiliza el link activo');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok(format('select public.create_share_link(%L)', :'rec_id'), 'P0001', 'Forbidden',
  'quien no es del grupo no puede crear el link');

-- anon lee por token válido, sin IDs internos.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.get_public_recipe(:'link_token') ->> 'title', 'Pollo al limón', 'anon lee la receta por token');
select ok(
  not (public.get_public_recipe(:'link_token') ?| array['group_id', 'recipe_id', 'created_by', 'id']),
  'la receta pública no expone IDs de grupo ni de usuario'
);
select is(public.get_public_recipe('token-que-no-existe'), null, 'un token inexistente devuelve null');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select cmp_ok(
  (select view_count from public.recipe_share_links where token = :'link_token'), '>=', 2,
  'cuenta las visitas'
);

-- ── Copiar a otro grupo mío ───────────────────────────────────────────────
select public.create_group('Familia', '🏠') as id \gset g2_
select public.fork_recipe(:'rec_id', :'g2_id') as id \gset fork_
select is(
  (select source_type || '|' || forked_from_title from public.recipes where id = :'fork_id'),
  'fork|Pollo al limón', 'la copia queda como fork con el título original'
);
select is(
  (select count(*) from public.recipe_ingredients where recipe_id = :'fork_id'), 1::bigint,
  'la copia trae los ingredientes'
);
select is(
  (select count(*) from public.recipe_versions where recipe_id = :'fork_id' and version = 1), 1::bigint,
  'la copia arranca en la versión 1'
);
select throws_ok(format('select public.fork_recipe(%L, %L)', :'rec_id', :'b_pg_id'), 'P0001', 'Forbidden',
  'no se puede copiar a un grupo ajeno');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok(format('select public.fork_recipe(%L, %L)', :'rec_id', :'b_pg_id'), 'P0001', 'Forbidden',
  'no se puede copiar una receta de un grupo al que no pertenezco');

-- ── Mandar a una persona ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok(format('select public.send_recipe_to_user(%L, %L)', :'rec_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'P0001', 'No shared group', 'no se puede enviar a alguien sin grupo en común');

reset role;
insert into public.group_members (group_id, user_id, role) values (:'g2_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select public.send_recipe_to_user(:'rec_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as id \gset item_
select is((select count(*) from public.inbox_items), 0::bigint, 'quien envía no ve la bandeja del otro');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select payload ->> 'title' from public.inbox_items where id = :'item_id'), 'Pollo al limón',
  'B recibe el ítem en su bandeja'
);
select public.accept_inbox_recipe(:'item_id', :'b_pg_id') as id \gset acc_
select is(
  (select group_id::text from public.recipes where id = :'acc_id'), :'b_pg_id',
  'B guarda la receta en su grupo'
);
select ok(
  (select resolved_at is not null from public.inbox_items where id = :'item_id'),
  'el ítem queda resuelto'
);

-- ── Guardar desde un link público ─────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select public.revoke_share_link(:'rec_id');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.get_public_recipe(:'link_token'), null, 'un token revocado ya no se puede leer');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select public.create_share_link(:'rec_id') as token \gset link2_

select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
select ok(
  public.fork_public_recipe(:'link2_token', :'c_pg_id') is not null,
  'C guarda en su grupo una receta que llegó por link'
);
select throws_ok(format('select public.fork_public_recipe(%L, %L)', :'link_token', :'c_pg_id'), 'P0001', 'Link not available',
  'no se puede guardar con un link revocado');

select * from finish();
rollback;
