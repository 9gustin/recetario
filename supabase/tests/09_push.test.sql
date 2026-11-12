-- T10.1 — Push: suscripciones, preferencias y avisos son privados de cada persona.

\set QUIET 1

begin;
select plan(5);

do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into public.push_subscriptions (endpoint, keys) values ('https://push.example/a', '{"p256dh":"x","auth":"y"}');
insert into public.notification_prefs (prep, quiet_start, quiet_end) values (false, 22, 8);
insert into public.scheduled_pushes (key, kind, fire_at, title) values ('timer:1', 'timer', now(), 'Listo');

select is((select count(*)::int from public.push_subscriptions), 1, 'A ve su suscripción');
select is((select prep from public.notification_prefs), false, 'A ve sus preferencias');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::int from public.push_subscriptions), 0, 'B no ve la suscripción de A');
select is((select count(*)::int from public.notification_prefs), 0, 'B no ve las preferencias de A');
select throws_ok(
  $$insert into public.scheduled_pushes (user_id, key, kind, fire_at, title) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'timer', now(), 'x')$$,
  '42501', null, 'B no programa avisos para A');

select * from finish();
rollback;
