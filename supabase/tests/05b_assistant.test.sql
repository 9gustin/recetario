-- T5B.1 — Conversaciones del asistente: privadas por usuario.

\set QUIET 1

begin;
select plan(7);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

select personal_group_id as id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \gset a_pg_
select personal_group_id as id from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' \gset b_pg_

-- B también es miembro del grupo de A.
insert into public.group_members (group_id, user_id, role)
values (:'a_pg_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select (public.save_recipe(jsonb_build_object(
  'group_id', :'a_pg_id', 'title', 'Pollo', 'servings', 2,
  'ingredients', jsonb_build_array(jsonb_build_object('raw_text', 'pollo', 'position', 0)),
  'steps', jsonb_build_array(jsonb_build_object('position', 0, 'instruction', 'Cocinar.'))
)) ->> 'id') as id \gset rec_

-- A crea una conversación y un mensaje que cita la receta.
insert into public.ai_conversations (group_id, user_id, purpose, title)
values (:'a_pg_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'assistant', 'Brócoli') returning id as id \gset conv_
select lives_ok(
  format($f$insert into public.ai_messages (conversation_id, role, content, mentions) values (%L, 'user', '{"text":"hola"}', array[%L]::uuid[])$f$, :'conv_id', :'rec_id'),
  'A guarda un mensaje en su conversación'
);
select is(
  (select count(*) from public.ai_messages where mentions @> array[:'rec_id'::uuid]), 1::bigint,
  'se pueden buscar los mensajes que citan una receta'
);

-- No puede crear una conversación a nombre de otro ni en un grupo ajeno.
select throws_ok(
  format($f$insert into public.ai_conversations (group_id, user_id, purpose) values (%L, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'assistant')$f$, :'a_pg_id'),
  '42501', null, 'no se puede crear una conversación a nombre de otra persona'
);
select throws_ok(
  format($f$insert into public.ai_conversations (group_id, user_id, purpose) values (%L, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'assistant')$f$, :'b_pg_id'),
  '42501', null, 'no se puede crear una conversación en un grupo ajeno'
);

-- B (mismo grupo) no ve las conversaciones ni los mensajes de A, ni puede escribir en ellos.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.ai_conversations), 0::bigint, 'B no ve las conversaciones de A');
select is((select count(*) from public.ai_messages), 0::bigint, 'B no ve los mensajes de A');
select throws_ok(
  format($f$insert into public.ai_messages (conversation_id, role, content) values (%L, 'user', '{"text":"intruso"}')$f$, :'conv_id'),
  '42501', null, 'B no puede escribir en una conversación de A'
);

select * from finish();
rollback;
